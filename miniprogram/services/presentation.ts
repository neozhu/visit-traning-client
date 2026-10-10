import { AREAS, getPlan } from '../data/catalog'
import { ENTRY_LABELS, TrainingTask, Visit, formatDate } from '../models/visit'
import { store } from './store'

export function presentTask(task: TrainingTask) {
  const plan = getPlan(task.planId)
  const done = task.completedLessonIds.length
  const passed = !!task.lastResult?.passed
  const status = passed ? '已完成' : task.attempt ? '考试中' : done === plan.lessons.length ? '待考试' : done ? '学习中' : '未开始'
  const visit = store.visit(task.visitId)
  return { ...task, title: plan.title, subtitle: plan.subtitle, icon: plan.icon, visitLabel: visit ? `${ENTRY_LABELS[visit.type]}申请单` : '到访申请单',
    lessonCount: plan.lessons.length, questionCount: plan.questions.length, done, passed, status,
    date: formatDate(task.completedAt || task.createdAt), progress: Math.round(done / plan.lessons.length * 100),
    action: passed ? '查看结果' : task.attempt ? '继续考试' : done === plan.lessons.length ? '开始考试' : done ? '继续学习' : '开始学习' }
}

export function presentVisit(visit: Visit) {
  const tasks = store.tasks(visit.id)
  const complete = tasks.filter(t => t.lastResult?.passed).length
  const subjects = visit.type === 'logistics' ? visit.vehicles.map(v => v.driver) : visit.people.map(p => p.name)
  return { ...visit, title: `${ENTRY_LABELS[visit.type]}登记`, date: formatDate(visit.createdAt), names: subjects.join('、'),
    plates: visit.vehicles.map(v => v.plate).join('、'), areaNames: AREAS.filter(a => visit.areaIds.includes(a.id)).map(a => a.name).join('、'),
    icon: { training: 'book', visitor: 'user', logistics: 'truck', contractor: 'helmet' }[visit.type],
    complete, total: tasks.length, passed: tasks.length > 0 && complete === tasks.length }
}

export function openTask(id: string) {
  const task = store.task(id)
  if (!task) { wx.showToast({ title: '任务已删除，请返回记录列表', icon: 'none' }); return }
  const page = task.lastResult?.passed ? 'result' : task.attempt ? 'exam' : 'learn'
  wx.navigateTo({ url: `/pages/${page}/${page}?taskId=${id}` })
}
