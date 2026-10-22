import { t } from '../i18n'
import { useEffect, useState } from 'react'
import { Button, Dialog, SearchBar } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router'
import { AREAS, ENTRIES, formatMoment } from '../domain/store'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Badge, Icon, Missing, Screen, Section, notifyError } from '../components/UI'
import { ApplicationNotice } from '../components/ApplicationNotice'
import { VisitSummary } from '../components/VisitSummary'
import { resetApiRoutes, useApiRoute } from '../domain/apiRoute'

const applicationStatuses: Record<string, { label: string; tone: string }> = {
  pendingApproval: { label: '待审批', tone: 'orange' }, approved: { label: '已批准', tone: 'green' }, checkedIn: { label: '已进厂', tone: 'blue' }, checkedOut: { label: '已结束', tone: 'green' }, rejected: { label: '已驳回', tone: 'red' }, cancelled: { label: '已取消', tone: 'orange' }, expired: { label: '已过期', tone: 'orange' },
}

export function RecordsPage() {
  useApiRoute()
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const query = search.trim()
  useEffect(() => { const timer = window.setTimeout(() => { void store.loadRecords(query).then(resetApiRoutes).catch(notifyError) }, 300); return () => window.clearTimeout(timer) }, [query, store])
  const visits = state.visits
  const totals = store.recordTotals()
  return <Screen tabs><div className="records-heading"><h1>{t('我的记录')}</h1><p>{t('每一次学习，让安全更进一步')}</p><span className="records-avatar"><Icon name="user" size={26} /></span></div><div className="records-stats"><div><strong>{totals.applicationCount}</strong><span>{t('来访申请')}</span></div><div><strong>{totals.participantCount}</strong><span>{t('登记人员')}</span></div><div><strong>{totals.validRecordCount}</strong><span>{t('已通过课程')}</span></div></div>
    <SearchBar placeholder={t('搜索姓名、单位或车牌')} value={search} onChange={setSearch} maxLength={100} /><Section title={t('来访申请')} subtitle={visits.length ? t('共 {0} 条记录', { 0: visits.length }) : undefined}>{visits.map(visit => {
      const summary = store.recordSummary(visit.id)
      const done = summary?.training.validRecordCount || 0
      const required = summary?.training.requiredRecordCount || 0
      const status = applicationStatuses[summary?.status || ''] || { label: t('状态待刷新'), tone: 'blue' }
      return <button type="button" key={visit.id} className="card record-card" onClick={() => navigate(`/records/${visit.id}`)}><div className="flex gap-3"><span className={`record-icon ${ENTRIES[visit.type].color}`}><Icon name={ENTRIES[visit.type].icon} size={22} /></span><div className="flex-1"><h3>{t('{0}登记', { 0: t(summary?.visitTypeName || ENTRIES[visit.type].label) })}</h3><p className="muted small">{formatMoment(visit.createdAt)}</p></div><Badge tone={status.tone}>{t(status.label)}</Badge></div><div className="record-people">{visit.subjects.map(person => <span key={person.id}>{person.name}</span>)}</div><p className="muted small">{t('访问区域：')}{summary?.areaNames.join('、') || AREAS.filter(area => visit.areaIds.includes(area.id)).map(area => area.name).join('、')}</p><div className="record-bottom"><span className="muted small">{t('预约')}{visit.appointmentDate}</span><span>{t('{0}/{1} 门通过', { 0: done, 1: required })} <span aria-hidden="true">›</span></span></div></button>
    })}{!visits.length && <div className="card empty-copy"><Icon name="book" size={42} /><h3>{query ? t('没有匹配的记录') : t('还没有来访记录')}</h3><p>{query ? t('试试人员姓名、所属单位或车牌号') : t('完成来访登记后，可以在这里查看申请和培训进度')}</p>{!query && <Button color="primary" onClick={() => navigate('/')}>{t('开始来访登记')}</Button>}</div>}</Section><p className="center small muted">{t('记录由服务端保存，仅显示当前浏览器提交的申请')}</p>
  </Screen>
}

export function RecordDetailPage() {
  const { access } = useApiRoute()
  const { visitId } = useParams()
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const visit = state.visits.find(item => item.id === visitId)
  if (!visit) return <Missing />
  const tasks = store.currentTasks(visit.id)
  const completed = tasks.filter(task => store.isTrainingValid(task)).length
  async function remove() {
    if (!await Dialog.confirm({ title: t('取消这张申请？'), content: t('取消后保留申请历史、人员、车辆和培训考试记录。'), confirmText: t('确认取消'), cancelText: t('保留申请') })) return
    try { if (await store.deleteVisit(visit!.id)) navigate('/records', { replace: true }) } catch (error) { notifyError(error) }
  }
  return <ApplicationNotice visit={visit}><Screen title={t('申请详情')} backTo="/records"><div className="detail-banner"><Icon name="shield" size={32} /><div><h2>{t('{0}登记', { 0: t(ENTRIES[visit.type].label) })}</h2><p>{t('已通过 {0} / {1} 门个人课程', { 0: completed, 1: tasks.length })}</p></div></div><VisitSummary draft={visit} />
    <Section title={t('个人培训记录')}>{visit.subjects.map(person => <div className="card participant-record" key={person.id}><div className="flex justify-between"><strong>{person.name}</strong><button type="button" className="text-button" onClick={() => navigate(`/tasks/${visit.id}?person=${person.id}${access === 'participant' ? '&access=participant' : ''}`)}>{t('查看课程')}</button></div>{tasks.filter(task => task.subjectId === person.id).map(task => <div key={task.id} className="summary-row"><span>{task.courseSnapshot.title}</span><Badge tone={store.isTrainingValid(task) ? 'green' : 'blue'}>{store.isTrainingValid(task) ? visit.exemptTaskIds.includes(task.id) ? t('有效期内免训') : t('{0} 分 · 通过', { 0: task.result!.score }) : task.attempt ? t('考试中') : task.roundNumber > 1 ? t('需重新学习') : t('待完成')}</Badge></div>)}</div>)}</Section>
    <Button block color="primary" onClick={() => navigate(`/tasks/${visit.id}${access === 'participant' ? '?access=participant' : ''}`)}>{completed === tasks.length ? t('查看培训任务') : t('继续培训')}</Button><Button block fill="none" color="danger" className="mt-3" disabled={access === 'participant'} onClick={remove}>{t('取消申请')}</Button>
  </Screen></ApplicationNotice>
}
