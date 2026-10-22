import { t } from '../i18n'
import { Button } from 'antd-mobile'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { formatValidity } from '../domain/store'
import { ApplicationNotice } from '../components/ApplicationNotice'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Badge, Icon, Missing, Screen, Section, notifyError } from '../components/UI'
import { trainingSuffix, useApiRoute } from '../domain/apiRoute'

export function ResultPage() {
  const { access } = useApiRoute()
  const { taskId = '' } = useParams()
  const [params] = useSearchParams()
  const visitId = params.get('visit')
  const suffix = trainingSuffix(visitId, access)
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const task = state.tasks.find(item => item.id === taskId)
  if (visitId && store.requiresNotice(visitId)) return <Navigate to={`/tasks/${visitId}${access === 'participant' ? '?access=participant' : ''}`} state={{ resumeTraining: `/result/${taskId}${suffix}` }} replace />
  if (!task?.result) return <Missing title={t('考试结果尚未生成')} />
  const course = task.courseSnapshot
  const result = task.result
  const person = state.participants.find(item => item.id === task.subjectId)
  const visit = state.visits.find(item => item.id === visitId && item.taskIds.includes(taskId))
  async function retake() { try { await store.retake(taskId); navigate(`/exam/${taskId}${suffix}`) } catch (error) { notifyError(error) } }
  const content = <Screen title={t('考试结果')} backTo={store.taskHome(taskId, visitId)}><div className={`result-hero ${result.passed ? 'passed' : 'failed'}`}><span className="result-symbol">{result.passed ? '✓' : '!'}</span><h1>{result.passed ? t('考试通过') : t('继续努力，再试一次')}</h1><p>{person?.name} · {course.title}</p>{result.timedOut && <Badge tone="orange">{t('到期自动交卷')}</Badge>}</div><div className="card score-card"><div><p>{t('本次成绩')}</p><strong>{result.score}</strong><span>{t('分')}</span></div><div><p>{t('及格分数')}</p><b>{course.passScore}</b><span>{t('分')}</span></div></div><div className="result-summary"><span>{t('答对')}<strong className="green-text">{5 - result.wrongIds.length}</strong> {t('题')}</span><span>{t('答错')}<strong className="danger">{result.wrongIds.length}</strong> {t('题')}</span><span>{t('共 5 题')}</span></div>
    {result.passed && <p className="info-banner mb-3">{store.isTrainingValid(task) ? t('有效至 {0}', { 0: formatValidity(task.validUntil!) }) : t('此结果已过期，请返回任务页查看当前培训要求。')}</p>}
    {result.passed ? <Button block color="primary" onClick={() => navigate(`/completion/${taskId}${suffix}`)}>{t('查看培训凭证')}</Button> : <Button block color="primary" onClick={retake}>{t('重新考试')}</Button>}<Button block className="mt-3" onClick={() => navigate(store.taskHome(taskId, visitId))}>{t('返回培训任务')}</Button>
    {result.wrongIds.length > 0 && <Section title={t('错题解析')} subtitle={t('视频进度已保留，理解后可以重新考试')}>{course.questions.filter(question => result.wrongIds.includes(question.id)).map((question, index) => <article className="card explanation-card" key={question.id}><Badge tone="orange">{t('错题')}{index + 1}</Badge><h3>{question.title}</h3><p className="danger small">{t('你的答案：')}{!result.answers[question.id]?.length ? t('未作答') : result.answers[question.id].map(index => `${'ABCD'[index]}. ${question.options[index]}`).join('、')}</p><p className="green-text small">{t('正确答案：')}{question.correctIndexes.map(index => `${'ABCD'[index]}. ${question.options[index]}`).join('、')}</p><p className="explanation-text">{question.explanation}</p></article>)}</Section>}
  </Screen>
  return visit ? <ApplicationNotice visit={visit}>{content}</ApplicationNotice> : content
}

export function CompletionPage() {
  const { access } = useApiRoute()
  const { taskId = '' } = useParams()
  const [params] = useSearchParams()
  const visitId = params.get('visit')
  const suffix = trainingSuffix(visitId, access)
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const task = state.tasks.find(item => item.id === taskId)
  if (visitId && store.requiresNotice(visitId)) return <Navigate to={`/tasks/${visitId}${access === 'participant' ? '?access=participant' : ''}`} state={{ resumeTraining: `/completion/${taskId}${suffix}` }} replace />
  if (!task || task.completedAt === undefined || !task.result?.passed) return <Missing title={t('培训尚未完成')} />
  const course = task.courseSnapshot
  const person = state.participants.find(item => item.id === task.subjectId)
  const visit = state.visits.find(item => item.id === visitId && item.taskIds.includes(taskId))
  const valid = store.isTrainingValid(task)
  const reused = !!visit?.exemptTaskIds.includes(task.id)
  const content = <Screen title={t('培训完成')} backTo={store.taskHome(taskId, visitId)}>
    <div className="certificate"><span className="certificate-icon"><Icon name="shield" size={52} /></span><span className="eyebrow">SAFETY TRAINING</span><h1>{t('安全培训完成凭证')}</h1><strong className="certificate-name">{person?.name}</strong><p>{course.title}</p><div className="certificate-rule" />
      <Badge tone={valid ? 'green' : 'orange'}>{valid ? t('培训结果有效') : t('培训结果已过期')}</Badge>
      {reused && <div className="summary-row"><span>{t('本次申请')}</span><b className="green-text">{valid ? t('有效期内免训') : t('历史免训（已过期）')}</b></div>}<div className="summary-row"><span>{t('视频学习')}</span><b className="green-text">{t('全部完成')}</b></div><div className="summary-row"><span>{t('考试成绩')}</span><b className="green-text">{t('{0} 分 · 通过', { 0: task.result!.score })}</b></div>
      <div className="summary-row"><span>{reused ? t('上次通过') : t('完成时间')}</span><span>{formatValidity(task.completedAt)}</span></div><div className="summary-row"><span>{t('有效截止')}</span><span>{formatValidity(task.validUntil!)}</span></div>
      {reused && <p className="small mt-3">{t('已关联本人历史合格结果，本次未重复学习或考试。')}</p>}
      <span className="certificate-seal">✓</span>
    </div>
    <p className="center muted small my-5">{t('本凭证记录课程完成情况，进厂须遵守现场安排。')}</p><Button block color="primary" onClick={() => navigate(store.taskHome(taskId, visitId))}>{t('返回培训任务')}</Button>{visit && <Button block className="mt-3" onClick={() => navigate(`/records/${visit.id}${access === 'participant' ? '?access=participant' : ''}`)}>{t('查看申请记录')}</Button>}
    <Button block fill="none" color="primary" className="mt-3" onClick={() => navigate(`/result/${task.id}${suffix}`)}>{t('查看实际培训结果')}</Button>
  </Screen>
  return visit ? <ApplicationNotice visit={visit}>{content}</ApplicationNotice> : content
}
