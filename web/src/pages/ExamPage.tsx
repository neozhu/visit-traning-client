import { useEffect, useRef, useState } from 'react'
import { Button, Dialog, ProgressBar, Toast } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Actions, Badge, Missing, Screen, notifyError } from '../components/UI'

export function ExamPage() {
  const { taskId = '' } = useParams()
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const task = state.tasks.find(item => item.id === taskId)
  const [current, setCurrent] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [submitting, setSubmitting] = useState(false)
  const automatic = useRef(false)
  useEffect(() => {
    if (!task) return
    if (!store.currentTasks(task.visitId).some(item => item.id === task.id)) { navigate(`/tasks/${task.visitId}?person=${task.subjectId}`, { replace: true }); return }
    if (store.isTrainingValid(task)) { navigate(task.reusedFromTaskId ? `/completion/${task.id}` : `/result/${task.id}`, { replace: true }); return }
    if (!task.attempt) { navigate(task.result ? `/result/${task.id}` : `/learn/${task.id}`, { replace: true }); return }
    const tick = () => {
      setNow(Date.now())
      if (Date.now() >= task.attempt!.deadlineAt && !automatic.current) {
        automatic.current = true
        try { store.submitExam(taskId); navigate(`/result/${taskId}`, { replace: true }) } catch (error) { notifyError(error) }
      }
    }
    tick(); const timer = setInterval(tick, 1000)
    document.addEventListener('visibilitychange', tick)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick) }
  }, [task?.id, task?.attempt?.deadlineAt, navigate, store, taskId])
  if (!task) return <Missing title="培训任务不存在" />
  if (!task.attempt) return null
  const course = store.course(task.courseId)
  const question = course.questions[current]
  const answers = task.attempt.answers
  const seconds = Math.max(0, Math.ceil((task.attempt.deadlineAt - now) / 1000))
  const selected = answers[question.id]
  const person = state.visits.find(visit => visit.id === task.visitId)?.subjects.find(item => item.id === task.subjectId)
  function choose(answer: number) {
    try { store.answer(taskId, question.id, answer); if (answer !== question.correct) Toast.show('回答错误，可返回修改'); if (current < course.questions.length - 1) setCurrent(current + 1) } catch (error) { notifyError(error) }
  }
  async function submit() {
    if (seconds && course.questions.some(item => answers[item.id] === undefined)) { Toast.show('还有题目未作答，请完成后交卷'); return }
    if (!await Dialog.confirm({ title: '确认提交试卷？', content: '提交后立即评分，请确认所有答案。', confirmText: '确认交卷', cancelText: '继续答题' })) return
    setSubmitting(true)
    try { store.submitExam(taskId); navigate(`/result/${taskId}`, { replace: true }) } catch (error) { notifyError(error); setSubmitting(false) }
  }
  return <Screen title="在线考试" backTo={`/tasks/${task.visitId}?person=${task.subjectId}`}><div className="exam-subject"><strong>{person?.name}</strong><span>{course.title}</span></div><div className="exam-status"><strong>{current + 1}<span> / {course.questions.length}</span></strong><span className={seconds < 60 ? 'danger' : ''}>剩余时间 <b>{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</b></span></div><ProgressBar percent={Object.keys(answers).length / course.questions.length * 100} />
    <section className="question-card"><Badge tone="orange">单选题 · 每题 20 分</Badge><h1>{question.title}</h1><div className="answer-options">{question.options.map((option, index) => <button type="button" key={option} disabled={seconds === 0} aria-label={`${'ABCD'[index]}. ${option}`} className={`answer-option ${selected === index ? 'selected' : ''}`} onClick={() => choose(index)}><span className="answer-radio">{selected === index ? '✓' : ''}</span><span>{'ABCD'[index]}. {option}</span></button>)}</div></section>
    <section className="card answer-card"><div className="flex justify-between"><h2>答题卡</h2><span className="muted small">已答 {Object.keys(answers).length} / {course.questions.length}</span></div><div className="question-numbers">{course.questions.map((item, index) => <button type="button" aria-label={`第${index + 1}题`} key={item.id} className={`${current === index ? 'current' : ''} ${answers[item.id] === undefined ? '' : answers[item.id] === item.correct ? 'answered' : 'incorrect'}`} onClick={() => setCurrent(index)}>{index + 1}</button>)}</div><p className="muted small">点击题号查看或修改答案，按最终答案评分。</p></section>
    <p className="center muted small mt-4">80 分通过 · 离开页面不会重置截止时间</p><Actions><Button className="flex-1" disabled={current === 0} onClick={() => setCurrent(current - 1)}>上一题</Button><Button className="flex-[2]" color="primary" loading={submitting} onClick={() => current === course.questions.length - 1 ? submit() : setCurrent(current + 1)}>{current === course.questions.length - 1 ? '提交试卷' : '下一题'}</Button></Actions>
  </Screen>
}
