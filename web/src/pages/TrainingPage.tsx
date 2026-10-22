import { t } from '../i18n'
import { useState } from 'react'
import { Button, Input } from 'antd-mobile'
import { useNavigate } from 'react-router'
import { ENTRIES, maskPhone } from '../domain/store'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Badge, FieldError, Icon, Screen, Section } from '../components/UI'
import { resetApiRoutes, useApiRoute } from '../domain/apiRoute'

export function TrainingPage() {
  useApiRoute()
  const { store } = useVisitSafe()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [matches, setMatches] = useState<string[] | null>(null)
  const [error, setError] = useState('')
  async function search() {
    try { const tasks = await store.pendingTasks(name, phone); resetApiRoutes(); setMatches(tasks.map(task => task.id)); setError('') } catch (issue) { setError(issue instanceof Error ? issue.message : t('查询失败')); setMatches(null) }
  }
  const tasks = store.currentTasks().filter(task => matches?.includes(task.id) && !store.isTrainingValid(task))
  return <Screen title={t('学习培训')}><div className="query-heading"><span className="entry-icon blue"><Icon name="book-home" size={32} /></span><h1>{t('继续你的安全培训')}</h1><p>{t('填写登记时的姓名与手机号')}<br />{t('找到属于你的课程，接着上次继续学习')}</p></div>
    <form className="card form-card" onSubmit={event => { event.preventDefault(); search() }}><label className="field"><span>{t('登记姓名')}</span><Input aria-label={t('登记姓名')} placeholder={t('请输入登记时的姓名')} value={name} onChange={setName} maxLength={30} /></label><label className="field"><span>{t('手机号码')}</span><Input aria-label={t('手机号码')} placeholder={t('请输入登记时的11位手机号')} value={phone} onChange={setPhone} type="tel" maxLength={11} /></label><FieldError message={error} /><Button block color="primary" type="submit">{t('查找培训任务')}</Button></form>
    {matches !== null && <Section title={t('你的待完成培训')} subtitle={t('找到 {0} 门课程', { 0: tasks.length })}>{tasks.length ? tasks.map(task => {
      const person = store.snapshot().participants.find(item => item.id === task.subjectId)!
      const visits = store.taskVisits(task.id)
      return <button type="button" className="card query-result" key={task.id} onClick={() => navigate(`${task.attempt ? `/exam/${task.id}` : task.result ? `/result/${task.id}` : `/learn/${task.id}`}?access=participant`)}><div className="flex justify-between items-center"><strong>{task.courseSnapshot.title}</strong><Badge>{task.attempt ? t('考试中') : task.roundNumber > 1 ? t('需重新学习') : t('待完成')}</Badge></div><p>{person.name} · {maskPhone(person.phone)}</p><p className="muted small">{visits.length ? t('关联 {0} 张申请 · {1}', { 0: visits.length, 1: [...new Set(visits.map(visit => t(ENTRIES[visit.type].label)))].join(' · ') }) : t('独立分配课程，无需来访申请')}</p><span className="link-label">{t('继续学习')}<span aria-hidden="true">→</span></span></button>
    }) : <div className="card empty-copy"><Icon name="search" size={36} /><h3>{t('没有找到待完成任务')}</h3><p>{t('请核对登记姓名和手机号。有效期内已通过或免训的课程无需重复学习。')}</p></div>}</Section>}
    <div className="query-tip"><Icon name="shield" size={18} /><p>{t('查询本人已分配的培训任务；姓名与手机号需同时匹配，查询不代表身份认证。')}</p></div>
  </Screen>
}
