import { getPlan } from '../../data/catalog'
import { Question } from '../../models/visit'
import { store, showError } from '../../services/store'
import { presentTask } from '../../services/presentation'

Page({
  data: {
    taskId: '', title: '', subjectName: '', subjectPhone: '', questions: [] as Question[], current: 0, question: null as Question | null,
    options: [] as Array<{ index: number; label: string; text: string; selected: boolean }>, answered: 0,
    remaining: '15:00', remainingSeconds: 900, progress: 0, error: '', feedback: '', submitting: false,
    questionStates: [] as Array<{ index: number; answered: boolean; wrong: boolean }>, valid: false
  },
  timer: undefined as number | undefined,
  onLoad(query: Record<string, string>) {
    this.setData({ taskId: query.taskId || '' })
    try {
      const task = store.task(this.data.taskId)
      if (!task) throw new Error('培训任务不存在，请返回任务列表')
      if (task.lastResult && !task.attempt) { wx.redirectTo({ url: `/pages/result/result?taskId=${task.id}` }); return }
      const begun = store.beginExam(task.id)
      const plan = getPlan(task.planId)
      const first = plan.questions.findIndex(q => begun.attempt?.answers[q.id] === undefined)
      const participant = presentTask(task)
      this.setData({ valid: true, questions: plan.questions, title: plan.title, subjectName: participant.subjectName, subjectPhone: participant.subjectPhone, current: first < 0 ? 0 : first })
      this.refresh()
    } catch (error) { this.setData({ error: error instanceof Error ? error.message : '考试加载失败' }) }
  },
  onShow() {
    if (!this.data.valid || this.data.submitting) return
    this.tick()
    this.timer = setInterval(() => this.tick(), 1000)
  },
  stopTimer() { if (this.timer !== undefined) { clearInterval(this.timer); this.timer = undefined } },
  onHide() { this.stopTimer() },
  onUnload() { this.stopTimer() },
  tick() {
    const task = store.task(this.data.taskId)
    if (!task?.attempt) { this.stopTimer(); return }
    const seconds = Math.max(0, Math.ceil((task.attempt.deadlineAt - Date.now()) / 1000))
    this.setData({ remainingSeconds: seconds, remaining: `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}` })
    if (seconds === 0) { this.stopTimer(); this.finish(true) }
  },
  refresh() {
    const task = store.task(this.data.taskId)
    const question = this.data.questions[this.data.current]
    if (!task?.attempt || !question) return
    const answers = task.attempt.answers
    const answered = this.data.questions.filter(q => answers[q.id] !== undefined).length
    this.setData({ question, answered, progress: answered / this.data.questions.length * 100,
      feedback: answers[question.id] !== undefined && answers[question.id] !== question.correct ? '回答错误，可以重新选择答案。' : '',
      options: question.options.map((text, index) => ({ index, label: String.fromCharCode(65 + index), text, selected: answers[question.id] === index })),
      questionStates: this.data.questions.map((q, index) => ({ index, answered: answers[q.id] !== undefined, wrong: answers[q.id] !== undefined && answers[q.id] !== q.correct })) })
  },
  onChoose(event: WechatMiniprogram.BaseEvent) {
    if (!this.data.question || this.data.submitting) return
    try {
      const index = Number(event.currentTarget.dataset.index)
      store.answer(this.data.taskId, this.data.question.id, index)
      if (index !== this.data.question.correct) wx.showToast({ title: '回答错误，可返回修改', icon: 'none', duration: 1800 })
      this.setData({ current: Math.min(this.data.current + 1, this.data.questions.length - 1), error: '' })
      this.refresh()
    }
    catch (error) { showError(error); this.tick() }
  },
  onJump(event: WechatMiniprogram.BaseEvent) { this.setData({ current: Number(event.currentTarget.dataset.index), error: '' }); this.refresh() },
  onPrevious() { if (this.data.current > 0) { this.setData({ current: this.data.current - 1, error: '' }); this.refresh() } },
  onNext() { if (this.data.current < this.data.questions.length - 1) { this.setData({ current: this.data.current + 1, error: '' }); this.refresh() } else this.onSubmit() },
  onSubmit() {
    if (this.data.answered !== this.data.questions.length) { this.setData({ error: `还有 ${this.data.questions.length - this.data.answered} 道题未作答，请完成后交卷。` }); return }
    wx.showModal({ title: '确认提交试卷？', content: '提交后将立即评分，请确认所有答案。', success: r => { if (r.confirm) this.finish(false) } })
  },
  finish(timedOut: boolean) {
    if (this.data.submitting) return
    this.setData({ submitting: true })
    try {
      store.finishExam(this.data.taskId, timedOut)
      this.stopTimer()
      wx.redirectTo({ url: `/pages/result/result?taskId=${this.data.taskId}` })
    } catch (error) { this.setData({ submitting: false }); showError(error) }
  },
  onTasks() {
    const task = store.task(this.data.taskId)
    wx.redirectTo({ url: task ? `/pages/tasks/tasks?visitId=${task.visitId}&subjectId=${task.subjectId}` : '/pages/training/training' })
  }
})
