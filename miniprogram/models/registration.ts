import { Draft, normalizePlate } from './visit'

export const TIME_SLOTS = ['08:30–12:00', '13:00–17:00']
export const VISIT_REASONS = ['会议', '面试', '洽谈']
export const REGISTRATION_FIELDS = ['appointmentDate', 'timeSlot', 'hostName', 'visitReason', 'projectName', 'workArea', 'contractorCompany', 'supervisor'] as const
export type RegistrationField = typeof REGISTRATION_FIELDS[number]

export function calendarDate(time = Date.now()) {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getRegistrationErrors(draft: Draft, today = calendarDate()): Record<string, string> {
  if (draft.type === 'training') return {}
  const errors: Record<string, string> = {}
  const date = draft.appointmentDate || ''
  if (!date) errors.appointmentDate = '请选择预约日期'
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || calendarDate(new Date(`${date}T00:00:00`).getTime()) !== date) errors.appointmentDate = '请选择有效的预约日期'
  else if (date < today) errors.appointmentDate = '预约日期不能早于今天'
  if (!TIME_SLOTS.includes(draft.timeSlot || '')) errors.timeSlot = '请选择到访时段'
  if (draft.type === 'visitor') {
    if (!draft.hostName?.trim()) errors.hostName = '请输入被访人姓名'
    if (!VISIT_REASONS.includes(draft.visitReason || '')) errors.visitReason = '请选择到访事由'
  }
  if (draft.type === 'contractor') {
    const fields = { projectName: '项目名称', workArea: '施工位置', contractorCompany: '施工单位', supervisor: '现场负责人' } as const
    for (const field of Object.keys(fields) as Array<keyof typeof fields>) {
      if (!draft[field]?.trim()) errors[field] = `请输入${fields[field]}`
    }
  }
  if (draft.type === 'visitor' || draft.type === 'contractor') {
    const plates = new Set<string>()
    for (const vehicle of draft.accompanyingVehicles || []) {
      const plate = normalizePlate(vehicle.plate)
      if (!/^[\u4e00-\u9fa5][A-Z][A-Z0-9]{5,6}$/.test(plate)) errors[`accompanying-${vehicle.id}`] = '请输入有效车牌，如粤B12345'
      else if (plates.has(plate)) errors[`accompanying-${vehicle.id}`] = '车牌重复，请检查随行车辆'
      plates.add(plate)
    }
  }
  return errors
}

export function getRegistrationSections(draft: Draft) {
  if (draft.type === 'training') return []
  const value = (text?: string) => text?.trim() || '未填写'
  const sections = [{ title: '预约信息', fields: [
    { label: '预约日期', value: value(draft.appointmentDate) }, { label: '到访时段', value: value(draft.timeSlot) }
  ] }]
  if (draft.type === 'visitor') sections.push({ title: '到访信息', fields: [
    { label: '被访人', value: value(draft.hostName) }, { label: '到访事由', value: value(draft.visitReason) }
  ] })
  if (draft.type === 'contractor') sections.push({ title: '施工信息', fields: [
    { label: '项目名称', value: value(draft.projectName) }, { label: '施工位置', value: value(draft.workArea) },
    { label: '施工单位', value: value(draft.contractorCompany) }, { label: '现场负责人', value: value(draft.supervisor) }
  ] })
  return sections
}
