import { getPlan } from '../../data/catalog'
import { TrainingTask, formatDate } from '../../models/visit'
import { store } from '../../services/store'

Page({
  data: { task: null as TrainingTask | null, title: '', date: '', lessonCount: 0, visitCompleted: false, passed: false },
  onLoad(query: Record<string, string>) {
    const task = store.task(query.taskId || '')
    if (!task?.lastResult?.passed) return
    const plan = getPlan(task.planId)
    this.setData({ task, title: plan.title, date: formatDate(task.completedAt || 0), lessonCount: plan.lessons.length,
      visitCompleted: store.visitStatus(task.visitId) === 'completed', passed: true })
  },
  onTasks() {
    const pages = getCurrentPages()
    const index = pages.findIndex(p => p.route === 'pages/tasks/tasks')
    if (index >= 0 && index < pages.length - 1) wx.navigateBack({ delta: pages.length - 1 - index })
    else wx.redirectTo({ url: `/pages/tasks/tasks?visitId=${this.data.task?.visitId || ''}` })
  },
  onRecords() { wx.switchTab({ url: '/pages/logs/logs' }) }
})
