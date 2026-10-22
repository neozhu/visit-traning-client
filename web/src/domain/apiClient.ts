import type { Access, BaseData, Bootstrap } from './apiTypes'

export interface Problem {
  type?: string
  title?: string
  status?: number
  code?: string
  detail?: string
  errors?: Record<string, string[]>
  workspace?: unknown
  trainingWorkspace?: unknown
  baseData?: BaseData
  baseDataVersion?: string
}

export class ApiError extends Error {
  constructor(public status: number, public problem: Problem) {
    super(problem.detail || problem.title || `请求失败（${status}）`)
    this.name = 'ApiError'
  }
}

export interface LearningSession { token: string; participantId: number; expiresAt: string }
export interface RequestOptions { method?: string; body?: unknown; access?: Access; etag?: string }

export class ApiClient {
  clientToken = ''
  learning: LearningSession | null = null
  offset = 0
  private fetcher: typeof fetch
  private base: string
  private key: string

  constructor(options: { key: string; base?: string; fetcher?: typeof fetch }) {
    this.fetcher = options.fetcher ?? fetch.bind(globalThis)
    this.base = (options.base ?? '').replace(/\/$/, '')
    this.key = options.key
  }

  now() { return Date.now() + this.offset }
  media(url: string) { return new URL(url, this.base || window.location.origin).href }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!this.key) throw new Error('尚未配置接口访问密钥，请联系管理员。')
    const headers = new Headers({ 'X-Api-Key': this.key })
    if (options.access === 'participant') {
      if (!this.learning || !Number.isFinite(Date.parse(this.learning.expiresAt)) || Date.parse(this.learning.expiresAt) <= this.now()) {
        throw new Error('学习凭证已到期，请重新查询本人任务。')
      }
      headers.set('X-Learning-Token', this.learning.token)
    } else if (this.clientToken) headers.set('X-Client-Token', this.clientToken)
    if (options.etag) headers.set('If-Match', options.etag)
    let body: BodyInit | undefined
    if (options.body instanceof FormData) body = options.body
    else if (options.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(options.body)
    }
    const response = await this.fetcher(`${this.base}/api/v1${path}`, {
      method: options.method ?? 'GET', headers, body, credentials: 'omit', cache: 'no-store',
    })
    const serverTime = response.headers.get('X-Server-Time')
    if (serverTime && Number.isFinite(Date.parse(serverTime))) this.offset = Date.parse(serverTime) - Date.now()
    let data: unknown
    try { data = await response.json() }
    catch {
      if (!response.ok) throw new ApiError(response.status, { detail: `请求失败（${response.status}），请稍后重试。` })
      throw new Error('服务返回格式不正确，请稍后重试。')
    }
    if (!response.ok) throw new ApiError(response.status, data && typeof data === 'object' ? data as Problem : {})
    return data as T
  }
}

export const api = new ApiClient({ key: import.meta.env.VITE_VISITSAFE_API_KEY ?? '', base: import.meta.env.VITE_VISITSAFE_API_URL })

export function readSession<T>(key: string): T | null {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') as T | null }
  catch { return null }
}

api.learning = readSession<LearningSession>('visitsafe.learning.v1')
try { api.clientToken = localStorage.getItem('visitsafe.client.v1') || '' }
catch { /* in-memory context still works */ }

export function rememberClient(token: string) {
  if (!token) throw new Error('客户端访问凭证未能加载，请重试。')
  api.clientToken = token
  try { localStorage.setItem('visitsafe.client.v1', token) }
  catch { /* in-memory context still works */ }
}

function completeBaseData(data: BaseData | undefined | null): data is BaseData {
  if (!data || typeof data.generatedAt !== 'string' || !Array.isArray(data.visitTypes) || !Array.isArray(data.registrationConfigs)
    || !Array.isArray(data.timeSlots) || !Array.isArray(data.areas) || !Array.isArray(data.courses)
    || !Array.isArray(data.attachmentRules?.allowedContentTypes) || !data.validationRules
    || typeof data.attachmentRules.maxSizeBytes !== 'number' || typeof data.attachmentRules.maxFilesPerParticipant !== 'number'
    || typeof data.validationRules.phonePattern !== 'string' || typeof data.validationRules.platePattern !== 'string'
    || typeof data.validationRules.plateIgnoredCharacters !== 'string' || typeof data.validationRules.plateUppercase !== 'boolean'
    || typeof data.validationRules.driverNameMaxLength !== 'number') return false
  return data.visitTypes.every(type => type && data.registrationConfigs.some(config => config?.visitTypeId === type.id))
    && data.registrationConfigs.every(config => config && typeof config.configurationVersion === 'string'
      && typeof config.applicationTemplateId === 'number' && Array.isArray(config.fields) && config.fields.every(field => field && Array.isArray(field.options))
      && config.notice && typeof config.notice.version === 'string' && typeof config.notice.content === 'string'
      && config.participantRules && typeof config.participantRules.minimumCount === 'number' && Array.isArray(config.areaRules)
      && config.areaRules.every(rule => rule && data.areas.some(area => area?.id === rule.areaId)
        && Array.isArray(rule.requiredCourseIds) && rule.requiredCourseIds.every(id => data.courses.some(course => course?.id === id))))
}

let bootPromise: Promise<Bootstrap & { baseData: BaseData }> | null = null

export function bootstrap(force = false) {
  if (force) bootPromise = null
  if (!bootPromise) {
    const saved = readSession<{ version: string; data: BaseData }>('visitsafe.config.v1')
    const cached = saved && typeof saved.version === 'string' && completeBaseData(saved.data) ? saved : null
    if (!cached) {
      try { sessionStorage.removeItem('visitsafe.config.v1') }
      catch { /* cache is optional */ }
    }
    bootPromise = api.request<Bootstrap>('/bootstrap', {
      method: 'POST', body: cached ? { knownBaseDataVersion: cached.version } : {},
    }).then(async result => {
      rememberClient(result.clientContext.clientToken)
      let data = result.baseData ?? (cached?.version === result.baseDataVersion ? cached.data : null)
      if (!completeBaseData(data)) {
        result = await api.request<Bootstrap>('/bootstrap', { method: 'POST', body: {} })
        rememberClient(result.clientContext.clientToken)
        data = result.baseData
      }
      if (!completeBaseData(data)) throw new Error('基础配置未能加载，请重试。')
      try { sessionStorage.setItem('visitsafe.config.v1', JSON.stringify({ version: result.baseDataVersion, data })) }
      catch { /* cache is optional */ }
      return { ...result, baseData: data }
    }).catch(error => { bootPromise = null; throw error })
  }
  return bootPromise
}
