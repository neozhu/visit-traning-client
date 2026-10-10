import { getPlan, matchPlans } from '../data/catalog'
import { Draft, ENTRY_LABELS, EntryType, ExamResult, TrainingTask, Visit, gradeExam, makeId, normalizePlate, validateDraft } from '../models/visit'

export interface StoragePort {
  read(key: string): unknown
  write(key: string, value: unknown): void
}

interface State {
  version: number
  drafts: Partial<Record<EntryType, Draft>>
  visits: Visit[]
  tasks: TrainingTask[]
}

export const STORAGE_KEY = 'visitsafe.demo.v1'
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const empty = (): State => ({ version: 1, drafts: {}, visits: [], tasks: [] })

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const strings = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string')

function validDraft(value: unknown): value is Draft {
  return object(value) && strings(value, ['id', 'type']) && !!value.id
    && Object.prototype.hasOwnProperty.call(ENTRY_LABELS, value.type as string) && typeof value.noticeAccepted === 'boolean'
    && Array.isArray(value.people) && value.people.every(p => object(p) && strings(p, ['id', 'name', 'phone', 'company', 'trade']))
    && Array.isArray(value.vehicles) && value.vehicles.every(v => object(v) && strings(v, ['id', 'plate', 'driver', 'phone', 'company']))
    && Array.isArray(value.areaIds) && value.areaIds.every(id => ['production', 'research', 'office'].includes(id))
}

function validTask(value: unknown): value is TrainingTask {
  if (!object(value) || !strings(value, ['id', 'visitId', 'planId']) || !value.id || !number(value.createdAt)) return false
  try {
    const plan = getPlan(value.planId as string)
    if (!Array.isArray(value.completedLessonIds) || !value.completedLessonIds.every(id => plan.lessons.some(l => l.id === id))) return false
    const answersValid = (answers: unknown) => object(answers) && Object.entries(answers).every(([id, index]) => {
      const question = plan.questions.find(q => q.id === id)
      return !!question && typeof index === 'number' && Number.isInteger(index) && index >= 0 && index < question.options.length
    })
    const attempt = value.attempt
    if (attempt !== undefined && (!object(attempt) || !number(attempt.startedAt) || !number(attempt.deadlineAt)
      || attempt.deadlineAt <= attempt.startedAt || !answersValid(attempt.answers))) return false
    const result = value.lastResult
    if (result !== undefined) {
      if (!object(result) || !number(result.submittedAt) || typeof result.timedOut !== 'boolean' || !answersValid(result.answers)
        || !Array.isArray(result.wrongIds) || !result.wrongIds.every(id => plan.questions.some(q => q.id === id))) return false
      const expected = gradeExam(plan.questions, result.answers as Record<string, number>)
      if (result.score !== expected.score || result.passed !== expected.passed || result.wrongIds.length !== expected.wrongIds.length) return false
      if (result.passed && !plan.lessons.every(l => (value.completedLessonIds as string[]).includes(l.id))) return false
    }
    return value.completedAt === undefined || number(value.completedAt)
  } catch (_) { return false }
}

function relevantRoster<T extends Draft>(draft: T): T {
  return { ...draft, people: draft.type === 'logistics' ? [] : draft.people, vehicles: draft.type === 'logistics' ? draft.vehicles : [] }
}

const requiredPlans = (visit: Visit) => visit.type === 'training' && visit.areaIds.length
  ? visit.areaIds : matchPlans(visit.type, visit.areaIds)

function updateLegacyQuestions(raw: unknown): unknown {
  if (!object(raw) || typeof raw.planId !== 'string') return raw
  try {
    const plan = getPlan(raw.planId)
    const retired = (id: string) => [6, 7, 8, 9, 10].some(index => id === `${plan.id}-q${index}`)
    const values = [raw.attempt, raw.lastResult].filter(object)
    if (!values.some(v => (object(v.answers) && Object.keys(v.answers).some(retired))
      || (Array.isArray(v.wrongIds) && v.wrongIds.some(retired)))) return raw
    const task = clone(raw) as unknown as TrainingTask
    const current = (answers: Record<string, number>) => Object.fromEntries(Object.entries(answers).filter(([id]) => !retired(id)))
    if (task.attempt && object(task.attempt.answers)) task.attempt.answers = current(task.attempt.answers)
    if (task.lastResult && object(task.lastResult.answers) && Array.isArray(task.lastResult.wrongIds)
      && task.lastResult.wrongIds.every(id => retired(id) || plan.questions.some(q => q.id === id))) {
      task.lastResult = { ...task.lastResult, ...gradeExam(plan.questions, current(task.lastResult.answers)),
        submittedAt: task.lastResult.submittedAt, timedOut: task.lastResult.timedOut }
      if (!task.lastResult.passed) delete task.completedAt
    }
    return task
  } catch (_) { return raw }
}

function load(storage: StoragePort): State {
  try {
    const value = storage.read(STORAGE_KEY)
    if (!object(value) || value.version !== 1 || !object(value.drafts) || !Array.isArray(value.visits) || !Array.isArray(value.tasks)) return empty()
    const next = empty()
    for (const [type, draft] of Object.entries(value.drafts)) {
      if (validDraft(draft) && draft.type === type) next.drafts[draft.type] = relevantRoster(clone(draft))
    }
    next.visits = value.visits.filter((v): v is Visit => validDraft(v) && number((v as Visit).createdAt) && !validateDraft(v)).map(v => relevantRoster(clone(v)))
    value.tasks.map(updateLegacyQuestions).filter(validTask).forEach(raw => {
      const visit = next.visits.find(v => v.id === raw.visitId)
      if (!visit || !requiredPlans(visit).includes(raw.planId)) return
      const task = clone(raw)
      const index = next.tasks.findIndex(t => t.visitId === task.visitId && t.planId === task.planId)
      if (index < 0) { next.tasks.push(task); return }
      // Older demo versions created one copy per person. Keep the best shared progress.
      const previous = next.tasks[index]
      const rank = (t: TrainingTask) => t.lastResult?.passed ? 10000 : t.attempt ? 1000 + Object.keys(t.attempt.answers).length : t.completedLessonIds.length
      const selected = rank(task) > rank(previous) ? task : previous
      selected.completedLessonIds = [...new Set([...previous.completedLessonIds, ...task.completedLessonIds])]
      next.tasks[index] = selected
    })
    next.visits.forEach(visit => requiredPlans(visit).forEach(planId => {
      if (!next.tasks.some(t => t.visitId === visit.id && t.planId === planId)) {
        next.tasks.push({ id: makeId('task'), visitId: visit.id, planId, createdAt: visit.createdAt, completedLessonIds: [] })
      }
    }))
    return next
  } catch (_) { /* An unreadable cache should not prevent opening the demo. */ }
  return empty()
}

export function createVisitStore(storage: StoragePort, clock: () => number = Date.now) {
  let state = load(storage)
  function mutate<T>(change: (next: State) => T): T {
    const next = clone(state)
    const result = change(next)
    storage.write(STORAGE_KEY, next)
    state = next
    return clone(result)
  }
  function requireTask(next: State, id: string) {
    const task = next.tasks.find(t => t.id === id)
    if (!task) throw new Error('培训任务不存在，请返回记录列表')
    return task
  }
  function ready(task: TrainingTask) {
    const plan = getPlan(task.planId)
    if (!plan.lessons.every(l => task.completedLessonIds.includes(l.id))) throw new Error('请先完成全部视频学习')
  }
  const store = {
    draft(type: EntryType): Draft {
      return clone(state.drafts[type] || { id: makeId('visit'), type, noticeAccepted: false, people: [], vehicles: [], areaIds: [] })
    },
    saveDraft(draft: Draft) { return mutate(next => { next.drafts[draft.type] = clone(draft); return draft }) },
    register(draft: Draft): Visit {
      const existing = state.visits.find(v => v.id === draft.id)
      if (existing) return clone(existing)
      const issue = validateDraft(draft)
      if (issue) throw new Error(issue)
      return mutate(next => {
        const visit: Visit = relevantRoster({ ...clone(draft), areaIds: draft.type === 'training' ? [] : [...new Set(draft.areaIds)], createdAt: clock() })
        visit.vehicles.forEach(v => { v.plate = normalizePlate(v.plate) })
        next.visits.unshift(visit)
        matchPlans(visit.type, visit.areaIds).forEach(planId => {
          next.tasks.push({ id: makeId('task'), visitId: visit.id, planId, createdAt: clock(), completedLessonIds: [] })
        })
        delete next.drafts[draft.type]
        return visit
      })
    },
    visits(): Visit[] { return clone(state.visits) },
    visit(id: string): Visit | undefined { const value = state.visits.find(v => v.id === id); return value && clone(value) },
    tasks(visitId?: string): TrainingTask[] { return clone(state.tasks.filter(t => !visitId || t.visitId === visitId)) },
    task(id: string): TrainingTask | undefined { const value = state.tasks.find(t => t.id === id); return value && clone(value) },
    visitStatus(id: string): 'completed' | 'learning' {
      const tasks = state.tasks.filter(t => t.visitId === id)
      return tasks.length && tasks.every(t => t.lastResult?.passed) ? 'completed' : 'learning'
    },
    markLesson(taskId: string, lessonId: string) {
      return mutate(next => {
        const task = requireTask(next, taskId)
        if (!getPlan(task.planId).lessons.some(l => l.id === lessonId)) throw new Error('视频不存在')
        if (!task.completedLessonIds.includes(lessonId)) task.completedLessonIds.push(lessonId)
        return task
      })
    },
    beginExam(taskId: string) {
      return mutate(next => {
        const task = requireTask(next, taskId)
        ready(task)
        if (task.lastResult?.passed) throw new Error('此培训已完成，请查看考试结果')
        if (!task.attempt) task.attempt = { startedAt: clock(), deadlineAt: clock() + 15 * 60 * 1000, answers: {} }
        return task
      })
    },
    answer(taskId: string, questionId: string, index: number) {
      return mutate(next => {
        const task = requireTask(next, taskId)
        const question = getPlan(task.planId).questions.find(q => q.id === questionId)
        if (!question) throw new Error('题目不存在')
        if (!Number.isInteger(index) || index < 0 || index >= question.options.length) throw new Error('选项无效')
        if (!task.attempt) throw new Error('请先开始考试')
        if (clock() >= task.attempt.deadlineAt) throw new Error('考试时间已结束')
        task.attempt.answers[questionId] = index
        return task
      })
    },
    finishExam(taskId: string, allowIncomplete = false): ExamResult {
      return mutate(next => {
        const task = requireTask(next, taskId)
        if (!task.attempt) {
          if (task.lastResult) return task.lastResult
          throw new Error('请先开始考试')
        }
        const questions = getPlan(task.planId).questions
        const timedOut = clock() >= task.attempt.deadlineAt
        if (!timedOut && !allowIncomplete && questions.some(q => task.attempt!.answers[q.id] === undefined)) throw new Error('还有题目未作答，请完成后交卷')
        const result = gradeExam(questions, task.attempt.answers)
        result.submittedAt = clock()
        result.timedOut = timedOut
        task.lastResult = result
        if (result.passed) task.completedAt = clock()
        delete task.attempt
        return result
      })
    },
    retake(taskId: string) {
      return mutate(next => {
        const task = requireTask(next, taskId)
        ready(task)
        if (task.lastResult?.passed) throw new Error('此培训已通过，无需重考')
        task.attempt = { startedAt: clock(), deadlineAt: clock() + 15 * 60 * 1000, answers: {} }
        return task
      })
    },
    removeVisit(visitId: string) {
      return mutate(next => {
        next.visits = next.visits.filter(v => v.id !== visitId)
        next.tasks = next.tasks.filter(t => t.visitId !== visitId)
        return true
      })
    }
  }
  return store
}
