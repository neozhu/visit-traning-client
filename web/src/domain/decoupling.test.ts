import { describe, expect, it } from 'vitest'
import { createDemoStore, newDraft, STORAGE_KEY } from './localStore'
import type { Person } from './types'

const person: Person = { id: 'zhang', name: '张三', phone: '13800138001', company: '原单位' }
const now = Date.parse('2026-10-20T09:00:00+08:00')
function setup() {
  let data: unknown
  let time = now
  const storage = { read: () => data, write: (_key: string, value: unknown) => { data = structuredClone(value) } }
  const store = createDemoStore(storage, () => time)
  const draft = () => ({ ...newDraft('visitor'), noticeAccepted: true, appointmentDate: '2026-10-20', timeSlot: '08:30–12:00', hostName: '陈经理', visitReason: '会议', areaIds: ['office'], people: [person] })
  return { store, storage, draft, advance: (ms: number) => { time += ms } }
}
function pass(store: ReturnType<typeof createDemoStore>, id: string) {
  const task = store.task(id)
  task.courseSnapshot.lessons.forEach(lesson => store.completeLesson(id, lesson.id))
  store.beginExam(id)
  task.courseSnapshot.questions.forEach(question => store.answer(id, question.id, question.correctIndexes))
  return store.submitExam(id)
}

describe('独立档案和共享培训', () => {
  it('规范化姓名手机号复用档案，资料修改只保存在本次快照', () => {
    const { store, draft } = setup()
    const first = store.register(draft())
    const second = store.register({ ...draft(), people: [{ ...person, id: 'another', name: ' 张三 ', phone: ' 13800138001 ', company: '新单位' }] })
    expect(store.snapshot().participants).toHaveLength(1)
    expect(second.subjects[0].id).toBe(first.subjects[0].id)
    expect(first.subjects[0].company).toBe('原单位')
    expect(second.subjects[0].company).toBe('新单位')
    expect(store.findParticipant(' 张三 ', '13800138001')?.company).toBe('原单位')
  })

  it('多申请共用未完成任务、视频和考试，查询只展示一份', () => {
    const { store, draft, storage } = setup()
    const first = store.register(draft())
    const task = store.currentTasks(first.id)[0]
    task.courseSnapshot.lessons.forEach(lesson => store.completeLesson(task.id, lesson.id))
    store.beginExam(task.id)
    store.answer(task.id, task.courseSnapshot.questions[0].id, [0])
    const attempt = structuredClone(store.task(task.id).attempt)
    const second = store.register(draft())
    expect(store.currentTasks(second.id)[0].id).toBe(task.id)
    expect(store.pendingTasks(person.name, person.phone)).toHaveLength(1)
    store.beginExam(task.id)
    const restored = createDemoStore(storage, () => now)
    expect(restored.recovered()).toBe(false)
    expect(restored.task(task.id).attempt).toEqual(attempt)
  })

  it('独立分配无需申请，重复分配幂等，通过后直接关联真实记录且不续期', () => {
    const { store, draft } = setup()
    const task = store.assignTraining(person, ['office'])[0]
    expect(store.snapshot().visits).toHaveLength(0)
    expect(store.assignTraining(person, ['office'])[0].id).toBe(task.id)
    expect(store.pendingTasks('张三', person.phone).map(item => item.id)).toEqual([task.id])
    pass(store, task.id)
    const source = structuredClone(store.task(task.id))
    const visit = store.register(draft())
    expect(visit.taskIds).toEqual([task.id])
    expect(visit.exemptTaskIds).toEqual([task.id])
    expect(store.task(task.id)).toEqual(source)
    expect(store.pendingTasks('张三', person.phone)).toHaveLength(0)
  })

  it('删除申请保留独立档案、任务、考试及其他申请关联', () => {
    const { store, draft, storage } = setup()
    const first = store.register(draft())
    const task = store.currentTasks(first.id)[0]
    pass(store, task.id)
    const second = store.register(draft())
    store.deleteVisit(first.id)
    expect(store.currentTasks(second.id)[0].result?.passed).toBe(true)
    store.deleteVisit(second.id)
    const restored = createDemoStore(storage, () => now)
    expect(restored.recovered()).toBe(false)
    expect(restored.snapshot().participants).toHaveLength(1)
    expect(restored.task(task.id).examHistory).toHaveLength(1)
  })

  it('车辆按规范化车牌复用，本次运输单位不更新档案或历史', () => {
    const { store, draft, storage } = setup()
    const logistics = () => ({ ...draft(), type: 'logistics' as const, people: [], logisticsReasons: ['送货'], cargoType: '设备', logisticsContact: '刘工', logisticsOrderNumber: 'WL-001', vehicles: [{ id: 'car', plate: '粤A12345', company: '旧运输', driver: person.name, phone: person.phone }] })
    const first = store.register(logistics())
    const second = store.register({ ...logistics(), vehicles: [{ ...logistics().vehicles[0], plate: ' 粤a·12345 ', company: '新运输' }] })
    expect(store.snapshot().vehicleProfiles).toHaveLength(1)
    expect(second.vehicleSnapshots[0].vehicleId).toBe(first.vehicleSnapshots[0].vehicleId)
    expect(second.vehicleSnapshots[0].company).toBe('新运输')
    expect(first.vehicleSnapshots[0].company).toBe('旧运输')
    expect(store.findVehicle('粤a12345')?.company).toBe('旧运输')
    expect(second.vehicleSnapshots[0].checkedInAt).toBeUndefined()
    store.deleteVisit(first.id)
    expect(createDemoStore(storage, () => now).snapshot().vehicleProfiles).toHaveLength(1)
  })

  it('过期共享任务仅创建一轮，历史不覆盖，新轮需完整学习', () => {
    const { store, draft, advance } = setup()
    const first = store.register(draft())
    const source = store.currentTasks(first.id)[0]
    pass(store, source.id)
    const second = store.register(draft())
    advance(60 * 86400000)
    store.refresh()
    const current = store.currentTasks(first.id)[0]
    expect(current.roundNumber).toBe(2)
    expect(current.completedLessons).toEqual([])
    expect(store.currentTasks(second.id)[0].id).toBe(current.id)
    expect(store.snapshot().tasks).toHaveLength(2)
    expect(store.task(source.id).result?.passed).toBe(true)
    expect(store.pendingTasks(person.name, person.phone).map(item => item.id)).toEqual([current.id])
    expect(() => store.beginExam(source.id)).toThrow()
    store.refresh()
    expect(store.snapshot().tasks).toHaveLength(2)
  })

  it('未来预约不满足免训时创建新轮，不替换其他申请的有效关联也不隐藏待学', () => {
    const { store, draft } = setup()
    const first = store.register(draft())
    const source = store.currentTasks(first.id)[0]
    pass(store, source.id)
    const future = store.register({ ...draft(), appointmentDate: '2027-01-01' })
    const task = store.currentTasks(future.id)[0]
    expect(task.id).not.toBe(source.id)
    expect(task.roundNumber).toBe(2)
    expect(store.currentTasks(first.id)[0].id).toBe(source.id)
    expect(store.pendingTasks(person.name, person.phone).map(item => item.id)).toEqual([task.id])
  })

  it('独立历史过期无需求时不自动建任务，重新分配才创建新轮', () => {
    const { store, advance } = setup()
    const task = store.assignTraining(person, ['office'])[0]
    pass(store, task.id)
    advance(60 * 86400000)
    store.refresh()
    expect(store.snapshot().tasks).toHaveLength(1)
    expect(store.pendingTasks(person.name, person.phone)).toHaveLength(0)
    expect(store.assignTraining(person, ['office'])[0].roundNumber).toBe(2)
  })

  it('打开任务不算学习，首次播放时间和未交卷考试在重复操作后保持不变', () => {
    const { store, advance } = setup()
    const task = store.assignTraining(person, ['office'])[0]
    expect(task.startedAt).toBeUndefined()
    store.startLearning(task.id)
    advance(1000)
    store.startLearning(task.id)
    expect(store.task(task.id).startedAt).toBe(now)
    task.courseSnapshot.lessons.forEach(lesson => store.completeLesson(task.id, lesson.id))
    store.beginExam(task.id)
    const attempt = structuredClone(store.task(task.id).attempt)
    advance(1000)
    store.beginExam(task.id)
    expect(store.task(task.id).attempt).toEqual(attempt)
  })

  it('多选答案去重，空集合不算已答，非法选项拒绝且不覆盖已保存答案', () => {
    const { store } = setup()
    const config = store.course('office')
    const original = structuredClone(config)
    try {
      config.questions[0] = { ...config.questions[0], kind: 'multiple', correctIndexes: [0, 2] }
      const task = store.assignTraining(person, ['office'])[0]
      task.courseSnapshot.lessons.forEach(lesson => store.completeLesson(task.id, lesson.id))
      store.beginExam(task.id)
      const id = task.courseSnapshot.questions[0].id
      store.answer(task.id, id, [2, 0, 2])
      expect(store.task(task.id).attempt!.answers[id]).toEqual([0, 2])
      expect(() => store.answer(task.id, id, [4])).toThrow('选项')
      expect(store.task(task.id).attempt!.answers[id]).toEqual([0, 2])
      store.answer(task.id, id, [])
      expect(store.task(task.id).attempt!.answers[id]).toBeUndefined()
      expect(() => store.submitExam(task.id)).toThrow('未作答')
    } finally { Object.assign(config, original) }
  })

  it('首次分配拒绝无视频或题目配置错误的课程，不留下人员档案', () => {
    const { store } = setup()
    const config = store.course('office')
    const original = structuredClone(config)
    try {
      config.lessons = []
      expect(() => store.assignTraining(person, ['office'])).toThrow('配置无效')
      expect(store.snapshot().participants).toHaveLength(0)
      Object.assign(config, structuredClone(original))
      config.questions[0].correctIndexes = [0, 1]
      expect(() => store.assignTraining(person, ['office'])).toThrow('配置无效')
      expect(store.snapshot().tasks).toHaveLength(0)
    } finally { Object.assign(config, original) }
  })

  it('课程快照保护视频题目和考试规则，重考保留历史及视频', () => {
    const { store, storage } = setup()
    const config = store.course('office')
    const original = structuredClone(config)
    try {
      config.questions[0] = { ...config.questions[0], kind: 'multiple', correctIndexes: [0, 2] }
      config.passScore = 100
      config.examDurationMinutes = 2
      const task = store.assignTraining(person, ['office'])[0]
      config.questions[0].title = '配置改过了'
      task.courseSnapshot.lessons.forEach(lesson => store.completeLesson(task.id, lesson.id))
      store.beginExam(task.id)
      expect(store.task(task.id).attempt!.deadlineAt - now).toBe(120000)
      task.courseSnapshot.questions.forEach(question => store.answer(task.id, question.id, question.correctIndexes))
      store.answer(task.id, task.courseSnapshot.questions[0].id, [0])
      expect(store.submitExam(task.id).score).toBe(80)
      expect(store.task(task.id).result?.passed).toBe(false)
      store.retake(task.id)
      task.courseSnapshot.questions.forEach(question => store.answer(task.id, question.id, [...question.correctIndexes].reverse()))
      expect(store.submitExam(task.id).score).toBe(100)
      const restored = createDemoStore(storage, () => now)
      expect(restored.recovered()).toBe(false)
      expect(restored.task(task.id).examHistory.map(exam => exam.result.score)).toEqual([80, 100])
      expect(restored.task(task.id).courseSnapshot.questions[0].title).not.toBe('配置改过了')
    } finally { Object.assign(config, original) }
  })

  it('内部申请须知使用快照且只记录首次确认，独立学习不受限制', () => {
    const { store, draft, advance, storage } = setup()
    const visit = store.registerInternal({ ...draft(), noticeAccepted: false })
    expect(visit.noticeAcceptedAt).toBeUndefined()
    expect(visit.noticeSnapshot.title).toContain('普通访客')
    expect(store.pendingTasks(person.name, person.phone)).toHaveLength(1)
    store.acceptNotice(visit.id)
    advance(10000)
    store.acceptNotice(visit.id)
    const restored = createDemoStore(storage, () => now + 10000)
    expect(restored.recovered()).toBe(false)
    expect(restored.snapshot().visits[0].noticeAcceptedAt).toBe(now)
  })

  it('存储失败不发布档案、分配、申请或确认的部分数据', () => {
    const { store, storage, draft } = setup()
    const visit = store.registerInternal(draft())
    const before = structuredClone(store.snapshot())
    storage.write = () => { throw new Error('存储已满') }
    expect(() => store.assignTraining({ ...person, name: '李四' }, ['production'])).toThrow('存储已满')
    expect(() => store.acceptNotice(visit.id)).toThrow('存储已满')
    expect(() => store.register(draft())).toThrow('存储已满')
    expect(store.snapshot()).toEqual(before)
  })

  it('拒绝缺失关联、重复档案和伪造通过的缓存', () => {
    const { store, storage, draft } = setup()
    store.register(draft())
    const valid = structuredClone(store.snapshot())
    const cases = [
      { ...valid, participants: [] },
      { ...valid, participants: [...valid.participants, { ...valid.participants[0], id: 'duplicate' }] },
      { ...valid, visits: [{ ...valid.visits[0], taskIds: [] }] },
      { ...valid, tasks: [{ ...valid.tasks[0], completedAt: now, validUntil: now + 86400000 }] },
    ]
    cases.forEach(broken => {
      storage.write(STORAGE_KEY, broken)
      expect(createDemoStore(storage, () => now).recovered()).toBe(true)
    })
  })
})
