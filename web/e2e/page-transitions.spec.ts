import { expect, test, type Page } from '@playwright/test'

async function observeTransitions(page: Page) {
  await page.addInitScript(() => {
    const observed: { name: string; duration: number }[][] = []
    Object.defineProperty(window, 'observedPageAnimations', { value: observed })
    const start = document.startViewTransition.bind(document)
    document.startViewTransition = options => {
      const transition = start(options)
      void transition.ready.then(() => {
        observed.push(document.getAnimations().filter(animation => animation instanceof CSSAnimation).map(animation => ({
          name: (animation as CSSAnimation).animationName,
          duration: Number(animation.effect?.getTiming().duration),
        })))
      }).catch(() => {})
      return transition
    }
  })
}

test('页面导航与浏览器返回播放短淡入淡出，手机布局保持正常', async ({ page }) => {
  await observeTransitions(page)
  await page.goto('/')
  await page.getByText('我的', { exact: true }).click()
  await expect(page.getByText('还没有来访记录', { exact: true })).toBeVisible()
  const animations = () => page.evaluate(() => (window as unknown as { observedPageAnimations: { name: string; duration: number }[][] }).observedPageAnimations.flat())
  await expect.poll(animations).toEqual(expect.arrayContaining([
    { name: 'page-fade-in', duration: 180 },
    { name: 'page-fade-out', duration: 180 },
  ]))
  await page.evaluate(async () => { await Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => {}))) })
  await page.goBack()
  await expect(page.getByRole('button', { name: '普通访客', exact: true })).toBeVisible()
  await expect.poll(() => page.locator('.screen').evaluate(element => element.getAnimations().map(animation => animation instanceof CSSAnimation ? animation.animationName : ''))).toContain('page-fade-in')
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('减少动态效果时关闭页面动画，不支持原生过渡时仍可导航', async ({ page }) => {
  await observeTransitions(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.getByText('我的', { exact: true }).click()
  await expect(page.getByText('还没有来访记录', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as { observedPageAnimations: unknown[][] }).observedPageAnimations.length)).toBeGreaterThan(0)
  expect(await page.evaluate(() => (window as unknown as { observedPageAnimations: { name: string }[][] }).observedPageAnimations.flat().filter(animation => animation.name.startsWith('page-fade-')))).toEqual([])
  await page.evaluate(() => Object.defineProperty(document, 'startViewTransition', { value: undefined }))
  await page.getByText('首页', { exact: true }).click()
  await expect(page.getByRole('button', { name: '普通访客', exact: true })).toBeVisible()
})
