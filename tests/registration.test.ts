import { strict as assert } from 'node:assert'
import { test } from 'node:test'

test('登记页预约校验、施工单位带入及随行车辆编辑保持草稿与原流程', async t => {
  let definition: any
  const cache = new Map<string, unknown>()
  const runtime = globalThis as any
  runtime.Page = (page: unknown) => { definition = page }
  runtime.wx = {
    getStorageSync: (key: string) => cache.get(key),
    setStorageSync: (key: string, value: unknown) => cache.set(key, structuredClone(value)),
    setNavigationBarTitle() {}, pageScrollTo() {}, showToast() {}, navigateBack() {},
    showModal: (options: any) => options.success({ confirm: true, cancel: false })
  }
  const { store } = await import('../miniprogram/services/store')
  await import('../miniprogram/pages/registration/registration')
  const page = () => ({ ...definition, data: structuredClone(definition.data), setData(patch: Record<string, unknown>) {
    for (const [path, value] of Object.entries(patch)) {
      const keys = path.split('.')
      let target = this.data
      keys.slice(0, -1).forEach(key => { target = target[key] })
      target[keys[keys.length - 1]] = value
    }
  } })
  const event = (dataset: object, value = '') => ({ currentTarget: { dataset }, detail: { value } })
  await t.test('未填写预约和到访信息不能进入区域选择', () => {
    store.saveDraft({ ...store.draft('visitor'), noticeAccepted: true, people: [{ id: 'p1', name: '张三', phone: '13800138000', company: '示例单位', trade: '' }] })
    const visitor = page()
    visitor.onLoad({ type: 'visitor' })
    visitor.onNext()
    assert.equal(visitor.data.step, 1)
    assert.match(visitor.data.infoErrors.appointmentDate, /日期/)
    visitor.onDateChange(event({}, '2030-01-02'))
    visitor.onInfoSelect(event({ field: 'timeSlot' }, '1'))
    visitor.onInfoInput(event({ field: 'hostName' }, '陈经理'))
    visitor.onInfoSelect(event({ field: 'visitReason' }, '2'))
    visitor.onNext()
    assert.equal(visitor.data.step, 2)
    visitor.onPrevious()
    assert.equal(visitor.data.draft.timeSlot, '13:00–17:00')
    assert.equal(visitor.data.draft.visitReason, '洽谈')
    visitor.onAddAccompanyingVehicle()
    const id = visitor.data.draft.accompanyingVehicles[0].id
    visitor.onAccompanyingInput(event({ id }, '粤b·12345'))
    const reopened = page()
    reopened.onLoad({ type: 'visitor' })
    assert.equal(reopened.data.draft.accompanyingVehicles[0].plate, '粤b·12345')
    reopened.onAddAccompanyingVehicle()
    const secondId = reopened.data.draft.accompanyingVehicles[1].id
    reopened.onAccompanyingInput(event({ id: secondId }, '粤B12345'))
    reopened.onNext()
    assert.equal(reopened.data.step, 1)
    assert.match(reopened.data.infoErrors['accompanying-' + secondId], /重复/)
    reopened.onDeleteAccompanyingVehicle(event({ id: secondId }))
    reopened.onNext()
    assert.equal(reopened.data.step, 2)
    assert.equal(reopened.data.infoSections[0].fields[1].value, '13:00–17:00')
  })
  await t.test('项目尚未填完时可先添加人员，施工单位自动带入并随修改更新', () => {
    store.saveDraft(Object.assign(store.draft('contractor'), { noticeAccepted: true, contractorCompany: '示例施工公司' }))
    const contractor = page()
    contractor.onLoad({ type: 'contractor' })
    contractor.onAdd()
    contractor.data.form = { ...contractor.data.form, name: '王五', phone: '13700137000', trade: '电工', company: '' }
    contractor.onSaveEntry()
    assert.equal(contractor.data.editorOpen, false)
    assert.equal(contractor.data.draft.people[0].company, '示例施工公司')
    contractor.onInfoInput(event({ field: 'contractorCompany' }, '更新施工公司'))
    assert.equal(contractor.data.draft.people[0].company, '更新施工公司')
    const reopened = page()
    reopened.onLoad({ type: 'contractor' })
    assert.equal(reopened.data.rows[0].company, '更新施工公司')
  })
})
