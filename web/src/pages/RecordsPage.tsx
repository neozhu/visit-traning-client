import { useState } from 'react'
import { Button, Dialog, SearchBar } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router'
import { AREAS, ENTRIES, formatMoment } from '../domain/store'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Badge, Icon, Missing, Screen, Section, notifyError } from '../components/UI'
import { VisitSummary } from '../components/VisitSummary'

export function RecordsPage() {
  const { state } = useVisitSafe()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const visits = state.visits.filter(visit => [ENTRIES[visit.type].label, visit.contractorCompany, ...visit.subjects.flatMap(person => [person.name, person.phone, person.company]), ...visit.vehicles.map(vehicle => vehicle.plate), ...visit.accompanyingVehicles.map(vehicle => vehicle.plate)].join(' ').toLowerCase().includes(query))
  const completed = state.tasks.filter(task => task.result?.passed).length
  return <Screen tabs><div className="records-heading"><h1>我的记录</h1><p>每一次学习，让安全更进一步</p><span className="records-avatar"><Icon name="user" size={26} /></span></div><div className="records-stats"><div><strong>{state.visits.length}</strong><span>来访申请</span></div><div><strong>{state.visits.reduce((count, visit) => count + visit.subjects.length, 0)}</strong><span>登记人员</span></div><div><strong>{completed}</strong><span>已通过课程</span></div></div>
    <SearchBar placeholder="搜索姓名、单位或车牌" value={search} onChange={setSearch} /><Section title="来访申请" subtitle={visits.length ? `共 ${visits.length} 条记录` : undefined}>{visits.map(visit => {
      const tasks = state.tasks.filter(task => task.visitId === visit.id)
      const done = tasks.filter(task => task.result?.passed).length
      return <button type="button" key={visit.id} className="card record-card" onClick={() => navigate(`/records/${visit.id}`)}><div className="flex gap-3"><span className={`record-icon ${ENTRIES[visit.type].color}`}><Icon name={ENTRIES[visit.type].icon} size={22} /></span><div className="flex-1"><h3>{ENTRIES[visit.type].label}登记</h3><p className="muted small">{formatMoment(visit.createdAt)}</p></div><Badge tone={done === tasks.length ? 'green' : 'orange'}>{done === tasks.length ? '已完成' : '培训中'}</Badge></div><div className="record-people">{visit.subjects.map(person => <span key={person.id}>{person.name}</span>)}</div><p className="muted small">访问区域：{AREAS.filter(area => visit.areaIds.includes(area.id)).map(area => area.name).join('、')}</p><div className="record-bottom"><span className="muted small">预约 {visit.appointmentDate}</span><span>{done}/{tasks.length} 门通过 <span aria-hidden="true">›</span></span></div></button>
    })}{!visits.length && <div className="card empty-copy"><Icon name="book" size={42} /><h3>{query ? '没有匹配的记录' : '还没有来访记录'}</h3><p>{query ? '试试人员姓名、所属单位或车牌号' : '完成来访登记后，可以在这里查看申请和培训进度'}</p>{!query && <Button color="primary" onClick={() => navigate('/')}>开始来访登记</Button>}</div>}</Section><p className="center small muted">记录保存在当前浏览器，清除浏览器数据后将移除</p>
  </Screen>
}

export function RecordDetailPage() {
  const { visitId } = useParams()
  const { state, store } = useVisitSafe()
  const navigate = useNavigate()
  const visit = state.visits.find(item => item.id === visitId)
  if (!visit) return <Missing />
  const tasks = state.tasks.filter(task => task.visitId === visit.id)
  const completed = tasks.filter(task => task.result?.passed).length
  async function remove() {
    if (!await Dialog.confirm({ title: '删除这张申请？', content: '这张申请的人员资料、视频进度和考试结果将同时删除。', confirmText: '确认删除', cancelText: '保留记录' })) return
    try { store.deleteVisit(visit!.id); navigate('/records', { replace: true }) } catch (error) { notifyError(error) }
  }
  return <Screen title="申请详情" backTo="/records"><div className="detail-banner"><Icon name="shield" size={32} /><div><h2>{ENTRIES[visit.type].label}登记</h2><p>已通过 {completed} / {tasks.length} 门个人课程</p></div></div><VisitSummary draft={visit} />
    <Section title="个人培训记录">{visit.subjects.map(person => <div className="card participant-record" key={person.id}><div className="flex justify-between"><strong>{person.name}</strong><button type="button" className="text-button" onClick={() => navigate(`/tasks/${visit.id}?person=${person.id}`)}>查看课程</button></div>{tasks.filter(task => task.subjectId === person.id).map(task => <div key={task.id} className="summary-row"><span>{store.course(task.courseId).title}</span><Badge tone={task.result?.passed ? 'green' : 'blue'}>{task.result?.passed ? `${task.result.score} 分 · 通过` : task.attempt ? '考试中' : '待完成'}</Badge></div>)}</div>)}</Section>
    <Button block color="primary" onClick={() => navigate(`/tasks/${visit.id}`)}>继续培训</Button><Button block fill="none" color="danger" className="mt-3" onClick={remove}>删除申请</Button>
  </Screen>
}
