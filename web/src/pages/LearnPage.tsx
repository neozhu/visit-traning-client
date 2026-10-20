import { useEffect, useRef, useState } from 'react'
import { Button, ProgressBar } from 'antd-mobile'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApplicationNotice } from '../components/ApplicationNotice'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Actions, Badge, Icon, Missing, Screen, Section, notifyError } from '../components/UI'

export function LearnPage() {
  const { taskId = '' } = useParams()
  const [params] = useSearchParams()
  const visitId = params.get('visit')
  const suffix = visitId ? `?visit=${encodeURIComponent(visitId)}` : ''
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const task = state.tasks.find(item => item.id === taskId)
  const course = task?.courseSnapshot
  const [selected, setSelected] = useState(0)
  const [progress, setProgress] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [error, setError] = useState(false)
  const [fallback, setFallback] = useState<number | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const maxPosition = useRef(0)
  const lesson = course?.lessons[selected]
  const fallbackKey = `visitsafe.web.v3.video.${taskId}.${lesson?.id}`
  useEffect(() => {
    setProgress(0); setPlaying(false); setError(false); maxPosition.current = 0
    const deadline = Number(sessionStorage.getItem(fallbackKey))
    setFallback(deadline || null)
  }, [fallbackKey])
  useEffect(() => {
    if (!fallback || !lesson || !task) return
    function tick() {
      setProgress(Math.min(100, Math.max(0, (1 - (fallback! - Date.now()) / 6000) * 100)))
      if (Date.now() >= fallback!) {
        try { store.completeLesson(taskId, lesson!.id); sessionStorage.removeItem(fallbackKey); setFallback(null) } catch (issue) { setFallback(null); notifyError(issue) }
      }
    }
    tick(); const timer = setInterval(tick, 250)
    return () => clearInterval(timer)
  }, [fallback, fallbackKey, lesson?.id, taskId, store])
  useEffect(() => {
    const hide = () => { if (document.hidden) video.current?.pause() }
    document.addEventListener('visibilitychange', hide)
    return () => { document.removeEventListener('visibilitychange', hide) }
  }, [])
  if (!task || !course || !lesson) return <Missing title="培训任务不存在" />
  if (task.completedAt !== undefined && !store.isTrainingValid(task)) return <Navigate to={store.taskHome(taskId, visitId)} replace />
  if (store.isTrainingValid(task)) return <Navigate to={`/completion/${task.id}${suffix}`} replace />
  const person = state.participants.find(item => item.id === task.subjectId)!
  const visit = state.visits.find(item => item.id === visitId && item.taskIds.includes(taskId))
  const watched = task.completedLessons.includes(lesson.id)
  const allDone = course.lessons.every(item => task.completedLessons.includes(item.id))
  async function play() {
    try { await video.current?.play() } catch { setError(true) }
  }
  function beginExam() {
    try { store.beginExam(taskId); navigate(`/exam/${taskId}${suffix}`) } catch (issue) { notifyError(issue) }
  }
  const content = <Screen title="视频学习" backTo={store.taskHome(taskId, visitId)}><div className="learning-person"><span className="mini-avatar"><Icon name="user" size={20} /></span><span><strong>{person.name}</strong><span className="muted small"> · 本人课程</span></span><Badge tone={allDone ? 'green' : 'blue'}>{task.completedLessons.length}/{course.lessons.length} 视频完成</Badge></div><h1 className="course-title">{course.title}</h1><p className="muted small mb-4">完整观看所有视频后，可开始在线考试</p>
    <div className="video-wrap"><video key={lesson.id} ref={video} src={lesson.source} poster="/assets/lesson-cover.png" controls playsInline preload="metadata" onError={() => setError(true)} onPlay={() => { setPlaying(true); try { store.startLearning(taskId) } catch (issue) { video.current?.pause(); notifyError(issue) } }} onPause={() => setPlaying(false)} onTimeUpdate={event => { const player = event.currentTarget; if (!watched && player.currentTime > maxPosition.current + 1.8) { player.currentTime = maxPosition.current; return }; maxPosition.current = Math.max(maxPosition.current, player.currentTime); setProgress(player.duration ? player.currentTime / player.duration * 100 : 0) }} onEnded={event => { if (maxPosition.current + 1.8 < event.currentTarget.duration) return; try { store.completeLesson(taskId, lesson.id); setProgress(100) } catch (issue) { notifyError(issue) } }} />{!playing && !watched && !error && <button type="button" className="video-play" aria-label="播放视频" onClick={play}><span aria-hidden="true">▶</span></button>}</div>
    <div className="video-progress"><ProgressBar percent={watched ? 100 : progress} /><span>{watched ? '已完成观看' : `${Math.round(progress)}%`}</span></div>
    {error && !watched && <div className="info-banner video-error"><p>视频暂时无法播放，请重试。演示时也可使用计时完成本段。</p><div className="flex gap-2"><Button size="small" onClick={() => { setError(false); video.current?.load() }}>重新加载</Button><Button size="small" color="primary" disabled={!!fallback} onClick={() => { const deadline = Date.now() + 6000; try { store.startLearning(taskId); sessionStorage.setItem(fallbackKey, String(deadline)); setFallback(deadline) } catch (issue) { notifyError(issue) } }}>{fallback ? '演示计时中…' : '开启演示计时'}</Button></div></div>}
    <Section title={lesson.title}><div className="card lesson-description"><p>{lesson.description}</p><span className="muted small">演示短片 · 00:06</span></div></Section>
    <Section title="课程视频" subtitle={`共 ${course.lessons.length} 段`}>{course.lessons.map((item, index) => <button type="button" className={`lesson-row ${selected === index ? 'selected' : ''}`} key={item.id} onClick={() => { video.current?.pause(); setSelected(index) }}><span className="lesson-number">{index + 1}</span><span className="flex-1">{item.title}<small>00:06</small></span><span className={task.completedLessons.includes(item.id) ? 'green-text' : 'muted'}>{task.completedLessons.includes(item.id) ? '✓ 已完成' : '待学习'}</span></button>)}</Section>
    <Actions><Button block className="flex-1" color="primary" disabled={!allDone} onClick={task.result?.passed ? () => navigate(`/result/${task.id}${suffix}`) : beginExam}>{task.result?.passed ? '查看考试结果' : '开始考试'}</Button></Actions>
  </Screen>
  return visit ? <ApplicationNotice visit={visit}>{content}</ApplicationNotice> : content
}
