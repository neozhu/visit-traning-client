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
  it('同一姓名手机号复用同一课程，其他人员和课程仍需学习，重复申请不续期', () => {
    const { store } = setup()
    store.register(fixture())
    const sourceId = store.snapshot().tasks[0].id
    passCourse(store, sourceId)
    store.register({ ...fixture(), id: 'application-2' })
    const reused = store.snapshot().tasks.find(task => task.visitId === 'application-2' && task.subjectId === 'person-a' && task.courseId === 'production')!
    expect(reused).toMatchObject({ reusedFromTaskId: sourceId, completedAt: Date.parse('2026-10-12T09:00:00+08:00'), validUntil: Date.parse('2026-12-11T09:00:00+08:00'), completedLessons: [] })
    expect(reused.result).toBeUndefined()
    expect(reused.attempt).toBeUndefined()
    expect(store.pendingTasks('张三', '13800138001').filter(task => task.visitId === 'application-2').map(task => task.courseId)).toEqual(['office'])
    expect(store.pendingTasks('李四', '13800138002').filter(task => task.visitId === 'application-2')).toHaveLength(2)
    store.register({ ...fixture(), id: 'application-3' })
    const again = store.snapshot().tasks.find(task => task.visitId === 'application-3' && task.subjectId === 'person-a' && task.courseId === 'production')!
    expect(again.reusedFromTaskId).toBe(sourceId)
    expect(again.validUntil).toBe(Date.parse('2026-12-11T09:00:00+08:00'))
    expect(() => store.beginExam(reused.id)).toThrow('通过')
    expect(() => store.completeLesson(reused.id, 'production-safety')).toThrow('通过')
  })

  it.each([
    { name: '张三', phone: '13800138003', reusable: false },
    { name: '王五', phone: '13800138001', reusable: false },
    { name: ' 张三 ', phone: ' 13800138001 ', reusable: true },
  ])('姓名手机号共同匹配：$name / $phone', ({ name, phone, reusable }) => {
    const { store } = setup()
    store.register(fixture())
    passCourse(store, store.snapshot().tasks[0].id)
    store.register({ ...fixture(), id: 'application-2', areaIds: ['production'], people: [{ ...fixture().people[0], id: 'new-person', name, phone }] })
    const task = store.snapshot().tasks.find(item => item.visitId === 'application-2')!
    expect(task.reusedFromTaskId !== undefined).toBe(reusable)
  })

  it('每门课程按自己的有效天数判断，新增课程需要学习', () => {
    const { store, advance } = setup()
    const office = store.course('office')
    const original = office.trainingValidityDays
    office.trainingValidityDays = 30
    try {
      store.register(fixture())
      const tasks = store.snapshot().tasks.filter(task => task.subjectId === 'person-a')
      tasks.forEach(task => passCourse(store, task.id))
      expect(store.task(tasks[0].id).validUntil).toBe(Date.parse('2026-12-11T09:00:00+08:00'))
      expect(store.task(tasks[1].id).validUntil).toBe(Date.parse('2026-11-11T09:00:00+08:00'))
      advance(31 * 86400000)
      store.register({ ...fixture(), id: 'application-2', appointmentDate: '2026-11-12', areaIds: ['production', 'office', 'research'] })
      const next = store.snapshot().tasks.filter(task => task.visitId === 'application-2' && task.subjectId === 'person-a')
      expect(next.map(task => task.reusedFromTaskId !== undefined)).toEqual([true, false, false])
    } finally { office.trainingValidityDays = original }
  })

  it('截止时刻前有效，到期后只生成一轮重训并保留真实通过与复用历史', () => {
    const { store, storage, advance } = setup()
    store.register(fixture())
    const sourceId = store.snapshot().tasks[0].id
    passCourse(store, sourceId)
    advance(60 * 86400000 - 1)
    store.register({ ...fixture(), id: 'application-2', appointmentDate: '2026-12-11' })
    const reused = store.snapshot().tasks.find(task => task.visitId === 'application-2' && task.subjectId === 'person-a' && task.courseId === 'production')!
    expect(reused.reusedFromTaskId).toBe(sourceId)
    advance(1)
    store.refresh()
    const rounds = store.snapshot().tasks.filter(task => task.visitId === 'application-2' && task.subjectId === 'person-a' && task.courseId === 'production')
    expect(rounds).toHaveLength(2)
    expect(rounds[1]).toMatchObject({ roundNumber: 2, completedLessons: [] })
    expect(rounds[1].completedAt).toBeUndefined()
    expect(store.task(sourceId).result?.passed).toBe(true)
    expect(store.task(reused.id).reusedFromTaskId).toBe(sourceId)
    expect(store.pendingTasks('张三', '13800138001').some(task => task.id === rounds[1].id)).toBe(true)
    const count = store.snapshot().tasks.length
    store.refresh()
    expect(store.snapshot().tasks).toHaveLength(count)
    const restored = domain.createDemoStore(storage, () => Date.parse('2026-12-11T09:00:00+08:00'))
    expect(restored.recovered()).toBe(false)
    expect(restored.snapshot().tasks).toHaveLength(count)
    expect(() => restored.beginExam(reused.id)).toThrow('当前')
    passCourse(restored, rounds[1].id)
    expect(restored.task(rounds[1].id).validUntil).toBe(Date.parse('2027-02-09T09:00:00+08:00'))
  })

  it('预约日开始前便过期的历史结果不免训', () => {
    const { store } = setup()
    store.register(fixture())
    passCourse(store, store.snapshot().tasks[0].id)
    store.register({ ...fixture(), id: 'application-2', appointmentDate: '2026-12-12' })
    expect(store.snapshot().tasks.filter(task => task.visitId === 'application-2').every(task => task.reusedFromTaskId === undefined)).toBe(true)
  })

  it('课程有效期调整不追溯已有结果，之后实际通过采用新值', () => {
    const { store } = setup()
    store.register(fixture())
    const [source, , other] = store.snapshot().tasks
    passCourse(store, source.id)
    const course = store.course('production')
    const original = course.trainingValidityDays
    course.trainingValidityDays = 30
    try {
      passCourse(store, other.id)
      store.register({ ...fixture(), id: 'application-2' })
      expect(store.task(source.id).validUntil).toBe(Date.parse('2026-12-11T09:00:00+08:00'))
      expect(store.task(other.id).validUntil).toBe(Date.parse('2026-11-11T09:00:00+08:00'))
      expect(store.snapshot().tasks.find(task => task.visitId === 'application-2' && task.subjectId === 'person-a' && task.courseId === 'production')!.validUntil).toBe(Date.parse('2026-12-11T09:00:00+08:00'))
    } finally { course.trainingValidityDays = original }
  })

  it('非法期限或伪造复用来源安全恢复', () => {
    const { store, storage } = setup()
    store.register(fixture())
    passCourse(store, store.snapshot().tasks[0].id)
    store.register({ ...fixture(), id: 'application-2' })
    const valid = structuredClone(store.snapshot())
    const target = valid.tasks.find(task => task.reusedFromTaskId)!
    expect(target).toBeDefined()
    expect(target.validUntil).toBe(Date.parse('2026-12-11T09:00:00+08:00'))
    for (const change of [{ validUntil: 'bad' }, { roundNumber: 0 }, { reusedFromTaskId: 'missing' }, { completedAt: Date.parse('2026-10-11T09:00:00+08:00') }]) {
      const broken = structuredClone(valid)
      Object.assign(broken.tasks.find(task => task.id === target.id)!, change)
      storage.write(domain.STORAGE_KEY, broken)
      expect(domain.createDemoStore(storage).recovered()).toBe(true)
    }
  })

  it('被其他申请复用的来源不能删除，先删关联申请后可删除来源', () => {
    const { store } = setup()
    store.register(fixture())
    passCourse(store, store.snapshot().tasks[0].id)
    store.register({ ...fixture(), id: 'application-2' })
    expect(() => store.deleteVisit('application-1')).toThrow('复用')
    expect(store.snapshot().visits).toHaveLength(2)
    store.deleteVisit('application-2')
    store.deleteVisit('application-1')
    expect(store.snapshot().tasks).toHaveLength(0)
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

  it('多次过期重训的历史复用不会形成无法删除的申请依赖环', () => {
    const { store, advance } = setup()
    const draft = { ...fixture(), areaIds: ['production'], people: [fixture().people[0]] }
    store.register(draft)
    passCourse(store, store.currentTasks('application-1')[0].id)
    store.register({ ...draft, id: 'application-2' })
    advance(60 * 86400000)
    store.refresh()
    passCourse(store, store.currentTasks('application-1')[0].id)
    advance(86400000)
    passCourse(store, store.currentTasks('application-2')[0].id)
    advance(59 * 86400000)
    store.refresh()
    expect(store.currentTasks('application-1')[0].roundNumber).toBe(3)
    expect(store.currentTasks('application-1')[0].reusedFromTaskId).toBeUndefined()
    expect(() => store.deleteVisit('application-2')).not.toThrow()
    expect(() => store.deleteVisit('application-1')).not.toThrow()
    expect(store.snapshot().tasks).toHaveLength(0)
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
      expect(restored.snapshot()).toEqual({ version: 2, drafts: {}, visits: [], tasks: [] })
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
    expect(() => store.completeLesson(task.id, lessons[0])).toThrow('不存在')
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
    store.course(task.courseId).questions.forEach((question, index) => store.answer(task.id, question.id, index === 0 ? 1 : question.correct))
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
  it('删除申请同时移除任务，旧链接不能开始考试', () => {
    const { store } = setup()
    store.register(fixture())
    const task = store.snapshot().tasks[0]
    store.deleteVisit('application-1')
    expect(store.snapshot().tasks).toHaveLength(0)
    expect(() => store.beginExam(task.id)).toThrow('不存在')
  })
})
