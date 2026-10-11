import { strict as assert } from 'node:assert'
import { test } from 'node:test'

test('视频失败倒计时正常结束，逐段完成后可以开始五题考试', async t => {
  let definition: any
  const cache = new Map<string, unknown>()
  let interval: (() => void) | undefined
  let now = 1_800_000_000_000
  let redirect = ''
  const media = new Map<string, ArrayBuffer>([['/assets/videos/safety.mp4', new Uint8Array([1, 2, 3]).buffer], ['/assets/videos/ppe.mp4', new Uint8Array([4, 5]).buffer]])
  const runtime = globalThis as any
  runtime.Page = (page: unknown) => { definition = page }
  runtime.wx = {
    getStorageSync: (key: string) => cache.get(key), setStorageSync: (key: string, value: unknown) => cache.set(key, value),
    env: { USER_DATA_PATH: 'http://usr' },
    getFileSystemManager: () => ({ copyFileSync: (source: string, destination: string) => { media.set(destination, media.get(source)!) } }),
    createVideoContext: () => ({ pause() {}, seek() {} }), showToast() {},
    redirectTo: (value: { url: string }) => { redirect = value.url }
  }
  t.mock.method(Date, 'now', () => now)
  t.mock.method(globalThis, 'setInterval', (callback: () => void) => { interval = callback; return 1 as any })
  t.mock.method(globalThis, 'clearInterval', () => { interval = undefined })
  const { store } = await import('../miniprogram/services/store')
  await import('../miniprogram/pages/learn/learn')
  const draft = store.draft('visitor')
  Object.assign(draft, { appointmentDate: '2030-01-02', timeSlot: '08:30–12:00', hostName: '陈经理', visitReason: '会议' })
  Object.assign(draft, { noticeAccepted: true, areaIds: ['production'], people: [{ id: 'p', name: '张三', phone: '13800138000', company: '示例公司', trade: '' }] })
  const task = store.tasks(store.register(draft).id)[0]
  const page = { ...definition, data: structuredClone(definition.data), setData(patch: object) { Object.assign(this.data, patch) } }
  page.onLoad({ taskId: task.id })
  assert.match(page.data.videoSource, /^http:\/\/usr\/.+\.mp4$/)
  assert.deepEqual(new Uint8Array(media.get(page.data.videoSource)!), new Uint8Array([1, 2, 3]))
  page.onVideoError()
  assert.equal(page.data.fallbackRemaining, 6)
  assert.equal(page.data.watched, false)
  assert.throws(() => store.beginExam(task.id), /视频/)
  now += 2000
  interval!()
  assert.equal(page.data.fallbackRemaining, 4)
  page.onVideoError() // Repeated errors must not restart the deadline.
  assert.equal(page.data.fallbackRemaining, 4)
  page.onHide()
  assert.equal(interval, undefined)
  now += 4000
  page.onShow()
  assert.equal(page.data.watched, true)
  assert.equal(page.data.allDone, false)
  assert.equal(store.task(task.id)?.completedLessonIds.length, 1)
  page.onContinue()
  assert.deepEqual(new Uint8Array(media.get(page.data.videoSource)!), new Uint8Array([4, 5]))
  page.onVideoError()
  assert.equal(page.data.fallbackRemaining, 6)
  now += 6000
  interval!()
  assert.equal(page.data.allDone, true)
  page.onExam()
  assert.ok(store.task(task.id)?.attempt)
  assert.match(redirect, /pages\/exam\/exam/)
  page.onUnload()
  assert.equal(interval, undefined)
})
