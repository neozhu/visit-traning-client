import { t } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, ProgressBar, Toast } from 'antd-mobile'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { ApplicationNotice } from '../components/ApplicationNotice'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Actions, Badge, Missing, Screen, notifyError } from '../components/UI'
import { getApiStore } from '../domain/apiStore'
import { trainingSuffix, useApiRoute } from '../domain/apiRoute'

export function ExamPage() {
  const { access } = useApiRoute()
  const { taskId = '' } = useParams()
  const [params] = useSearchParams()
  const visitId = params.get('visit')
  const suffix = trainingSuffix(visitId, access)
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const task = state.tasks.find(item => item.id === taskId)
  const [current, setCurrent] = useState(0)
  const [now, setNow] = useState(() => store.now())
  const [submitting, setSubmitting] = useState(false)
  const [edits, setEdits] = useState<Record<string, number[]>>({})
  const pendingEdits = useRef<Record<string, number[]>>({})
  const saves = useRef(new Set<Promise<void>>())
  const automatic = useRef(false)
  useEffect(() => { setCurrent(0); pendingEdits.current = {}; setEdits({}); automatic.current = false }, [taskId, task?.attempt?.id])
  useEffect(() => {
    if (visitId && store.requiresNotice(visitId)) return
    if (!task) return
    if (task.completedAt !== undefined && !store.isTrainingValid(task)) { navigate(store.taskHome(taskId, visitId), { replace: true }); return }
    if (store.isTrainingValid(task)) {
      const exempt = state.visits.some(visit => visit.id === visitId && visit.exemptTaskIds.includes(task.id))
      navigate(`${exempt ? '/completion' : '/result'}/${task.id}${suffix}`, { replace: true })
      return
    }
    if (!task.attempt) { navigate(`${task.result ? `/result/${task.id}` : `/learn/${task.id}`}${suffix}`, { replace: true }); return }
    const tick = () => {
      const currentTime = store.now()
      setNow(currentTime)
      if (currentTime >= task.attempt!.deadlineAt && !automatic.current) {
        automatic.current = true
        void getApiStore().loadTraining(taskId, visitId, access, true).then(() => {
          if (store.task(taskId)?.result && !store.task(taskId)?.attempt) navigate(`/result/${taskId}${suffix}`, { replace: true })
        }).catch(notifyError)
      }
    }
    const visible = () => { if (!document.hidden) { automatic.current = false; tick() } }
    tick(); const timer = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', visible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', visible) }
  }, [task?.id, task?.attempt?.deadlineAt, navigate, store, taskId, visitId, suffix, access])
  if (visitId && store.requiresNotice(visitId)) return <Navigate to={`/tasks/${visitId}${access === 'participant' ? '?access=participant' : ''}`} state={{ resumeTraining: `/exam/${taskId}${suffix}` }} replace />
  if (!task) return <Missing title={t('培训任务不存在')} />
  if (!task.attempt) return null
  const course = task.courseSnapshot
  const question = course.questions[current]
  const answers = { ...task.attempt.answers, ...edits }
  const seconds = Math.max(0, Math.ceil((task.attempt.deadlineAt - now) / 1000))
  const selected = answers[question.id] || []
  const person = state.participants.find(item => item.id === task.subjectId)
  const visit = state.visits.find(item => item.id === visitId && item.taskIds.includes(taskId))
  function answerCardState(item: typeof question) {
    const selection = answers[item.id] || []
    if (!selection.length) return ''
    if (item.correctIndexes.length && (selection.length !== item.correctIndexes.length || item.correctIndexes.some(index => !selection.includes(index)))) return 'incorrect'
    return 'answered'
  }
  async function choose(answer: number) {
    const previous = pendingEdits.current[question.id] || selected
    const values = question.kind === 'multiple' ? previous.includes(answer) ? previous.filter(index => index !== answer) : [...previous, answer] : [answer]
    pendingEdits.current = { ...pendingEdits.current, [question.id]: values }
    setEdits(pendingEdits.current)
    const save = (async () => {
      try {
        await store.answer(taskId, question.id, values)
        if (pendingEdits.current[question.id] === values) {
          const next = { ...pendingEdits.current }; delete next[question.id]
          pendingEdits.current = next; setEdits(next)
          if (question.kind === 'single' && current < course.questions.length - 1) setCurrent(current + 1)
        }
      } catch (error) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 412) { pendingEdits.current = {}; setEdits({}) }
        notifyError(error)
      }
    })()
    saves.current.add(save)
    try { await save } finally { saves.current.delete(save) }
  }
  async function submit() {
    if (seconds && course.questions.some(item => !answers[item.id]?.length)) { Toast.show(t('还有题目未作答，请完成后交卷')); return }
    if (!await Dialog.confirm({ title: t('确认提交试卷？'), content: t('提交后立即评分，请确认所有答案。'), confirmText: t('确认交卷'), cancelText: t('继续答题') })) return
    setSubmitting(true)
    try {
      await Promise.all(saves.current)
      if (Object.keys(pendingEdits.current).length) { Toast.show(t('有答案尚未保存，请重试选择后再交卷')); setSubmitting(false); return }
      await store.submitExam(taskId); navigate(`/result/${taskId}${suffix}`, { replace: true })
    } catch (error) { notifyError(error); setSubmitting(false) }
  }
  const content = <Screen title={t('在线考试')} backTo={store.taskHome(taskId, visitId)}><div className="exam-subject"><strong>{person?.name}</strong><span>{course.title}</span></div><div className="exam-status"><strong>{current + 1}<span> / {course.questions.length}</span></strong><span className={seconds < 60 ? 'danger' : ''}>{t('剩余时间')}<b>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</b></span></div><ProgressBar percent={Object.values(answers).filter(values => values.length).length / course.questions.length * 100} />
    <section className="question-card"><Badge tone="orange">{t('{0} · 每题 20 分', { 0: question.kind === 'multiple' ? t('多选题') : t('单选题') })}</Badge><h1>{question.title}</h1><div className="answer-options">{question.options.map((option, index) => <button type="button" key={option} disabled={seconds === 0 || submitting} aria-label={`${'ABCD'[index]}. ${option}`} aria-pressed={selected.includes(index)} className={`answer-option ${selected.includes(index) ? 'selected' : ''}`} onClick={() => choose(index)}><span className={`answer-radio ${question.kind === 'multiple' ? 'answer-checkbox' : ''}`} aria-hidden="true">{selected.includes(index) ? question.kind === 'multiple' ? '✓' : '●' : ''}</span><span>{'ABCD'[index]}. {option}</span></button>)}</div></section>
    <section className="card answer-card"><div className="flex justify-between"><h2>{t('答题卡')}</h2><span className="muted small">{t('已答 {0} / {1}', { 0: Object.values(answers).filter(values => values.length).length, 1: course.questions.length })}</span></div><div className="question-numbers">{course.questions.map((item, index) => <button type="button" aria-label={t('第{0}题', { 0: index + 1 })} key={item.id} className={`${current === index ? 'current' : ''} ${answerCardState(item)}`} onClick={() => setCurrent(index)}>{index + 1}</button>)}</div><p className="muted small">{t('点击题号修改答案，红色题目请检查后再交卷。')}</p></section>
    <p className="center muted small mt-4">{t('{0} 分通过 · 离开页面不会重置截止时间', { 0: course.passScore })}</p><Actions><Button className="flex-1" disabled={current === 0} onClick={() => setCurrent(current - 1)}>{t('上一题')}</Button><Button className="flex-[2]" color="primary" loading={submitting} onClick={() => current === course.questions.length - 1 ? submit() : setCurrent(current + 1)}>{current === course.questions.length - 1 ? t('提交试卷') : t('下一题')}</Button></Actions>
  </Screen>
  return visit ? <ApplicationNotice visit={visit}>{content}</ApplicationNotice> : content
}
