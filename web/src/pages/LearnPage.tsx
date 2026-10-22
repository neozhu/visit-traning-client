import { t } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { Button } from 'antd-mobile'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApplicationNotice } from '../components/ApplicationNotice'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Actions, Badge, Icon, Missing, Screen, Section, notifyError } from '../components/UI'
import { getApiStore } from '../domain/apiStore'
import { trainingSuffix, useApiRoute } from '../domain/apiRoute'

function duration(seconds?: number) { return seconds ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : t('以视频为准') }

export function LearnPage() {
  const { access } = useApiRoute()
  const { taskId = '' } = useParams()
  const [params] = useSearchParams()
  const visitId = params.get('visit')
  const suffix = trainingSuffix(visitId, access)
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const task = state.tasks.find(item => item.id === taskId)
  const course = task?.courseSnapshot
  const [selected, setSelected] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const maxPosition = useRef(0)
  const lesson = course?.lessons[selected]
  useEffect(() => {
    setPlaying(false); setError(false); maxPosition.current = 0
  }, [taskId, lesson?.id])
  useEffect(() => {
    const hide = () => { if (document.hidden) video.current?.pause() }
    document.addEventListener('visibilitychange', hide)
    return () => { document.removeEventListener('visibilitychange', hide) }
  }, [])
  if (visitId && store.requiresNotice(visitId)) return <Navigate to={`/tasks/${visitId}${access === 'participant' ? '?access=participant' : ''}`} state={{ resumeTraining: `/learn/${taskId}${suffix}` }} replace />
  if (!task || !course || !lesson) return <Missing title={t('培训任务不存在')} />
  if (task.completedAt !== undefined && !store.isTrainingValid(task)) return <Navigate to={store.taskHome(taskId, visitId)} replace />
  if (store.isTrainingValid(task)) return <Navigate to={`/completion/${task.id}${suffix}`} replace />
  const person = state.participants.find(item => item.id === task.subjectId)!
  const visit = state.visits.find(item => item.id === visitId && item.taskIds.includes(taskId))
  const watched = task.completedLessons.includes(lesson.id)
  const allDone = course.lessons.every(item => task.completedLessons.includes(item.id))
  async function play() {
    try { await video.current?.play() } catch { setError(true) }
  }
  async function beginExam() {
    try { await store.beginExam(taskId); navigate(`/exam/${taskId}${suffix}`) } catch (issue) { notifyError(issue) }
  }
  async function refreshMedia() {
    setRefreshing(true)
    try { await getApiStore().loadTraining(taskId, visitId, access, true); setError(false); video.current?.load() } catch (issue) { notifyError(issue) } finally { setRefreshing(false) }
  }
  const content = <Screen title={t('视频学习')} backTo={store.taskHome(taskId, visitId)}><div className="learning-person"><span className="mini-avatar"><Icon name="user" size={20} /></span><span><strong>{person.name}</strong><span className="muted small">{t(' · 本人课程')}</span></span><Badge tone={allDone ? 'green' : 'blue'}>{t('{0}/{1} 视频完成', { 0: task.completedLessons.length, 1: course.lessons.length })}</Badge></div><h1 className="course-title">{course.title}</h1><p className="muted small mb-4">{t('完整观看所有视频后，可开始在线考试')}</p>
    <div className="video-wrap"><video key={lesson.id} ref={video} src={lesson.source} poster="/assets/lesson-cover.png" controls playsInline preload="metadata" onError={() => setError(true)} onPlay={async () => { setPlaying(true); try { await store.startLearning(taskId) } catch (issue) { video.current?.pause(); notifyError(issue) } }} onPause={() => setPlaying(false)} onTimeUpdate={event => { const player = event.currentTarget; if (!watched && player.currentTime > maxPosition.current + 1.8) { player.currentTime = maxPosition.current; return }; maxPosition.current = Math.max(maxPosition.current, player.currentTime) }} onEnded={async event => { if (maxPosition.current + 1.8 < event.currentTarget.duration) return; try { await store.completeLesson(taskId, lesson.id) } catch (issue) { notifyError(issue) } }} />{!playing && !watched && !error && <button type="button" className="video-play" aria-label={t('播放视频')} onClick={play}><span aria-hidden="true">▶</span></button>}</div>
    {error && !watched && <div className="info-banner video-error"><p>{t('视频暂时无法播放，请重新加载或刷新播放地址。')}</p><div className="flex gap-2"><Button size="small" onClick={() => { setError(false); video.current?.load() }}>{t('重新加载')}</Button><Button size="small" color="primary" disabled={refreshing} onClick={refreshMedia}>{refreshing ? t('刷新中…') : t('刷新播放地址')}</Button></div></div>}
    <Section title={lesson.title}><div className="card lesson-description"><p>{lesson.description}</p><span className="muted small">{t('视频时长 ·')}{duration(lesson.durationSeconds)}</span></div></Section>
    <Section title={t('课程视频')} subtitle={t('共 {0} 段', { 0: course.lessons.length })}>{course.lessons.map((item, index) => <button type="button" className={`lesson-row ${selected === index ? 'selected' : ''}`} key={item.id} onClick={() => { video.current?.pause(); setSelected(index) }}><span className="lesson-number">{index + 1}</span><span className="flex-1">{item.title}<small>{duration(item.durationSeconds)}</small></span><span className={task.completedLessons.includes(item.id) ? 'green-text' : 'muted'}>{task.completedLessons.includes(item.id) ? t('✓ 已完成') : t('待学习')}</span></button>)}</Section>
    <Actions><Button block className="flex-1" color="primary" disabled={!allDone} onClick={task.result?.passed ? () => navigate(`/result/${task.id}${suffix}`) : beginExam}>{task.result?.passed ? t('查看考试结果') : t('开始考试')}</Button></Actions>
  </Screen>
  return visit ? <ApplicationNotice visit={visit}>{content}</ApplicationNotice> : content
}
