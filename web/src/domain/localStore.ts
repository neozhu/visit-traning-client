import { CARGO_TYPES, COURSES, COURSE_RULES, ENTRIES, LOGISTICS_REASONS, TIME_SLOTS, VISIT_REASONS } from './catalog'
import type { AppState, Draft, EntryType, ExamResult, Person, StoragePort, TrainingTask, Visit, Course, VehicleSnapshot } from './types'
import { isAppState, isCourse } from './validateState'

export { AREAS, COURSES, ENTRIES, TIME_SLOTS, VISIT_REASONS } from './catalog'
export const STORAGE_KEY = 'visitsafe.web.v3'
export const makeId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
export const today = (time = Date.now()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(time)
export const normalizePlate = (plate: string) => plate.replace(/[\s·.-]/g, '').toUpperCase()
export const validPlate = (plate: string) => /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-HJ-NP-Z][A-HJ-NP-Z0-9]{5,6}$/.test(normalizePlate(plate))
export const maskPhone = (phone: string) => phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
export const formatMoment = (time: number) => new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(time)
export const formatValidity = (time: number) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(time)

function currentTrainingTasks(data: AppState, visitId?: string) {
  const visit = visitId ? data.visits.find(item => item.id === visitId) : undefined
  const tasks = visitId ? data.tasks.filter(task => visit?.taskIds.includes(task.id)) : data.tasks
  return tasks.filter(task => !tasks.some(other => other.subjectId === task.subjectId && other.courseId === task.courseId && other.roundNumber > task.roundNumber))
}
export const correctAnswer = (question: Course['questions'][number], answers: number[] = []) => answers.length === question.correctIndexes.length && question.correctIndexes.every(index => answers.includes(index))
export const noticeFor = (type: EntryType) => ({ title: `${ENTRIES[type].label}须知`, content: `1. 请如实填写到访人员及车辆信息。\n2. ${ENTRIES[type].notice}\n3. 完成申请区域对应培训并通过考试。\n4. 携带访客凭证，遵守现场安排。` })

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
const emptyState = (): AppState => ({ version: 3, drafts: {}, visits: [], tasks: [], participants: [], vehicleProfiles: [] })

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
    if (!task) throw new Error('培训任务不存在，请返回学习入口')
    return task
  }
  function course(id: string) {
    const value = COURSES.find(item => item.id === id)
    if (!value) throw new Error('培训课程不存在')
    return value
  }
  function isTrainingValid(task: TrainingTask) {
    const now = clock()
    return !!task.result?.passed && task.completedAt !== undefined && task.validUntil !== undefined && task.completedAt <= now && now < task.validUntil
  }
  function participant(data: AppState, person: Person) {
    const clean = { ...person, name: person.name.trim(), phone: person.phone.trim(), company: person.company.trim() }
    if (!clean.name || !/^1[3-9]\d{9}$/.test(clean.phone)) throw new Error('请填写有效的姓名和手机号')
    const existing = data.participants.find(item => item.name === clean.name && item.phone === clean.phone)
    if (existing) return { ...clean, id: existing.id }
    if (!clean.id || data.participants.some(item => item.id === clean.id)) clean.id = makeId()
    data.participants.push(structuredClone(clean))
    return clean
  }
  function vehicleSnapshots(data: AppState, draft: Draft): VehicleSnapshot[] {
    const values = draft.type === 'logistics' ? draft.vehicles.map(item => ({ plate: item.plate, company: item.company.trim(), driverName: item.driver.trim() })) : draft.accompanyingVehicles.map(item => ({ plate: item.plate, company: '' }))
    return values.map(value => {
      const plate = normalizePlate(value.plate)
      let profile = data.vehicleProfiles.find(item => item.plate === plate)
      if (!profile) {
        profile = { ...value, plate, id: makeId() }
        data.vehicleProfiles.push(profile)
      }
      return { ...value, plate, vehicleId: profile.id }
    })
  }
  function allocate(data: AppState, subjectId: string, courseId: string, appointmentDate?: string, minimumRound = 1, snapshot?: Course) {
    const candidates = data.tasks.filter(task => task.subjectId === subjectId && task.courseId === courseId)
    const appointmentStart = appointmentDate ? Date.parse(`${appointmentDate}T00:00:00+08:00`) : -Infinity
    const passed = candidates.filter(task => task.roundNumber >= minimumRound && isTrainingValid(task) && task.validUntil! > appointmentStart).sort((a, b) => b.completedAt! - a.completedAt! || a.id.localeCompare(b.id))[0]
    if (passed) return passed
    const pending = candidates.filter(task => task.roundNumber >= minimumRound && task.completedAt === undefined).sort((a, b) => b.roundNumber - a.roundNumber)[0]
    if (pending) return pending
    const content = snapshot ?? course(courseId)
    if (!isCourse(content)) throw new Error('课程内容或考试规则配置无效')
    const task: TrainingTask = { id: makeId(), subjectId, courseId, roundNumber: Math.max(0, ...candidates.map(item => item.roundNumber)) + 1, courseSnapshot: structuredClone(content), completedLessons: [], examHistory: [] }
    data.tasks.push(task)
    return task
  }
  function refreshTraining(data: AppState) {
    for (const visit of data.visits) {
      for (const task of currentTrainingTasks(data, visit.id)) {
        if (task.validUntil === undefined || clock() < task.validUntil) continue
        const next = allocate(data, task.subjectId, task.courseId, visit.appointmentDate, task.roundNumber + 1, task.courseSnapshot)
        if (!visit.taskIds.includes(next.id)) visit.taskIds.push(next.id)
        if (isTrainingValid(next) && !visit.exemptTaskIds.includes(next.id)) visit.exemptTaskIds.push(next.id)
      }
    }
  }
  function needsLearning(task: TrainingTask) {
    if (task.completedAt !== undefined) throw new Error(isTrainingValid(task) ? '培训已通过，无需再次学习或考试' : '培训已过期，请返回培训任务继续当前轮次')
  }
  function ready(task: TrainingTask) {
    if (!task.courseSnapshot.lessons.every(lesson => task.completedLessons.includes(lesson.id))) throw new Error('请先完成全部视频学习')
  }
  function exam(task: TrainingTask) {
    const startedAt = clock()
    return { id: makeId(), attemptNumber: task.examHistory.length + 1, startedAt, deadlineAt: startedAt + task.courseSnapshot.examDurationMinutes * 60000, answers: {} }
  }
  function register(draft: Draft, source: Visit['source']) {
    return update(next => {
      const existing = next.visits.find(visit => visit.id === draft.id)
      if (existing) return existing
      if (!ENTRIES[draft.type]) throw new Error('登记类型不存在')
      if (source === 'external' && !draft.noticeAccepted) throw new Error('请先阅读并同意访客须知')
      const error = Object.values(registrationErrors(draft, today(clock())))[0]
      if (error) throw new Error(error)
      const courseIds = matchCourses(draft.type, draft.areaIds)
      const clean = structuredClone(draft)
      clean.noticeAccepted = source === 'external'
      clean.vehicles = clean.vehicles.map(vehicle => ({ ...vehicle, plate: normalizePlate(vehicle.plate) }))
      clean.accompanyingVehicles = clean.accompanyingVehicles.map(vehicle => ({ ...vehicle, plate: normalizePlate(vehicle.plate) }))
      const subjects = trainingSubjects(clean).map(person => participant(next, person))
      const visit: Visit = { ...clean, areaIds: [...new Set(clean.areaIds)], subjects, courseIds, createdAt: clock(), taskIds: [], exemptTaskIds: [], vehicleSnapshots: vehicleSnapshots(next, clean), source, noticeSnapshot: noticeFor(clean.type), ...(source === 'external' ? { noticeAcceptedAt: clock() } : {}) }
      for (const subject of subjects) for (const courseId of courseIds) {
        const task = allocate(next, subject.id, courseId, visit.appointmentDate)
        visit.taskIds.push(task.id)
        if (isTrainingValid(task)) visit.exemptTaskIds.push(task.id)
      }
      next.visits.unshift(visit)
      delete next.drafts[draft.type]
      return visit
    })
  }
  const store = {
    snapshot: () => state,
    recovered: () => recovered,
    refresh() {
      const next = readState()
      const before = JSON.stringify(next)
      refreshTraining(next)
      if (JSON.stringify(next) !== before) storage.write(STORAGE_KEY, next)
      publish(next)
    },
    subscribe(listener: () => void) { subscribers.add(listener); return () => { subscribers.delete(listener) } },
    course,
    isTrainingValid,
    currentTasks(visitId?: string) { return currentTrainingTasks(state, visitId) },
    task(id: string) { return getTask(state, id) },
    taskHome(id: string, visitId?: string | null) {
      const visit = state.visits.find(item => item.id === visitId && item.taskIds.includes(id))
      return visit ? `/tasks/${visit.id}?person=${getTask(state, id).subjectId}` : '/training'
    },
    taskVisits(id: string) { return state.visits.filter(visit => visit.taskIds.includes(id)) },
    findParticipant(name: string, phone: string) { return structuredClone(state.participants.find(item => item.name === name.trim() && item.phone === phone.trim())) },
    findVehicle(plate: string) { return structuredClone(state.vehicleProfiles.find(item => item.plate === normalizePlate(plate))) },
    saveDraft(draft: Draft) { return update(next => { next.drafts[draft.type] = structuredClone(draft); return draft }) },
    register(draft: Draft) { return register(draft, 'external') },
    registerInternal(draft: Draft) { return register(draft, 'internal') },
    acceptNotice(visitId: string) {
      return update(next => {
        const visit = next.visits.find(item => item.id === visitId)
        if (!visit) throw new Error('申请不存在')
        if (visit.noticeAcceptedAt === undefined) visit.noticeAcceptedAt = clock()
        visit.noticeAccepted = true
        return visit
      })
    },
    assignTraining(person: Person, courseIds: string[]) {
      return update(next => {
        if (!courseIds.length) throw new Error('请至少选择一门课程')
        const profile = participant(next, person)
        return [...new Set(courseIds)].map(id => {
          if (!isCourse(course(id))) throw new Error('课程内容或考试规则配置无效')
          return allocate(next, profile.id, id)
        })
      })
    },
    pendingTasks(name: string, phone: string) {
      if (!name.trim()) throw new Error('请输入登记时的姓名')
      if (!/^1[3-9]\d{9}$/.test(phone.trim())) throw new Error('请输入有效的11位手机号')
      store.refresh()
      const person = store.findParticipant(name, phone)
      return store.currentTasks().filter(task => task.subjectId === person?.id && task.completedAt === undefined)
    },
    startLearning(taskId: string) {
      return update(next => {
        const task = getTask(next, taskId)
        needsLearning(task)
        if (task.startedAt === undefined) task.startedAt = clock()
        return task
      })
    },
    completeLesson(taskId: string, lessonId: string) {
      return update(next => {
        const task = getTask(next, taskId)
        needsLearning(task)
        if (!task.courseSnapshot.lessons.some(lesson => lesson.id === lessonId)) throw new Error('学习视频不存在')
        if (task.startedAt === undefined) task.startedAt = clock()
        if (!task.completedLessons.includes(lessonId)) task.completedLessons.push(lessonId)
        return task
      })
    },
    beginExam(taskId: string) {
      return update(next => {
        const task = getTask(next, taskId)
        needsLearning(task)
        ready(task)
        if (!task.attempt && task.result) throw new Error('请从考试结果开始重考')
        if (!task.attempt) task.attempt = exam(task)
        return task
      })
    },
    answer(taskId: string, questionId: string, answer: number | number[]) {
      return update(next => {
        const task = getTask(next, taskId)
        needsLearning(task)
        if (!task.attempt) throw new Error('请先开始考试')
        if (clock() >= task.attempt.deadlineAt) throw new Error('考试时间已结束')
        const question = task.courseSnapshot.questions.find(item => item.id === questionId)
        const answers = [...new Set(Array.isArray(answer) ? answer : [answer])].sort((a, b) => a - b)
        if (!question || (question.kind === 'single' && answers.length > 1) || !answers.every(index => Number.isInteger(index) && index >= 0 && index < question.options.length)) throw new Error('答题选项无效')
        if (answers.length) task.attempt.answers[questionId] = answers
        else delete task.attempt.answers[questionId]
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
        const questions = task.courseSnapshot.questions
        const timedOut = clock() >= task.attempt.deadlineAt
        if (!timedOut && questions.some(question => !task.attempt!.answers[question.id]?.length)) throw new Error('还有题目未作答，请完成后交卷')
        const wrongIds = questions.filter(question => !correctAnswer(question, task.attempt!.answers[question.id])).map(question => question.id)
        const score = (questions.length - wrongIds.length) * 20
        const submittedAt = clock()
        task.result = { score, passed: score >= task.courseSnapshot.passScore, timedOut, submittedAt, answers: structuredClone(task.attempt.answers), wrongIds }
        if (task.result.passed) {
          const validityDays = course(task.courseId).trainingValidityDays
          if (!Number.isInteger(validityDays) || validityDays <= 0) throw new Error('课程培训有效期配置无效')
          task.completedAt = submittedAt
          task.validUntil = submittedAt + validityDays * 86400000
        }
        task.examHistory.push({ ...structuredClone(task.attempt), result: structuredClone(task.result) })
        delete task.attempt
        return task.result
      })
    },
    retake(taskId: string) {
      return update(next => {
        const task = getTask(next, taskId)
        needsLearning(task)
        ready(task)
        if (!task.result || task.attempt) throw new Error('请先完成当前考试')
        task.attempt = exam(task)
        return task
      })
    },
    deleteVisit(id: string) {
      return update(next => {
        next.visits = next.visits.filter(visit => visit.id !== id)
        return true
      })
    },
  }
  try { store.refresh() } catch { /* Preserve the last readable state if renewal cannot be saved. */ }
  return store
}
export type DemoStore = ReturnType<typeof createDemoStore>
