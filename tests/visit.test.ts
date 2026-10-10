import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { AREAS, getPlan, matchPlans } from '../miniprogram/data/catalog'
import { gradeExam, validateDraft } from '../miniprogram/models/visit'
import { createVisitStore, StoragePort } from '../miniprogram/services/visit-store'

function setup() {
  const data = new Map<string, unknown>()
  const storage: StoragePort = {
    read: key => data.get(key),
    write: (key, value) => data.set(key, JSON.parse(JSON.stringify(value)))
  }
  let now = 1_800_000_000_000
  const store = createVisitStore(storage, () => now)
  const draft = store.draft('visitor')
  draft.noticeAccepted = true
  draft.people = [{ id: 'person-1', name: '张三', phone: '13800138000', company: '示例制造有限公司', trade: '' }]
  draft.areaIds = ['production']
  return { store, storage, data, draft, advance: (ms: number) => { now += ms } }
}

test('区域匹配去重，施工/物流增加专属课程', () => {
  assert.deepEqual(matchPlans('visitor', ['production', 'production', 'research']), ['production', 'research'])
  assert.deepEqual(matchPlans('logistics', ['production']), ['production', 'traffic'])
  assert.deepEqual(matchPlans('contractor', ['office']), ['office', 'construction'])
  assert.equal(AREAS.length, 3)
})

test('四种入口都能生成登记与培训任务', () => {
  for (const type of ['training', 'visitor', 'logistics', 'contractor'] as const) {
    const { store, draft } = setup()
    draft.type = type
    draft.people[0].trade = '电工'
    draft.vehicles = [{ id: 'vehicle-1', plate: '粤B12345', driver: '王师傅', phone: '13900139000', company: '示例物流有限公司' }]
    const visit = store.register(draft)
    const tasks = store.tasks(visit.id)
    assert.equal(visit.type, type)
    assert.ok(tasks.length > 0)
    assert.equal(tasks[0].visitId, visit.id)
  }
})

test('未确认须知、无人员、无区域不能提交', () => {
  const { draft } = setup()
  draft.noticeAccepted = false
  assert.match(validateDraft(draft), /须知/)
  draft.noticeAccepted = true
  draft.people = []
  assert.match(validateDraft(draft), /人员/)
  draft.people = [{ id: 'p', name: '张三', phone: '13800138000', company: '示例公司', trade: '' }]
  draft.areaIds = []
  assert.match(validateDraft(draft), /区域/)
})

test('拒绝无效手机、重复人员、缺少工种和非法车牌', () => {
  const { draft } = setup()
  draft.people[0].phone = '123'
  assert.match(validateDraft(draft), /手机/)
  draft.people[0].phone = '13800138000'
  draft.people.push({ ...draft.people[0], id: 'p2' })
  assert.match(validateDraft(draft), /重复/)
  draft.people.pop()
  draft.type = 'contractor'
  assert.match(validateDraft(draft), /工种/)
  draft.type = 'logistics'
  draft.vehicles = [{ id: 'v', plate: '123', driver: '王师傅', phone: '13900139000', company: '示例物流' }]
  assert.match(validateDraft(draft), /车牌/)
})

test('物流空车辆、重复车牌与无效访问区域不能提交', () => {
  const { draft } = setup()
  draft.type = 'logistics'
  assert.match(validateDraft(draft), /车辆/)
  draft.vehicles = [{ id: 'v', plate: '粤B12345', driver: '王师傅', phone: '13900139000', company: '示例物流' }]
  draft.vehicles.push({ ...draft.vehicles[0], id: 'v2' })
  assert.match(validateDraft(draft), /重复/)
  draft.vehicles.pop()
  draft.areaIds = ['unknown']
  assert.match(validateDraft(draft), /区域/)
})

test('草稿编辑和删除人员后重建store仍保留最新数据', () => {
  const { store, storage, draft } = setup()
  draft.people.push({ ...draft.people[0], id: 'p2', phone: '13900139000' })
  draft.people.splice(0, 1)
  draft.people[0].name = '李四'
  store.saveDraft(draft)
  assert.equal(createVisitStore(storage).draft('visitor').people[0].name, '李四')
  assert.equal(createVisitStore(storage).draft('visitor').people.length, 1)
})

test('重复提交同一草稿不会产生重复记录或任务', () => {
  const { store, draft } = setup()
  const first = store.register(draft)
  const second = store.register(draft)
  assert.equal(first.id, second.id)
  assert.equal(store.visits().length, 1)
  assert.equal(store.tasks(first.id).length, 1)
})

test('多人申请单中每门课程只生成一个任务', () => {
  const { store, draft } = setup()
  draft.areaIds = ['production', 'research']
  draft.people.push({ ...draft.people[0], id: 'p2', name: '李四', phone: '13900139000' })
  const visit = store.register(draft)
  assert.equal(store.tasks(visit.id).length, 2)
})

test('多车辆申请单共享区域与物流课程，记录不保留无关人员', () => {
  const { store, draft } = setup()
  draft.type = 'logistics'
  draft.vehicles = [
    { id: 'v1', plate: '粤B12345', driver: '王师傅', phone: '13800138000', company: '示例物流' },
    { id: 'v2', plate: '粤B67890', driver: '李师傅', phone: '13900139000', company: '示例物流' }
  ]
  const visit = store.register(draft)
  assert.equal(store.tasks(visit.id).length, 2)
  assert.deepEqual(visit.people, [])
})

test('非物流登记不存储隐藏车辆，旧版重复培训合并并保留已通过结果', () => {
  const { store, storage, data, draft } = setup()
  draft.vehicles = [{ id: 'v1', plate: '粤B12345', driver: '王师傅', phone: '13800138000', company: '示例物流' }]
  const visit = store.register(draft)
  assert.deepEqual(visit.vehicles, [])
  const task = store.tasks(visit.id)[0]
  const plan = getPlan(task.planId)
  const answers = Object.fromEntries(plan.questions.map(q => [q.id, q.correct]))
  const cache = data.get('visitsafe.demo.v1') as { tasks: unknown[] }
  cache.tasks.push({ ...task, id: 'legacy-passed', subjectId: 'p2', completedLessonIds: plan.lessons.map(l => l.id),
    lastResult: { ...gradeExam(plan.questions, answers), submittedAt: task.createdAt }, completedAt: task.createdAt })
  const restored = createVisitStore(storage)
  assert.equal(restored.tasks(visit.id).length, 1)
  assert.equal(restored.visitStatus(visit.id), 'completed')
  assert.equal(restored.tasks(visit.id)[0].lastResult?.score, 100)
})

test('损坏草稿、未知课程、无效答案被丢弃，其余申请单可正常读取', () => {
  const { store, storage, data, draft } = setup()
  const visit = store.register(draft)
  const task = store.tasks(visit.id)[0]
  const cache = data.get('visitsafe.demo.v1') as { drafts: object; tasks: unknown[] }
  cache.drafts = { visitor: {} }
  cache.tasks.push({ ...task, id: 'unknown-plan', planId: 'unknown' })
  cache.tasks.push({ ...task, id: 'invalid-answer', attempt: { startedAt: task.createdAt, deadlineAt: task.createdAt + 900000, answers: { 'bad-question': 99 } } })
  const restored = createVisitStore(storage)
  assert.equal(restored.visits().length, 1)
  assert.deepEqual(restored.draft('visitor').people, [])
  assert.equal(restored.tasks().length, 1)
})

test('视频未完成时不能考试，非法课程不能计入学习进度', () => {
  const { store, draft } = setup()
  const task = store.tasks(store.register(draft).id)[0]
  assert.throws(() => store.beginExam(task.id), /视频/)
  assert.throws(() => store.markLesson(task.id, 'unknown'), /视频/)
  const plan = getPlan(task.planId)
  store.markLesson(task.id, plan.lessons[0].id)
  assert.throws(() => store.beginExam(task.id), /视频/)
  store.markLesson(task.id, plan.lessons[1].id)
  store.beginExam(task.id)
  assert.ok(store.task(task.id)?.attempt)
})

test('10题按真实答案评分，80分通过，未答不能计分', () => {
  const questions = getPlan('production').questions
  const answers: Record<string, number> = {}
  questions.slice(0, 8).forEach(q => { answers[q.id] = q.correct })
  const result = gradeExam(questions, answers)
  assert.equal(result.score, 80)
  assert.equal(result.passed, true)
  assert.equal(result.wrongIds.length, 2)
  assert.equal(gradeExam(questions, {}).score, 0)
  answers[questions[0].id] = -1
  assert.equal(gradeExam(questions, answers).score, 70)
})

test('考试答案和倒计时截止时间在重载后保留', () => {
  const { store, draft, storage } = setup()
  const task = store.tasks(store.register(draft).id)[0]
  const plan = getPlan(task.planId)
  plan.lessons.forEach(l => store.markLesson(task.id, l.id))
  store.beginExam(task.id)
  store.answer(task.id, plan.questions[0].id, 0)
  const restored = createVisitStore(storage).task(task.id)!
  assert.equal(restored.attempt?.answers[plan.questions[0].id], 0)
  assert.equal(restored.attempt?.deadlineAt, task.createdAt + 15 * 60 * 1000)
})

test('失败重考清空答案和时间、保留视频，成功后整条登记完成', () => {
  const { store, draft, advance } = setup()
  const visit = store.register(draft)
  const task = store.tasks(visit.id)[0]
  const plan = getPlan(task.planId)
  plan.lessons.forEach(l => store.markLesson(task.id, l.id))
  store.beginExam(task.id)
  assert.throws(() => store.finishExam(task.id), /未作答/)
  plan.questions.forEach(q => store.answer(task.id, q.id, (q.correct + 1) % 4))
  assert.equal(store.finishExam(task.id).score, 0)
  assert.equal(store.visitStatus(visit.id), 'learning')
  advance(1000)
  store.retake(task.id)
  assert.deepEqual(store.task(task.id)?.attempt?.answers, {})
  assert.equal(store.task(task.id)?.completedLessonIds.length, plan.lessons.length)
  plan.questions.forEach(q => store.answer(task.id, q.id, q.correct))
  assert.equal(store.finishExam(task.id).score, 100)
  assert.equal(store.visitStatus(visit.id), 'completed')
  assert.ok(store.task(task.id)?.completedAt)
})

test('考试到期自动按已有答案评分，不能追加答案或通过重入重置时间', () => {
  const { store, draft, advance } = setup()
  const task = store.tasks(store.register(draft).id)[0]
  const plan = getPlan(task.planId)
  plan.lessons.forEach(l => store.markLesson(task.id, l.id))
  store.beginExam(task.id)
  advance(16 * 60 * 1000)
  assert.throws(() => store.answer(task.id, plan.questions[0].id, 0), /时间/)
  const result = store.finishExam(task.id)
  assert.equal(result.score, 0)
  assert.equal(result.timedOut, true)
})

test('无效问题与越界选项被拒绝', () => {
  const { store, draft } = setup()
  const task = store.tasks(store.register(draft).id)[0]
  const plan = getPlan(task.planId)
  plan.lessons.forEach(l => store.markLesson(task.id, l.id))
  store.beginExam(task.id)
  assert.throws(() => store.answer(task.id, 'unknown', 0), /题目/)
  assert.throws(() => store.answer(task.id, plan.questions[0].id, 4), /选项/)
})

test('删除登记移除关联任务，旧链接不能创建考试', () => {
  const { store, draft, storage } = setup()
  const visit = store.register(draft)
  const taskId = store.tasks(visit.id)[0].id
  store.removeVisit(visit.id)
  const restored = createVisitStore(storage)
  assert.equal(restored.visits().length, 0)
  assert.equal(restored.tasks().length, 0)
  assert.throws(() => restored.beginExam(taskId), /不存在/)
})

test('损坏存储可以恢复为空状态，写失败不得报告登记成功', () => {
  const bad = createVisitStore({ read: () => ({ visits: 'bad' }), write: () => {} })
  assert.deepEqual(bad.visits(), [])
  const { draft } = setup()
  const fail = createVisitStore({ read: () => undefined, write: () => { throw new Error('存储空间不足') } })
  assert.throws(() => fail.register(draft), /存储空间/)
  assert.equal(fail.visits().length, 0)
})
