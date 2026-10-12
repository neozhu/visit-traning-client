import { Button, ProgressBar } from 'antd-mobile'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { AREAS, ENTRIES, maskPhone } from '../domain/store'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Badge, Icon, Missing, Screen, Section } from '../components/UI'

export function TasksPage() {
  const { visitId } = useParams()
  const [params, setParams] = useSearchParams()
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const visit = state.visits.find(item => item.id === visitId)
  if (!visit) return <Missing />
  const tasks = state.tasks.filter(task => task.visitId === visit.id)
  const selected = params.get('person') || 'all'
  const visible = selected === 'all' ? tasks : tasks.filter(task => task.subjectId === selected)
  const completedPeople = visit.subjects.filter(person => tasks.filter(task => task.subjectId === person.id).every(task => task.result?.passed)).length
  const completed = tasks.filter(task => task.result?.passed).length
  return <Screen title="培训任务" backTo="/records"><div className="visit-heading"><Badge>{ENTRIES[visit.type].label}</Badge><span className="muted small">预约 {visit.appointmentDate}</span></div>
    <section className="progress-card"><div className="flex justify-between items-center"><h2>人员培训进度</h2><Icon name="shield" size={24} /></div><div className="progress-number">{completedPeople}<span>/ {visit.subjects.length}</span><small>人</small></div><ProgressBar percent={completed / tasks.length * 100} /><div className="progress-caption"><span>{completedPeople} / {visit.subjects.length} 人已完成</span><span>{completed} / {tasks.length} 门课程通过</span></div></section>
    <div className="person-selector" aria-label="选择学习人员"><button type="button" className={selected === 'all' ? 'active' : ''} onClick={() => setParams({})}>全部人员</button>{visit.subjects.map(person => <button type="button" aria-label={person.name} key={person.id} className={selected === person.id ? 'active' : ''} onClick={() => setParams({ person: person.id })}>{person.name}</button>)}</div>
    <Section title="必修课程" subtitle={AREAS.filter(area => visit.areaIds.includes(area.id)).map(area => area.name).join(' · ')}>{visible.map(task => {
      const person = visit.subjects.find(item => item.id === task.subjectId)!
      const course = store.course(task.courseId)
      const passed = task.result?.passed
      const started = task.completedLessons.length > 0 || !!task.attempt
      const status = passed ? '已通过' : task.attempt ? '考试中' : task.result ? '待重考' : started ? '学习中' : '未开始'
      return <article className="card task-card" key={task.id}><div className="flex gap-3 items-start"><span className="course-icon"><Icon name={course.icon} size={25} /></span><div className="flex-1"><h3>{course.title}</h3><p className="muted small">{person.name} · {maskPhone(person.phone)}</p></div><Badge tone={passed ? 'green' : task.result && !task.attempt ? 'red' : 'blue'}>{status}</Badge></div><p className="muted small course-meta">{course.lessons.length} 个视频 · 5 道题 · 80 分通过</p><ProgressBar percent={passed ? 100 : task.completedLessons.length / course.lessons.length * 70} style={{ '--track-width': '4px' }} /><div className="task-bottom"><span className="muted small">视频 {task.completedLessons.length}/{course.lessons.length}{task.result ? ` · 最近 ${task.result.score} 分` : ''}</span><Button size="small" color="primary" fill={passed ? 'outline' : 'solid'} onClick={() => navigate(task.attempt ? `/exam/${task.id}` : task.result ? `/result/${task.id}` : `/learn/${task.id}`)}>{task.attempt ? '继续考试' : task.result ? '查看结果' : started ? '继续学习' : '开始学习'}</Button></div></article>
    })}</Section><Button block fill="none" color="primary" onClick={() => navigate(`/records/${visit.id}`)}>查看申请详情</Button><p className="center muted small mt-4">每个人的学习、考试和重考进度分别保存</p>
  </Screen>
}
