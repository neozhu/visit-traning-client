// Real simulator acceptance test. Back up/restore this app's local storage; use only fictitious data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { call, data, tap, input, evaluate, screenshot, jsonFile, project } = require('./ide-client.cjs')
const report = []
let nativeVideos = 0
let fallbackVideos = 0
const readState = () => evaluate("function(){ return { state: wx.getStorageSync('visitsafe.demo.v1') }; }").state
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
  assert.equal(exam.questions.length, 5)
  for (let index = 0; index < 5; index++) {
    tap('.answer-chip[data-index="' + index + '"]')
    const correct = exam.questions[index].correct
    tap('.option[data-index="' + (wrong ? (correct + 1) % 4 : correct) + '"]')
    const answered = data()
    assert.equal(answered.current, Math.min(index + 1, 4))
    assert.equal(answered.questionStates[index].wrong, wrong)
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
  data(1)
  navigateHome()
  call('automation_wx_api', { action: 'mock', method: 'showModal', 'result-file': jsonFile({ confirm: true, cancel: false }) })
  modalMocked = true
  const size = call('automation_element_action', { action: 'size', selector: '.entry' })
  const parent = call('automation_element_action', { action: 'size', selector: '.entry-list' })
  assert.ok(Math.abs(size.width - parent.width) < 2)
  screenshot('home-final')
  record('入口卡片占满容器宽度，首页正常渲染')
  tap('.entry.training')
  tap('.find-training')
  assert.match(data().error, /姓名/)
  input('input[data-field="name"]', '未登记人员')
  input('input[data-field="phone"]', '13800138000')
  tap('.find-training')
  assert.deepEqual(data().matches, [])
  assert.equal(readState().visits.length, 0)
  screenshot('training-lookup-empty')
  record('学习培训空记录、必填校验及无匹配结果正常，不创建登记')
  let failureChecked = false
  for (const type of ['visitor', 'logistics', 'contractor']) {
    navigateHome()
    tap('.entry.' + type)
    let draftId
    const notice = data()
    assert.equal(notice.noticeOpen, true)
    assert.equal(notice.noticeChecked, false)
    call('automation_element_action', { action: 'trigger', selector: 'checkbox-group', type: 'change', 'detail-file': jsonFile({ value: ['accepted'] }) })
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
      input('input[data-field="name"]', '未保存的人员')
      screenshot('person-editor-fixed')
      tap('.close-editor')
      assert.equal(data().editorOpen, false)
      assert.equal(data().rows.length, 2)
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
      tap('.add-entry')
      input('input[data-field="name"]', '王五')
      input('input[data-field="phone"]', '13700137000')
      input('input[data-field="company"]', '示例测试单位')
      tap('.save-entry')
      assert.equal(data().rows.length, 3)
    }
    tap('.next')
    assert.equal(data().step, 2)
    tap('.next')
    assert.match(data().error, /区域/)
    tap('.area-card[data-id="' + (type === 'visitor' ? 'production' : 'office') + '"]')
    if (type === 'visitor') tap('.area-card[data-id="research"]')
    const selected = data().draft.areaIds
    tap('.previous')
    assert.equal(data().rows.length, type === 'visitor' ? 3 : 2)
    tap('.next')
    assert.deepEqual(data().draft.areaIds, selected)
    if (type === 'visitor') screenshot('areas')
    tap('.next')
    draftId = data().draft.id
    tap('.submit-visit')
    const listing = data(0.3)
    assert.ok(listing.total > 0)
    const tasks = readState().tasks.filter(t => t.visitId === draftId)
    assert.equal(tasks.length, type === 'visitor' ? 6 : 4)
    assert.equal(data().subjects.length, type === 'visitor' ? 3 : 2)
    if (type === 'visitor') screenshot('tasks')
    let currentSubject = ''
    for (const task of tasks) {
      if (task.subjectId !== currentSubject) {
        if (!currentSubject) {
          tap('.subject-card[data-id="' + task.subjectId + '"]')
          assert.equal(data().total, 2)
        } else {
          const snapshot = readState()
          const visit = snapshot.visits.find(v => v.id === draftId)
          const subject = type === 'logistics' ? visit.vehicles.find(v => v.id === task.subjectId) : visit.people.find(p => p.id === task.subjectId)
          assert.ok(snapshot.tasks.filter(t => t.visitId === draftId && t.subjectId === currentSubject).every(t => t.lastResult?.passed))
          assert.ok(snapshot.tasks.filter(t => t.visitId === draftId && t.subjectId === task.subjectId).every(t => !t.lastResult && !t.completedLessonIds.length))
          assert.equal(data().visitCompleted, false)
          navigateHome()
          tap('.entry.training')
          input('input[data-field="name"]', type === 'logistics' ? subject.driver : subject.name)
          input('input[data-field="phone"]', '13000000000')
          tap('.find-training')
          assert.equal(data().matches.length, 0)
          input('input[data-field="phone"]', subject.phone)
          tap('.find-training')
          const matched = data()
          assert.equal(matched.matches.length, 1)
          assert.equal(matched.matches[0].visitId, draftId)
          assert.equal(matched.matches[0].subjectId, task.subjectId)
          if (type === 'visitor') screenshot('training-lookup-match')
          tap('.training-match[data-visit-id="' + draftId + '"]')
          assert.equal(data().scopeSubjectId, task.subjectId)
          assert.ok(data().tasks.every(t => t.subjectId === task.subjectId))
          record(type + ': 其他人员通过姓名和手机号查找并继续原任务，进度独立')
        }
        currentSubject = task.subjectId
      }
      tap('.training-card[data-id="' + task.id + '"]')
      let lesson = data()
      assert.equal(lesson.allDone, false)
      assert.ok(lesson.subjectName)
      const disabled = call('automation_element_action', { action: 'property', selector: '.begin-exam', name: 'disabled' })
      assert.ok(disabled === true || disabled === 'true')
      for (let index = 0; index < lesson.lessons.length; index++) {
        if (index !== data().selected) tap('.lesson-row[data-index="' + index + '"]')
        if (type === 'visitor' && !failureChecked && index === 0) {
          call('automation_element_action', { action: 'trigger', selector: '#lesson-video', type: 'error', 'detail-file': jsonFile({ errMsg: 'controlled demo playback failure' }) })
          assert.equal(data(0.2).watched, false)
          assert.ok(data().fallbackRemaining > 0)
          screenshot('video-fallback')
          assert.equal(data(7).watched, true)
          fallbackVideos++
          record('模拟视频加载失败：倒计时结束计入学习进度，未到期不能考试')
          continue
        }
        evaluate("function(){ wx.createVideoContext('lesson-video').play(); return true; }")
        const watched = data(7)
        assert.equal(watched.watched, true, task.planId + ': native video must finish')
        if (watched.videoError) fallbackVideos++; else nativeVideos++
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
        assert.equal(data().current, 1)
        tap('.previous-question')
        assert.equal(data().current, 0)
        assert.equal(data().options[0].selected, true)
        tap('.option[data-index="1"]')
        assert.equal(data().current, 1)
        assert.equal(data().questionStates[0].wrong, true)
        tap('.answer-chip[data-index="0"]')
        assert.match(data().feedback, /错误/)
        tap('.option[data-index="0"]')
        assert.equal(data().questionStates[0].wrong, false)
        record('答题自动跳题、错题提示与返回修改正常')
        const deadline = readState().tasks.find(t => t.id === task.id).attempt.deadlineAt
        call('automation_navigate', { action: 'navigateBack', delta: 1 })
        tap('.training-card[data-id="' + task.id + '"]')
        assert.equal(data().answered, 1)
        assert.equal(readState().tasks.find(t => t.id === task.id).attempt.deadlineAt, deadline)
        screenshot('exam')
        fillExam(true)
        tap('.wrong-review')
        assert.equal(data().wrong.length, 5)
        screenshot('result-failed')
        tap('.retry-exam')
        assert.equal(data().answered, 0)
        record('未答交卷校验、考试离开恢复、失败解析和重考正常')
      }
      fillExam(false)
      if (!failureChecked) screenshot('result-passed')
      tap('.complete-training')
      assert.equal(call('automation_page_action', { action: 'getData', 'wait-for-selector': '.completion-hero' }).data.passed, true)
      if (!failureChecked) screenshot('completion')
      failureChecked = true
      tap('.return-tasks')
    }
    assert.equal(data().completed, 2)
    assert.equal(data().visitCompleted, true)
    assert.ok(readState().tasks.filter(t => t.visitId === draftId).every(t => t.lastResult?.passed))
    navigateHome()
    tap('.entry.training')
    const visit = readState().visits.find(v => v.id === draftId)
    const subject = type === 'logistics' ? visit.vehicles[0] : visit.people[0]
    input('input[data-field="name"]', type === 'logistics' ? subject.driver : subject.name)
    input('input[data-field="phone"]', subject.phone)
    tap('.find-training')
    assert.equal(data().matches.length, 0)
    record(type + ': 全部人员通过后整单完成，已完成人员不再出现在待学习查询中')
    navigateHome()
    call('automation_navigate', { action: 'switchTab', url: '/pages/logs/logs' })
    assert.equal(data().visits.find(v => v.id === draftId).passed, true)
    tap('.record-card[data-id="' + draftId + '"]')
    assert.equal(data().visit.passed, true)
    record(type + ': 须知→多人/多车→区域→逐人视频与考试→结果→完成→本地记录通过')
  }
  call('automation_navigate', { action: 'switchTab', url: '/pages/logs/logs' })
  input('.search-input', '粤B12345')
  assert.equal(data().visits.length, 1)
  tap('.text-button')
  screenshot('records')
  call('simulator_refresh')
  call('automation_navigate', { action: 'switchTab', url: '/pages/logs/logs', wait: 1 })
  assert.equal(data().visitCount, 3)
  assert.equal(data().completeCount, 14)
  record('姓名/车牌搜索、重新编译后的记录与培训进度持久化通过')
  const consoleErrors = call('get_simulator_console', { command: 'grep -i error' })
  fs.writeFileSync(path.join(project, 'doc', 'verification-artifacts', 'console.txt'), JSON.stringify(consoleErrors, null, 2))
  record('完整验收结束，截图已保存')
  record(`视频结果：原生播放 ${nativeVideos} 段，演示倒计时 ${fallbackVideos} 段`)
} finally {
  try {
    if (modalMocked) call('automation_wx_api', { action: 'restore', method: 'showModal' })
  } finally {
    if (backedUp) {
      writeState(original)
      call('simulator_refresh')
      call('automation_navigate', { action: 'switchTab', url: '/pages/index/index', wait: 1 })
    }
  }
  fs.mkdirSync(path.join(project, 'doc', 'verification-artifacts'), { recursive: true })
  fs.writeFileSync(path.join(project, 'doc', 'verification-artifacts', 'smoke-results.txt'), report.join('\n') + '\n')
}
