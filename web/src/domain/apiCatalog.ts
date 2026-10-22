import type { BaseData } from './apiTypes'
import { AREAS, CARGO_TYPES, COURSES, COURSE_RULES, ENTRIES, LOGISTICS_REASONS, TIME_SLOTS, VISIT_REASONS } from './catalog'
import type { Course, Draft } from './types'

let data: BaseData | undefined
const presentation = structuredClone(ENTRIES)
export const fieldKeys: Record<string, keyof Draft> = {
  hostName: 'hostName', visitReason: 'visitReason', entryReason: 'logisticsReasons',
  cargoType: 'cargoType', businessOrderNumber: 'logisticsOrderNumber', logisticsContactName: 'logisticsContact',
  projectName: 'projectName', workArea: 'workArea', contractorCompany: 'contractorCompany', supervisor: 'supervisor',
}
export function baseData(): BaseData {
  if (!data) throw new Error('基础配置尚未加载，请刷新页面')
  return data
}
export function configuration(type: string) {
  const id = baseData().visitTypes.find(item => item.code === type)?.id
  const config = baseData().registrationConfigs.find(item => item.visitTypeId === id)
  if (!config) throw new Error('该登记类型当前不可用')
  return config
}
export function typeCode(id: number, name?: string) {
  const found = baseData().visitTypes.find(item => item.id === id)
  if (found) return found.code
  // Historical disabled types still have an explanation in their application snapshot.
  const code = `history-${id}`
  ENTRIES[code] ??= { label: name || '历史登记', description: '', icon: 'user-home', color: 'green', notice: '' }
  return code
}
export function coursePreview(course: BaseData['courses'][number]): Course {
  return { id: String(course.id), title: course.title, subtitle: course.subtitle || '', icon: course.icon || 'book',
    trainingValidityDays: 60, passScore: course.passingScore, examDurationMinutes: course.examDurationMinutes,
    lessons: Array.from({ length: course.videoCount }, (_, i) => ({ id: `preview-${i}`, title: '', description: '', source: '' })), questions: [] }
}
export function applyBaseData(value: BaseData) {
  data = value
  for (const key of Object.keys(ENTRIES)) delete ENTRIES[key]
  for (const type of value.visitTypes) {
    const original = presentation[type.code]
    const notice = value.registrationConfigs.find(config => config.visitTypeId === type.id)?.notice
    ENTRIES[type.code] = { label: type.name, description: type.description || original?.description || '',
      icon: original?.icon || type.icon || 'user-home', color: original?.color || type.color || 'green', notice: notice?.content || '' }
  }
  AREAS.splice(0, AREAS.length, ...value.areas.map(area => ({ id: String(area.id), name: area.name,
    caption: area.caption || '', description: area.description || '', icon: area.icon || 'building', color: area.color || 'green' })))
  TIME_SLOTS.splice(0, TIME_SLOTS.length, ...value.timeSlots.map(option => option.label))
  COURSES.splice(0, COURSES.length, ...value.courses.map(coursePreview))
  for (const key of Object.keys(COURSE_RULES)) delete COURSE_RULES[key]
  for (const config of value.registrationConfigs) {
    const code = typeCode(config.visitTypeId)
    COURSE_RULES[code] = Object.fromEntries(config.areaRules.filter(rule => rule.selectable).map(rule => [String(rule.areaId), rule.requiredCourseIds.map(String)]))
  }
  for (const [key, options] of [['visitReason', VISIT_REASONS], ['entryReason', LOGISTICS_REASONS], ['cargoType', CARGO_TYPES]] as const) {
    const field = value.registrationConfigs.flatMap(config => config.fields).find(item => item.key === key)
    options.splice(0, options.length, ...(field?.options.map(option => option.label) || []))
  }
}
export function draftValues(draft: Draft): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of configuration(draft.type).fields) {
    const property = fieldKeys[field.key]
    if (!property) continue
    const raw = draft[property]
    const convert = (value: unknown) => field.options.find(option => option.label === value || option.value === value)?.value ?? (typeof value === 'string' ? value.trim() : value)
    result[field.key] = Array.isArray(raw) ? raw.map(convert) : convert(raw)
  }
  return result
}
