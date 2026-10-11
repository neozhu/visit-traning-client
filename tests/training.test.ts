import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { getPlan } from '../miniprogram/data/catalog'

test('学习入口查询已有申请单，人员筛选和返回刷新保持个人进度', async () => {
  let definition: any
  let navigation = ''
  const cache = new Map<string, unknown>()
  const runtime = globalThis as any
  runtime.Page = (page: unknown) => { definition = page }
  runtime.wx = {
    getStorageSync: (key: string) => cache.get(key),
    setStorageSync: (key: string, value: unknown) => cache.set(key, structuredClone(value)),
    navigateTo: (value: { url: string }) => { navigation = value.url },
    redirectTo: (value: { url: string }) => { navigation = value.url },
    showToast() {}
  }
  const page = () => ({ ...definition, data: structuredClone(definition.data),
    setData(patch: object) { Object.assign(this.data, patch) } })
  const event = (dataset: object) => ({ currentTarget: { dataset } })
  const { store } = await import('../miniprogram/services/store')
  await import('../miniprogram/pages/index/index')
  const home = page()
  home.onEntry(event({ type: 'training' }))
  assert.equal(navigation, '/pages/training/training')
  home.onEntry(event({ type: 'visitor' }))
  assert.equal(navigation, '/pages/registration/registration?type=visitor')

  const draft = store.draft('visitor')
  Object.assign(draft, { appointmentDate: '2030-01-02', timeSlot: '08:30–12:00', hostName: '陈经理', visitReason: '会议' })
  Object.assign(draft, { noticeAccepted: true, areaIds: ['production', 'research'], people: [
    { id: 'p1', name: '张三', phone: '13800138000', company: '示例公司', trade: '' },
    { id: 'p2', name: '李四', phone: '13900139000', company: '示例公司', trade: '' },
    { id: 'p3', name: '王五', phone: '13700137000', company: '示例公司', trade: '' }
  ] })
  const visit = store.register(draft)
  const second = store.register({ ...draft, id: 'second', areaIds: ['office'], people: [draft.people[1]] })
  await import('../miniprogram/pages/training/training')
  const lookup = page()
  lookup.onFind()
  assert.match(lookup.data.error, /姓名/)
  const input = (field: string, value: string) => lookup.onInput({ ...event({ field }), detail: { value } })
  input('name', '李四')
  input('phone', '13800138000')
  lookup.onFind()
  assert.equal(lookup.data.matches.length, 0)
  input('phone', '13900139000')
  lookup.onFind()
  assert.deepEqual(lookup.data.matches.map((m: any) => m.visitId), [second.id, visit.id])
  assert.equal(store.visits().length, 2)
  lookup.onMatch(event({ visitId: visit.id, subjectId: 'p2' }))
  assert.equal(navigation, `/pages/tasks/tasks?visitId=${visit.id}&subjectId=p2`)

  await import('../miniprogram/pages/tasks/tasks')
  const tasks = page()
  tasks.onLoad({ visitId: visit.id })
  tasks.onShow()
  assert.equal(tasks.data.subjects.length, 3)
  assert.equal(tasks.data.total, 6)
  assert.equal(tasks.data.completedSubjects, 0)
  tasks.onSubject(event({ id: 'p2' }))
  assert.equal(tasks.data.total, 2)
  assert.ok(tasks.data.tasks.every((t: any) => t.subjectId === 'p2' && t.subjectName === '李四'))
  const firstId = tasks.data.tasks[0].id
  tasks.onStart()
  assert.equal(navigation, `/pages/learn/learn?taskId=${firstId}`)
  for (const task of store.tasks(visit.id, 'p2')) {
    const plan = getPlan(task.planId)
    plan.lessons.forEach(l => store.markLesson(task.id, l.id))
    store.beginExam(task.id)
    plan.questions.forEach(q => store.answer(task.id, q.id, q.correct))
    store.finishExam(task.id)
  }
  tasks.onShow()
  assert.equal(tasks.data.subjectId, 'p2')
  assert.equal(tasks.data.completed, 2)
  assert.equal(tasks.data.completedSubjects, 1)
  assert.equal(tasks.data.nextId, '')
  assert.equal(store.visitStatus(visit.id), 'learning')
  assert.ok(store.tasks(visit.id, 'p3').every(t => !t.completedLessonIds.length && !t.lastResult))
  lookup.onShow()
  assert.deepEqual(lookup.data.matches.map((m: any) => m.visitId), [second.id])
  tasks.onSubject(event({ id: '' }))
  assert.equal(tasks.data.total, 6)
  assert.equal(tasks.data.completed, 2)
  tasks.onSubject(event({ id: 'p3' }))
  assert.equal(tasks.data.tasks[0].subjectName, '王五')

  const scoped = page()
  scoped.onLoad({ visitId: visit.id, subjectId: 'p2' })
  scoped.onShow()
  assert.equal(scoped.data.subjects.length, 1)
  scoped.onSubject(event({ id: 'p1' }))
  assert.equal(scoped.data.subjectId, 'p2')
  const invalid = page()
  invalid.onLoad({ visitId: visit.id, subjectId: 'missing' })
  invalid.onShow()
  assert.equal(invalid.data.total, 0)
  assert.equal(invalid.data.missing, true)
})
