import { AREAS } from '../../data/catalog'
import { ENTRY_LABELS, formatDate } from '../../models/visit'
import { store } from '../../services/store'

Page({
  data: {
    name: '', phone: '', error: '', searched: false,
    matches: [] as Array<{ visitId: string; subjectId: string; title: string; date: string; areas: string; pending: number; total: number }>
  },
  onShow() { if (this.data.searched) this.onFind() },
  onInput(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const field = event.currentTarget.dataset.field as string
    if (field === 'name' || field === 'phone') this.setData({ [field]: event.detail.value, error: '', searched: false, matches: [] })
  },
  onFind() {
    try {
      const tasks = store.pendingTasks(this.data.name, this.data.phone)
      const matches = store.visits().filter(v => tasks.some(t => t.visitId === v.id)).map(visit => {
        const own = tasks.filter(t => t.visitId === visit.id)
        const subjectId = own[0].subjectId
        return { visitId: visit.id, subjectId, title: `${ENTRY_LABELS[visit.type]}申请单`, date: formatDate(visit.createdAt),
          areas: AREAS.filter(a => visit.areaIds.includes(a.id)).map(a => a.name).join('、') || '通用安全培训',
          pending: own.length, total: store.tasks(visit.id, subjectId).length }
      })
      this.setData({ matches, searched: true, error: '' })
    } catch (error) {
      this.setData({ error: error instanceof Error ? error.message : '请核对登记信息后重试', matches: [], searched: false })
    }
  },
  onMatch(event: WechatMiniprogram.BaseEvent) {
    const { visitId, subjectId } = event.currentTarget.dataset as { visitId: string; subjectId: string }
    if (this.data.matches.some(m => m.visitId === visitId && m.subjectId === subjectId)) {
      wx.navigateTo({ url: `/pages/tasks/tasks?visitId=${visitId}&subjectId=${subjectId}` })
    }
  }
})
