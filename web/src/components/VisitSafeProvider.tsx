import { t } from '../i18n'
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createDemoStore, STORAGE_KEY, type DemoStore } from '../domain/store'
import type { AppState } from '../domain/types'

const VisitSafeContext = createContext<{ store: DemoStore; state: AppState } | null>(null)

export function VisitSafeProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => {
    return createDemoStore({
      read: key => { const value = localStorage.getItem(key); if (value === null) return undefined; try { return JSON.parse(value) } catch { return null } },
      write: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
    })
  })
  const state = useSyncExternalStore(store.subscribe, store.snapshot)
  useEffect(() => {
    const refresh = () => { try { store.refresh() } catch { /* Keep the last readable snapshot; mutations still report storage errors. */ } }
    const storageChanged = (event: StorageEvent) => { if (event.storageArea === localStorage && (event.key === STORAGE_KEY || event.key === null)) refresh() }
    const visible = () => { if (!document.hidden) refresh() }
    window.addEventListener('storage', storageChanged)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', visible)
    const timer = window.setInterval(refresh, 60000)
    return () => { window.removeEventListener('storage', storageChanged); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); window.clearInterval(timer) }
  }, [store])
  return <VisitSafeContext value={{ store, state }}>{store.recovered() && <div className="cache-recovery" role="status">{t('本地演示数据不完整，已恢复为空白状态，请重新登记。')}</div>}{children}</VisitSafeContext>
}

export function useVisitSafe() {
  const context = useContext(VisitSafeContext)
  if (!context) throw new Error('VisitSafe provider missing')
  return context
}
