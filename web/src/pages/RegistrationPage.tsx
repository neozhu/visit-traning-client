import { useState } from 'react'
import { Button, Checkbox, DatePicker, Dialog, Input, Modal, Picker, Popup, Steps } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router'
import { AREAS, ENTRIES, TIME_SLOTS, VISIT_REASONS, makeId, maskPhone, matchCourses, newDraft, registrationErrors, today, trainingSubjects, validPlate } from '../domain/store'
import type { Draft, EntryType, Person, Vehicle } from '../domain/types'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Actions, FieldError, Icon, Missing, Screen, Section, notifyError } from '../components/UI'
import { PlatePicker } from '../components/PlatePicker'
import { VisitSummary } from '../components/VisitSummary'

type Editor = { id: string; name: string; phone: string; company: string; trade: string; plate: string }

export function RegistrationPage() {
  const { type: param } = useParams()
  const type = param as EntryType
  const { store, state } = useVisitSafe()
  const navigate = useNavigate()
  const [draft, setDraft] = useState(() => state.drafts[type] || newDraft(type))
  const [step, setStep] = useState(0)
  const [agreement, setAgreement] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [editor, setEditor] = useState<Editor | null>(null)
  const [editorError, setEditorError] = useState('')
  const [plateEditor, setPlateEditor] = useState<{ id: string; value: string; roster: boolean } | null>(null)
  const [dateOpen, setDateOpen] = useState(false)
  const [picker, setPicker] = useState<'timeSlot' | 'visitReason' | null>(null)
  if (!ENTRIES[type]) return <Missing title="登记类型不存在" />
  const entry = ENTRIES[type]
  const subjects = trainingSubjects(draft)
  const courseIds = draft.areaIds.length ? matchCourses(type, draft.areaIds) : []
  function save(next: Draft) {
    setDraft(next)
    try { store.saveDraft(next) } catch (error) { notifyError(error) }
  }
  function change(field: keyof Draft, value: string) { save({ ...draft, [field]: value }); setErrors(previous => ({ ...previous, [field]: '' })) }
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
      next = { ...draft, vehicles: [...draft.vehicles.filter(item => item.id !== editor.id), vehicle] }
    } else {
      const person = { id: editor.id, name: editor.name, phone: editor.phone, company: type === 'contractor' ? draft.contractorCompany : editor.company, trade: editor.trade }
      next = { ...draft, people: [...draft.people.filter(item => item.id !== editor.id), person] }
    }
    const error = registrationErrors(next)[type === 'logistics' ? 'vehicles' : 'people']
    if (error) { setEditorError(error); return }
    save(next); setEditor(null)
  }
  async function remove(id: string, kind: 'people' | 'vehicles' | 'accompanyingVehicles') {
    if (await Dialog.confirm({ title: '删除这条登记信息？', content: '删除后可重新添加。', confirmText: '确认删除', cancelText: '保留' })) save({ ...draft, [kind]: draft[kind].filter(item => item.id !== id) })
  }
  function demo() {
    save({ ...draft, appointmentDate: today(), timeSlot: TIME_SLOTS[0], hostName: '陈经理', visitReason: '会议', projectName: '设备检修', workArea: '一号车间', contractorCompany: '安全建设', supervisor: '刘工', people: type === 'logistics' ? [] : [{ id: makeId(), name: '张三', phone: '13800138001', company: type === 'contractor' ? '安全建设' : '示例公司', trade: '电工' }, { id: makeId(), name: '李四', phone: '13800138002', company: type === 'contractor' ? '安全建设' : '示例公司', trade: '焊工' }], vehicles: type === 'logistics' ? [{ id: makeId(), plate: '粤A12345', driver: '王师傅', phone: '13800138003', company: '示例物流' }, { id: makeId(), plate: '粤B67890', driver: '李师傅', phone: '13800138004', company: '示例物流' }] : [] })
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
  function textField(field: 'hostName' | 'projectName' | 'workArea' | 'contractorCompany' | 'supervisor', label: string) {
    return <label className="field" key={field}><span>{label}<em>*</em></span><Input aria-label={label} value={draft[field]} placeholder={`请输入${label}`} maxLength={60} onChange={value => change(field, value)} /><FieldError message={errors[field]} /></label>
  }
  return <Screen title={`${entry.label}登记`}>
    <div className="registration-steps"><Steps current={step}><Steps.Step title="登记信息" /><Steps.Step title="访问区域" /><Steps.Step title="确认提交" /></Steps></div>
    {step === 0 && <>
      <Section title="预约信息" subtitle="为本次到访安排合适的时间"><div className="card form-card">
        <div className="field"><span>预约日期<em>*</em></span><button type="button" className={`select-field ${draft.appointmentDate ? '' : 'placeholder'}`} aria-label="选择预约日期" onClick={() => setDateOpen(true)}>{draft.appointmentDate || '请选择预约日期'}<Icon name="chevron" size={18} /></button><FieldError message={errors.appointmentDate} /></div>
        <div className="field"><span>到访时段<em>*</em></span><button type="button" className={`select-field ${draft.timeSlot ? '' : 'placeholder'}`} aria-label="选择到访时段" onClick={() => setPicker('timeSlot')}>{draft.timeSlot || '请选择到访时段'}<Icon name="chevron" size={18} /></button><FieldError message={errors.timeSlot} /></div>
      </div></Section>
      {type === 'visitor' && <Section title="到访信息"><div className="card form-card">{textField('hostName', '被访人')}<div className="field"><span>到访事由<em>*</em></span><button type="button" className={`select-field ${draft.visitReason ? '' : 'placeholder'}`} onClick={() => setPicker('visitReason')}>{draft.visitReason || '请选择到访事由'}<Icon name="chevron" size={18} /></button><FieldError message={errors.visitReason} /></div></div></Section>}
      {type === 'contractor' && <Section title="施工信息"><div className="card form-card">{textField('projectName', '项目名称')}{textField('workArea', '施工位置')}{textField('contractorCompany', '施工单位')}{textField('supervisor', '现场负责人')}</div></Section>}
      <Section title={type === 'logistics' ? '车辆与司机' : type === 'contractor' ? '施工人员' : '来访人员'} subtitle="每位人员均需独立完成安全培训">
        {(type === 'logistics' ? draft.vehicles : draft.people).map((item, index) => <div className="card roster-card" key={item.id}><div className="flex gap-3 items-start"><span className="roster-number">{index + 1}</span><div className="flex-1"><strong>{'plate' in item ? item.plate : item.name}</strong><p className="muted small">{'driver' in item ? `${item.driver} · ` : ''}{maskPhone(item.phone)}</p><p className="muted small">{type === 'contractor' ? `${draft.contractorCompany} · ${'trade' in item ? item.trade : ''}` : item.company}</p></div></div><div className="roster-actions"><button type="button" onClick={() => openEditor(item)}>编辑</button><button type="button" className="danger" onClick={() => remove(item.id, type === 'logistics' ? 'vehicles' : 'people')}>删除</button></div></div>)}
        {!(type === 'logistics' ? draft.vehicles : draft.people).length && <div className="roster-empty">尚未添加{type === 'logistics' ? '车辆及司机' : '人员'}</div>}
        <FieldError message={errors[type === 'logistics' ? 'vehicles' : 'people']} />
        <Button block color="primary" fill="outline" onClick={() => openEditor()}>＋ 添加{type === 'logistics' ? '车辆及司机' : '人员'}</Button>
      </Section>
      {type !== 'logistics' && <Section title="随行车辆" subtitle="选填，只需登记车牌"><div className="card">{draft.accompanyingVehicles.map(vehicle => <div className="flex items-center justify-between" key={vehicle.id}><button type="button" className="text-button" onClick={() => setPlateEditor({ id: vehicle.id, value: vehicle.plate, roster: false })}>{vehicle.plate} · 编辑</button><button type="button" className="text-button danger" onClick={() => remove(vehicle.id, 'accompanyingVehicles')}>删除</button></div>)}<FieldError message={errors.accompanyingVehicles} /><Button block fill="none" color="primary" onClick={() => setPlateEditor({ id: makeId(), value: '', roster: false })}>＋ 添加随行车牌</Button></div></Section>}
      <Button className="demo-button" block size="small" fill="none" onClick={demo}>填入预约与两条演示数据</Button>
    </>}
    {step === 1 && <Section title="请选择访问区域" subtitle="可多选，按登记类型与区域匹配必修课程">{AREAS.map(area => <button type="button" key={area.id} aria-label={area.name} aria-pressed={draft.areaIds.includes(area.id)} className={`area-card ${draft.areaIds.includes(area.id) ? 'selected' : ''}`} onClick={() => { save({ ...draft, areaIds: draft.areaIds.includes(area.id) ? draft.areaIds.filter(id => id !== area.id) : [...draft.areaIds, area.id] }); setErrors({}) }}><span className={`entry-icon ${area.color}`}><Icon name={area.icon} size={30} /></span><span className="entry-copy"><strong>{area.name}</strong><span>{area.description}</span><small>{area.caption}</small></span><span className="selection-check">{draft.areaIds.includes(area.id) ? '✓' : ''}</span></button>)}<FieldError message={errors.areaIds} />{courseIds.length > 0 && <div className="info-banner">{subjects.length} 位人员 · 每人 {courseIds.length} 门课程 · 共 {subjects.length * courseIds.length} 项任务</div>}</Section>}
    {step === 2 && <><div className="info-banner"><Icon name="check-green" size={18} />请确认以下信息，提交后生成个人培训任务</div><VisitSummary draft={draft} /><Section title="每人必修课程"><div className="card">{courseIds.map(id => <div className="course-line" key={id}><Icon name="check-green" size={18} />{store.course(id).title}</div>)}<p className="muted small">{subjects.length} 位人员，共 {subjects.length * courseIds.length} 项个人课程任务</p></div></Section></>}
    <Actions><Button className="flex-1" onClick={() => step ? (setStep(step - 1), window.scrollTo(0, 0)) : navigate('/')}>{step ? '上一步' : '返回'}</Button><Button className="flex-[2]" color="primary" onClick={step === 2 ? submit : next}>{step === 2 ? '提交并开始培训' : '下一步'}</Button></Actions>
    <Modal visible={!draft.noticeAccepted} closeOnMaskClick={false} content={<div className="notice-content"><span className="notice-icon"><Icon name="shield" size={38} /></span><h2>{entry.label}须知</h2><p className="muted small">共同守护每一次安全到访</p><div className="notice-copy"><p>1. 请如实填写到访人员及车辆信息。</p><p>2. {entry.notice}</p><p>3. 完成申请区域对应培训并通过考试。</p><p>4. 携带访客凭证，遵守现场安排。</p></div><Checkbox checked={agreement} onChange={setAgreement}>我已阅读并同意以上须知</Checkbox><Button block color="primary" disabled={!agreement} onClick={() => save({ ...draft, noticeAccepted: true })}>确认并继续</Button><Button block fill="none" onClick={() => navigate('/')}>暂不登记</Button></div>} />
    <DatePicker visible={dateOpen} precision="day" min={new Date(`${today()}T00:00:00+08:00`)} max={new Date('2099-12-31T00:00:00+08:00')} value={new Date(`${draft.appointmentDate || today()}T00:00:00+08:00`)} onClose={() => setDateOpen(false)} onConfirm={value => change('appointmentDate', today(value.getTime()))} />
    <Picker visible={!!picker} columns={[(picker === 'timeSlot' ? TIME_SLOTS : VISIT_REASONS).map(value => ({ label: value, value }))]} onClose={() => setPicker(null)} onConfirm={values => { if (picker) change(picker, String(values[0])) }} />
    <Popup visible={!!editor} onMaskClick={() => setEditor(null)} bodyStyle={{ borderRadius: '20px 20px 0 0', maxHeight: '90dvh', overflowY: 'auto' }}><div className="editor-sheet"><div className="sheet-heading"><h2>{type === 'logistics' ? '车辆及司机资料' : '人员资料'}</h2><button type="button" className="icon-button" aria-label="取消编辑" onClick={() => setEditor(null)}><Icon name="close" /></button></div>{editor && <>
      {type === 'logistics' && <div className="field"><span>车牌号<em>*</em></span><button type="button" className="select-field" onClick={() => setPlateEditor({ id: editor.id, value: editor.plate, roster: true })}>{editor.plate || '填写车牌'}<Icon name="chevron" size={18} /></button></div>}
      {(['name', 'phone', ...(type === 'contractor' ? ['trade'] : ['company'])] as const).map(field => { const label = field === 'name' ? (type === 'logistics' ? '司机姓名' : '姓名') : field === 'phone' ? '手机号码' : field === 'trade' ? '工种' : type === 'logistics' ? '运输单位' : '所属单位'; return <label className="field" key={field}><span>{label}<em>*</em></span><Input aria-label={label} value={editor[field as keyof Editor]} type={field === 'phone' ? 'tel' : 'text'} maxLength={field === 'phone' ? 11 : 60} placeholder={`请输入${label}`} onChange={value => setEditor({ ...editor, [field]: value })} /></label> })}
      {type === 'contractor' && <p className="muted small">所属单位：{draft.contractorCompany || '请先填写施工单位'}</p>}<FieldError message={editorError} /><Button block color="primary" onClick={saveEditor}>保存{type === 'logistics' ? '车辆' : '人员'}</Button>
    </>}</div></Popup>
    {plateEditor && <PlatePicker value={plateEditor.value} title={plateEditor.roster ? '填写物流车牌' : '随行车辆车牌'} onClose={() => setPlateEditor(null)} onConfirm={plate => { if (!validPlate(plate)) throw new Error('请填写有效车牌'); if (plateEditor.roster && editor) setEditor({ ...editor, plate }); else { if (draft.accompanyingVehicles.some(vehicle => vehicle.id !== plateEditor.id && vehicle.plate === plate)) throw new Error('随行车牌重复'); save({ ...draft, accompanyingVehicles: [...draft.accompanyingVehicles.filter(vehicle => vehicle.id !== plateEditor.id), { id: plateEditor.id, plate }] }) }; setPlateEditor(null) }} />}
  </Screen>
}
