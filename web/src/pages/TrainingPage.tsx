import { useState } from 'react'
import { Button, Input } from 'antd-mobile'
import { useNavigate } from 'react-router'
import { ENTRIES, maskPhone } from '../domain/store'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Badge, FieldError, Icon, Screen, Section } from '../components/UI'

export function TrainingPage() {
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [matches, setMatches] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  function search() {
    try { setMatches(store.pendingTasks(name, phone).map(task => task.id)); setError('') } catch (issue) { setError(issue instanceof Error ? issue.message : '查询失败'); setMatches(null) }
  }
  const tasks = store.currentTasks().filter(task => matches?.includes(task.id) && !store.isTrainingValid(task))
  const visits = state.visits.filter(visit => tasks.some(task => task.visitId === visit.id))
  return <Screen title="学习培训"><div className="query-heading"><span className="entry-icon blue"><Icon name="book-home" size={32} /></span><h1>继续你的安全培训</h1><p>填写登记时的姓名与手机号<br />找到属于你的课程，接着上次继续学习</p></div>
    <form className="card form-card" onSubmit={event => { event.preventDefault(); search() }}><label className="field"><span>登记姓名</span><Input aria-label="登记姓名" placeholder="请输入登记时的姓名" value={name} onChange={setName} maxLength={30} /></label><label className="field"><span>手机号码</span><Input aria-label="手机号码" placeholder="请输入登记时的11位手机号" value={phone} onChange={setPhone} type="tel" maxLength={11} /></label><FieldError message={error} /><Button block color="primary" type="submit">查找培训任务</Button></form>
    {matches !== null && <Section title="你的待完成培训" subtitle={`找到 ${visits.length} 张申请，${tasks.length} 门课程`}>{visits.length ? visits.map(visit => {
      const person = visit.subjects.find(subject => tasks.some(task => task.visitId === visit.id && task.subjectId === subject.id))!
      const courses = tasks.filter(task => task.visitId === visit.id && task.subjectId === person.id)
      return <button type="button" className="card query-result" key={visit.id} onClick={() => navigate(`/tasks/${visit.id}?person=${person.id}`)}><div className="flex justify-between items-center"><strong>{ENTRIES[visit.type].label}</strong><Badge>{courses.length} 门待完成</Badge></div><p className="muted small">预约 {visit.appointmentDate}</p><p>{person.name} · {maskPhone(person.phone)}</p><p className="muted small">{courses.map(task => store.course(task.courseId).title).join('、')}</p><span className="link-label">继续学习 <span aria-hidden="true">→</span></span></button>
    }) : <div className="card empty-copy"><Icon name="search" size={36} /><h3>没有找到待完成任务</h3><p>请核对登记姓名和手机号。有效期内已通过或免训的课程无需重复学习。</p></div>}</Section>}
    <div className="query-tip"><Icon name="shield" size={18} /><p>仅查询当前浏览器保存的申请；姓名与手机号需同时匹配。</p></div>
  </Screen>
}
