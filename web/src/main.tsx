import { t, translateMessage, useLanguage } from './i18n'
import { createRoot } from 'react-dom/client'
import { Component, Suspense, use, useEffect, type ReactNode } from 'react'
import { Button, ConfigProvider, ErrorBlock, SpinLoading, unstableSetRender } from 'antd-mobile'
import enUS from 'antd-mobile/es/locales/en-US'
import zhCN from 'antd-mobile/es/locales/zh-CN'
import { App } from './App'
import { initializeApi } from './domain/apiStore'
import { resetApiRoutes } from './domain/apiRoute'
import { notifyError } from './components/UI'
import './styles.css'

// Ant Design Mobile's imperative dialogs/toasts use its public React 19 renderer hook.
const roots = new WeakMap<Element | DocumentFragment, ReturnType<typeof createRoot>>()
unstableSetRender((node, container) => {
  let root = roots.get(container)
  if (!root) { root = createRoot(container); roots.set(container, root) }
  root.render(<LocalizedContent>{node}</LocalizedContent>)
  return async () => {
    await new Promise(resolve => setTimeout(resolve, 0))
    root.unmount()
    roots.delete(container)
  }
})

let startup = initializeApi()
window.addEventListener('visitsafe:api-error', event => notifyError((event as CustomEvent).detail))

function ApiApp() { use(startup); return <App /> }

class ApiBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  retry = () => { resetApiRoutes(); startup = initializeApi(); this.setState({ error: null }) }
  render() {
    if (this.state.error) return <ErrorBlock fullPage status="default" title={t('暂时无法加载')} description={translateMessage(this.state.error.message) || t('请稍后重试')}><Button color="primary" onClick={this.retry}>{t('重新加载')}</Button></ErrorBlock>
    return this.props.children
  }
}

function LocalizedContent({ children }: { children: ReactNode }) {
  const language = useLanguage()
  return <ConfigProvider locale={language === 'en-US' ? enUS : zhCN}>{children}</ConfigProvider>
}

function Root() {
  const language = useLanguage()
  useEffect(() => {
    document.documentElement.lang = language
    document.title = `VisitSafe · ${t('来访登记与安全培训')}`
  }, [language])
  return <LocalizedContent><ApiBoundary><Suspense fallback={<ErrorBlock fullPage title={t('正在加载')} description={<SpinLoading color="primary" />} />}><ApiApp /></Suspense></ApiBoundary></LocalizedContent>
}

createRoot(document.getElementById('root')!).render(<Root />)
