import { AREAS, getPlan, matchPlans } from '../../data/catalog'
import { Draft, ENTRY_LABELS, EntryType, Person, Vehicle, makeId, maskPhone, normalizePlate, validateDraft } from '../../models/visit'
import { showError, store } from '../../services/store'

const emptyForm = () => ({ id: '', name: '', phone: '', company: '', trade: '', plate: '', driver: '' })

Page({
  data: {
    type: 'visitor' as EntryType, title: '', step: 1, noticeOpen: false, noticeChecked: false,
    draft: {} as Draft, rows: [] as Array<{ id: string; name: string; phone: string; company: string; extra: string }>,
    areas: AREAS.map(a => ({ ...a, selected: false })), selectedAreas: '', planTitles: [] as string[], taskCount: 0,
    editorOpen: false, editId: '', form: emptyForm(), error: '', submitting: false
  },
  onLoad(query: Record<string, string>) {
    const type: EntryType = Object.prototype.hasOwnProperty.call(ENTRY_LABELS, query.type) ? query.type as EntryType : 'visitor'
    const draft = store.draft(type)
    this.setData({ type, title: `${ENTRY_LABELS[type]}登记`, noticeOpen: !draft.noticeAccepted, noticeChecked: draft.noticeAccepted })
    wx.setNavigationBarTitle({ title: `${ENTRY_LABELS[type]}登记` })
    this.sync(draft)
  },
  sync(draft: Draft) {
    const rows = draft.type === 'logistics'
      ? draft.vehicles.map(v => ({ id: v.id, name: v.plate, phone: maskPhone(v.phone), company: v.company, extra: `司机：${v.driver}` }))
      : draft.people.map(p => ({ id: p.id, name: p.name, phone: maskPhone(p.phone), company: p.company, extra: p.trade ? `工种：${p.trade}` : '' }))
    const planIds = matchPlans(draft.type, draft.areaIds)
    this.setData({ draft, rows, areas: AREAS.map(a => ({ ...a, selected: draft.areaIds.includes(a.id) })),
      selectedAreas: AREAS.filter(a => draft.areaIds.includes(a.id)).map(a => a.name).join('、'),
      planTitles: planIds.map(id => getPlan(id).title), taskCount: planIds.length, error: '' })
  },
  persist(draft: Draft) { store.saveDraft(draft); this.sync(draft) },
  noop() {},
  onNoticeCheck(event: WechatMiniprogram.CustomEvent<{ value: string[] }>) { this.setData({ noticeChecked: event.detail.value.length > 0 }) },
  onAccept() {
    if (!this.data.noticeChecked) return
    try { this.persist({ ...this.data.draft, noticeAccepted: true }); this.setData({ noticeOpen: false }) } catch (error) { showError(error) }
  },
  onCancelNotice() { wx.navigateBack() },
  onAdd() { this.setData({ editorOpen: true, editId: '', form: emptyForm(), error: '' }) },
  onEdit(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id as string
    const entry = this.data.type === 'logistics' ? this.data.draft.vehicles.find(v => v.id === id) : this.data.draft.people.find(p => p.id === id)
    if (entry) this.setData({ editorOpen: true, editId: id, form: { ...emptyForm(), ...entry }, error: '' })
  },
  onCloseEditor() { this.setData({ editorOpen: false, error: '' }) },
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const field = event.currentTarget.dataset.field as string
    this.setData({ [`form.${field}`]: event.detail.value, error: '' })
  },
  onSaveEntry() {
    const form = this.data.form
    const id = this.data.editId || makeId(this.data.type === 'logistics' ? 'vehicle' : 'person')
    const draft: Draft = JSON.parse(JSON.stringify(this.data.draft)) as Draft
    if (this.data.type === 'logistics') {
      const entry: Vehicle = { id, plate: normalizePlate(form.plate), driver: form.driver.trim(), phone: form.phone.trim(), company: form.company.trim() }
      const index = draft.vehicles.findIndex(v => v.id === id)
      if (index < 0) draft.vehicles.push(entry); else draft.vehicles[index] = entry
    } else {
      const entry: Person = { id, name: form.name.trim(), phone: form.phone.trim(), company: form.company.trim(), trade: form.trade.trim() }
      const index = draft.people.findIndex(p => p.id === id)
      if (index < 0) draft.people.push(entry); else draft.people[index] = entry
    }
    const error = validateDraft({ ...draft, areaIds: ['production'] })
    if (error) { this.setData({ error }); return }
    try { this.persist(draft); this.setData({ editorOpen: false }) } catch (issue) { showError(issue) }
  },
  onDelete(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id as string
    wx.showModal({ title: '删除登记项', content: '确定删除此项？其余登记信息会保留。', confirmColor: '#c83d39', success: result => {
      if (!result.confirm) return
      try { this.persist({ ...this.data.draft, people: this.data.draft.people.filter(p => p.id !== id), vehicles: this.data.draft.vehicles.filter(v => v.id !== id) }) } catch (error) { showError(error) }
    } })
  },
  onDemoData() {
    const draft: Draft = { ...this.data.draft,
      people: this.data.type === 'logistics' ? [] : [{ id: makeId('person'), name: '张三', phone: '13800138000', company: '示例制造有限公司', trade: this.data.type === 'contractor' ? '电工' : '' },
        { id: makeId('person'), name: '李四', phone: '13900139000', company: '示例制造有限公司', trade: this.data.type === 'contractor' ? '焊工' : '' }],
      vehicles: this.data.type !== 'logistics' ? [] : [{ id: makeId('vehicle'), plate: '粤B12345', driver: '王师傅', phone: '13800138000', company: '示例物流有限公司' },
        { id: makeId('vehicle'), plate: '粤B67890', driver: '李师傅', phone: '13900139000', company: '示例物流有限公司' }] }
    const apply = () => { try { this.persist(draft) } catch (error) { showError(error) } }
    if (this.data.rows.length) wx.showModal({ title: '填入演示数据', content: '将替换当前草稿的人员和车辆信息，是否继续？', success: r => { if (r.confirm) apply() } })
    else apply()
  },
  onArea(event: WechatMiniprogram.BaseEvent) {
    const id = event.currentTarget.dataset.id as string
    const ids = this.data.draft.areaIds
    try { this.persist({ ...this.data.draft, areaIds: ids.includes(id) ? ids.filter(a => a !== id) : [...ids, id] }) } catch (error) { showError(error) }
  },
  onPrevious() {
    if (this.data.step === 1) wx.navigateBack()
    else this.setData({ step: this.data.step - 1, error: '' })
    wx.pageScrollTo({ scrollTop: 0, duration: 0 })
  },
  onNext() {
    const draft = this.data.draft
    const error = validateDraft(this.data.step === 1 ? { ...draft, areaIds: ['production'] } : draft)
    if (error) { this.setData({ error }); return }
    this.setData({ step: this.data.step + 1, error: '' })
    wx.pageScrollTo({ scrollTop: 0, duration: 0 })
  },
  onSubmit() {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try { const visit = store.register(this.data.draft); wx.redirectTo({ url: `/pages/tasks/tasks?visitId=${visit.id}` }) }
    catch (error) { this.setData({ submitting: false }); showError(error) }
  }
})
