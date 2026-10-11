import { AREAS, getPlan } from '../data/catalog'
import { ENTRY_LABELS, TrainingTask, Visit, formatDate, getTrainingSubjects, maskPhone } from '../models/visit'
import { store } from './store'
import { getRegistrationSections } from '../models/registration'

export function presentTask(task: TrainingTask) {
  const plan = getPlan(task.planId)
  const done = task.completedLessonIds.length
  const passed = !!task.lastResult?.passed
  const status = passed ? '已完成' : task.attempt ? '考试中' : done === plan.lessons.length ? '待考试' : done ? '学习中' : '未开始'
  const visit = store.visit(task.visitId)
  const subject = visit && getTrainingSubjects(visit).find(s => s.id === task.subjectId)
  return { ...task, title: plan.title, subtitle: plan.subtitle, icon: plan.icon, visitLabel: visit ? `${ENTRY_LABELS[visit.type]}申请单` : '到访申请单',
    subjectName: subject?.name || '登记人员', subjectPhone: subject ? maskPhone(subject.phone) : '',
    lessonCount: plan.lessons.length, questionCount: plan.questions.length, done, passed, status,
    date: formatDate(task.completedAt || task.createdAt), progress: Math.round(done / plan.lessons.length * 100),
    action: passed ? '查看结果' : task.attempt ? '继续考试' : done === plan.lessons.length ? '开始考试' : done ? '继续学习' : '开始学习' }
}

export function presentVisit(visit: Visit) {
  const tasks = store.tasks(visit.id)
  const complete = tasks.filter(t => t.lastResult?.passed).length
  const subjects = visit.type === 'logistics' ? visit.vehicles.map(v => v.driver) : visit.people.map(p => p.name)
  const people = getTrainingSubjects(visit)
  const completedSubjects = people.filter(p => {
    const own = tasks.filter(t => t.subjectId === p.id)
    return own.length > 0 && own.every(t => t.lastResult?.passed)
  }).length
  return { ...visit, title: `${ENTRY_LABELS[visit.type]}登记`, date: formatDate(visit.createdAt), names: subjects.join('、'),
    plates: [...visit.vehicles, ...visit.accompanyingVehicles || []].map(v => v.plate).join('、'), infoSections: getRegistrationSections(visit),
    areaNames: AREAS.filter(a => visit.areaIds.includes(a.id)).map(a => a.name).join('、'),
    icon: { training: 'book', visitor: 'user', logistics: 'truck', contractor: 'helmet' }[visit.type],
    complete, total: tasks.length, subjectCount: people.length, completedSubjects, passed: tasks.length > 0 && complete === tasks.length }
}

export function openTask(id: string) {
  const task = store.task(id)
  if (!task) { wx.showToast({ title: '任务已删除，请返回记录列表', icon: 'none' }); return }
  const page = task.lastResult?.passed ? 'result' : task.attempt ? 'exam' : 'learn'
  wx.navigateTo({ url: `/pages/${page}/${page}?taskId=${id}` })
}
