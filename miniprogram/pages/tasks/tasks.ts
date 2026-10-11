import { presentTask, openTask } from '../../services/presentation'
import { store } from '../../services/store'
import { getTrainingSubjects, maskPhone } from '../../models/visit'

Page({
  data: {
    visitId: '', subjectId: '', scopeSubjectId: '', visitCompleted: false,
    subjects: [] as Array<{ id: string; name: string; phone: string; total: number; completed: number; passed: boolean }>, completedSubjects: 0,
    tasks: [] as ReturnType<typeof presentTask>[], total: 0, completed: 0, progress: 0, nextId: '', missing: false
  },
  onLoad(query: Record<string, string>) { this.setData({ visitId: query.visitId || '', subjectId: query.subjectId || '', scopeSubjectId: query.subjectId || '' }) },
  onShow() { this.refresh() },
  refresh() {
    const visit = store.visit(this.data.visitId)
    const subjects = (visit ? getTrainingSubjects(visit) : []).filter(s => !this.data.scopeSubjectId || s.id === this.data.scopeSubjectId).map(subject => {
      const tasks = store.tasks(this.data.visitId, subject.id)
      const completed = tasks.filter(t => t.lastResult?.passed).length
      return { ...subject, phone: maskPhone(subject.phone), total: tasks.length, completed, passed: tasks.length > 0 && tasks.length === completed }
    })
    const missing = !!this.data.visitId && (!visit || (!!this.data.subjectId && !subjects.some(s => s.id === this.data.subjectId)))
    const all = missing ? [] : store.tasks(this.data.visitId || undefined, this.data.subjectId || undefined).map(presentTask)
    const completed = all.filter(t => t.passed).length
    this.setData({ tasks: all, total: all.length, completed, subjects, completedSubjects: subjects.filter(s => s.passed).length,
      progress: all.length ? Math.round(completed / all.length * 100) : 0, nextId: all.find(t => !t.passed)?.id || '',
      missing, visitCompleted: !!visit && store.visitStatus(visit.id) === 'completed' })
  },
  onSubject(event: WechatMiniprogram.BaseEvent) {
    if (this.data.scopeSubjectId) return
    const id = event.currentTarget.dataset.id as string
    if (id && !this.data.subjects.some(s => s.id === id)) return
    this.setData({ subjectId: id })
    this.refresh()
  },
  onTask(event: WechatMiniprogram.BaseEvent) { openTask(event.currentTarget.dataset.id as string) },
  onStart() { if (this.data.nextId) openTask(this.data.nextId) },
  onRecords() { wx.switchTab({ url: '/pages/logs/logs' }) }
})
