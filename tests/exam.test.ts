import { strict as assert } from 'node:assert'
import { test } from 'node:test'

test('选择答案自动进入下一题，错题可返回修改且按最终答案评分', async () => {
  let definition: any
  const cache = new Map<string, unknown>()
  const toasts: string[] = []
  let redirect = ''
  let failWrite = false
  const runtime = globalThis as any
  runtime.Page = (page: unknown) => { definition = page }
  runtime.wx = {
    getStorageSync: (key: string) => cache.get(key), setStorageSync: (key: string, value: unknown) => {
      if (failWrite) throw new Error('存储空间不足')
      cache.set(key, value)
    },
    showToast: (value: { title: string }) => { toasts.push(value.title) },
    showModal: (value: { success: (result: { confirm: boolean }) => void }) => value.success({ confirm: true }),
    redirectTo: (value: { url: string }) => { redirect = value.url }
  }
  const { store } = await import('../miniprogram/services/store')
  await import('../miniprogram/pages/exam/exam')
  const draft = store.draft('training')
  draft.people = [{ id: 'p', name: '张三', phone: '13800138000', company: '示例公司', trade: '' }]
  const task = store.tasks(store.register(draft).id)[0]
  store.markLesson(task.id, 'general-safety')
  const page = { ...definition, data: structuredClone(definition.data), setData(patch: object) { Object.assign(this.data, patch) } }
  const event = (index: number) => ({ currentTarget: { dataset: { index } } })
  page.onLoad({ taskId: task.id })
  page.onChoose(event(1)) // First question: B is wrong.
  assert.equal(page.data.current, 1)
  assert.equal(page.data.answered, 1)
  assert.match(toasts[0], /错误/)
  assert.equal(store.task(task.id)?.attempt?.answers['general-q1'], 1)
  page.onPrevious()
  assert.equal(page.data.current, 0)
  assert.equal(page.data.options[1].selected, true)
  assert.match(page.data.feedback, /错误/)
  assert.equal(page.data.questionStates[0].wrong, true)
  page.onChoose(event(0)) // Change first question to A.
  assert.equal(page.data.current, 1)
  assert.equal(page.data.answered, 1)
  assert.equal(store.task(task.id)?.attempt?.answers['general-q1'], 0)
  assert.equal(page.data.questionStates[0].wrong, false)
  page.onChoose(event(1))
  page.onChoose(event(2))
  page.onChoose(event(0))
  page.onChoose(event(0)) // Last question: A is wrong; do not submit automatically.
  assert.equal(page.data.current, 4)
  assert.equal(page.data.answered, 5)
  assert.ok(store.task(task.id)?.attempt)
  assert.equal(redirect, '')
  page.onJump(event(4))
  page.onChoose(event(1))
  page.onSubmit()
  assert.equal(store.task(task.id)?.lastResult?.score, 100)
  assert.match(redirect, /pages\/result\/result/)

  const secondDraft = store.draft('visitor')
  Object.assign(secondDraft, { noticeAccepted: true, areaIds: ['production'], people: draft.people })
  const personal = store.tasks(store.register(secondDraft).id)[0]
  for (const lesson of ['production-safety', 'production-ppe']) store.markLesson(personal.id, lesson)
  failWrite = true
  const recovery = { ...definition, data: structuredClone(definition.data), setData(patch: object) { Object.assign(this.data, patch) } }
  recovery.onLoad({ taskId: personal.id })
  assert.equal(recovery.data.valid, false)
  assert.match(recovery.data.error, /存储空间不足/)
  runtime.getCurrentPages = () => [{ route: 'pages/exam/exam' }]
  recovery.onTasks()
  assert.equal(redirect, `/pages/tasks/tasks?visitId=${personal.visitId}&subjectId=p`)
  recovery.setData({ taskId: 'deleted-task' })
  recovery.onTasks()
  assert.equal(redirect, '/pages/training/training')
})
