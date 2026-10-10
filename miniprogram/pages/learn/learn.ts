import { Lesson, getPlan } from '../../data/catalog'
import { TrainingTask } from '../../models/visit'
import { store, showError } from '../../services/store'

Page({
  data: {
    taskId: '', task: null as TrainingTask | null, title: '', lessons: [] as Array<Lesson & { done: boolean }>,
    selected: 0, lesson: null as Lesson | null, watched: false, allDone: false, progress: 0, videoError: '', missing: false
  },
  maxPosition: 0,
  duration: 6,
  onLoad(query: Record<string, string>) {
    this.setData({ taskId: query.taskId || '' })
    const task = store.task(this.data.taskId)
    if (!task) { this.setData({ missing: true }); return }
    const plan = getPlan(task.planId)
    const first = plan.lessons.findIndex(l => !task.completedLessonIds.includes(l.id))
    this.setData({ selected: first < 0 ? 0 : first })
    this.refresh()
  },
  onShow() { if (this.data.taskId) this.refresh() },
  refresh() {
    const task = store.task(this.data.taskId)
    if (!task) { this.setData({ task: null, missing: true }); return }
    const plan = getPlan(task.planId)
    const lesson = plan.lessons[this.data.selected]
    this.setData({ task, title: plan.title, lesson,
      lessons: plan.lessons.map(l => ({ ...l, done: task.completedLessonIds.includes(l.id) })),
      watched: task.completedLessonIds.includes(lesson.id), allDone: plan.lessons.every(l => task.completedLessonIds.includes(l.id)), missing: false })
  },
  onLesson(event: WechatMiniprogram.BaseEvent) {
    wx.createVideoContext('lesson-video').pause()
    this.maxPosition = 0
    this.setData({ selected: Number(event.currentTarget.dataset.index), progress: 0, videoError: '' })
    this.refresh()
  },
  onMetadata(event: WechatMiniprogram.CustomEvent<{ duration: number }>) { this.duration = event.detail.duration || 6 },
  onTimeUpdate(event: WechatMiniprogram.CustomEvent<{ currentTime: number; duration: number }>) {
    const current = event.detail.currentTime
    if (!this.data.watched && current > this.maxPosition + 1.8) {
      wx.createVideoContext('lesson-video').seek(this.maxPosition)
      return
    }
    this.maxPosition = Math.max(this.maxPosition, current)
    this.setData({ progress: Math.min(100, Math.round(current * 100 / (event.detail.duration || this.duration))) })
  },
  onEnded() {
    if (!this.data.lesson || !this.data.task) return
    if (!this.data.watched && this.maxPosition < this.duration - 1.8) { showError(new Error('请完整观看视频后再继续')); return }
    try { store.markLesson(this.data.taskId, this.data.lesson.id); this.setData({ progress: 100 }); this.refresh() }
    catch (error) { showError(error) }
  },
  onVideoError() { this.setData({ videoError: '视频加载失败，请重新进入此页面；本地教学视频无需网络。' }) },
  onContinue() {
    if (!this.data.watched) return
    const next = this.data.lessons.findIndex(l => !l.done)
    if (next >= 0) this.onLesson({ currentTarget: { dataset: { index: next } } } as unknown as WechatMiniprogram.BaseEvent)
  },
  onExam() {
    try { store.beginExam(this.data.taskId); wx.redirectTo({ url: `/pages/exam/exam?taskId=${this.data.taskId}` }) }
    catch (error) { showError(error) }
  },
  onTasks() {
    const pages = getCurrentPages()
    const index = pages.findIndex(p => p.route === 'pages/tasks/tasks')
    if (index >= 0 && index < pages.length - 1) wx.navigateBack({ delta: pages.length - 1 - index })
    else wx.redirectTo({ url: `/pages/tasks/tasks?visitId=${this.data.task?.visitId || ''}` })
  },
  onHide() { wx.createVideoContext('lesson-video').pause() }
})
