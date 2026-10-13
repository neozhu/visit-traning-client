import { Button, Empty, NavBar, TabBar, Toast } from 'antd-mobile'
import { useLocation, useNavigate, useNavigationType } from 'react-router'
import { ViewTransition, type ReactNode } from 'react'

export function Icon({ name, size = 24, className = '' }: { name: string; size?: number; className?: string }) {
  return <img className={`icon ${className}`} src={`/assets/${name.includes('.') ? name : `${name}.svg`}`} width={size} height={size} alt="" aria-hidden="true" />
}
export function notifyError(error: unknown) {
  Toast.show({ content: error instanceof Error ? error.message : '操作失败，请重试', duration: 2500 })
}
export function Screen({ title, children, backTo = '/', tabs = false, className = '' }: { title?: string; children: ReactNode; backTo?: string; tabs?: boolean; className?: string }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // History traversal commits eagerly in React; keep a simple entry fade for it.
  const animateEntry = useNavigationType() === 'POP' || typeof document.startViewTransition !== 'function'
  return <ViewTransition key={pathname} default="none" enter="page-enter" exit="page-exit"><div className={`screen ${tabs ? 'with-tabs' : ''} ${animateEntry ? 'page-fallback-enter' : ''} ${className}`}>
    {title && <header className="page-header"><NavBar onBack={() => navigate(backTo)}>{title}</NavBar></header>}
    <main className="page-content">{children}</main>
    {tabs && <BottomTabs />}
  </div></ViewTransition>
}
export function BottomTabs() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return <nav className="bottom-tabs" aria-label="主导航"><TabBar activeKey={pathname === '/' ? '/' : '/records'} onChange={key => navigate(key)}>
    <TabBar.Item key="/" title="首页" icon={<Icon name={pathname === '/' ? 'home-active.png' : 'home.png'} />} />
    <TabBar.Item key="/records" title="我的" icon={<Icon name={pathname === '/' ? 'user.png' : 'user'} />} />
  </TabBar></nav>
}
export function Actions({ children }: { children: ReactNode }) { return <div className="bottom-actions"><div className="flex gap-3">{children}</div></div> }
export function Section({ title, subtitle, children, action }: { title: string; subtitle?: string; children: ReactNode; action?: ReactNode }) {
  return <section className="section"><div className="section-heading"><div><h2>{title}</h2>{subtitle && <p className="muted small">{subtitle}</p>}</div>{action}</div>{children}</section>
}
export function Missing({ title = '申请不存在' }: { title?: string }) {
  const navigate = useNavigate()
  return <Screen title="VisitSafe"><Empty description={title} /><Button block color="primary" onClick={() => navigate('/records')}>返回我的记录</Button></Screen>
}
export function Badge({ children, tone = 'blue' }: { children: ReactNode; tone?: string }) { return <span className={`badge ${tone}`}>{children}</span> }
export function FieldError({ message }: { message?: string }) { return message ? <p className="field-error" role="alert">{message}</p> : null }
