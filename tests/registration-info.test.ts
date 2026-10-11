import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createVisitStore } from '../miniprogram/services/visit-store'

function setup(type: 'visitor' | 'contractor' | 'logistics' = 'visitor') {
  const cache = new Map<string, any>()
  const storage = { read: (key: string) => cache.get(key), write: (key: string, value: unknown) => cache.set(key, structuredClone(value)) }
  const clock = () => new Date(2030, 0, 2, 10).getTime()
  const store = createVisitStore(storage, clock)
  const draft = Object.assign(store.draft(type), {
    noticeAccepted: true, areaIds: ['production'], appointmentDate: '2030-01-02', timeSlot: '08:30–12:00',
    hostName: '陈经理', visitReason: '会议', projectName: '设备安装', workArea: '一号车间', contractorCompany: '示例施工公司', supervisor: '王负责人',
    people: type === 'logistics' ? [] : [{ id: 'p1', name: '张三', phone: '13800138000', company: '示例施工公司', trade: type === 'contractor' ? '电工' : '' }],
    vehicles: type !== 'logistics' ? [] : [{ id: 'v1', plate: '粤B12345', driver: '张三', phone: '13800138000', company: '示例物流' }],
    accompanyingVehicles: [] as Array<{ id: string; plate: string }>
  })
  return { store, storage, cache, clock, draft }
}

test('三个登记入口的新申请都必须填写预约日期和时段', () => {
  for (const type of ['visitor', 'contractor', 'logistics'] as const) {
    const { store, draft } = setup(type)
    draft.appointmentDate = ''
    assert.throws(() => store.register(draft), /预约日期/)
    draft.appointmentDate = '2030-01-02'
    draft.timeSlot = ''
    assert.throws(() => store.register(draft), /时段/)
    assert.equal(store.visits().length, 0)
  }
})

test('预约拒绝过去日期、无效日历日期和未提供的时段', () => {
  for (const appointmentDate of ['2030-01-01', '2030-02-30', '2030-13-01', '2030-1-2']) {
    const { store, draft } = setup()
    draft.appointmentDate = appointmentDate
    assert.throws(() => store.register(draft), /日期/)
  }
  const { store, draft } = setup()
  draft.timeSlot = '01:00–17:00'
  assert.throws(() => store.register(draft), /时段/)
  draft.timeSlot = '13:00–17:00'
  assert.equal(store.register(draft).appointmentDate, '2030-01-02')
})

test('访客必须填写被访人并从允许的事由中选择', () => {
  for (const patch of [{ hostName: ' ' }, { visitReason: '' }, { visitReason: '旅游' }]) {
    const { store, draft } = setup()
    Object.assign(draft, patch)
    assert.throws(() => store.register(draft), /被访人|事由/)
  }
  for (const visitReason of ['会议', '面试', '洽谈']) {
    const { store, draft } = setup()
    draft.visitReason = visitReason
    assert.equal(store.register(draft).visitReason, visitReason)
  }
})

test('施工申请必须填写项目、位置、施工单位和现场负责人', () => {
  for (const field of ['projectName', 'workArea', 'contractorCompany', 'supervisor'] as const) {
    const { store, draft } = setup('contractor')
    draft[field] = ' '
    assert.throws(() => store.register(draft), /项目|位置|单位|负责人/)
    assert.equal(store.tasks().length, 0)
  }
})

test('访客和施工的随行车牌归一化并拒绝重复或无效车牌', () => {
  for (const type of ['visitor', 'contractor'] as const) {
    const { store, draft } = setup(type)
    draft.accompanyingVehicles = [{ id: 'a1', plate: '粤b·12345' }, { id: 'a2', plate: '粤B67890' }]
    const visit = store.register(draft)
    assert.deepEqual(visit.accompanyingVehicles?.map(v => v.plate), ['粤B12345', '粤B67890'])
    assert.equal(store.tasks(visit.id).length, type === 'visitor' ? 1 : 2)
    const duplicate = { ...draft, id: 'duplicate', accompanyingVehicles: [{ id: 'a1', plate: '粤b·12345' }, { id: 'a2', plate: '粤B12345' }] }
    assert.throws(() => store.register(duplicate), /重复/)
    assert.throws(() => store.register({ ...draft, id: 'bad', accompanyingVehicles: [{ id: 'a1', plate: '123' }] }), /车牌/)
  }
})

test('施工单位统一带入人员，项目和随行车辆在草稿及历史记录重载后保留', () => {
  const { store, storage, draft } = setup('contractor')
  draft.people[0].company = '旧单位'
  draft.people.push({ ...draft.people[0], id: 'p2', name: '李四', phone: '13900139000' })
  draft.accompanyingVehicles = [{ id: 'a1', plate: '粤B12345' }]
  store.saveDraft(draft)
  assert.equal(createVisitStore(storage).draft('contractor').workArea, '一号车间')
  const visit = store.register(draft)
  assert.deepEqual(visit.people.map(p => p.company), ['示例施工公司', '示例施工公司'])
  const restored = createVisitStore(storage, () => new Date(2031, 0, 1).getTime())
  assert.equal(restored.visit(visit.id)?.projectName, '设备安装')
  assert.equal(restored.visit(visit.id)?.appointmentDate, '2030-01-02')
  assert.equal(restored.tasks(visit.id).length, 4)
  assert.equal(restored.pendingTasks('李四', '13900139000').length, 2)
})

test('缺少新增字段的旧申请保留原登记和学习进度', () => {
  const { store, storage, cache, draft } = setup()
  const visit = store.register(draft)
  const task = store.tasks(visit.id)[0]
  store.markLesson(task.id, 'production-safety')
  const state = cache.get('visitsafe.demo.v1')
  for (const field of ['appointmentDate', 'timeSlot', 'hostName', 'visitReason', 'projectName', 'workArea', 'contractorCompany', 'supervisor', 'accompanyingVehicles']) delete state.visits[0][field]
  const restored = createVisitStore(storage)
  assert.equal(restored.visits().length, 1)
  assert.deepEqual(restored.task(task.id)?.completedLessonIds, ['production-safety'])
})
