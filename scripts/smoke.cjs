// Real simulator acceptance test. Back up/restore this app's local storage; use only fictitious data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { call, data, tap, input, evaluate, screenshot, jsonFile, project } = require('./ide-client.cjs')
const report = []
const readState = () => evaluate("function(){ return wx.getStorageSync('visitsafe.demo.v1'); }")
const writeState = state => evaluate("function(value){ wx.setStorageSync('visitsafe.demo.v1', value); return true; }", [state])
const original = readState()
fs.mkdirSync(path.join(project, 'doc', 'verification-artifacts'), { recursive: true })
const backupFile = jsonFile(original)
console.log('Storage backup: ' + backupFile)
let backedUp = true
let modalMocked = false
const record = message => { report.push(message); console.log('PASS: ' + message) }
function navigateHome() {
  call('automation_navigate', { action: 'switchTab', url: '/pages/index/index' })
}
function fillExam(wrong = false) {
  const exam = data()
  assert.equal(exam.valid, true)
  assert.equal(exam.questions.length, 10)
  for (let index = 0; index < 10; index++) {
    tap('.answer-chip[data-index="' + index + '"]')
    const correct = exam.questions[index].correct
    tap('.option[data-index="' + (wrong ? (correct + 1) % 4 : correct) + '"]')
  }
  tap('.submit-exam')
  const result = data(0.5)
  assert.equal(result.result.score, wrong ? 0 : 100)
  assert.equal(result.result.passed, !wrong)
  return result
}
try {
  writeState({ version: 1, drafts: {}, visits: [], tasks: [] })
  call('simulator_refresh')
  call('automation_page_action', { action: 'getData', wait: 1 })
  navigateHome()
  call('automation_wx_api', { action: 'mock', method: 'showModal', 'result-file': jsonFile({ confirm: true, cancel: false }) })
  modalMocked = true
  const size = call('automation_element_action', { action: 'size', selector: '.entry' })
  const parent = call('automation_element_action', { action: 'size', selector: '.entry-list' })
  assert.ok(Math.abs(size.width - parent.width) < 2)
  screenshot('home-final')
  record('入口卡片占满容器宽度，首页正常渲染')
  let failureChecked = false
  for (const type of ['visitor', 'training', 'logistics', 'contractor']) {
    navigateHome()
    tap('.entry.' + type)
    const notice = data()
    assert.equal(notice.noticeOpen, true)
    assert.equal(notice.noticeChecked, false)
    tap('checkbox')
    assert.equal(data(0.2).noticeChecked, true)
    tap('.accept-notice')
    assert.equal(data().noticeOpen, false)
    tap('.next')
    assert.match(data().error, /人员|车辆/)
    tap('.demo-data')
    assert.equal(data().rows.length, 2)
    if (type === 'visitor') {
      const first = data().rows[0].id
      tap('.edit-entry[data-id="' + first + '"]')
      input('input[data-field="name"]', '张三（演示）')
      tap('.save-entry')
      assert.equal(data().rows[0].name, '张三（演示）')
      tap('.add-entry')
      input('input[data-field="name"]', '测试人员')
      input('input[data-field="phone"]', '13700137000')
      input('input[data-field="company"]', '示例测试单位')
      tap('.save-entry')
      assert.equal(data().rows.length, 3)
      const third = data().rows[2].id
      tap('.delete-entry[data-id="' + third + '"]')
      assert.equal(data(0.2).rows.length, 2)
      record('登记人员新增、编辑、确认删除及空列表校验正常')
    }
    tap('.next')
    assert.equal(data().step, 2)
    tap('.next')
    assert.match(data().error, /区域/)
    tap('.area-card[data-id="' + (type === 'visitor' ? 'production' : 'office') + '"]')
    if (type === 'visitor') tap('.area-card[data-id="research"]')
    const selected = data().draft.areaIds
    tap('.previous')
    assert.equal(data().rows.length, 2)
    tap('.next')
    assert.deepEqual(data().draft.areaIds, selected)
    if (type === 'visitor') screenshot('areas')
    tap('.next')
    const draftId = data().draft.id
    tap('.submit-visit')
    const listing = data(0.3)
    assert.ok(listing.total > 0)
    const tasks = readState().tasks.filter(t => t.visitId === draftId)
    assert.equal(tasks.length, type === 'training' ? 1 : 2)
    if (type === 'visitor') screenshot('tasks')
    for (const task of tasks) {
      tap('.training-card[data-id="' + task.id + '"]')
      let lesson = data()
      assert.equal(lesson.allDone, false)
      const disabled = call('automation_element_action', { action: 'property', selector: '.begin-exam', name: 'disabled' })
      assert.equal(disabled.value, true)
      for (let index = 0; index < lesson.lessons.length; index++) {
        if (index !== data().selected) tap('.lesson-row[data-index="' + index + '"]')
        evaluate("function(){ wx.createVideoContext('lesson-video').play(); return true; }")
        const watched = data(7)
        assert.equal(watched.videoError, '')
        assert.equal(watched.watched, true, task.planId + ': native video must finish')
        if (type === 'visitor' && !failureChecked && index === 0) screenshot('learn')
      }
      assert.equal(data().allDone, true)
      tap('.begin-exam')
      const begun = data()
      assert.equal(begun.valid, true)
      if (!failureChecked) {
        tap('.submit-exam')
        assert.match(data().error, /未作答/)
        tap('.option[data-index="0"]')
        const deadline = readState().tasks.find(t => t.id === task.id).attempt.deadlineAt
        call('automation_navigate', { action: 'navigateBack', delta: 1 })
        tap('.training-card[data-id="' + task.id + '"]')
        assert.equal(data().answered, 1)
        assert.equal(readState().tasks.find(t => t.id === task.id).attempt.deadlineAt, deadline)
        screenshot('exam')
        fillExam(true)
        tap('.wrong-review')
        assert.equal(data().wrong.length, 10)
        screenshot('result-failed')
        tap('.retry-exam')
        assert.equal(data().answered, 0)
        record('未答交卷校验、考试离开恢复、失败解析和重考正常')
      }
      fillExam(false)
      if (!failureChecked) screenshot('result-passed')
      tap('.complete-training')
      assert.equal(data().passed, true)
      if (!failureChecked) screenshot('completion')
      failureChecked = true
      tap('.return-tasks')
    }
    assert.equal(data().completed, tasks.length)
    navigateHome()
    call('automation_navigate', { action: 'switchTab', url: '/pages/logs/logs' })
    assert.equal(data().visits.find(v => v.id === draftId).passed, true)
    tap('.record-card[data-id="' + draftId + '"]')
    assert.equal(data().visit.passed, true)
    record(type + ': 须知→多人/多车→区域→本地视频→考试→结果→完成→本地记录通过')
  }
  call('automation_navigate', { action: 'switchTab', url: '/pages/logs/logs' })
  input('.search-input', '粤B12345')
  assert.equal(data().visits.length, 1)
  tap('.text-button')
  screenshot('records')
  call('simulator_refresh')
  call('automation_navigate', { action: 'switchTab', url: '/pages/logs/logs', wait: 1 })
  assert.equal(data().visitCount, 4)
  assert.equal(data().completeCount, 7)
  record('姓名/车牌搜索、重新编译后的记录与培训进度持久化通过')
  const consoleErrors = call('get_simulator_console', { command: 'grep -i error' })
  fs.writeFileSync(path.join(project, 'doc', 'verification-artifacts', 'console.txt'), String(consoleErrors))
  record('完整验收结束，截图已保存')
} finally {
  if (modalMocked) call('automation_wx_api', { action: 'restore', method: 'showModal' })
  if (backedUp) {
    writeState(original)
    call('simulator_refresh')
    call('automation_navigate', { action: 'switchTab', url: '/pages/index/index', wait: 1 })
  }
  fs.mkdirSync(path.join(project, 'doc', 'verification-artifacts'), { recursive: true })
  fs.writeFileSync(path.join(project, 'doc', 'verification-artifacts', 'smoke-results.txt'), report.join('\n') + '\n')
}
