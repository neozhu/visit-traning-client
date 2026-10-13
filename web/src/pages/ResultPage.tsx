import { Button } from 'antd-mobile'
import { Navigate, useNavigate, useParams } from 'react-router'
import { formatValidity } from '../domain/store'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Badge, Icon, Missing, Screen, Section, notifyError } from '../components/UI'

export function ResultPage() {
  const { taskId = '' } = useParams()
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const task = state.tasks.find(item => item.id === taskId)
  if (task?.reusedFromTaskId) return <Navigate to={`/completion/${task.id}`} replace />
  if (!task?.result) return <Missing title="考试结果尚未生成" />
  const course = store.course(task.courseId)
  const result = task.result
  const person = state.visits.find(visit => visit.id === task.visitId)?.subjects.find(item => item.id === task.subjectId)
  function retake() { try { store.retake(taskId); navigate(`/exam/${taskId}`) } catch (error) { notifyError(error) } }
  return <Screen title="考试结果" backTo={`/tasks/${task.visitId}?person=${task.subjectId}`}><div className={`result-hero ${result.passed ? 'passed' : 'failed'}`}><span className="result-symbol">{result.passed ? '✓' : '!'}</span><h1>{result.passed ? '考试通过' : '继续努力，再试一次'}</h1><p>{person?.name} · {course.title}</p>{result.timedOut && <Badge tone="orange">到期自动交卷</Badge>}</div><div className="card score-card"><div><p>本次成绩</p><strong>{result.score}</strong><span>分</span></div><div><p>及格分数</p><b>80</b><span>分</span></div></div><div className="result-summary"><span>答对 <strong className="green-text">{5 - result.wrongIds.length}</strong> 题</span><span>答错 <strong className="danger">{result.wrongIds.length}</strong> 题</span><span>共 5 题</span></div>
    {result.passed && <p className="info-banner mb-3">{store.isTrainingValid(task) ? `有效至 ${formatValidity(task.validUntil!)}` : '此结果已过期，请返回任务页查看当前培训要求。'}</p>}
    {result.passed ? <Button block color="primary" onClick={() => navigate(`/completion/${taskId}`)}>查看培训凭证</Button> : <Button block color="primary" onClick={retake}>重新考试</Button>}<Button block className="mt-3" onClick={() => navigate(`/tasks/${task.visitId}?person=${task.subjectId}`)}>返回培训任务</Button>
    {result.wrongIds.length > 0 && <Section title="错题解析" subtitle="视频进度已保留，理解后可以重新考试">{course.questions.filter(question => result.wrongIds.includes(question.id)).map((question, index) => <article className="card explanation-card" key={question.id}><Badge tone="orange">错题 {index + 1}</Badge><h3>{question.title}</h3><p className="danger small">你的答案：{result.answers[question.id] === undefined ? '未作答' : question.options[result.answers[question.id]]}</p><p className="green-text small">正确答案：{'ABCD'[question.correct]}. {question.options[question.correct]}</p><p className="explanation-text">{question.explanation}</p></article>)}</Section>}
  </Screen>
}

export function CompletionPage() {
  const { taskId = '' } = useParams()
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const task = state.tasks.find(item => item.id === taskId)
  if (!task || task.completedAt === undefined || (!task.result?.passed && !task.reusedFromTaskId)) return <Missing title="培训尚未完成" />
  const course = store.course(task.courseId)
  const person = state.visits.find(visit => visit.id === task.visitId)?.subjects.find(item => item.id === task.subjectId)
  const valid = store.isTrainingValid(task)
  const reused = !!task.reusedFromTaskId
  return <Screen title="培训完成" backTo={`/tasks/${task.visitId}?person=${task.subjectId}`}>
    <div className="certificate"><span className="certificate-icon"><Icon name="shield" size={52} /></span><span className="eyebrow">SAFETY TRAINING</span><h1>安全培训完成凭证</h1><strong className="certificate-name">{person?.name}</strong><p>{course.title}</p><div className="certificate-rule" />
      <Badge tone={valid ? 'green' : 'orange'}>{valid ? '培训结果有效' : '培训结果已过期'}</Badge>
      {reused ? <div className="summary-row"><span>培训方式</span><b className="green-text">{valid ? '有效期内免训' : '历史免训（已过期）'}</b></div> : <><div className="summary-row"><span>视频学习</span><b className="green-text">全部完成</b></div><div className="summary-row"><span>考试成绩</span><b className="green-text">{task.result!.score} 分 · 通过</b></div></>}
      <div className="summary-row"><span>{reused ? '上次通过' : '完成时间'}</span><span>{formatValidity(task.completedAt)}</span></div><div className="summary-row"><span>有效截止</span><span>{formatValidity(task.validUntil!)}</span></div>
      {reused && <p className="small mt-3">已关联本人历史合格结果，本次未重复学习或考试。</p>}
      <span className="certificate-seal">✓</span>
    </div>
    <p className="center muted small my-5">本凭证记录课程完成情况，进厂须遵守现场安排。</p><Button block color="primary" onClick={() => navigate(`/tasks/${task.visitId}?person=${task.subjectId}`)}>返回培训任务</Button><Button block className="mt-3" onClick={() => navigate(`/records/${task.visitId}`)}>查看申请记录</Button>
    {reused && <Button block fill="none" color="primary" className="mt-3" onClick={() => navigate(`/result/${task.reusedFromTaskId}`)}>查看上次培训结果</Button>}
  </Screen>
}
