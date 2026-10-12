import { AREAS, COURSES } from './catalog'
import type { AppState, Draft, Person, TrainingTask, Visit } from './types'

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
  if (!Array.isArray(value.people) || !value.people.every(isPerson) || !unique(value.people.map(person => person.id))) return false
  if (!Array.isArray(value.vehicles) || !value.vehicles.every(vehicle => isObject(vehicle) && stringFields(vehicle, ['id', 'plate', 'driver', 'phone', 'company']) && !!vehicle.id)) return false
  if (!Array.isArray(value.accompanyingVehicles) || !value.accompanyingVehicles.every(vehicle => isObject(vehicle) && stringFields(vehicle, ['id', 'plate']) && !!vehicle.id)) return false
  return Array.isArray(value.areaIds) && value.areaIds.every(id => AREAS.some(area => area.id === id))
}

function isVisit(value: unknown): value is Visit {
  if (!isDraft(value)) return false
  const visit = value as Partial<Visit>
  return isNumber(visit.createdAt) && Array.isArray(visit.subjects) && visit.subjects.length > 0 && visit.subjects.every(isPerson) && unique(visit.subjects.map(person => person.id))
    && Array.isArray(visit.courseIds) && visit.courseIds.length > 0 && unique(visit.courseIds) && visit.courseIds.every(id => COURSES.some(course => course.id === id))
}

function isTask(value: unknown, visits: Visit[]): value is TrainingTask {
  if (!isObject(value) || !stringFields(value, ['id', 'visitId', 'subjectId', 'courseId']) || !value.id) return false
  const visit = visits.find(item => item.id === value.visitId)
  const course = COURSES.find(item => item.id === value.courseId)
  if (!visit || !course || !visit.subjects.some(person => person.id === value.subjectId) || !visit.courseIds.includes(course.id)) return false
  if (!Array.isArray(value.completedLessons) || !value.completedLessons.every(id => course.lessons.some(lesson => lesson.id === id)) || !unique(value.completedLessons)) return false
  const validAnswers = (answers: unknown) => isObject(answers) && Object.entries(answers).every(([id, answer]) => {
    const question = course.questions.find(item => item.id === id)
    return question && typeof answer === 'number' && Number.isInteger(answer) && answer >= 0 && answer < question.options.length
  })
  if (value.attempt !== undefined) {
    if (!isObject(value.attempt) || !isNumber(value.attempt.startedAt) || !isNumber(value.attempt.deadlineAt) || value.attempt.deadlineAt <= value.attempt.startedAt || !validAnswers(value.attempt.answers)) return false
  }
  if (value.result !== undefined) {
    const result = value.result
    if (!isObject(result) || !isNumber(result.score) || typeof result.passed !== 'boolean' || typeof result.timedOut !== 'boolean' || !isNumber(result.submittedAt) || !validAnswers(result.answers) || !Array.isArray(result.wrongIds)) return false
    const answers = result.answers as Record<string, number>
    const savedWrongIds = result.wrongIds
    const wrongIds = course.questions.filter(question => answers[question.id] !== question.correct).map(question => question.id)
    if (result.score !== (course.questions.length - wrongIds.length) * 20 || result.passed !== (result.score >= 80) || savedWrongIds.length !== wrongIds.length || !wrongIds.every(id => savedWrongIds.includes(id))) return false
    if (result.passed && value.attempt) return false
  }
  return value.completedAt === undefined || isNumber(value.completedAt)
}

// Reject an incomplete snapshot as a whole so missing tasks cannot appear as completed training.
export function isAppState(value: unknown): value is AppState {
  if (!isObject(value) || value.version !== 1 || !isObject(value.drafts) || !Array.isArray(value.visits) || !Array.isArray(value.tasks)) return false
  if (!Object.entries(value.drafts).every(([type, draft]) => entryTypes.includes(type) && isDraft(draft) && draft.type === type)) return false
  if (!value.visits.every(isVisit) || !unique(value.visits.map(visit => visit.id))) return false
  const visits: Visit[] = value.visits
  if (!value.tasks.every(task => isTask(task, visits)) || !unique(value.tasks.map(task => task.id))) return false
  const tasks: TrainingTask[] = value.tasks
  const pairs = tasks.map(task => JSON.stringify([task.visitId, task.subjectId, task.courseId]))
  return unique(pairs) && visits.every(visit => visit.subjects.every(person => visit.courseIds.every(courseId => tasks.some(task => task.visitId === visit.id && task.subjectId === person.id && task.courseId === courseId))))
}
