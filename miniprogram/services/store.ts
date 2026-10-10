import { createVisitStore } from './visit-store'

export const store = createVisitStore({
  read: key => wx.getStorageSync(key),
  write: (key, value) => wx.setStorageSync(key, value)
})

export function showError(error: unknown) {
  wx.showToast({ title: error instanceof Error ? error.message : '操作失败，请重试', icon: 'none', duration: 2500 })
}
