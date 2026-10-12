import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createDemoStore, type DemoStore } from '../domain/store'
import type { AppState } from '../domain/types'

const VisitSafeContext = createContext<{ store: DemoStore; state: AppState } | null>(null)

export function VisitSafeProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createDemoStore({
    read: key => { const value = localStorage.getItem(key); return value ? JSON.parse(value) : undefined },
    write: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
  }))
  const state = useSyncExternalStore(store.subscribe, store.snapshot)
  return <VisitSafeContext value={{ store, state }}>{children}</VisitSafeContext>
}

export function useVisitSafe() {
  const context = useContext(VisitSafeContext)
  if (!context) throw new Error('VisitSafe provider missing')
  return context
}
