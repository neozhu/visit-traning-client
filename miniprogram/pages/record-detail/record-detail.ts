import { presentTask, presentVisit, openTask } from '../../services/presentation'
import { maskPhone } from '../../models/visit'
import { store, showError } from '../../services/store'

Page({
  data: { visitId: '', visit: null as ReturnType<typeof presentVisit> | null, tasks: [] as ReturnType<typeof presentTask>[],
    rows: [] as Array<{ id: string; name: string; phone: string; company: string; extra: string }> },
  onLoad(query: Record<string, string>) { this.setData({ visitId: query.visitId || '' }) },
  onShow() {
    const visit = store.visit(this.data.visitId)
    this.setData({ visit: visit ? presentVisit(visit) : null, tasks: store.tasks(this.data.visitId).map(presentTask),
      rows: !visit ? [] : visit.type === 'logistics' ? visit.vehicles.map(v => ({ id: v.id, name: v.plate, phone: maskPhone(v.phone), company: v.company, extra: `司机：${v.driver}` }))
        : visit.people.map(p => ({ id: p.id, name: p.name, phone: maskPhone(p.phone), company: p.company, extra: p.trade ? `工种：${p.trade}` : '' })) })
  },
  onTask(event: WechatMiniprogram.BaseEvent) { openTask(event.currentTarget.dataset.id as string) },
  onResume() { wx.navigateTo({ url: `/pages/tasks/tasks?visitId=${this.data.visitId}` }) },
  onRecords() { wx.switchTab({ url: '/pages/logs/logs' }) },
  onDelete() {
    wx.showModal({ title: '删除这条登记？', content: '本条登记及其全部培训、考试记录会从当前设备删除。', confirmColor: '#c83d39',
      success: r => { if (r.confirm) { try { store.removeVisit(this.data.visitId); wx.switchTab({ url: '/pages/logs/logs' }) } catch (error) { showError(error) } } } })
  }
})
