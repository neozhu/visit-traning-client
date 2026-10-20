import { expect, test, type Page } from '@playwright/test'

async function seed(page: Page, scenario: 'shared' | 'internal' | 'multiple' | 'expired') {
  await page.goto('/')
  return page.evaluate(async mode => {
    const path = '/src/domain/store.ts'
    const { createDemoStore, newDraft, today } = await import(path)
    const store = createDemoStore({ read: (key: string) => JSON.parse(localStorage.getItem(key) || 'null') || undefined, write: (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value)) }, () => Date.now() - (mode === 'expired' ? 61 * 86400000 : 0))
    const person = { id: 'person', name: '张三', phone: '13800138001', company: '示例公司' }
    const draft = () => ({ ...newDraft('visitor'), noticeAccepted: true, appointmentDate: today(), timeSlot: '08:30–12:00', hostName: '陈经理', visitReason: '会议', areaIds: ['office'], people: [person] })
    if (mode === 'multiple') {
      store.course('office').questions[0].kind = 'multiple'
      store.course('office').questions[0].correctIndexes = [0, 2]
    }
    const task = store.assignTraining(person, ['office'])[0]
    if (mode === 'expired') {
      task.courseSnapshot.lessons.forEach((lesson: { id: string }) => store.completeLesson(task.id, lesson.id))
      store.beginExam(task.id)
      task.courseSnapshot.questions.forEach((question: { id: string; correctIndexes: number[] }) => store.answer(task.id, question.id, question.correctIndexes))
      store.submitExam(task.id)
      return { taskId: task.id, visitId: '' }
    }
    if (mode === 'multiple') {
      task.courseSnapshot.lessons.forEach((lesson: { id: string }) => store.completeLesson(task.id, lesson.id))
      store.beginExam(task.id)
      return { taskId: task.id, visitId: '' }
    }
    const visit = mode === 'internal' ? store.registerInternal(draft()) : store.register(draft())
    if (mode === 'shared') store.register(draft())
    return { taskId: task.id, visitId: visit.id }
  }, scenario)
}

test('跨申请任务去重，独立入口及删除申请后均可继续学习', async ({ page }) => {
  const { visitId } = await seed(page, 'shared')
  await page.goto('/training')
  await page.getByRole('textbox', { name: '登记姓名' }).fill('张三')
  await page.getByRole('textbox', { name: '手机号码' }).fill('13800138001')
  await page.getByRole('button', { name: '查找培训任务', exact: true }).click()
  await expect(page.locator('.query-result')).toHaveCount(1)
  await expect(page.locator('.query-result')).toContainText('关联 2 张申请')
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/shared-training-${width}.png`, fullPage: true })
  }
  await page.locator('.query-result').click()
  await expect(page.locator('video')).toBeVisible()
  await page.locator('.page-header .adm-nav-bar-back').click()
  await expect(page.getByRole('button', { name: '查找培训任务' })).toBeVisible()
  await page.goto(`/records/${visitId}`)
  await page.getByRole('button', { name: '删除申请', exact: true }).click()
  await expect(page.getByText('仅删除本申请，人员、车辆档案和培训考试记录将保留。')).toBeVisible()
  await page.getByRole('button', { name: '确认删除', exact: true }).click()
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('visitsafe.web.v3')!))
  expect(data.tasks).toHaveLength(1)
  expect(data.visits).toHaveLength(1)
})

test('首页不把无继续培训需求的过期历史计入未完成课程', async ({ page }) => {
  await seed(page, 'expired')
  await page.goto('/')
  await expect(page.getByRole('button', { name: '继续学习', exact: true })).toContainText('使用登记时的手机号继续学习')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('visitsafe.web.v3')!).tasks.length)).toBe(1)
})

test('内部申请入口先确认须知快照，独立学习不受限制且重复打开不重置确认', async ({ page }) => {
  await page.clock.install()
  const { taskId, visitId } = await seed(page, 'internal')
  await page.goto(`/learn/${taskId}`)
  await expect(page.locator('video')).toBeVisible()
  await expect(page.getByRole('heading', { name: '普通访客须知', exact: true })).toHaveCount(0)
  await page.goto(`/tasks/${visitId}`)
  await expect(page.getByRole('heading', { name: '普通访客须知', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '确认并继续（3秒）', exact: true })).toBeDisabled()
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 640 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/internal-notice-${width}.png` })
  }
  await page.getByText('我已阅读并同意以上须知').click()
  await page.clock.runFor(3100)
  await page.getByRole('button', { name: '确认并继续', exact: true }).click()
  await expect(page.getByText('人员培训进度')).toBeVisible()
  const first = await page.evaluate(() => JSON.parse(localStorage.getItem('visitsafe.web.v3')!).visits[0].noticeAcceptedAt)
  await page.clock.runFor(5000)
  await page.goto(`/records/${visitId}`)
  await expect(page.getByRole('heading', { name: '普通访客须知', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('visitsafe.web.v3')!).visits[0].noticeAcceptedAt)).toBe(first)
})

test('独立任务多选不自动跳题，完整集合评分并展示真实凭证', async ({ page }) => {
  const { taskId } = await seed(page, 'multiple')
  await page.goto(`/exam/${taskId}`)
  await expect(page.getByText('多选题 · 每题 20 分')).toBeVisible()
  await page.locator('.answer-option').nth(0).click()
  await expect(page.getByText('多选题 · 每题 20 分')).toBeVisible()
  await page.locator('.answer-option').nth(2).click()
  await expect(page.locator('.answer-option.selected')).toHaveCount(2)
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/multiple-choice-${width}.png`, fullPage: true })
  }
  await page.reload()
  await expect(page.locator('.answer-option.selected')).toHaveCount(2)
  await page.getByRole('button', { name: '下一题', exact: true }).click()
  for (const index of [1, 2, 0, 1]) await page.locator('.answer-option').nth(index).click()
  await page.getByRole('button', { name: '提交试卷', exact: true }).click()
  await page.getByRole('button', { name: '确认交卷', exact: true }).click()
  await expect(page.getByText('100', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '查看培训凭证', exact: true }).click()
  await expect(page.locator('.certificate')).toContainText('100 分 · 通过')
  await page.getByRole('button', { name: '返回培训任务', exact: true }).click()
  await expect(page.getByRole('button', { name: '查找培训任务' })).toBeVisible()
})

test('再次登记可带入已有人员资料，本次修改和取消不覆盖档案', async ({ page }) => {
  await page.clock.install()
  await seed(page, 'shared')
  await page.goto('/registration/visitor')
  await page.getByText('我已阅读并同意以上须知').click()
  await page.clock.runFor(3100)
  await page.getByRole('button', { name: '确认并继续', exact: true }).click()
  await page.getByRole('button', { name: '＋ 添加人员', exact: true }).click()
  await page.getByRole('textbox', { name: '姓名', exact: true }).fill('张三')
  await page.getByRole('textbox', { name: '手机号码', exact: true }).fill('13800138001')
  await page.getByRole('button', { name: '带入已有人员资料', exact: true }).click()
  await expect(page.getByRole('textbox', { name: '所属单位', exact: true })).toHaveValue('示例公司')
  await page.getByRole('textbox', { name: '所属单位', exact: true }).fill('本次单位')
  await page.getByRole('button', { name: '保存人员', exact: true }).click()
  await expect(page.locator('.roster-card')).toContainText('本次单位')
  await page.getByRole('button', { name: '编辑张三', exact: true }).click()
  await page.getByRole('textbox', { name: '所属单位', exact: true }).fill('取消的修改')
  await page.getByRole('button', { name: '取消编辑', exact: true }).click()
  await expect(page.locator('.roster-card')).toContainText('本次单位')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('visitsafe.web.v3')!).participants[0].company)).toBe('示例公司')
})
