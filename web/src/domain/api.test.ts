import { describe, expect, it, vi } from 'vitest'
import { ApiClient, ApiError } from './apiClient'

describe('API access scopes', () => {
  it('sends key and client token without cookies or leaking learning context', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
    const api = new ApiClient({ key: 'test-key', fetcher })
    api.clientToken = 'anonymous-client'
    api.learning = { token: 'personal', participantId: 7, expiresAt: '2099-01-01' }
    await api.request('/learning-task-search', { method: 'POST', body: { name: '张三', phone: '13800138000' } })
    const options = fetcher.mock.calls[0][1]
    expect(options.credentials).toBe('omit')
    expect(options.headers.get('X-Api-Key')).toBe('test-key')
    expect(options.headers.get('X-Client-Token')).toBe('anonymous-client')
    expect(options.headers.has('X-CSRF-Token')).toBe(false)
    expect(options.headers.has('X-Learning-Token')).toBe(false)
  })
  it('requires an unexpired participant token and keeps If-Match intact', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}'))
    const api = new ApiClient({ key: 'test-key', fetcher })
    api.clientToken = 'anonymous-client'
    await expect(api.request('/training-records/1/workspace', { access: 'participant', method: 'POST', body: {} })).rejects.toThrow('重新查询')
    expect(fetcher).not.toHaveBeenCalled()
    api.learning = { token: 'personal', participantId: 7, expiresAt: '2099-01-01' }
    await api.request('/exam-attempts/2/save', { access: 'participant', method: 'POST', etag: '"version"', body: {} })
    expect(fetcher.mock.calls[0][1].headers.get('If-Match')).toBe('"version"')
    expect(fetcher.mock.calls[0][1].headers.get('X-Learning-Token')).toBe('personal')
    expect(fetcher.mock.calls[0][1].headers.has('X-Client-Token')).toBe(false)
    expect(fetcher.mock.calls[0][1].credentials).toBe('omit')
  })
  it('preserves server conflict data for recovery', async () => {
    const api = new ApiClient({ key: 'test-key', fetcher: vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'VERSION_CONFLICT', detail: '记录已变化', workspace: { view: 'detail' } }), { status: 412 })) })
    try { await api.request('/applications/1/cancel', { method: 'POST' }); throw new Error('expected error') }
    catch (error) { expect(error).toBeInstanceOf(ApiError); expect((error as ApiError).problem.workspace).toEqual({ view: 'detail' }) }
  })
})
