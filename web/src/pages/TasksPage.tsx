import { t } from '../i18n'
import { useEffect } from 'react'
import { Button, ProgressBar } from 'antd-mobile'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { AREAS, ENTRIES, formatMoment, formatValidity, maskPhone } from '../domain/store'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Badge, Icon, Missing, Screen, Section } from '../components/UI'
import { ApplicationNotice } from '../components/ApplicationNotice'
import { trainingSuffix, useApiRoute } from '../domain/apiRoute'

export function TasksPage() {
  const { access } = useApiRoute()
  const { visitId } = useParams()
  const [params, setParams] = useSearchParams()
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const resume = useLocation().state?.resumeTraining
  const visit = state.visits.find(item => item.id === visitId)
  useEffect(() => {
    if (visit?.noticeAcceptedAt !== undefined && typeof resume === 'string' && /^\/(learn|exam|result|completion)\/\d+(\?|$)/.test(resume)) navigate(resume, { replace: true })
  }, [visit?.noticeAcceptedAt, resume, navigate])
  if (!visit) return <Missing />
  const tasks = store.currentTasks(visit.id)
  const selected = params.get('person') || 'all'
  const visible = selected === 'all' ? tasks : tasks.filter(task => task.subjectId === selected)
  const completedPeople = visit.subjects.filter(person => tasks.filter(task => task.subjectId === person.id).every(task => store.isTrainingValid(task))).length
  const completed = tasks.filter(task => store.isTrainingValid(task)).length
  const reusedCount = visible.filter(task => visit.exemptTaskIds.includes(task.id) && store.isTrainingValid(task)).length
  return <ApplicationNotice visit={visit}><Screen title={t('培训任务')} backTo="/records"><div className="visit-heading"><Badge>{t(ENTRIES[visit.type].label)}</Badge><span className="muted small">{t('预约')}{visit.appointmentDate}</span></div>
    <section className="progress-card"><div className="flex justify-between items-center"><h2>{t('人员培训进度')}</h2><Icon name="shield" size={24} /></div><div className="progress-number">{completedPeople}<span>/ {visit.subjects.length}</span><small>{t('人')}</small></div><ProgressBar percent={completed / tasks.length * 100} /><div className="progress-caption"><span>{t('{0} / {1} 人已完成', { 0: completedPeople, 1: visit.subjects.length })}</span><span>{t('{0} / {1} 门课程通过', { 0: completed, 1: tasks.length })}</span></div></section>
    <div className="person-selector" aria-label={t('选择学习人员')}><button type="button" className={selected === 'all' ? 'active' : ''} onClick={() => setParams(access === 'participant' ? { access } : {})}>{t('全部人员')}</button>{visit.subjects.map(person => <button type="button" aria-label={person.name} key={person.id} className={selected === person.id ? 'active' : ''} onClick={() => setParams(access === 'participant' ? { person: person.id, access } : { person: person.id })}>{person.name}</button>)}</div>
    <Section title={t('必修课程')} subtitle={AREAS.filter(area => visit.areaIds.includes(area.id)).map(area => area.name).join(' · ')}>{visible.map(task => {
      const person = visit.subjects.find(item => item.id === task.subjectId)!
      const course = task.courseSnapshot
      const passed = store.isTrainingValid(task)
      const reused = passed && visit.exemptTaskIds.includes(task.id)
      const started = task.completedLessons.length > 0 || !!task.attempt
      const status = reused ? t('有效期内免训') : passed ? t('已通过') : task.attempt ? t('考试中') : task.result ? t('待重考') : started ? t('学习中') : task.roundNumber > 1 ? t('需重新学习') : t('未开始')
      return <article className="card task-card" key={task.id}>
        <div className="flex gap-3 items-start"><span className="course-icon"><Icon name={course.icon} size={25} /></span><div className="flex-1"><h3>{course.title}</h3><p className="muted small">{person.name} · {maskPhone(person.phone)}</p></div><Badge tone={passed ? 'green' : task.result && !task.attempt ? 'red' : 'blue'}>{status}</Badge></div>
        <p className="muted small course-meta">{reused ? t('历史培训已通过，本次无需重复学习答题') : t('{0} 个视频 · 5 道题 · {1} 分通过', { 0: course.lessons.length, 1: course.passScore })}</p>
        {passed && <p className="green-text small mb-3">{t('有效至')}{formatValidity(task.validUntil!)}</p>}
        {!passed && task.roundNumber > 1 && <p className="muted small mb-3">{t('原培训已过期，请重新完整学习并答题。')}</p>}
        <ProgressBar percent={passed ? 100 : task.completedLessons.length / course.lessons.length * 70} style={{ '--track-width': '4px' }} />
        <div className="task-bottom"><span className="muted small">{reused ? t('上次通过 {0}', { 0: formatMoment(task.completedAt!) }) : t('视频 {0}/{1}', { 0: task.completedLessons.length, 1: course.lessons.length }) + (task.result ? t(' · 最近 {0} 分', { 0: task.result.score }) : '')}</span><Button size="small" style={{ minHeight: 44 }} disabled={!store.canWriteTask(task.id)} color="primary" fill={passed ? 'outline' : 'solid'} onClick={() => navigate(`${reused ? `/completion/${task.id}` : task.attempt ? `/exam/${task.id}` : task.result ? `/result/${task.id}` : `/learn/${task.id}`}${trainingSuffix(visit.id, access)}`)}>{reused ? t('查看培训凭证') : task.attempt ? t('继续考试') : task.result ? t('查看结果') : started ? t('继续学习') : t('开始学习')}</Button></div>
      </article>
    })}{reusedCount > 0 && <p className="info-banner" role="status">{t('{0} 门课程在有效期内，免去重复学习与答题。', { 0: reusedCount })}</p>}</Section><Button block fill="none" color="primary" onClick={() => navigate(`/records/${visit.id}${access === 'participant' ? '?access=participant' : ''}`)}>{t('查看申请详情')}</Button><p className="center muted small mt-4">{t('每个人的培训结果独立判断，过期课程需重新学习')}</p>
  </Screen></ApplicationNotice>
}
