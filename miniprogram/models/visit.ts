export type EntryType = 'training' | 'visitor' | 'logistics' | 'contractor'

export interface Person {
  id: string
  name: string
  phone: string
  company: string
  trade: string
}

export interface Vehicle {
  id: string
  plate: string
  driver: string
  phone: string
  company: string
}

export interface Draft {
  id: string
  type: EntryType
  noticeAccepted: boolean
  people: Person[]
  vehicles: Vehicle[]
  areaIds: string[]
}

export interface Visit extends Draft {
  createdAt: number
}

export interface Question {
  id: string
  title: string
  options: string[]
  correct: number
  explanation: string
}

export interface ExamResult {
  score: number
  passed: boolean
  wrongIds: string[]
  answers: Record<string, number>
  submittedAt: number
  timedOut: boolean
}

export interface TrainingTask {
  id: string
  visitId: string
  planId: string
  createdAt: number
  completedLessonIds: string[]
  attempt?: {
    startedAt: number
    deadlineAt: number
    answers: Record<string, number>
  }
  lastResult?: ExamResult
  completedAt?: number
}

export const ENTRY_LABELS: Record<EntryType, string> = {
  training: '学习培训', visitor: '普通访客', logistics: '物流车辆', contractor: '施工人员'
}

export function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function normalizePlate(plate: string) {
  return plate.replace(/[\s·•.-]/g, '').toUpperCase()
}

export function validateDraft(draft: Draft): string {
  if (draft.type !== 'training' && !draft.noticeAccepted) return '请阅读并确认访客须知'
  if (!Object.prototype.hasOwnProperty.call(ENTRY_LABELS, draft.type)) return '请选择有效的登记入口'
  const phones = new Set<string>()
  if (draft.type === 'logistics') {
    if (!draft.vehicles.length) return '请至少添加一辆车辆'
    const plates = new Set<string>()
    for (const vehicle of draft.vehicles) {
      const plate = normalizePlate(vehicle.plate)
      if (!/^[\u4e00-\u9fa5][A-Z][A-Z0-9]{5,6}$/.test(plate)) return '请输入有效车牌，如粤B12345'
      if (plates.has(plate)) return '车牌重复，请检查车辆列表'
      plates.add(plate)
      if (!vehicle.driver.trim() || !vehicle.company.trim()) return '请填写司机姓名和运输单位'
      if (!/^1[3-9]\d{9}$/.test(vehicle.phone)) return '请输入司机的11位有效手机号码'
    }
  } else {
    if (!draft.people.length) return '请至少添加一位人员'
    for (const person of draft.people) {
      if (!person.name.trim() || !person.company.trim()) return '请填写人员姓名和所属单位'
      if (!/^1[3-9]\d{9}$/.test(person.phone)) return '请输入11位有效手机号码'
      if (phones.has(person.phone)) return '人员手机号码重复，请检查人员列表'
      phones.add(person.phone)
      if (draft.type === 'contractor' && !person.trade.trim()) return '请填写施工人员工种'
    }
  }
  if ((draft.type !== 'training' && !draft.areaIds.length) || draft.areaIds.some(id => !['production', 'research', 'office'].includes(id))) {
    return '请至少选择一个有效访问区域'
  }
  return ''
}

export function gradeExam(questions: Question[], answers: Record<string, number>): ExamResult {
  const wrongIds = questions.filter(q => answers[q.id] !== q.correct).map(q => q.id)
  const score = questions.length ? Math.round((questions.length - wrongIds.length) * 100 / questions.length) : 0
  return { score, passed: questions.length > 0 && score >= 80, wrongIds, answers: { ...answers }, submittedAt: 0, timedOut: false }
}

export function maskPhone(phone: string) {
  return phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone
}

export function formatDate(time: number) {
  const date = new Date(time)
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
