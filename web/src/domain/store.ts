import { api } from './apiClient'
import { baseData, configuration, draftValues, fieldKeys } from './apiCatalog'
import { COURSE_RULES } from './catalog'
import type { Draft, EntryType, Person } from './types'
import { getLanguage } from '../i18n'

export { AREAS, COURSES, ENTRIES, TIME_SLOTS, VISIT_REASONS } from './catalog'
export { createApiStore as createDemoStore } from './apiStore'
export type { ApiStore as DemoStore } from './apiStore'
export const STORAGE_KEY = 'visitsafe.api.drafts.v1'
export const makeId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')
export const today = (time = api.now()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(time)
export const normalizePlate = (plate: string) => plate.replace(/[\s·.-]/g, '').toUpperCase()
export const validPlate = (plate: string) => new RegExp(baseData().validationRules.platePattern).test(normalizePlate(plate))
export const maskPhone = (phone: string) => phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2')
export const formatMoment = (time: number) => new Intl.DateTimeFormat(getLanguage(), { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(time)
export const formatValidity = (time: number) => new Intl.DateTimeFormat(getLanguage(), { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(time)
export const noticeFor = (type: EntryType) => configuration(type).notice

export function matchCourses(type: EntryType, areaIds: string[]) {
  const ids: string[] = []
  for (const areaId of new Set(areaIds)) {
    const courses = COURSE_RULES[type]?.[areaId]
    if (!courses?.length) throw new Error('所选区域缺少本登记类型的培训课程')
    courses.forEach(id => { if (!ids.includes(id)) ids.push(id) })
  }
  return ids
}
export function newDraft(type: EntryType): Draft {
  const config = configuration(type)
  return { id: makeId(), type, configurationVersion: config.configurationVersion, noticeVersion: config.notice.version, noticeAccepted: false, appointmentDate: '', timeSlot: '', hostName: '', visitReason: '', projectName: '', workArea: '', contractorCompany: '', supervisor: '', people: [], vehicles: [], accompanyingVehicles: [], areaIds: [] }
}
export function trainingSubjects(draft: Draft): Person[] {
  return draft.people.map(person => ({ ...person, name: person.name.trim(), phone: person.phone.trim(), company: person.company.trim() }))
}
export function registrationErrors(draft: Draft, date = today()) {
  const config = configuration(draft.type)
  const data = baseData()
  const errors: Record<string, string> = {}
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(draft.appointmentDate) ? new Date(`${draft.appointmentDate}T00:00:00+08:00`) : new Date(NaN)
  if (!Number.isFinite(parsed.getTime()) || today(parsed.getTime()) !== draft.appointmentDate || draft.appointmentDate < date) errors.appointmentDate = '请选择今天或未来的有效预约日期'
  if (!data.timeSlots.some(option => option.label === draft.timeSlot)) errors.timeSlot = '请选择到访时段'
  const values = draftValues(draft)
  for (const field of config.fields) {
    const value = values[field.key]
    const errorKey = fieldKeys[field.key] || field.key
    const empty = value === undefined || value === null || value === '' || Array.isArray(value) && !value.length
    if (field.required && empty) errors[errorKey] = `请填写${field.label}`
    if (typeof value === 'string' && !empty && (field.minLength !== null && value.length < field.minLength || field.maxLength !== null && value.length > field.maxLength)) errors[errorKey] = `${field.label}长度不符合要求`
    if (!empty && field.options.length && (Array.isArray(value) ? value : [value]).some(item => !field.options.some(option => option.value === item))) errors[errorKey] = `请选择有效的${field.label}`
  }
  const subjects = trainingSubjects(draft)
  if (subjects.length < config.participantRules.minimumCount) errors.people = draft.vehicles.length ? '请独立登记培训人员；司机和车辆资料不能代替人员登记' : '请至少添加一位人员'
  const keys = new Set<string>()
  for (const person of subjects) {
    const key = `${person.name}\u0000${person.phone}`
    if (!person.name || data.validationRules.participantNameMaxLength !== null && person.name.length > data.validationRules.participantNameMaxLength) errors.people = '请填写有效的人员姓名'
    if (!new RegExp(data.validationRules.phonePattern).test(person.phone) || keys.has(key)) errors.people = '手机号无效或人员重复，请检查人员名单'
    keys.add(key)
  }
  const type = data.visitTypes.find(item => String(item.id) === String(config.visitTypeId))!
  const vehicles = [...draft.vehicles, ...draft.accompanyingVehicles]
  if (type.vehicleRequired && !vehicles.length) errors.vehicles = '请至少添加一辆车'
  const plates = new Set<string>()
  for (const vehicle of vehicles) {
    const plate = normalizePlate(vehicle.plate)
    if (!validPlate(plate) || plates.has(plate)) errors.vehicles = errors.accompanyingVehicles = '车牌无效或重复，请检查车辆名单'
    if (type.transportCompanyRequired && (!('company' in vehicle) || typeof vehicle.company !== 'string' || !vehicle.company.trim())) errors.vehicles = '请填写运输单位'
    plates.add(plate)
  }
  return errors
}
