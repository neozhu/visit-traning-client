import { useSyncExternalStore } from 'react'
import { english } from './locales/en'

export type Language = 'zh-CN' | 'en-US'
const storageKey = 'visitsafe.language'
const listeners = new Set<() => void>()

function readLanguage(): Language {
  try { return localStorage.getItem(storageKey) === 'en-US' ? 'en-US' : 'zh-CN' } catch { return 'zh-CN' }
}

let language = readLanguage()
export const getLanguage = () => language

export function setLanguage(next: Language) {
  language = next
  try { localStorage.setItem(storageKey, next) } catch { /* Language switching remains available without storage. */ }
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const sync = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) {
      language = readLanguage()
      listener()
    }
  }
  window.addEventListener('storage', sync)
  return () => { listeners.delete(listener); window.removeEventListener('storage', sync) }
}

export const useLanguage = () => useSyncExternalStore(subscribe, getLanguage)

export function t(text: string, values: Record<string, string | number> = {}) {
  const key = text.trim()
  const translated = language === 'en-US' && Object.hasOwn(english, key) ? english[key] : key
  return text.replace(key, translated).replace(/\{(\w+)\}/g, (match, name: string) => Object.hasOwn(values, name) ? String(values[name]) : match)
}

export function translateMessage(text: string) {
  const translated = t(text)
  if (translated !== text || language === 'zh-CN') return translated
  for (const [pattern, key] of [
    [/^请填写(.+)$/, '请填写{label}'],
    [/^请选择有效的(.+)$/, '请选择有效的{label}'],
    [/^(.+)长度不符合要求$/, '{label}长度不符合要求'],
    [/^请求失败（(\d+)）$/, '请求失败（{label}）'],
    [/^请求失败（(\d+)），请稍后重试。$/, '请求失败（{label}），请稍后重试。'],
  ] as const) {
    const match = text.match(pattern)
    if (match) return t(key, { label: t(match[1]) })
  }
  return text
}
