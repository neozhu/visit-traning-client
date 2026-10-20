import { expect, test, type Page } from '@playwright/test'

async function seedPassedTraining(page: Page, daysAgo: number) {
  await page.goto('/')
  return page.evaluate(async elapsedDays => {
    const modulePath = '/src/domain/store.ts'
    const { createDemoStore, newDraft, today } = await import(modulePath)
    const completedAt = Date.now() - elapsedDays * 86400000
    const store = createDemoStore({
      read: (key: string) => JSON.parse(localStorage.getItem(key) || 'null') || undefined,
      write: (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value)),
    }, () => completedAt)
    const visit = store.register({ ...newDraft('visitor'), noticeAccepted: true, appointmentDate: today(completedAt), timeSlot: '08:30–12:00', hostName: '陈经理', visitReason: '会议', areaIds: ['office'], people: [{ id: 'previous-person', name: '张三', phone: '13800138001', company: '示例公司' }] })
    const task = store.currentTasks(visit.id)[0]
    const course = store.course(task.courseId)
    course.lessons.forEach((lesson: { id: string }) => store.completeLesson(task.id, lesson.id))
    store.beginExam(task.id)
    course.questions.forEach((question: { id: string }, index: number) => store.answer(task.id, question.id, [0, 1, 2, 0, 1][index]))
    store.submitExam(task.id)
    return task.id as string
  }, daysAgo)
}

async function registerAgain(page: Page) {
  await page.goto('/registration/visitor')
  await page.getByText('我已阅读并同意以上须知').click()
  await page.clock.runFor(3100)
  await page.getByRole('button', { name: '确认并继续', exact: true }).click()
  await page.getByRole('button', { name: '填入预约与两条演示数据' }).click()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: '非生产区', exact: true }).click()
  await page.getByRole('button', { name: '下一步', exact: true }).click()
  await page.getByRole('button', { name: /提交并/ }).click()
  await expect(page.getByText('人员培训进度')).toBeVisible()
}

test('历史通过自动免训，个人进度、凭证、查询和三种手机宽度一致', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-13T09:00:00+08:00') })
  const sourceId = await seedPassedTraining(page, 10)
  await registerAgain(page)
  await expect(page.getByText('1 / 2 人已完成')).toBeVisible()
  await page.getByRole('button', { name: '张三', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByText('有效期内免训', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始学习', exact: true })).toHaveCount(0)
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    const certificateButton = await page.getByRole('button', { name: '查看培训凭证', exact: true }).boundingBox()
    expect(certificateButton!.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: `test-results/training-reuse-${width}.png`, fullPage: true })
  }
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('visitsafe.web.v3')!))
  const reused = data.tasks.find((task: { id: string }) => task.id === sourceId)
  expect(data.visits[0].exemptTaskIds).toContain(sourceId)
  expect(reused.result.passed).toBe(true)
  expect(reused.examHistory).toHaveLength(1)
  await page.getByRole('button', { name: '查看培训凭证', exact: true }).click()
  await expect(page.locator('.certificate')).toContainText('有效期内免训')
  await expect(page.locator('.certificate')).toContainText('2026')
  await expect(page.locator('.score-card')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.certificate')).toContainText('有效期内免训')
  await page.goto(`/learn/${reused.id}?visit=${data.visits[0].id}`)
  await expect(page.locator('.certificate')).toBeVisible()
  await expect(page.locator('video')).toHaveCount(0)
  await page.goto(`/exam/${reused.id}?visit=${data.visits[0].id}`)
  await expect(page.locator('.certificate')).toBeVisible()
  await expect(page.locator('.answer-options')).toHaveCount(0)
  await page.goto('/training')
  await page.getByRole('textbox', { name: '登记姓名' }).fill('张三')
  await page.getByRole('textbox', { name: '手机号码' }).fill('13800138001')
  await page.getByRole('button', { name: '查找培训任务', exact: true }).click()
  await expect(page.getByText('没有找到待完成任务')).toBeVisible()
  await page.getByRole('textbox', { name: '登记姓名' }).fill('李四')
  await page.getByRole('textbox', { name: '手机号码' }).fill('13800138002')
  await page.getByRole('button', { name: '查找培训任务', exact: true }).click()
  await expect(page.locator('.query-result')).toHaveCount(1)
})

test('免训结果到期后显示新的学习轮次，刷新及旧链接不会恢复免训', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-13T09:00:00+08:00') })
  await seedPassedTraining(page, 59)
  await registerAgain(page)
  await page.getByRole('button', { name: '张三', exact: true }).click()
  await expect(page.getByText('有效期内免训', { exact: true })).toBeVisible()
  const tasksUrl = page.url()
  const oldTaskId = await page.evaluate(() => JSON.parse(localStorage.getItem('visitsafe.web.v3')!).visits[0].exemptTaskIds[0])
  await page.clock.fastForward(86400000)
  await expect(page.getByText('需重新学习', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始学习', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('需重新学习', { exact: true })).toBeVisible()
  await expect(page.getByRole('article')).toHaveCount(1)
  const visitId = new URL(tasksUrl).pathname.split('/').at(-1)
  await page.goto(`/learn/${oldTaskId}?visit=${visitId}`)
  await expect(page.getByRole('button', { name: '开始学习', exact: true })).toBeVisible()
  await expect(page.locator('video')).toHaveCount(0)
  await page.getByRole('button', { name: '开始学习', exact: true }).click()
  await expect(page.locator('video')).toBeVisible()
  await expect(page.getByRole('button', { name: '开始考试', exact: true })).toBeDisabled()
})
