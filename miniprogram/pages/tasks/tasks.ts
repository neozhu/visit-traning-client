import { presentTask, openTask } from '../../services/presentation'
import { store } from '../../services/store'

Page({
  data: {
    visitId: '',
    tasks: [] as ReturnType<typeof presentTask>[], total: 0, completed: 0, progress: 0, nextId: '', missing: false
  },
  onLoad(query: Record<string, string>) { this.setData({ visitId: query.visitId || '' }) },
  onShow() { this.refresh() },
  refresh() {
    const all = store.tasks(this.data.visitId || undefined).map(presentTask)
    const completed = all.filter(t => t.passed).length
    this.setData({ tasks: all, total: all.length, completed,
      progress: all.length ? Math.round(completed / all.length * 100) : 0, nextId: all.find(t => !t.passed)?.id || '',
      missing: !!this.data.visitId && !store.visit(this.data.visitId) })
  },
  onTask(event: WechatMiniprogram.BaseEvent) { openTask(event.currentTarget.dataset.id as string) },
  onStart() { if (this.data.nextId) openTask(this.data.nextId) },
  onRecords() { wx.switchTab({ url: '/pages/logs/logs' }) }
})
