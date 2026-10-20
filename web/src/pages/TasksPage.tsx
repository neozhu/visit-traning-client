import { Button, ProgressBar } from 'antd-mobile'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { AREAS, ENTRIES, formatMoment, formatValidity, maskPhone } from '../domain/store'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Badge, Icon, Missing, Screen, Section } from '../components/UI'
import { ApplicationNotice } from '../components/ApplicationNotice'

export function TasksPage() {
  const { visitId } = useParams()
  const [params, setParams] = useSearchParams()
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const visit = state.visits.find(item => item.id === visitId)
  if (!visit) return <Missing />
  const tasks = store.currentTasks(visit.id)
  const selected = params.get('person') || 'all'
  const visible = selected === 'all' ? tasks : tasks.filter(task => task.subjectId === selected)
  const completedPeople = visit.subjects.filter(person => tasks.filter(task => task.subjectId === person.id).every(task => store.isTrainingValid(task))).length
  const completed = tasks.filter(task => store.isTrainingValid(task)).length
  const reusedCount = visible.filter(task => visit.exemptTaskIds.includes(task.id) && store.isTrainingValid(task)).length
  return <ApplicationNotice visit={visit}><Screen title="培训任务" backTo="/records"><div className="visit-heading"><Badge>{ENTRIES[visit.type].label}</Badge><span className="muted small">预约 {visit.appointmentDate}</span></div>
    <section className="progress-card"><div className="flex justify-between items-center"><h2>人员培训进度</h2><Icon name="shield" size={24} /></div><div className="progress-number">{completedPeople}<span>/ {visit.subjects.length}</span><small>人</small></div><ProgressBar percent={completed / tasks.length * 100} /><div className="progress-caption"><span>{completedPeople} / {visit.subjects.length} 人已完成</span><span>{completed} / {tasks.length} 门课程通过</span></div></section>
    <div className="person-selector" aria-label="选择学习人员"><button type="button" className={selected === 'all' ? 'active' : ''} onClick={() => setParams({})}>全部人员</button>{visit.subjects.map(person => <button type="button" aria-label={person.name} key={person.id} className={selected === person.id ? 'active' : ''} onClick={() => setParams({ person: person.id })}>{person.name}</button>)}</div>
    <Section title="必修课程" subtitle={AREAS.filter(area => visit.areaIds.includes(area.id)).map(area => area.name).join(' · ')}>{visible.map(task => {
      const person = visit.subjects.find(item => item.id === task.subjectId)!
      const course = task.courseSnapshot
      const passed = store.isTrainingValid(task)
      const reused = passed && visit.exemptTaskIds.includes(task.id)
      const started = task.completedLessons.length > 0 || !!task.attempt
      const status = reused ? '有效期内免训' : passed ? '已通过' : task.attempt ? '考试中' : task.result ? '待重考' : started ? '学习中' : task.roundNumber > 1 ? '需重新学习' : '未开始'
      return <article className="card task-card" key={task.id}>
        <div className="flex gap-3 items-start"><span className="course-icon"><Icon name={course.icon} size={25} /></span><div className="flex-1"><h3>{course.title}</h3><p className="muted small">{person.name} · {maskPhone(person.phone)}</p></div><Badge tone={passed ? 'green' : task.result && !task.attempt ? 'red' : 'blue'}>{status}</Badge></div>
        <p className="muted small course-meta">{reused ? '历史培训已通过，本次无需重复学习答题' : `${course.lessons.length} 个视频 · 5 道题 · ${course.passScore} 分通过`}</p>
        {passed && <p className="green-text small mb-3">有效至 {formatValidity(task.validUntil!)}</p>}
        {!passed && task.roundNumber > 1 && <p className="muted small mb-3">原培训已过期，请重新完整学习并答题。</p>}
        <ProgressBar percent={passed ? 100 : task.completedLessons.length / course.lessons.length * 70} style={{ '--track-width': '4px' }} />
        <div className="task-bottom"><span className="muted small">{reused ? `上次通过 ${formatMoment(task.completedAt!)}` : `视频 ${task.completedLessons.length}/${course.lessons.length}${task.result ? ` · 最近 ${task.result.score} 分` : ''}`}</span><Button size="small" style={{ minHeight: 44 }} color="primary" fill={passed ? 'outline' : 'solid'} onClick={() => navigate(`${reused ? `/completion/${task.id}` : task.attempt ? `/exam/${task.id}` : task.result ? `/result/${task.id}` : `/learn/${task.id}`}?visit=${visit.id}`)}>{reused ? '查看培训凭证' : task.attempt ? '继续考试' : task.result ? '查看结果' : started ? '继续学习' : '开始学习'}</Button></div>
      </article>
    })}{reusedCount > 0 && <p className="info-banner" role="status">{reusedCount} 门课程在有效期内，免去重复学习与答题。</p>}</Section><Button block fill="none" color="primary" onClick={() => navigate(`/records/${visit.id}`)}>查看申请详情</Button><p className="center muted small mt-4">每个人的培训结果独立判断，过期课程需重新学习</p>
  </Screen></ApplicationNotice>
}
