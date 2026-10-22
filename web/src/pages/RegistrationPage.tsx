import { t } from '../i18n'
import { useEffect, useState } from 'react'
import { Button, Checkbox, Dialog, Input, Modal, Popup, Steps } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router'
import { ENTRIES, TIME_SLOTS, makeId, matchCourses, newDraft, noticeFor, registrationErrors, today, trainingSubjects, validPlate } from '../domain/store'
import type { Draft, EntryType, Person, Vehicle } from '../domain/types'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Actions, FieldError, Icon, Missing, Screen, notifyError } from '../components/UI'
import { PlatePicker } from '../components/PlatePicker'
import { VisitSummary } from '../components/VisitSummary'
import { AppointmentCard } from '../components/registration/AppointmentCard'
import { ContractorInfoCard, LogisticsBusinessCard, VisitorInfoCard } from '../components/registration/BusinessInfoCards'
import { AccompanyingVehiclesCard, RegistrationRosterCard } from '../components/registration/RosterCards'
import { AreaSelectionCard, RequiredCoursesCard } from '../components/registration/TrainingCards'
import { useApiRoute } from '../domain/apiRoute'

type Editor = { id: string; name: string; phone: string; company: string; trade: string; plate: string }

function withLogisticsPeople(draft: Draft): Draft {
  if (draft.type !== 'logistics') return draft
  const people: Person[] = []
  for (const vehicle of draft.vehicles) {
    const name = vehicle.driver.trim()
    const phone = vehicle.phone.trim()
    if (!people.some(person => person.name === name && person.phone === phone)) people.push({ id: vehicle.id, name, phone, company: vehicle.company.trim() })
  }
  return { ...draft, people }
}

export function RegistrationPage() {
  useApiRoute()
  const { type: param } = useParams()
  const type = param as EntryType
  const { store, state } = useVisitSafe()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => withLogisticsPeople(state.drafts[type] || newDraft(type)))
  const [step, setStep] = useState(0)
  const [agreement, setAgreement] = useState(false)
  const [noticeSeconds, setNoticeSeconds] = useState(() => draft.noticeAccepted ? 0 : 3)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [editor, setEditor] = useState<Editor | null>(null)
  const [editorError, setEditorError] = useState('')
  const [plateEditor, setPlateEditor] = useState<{ id: string; value: string; roster: boolean } | null>(null)
  useEffect(() => {
    if (draft.noticeAccepted) return
    setNoticeSeconds(3)
    const deadline = Date.now() + 3000
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setNoticeSeconds(remaining)
      if (!remaining) window.clearInterval(timer)
    }
    const timer = window.setInterval(tick, 250)
    document.addEventListener('visibilitychange', tick)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [draft.noticeAccepted])
  if (!ENTRIES[type]) return <Missing title={t('登记类型不存在')} />
  const entry = ENTRIES[type]
  const notice = noticeFor(type)
  const noticeLines = notice.content.split(/\r?\n/)
  const subjects = trainingSubjects(draft)
  const courseIds = draft.areaIds.length ? matchCourses(type, draft.areaIds) : []
  const existingPerson = editor && type !== 'logistics' ? store.findParticipant(editor.name, editor.phone) : undefined
  const existingVehicle = editor && type === 'logistics' ? store.findVehicle(editor.plate) : undefined
  function save(next: Draft) {
    next = withLogisticsPeople(next)
    setDraft(next)
    try { store.saveDraft(next) } catch (error) { notifyError(error) }
  }
  function change<K extends keyof Draft>(field: K, value: Draft[K]) { save({ ...draft, [field]: value }); setErrors(previous => ({ ...previous, [field]: '' })) }
  function openEditor(item?: Person | Vehicle) {
    setEditor({ id: item?.id || makeId(), name: item ? ('driver' in item ? item.driver : item.name) : '', phone: item?.phone || '', company: item?.company || '', trade: item && 'trade' in item ? item.trade || '' : '', plate: item && 'plate' in item ? item.plate : '' })
    setEditorError('')
  }
  function saveEditor() {
    if (!editor) return
    if (type === 'contractor' && !draft.contractorCompany.trim()) { setEditorError('请先填写施工单位'); return }
    let next: Draft
    if (type === 'logistics') {
      const vehicle = { id: editor.id, plate: editor.plate, driver: editor.name, phone: editor.phone, company: editor.company }
        next = { ...draft, vehicles: draft.vehicles.some(item => item.id === editor.id) ? draft.vehicles.map(item => item.id === editor.id ? vehicle : item) : [...draft.vehicles, vehicle] }
    } else {
      const person = { id: editor.id, name: editor.name, phone: editor.phone, company: type === 'contractor' ? draft.contractorCompany : editor.company, trade: editor.trade }
        next = { ...draft, people: draft.people.some(item => item.id === editor.id) ? draft.people.map(item => item.id === editor.id ? person : item) : [...draft.people, person] }
    }
    next = withLogisticsPeople(next)
    const issues = registrationErrors(next)
    const error = issues.people || issues[type === 'logistics' ? 'vehicles' : 'people']
    if (error) { setEditorError(error); return }
    save(next); setEditor(null)
  }
  async function remove(id: string, kind: 'people' | 'vehicles' | 'accompanyingVehicles') {
    if (await Dialog.confirm({ title: t('删除这条登记信息？'), content: t('删除后可重新添加。'), confirmText: t('确认删除'), cancelText: t('保留') })) save({ ...draft, [kind]: draft[kind].filter(item => item.id !== id) })
  }
  function demo() {
    save({ ...draft, appointmentDate: today(), timeSlot: TIME_SLOTS[0], logisticsReasons: draft.logisticsReasons?.length ? draft.logisticsReasons : ['送货'], cargoType: draft.cargoType || '原材料', logisticsContact: draft.logisticsContact?.trim() ? draft.logisticsContact : '刘工', logisticsOrderNumber: draft.logisticsOrderNumber?.trim() ? draft.logisticsOrderNumber : 'WL-DEMO-001', hostName: '陈经理', visitReason: '会议', projectName: '设备检修', workArea: '一号车间', contractorCompany: '安全建设', supervisor: '刘工', people: type === 'logistics' ? [] : [{ id: makeId(), name: '张三', phone: '13800138001', company: type === 'contractor' ? '安全建设' : '示例公司', trade: '电工' }, { id: makeId(), name: '李四', phone: '13800138002', company: type === 'contractor' ? '安全建设' : '示例公司', trade: '焊工' }], vehicles: type === 'logistics' ? [{ id: makeId(), plate: '粤A12345', driver: '王师傅', phone: '13800138003', company: '示例物流' }, { id: makeId(), plate: '粤B67890', driver: '李师傅', phone: '13800138004', company: '示例物流' }] : [] })
    setErrors({})
  }
  function next() {
    if (step === 0) {
      const issues = registrationErrors(draft)
      setErrors(issues)
      if (Object.keys(issues).length) { notifyError(new Error(Object.values(issues)[0])); document.querySelector<HTMLElement>('.field-error')?.scrollIntoView({ block: 'center' }); return }
    }
    if (step === 1 && !draft.areaIds.length) { setErrors({ areaIds: '请至少选择一个访问区域' }); return }
    setErrors({}); setStep(step + 1); window.scrollTo(0, 0)
  }
  async function submit() {
    try { const visit = await store.register(draft); navigate(`/tasks/${visit.id}`, { replace: true }) } catch (error) { notifyError(error) }
  }
  return <Screen title={t('{0}登记', { 0: t(entry.label) })}>
    <div className="registration-steps"><Steps current={step}><Steps.Step title={t('登记信息')} /><Steps.Step title={t('访问区域')} /><Steps.Step title={t('确认提交')} /></Steps></div>
    {step === 0 && <>
      <AppointmentCard draft={draft} errors={errors} onChange={change} />
      {type === 'logistics' && <LogisticsBusinessCard draft={draft} errors={errors} onChange={change} />}
      {type === 'visitor' && <VisitorInfoCard draft={draft} errors={errors} onChange={change} />}
      {type === 'contractor' && <ContractorInfoCard draft={draft} errors={errors} onChange={change} />}
      <RegistrationRosterCard draft={draft} error={errors.people || (type === 'logistics' ? errors.vehicles : undefined)} onEdit={openEditor} onRemove={id => remove(id, type === 'logistics' ? 'vehicles' : 'people')} />
      {type !== 'logistics' && <AccompanyingVehiclesCard vehicles={draft.accompanyingVehicles} error={errors.accompanyingVehicles} onEdit={vehicle => setPlateEditor({ id: vehicle?.id || makeId(), value: vehicle?.plate || '', roster: false })} onRemove={id => remove(id, 'accompanyingVehicles')} />}
      <Button className="demo-button" block size="small" fill="none" onClick={demo}>{t('填入预约与两条演示数据')}</Button>
    </>}
    {step === 1 && <AreaSelectionCard selectedIds={draft.areaIds} error={errors.areaIds} subjectCount={subjects.length} courseCount={courseIds.length} onToggle={id => {
      const areaIds = draft.areaIds.includes(id) ? draft.areaIds.filter(value => value !== id) : [...draft.areaIds, id]
      try { matchCourses(type, areaIds) } catch (error) { notifyError(error); return }
      save({ ...draft, areaIds })
      setErrors({})
    }} />}
    {step === 2 && <>
      <div className="info-banner"><Icon name="check-green" size={18} />{t('请确认以下信息，提交后生成个人培训任务')}</div>
      <VisitSummary draft={draft} />
      <RequiredCoursesCard courses={courseIds.map(id => store.course(id))} subjectCount={subjects.length} />
    </>}
    <Actions><Button className="flex-1" onClick={() => step ? (setStep(step - 1), window.scrollTo(0, 0)) : navigate('/')}>{step ? t('上一步') : t('返回')}</Button><Button className="flex-[2]" color="primary" onClick={step === 2 ? submit : next}>{step === 2 ? t('提交并开始培训') : t('下一步')}</Button></Actions>
    <Modal className="notice-modal" bodyClassName="notice-modal-body" bodyStyle={{ maxHeight: 'calc(100dvh - 48px)' }} visible={!draft.noticeAccepted} closeOnMaskClick={false} content={<div className="notice-content"><span className="notice-icon"><Icon name="shield" size={38} /></span><h2>{notice.title}</h2><p className="muted small">{t('共同守护每一次安全到访')}</p><div className="notice-copy"><p>{noticeLines[0]}</p><p>{noticeLines[1]}</p><p>{noticeLines[2]}</p><p>{noticeLines.slice(3).join('\n')}</p></div><Checkbox checked={agreement} onChange={setAgreement}>{t('我已阅读并同意以上须知')}</Checkbox><Button block color="primary" disabled={!agreement || noticeSeconds > 0} onClick={() => save({ ...draft, noticeAccepted: true })}>{noticeSeconds > 0 ? t('确认并继续（{0}秒）', { 0: noticeSeconds }) : t('确认并继续')}</Button><Button block fill="none" onClick={() => navigate('/')}>{t('暂不登记')}</Button></div>} />
    <Popup visible={!!editor} onMaskClick={() => setEditor(null)} bodyStyle={{ borderRadius: '20px 20px 0 0', maxHeight: '90dvh', overflowY: 'auto' }}><div className="editor-sheet"><div className="sheet-heading"><h2>{type === 'logistics' ? t('车辆及司机资料') : t('人员资料')}</h2><button type="button" className="icon-button" aria-label={t('取消编辑')} onClick={() => setEditor(null)}><Icon name="close" /></button></div>{editor && <>
      {type === 'logistics' && <p className="muted small">{t('司机姓名和手机号码同时用于登记本次来访人员及安全培训。')}</p>}
      {type === 'logistics' && <div className="field"><span>{t('车牌号')}<em>*</em></span><button type="button" className="select-field" onClick={() => setPlateEditor({ id: editor.id, value: editor.plate, roster: true })}>{editor.plate || t('填写车牌')}<Icon name="chevron" size={18} /></button></div>}
      {(['name', 'phone', ...(type === 'contractor' ? ['trade'] : ['company'])] as const).map(field => { const label = field === 'name' ? (type === 'logistics' ? t('司机姓名') : t('姓名')) : field === 'phone' ? t('手机号码') : field === 'trade' ? t('工种') : type === 'logistics' ? t('运输单位') : t('所属单位'); return <label className="field" key={field}><span>{label}<em>*</em></span><Input aria-label={label} value={editor[field as keyof Editor]} type={field === 'phone' ? 'tel' : 'text'} maxLength={field === 'phone' ? 11 : 60} placeholder={t('请输入{0}', { 0: label })} onChange={value => setEditor({ ...editor, [field]: value })} /></label> })}
      {existingPerson && <Button block fill="outline" className="mb-3" onClick={() => setEditor({ ...editor, company: type === 'contractor' ? draft.contractorCompany : existingPerson.company, trade: existingPerson.trade || '' })}>{t('带入已有人员资料')}</Button>}
      {existingVehicle && <Button block fill="outline" className="mb-3" onClick={() => setEditor({ ...editor, company: existingVehicle.company })}>{t('带入车辆默认运输单位')}</Button>}
      {type === 'contractor' && <p className="muted small">{t('所属单位：')}{draft.contractorCompany || t('请先填写施工单位')}</p>}<FieldError message={editorError} /><Button block color="primary" onClick={saveEditor}>{type === 'logistics' ? t('保存车辆') : t('保存人员')}</Button>
    </>}</div></Popup>
    {plateEditor && <PlatePicker value={plateEditor.value} title={plateEditor.roster ? t('填写物流车牌') : t('随行车辆车牌')} onClose={() => setPlateEditor(null)} onConfirm={plate => { if (!validPlate(plate)) throw new Error('请填写有效车牌'); if (plateEditor.roster && editor) setEditor({ ...editor, plate }); else { if (draft.accompanyingVehicles.some(vehicle => vehicle.id !== plateEditor.id && vehicle.plate === plate)) throw new Error('随行车牌重复'); save({ ...draft, accompanyingVehicles: [...draft.accompanyingVehicles.filter(vehicle => vehicle.id !== plateEditor.id), { id: plateEditor.id, plate }] }) }; setPlateEditor(null) }} />}
  </Screen>
}
