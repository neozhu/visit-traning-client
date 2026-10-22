import { setLanguage, t, useLanguage } from '../i18n'

export function LanguageSwitcher() {
  const language = useLanguage()
  return <button type="button" className={`language-switcher ${language === 'en-US' ? 'is-english' : ''}`} aria-label={t(language === 'zh-CN' ? '切换为英文' : '切换为中文')} aria-pressed={language === 'en-US'} onClick={() => setLanguage(language === 'zh-CN' ? 'en-US' : 'zh-CN')}>
    <span className="language-thumb" aria-hidden="true" />
    <span className="language-option" lang="zh-CN" aria-hidden="true">中文</span>
    <span className="language-option" lang="en" aria-hidden="true">EN</span>
  </button>
}
