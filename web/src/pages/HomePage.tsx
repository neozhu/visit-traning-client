import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { t } from '../i18n'
import { useNavigate } from 'react-router'
import { ENTRIES } from '../domain/store'
import type { EntryType } from '../domain/types'
import { useVisitSafe } from '../components/VisitSafeProvider'
import { Icon, Screen } from '../components/UI'
import { useApiRoute } from '../domain/apiRoute'

const entryDescriptions: Record<EntryType, string> = {
  visitor: '来访登记与安全培训',
  logistics: '司机及车辆登记',
  contractor: '施工登记与安全培训',
}

export function HomePage() {
  useApiRoute()
  const navigate = useNavigate()
  const { store } = useVisitSafe()
  const pending = store.browserTotals().pendingTrainingCount
  return <Screen tabs className="home-screen">
    <div className="brand-row"><span className="brand-icon"><Icon name="shield-white" size={28} /></span><div className="brand-copy"><strong>VisitSafe</strong><p>{t('访客安全管理与培训')}</p></div><LanguageSwitcher /></div>
    <section className="home-hero"><div className="hero-copy"><h1>{t('让每一次到访')}<br />{t('更安全、更安心')}</h1><p>{t('来访登记 · 安全培训 · 便捷通行')}</p></div></section>
    <section aria-labelledby="home-entry-title">
      <div className="home-section-title"><h2 id="home-entry-title">{t('请选择办理事项')}</h2><p>{t('选择对应身份，开始办理。')}</p></div>
      <div className="home-entry-grid grid grid-cols-2 gap-2.5">
        <button type="button" className="entry-card training-entry" aria-label={t('学习培训')} onClick={() => navigate('/training')}><span className="entry-icon blue"><Icon name="book-home" size={34} /></span><span className="entry-copy"><strong>{t('学习培训')}</strong><span>{t('学习与考试')}</span></span><Icon name="chevron" size={18} className="entry-chevron" /></button>
        {store.entryTypes().map(type => <button type="button" className="entry-card" key={type} aria-label={t(ENTRIES[type].label)} onClick={() => navigate(`/registration/${type}`)}><span className={`entry-icon ${ENTRIES[type].color}`}><Icon name={ENTRIES[type].icon} size={34} /></span><span className="entry-copy"><strong>{t(ENTRIES[type].label)}</strong><span>{t(entryDescriptions[type] || ENTRIES[type].description)}</span></span><Icon name="chevron" size={18} className="entry-chevron" /></button>)}
      </div>
    </section>
    <button type="button" className="continue-card" aria-label={t('继续学习')} onClick={() => navigate('/training')}>
      <span className="entry-icon blue"><Icon name="book-home" size={28} /></span>
      <span className="continue-copy"><strong>{t('继续未完成的培训')}</strong><span>{pending ? t('还有 {0} 项个人课程未完成', { 0: pending }) : t('使用登记时的手机号继续学习')}</span></span>
      <span className="continue-link">{t('继续学习')}<Icon name="chevron-blue" size={18} /></span>
    </button>
  </Screen>
}
