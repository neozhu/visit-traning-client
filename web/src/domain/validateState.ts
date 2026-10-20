import { AREAS, CARGO_TYPES, LOGISTICS_REASONS } from './catalog'
import type { AppState, Draft, Person, TrainingTask, Visit, Course, ExamResult } from './types'

const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const stringFields = (value: Record<string, unknown>, keys: string[]) => keys.every(key => typeof value[key] === 'string')
const unique = (ids: string[]) => new Set(ids).size === ids.length
const entryTypes = ['visitor', 'logistics', 'contractor']

function isPerson(value: unknown): value is Person {
  return isObject(value) && stringFields(value, ['id', 'name', 'phone', 'company']) && !!value.id && (value.trade === undefined || typeof value.trade === 'string')
}

function isDraft(value: unknown): value is Draft {
  if (!isObject(value) || !stringFields(value, ['id', 'type', 'appointmentDate', 'timeSlot', 'hostName', 'visitReason', 'projectName', 'workArea', 'contractorCompany', 'supervisor'])) return false
  if (!value.id || !entryTypes.includes(String(value.type)) || typeof value.noticeAccepted !== 'boolean') return false
  if (value.logisticsReasons !== undefined && (!Array.isArray(value.logisticsReasons) || !value.logisticsReasons.every(reason => LOGISTICS_REASONS.includes(reason)) || !unique(value.logisticsReasons))) return false
  if (value.cargoType !== undefined && value.cargoType !== '' && !CARGO_TYPES.includes(String(value.cargoType))) return false
  if (!['logisticsContact', 'cargoType', 'logisticsOrderNumber'].every(key => value[key] === undefined || typeof value[key] === 'string')) return false
  if (!Array.isArray(value.people) || !value.people.every(isPerson) || !unique(value.people.map(person => person.id))) return false
  if (!Array.isArray(value.vehicles) || !value.vehicles.every(vehicle => isObject(vehicle) && stringFields(vehicle, ['id', 'plate', 'driver', 'phone', 'company']) && !!vehicle.id)) return false
  if (!Array.isArray(value.accompanyingVehicles) || !value.accompanyingVehicles.every(vehicle => isObject(vehicle) && stringFields(vehicle, ['id', 'plate']) && !!vehicle.id)) return false
  return Array.isArray(value.areaIds) && value.areaIds.every(id => AREAS.some(area => area.id === id))
}

const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === 'string') && unique(value)
const positiveInteger = (value: unknown): value is number => isNumber(value) && Number.isInteger(value) && value > 0
const indexes = (value: unknown): value is number[] => Array.isArray(value) && value.every(item => Number.isInteger(item) && item >= 0 && item < 4) && new Set(value).size === value.length

export function isCourse(value: unknown): value is Course {
  if (!isObject(value) || !stringFields(value, ['id', 'title', 'subtitle', 'icon']) || !value.id || !positiveInteger(value.trainingValidityDays)) return false
  if (!isNumber(value.passScore) || value.passScore <= 0 || value.passScore > 100 || !positiveInteger(value.examDurationMinutes)) return false
  if (!Array.isArray(value.lessons) || !value.lessons.length || !value.lessons.every(lesson => isObject(lesson) && stringFields(lesson, ['id', 'title', 'description', 'source']) && !!lesson.id && !!lesson.source) || !unique(value.lessons.map(lesson => lesson.id))) return false
  return Array.isArray(value.questions) && value.questions.length === 5 && unique(value.questions.map(question => isObject(question) ? String(question.id) : '')) && value.questions.every(question =>
    isObject(question) && stringFields(question, ['id', 'title', 'explanation']) && !!question.id && Array.isArray(question.options) && question.options.length === 4 && question.options.every(option => typeof option === 'string' && option.trim())
    && indexes(question.correctIndexes) && (question.kind === 'single' ? question.correctIndexes.length === 1 : question.kind === 'multiple' && question.correctIndexes.length >= 2))
}

function validAnswers(value: unknown, course: Course): value is Record<string, number[]> {
  return isObject(value) && Object.entries(value).every(([id, answers]) => {
    const question = course.questions.find(item => item.id === id)
    return question && indexes(answers) && answers.length > 0 && (question.kind === 'multiple' || answers.length === 1)
  })
}

function isResult(value: unknown, course: Course): value is ExamResult {
  if (!isObject(value) || !isNumber(value.score) || typeof value.passed !== 'boolean' || typeof value.timedOut !== 'boolean' || !isNumber(value.submittedAt) || !validAnswers(value.answers, course) || !strings(value.wrongIds)) return false
  const answers = value.answers
  const wrongIds = course.questions.filter(question => answers[question.id]?.length !== question.correctIndexes.length || !question.correctIndexes.every(index => answers[question.id]?.includes(index))).map(question => question.id)
  return value.score === (5 - wrongIds.length) * 20 && value.passed === (value.score >= course.passScore) && value.wrongIds.length === wrongIds.length && wrongIds.every(id => (value.wrongIds as string[]).includes(id))
}

function isTask(value: unknown, participants: Person[]): value is TrainingTask {
  if (!isObject(value) || !stringFields(value, ['id', 'subjectId', 'courseId']) || !value.id || !participants.some(person => person.id === value.subjectId) || !positiveInteger(value.roundNumber) || !isCourse(value.courseSnapshot)) return false
  const course = value.courseSnapshot
  if (course.id !== value.courseId || !strings(value.completedLessons) || !value.completedLessons.every(id => course.lessons.some(lesson => lesson.id === id))) return false
  if (value.startedAt !== undefined && !isNumber(value.startedAt)) return false
  if (value.completedLessons.length && value.startedAt === undefined) return false
  const isExam = (exam: unknown) => isObject(exam) && typeof exam.id === 'string' && !!exam.id && positiveInteger(exam.attemptNumber) && isNumber(exam.startedAt) && isNumber(exam.deadlineAt) && exam.deadlineAt === exam.startedAt + course.examDurationMinutes * 60000 && validAnswers(exam.answers, course)
  if (!Array.isArray(value.examHistory) || !value.examHistory.every((exam, index) => isExam(exam) && exam.attemptNumber === index + 1 && isResult(exam.result, course) && exam.result.submittedAt >= exam.startedAt && exam.result.timedOut === (exam.result.submittedAt >= exam.deadlineAt) && JSON.stringify(exam.answers) === JSON.stringify(exam.result.answers))) return false
  if (!unique(value.examHistory.map(exam => exam.id))) return false
  if (value.attempt !== undefined && (!isExam(value.attempt) || (value.attempt as Record<string, unknown>).attemptNumber !== value.examHistory.length + 1)) return false
  if ((value.attempt || value.examHistory.length) && !course.lessons.every(lesson => (value.completedLessons as string[]).includes(lesson.id))) return false
  const last = value.examHistory.at(-1)
  if (JSON.stringify(value.result) !== JSON.stringify(last?.result)) return false
  if (value.examHistory.slice(0, -1).some(exam => exam.result.passed)) return false
  if (last?.result.passed) return value.attempt === undefined && value.completedAt === last.result.submittedAt && isNumber(value.validUntil) && value.validUntil > last.result.submittedAt
  return value.completedAt === undefined && value.validUntil === undefined
}

function isVisit(value: unknown): value is Visit {
  if (!isDraft(value)) return false
  const visit = value as Partial<Visit>
  if (!isNumber(visit.createdAt) || !Array.isArray(visit.subjects) || !visit.subjects.length || !visit.subjects.every(isPerson) || !unique(visit.subjects.map(person => person.id))) return false
  if (!strings(visit.courseIds) || !visit.courseIds.length || !strings(visit.taskIds) || !strings(visit.exemptTaskIds)) return false
  if (!isObject(visit.noticeSnapshot) || !stringFields(visit.noticeSnapshot, ['title', 'content']) || !visit.noticeSnapshot.title || !visit.noticeSnapshot.content) return false
  if (!['external', 'internal'].includes(visit.source ?? '') || (visit.noticeAcceptedAt !== undefined && !isNumber(visit.noticeAcceptedAt)) || visit.noticeAccepted !== (visit.noticeAcceptedAt !== undefined) || (visit.source === 'external' && !visit.noticeAccepted)) return false
  return Array.isArray(visit.vehicleSnapshots) && visit.vehicleSnapshots.every(vehicle => {
    if (!isObject(vehicle) || !stringFields(vehicle, ['vehicleId', 'plate', 'company']) || (vehicle.driverName !== undefined && typeof vehicle.driverName !== 'string')) return false
    for (const [time, user] of [['checkedInAt', 'checkedInById'], ['checkedOutAt', 'checkedOutById']]) {
      if ((vehicle[time] === undefined) !== (vehicle[user] === undefined)) return false
      if (vehicle[time] !== undefined && (!isNumber(vehicle[time]) || typeof vehicle[user] !== 'string' || !vehicle[user])) return false
    }
    return vehicle.checkedOutAt === undefined || (isNumber(vehicle.checkedInAt) && isNumber(vehicle.checkedOutAt) && vehicle.checkedOutAt >= vehicle.checkedInAt)
  }) && unique(visit.vehicleSnapshots.map(vehicle => vehicle.vehicleId))
}

// Reject partial snapshots so missing references cannot appear as completed training.
export function isAppState(value: unknown): value is AppState {
  if (!isObject(value) || value.version !== 3 || !isObject(value.drafts) || !Array.isArray(value.visits) || !Array.isArray(value.tasks) || !Array.isArray(value.participants) || !Array.isArray(value.vehicleProfiles)) return false
  if (!Object.entries(value.drafts).every(([type, draft]) => entryTypes.includes(type) && isDraft(draft) && draft.type === type)) return false
  if (!value.participants.every(isPerson) || !unique(value.participants.map(person => person.id)) || !unique(value.participants.map(person => JSON.stringify([person.name.trim(), person.phone.trim()])))) return false
  if (!value.vehicleProfiles.every(vehicle => isObject(vehicle) && stringFields(vehicle, ['id', 'plate', 'company']) && !!vehicle.id && /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼][A-HJ-NP-Z][A-HJ-NP-Z0-9]{5,6}$/.test(vehicle.plate as string) && (vehicle.driverName === undefined || typeof vehicle.driverName === 'string'))) return false
  if (!unique(value.vehicleProfiles.map(vehicle => vehicle.id)) || !unique(value.vehicleProfiles.map(vehicle => vehicle.plate))) return false
  if (!value.tasks.every(task => isTask(task, value.participants as Person[])) || !unique(value.tasks.map(task => task.id))) return false
  const tasks: TrainingTask[] = value.tasks
  if (!unique(tasks.map(task => JSON.stringify([task.subjectId, task.courseId, task.roundNumber])))) return false
  if (!unique(tasks.filter(task => task.completedAt === undefined).map(task => JSON.stringify([task.subjectId, task.courseId])))) return false
  if (!value.visits.every(isVisit) || !unique(value.visits.map(visit => visit.id))) return false
  const visits: Visit[] = value.visits
  return visits.every(visit => visit.subjects.every(person => (value.participants as Person[]).some(profile => profile.id === person.id && profile.name === person.name && profile.phone === person.phone))
    && visit.taskIds.every(id => tasks.some(task => task.id === id && visit.subjects.some(person => person.id === task.subjectId) && visit.courseIds.includes(task.courseId)))
    && visit.exemptTaskIds.every(id => visit.taskIds.includes(id) && tasks.some(task => task.id === id && task.result?.passed))
    && visit.subjects.every(person => visit.courseIds!.every(courseId => visit.taskIds.some(id => tasks.some(task => task.id === id && task.subjectId === person.id && task.courseId === courseId))))
    && visit.vehicleSnapshots.every(snapshot => (value.vehicleProfiles as Record<string, unknown>[]).some(profile => profile.id === snapshot.vehicleId && profile.plate === snapshot.plate)))
}
