import { Lesson, getPlan } from '../../data/catalog'
import { TrainingTask } from '../../models/visit'
import { store, showError } from '../../services/store'

Page({
  data: {
    taskId: '', task: null as TrainingTask | null, title: '', lessons: [] as Array<Lesson & { done: boolean }>,
    selected: 0, lesson: null as Lesson | null, watched: false, allDone: false, progress: 0, videoError: '', missing: false,
    fallbackActive: false, fallbackRemaining: 0, videoErrorDetail: '', videoSource: ''
  },
  maxPosition: 0,
  duration: 6,
  fallbackDeadline: 0,
  fallbackTimer: undefined as number | undefined,
  onLoad(query: Record<string, string>) {
    this.setData({ taskId: query.taskId || '' })
    const task = store.task(this.data.taskId)
    if (!task) { this.setData({ missing: true }); return }
    const plan = getPlan(task.planId)
    const first = plan.lessons.findIndex(l => !task.completedLessonIds.includes(l.id))
    this.setData({ selected: first < 0 ? 0 : first })
    this.refresh()
  },
  onShow() {
    if (this.data.taskId) this.refresh()
    if (this.data.videoError && !this.data.watched) this.startFallback()
  },
  refresh() {
    const task = store.task(this.data.taskId)
    if (!task) { this.setData({ task: null, missing: true }); return }
    const plan = getPlan(task.planId)
    const lesson = plan.lessons[this.data.selected]
    let videoSource = this.data.videoSource
    let preparationError = ''
    if (this.data.lesson?.id !== lesson.id || !videoSource) {
      try {
        videoSource = `${wx.env.USER_DATA_PATH}/visitsafe-${lesson.source.split('/').pop()}`
        wx.getFileSystemManager().copyFileSync(lesson.source, videoSource)
      } catch (error) {
        videoSource = lesson.source
        preparationError = error instanceof Error ? error.message : '本地视频准备失败'
      }
    }
    this.setData({ task, title: plan.title, lesson, videoSource,
      lessons: plan.lessons.map(l => ({ ...l, done: task.completedLessonIds.includes(l.id) })),
      watched: task.completedLessonIds.includes(lesson.id), allDone: plan.lessons.every(l => task.completedLessonIds.includes(l.id)), missing: false })
    if (preparationError) this.onVideoError({ detail: { errMsg: preparationError } } as WechatMiniprogram.CustomEvent<{ errMsg: string }>)
  },
  onLesson(event: WechatMiniprogram.BaseEvent) {
    wx.createVideoContext('lesson-video').pause()
    this.stopFallback()
    this.fallbackDeadline = 0
    this.maxPosition = 0
    this.setData({ selected: Number(event.currentTarget.dataset.index), progress: 0, videoError: '', videoErrorDetail: '', fallbackActive: false, fallbackRemaining: 0 })
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
    try { store.markLesson(this.data.taskId, this.data.lesson.id); this.stopFallback(); this.setData({ progress: 100, fallbackActive: false, fallbackRemaining: 0 }); this.refresh() }
    catch (error) { showError(error) }
  },
  onVideoError(event?: WechatMiniprogram.CustomEvent<{ errMsg: string }>) {
    const detail = event?.detail?.errMsg || ''
    console.warn('VisitSafe video loading failed:', detail)
    this.setData({ videoError: '视频暂时无法加载，演示倒计时结束后可继续。', videoErrorDetail: detail })
    if (!this.data.watched) this.startFallback()
  },
  stopFallback() {
    if (this.fallbackTimer !== undefined) { clearInterval(this.fallbackTimer); this.fallbackTimer = undefined }
  },
  startFallback() {
    this.stopFallback()
    if (!this.data.task || !this.data.lesson || this.data.watched) return
    if (!this.fallbackDeadline) this.fallbackDeadline = Date.now() + 6000
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((this.fallbackDeadline - Date.now()) / 1000))
      this.setData({ fallbackActive: true, fallbackRemaining: remaining, progress: Math.round((6 - remaining) / 6 * 100) })
      if (remaining !== 0) return
      this.stopFallback()
      try {
        store.markLesson(this.data.taskId, this.data.lesson!.id)
        this.setData({ fallbackActive: false, progress: 100 })
        this.refresh()
      } catch (error) { showError(error) }
    }
    tick()
    if (!this.data.watched) this.fallbackTimer = setInterval(tick, 250)
  },
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
  onHide() { wx.createVideoContext('lesson-video').pause(); this.stopFallback() },
  onUnload() { this.stopFallback() }
})
