import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppWorkspace, BaseData, Bootstrap, SearchResult, TrainingWorkspace } from './apiTypes'
import type { RequestOptions, LearningSession, Problem } from './apiClient'

const now = Date.parse('2026-10-21T02:00:00Z')
const course = { id: 1, title: '安全培训', subtitle: null, icon: 'book', videoCount: 1, questionCount: 5, passingScore: 80, examDurationMinutes: 15 }
const base: BaseData = {
  generatedAt: new Date(now).toISOString(),
  visitTypes: ['visitor', 'logistics'].map((code, i) => ({ id: i + 1, code, name: code, description: null, caption: null, color: null, icon: null, sortOrder: i, vehicleRequired: i === 1, transportCompanyRequired: i === 1 })),
  registrationConfigs: [1, 2].map(visitTypeId => ({ visitTypeId, configurationVersion: 'c1', applicationTemplateId: 1,
    fields: [{ key: 'hostName', label: '被访人', control: 'text', required: true, readOnly: false, sortOrder: 0, minLength: null, maxLength: 50, minimum: null, maximum: null, options: [] }],
    notice: { id: 1, version: 'n1', title: '须知', content: '请遵守规定' }, areaRules: [{ areaId: 3, selectable: true, unavailableReason: null, requiredCourseIds: [1] }],
    participantRules: { minimumCount: 1 } })),
  timeSlots: [{ value: 'am', label: '上午' }], areas: [{ id: 3, code: 'office', name: '办公区', description: null, caption: null, color: null, icon: null, sortOrder: 0 }], courses: [course],
  attachmentRules: { allowedContentTypes: [], maxSizeBytes: 1000, maxFilesPerParticipant: 1 },
  validationRules: { phonePattern: '^1[3-9][0-9]{9}$', platePattern: '^[粤][A-Z][A-Z0-9]{5}$', plateIgnoredCharacters: ' ·.-', plateUppercase: true, participantNameMaxLength: 50, companyMaxLength: 100, tradeMaxLength: 50, driverNameMaxLength: 50 },
}
const boot: Bootstrap = { clientContext: { clientToken: 'client', businessTimeZone: 'Asia/Shanghai', today: '2026-10-21' }, baseDataVersion: 'b1', baseData: base, totals: { applicationCount: 0, pendingTrainingCount: 0 }, profileMatches: { participants: [], vehicles: [] } }
function workspace(): TrainingWorkspace {
  const attempt = { id: 55, attemptNumber: 1, startedAt: new Date(now).toISOString(), deadlineAt: new Date(now + 900000).toISOString(), submittedAt: null, score: null, passed: null, timedOut: false }
  return { browserTotals: null, record: { id: 40, participantId: 7, trainingCourseId: 1, roundNumber: 1, state: 'examInProgress', startedAt: attempt.startedAt, completedVideoIds: [10], completedAt: null, validUntil: null, isValid: false, course, activeExamAttempt: attempt, latestSubmittedExamAttempt: null },
    participant: { id: 7, name: '张三', maskedPhone: '138****8000' }, applicationContext: null, currentTrainingRecordId: 40, actions: { canLearn: true, canStartExam: false, canRetake: false },
    videos: [{ id: 10, title: '安全视频', description: null, durationSeconds: 60, file: { reference: 'video', fileName: 'v.mp4', contentType: 'video/mp4', sizeBytes: null, url: 'https://media.test/v.mp4', urlExpiresAt: '2099-01-01T00:00:00Z' } }], pdf: null,
    exam: { ...attempt, trainingRecordId: 40, etag: '"e1"', questions: [1, 2, 3, 4, 5].map(id => ({ id, type: 'singleChoice', title: `问题${id}`, options: ['A', 'B', 'C', 'D'], points: 20 })), answers: {}, passingScore: 80, canAnswer: true, canSubmit: false },
    result: null, examHistory: { items: [], page: 1, pageSize: 20, totalCount: 0 }, completion: null }
}
function search(record = workspace().record): SearchResult {
  return { participant: { id: 7, name: '张三', maskedPhone: '138****8000' }, learningToken: 'person7', learningTokenExpiresAt: '2099-01-01T00:00:00Z',
    tasks: { items: [{ record, relatedApplications: [] }], page: 1, pageSize: 50, totalCount: 1 }, applications: { items: [], page: 1, pageSize: 50, totalCount: 0 }, completedRecords: { items: [], page: 1, pageSize: 50, totalCount: 0 } }
}
function applicationWorkspace(record = workspace().record): AppWorkspace {
  return { view: 'detail', access: 'owner', currentParticipantId: null, browserTotals: null,
    application: { id: 18, visitTypeId: 1, visitTypeName: '普通访客', status: 'pendingApproval', createdAt: new Date(now).toISOString(), appointmentDate: '2026-10-21', timeSlot: 'am', participantNames: ['张三'], areaNames: ['办公区'],
      training: { participantCount: 1, qualifiedParticipantCount: 0, requiredRecordCount: 1, validRecordCount: 0, allQualified: false }, canCancel: true,
      etag: '"a1"', clientRequestId: 'request1', source: 'external', reviewedAt: null, checkedInAt: null, checkedOutAt: null,
      notice: { id: 1, titleSnapshot: '原须知', contentSnapshot: '原正文', acceptedAt: new Date(now).toISOString() }, businessFields: [{ key: 'hostName', label: '被访人', value: '王经理', displayValue: '王经理' }],
      participants: [{ id: 7, name: '张三', phone: '13800138000', company: '测试公司', trade: null, idCardNumber: null, attachment: null, checkedInAt: null, checkedOutAt: null }], vehicles: [], areas: [{ id: 3, name: '办公区' }], approvalTasks: [] },
    tasks: [{ record, participantId: 7, isCurrentRound: true, isExempt: false, actions: { canLearn: true, canStartExam: false, canRetake: false } }] }
}
class TestApiError extends Error { constructor(public status: number, public problem: Problem) { super(problem.detail) } }
async function setup() {
  vi.resetModules()
  const request = vi.fn<(path: string, options?: RequestOptions) => Promise<unknown>>()
  const api = { request, now: () => now, media: (url: string) => url, learning: null as LearningSession | null }
  vi.doMock('./apiClient', () => ({ api, ApiError: TestApiError, bootstrap: async () => structuredClone(boot) }))
  const module = await import('./apiStore')
  await module.initializeApi()
  const saved = new Map<string, unknown>()
  const store = module.createApiStore({ read: key => saved.get(key), write: (key, value) => { saved.set(key, value) } })
  const helpers = await import('./store')
  return { store, api, request, saved, helpers }
}
afterEach(() => { vi.doUnmock('./apiClient') })

describe('API store bindings', () => {
  it('maps registration labels and independent people to the API contract', async () => {
    const { store, request, helpers, saved } = await setup()
    const draft = { ...helpers.newDraft('visitor'), appointmentDate: '2026-10-21', timeSlot: '上午', hostName: '王经理', noticeAccepted: true, areaIds: ['3'], people: [{ id: 'local-person', name: ' 张三 ', phone: '13800138000', company: '测试公司' }] }
    store.saveDraft(draft)
    request.mockResolvedValueOnce(applicationWorkspace())
    const visit = await store.register(draft)
    expect(request).toHaveBeenCalledWith('/applications', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ clientRequestId: draft.id, visitTypeId: 1, configurationVersion: 'c1', timeSlot: 'am', noticeId: 1, noticeVersion: 'n1', dynamicValues: { hostName: '王经理' }, participants: [{ name: '张三', phone: '13800138000', company: '测试公司', trade: null }], vehicles: [], areaIds: [3] }) }))
    expect(visit.id).toBe('18')
    expect(visit.subjects[0].id).toBe('7')
    expect(store.snapshot().drafts.visitor).toBeUndefined()
    expect([...saved.values()]).toEqual([{ drafts: {} }])
  })

  it('keeps learning search and owner records in separate projections', async () => {
    const { store, request } = await setup()
    request.mockResolvedValueOnce(search())
    store.activateContext(null, 'participant')
    const found = await store.pendingTasks('张三', '13800138000')
    expect(found.map(task => task.id)).toEqual(['40'])
    expect(store.snapshot().tasks).toHaveLength(1)
    store.activateContext(null, 'owner')
    expect(store.snapshot().tasks).toHaveLength(0)
    store.activateContext(null, 'participant')
    expect(store.snapshot().participants[0].name).toBe('张三')
  })

  it('never derives participants from logistics drivers or sends a partial registration', async () => {
    const { store, request, helpers } = await setup()
    const draft = { ...helpers.newDraft('logistics'), appointmentDate: '2026-10-21', timeSlot: '上午', hostName: '王经理', noticeAccepted: true, areaIds: ['3'], vehicles: [{ id: 'v1', plate: '粤A12345', driver: '张三', phone: '13800138000', company: '物流公司' }] }
    await expect(store.register(draft)).rejects.toThrow('独立登记培训人员')
    expect(request).not.toHaveBeenCalled()
  })

  it('serializes answer saves with the newest server ETag and uses the server score', async () => {
    const { store, api, request, saved } = await setup()
    api.learning = { token: 'person7', participantId: 7, expiresAt: '2099-01-01' }
    store.activateContext(null, 'participant')
    let current = workspace()
    request.mockImplementation(async (path, options) => {
      if (path.endsWith('/workspace')) return structuredClone(current)
      const body = options!.body as { changes: Record<string, number[]>; submit: boolean }
      expect(options!.etag).toBe(current.exam!.etag)
      current.exam!.answers = { ...current.exam!.answers, ...body.changes }
      current.exam!.etag = `"e${request.mock.calls.length}"`
      if (body.submit) {
        current.exam!.submittedAt = new Date(now).toISOString()
        current.record.activeExamAttempt = null
        current.result = { examAttemptId: 55, trainingRecordId: 40, attemptNumber: 1, submittedAt: current.exam!.submittedAt, score: 40, passed: false, timedOut: false, answers: current.exam!.answers, wrongQuestionIds: [3, 4, 5], wrongQuestions: [], completedAt: null, validUntil: null }
      }
      return structuredClone(current)
    })
    await store.loadTraining('40')
    await Promise.all([store.answer('40', '1', [1]), store.answer('40', '2', [2])])
    expect(store.task('40').attempt!.answers).toEqual({ 1: [1], 2: [2] })
    expect((await store.submitExam('40')).score).toBe(40)
    expect(saved.size).toBe(0)
  })

  it('replaces answers on 412 and does not replay already queued stale edits', async () => {
    const { store, api, request } = await setup()
    api.learning = { token: 'person7', participantId: 7, expiresAt: '2099-01-01' }
    store.activateContext(null, 'participant')
    request.mockResolvedValueOnce(workspace())
    await store.loadTraining('40')
    const authoritative = workspace()
    authoritative.exam!.etag = '"other-device"'; authoritative.exam!.answers = { 1: [3] }
    request.mockRejectedValueOnce(new TestApiError(412, { trainingWorkspace: authoritative, detail: '版本冲突' }))
    const results = await Promise.allSettled([store.answer('40', '1', [0]), store.answer('40', '2', [1])])
    expect(results.every(value => value.status === 'rejected')).toBe(true)
    expect(request).toHaveBeenCalledTimes(2)
    expect(store.task('40').attempt!.answers).toEqual({ 1: [3] })
  })

  it('discards a prior participant error workspace after a new search', async () => {
    const { store, api, request } = await setup()
    api.learning = { token: 'person7', participantId: 7, expiresAt: '2099-01-01' }
    store.activateContext(null, 'participant')
    request.mockResolvedValueOnce(workspace())
    await store.loadTraining('40')
    let reject!: (reason: unknown) => void
    request.mockImplementationOnce(() => new Promise((_resolve, failure) => { reject = failure }))
    const save = store.answer('40', '1', [0])
    await Promise.resolve(); await Promise.resolve()
    const other = search({ ...workspace().record, id: 41, participantId: 8 })
    other.participant = { id: 8, name: '李四', maskedPhone: '139****9000' }; other.learningToken = 'person8'
    request.mockResolvedValueOnce(other)
    await store.pendingTasks('李四', '13900139000')
    reject(new TestApiError(412, { trainingWorkspace: workspace() }))
    await expect(save).rejects.toThrow()
    expect(store.snapshot().participants.map(person => person.name)).toEqual(['李四'])
    expect(store.snapshot().tasks.map(task => task.id)).toEqual(['41'])
  })

  it('defers course loading until the application notice is accepted', async () => {
    const { store, request } = await setup()
    const app: AppWorkspace = { view: 'notice', access: 'owner', currentParticipantId: null, browserTotals: null, applicationId: 18, applicationEtag: '"a1"', notice: { id: 1, titleSnapshot: '须知', contentSnapshot: '保存正文', acceptedAt: null } }
    request.mockResolvedValue(app)
    await store.loadTraining('40', '18', 'owner')
    expect(request).toHaveBeenCalledTimes(1)
    expect(store.requiresNotice('18')).toBe(true)
  })

  it('refreshes linked current rounds from the server pointer', async () => {
    const { store, request } = await setup()
    const old = workspace()
    old.currentTrainingRecordId = 41
    const next = { ...old.record, id: 41, roundNumber: 2 }
    request.mockResolvedValueOnce(applicationWorkspace()).mockResolvedValueOnce(old).mockResolvedValueOnce(applicationWorkspace(next))
    store.activateContext('18', 'owner')
    await store.loadTraining('40', '18', 'owner')
    expect(store.currentTasks('18').map(task => task.id)).toEqual(['41'])
    expect(request).toHaveBeenCalledTimes(3)
  })
})
