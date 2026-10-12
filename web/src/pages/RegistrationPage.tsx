import { useEffect, useState } from 'react'
import { Button, Checkbox, Dialog, Input, Modal, Popup, Steps } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router'
import { ENTRIES, TIME_SLOTS, makeId, matchCourses, newDraft, registrationErrors, today, trainingSubjects, validPlate } from '../domain/store'
import type { Draft, EntryType, Person, Vehicle } from '../domain/types'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Actions, FieldError, Icon, Missing, Screen, notifyError } from '../components/UI'
import { PlatePicker } from '../components/PlatePicker'
import { VisitSummary } from '../components/VisitSummary'
import { AppointmentCard } from '../components/registration/AppointmentCard'
import { ContractorInfoCard, LogisticsBusinessCard, VisitorInfoCard } from '../components/registration/BusinessInfoCards'
import { AccompanyingVehiclesCard, RegistrationRosterCard } from '../components/registration/RosterCards'
import { AreaSelectionCard, RequiredCoursesCard } from '../components/registration/TrainingCards'

type Editor = { id: string; name: string; phone: string; company: string; trade: string; plate: string }

export function RegistrationPage() {
  const { type: param } = useParams()
  const type = param as EntryType
  const { store, state } = useVisitSafe()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => state.drafts[type] || newDraft(type))
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
  if (!ENTRIES[type]) return <Missing title="登记类型不存在" />
  const entry = ENTRIES[type]
  const subjects = trainingSubjects(draft)
  const courseIds = draft.areaIds.length ? matchCourses(type, draft.areaIds) : []
  function save(next: Draft) {
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
    const error = registrationErrors(next)[type === 'logistics' ? 'vehicles' : 'people']
    if (error) { setEditorError(error); return }
    save(next); setEditor(null)
  }
  async function remove(id: string, kind: 'people' | 'vehicles' | 'accompanyingVehicles') {
    if (await Dialog.confirm({ title: '删除这条登记信息？', content: '删除后可重新添加。', confirmText: '确认删除', cancelText: '保留' })) save({ ...draft, [kind]: draft[kind].filter(item => item.id !== id) })
  }
  function demo() {
    save({ ...draft, appointmentDate: today(), timeSlot: TIME_SLOTS[0], logisticsReasons: draft.logisticsReasons?.length ? draft.logisticsReasons : ['送货'], cargoType: draft.cargoType || '原材料', logisticsContact: draft.logisticsContact?.trim() ? draft.logisticsContact : '刘工', logisticsOrderNumber: draft.logisticsOrderNumber?.trim() ? draft.logisticsOrderNumber : 'WL-DEMO-001', hostName: '陈经理', visitReason: '会议', projectName: '设备检修', workArea: '一号车间', contractorCompany: '安全建设', supervisor: '刘工', people: type === 'logistics' ? [] : [{ id: makeId(), name: '张三', phone: '13800138001', company: type === 'contractor' ? '安全建设' : '示例公司', trade: '电工' }, { id: makeId(), name: '李四', phone: '13800138002', company: type === 'contractor' ? '安全建设' : '示例公司', trade: '焊工' }], vehicles: type === 'logistics' ? [{ id: makeId(), plate: '粤A12345', driver: '王师傅', phone: '13800138003', company: '示例物流' }, { id: makeId(), plate: '粤B67890', driver: '李师傅', phone: '13800138004', company: '示例物流' }] : [] })
    setErrors({})
  }
  function next() {
    if (step === 0) {
      const issues = registrationErrors(draft)
      setErrors(issues)
      if (Object.keys(issues).length) { document.querySelector<HTMLElement>('.field-error')?.scrollIntoView({ block: 'center' }); return }
    }
    if (step === 1 && !draft.areaIds.length) { setErrors({ areaIds: '请至少选择一个访问区域' }); return }
    setErrors({}); setStep(step + 1); window.scrollTo(0, 0)
  }
  function submit() {
    try { const visit = store.register(draft); navigate(`/tasks/${visit.id}`, { replace: true }) } catch (error) { notifyError(error) }
  }
  return <Screen title={`${entry.label}登记`}>
    <div className="registration-steps"><Steps current={step}><Steps.Step title="登记信息" /><Steps.Step title="访问区域" /><Steps.Step title="确认提交" /></Steps></div>
    {step === 0 && <>
      <AppointmentCard draft={draft} errors={errors} onChange={change} />
      {type === 'logistics' && <LogisticsBusinessCard draft={draft} errors={errors} onChange={change} />}
      {type === 'visitor' && <VisitorInfoCard draft={draft} errors={errors} onChange={change} />}
      {type === 'contractor' && <ContractorInfoCard draft={draft} errors={errors} onChange={change} />}
      <RegistrationRosterCard draft={draft} error={errors[type === 'logistics' ? 'vehicles' : 'people']} onEdit={openEditor} onRemove={id => remove(id, type === 'logistics' ? 'vehicles' : 'people')} />
      {type !== 'logistics' && <AccompanyingVehiclesCard vehicles={draft.accompanyingVehicles} error={errors.accompanyingVehicles} onEdit={vehicle => setPlateEditor({ id: vehicle?.id || makeId(), value: vehicle?.plate || '', roster: false })} onRemove={id => remove(id, 'accompanyingVehicles')} />}
      <Button className="demo-button" block size="small" fill="none" onClick={demo}>填入预约与两条演示数据</Button>
    </>}
    {step === 1 && <AreaSelectionCard selectedIds={draft.areaIds} error={errors.areaIds} subjectCount={subjects.length} courseCount={courseIds.length} onToggle={id => {
      save({ ...draft, areaIds: draft.areaIds.includes(id) ? draft.areaIds.filter(value => value !== id) : [...draft.areaIds, id] })
      setErrors({})
    }} />}
    {step === 2 && <>
      <div className="info-banner"><Icon name="check-green" size={18} />请确认以下信息，提交后生成个人培训任务</div>
      <VisitSummary draft={draft} />
      <RequiredCoursesCard courses={courseIds.map(id => store.course(id))} subjectCount={subjects.length} />
    </>}
    <Actions><Button className="flex-1" onClick={() => step ? (setStep(step - 1), window.scrollTo(0, 0)) : navigate('/')}>{step ? '上一步' : '返回'}</Button><Button className="flex-[2]" color="primary" onClick={step === 2 ? submit : next}>{step === 2 ? '提交并开始培训' : '下一步'}</Button></Actions>
    <Modal className="notice-modal" bodyClassName="notice-modal-body" bodyStyle={{ maxHeight: 'calc(100dvh - 48px)' }} visible={!draft.noticeAccepted} closeOnMaskClick={false} content={<div className="notice-content"><span className="notice-icon"><Icon name="shield" size={38} /></span><h2>{entry.label}须知</h2><p className="muted small">共同守护每一次安全到访</p><div className="notice-copy"><p>1. 请如实填写到访人员及车辆信息。</p><p>2. {entry.notice}</p><p>3. 完成申请区域对应培训并通过考试。</p><p>4. 携带访客凭证，遵守现场安排。</p></div><Checkbox checked={agreement} onChange={setAgreement}>我已阅读并同意以上须知</Checkbox><Button block color="primary" disabled={!agreement || noticeSeconds > 0} onClick={() => save({ ...draft, noticeAccepted: true })}>{noticeSeconds > 0 ? `确认并继续（${noticeSeconds}秒）` : '确认并继续'}</Button><Button block fill="none" onClick={() => navigate('/')}>暂不登记</Button></div>} />
    <Popup visible={!!editor} onMaskClick={() => setEditor(null)} bodyStyle={{ borderRadius: '20px 20px 0 0', maxHeight: '90dvh', overflowY: 'auto' }}><div className="editor-sheet"><div className="sheet-heading"><h2>{type === 'logistics' ? '车辆及司机资料' : '人员资料'}</h2><button type="button" className="icon-button" aria-label="取消编辑" onClick={() => setEditor(null)}><Icon name="close" /></button></div>{editor && <>
      {type === 'logistics' && <div className="field"><span>车牌号<em>*</em></span><button type="button" className="select-field" onClick={() => setPlateEditor({ id: editor.id, value: editor.plate, roster: true })}>{editor.plate || '填写车牌'}<Icon name="chevron" size={18} /></button></div>}
      {(['name', 'phone', ...(type === 'contractor' ? ['trade'] : ['company'])] as const).map(field => { const label = field === 'name' ? (type === 'logistics' ? '司机姓名' : '姓名') : field === 'phone' ? '手机号码' : field === 'trade' ? '工种' : type === 'logistics' ? '运输单位' : '所属单位'; return <label className="field" key={field}><span>{label}<em>*</em></span><Input aria-label={label} value={editor[field as keyof Editor]} type={field === 'phone' ? 'tel' : 'text'} maxLength={field === 'phone' ? 11 : 60} placeholder={`请输入${label}`} onChange={value => setEditor({ ...editor, [field]: value })} /></label> })}
      {type === 'contractor' && <p className="muted small">所属单位：{draft.contractorCompany || '请先填写施工单位'}</p>}<FieldError message={editorError} /><Button block color="primary" onClick={saveEditor}>保存{type === 'logistics' ? '车辆' : '人员'}</Button>
    </>}</div></Popup>
    {plateEditor && <PlatePicker value={plateEditor.value} title={plateEditor.roster ? '填写物流车牌' : '随行车辆车牌'} onClose={() => setPlateEditor(null)} onConfirm={plate => { if (!validPlate(plate)) throw new Error('请填写有效车牌'); if (plateEditor.roster && editor) setEditor({ ...editor, plate }); else { if (draft.accompanyingVehicles.some(vehicle => vehicle.id !== plateEditor.id && vehicle.plate === plate)) throw new Error('随行车牌重复'); save({ ...draft, accompanyingVehicles: [...draft.accompanyingVehicles.filter(vehicle => vehicle.id !== plateEditor.id), { id: plateEditor.id, plate }] }) }; setPlateEditor(null) }} />}
  </Screen>
}
