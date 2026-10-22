import { use, useLayoutEffect } from 'react'
import { useLocation } from 'react-router'
import { getApiStore } from './apiStore'

const resources = new Map<string, Promise<void>>()

export function resetApiRoutes() { resources.clear() }

export function useApiRoute() {
  const { pathname, search } = useLocation()
  const params = new URLSearchParams(search)
  const application = pathname.match(/^\/(?:tasks|records)\/([^/]+)$/)
  const training = pathname.match(/^\/(?:learn|exam|result|completion)\/([^/]+)$/)
  const visitId = application?.[1] || params.get('visit')
  const access: 'owner' | 'participant' = pathname === '/training' || params.get('access') === 'participant' || (training && !visitId) ? 'participant' : 'owner'
  const store = getApiStore()
  useLayoutEffect(() => {
    store.activateContext(visitId, access)
  }, [store, visitId, access])
  const key = application ? `application:${application[1]}:${access}` : training ? `training:${training[1]}:${visitId || ''}:${access}` : pathname === '/records' ? 'records' : ''
  if (key) {
    let resource = resources.get(key)
    if (!resource) {
      resource = application ? store.loadApplication(application[1], access) : training ? store.loadTraining(training[1], visitId, access) : store.loadRecords()
      resources.set(key, resource)
    }
    use(resource)
    if (training && visitId && store.requiresNotice(visitId)) resources.delete(key)
  }
  return { access, visitId }
}

export function trainingSuffix(visitId: string | null, access: 'owner' | 'participant') {
  const params = new URLSearchParams()
  if (visitId) params.set('visit', visitId)
  if (access === 'participant') params.set('access', access)
  return params.size ? `?${params}` : ''
}
