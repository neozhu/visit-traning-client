import { useNavigate } from 'react-router'
import { ENTRIES } from '../domain/store'
import type { EntryType } from '../domain/types'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Icon, Screen } from '../components/UI'

const entryDescriptions: Record<EntryType, string> = {
  visitor: '来访登记与安全培训',
  logistics: '司机及车辆登记',
  contractor: '施工登记与安全培训',
}

export function HomePage() {
  const navigate = useNavigate()
  const { state } = useVisitSafe()
  const pending = state.tasks.filter(task => !task.result?.passed).length
  return <Screen tabs className="home-screen">
    <div className="brand-row"><span className="brand-icon"><Icon name="shield-white" size={28} /></span><div><strong>VisitSafe</strong><p>访客安全管理与培训</p></div></div>
    <section className="home-hero"><div className="hero-copy"><h1>让每一次到访<br />更安全、更安心</h1><p>来访登记 · 安全培训 · 便捷通行</p></div></section>
    <section aria-labelledby="home-entry-title">
      <div className="home-section-title"><h2 id="home-entry-title">请选择办理事项</h2><p>选择对应身份，开始办理。</p></div>
      <div className="home-entry-grid grid grid-cols-2 gap-2.5">
        <button type="button" className="entry-card training-entry" aria-label="学习培训" onClick={() => navigate('/training')}><span className="entry-icon blue"><Icon name="book-home" size={34} /></span><span className="entry-copy"><strong>学习培训</strong><span>学习与考试</span></span><Icon name="chevron" size={18} className="entry-chevron" /></button>
        {(Object.keys(ENTRIES) as EntryType[]).map(type => <button type="button" className="entry-card" key={type} aria-label={ENTRIES[type].label} onClick={() => navigate(`/registration/${type}`)}><span className={`entry-icon ${ENTRIES[type].color}`}><Icon name={ENTRIES[type].icon} size={34} /></span><span className="entry-copy"><strong>{ENTRIES[type].label}</strong><span>{entryDescriptions[type]}</span></span><Icon name="chevron" size={18} className="entry-chevron" /></button>)}
      </div>
    </section>
    <button type="button" className="continue-card" aria-label="继续学习" onClick={() => navigate('/training')}>
      <span className="entry-icon blue"><Icon name="book-home" size={28} /></span>
      <span className="continue-copy"><strong>继续未完成的培训</strong><span>{pending ? `本机还有 ${pending} 项个人课程未完成` : '使用登记时的手机号继续学习'}</span></span>
      <span className="continue-link">继续学习<Icon name="chevron-blue" size={18} /></span>
    </button>
  </Screen>
}
