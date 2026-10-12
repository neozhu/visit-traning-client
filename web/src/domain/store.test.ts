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

describe('登记与个人培训', () => {
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
    const draft = { ...fixture('logistics'), people: [], vehicles: [{ id: 'v1', plate: '粤A12345', driver: '张三', phone: '13800138001', company: '示例物流' }, { id: 'v2', plate: '粤B12345', driver: '张三', phone: '13800138001', company: '示例物流' }] }
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
      expect(restored.snapshot()).toEqual({ version: 1, drafts: {}, visits: [], tasks: [] })
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
