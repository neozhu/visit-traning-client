import { ENTRY_DESCRIPTIONS } from '../../data/catalog'
import { ENTRY_LABELS, EntryType } from '../../models/visit'
import { store } from '../../services/store'

Page({
  data: {
    entries: (['training', 'visitor', 'logistics', 'contractor'] as EntryType[]).map(type => ({
      type, title: ENTRY_LABELS[type], description: ENTRY_DESCRIPTIONS[type],
      icon: { training: 'book', visitor: 'user', logistics: 'truck', contractor: 'helmet' }[type]
    })),
    pendingCount: 0
  },
  onShow() { this.setData({ pendingCount: store.tasks().filter(t => !t.lastResult?.passed).length }) },
  onEntry(event: WechatMiniprogram.BaseEvent) {
    const type = event.currentTarget.dataset.type as EntryType
    wx.navigateTo({ url: `/pages/registration/registration?type=${type}` })
  },
  onResume() { wx.navigateTo({ url: '/pages/tasks/tasks' }) },
  onRecords() { wx.switchTab({ url: '/pages/logs/logs' }) }
})
