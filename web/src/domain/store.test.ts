import { describe, expect, it, vi } from 'vitest'
import * as domain from './store'
import type { Draft, EntryType } from './types'

const fixture = (type: EntryType = 'visitor'): Draft => ({
  id: 'application-1', type, noticeAccepted: true, appointmentDate: '2026-10-12', timeSlot: '08:30–12:00',
  hostName: '陈经理', visitReason: '会议', projectName: '设备检修', workArea: '一号车间', contractorCompany: '安全建设', supervisor: '刘工',
  people: [{ id: 'person-a', name: '张三', phone: '13800138001', company: '示例公司', trade: '电工' }, { id: 'person-b', name: '李四', phone: '13800138002', company: '示例公司', trade: '电工' }],
  vehicles: [], accompanyingVehicles: [], areaIds: ['production', 'office'],
})

function setup() {
  let value: unknown
  let now = Date.parse('2026-10-12T09:00:00+08:00')
  const storage = { read: () => value, write: (_key: string, next: unknown) => { value = structuredClone(next) } }
  const store = domain.createDemoStore(storage, () => now)
  return { store, storage, advance: (ms: number) => { now += ms } }
}

function passCourse(store: ReturnType<typeof domain.createDemoStore>, taskId: string) {
  const task = store.task(taskId)
  store.course(task.courseId).lessons.forEach(lesson => store.completeLesson(taskId, lesson.id))
  store.beginExam(taskId)
  store.course(task.courseId).questions.forEach((question, index) => store.answer(taskId, question.id, [0, 1, 2, 0, 1][index]))
  store.submitExam(taskId)
}

describe('培训有效期与历史免训', () => {
  it.each([
    { name: '张三', phone: '13800138003', reusable: false },
    { name: '王五', phone: '13800138001', reusable: false },
    { name: ' 张三 ', phone: ' 13800138001 ', reusable: true },
  ])('姓名手机号共同匹配：$name / $phone', ({ name, phone, reusable }) => {
    const { store } = setup()
    store.register(fixture())
    const source = store.snapshot().tasks[0]
    passCourse(store, source.id)
    const visit = store.register({ ...fixture(), id: 'application-2', areaIds: ['production'], people: [{ ...fixture().people[0], id: 'new-person', name, phone }] })
    expect(visit.exemptTaskIds.includes(source.id)).toBe(reusable)
    expect(store.currentTasks(visit.id)[0].id === source.id).toBe(reusable)
  })

  it('每门课程独立有效，新增课程需要学习，课程期限调整不追溯旧结果', () => {
    const { store, advance } = setup()
    store.register(fixture())
    const tasks = store.currentTasks('application-1').filter(task => task.subjectId === 'person-a')
    const office = store.course('office')
    const original = office.trainingValidityDays
    office.trainingValidityDays = 30
    try {
      tasks.forEach(task => passCourse(store, task.id))
      expect(store.task(tasks[0].id).validUntil).toBe(Date.parse('2026-12-11T09:00:00+08:00'))
      expect(store.task(tasks[1].id).validUntil).toBe(Date.parse('2026-11-11T09:00:00+08:00'))
      advance(31 * 86400000)
      const visit = store.register({ ...fixture(), id: 'application-2', appointmentDate: '2026-11-12', areaIds: ['production', 'office', 'research'] })
      expect(visit.exemptTaskIds).toEqual([tasks[0].id])
      expect(store.currentTasks(visit.id).filter(task => task.subjectId === 'person-a').map(task => task.courseId)).toEqual(['production', 'office', 'research'])
      expect(store.task(tasks[1].id).validUntil).toBe(Date.parse('2026-11-11T09:00:00+08:00'))
    } finally { office.trainingValidityDays = original }
  })

  it('有效期截止前一毫秒可免训，截止时刻生成新轮且刷新不重复', () => {
    const { store, advance, storage } = setup()
    store.register(fixture())
    const source = store.snapshot().tasks[0]
    passCourse(store, source.id)
    advance(60 * 86400000 - 1)
    const visit = store.register({ ...fixture(), id: 'application-2', appointmentDate: '2026-12-11' })
    expect(visit.exemptTaskIds).toContain(source.id)
    advance(1)
    store.refresh()
    expect(store.currentTasks(visit.id).find(task => task.subjectId === source.subjectId && task.courseId === source.courseId)?.roundNumber).toBe(2)
    const count = store.snapshot().tasks.length
    store.refresh()
    const restored = domain.createDemoStore(storage, () => Date.parse('2026-12-11T09:00:00+08:00'))
    expect(restored.recovered()).toBe(false)
    expect(restored.snapshot().tasks).toHaveLength(count)
    expect(() => restored.beginExam(source.id)).toThrow('当前')
  })

  it('重训轮次保存失败不改变内存或原通过结果', () => {
    const { store, storage, advance } = setup()
    store.register(fixture())
    passCourse(store, store.snapshot().tasks[0].id)
    const before = structuredClone(store.snapshot())
    storage.write = () => { throw new Error('存储已满') }
    advance(60 * 86400000)
    expect(() => store.refresh()).toThrow('存储已满')
    expect(store.snapshot()).toEqual(before)
  })
})

describe('登记与个人培训', () => {
  it('物流厂内对接人与业务单号必填且不能只填空格', () => {
    const draft = fixture('logistics')
    const expected = { logisticsContact: '请填写厂内对接人', logisticsOrderNumber: '请填写业务单号' }
    expect(domain.registrationErrors(draft)).toMatchObject(expected)
    expect(domain.registrationErrors({ ...draft, logisticsContact: '  ', logisticsOrderNumber: '  ' })).toMatchObject(expected)
    const errors = domain.registrationErrors({ ...draft, logisticsContact: '刘工', logisticsOrderNumber: 'WL-001' })
    expect(errors).not.toHaveProperty('logisticsContact')
    expect(errors).not.toHaveProperty('logisticsOrderNumber')
    expect(domain.registrationErrors(fixture())).not.toHaveProperty('logisticsContact')
    expect(domain.registrationErrors(fixture('contractor'))).not.toHaveProperty('logisticsOrderNumber')
  })
  it('物流入厂事由与货物类型必须选择有效选项', () => {
    const draft = fixture('logistics')
    expect(domain.registrationErrors(draft)).toMatchObject({ logisticsReasons: '请选择入厂事由', cargoType: '请选择货物类型' })
    expect(domain.registrationErrors({ ...draft, logisticsReasons: ['送货', '提货'], cargoType: '设备' })).not.toHaveProperty('logisticsReasons')
    expect(domain.registrationErrors({ ...draft, logisticsReasons: ['未知'], cargoType: '未知' })).toMatchObject({ logisticsReasons: '请选择入厂事由', cargoType: '请选择货物类型' })
  })
  it('普通 HTTP 手机预览也能生成唯一 ID', () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto)
    vi.stubGlobal('crypto', { getRandomValues })
    try {
      const ids = Array.from({ length: 20 }, () => domain.newDraft('visitor').id)
      expect(new Set(ids).size).toBe(20)
      expect(ids.every(id => id.length >= 32)).toBe(true)
    } finally { vi.unstubAllGlobals() }
  })
  it('逐人逐课生成任务，重复提交同一草稿不会增加任务', () => {
    const { store } = setup()
    const visit = store.register(fixture())
    expect(visit.subjects).toHaveLength(2)
    expect(store.snapshot().tasks).toHaveLength(4)
    store.register(fixture())
    expect(store.snapshot().visits).toHaveLength(1)
    expect(store.snapshot().tasks).toHaveLength(4)
  })
  it('校验预约、人员、车牌并保留草稿', () => {
    const { store } = setup()
    const draft = fixture()
    store.saveDraft(draft)
    expect(() => store.register({ ...draft, appointmentDate: '2026-02-30' })).toThrow('日期')
    expect(() => store.register({ ...draft, appointmentDate: '2026-10-11' })).toThrow('日期')
    expect(() => store.register({ ...draft, people: [draft.people[0], { ...draft.people[1], phone: draft.people[0].phone }] })).toThrow('手机号')
    expect(() => store.register({ ...draft, accompanyingVehicles: [{ id: 'c1', plate: '粤A12345' }, { id: 'c2', plate: ' 粤a12345 ' }] })).toThrow('车牌')
    expect(store.snapshot().drafts.visitor!.hostName).toBe('陈经理')
    expect(store.snapshot().visits).toHaveLength(0)
  })
  it('组合匹配物流与施工专属课程，重复区域不会重复生成课程', () => {
    expect(domain.matchCourses('visitor', ['production', 'production'])).toEqual(['production'])
    expect(domain.matchCourses('contractor', ['production', 'office'])).toEqual(['production', 'construction', 'office'])
    expect(domain.matchCourses('logistics', ['production', 'office'])).toEqual(['production', 'traffic', 'office'])
    expect(() => domain.matchCourses('visitor', ['unknown'])).toThrow('区域')
  })
  it('姓名和手机号必须共同匹配，查询不创建任务', () => {
    const { store } = setup()
    store.register(fixture())
    expect(store.pendingTasks('张三', '13800138001')).toHaveLength(2)
    expect(store.pendingTasks('张三', '13800138002')).toHaveLength(0)
    expect(store.pendingTasks(' 李四 ', '13800138002')).toHaveLength(2)
    expect(store.snapshot().tasks).toHaveLength(4)
  })
  it('同一司机驾驶多辆车只生成一组个人任务', () => {
    const { store } = setup()
    const draft = { ...fixture('logistics'), logisticsReasons: ['送货'], cargoType: '设备', logisticsContact: '刘工', logisticsOrderNumber: 'WL-001', people: [], vehicles: [{ id: 'v1', plate: '粤A12345', driver: '张三', phone: '13800138001', company: '示例物流' }, { id: 'v2', plate: '粤B12345', driver: '张三', phone: '13800138001', company: '示例物流' }] }
    expect(store.register(draft).subjects).toHaveLength(1)
    expect(store.snapshot().tasks).toHaveLength(3)
  })
  it('持久化失败不能留下部分登记或任务', () => {
    const store = domain.createDemoStore({ read: () => undefined, write: () => { throw new Error('存储已满') } })
    expect(() => store.register({ ...fixture(), appointmentDate: '2099-10-12' })).toThrow('存储已满')
    expect(store.snapshot().visits).toHaveLength(0)
    expect(store.snapshot().tasks).toHaveLength(0)
  })
})

describe('考试与持久化', () => {
  it('损坏的嵌套缓存安全恢复，并报告恢复状态', () => {
    const { store, storage } = setup()
    store.register(fixture())
    const valid = structuredClone(store.snapshot())
    for (const broken of [
      { ...valid, drafts: { visitor: { id: 'broken', type: 'visitor' } } },
      { ...valid, visits: [{ ...valid.visits[0], subjects: [null] }] },
      { ...valid, tasks: [{ ...valid.tasks[0], attempt: { deadlineAt: 'bad', answers: null } }] },
    ]) {
      storage.write(domain.STORAGE_KEY, broken)
      const restored = domain.createDemoStore(storage)
      expect(restored.snapshot()).toEqual({ version: 3, drafts: {}, visits: [], tasks: [], participants: [], vehicleProfiles: [] })
      expect(restored.recovered()).toBe(true)
    }
  })
  it('旧标签页不能复活已删除申请，也不能覆盖其他标签页的进度', () => {
    const { store, storage } = setup()
    store.register(fixture())
    const other = domain.createDemoStore(storage)
    const task = store.snapshot().tasks[0]
    const lessons = store.course(task.courseId).lessons.map(lesson => lesson.id)
    store.completeLesson(task.id, lessons[0])
    other.completeLesson(task.id, lessons[1])
    expect(other.task(task.id).completedLessons).toEqual(lessons)
    other.deleteVisit('application-1')
    expect(() => store.completeLesson(task.id, lessons[0])).not.toThrow()
    expect(domain.createDemoStore(storage).snapshot().visits).toHaveLength(0)
  })
  it('外部刷新通知订阅者，多标签页提交同一草稿仍只生成一套任务', () => {
    const { store, storage } = setup()
    const other = domain.createDemoStore(storage)
    store.register(fixture())
    other.register(fixture())
    expect(domain.createDemoStore(storage).snapshot().tasks).toHaveLength(4)
    const listener = vi.fn()
    other.subscribe(listener)
    store.deleteVisit('application-1')
    other.refresh()
    expect(other.snapshot().visits).toHaveLength(0)
    expect(listener).toHaveBeenCalledOnce()
    other.refresh()
    expect(listener).toHaveBeenCalledOnce()
  })
  it('学习门槛、最终答案和个人隔离', () => {
    const { store } = setup()
    store.register(fixture())
    const task = store.snapshot().tasks[0]
    expect(() => store.beginExam(task.id)).toThrow('视频')
    store.course(task.courseId).lessons.forEach(lesson => store.completeLesson(task.id, lesson.id))
    store.beginExam(task.id)
    expect(() => store.submitExam(task.id)).toThrow('未作答')
    store.course(task.courseId).questions.forEach((question, index) => store.answer(task.id, question.id, index === 0 ? 1 : question.correctIndexes))
    store.answer(task.id, store.course(task.courseId).questions[0].id, 0)
    expect(store.submitExam(task.id).score).toBe(100)
    expect(store.snapshot().tasks[1].result).toBeUndefined()
    expect(store.pendingTasks('张三', '13800138001')).toHaveLength(1)
    expect(() => store.retake(task.id)).toThrow('通过')
  })
  it('刷新保留答卷截止时间，超时按已答题交卷', () => {
    const { store, storage, advance } = setup()
    store.register(fixture())
    const task = store.snapshot().tasks[0]
    store.course(task.courseId).lessons.forEach(lesson => store.completeLesson(task.id, lesson.id))
    store.beginExam(task.id)
    const deadline = store.task(task.id).attempt!.deadlineAt
    store.answer(task.id, store.course(task.courseId).questions[0].id, 0)
    const restored = domain.createDemoStore(storage, () => deadline + 1)
    expect(restored.task(task.id).attempt!.deadlineAt).toBe(deadline)
    expect(() => restored.answer(task.id, store.course(task.courseId).questions[1].id, 1)).toThrow('结束')
    const result = restored.submitExam(task.id)
    expect(result.score).toBe(20)
    expect(result.timedOut).toBe(true)
    advance(16 * 60 * 1000)
    store.submitExam(task.id)
    store.retake(task.id)
    expect(store.task(task.id).attempt!.answers).toEqual({})
    expect(store.task(task.id).attempt!.deadlineAt).toBeGreaterThan(deadline)
    expect(store.task(task.id).completedLessons).toHaveLength(2)
  })
  it('删除申请仅移除关联，独立任务仍保留视频学习门槛', () => {
    const { store } = setup()
    store.register(fixture())
    const task = store.snapshot().tasks[0]
    store.deleteVisit('application-1')
    expect(store.snapshot().tasks).toHaveLength(4)
    expect(() => store.beginExam(task.id)).toThrow('视频')
  })
})
