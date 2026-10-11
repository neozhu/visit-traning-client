import { getPlan } from '../../data/catalog'
import { ExamResult, TrainingTask } from '../../models/visit'
import { store, showError } from '../../services/store'
import { presentTask } from '../../services/presentation'

Page({
  data: {
    taskId: '', task: null as TrainingTask | null, result: null as ExamResult | null, title: '', subjectName: '', subjectPhone: '', correctCount: 0,
    showWrong: false, wrong: [] as Array<{ id: string; title: string; chosen: string; correct: string; explanation: string }>
  },
  onLoad(query: Record<string, string>) { this.setData({ taskId: query.taskId || '' }) },
  onShow() {
    const task = store.task(this.data.taskId)
    if (!task?.lastResult) { this.setData({ task: task || null, result: null }); return }
    const plan = getPlan(task.planId)
    const participant = presentTask(task)
    this.setData({ task, result: task.lastResult, title: plan.title, subjectName: participant.subjectName, subjectPhone: participant.subjectPhone, correctCount: plan.questions.length - task.lastResult.wrongIds.length,
      wrong: plan.questions.filter(q => task.lastResult!.wrongIds.includes(q.id)).map(q => ({
        id: q.id, title: q.title, chosen: q.options[task.lastResult!.answers[q.id]] || '未作答',
        correct: `${String.fromCharCode(65 + q.correct)}. ${q.options[q.correct]}`, explanation: q.explanation
      })) })
  },
  onWrong() { this.setData({ showWrong: !this.data.showWrong }); if (!this.data.showWrong) wx.pageScrollTo({ scrollTop: 0, duration: 0 }) },
  onRetry() {
    try { store.retake(this.data.taskId); wx.redirectTo({ url: `/pages/exam/exam?taskId=${this.data.taskId}` }) }
    catch (error) { showError(error) }
  },
  onComplete() { wx.redirectTo({ url: `/pages/completion/completion?taskId=${this.data.taskId}` }) },
  onTasks() {
    const pages = getCurrentPages()
    const index = pages.findIndex(p => p.route === 'pages/tasks/tasks')
    if (index >= 0 && index < pages.length - 1) wx.navigateBack({ delta: pages.length - 1 - index })
    else wx.redirectTo({ url: `/pages/tasks/tasks?visitId=${this.data.task?.visitId || ''}&subjectId=${this.data.task?.subjectId || ''}` })
  }
})
