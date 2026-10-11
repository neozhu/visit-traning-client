// Verify the registration extension without repeating unchanged video/exam flows.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { call, data, tap, input, evaluate, screenshot, jsonFile, project } = require('./ide-client.cjs')
const report = []
const readState = () => evaluate("function(){ return { state: wx.getStorageSync('visitsafe.demo.v1') }; }").state
const writeState = state => evaluate("function(value){ wx.setStorageSync('visitsafe.demo.v1', value); return true; }", [state])
const original = readState()
console.log('Storage backup: ' + jsonFile(original))
const record = message => { report.push(message); console.log('PASS: ' + message) }
const ready = selector => call('automation_page_action', { action: 'getData', 'wait-for-selector': selector }).data
const change = (selector, value) => call('automation_element_action', { action: 'trigger', type: 'change', selector, 'wait-for-selector': selector, 'detail-file': jsonFile({ value }) })
const home = () => call('automation_navigate', { action: 'switchTab', url: '/pages/index/index', 'wait-for-selector': '.entry' })
const scrollTo = selector => evaluate("function(selector){ wx.pageScrollTo({ selector: selector, duration: 0 }); return true; }", [selector])
const artifactDir = path.join(project, 'doc', 'verification-artifacts')
fs.mkdirSync(artifactDir, { recursive: true })
let modalMocked = false
try {
  writeState({ version: 1, drafts: {}, visits: [], tasks: [] })
  call('simulator_refresh')
  data(1)
  call('automation_wx_api', { action: 'mock', method: 'showModal', 'result-file': jsonFile({ confirm: true, cancel: false }) })
  modalMocked = true
  for (const type of ['visitor', 'contractor', 'logistics']) {
    home()
    tap('.entry.' + type)
    ready('.accept-notice')
    change('checkbox-group', ['accepted'])
    tap('.accept-notice')
    tap('.next')
    const missing = data()
    assert.equal(missing.step, 1)
    assert.match(missing.infoErrors.appointmentDate, /日期/)
    assert.match(missing.infoErrors.timeSlot, /时段/)
    tap('.demo-data')
    change('picker[mode="date"]', '2030-01-02')
    change('picker[data-field="timeSlot"]', '1')
    if (type === 'visitor') {
      input('input[data-field="hostName"]', '陈经理（演示）')
      change('picker[data-field="visitReason"]', '2')
    }
    if (type === 'contractor') {
      for (const [field, value] of Object.entries({ projectName: '产线设备安装（演示）', workArea: '一号车间设备区', contractorCompany: '示例施工有限公司', supervisor: '王负责人（演示）' })) {
        input('input[data-field="' + field + '"]', value)
      }
      assert.ok(data().draft.people.every(p => p.company === '示例施工有限公司'))
      const personId = data().draft.people[0].id
      tap('.edit-entry[data-id="' + personId + '"]')
      assert.equal(call('automation_element_action', { action: 'text', selector: '.inherited-company' }), '示例施工有限公司')
      tap('.close-editor')
    }
    scrollTo('.registration-intro')
    screenshot('registration-' + type + '-top')
    if (type !== 'logistics') {
      tap('.add-accompanying')
      let vehicles = data().draft.accompanyingVehicles
      input('input[data-id="' + vehicles[0].id + '"]', '粤b·12345')
      tap('.add-accompanying')
      vehicles = data().draft.accompanyingVehicles
      input('input[data-id="' + vehicles[1].id + '"]', '粤B12345')
      tap('.next')
      assert.equal(data().step, 1)
      assert.match(data().infoErrors['accompanying-' + vehicles[1].id], /重复/)
      input('input[data-id="' + vehicles[1].id + '"]', '粤B67890')
      tap('.delete-accompanying[data-id="' + vehicles[1].id + '"]')
      assert.equal(data().draft.accompanyingVehicles.length, 1)
      tap('.add-accompanying')
      vehicles = data().draft.accompanyingVehicles
      input('input[data-id="' + vehicles[1].id + '"]', '粤B67890')
      scrollTo('.accompanying-section')
      screenshot('registration-' + type + '-vehicles')
    }
    const draftId = data().draft.id
    home()
    tap('.entry.' + type)
    const restoredDraft = ready('.form-section')
    assert.equal(restoredDraft.noticeOpen, false)
    assert.equal(restoredDraft.draft.appointmentDate, '2030-01-02')
    assert.equal(restoredDraft.draft.timeSlot, '13:00–17:00')
    if (type !== 'logistics') assert.equal(restoredDraft.draft.accompanyingVehicles.length, 2)
    if (type === 'visitor') assert.equal(restoredDraft.draft.visitReason, '洽谈')
    if (type === 'contractor') assert.equal(restoredDraft.draft.projectName, '产线设备安装（演示）')
    tap('.next')
    assert.equal(data().step, 2)
    tap('.area-card[data-id="production"]')
    tap('.next')
    const review = ready('.info-summary')
    assert.equal(review.step, 3)
    assert.equal(review.infoSections[0].fields[0].value, '2030-01-02')
    assert.equal(review.infoSections[0].fields[1].value, '13:00–17:00')
    screenshot('registration-' + type + '-review')
    tap('.submit-visit')
    const tasks = ready('.subject-card')
    assert.equal(tasks.visitId, draftId)
    const state = readState()
    const visit = state.visits.find(v => v.id === draftId)
    assert.equal(visit.appointmentDate, '2030-01-02')
    assert.equal(visit.timeSlot, '13:00–17:00')
    assert.equal(state.tasks.filter(t => t.visitId === draftId).length, type === 'visitor' ? 2 : 4)
    if (type !== 'logistics') assert.deepEqual(visit.accompanyingVehicles.map(v => v.plate), ['粤B12345', '粤B67890'])
    if (type === 'contractor') assert.equal(visit.supervisor, '王负责人（演示）')
    call('automation_navigate', { action: 'switchTab', url: '/pages/logs/logs' })
    tap('.record-card[data-id="' + draftId + '"]')
    const detail = ready('.detail-task')
    assert.equal(detail.visit.infoSections[0].fields[0].value, '2030-01-02')
    screenshot('registration-' + type + '-record')
    record(type + ': 预约、业务信息、车辆编辑、草稿恢复、确认提交与记录详情通过；个人任务数量正确')
  }
  call('simulator_refresh')
  data(1)
  call('automation_navigate', { action: 'switchTab', url: '/pages/logs/logs' })
  assert.equal(ready('.record-card').visitCount, 3)
  input('.search-input', '粤B12345')
  assert.equal(data().visits.length, 3)
  record('重新编译后保留三类记录，随行车牌与物流车牌均可搜索')
  const errors = call('get_simulator_console', { command: 'grep -i error' })
  fs.writeFileSync(path.join(artifactDir, 'registration-console.txt'), JSON.stringify(errors, null, 2))
} catch (error) {
  report.push('FAIL: ' + error.message)
  try {
    console.log(JSON.stringify(call('automation_runtime_info', { action: 'currentPage' })))
    screenshot('registration-failure')
  } catch (_) {}
  throw error
} finally {
  try {
    if (modalMocked) call('automation_wx_api', { action: 'restore', method: 'showModal' })
  } finally {
    writeState(original)
    call('simulator_refresh')
    data(1)
    home()
    fs.writeFileSync(path.join(artifactDir, 'registration-results.txt'), report.join('\n') + '\n')
  }
}
