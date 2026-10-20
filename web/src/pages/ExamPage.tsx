import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, ProgressBar, Toast } from 'antd-mobile'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { correctAnswer } from '../domain/store'
import { ApplicationNotice } from '../components/ApplicationNotice'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Actions, Badge, Missing, Screen, notifyError } from '../components/UI'

export function ExamPage() {
  const { taskId = '' } = useParams()
  const [params] = useSearchParams()
  const visitId = params.get('visit')
  const suffix = visitId ? `?visit=${encodeURIComponent(visitId)}` : ''
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const task = state.tasks.find(item => item.id === taskId)
  const [current, setCurrent] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [submitting, setSubmitting] = useState(false)
  const automatic = useRef(false)
  useEffect(() => {
    if (!task) return
    if (task.completedAt !== undefined && !store.isTrainingValid(task)) { navigate(store.taskHome(taskId, visitId), { replace: true }); return }
    if (store.isTrainingValid(task)) {
      const exempt = state.visits.some(visit => visit.id === visitId && visit.exemptTaskIds.includes(task.id))
      navigate(`${exempt ? '/completion' : '/result'}/${task.id}${suffix}`, { replace: true })
      return
    }
    if (!task.attempt) { navigate(`${task.result ? `/result/${task.id}` : `/learn/${task.id}`}${suffix}`, { replace: true }); return }
    const tick = () => {
      setNow(Date.now())
      if (Date.now() >= task.attempt!.deadlineAt && !automatic.current) {
        automatic.current = true
        try { store.submitExam(taskId); navigate(`/result/${taskId}${suffix}`, { replace: true }) } catch (error) { notifyError(error) }
      }
    }
    tick(); const timer = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [task?.id, task?.attempt?.deadlineAt, navigate, store, taskId, visitId, suffix])
  if (!task) return <Missing title="培训任务不存在" />
  if (!task.attempt) return null
  const course = task.courseSnapshot
  const question = course.questions[current]
  const answers = task.attempt.answers
  const seconds = Math.max(0, Math.ceil((task.attempt.deadlineAt - now) / 1000))
  const selected = answers[question.id] || []
  const person = state.participants.find(item => item.id === task.subjectId)
  const visit = state.visits.find(item => item.id === visitId && item.taskIds.includes(taskId))
  function choose(answer: number) {
    try {
      const values = question.kind === 'multiple' ? selected.includes(answer) ? selected.filter(index => index !== answer) : [...selected, answer] : [answer]
      store.answer(taskId, question.id, values)
      if (question.kind === 'single') { if (!correctAnswer(question, values)) Toast.show('回答错误，可返回修改'); if (current < course.questions.length - 1) setCurrent(current + 1) }
    } catch (error) { notifyError(error) }
  }
  async function submit() {
    if (seconds && course.questions.some(item => answers[item.id] === undefined)) { Toast.show('还有题目未作答，请完成后交卷'); return }
    if (!await Dialog.confirm({ title: '确认提交试卷？', content: '提交后立即评分，请确认所有答案。', confirmText: '确认交卷', cancelText: '继续答题' })) return
    setSubmitting(true)
    try { store.submitExam(taskId); navigate(`/result/${taskId}${suffix}`, { replace: true }) } catch (error) { notifyError(error); setSubmitting(false) }
  }
  const content = <Screen title="在线考试" backTo={store.taskHome(taskId, visitId)}><div className="exam-subject"><strong>{person?.name}</strong><span>{course.title}</span></div><div className="exam-status"><strong>{current + 1}<span> / {course.questions.length}</span></strong><span className={seconds < 60 ? 'danger' : ''}>剩余时间 <b>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</b></span></div><ProgressBar percent={Object.keys(answers).length / course.questions.length * 100} />
    <section className="question-card"><Badge tone="orange">{question.kind === 'multiple' ? '多选题' : '单选题'} · 每题 20 分</Badge><h1>{question.title}</h1><div className="answer-options">{question.options.map((option, index) => <button type="button" key={option} disabled={seconds === 0} aria-label={`${'ABCD'[index]}. ${option}`} aria-pressed={selected.includes(index)} className={`answer-option ${selected.includes(index) ? 'selected' : ''}`} onClick={() => choose(index)}><span className="answer-radio">{selected.includes(index) ? '✓' : ''}</span><span>{'ABCD'[index]}. {option}</span></button>)}</div></section>
    <section className="card answer-card"><div className="flex justify-between"><h2>答题卡</h2><span className="muted small">已答 {Object.keys(answers).length} / {course.questions.length}</span></div><div className="question-numbers">{course.questions.map((item, index) => <button type="button" aria-label={`第${index + 1}题`} key={item.id} className={`${current === index ? 'current' : ''} ${answers[item.id] === undefined ? '' : item.kind === 'multiple' || correctAnswer(item, answers[item.id]) ? 'answered' : 'incorrect'}`} onClick={() => setCurrent(index)}>{index + 1}</button>)}</div><p className="muted small">点击题号查看或修改答案，按最终答案评分。</p></section>
    <p className="center muted small mt-4">{course.passScore} 分通过 · 离开页面不会重置截止时间</p><Actions><Button className="flex-1" disabled={current === 0} onClick={() => setCurrent(current - 1)}>上一题</Button><Button className="flex-[2]" color="primary" loading={submitting} onClick={() => current === course.questions.length - 1 ? submit() : setCurrent(current + 1)}>{current === course.questions.length - 1 ? '提交试卷' : '下一题'}</Button></Actions>
  </Screen>
  return visit ? <ApplicationNotice visit={visit}>{content}</ApplicationNotice> : content
}
