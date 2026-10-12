import { CARGO_TYPES, COURSES, COURSE_RULES, ENTRIES, LOGISTICS_REASONS, TIME_SLOTS, VISIT_REASONS } from './catalog'
import type { AppState, Draft, EntryType, ExamResult, Person, StoragePort, TrainingTask } from './types'
import { isAppState } from './validateState'

export { AREAS, COURSES, ENTRIES, TIME_SLOTS, VISIT_REASONS } from './catalog'
export const STORAGE_KEY = 'visitsafe.web.v1'
export const makeId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
export const today = (time = Date.now()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(time)
export const normalizePlate = (plate: string) => plate.replace(/[\s·.-]/g, '').toUpperCase()
export const validPlate = (plate: string) => /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-HJ-NP-Z][A-HJ-NP-Z0-9]{5,6}$/.test(normalizePlate(plate))
export const maskPhone = (phone: string) => phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
export const formatMoment = (time: number) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(time)

export function matchCourses(type: EntryType, areaIds: string[]) {
  if (!areaIds.length) throw new Error('请至少选择一个访问区域')
  const ids: string[] = []
  for (const areaId of new Set(areaIds)) {
    const courses = COURSE_RULES[type]?.[areaId]
    if (!courses?.length) throw new Error('所选区域缺少本登记类型的培训课程')
    courses.forEach(id => { if (!ids.includes(id)) ids.push(id) })
  }
  return ids
}
export function newDraft(type: EntryType): Draft {
  return { id: makeId(), type, noticeAccepted: false, appointmentDate: '', timeSlot: '', hostName: '', visitReason: '', projectName: '', workArea: '', contractorCompany: '', supervisor: '', people: [], vehicles: [], accompanyingVehicles: [], areaIds: [] }
}
export function registrationErrors(draft: Draft, date = today()) {
  const errors: Record<string, string> = {}
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(draft.appointmentDate) ? new Date(`${draft.appointmentDate}T00:00:00+08:00`) : new Date(NaN)
  if (!Number.isFinite(parsed.getTime()) || today(parsed.getTime()) !== draft.appointmentDate || draft.appointmentDate < date) errors.appointmentDate = '请选择今天或未来的有效预约日期'
  if (!TIME_SLOTS.includes(draft.timeSlot)) errors.timeSlot = '请选择到访时段'
  if (draft.type === 'visitor') {
    if (!draft.hostName.trim()) errors.hostName = '请填写被访人姓名'
    if (!VISIT_REASONS.includes(draft.visitReason)) errors.visitReason = '请选择到访事由'
  }
  if (draft.type === 'contractor') {
    for (const [key, label] of [['projectName', '项目名称'], ['workArea', '施工位置'], ['contractorCompany', '施工单位'], ['supervisor', '现场负责人']] as const) if (!draft[key].trim()) errors[key] = `请填写${label}`
  }
  const plates = new Set<string>()
  const phones = new Set<string>()
  if (draft.type === 'logistics') {
    if (!draft.logisticsReasons?.length || !draft.logisticsReasons.every(reason => LOGISTICS_REASONS.includes(reason))) errors.logisticsReasons = '请选择入厂事由'
    if (!CARGO_TYPES.includes(draft.cargoType || '')) errors.cargoType = '请选择货物类型'
    if (!draft.logisticsContact?.trim()) errors.logisticsContact = '请填写厂内对接人'
    if (!draft.logisticsOrderNumber?.trim()) errors.logisticsOrderNumber = '请填写业务单号'
    if (!draft.vehicles.length) errors.vehicles = '请至少添加一辆车及司机'
    for (const vehicle of draft.vehicles) {
      if (!vehicle.driver.trim() || !vehicle.company.trim()) errors.vehicles = '请补齐司机姓名与运输单位'
      if (!/^1[3-9]\d{9}$/.test(vehicle.phone.trim())) errors.vehicles = '请输入司机的有效手机号'
      const plate = normalizePlate(vehicle.plate)
      if (!validPlate(plate) || plates.has(plate)) errors.vehicles = '车牌无效或重复，请检查车辆名单'
      plates.add(plate)
    }
  } else {
    if (!draft.people.length) errors.people = '请至少添加一位人员'
    for (const person of draft.people) {
      if (!person.name.trim()) errors.people = '请填写人员姓名'
      if (!/^1[3-9]\d{9}$/.test(person.phone.trim()) || phones.has(person.phone.trim())) errors.people = '手机号无效或重复，请检查人员名单'
      if (draft.type === 'visitor' && !person.company.trim()) errors.people = '请填写人员所属单位'
      if (draft.type === 'contractor' && !person.trade?.trim()) errors.people = '请填写人员工种'
      phones.add(person.phone.trim())
    }
    for (const vehicle of draft.accompanyingVehicles) {
      const plate = normalizePlate(vehicle.plate)
      if (!validPlate(plate) || plates.has(plate)) errors.accompanyingVehicles = '随行车牌无效或重复'
      plates.add(plate)
    }
  }
  return errors
}
export function trainingSubjects(draft: Draft): Person[] {
  if (draft.type !== 'logistics') return draft.people.map(person => ({ ...person, name: person.name.trim(), phone: person.phone.trim(), company: draft.type === 'contractor' ? draft.contractorCompany.trim() : person.company.trim() }))
  const subjects: Person[] = []
  for (const vehicle of draft.vehicles) {
    const name = vehicle.driver.trim()
    const phone = vehicle.phone.trim()
    if (!subjects.some(person => person.name === name && person.phone === phone)) subjects.push({ id: vehicle.id, name, phone, company: vehicle.company.trim() })
  }
  return subjects
}
const emptyState = (): AppState => ({ version: 1, drafts: {}, visits: [], tasks: [] })

export function createDemoStore(storage: StoragePort, clock: () => number = Date.now) {
  let state = emptyState()
  let recovered = false
  function readState(): AppState {
    const data = storage.read(STORAGE_KEY)
    if (data === undefined) return emptyState()
    if (isAppState(data)) return structuredClone(data)
    recovered = true
    return emptyState()
  }
  try { state = readState() } catch { recovered = true }
  const subscribers = new Set<() => void>()
  function publish(next: AppState) {
    if (JSON.stringify(next) === JSON.stringify(state)) return
    state = next
    subscribers.forEach(notify => notify())
  }
  function update<T>(change: (next: AppState) => T): T {
    const next = readState()
    const result = change(next)
    storage.write(STORAGE_KEY, next)
    publish(next)
    return structuredClone(result)
  }
  function getTask(data: AppState, id: string): TrainingTask {
    const task = data.tasks.find(item => item.id === id)
    if (!task) throw new Error('培训任务不存在，请返回我的记录')
    return task
  }
  function course(id: string) {
    const value = COURSES.find(item => item.id === id)
    if (!value) throw new Error('培训课程不存在')
    return value
  }
  function ready(task: TrainingTask) {
    if (!course(task.courseId).lessons.every(lesson => task.completedLessons.includes(lesson.id))) throw new Error('请先完成全部视频学习')
  }
  const store = {
    snapshot: () => state,
    recovered: () => recovered,
    refresh() { publish(readState()) },
    subscribe(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener) } },
    course,
    task(id: string) { return getTask(state, id) },
    saveDraft(draft: Draft) { return update(next => { next.drafts[draft.type] = structuredClone(draft); return draft }) },
    register(draft: Draft) {
      return update(next => {
        const existing = next.visits.find(visit => visit.id === draft.id)
        if (existing) return existing
        if (!draft.noticeAccepted) throw new Error('请先阅读并同意访客须知')
        if (!ENTRIES[draft.type]) throw new Error('登记类型不存在')
        const error = Object.values(registrationErrors(draft, today(clock())))[0]
        if (error) throw new Error(error)
        const courseIds = matchCourses(draft.type, draft.areaIds)
        const clean = structuredClone(draft)
        clean.vehicles = clean.vehicles.map(vehicle => ({ ...vehicle, plate: normalizePlate(vehicle.plate) }))
        clean.accompanyingVehicles = clean.accompanyingVehicles.map(vehicle => ({ ...vehicle, plate: normalizePlate(vehicle.plate) }))
        const subjects = trainingSubjects(clean)
        const visit = { ...clean, areaIds: [...new Set(clean.areaIds)], subjects, courseIds, createdAt: clock() }
        next.visits.unshift(visit)
        for (const subject of subjects) for (const courseId of courseIds) next.tasks.push({ id: makeId(), visitId: visit.id, subjectId: subject.id, courseId, completedLessons: [] })
        delete next.drafts[draft.type]
        return visit
      })
    },
    pendingTasks(name: string, phone: string) {
      if (!name.trim()) throw new Error('请输入登记时的姓名')
      if (!/^1[3-9]\d{9}$/.test(phone.trim())) throw new Error('请输入有效的11位手机号')
      return state.tasks.filter(task => !task.result?.passed && state.visits.some(visit => visit.id === task.visitId && visit.subjects.some(person => person.id === task.subjectId && person.name === name.trim() && person.phone === phone.trim())))
    },
    completeLesson(taskId: string, lessonId: string) {
      return update(next => {
        const task = getTask(next, taskId)
        if (!course(task.courseId).lessons.some(lesson => lesson.id === lessonId)) throw new Error('学习视频不存在')
        if (!task.completedLessons.includes(lessonId)) task.completedLessons.push(lessonId)
        return task
      })
    },
    beginExam(taskId: string) {
      return update(next => {
        const task = getTask(next, taskId)
        ready(task)
        if (task.result?.passed) throw new Error('培训已通过，无需再次考试')
        if (!task.attempt) task.attempt = { startedAt: clock(), deadlineAt: clock() + 15 * 60 * 1000, answers: {} }
        return task
      })
    },
    answer(taskId: string, questionId: string, answer: number) {
      return update(next => {
        const task = getTask(next, taskId)
        if (!task.attempt) throw new Error('请先开始考试')
        if (clock() >= task.attempt.deadlineAt) throw new Error('考试时间已结束')
        const question = course(task.courseId).questions.find(item => item.id === questionId)
        if (!question || !Number.isInteger(answer) || answer < 0 || answer >= question.options.length) throw new Error('答题选项无效')
        task.attempt.answers[questionId] = answer
        return task
      })
    },
    submitExam(taskId: string): ExamResult {
      return update(next => {
        const task = getTask(next, taskId)
        if (!task.attempt) {
          if (task.result) return task.result
          throw new Error('请先开始考试')
        }
        const questions = course(task.courseId).questions
        const timedOut = clock() >= task.attempt.deadlineAt
        if (!timedOut && questions.some(question => task.attempt!.answers[question.id] === undefined)) throw new Error('还有题目未作答，请完成后交卷')
        const wrongIds = questions.filter(question => task.attempt!.answers[question.id] !== question.correct).map(question => question.id)
        const score = (questions.length - wrongIds.length) * 20
        task.result = { score, passed: score >= 80, timedOut, submittedAt: clock(), answers: { ...task.attempt.answers }, wrongIds }
        if (task.result.passed) task.completedAt = clock()
        delete task.attempt
        return task.result
      })
    },
    retake(taskId: string) {
      return update(next => {
        const task = getTask(next, taskId)
        ready(task)
        if (task.result?.passed) throw new Error('培训已通过，无需重考')
        if (!task.result || task.attempt) throw new Error('请先完成当前考试')
        task.attempt = { startedAt: clock(), deadlineAt: clock() + 15 * 60 * 1000, answers: {} }
        return task
      })
    },
    deleteVisit(id: string) {
      return update(next => {
        next.visits = next.visits.filter(visit => visit.id !== id)
        next.tasks = next.tasks.filter(task => task.visitId !== id)
        return true
      })
    },
  }
  return store
}
export type DemoStore = ReturnType<typeof createDemoStore>
