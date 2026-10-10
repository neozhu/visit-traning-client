import { presentTask, presentVisit, openTask } from '../../services/presentation'
import { store } from '../../services/store'

Page({
  data: {
    tab: 'visits', keyword: '', visits: [] as ReturnType<typeof presentVisit>[], tasks: [] as ReturnType<typeof presentTask>[],
    visitCount: 0, completeCount: 0, pendingCount: 0
  },
  onShow() { this.refresh() },
  refresh() {
    const keyword = this.data.keyword.trim().toLowerCase()
    const visits = store.visits().map(presentVisit)
    const tasks = store.tasks().map(presentTask).sort((a, b) => b.createdAt - a.createdAt)
    const matchingVisits = visits.filter(v => [v.title, v.names, v.plates, ...v.people.map(p => p.company), ...v.vehicles.map(v => v.company)].join(' ').toLowerCase().includes(keyword))
    this.setData({
      visits: matchingVisits,
      tasks: tasks.filter(t => t.title.toLowerCase().includes(keyword) || matchingVisits.some(v => v.id === t.visitId)),
      visitCount: visits.length, completeCount: tasks.filter(t => t.passed).length, pendingCount: tasks.filter(t => !t.passed).length
    })
  },
  onTab(event: WechatMiniprogram.BaseEvent) { this.setData({ tab: event.currentTarget.dataset.tab as string }) },
  onSearch(event: WechatMiniprogram.CustomEvent<{ value: string }>) { this.setData({ keyword: event.detail.value }); this.refresh() },
  onClearSearch() { this.setData({ keyword: '' }); this.refresh() },
  onVisit(event: WechatMiniprogram.BaseEvent) { wx.navigateTo({ url: `/pages/record-detail/record-detail?visitId=${event.currentTarget.dataset.id as string}` }) },
  onTask(event: WechatMiniprogram.BaseEvent) { openTask(event.currentTarget.dataset.id as string) },
  onHome() { wx.switchTab({ url: '/pages/index/index' }) }
})
