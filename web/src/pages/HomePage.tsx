import { Button } from 'antd-mobile'
import { useNavigate } from 'react-router'
import { ENTRIES } from '../domain/store'
import type { EntryType } from '../domain/types'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Icon, Screen } from '../components/UI'

export function HomePage() {
  const navigate = useNavigate()
  const { state } = useVisitSafe()
  const pending = state.tasks.filter(task => !task.result?.passed).length
  return <Screen tabs><div className="brand-row"><span className="brand-icon"><Icon name="shield-white" size={24} /></span><div><strong>VisitSafe</strong><p>访客安全管理与培训</p></div><span className="brand-caption">SAFE VISIT</span></div>
    <section className="home-hero"><div className="hero-copy"><span className="eyebrow">WELCOME TO VISITSAFE</span><h1>让每一次到访<br />更安全、更安心</h1><p>来访登记 · 安全培训 · 便捷通行</p></div><img className="campus-art" src="/assets/campus.svg" alt="整洁的现代化厂区" /><div className="hero-note"><Icon name="shield" size={15} /><span>规范登记，共同守护园区安全</span></div></section>
    <div className="home-section-title"><h2>请选择办理事项</h2><span>安全从这里开始</span></div>
    <button type="button" className="entry-card training-entry" aria-label="学习培训" onClick={() => navigate('/training')}><span className="entry-icon blue"><Icon name="book-home" size={30} /></span><span className="entry-copy"><strong>学习培训</strong><span>查询本人任务，继续学习与考试</span></span><Icon name="chevron" size={20} /></button>
    {(Object.keys(ENTRIES) as EntryType[]).map(type => <button type="button" className="entry-card" key={type} aria-label={ENTRIES[type].label} onClick={() => navigate(`/registration/${type}`)}><span className={`entry-icon ${ENTRIES[type].color}`}><Icon name={ENTRIES[type].icon} size={30} /></span><span className="entry-copy"><strong>{ENTRIES[type].label}</strong><span>{ENTRIES[type].description}</span></span><Icon name="chevron" size={20} /></button>)}
    <div className="continue-card"><div className="flex items-center gap-2"><Icon name="book" size={20} /><strong>继续未完成的培训</strong></div><p>{pending ? `本机还有 ${pending} 项个人课程未完成` : '已登记人员可凭姓名和手机号继续学习'}</p><Button size="small" color="primary" fill="outline" onClick={() => navigate('/training')}>查找培训任务 <span aria-hidden="true">→</span></Button></div>
    <p className="home-footnote">每位到访人员均需独立完成培训</p>
  </Screen>
}
