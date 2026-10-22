import { api, ApiError, bootstrap } from './apiClient'
import { applyBaseData, baseData, configuration, coursePreview, draftValues, fieldKeys, typeCode } from './apiCatalog'
import type { Access, AppWorkspace, Bootstrap, MyApplications, SearchResult, Summary, TrainingWorkspace } from './apiTypes'
import { AREAS, COURSES } from './catalog'
import { newDraft, normalizePlate, registrationErrors, STORAGE_KEY, trainingSubjects } from './store'
import type { AppState, Course, Draft, ExamResult, Person, StoragePort, TrainingTask, Visit } from './types'

type RecordDto = TrainingWorkspace['record']
const instant = (value: string | null | undefined) => value ? Date.parse(value) : undefined
const emptyState = (): AppState => ({ version: 3, drafts: {}, visits: [], tasks: [], participants: [], vehicleProfiles: [] })
const browserStorage: StoragePort = {
  read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null') } catch { return undefined } },
  write(key, value) { localStorage.setItem(key, JSON.stringify(value)) },
}
let initial: Bootstrap | undefined
let initialization: Promise<void> | undefined
export function initializeApi() {
  return initialization ??= bootstrap().then(result => { initial = result; applyBaseData(result.baseData) }).catch(error => { initialization = undefined; throw error })
}
let singleton: ApiStore | undefined
export function createApiStore(storage: StoragePort) { return singleton ??= buildStore(storage) }
export function getApiStore() { return createApiStore(browserStorage) }
export type ApiStore = ReturnType<typeof buildStore>

function buildStore(storage: StoragePort) {
  let state = emptyState()
  let access: Access = 'owner'
  let applicationId: string | null = null
  let generation = 0
  let recordsSequence = 0
  let lastRecordsQuery: string | undefined
  let ownerList: Summary[] = []
  let totals = { applicationCount: 0, participantCount: 0, validRecordCount: 0 }
  let browserTotals = initial?.totals || { applicationCount: 0, pendingTrainingCount: 0 }
  const listeners = new Set<() => void>()
  const apps = new Map<string, AppWorkspace>()
  const trainings = new Map<string, TrainingWorkspace>()
  const searchTasks = new Map<number, RecordDto>()
  const searchPeople = new Map<string, Person>()
  const related = new Map<string, { id: number; visitTypeName: string; appointmentDate: string }[]>()
  const reads = new Map<string, Promise<void>>()
  const notices = new Map<string, Promise<void>>()
  const writes = new Map<string, Promise<unknown>>()
  const failedAnswers = new Map<string, Set<string>>()
  const examRevisions = new Map<string, number>()
  const appKey = (id: string, scope = access) => `${scope}:${id}`
  const trainingKey = (id: string, visit: string | null = applicationId, scope = access) => `${scope}:${visit || ''}:${id}`
  let notificationPending = false
  function publish() {
    state = { ...state }
    if (notificationPending) return
    notificationPending = true
    queueMicrotask(() => { notificationPending = false; listeners.forEach(listener => listener()) })
  }
  function drafts() {
    try {
      const raw = storage.read(STORAGE_KEY)
      if (!raw || typeof raw !== 'object' || !('drafts' in raw) || !raw.drafts || typeof raw.drafts !== 'object') return {}
      const result: AppState['drafts'] = {}
      for (const [type, value] of Object.entries(raw.drafts)) {
        if (!baseData().visitTypes.some(item => item.code === type) || !value || typeof value !== 'object') continue
        const draft = value as Draft
        if (typeof draft.id !== 'string' || !Array.isArray(draft.people) || !Array.isArray(draft.vehicles) || !Array.isArray(draft.accompanyingVehicles) || !Array.isArray(draft.areaIds)) continue
        const config = configuration(type)
        result[type] = { ...newDraft(type), ...draft, noticeAccepted: draft.noticeAccepted && draft.noticeVersion === config.notice.version,
          configurationVersion: config.configurationVersion, noticeVersion: config.notice.version }
      }
      return result
    } catch { return {} }
  }
  state.drafts = drafts()
  function person(value: { id: number; name: string; phone?: string; maskedPhone?: string; company?: string | null; trade?: string | null }): Person {
    return { id: String(value.id), name: value.name, phone: value.phone || value.maskedPhone || '', company: value.company || '', trade: value.trade || undefined }
  }
  function result(value: NonNullable<TrainingWorkspace['result']>): ExamResult {
    return { score: value.score, passed: value.passed, timedOut: value.timedOut, submittedAt: Date.parse(value.submittedAt), answers: value.answers, wrongIds: value.wrongQuestionIds.map(String) }
  }
  function taskFrom(record: RecordDto, workspace?: TrainingWorkspace): TrainingTask {
    const previous = state.tasks.find(task => task.id === String(record.id))
    const course: Course = workspace ? {
      ...coursePreview(record.course), lessons: workspace.videos.map(video => ({ id: String(video.id), title: video.title, description: video.description || '', source: api.media(video.file.url), durationSeconds: video.durationSeconds })),
      questions: (workspace.exam?.questions || []).map(question => ({ id: String(question.id), title: question.title, options: question.options, kind: question.type === 'multipleChoice' ? 'multiple' : 'single', correctIndexes: question.correctIndexes || [], explanation: '' })),
    } : previous?.courseSnapshot || coursePreview(record.course)
    if (workspace?.result) {
      for (const wrong of workspace.result.wrongQuestions) {
        const question = { id: String(wrong.id), title: wrong.title, options: wrong.options, kind: wrong.type === 'multipleChoice' ? 'multiple' as const : 'single' as const, correctIndexes: wrong.correctIndexes, explanation: wrong.explanation }
        const index = course.questions.findIndex(item => item.id === question.id)
        if (index >= 0) course.questions[index] = question
        else course.questions.push(question)
      }
    }
    const active = workspace?.exam && !workspace.exam.submittedAt ? workspace.exam : record.activeExamAttempt
    const submitted = record.latestSubmittedExamAttempt
    const examResult = workspace?.result ? result(workspace.result) : submitted && submitted.score !== null && submitted.passed !== null && submitted.submittedAt ? {
      score: submitted.score, passed: submitted.passed, timedOut: submitted.timedOut, submittedAt: Date.parse(submitted.submittedAt), answers: {}, wrongIds: [],
    } : undefined
    return { id: String(record.id), subjectId: String(record.participantId), courseId: String(record.trainingCourseId), roundNumber: record.roundNumber, courseSnapshot: course,
      startedAt: instant(record.startedAt), completedLessons: record.completedVideoIds.map(String), completedAt: instant(record.completedAt), validUntil: instant(record.validUntil),
      attempt: active ? { id: String(active.id), attemptNumber: active.attemptNumber, startedAt: Date.parse(active.startedAt), deadlineAt: Date.parse(active.deadlineAt), answers: workspace?.exam?.answers || previous?.attempt?.answers || {} } : undefined,
      result: examResult, examHistory: [] }
  }
  function summaryVisit(summary: Summary): Visit {
    const type = typeCode(summary.visitTypeId, summary.visitTypeName)
    const blank = { id: String(summary.id), type, noticeAccepted: false, appointmentDate: summary.appointmentDate,
      timeSlot: baseData().timeSlots.find(option => option.value === summary.timeSlot)?.label || summary.timeSlot,
      hostName: '', visitReason: '', projectName: '', workArea: '', contractorCompany: '', supervisor: '',
      people: summary.participantNames.map((name, index) => ({ id: `summary-${summary.id}-${index}`, name, phone: '', company: '' })),
      vehicles: [], accompanyingVehicles: [], areaIds: baseData().areas.filter(area => summary.areaNames.includes(area.name)).map(area => String(area.id)) }
    return { ...blank, createdAt: Date.parse(summary.createdAt), subjects: blank.people, courseIds: [], taskIds: [], exemptTaskIds: [], vehicleSnapshots: [], noticeSnapshot: { title: '', content: '' }, source: 'external' }
  }
  function visitFrom(workspace: AppWorkspace): Visit {
    if (!workspace.application) {
      const type = typeCode(0, '来访申请')
      const blank = { id: String(workspace.applicationId), type, noticeAccepted: false, appointmentDate: '', timeSlot: '', hostName: '', visitReason: '', projectName: '', workArea: '', contractorCompany: '', supervisor: '', people: [], vehicles: [], accompanyingVehicles: [], areaIds: [] }
      return { ...blank, createdAt: 0, subjects: [], courseIds: [], taskIds: [], exemptTaskIds: [], vehicleSnapshots: [], source: 'internal', noticeSnapshot: { title: workspace.notice?.titleSnapshot || '', content: workspace.notice?.contentSnapshot || '' } }
    }
    const app = workspace.application
    const visit = summaryVisit(app)
    visit.people = app.participants.map(person)
    visit.subjects = visit.people
    visit.source = app.source === 'internal' ? 'internal' : 'external'
    visit.noticeAcceptedAt = instant(app.notice.acceptedAt)
    visit.noticeAccepted = visit.noticeAcceptedAt !== undefined
    visit.noticeSnapshot = { title: app.notice.titleSnapshot, content: app.notice.contentSnapshot }
    visit.areaIds = app.areas.map(area => String(area.id))
    for (const area of app.areas) if (!baseData().areas.some(item => item.id === area.id)) {
      // The protected summary component reads the shared area catalogue.
      importArea(area.id, area.name)
    }
    for (const field of app.businessFields) {
      const key = fieldKeys[field.key]
      if (key) Object.assign(visit, { [key]: Array.isArray(field.value) ? field.value : field.displayValue })
    }
    visit.vehicles = app.vehicles.map(vehicle => ({ id: String(vehicle.id), plate: vehicle.plate, driver: '', phone: '', company: vehicle.transportCompany || '' }))
    visit.accompanyingVehicles = app.vehicles.map(vehicle => ({ id: String(vehicle.id), plate: vehicle.plate }))
    visit.vehicleSnapshots = app.vehicles.map(vehicle => ({ vehicleId: String(vehicle.id), plate: vehicle.plate, company: vehicle.transportCompany || '', checkedInAt: instant(vehicle.checkedInAt), checkedOutAt: instant(vehicle.checkedOutAt) }))
    const current = (workspace.tasks || []).filter(item => item.isCurrentRound)
    visit.taskIds = current.map(item => String(item.record.id))
    visit.courseIds = [...new Set(current.map(item => String(item.record.trainingCourseId)))]
    visit.exemptTaskIds = current.filter(item => item.isExempt).map(item => String(item.record.id))
    return visit
  }
  function rebuild() {
    const visits = new Map<string, Visit>()
    const tasks = new Map<string, TrainingTask>()
    const people = new Map<string, Person>()
    if (access === 'owner') for (const item of ownerList) visits.set(String(item.id), summaryVisit(item))
    else {
      for (const record of searchTasks.values()) tasks.set(String(record.id), taskFrom(record))
      for (const [key, value] of searchPeople) people.set(key, value)
    }
    for (const [key, workspace] of apps) {
      if (!key.startsWith(`${access}:`)) continue
      const visit = visitFrom(workspace)
      if (access !== 'owner' || applicationId || ownerList.some(item => String(item.id) === visit.id)) visits.set(visit.id, visit)
      for (const value of visit.subjects) people.set(value.id, value)
      for (const item of workspace.tasks || []) if (item.isCurrentRound) tasks.set(String(item.record.id), taskFrom(item.record))
    }
    for (const [key, workspace] of trainings) {
      if (!key.startsWith(`${access}:`)) continue
      tasks.set(String(workspace.record.id), taskFrom(workspace.record, workspace))
      const value = person(workspace.participant)
      people.set(value.id, { ...people.get(value.id), ...value, phone: people.get(value.id)?.phone || value.phone })
    }
    state = { ...state, visits: [...visits.values()], tasks: [...tasks.values()], participants: [...people.values()] }
    publish()
  }
  function importArea(id: number, name: string) {
    if (!AREAS.some(item => item.id === String(id))) AREAS.push({ id: String(id), name, caption: '', description: '', icon: 'building', color: 'green' })
  }
  function applyApplication(workspace: AppWorkspace, scope: Access) {
    const id = String(workspace.application?.id ?? workspace.applicationId)
    apps.set(appKey(id, scope), workspace)
    if (workspace.browserTotals) browserTotals = workspace.browserTotals
    if (scope === 'owner' && workspace.application) ownerList = ownerList.map(item => item.id === workspace.application!.id ? workspace.application! : item)
    rebuild()
  }
  function keepVideoUrls(workspace: TrainingWorkspace, cached?: TrainingWorkspace): TrainingWorkspace {
    // Progress responses re-sign the same file; changing a valid src interrupts playback.
    if (!cached) return workspace
    return { ...workspace, videos: workspace.videos.map(video => {
      const previous = cached.videos.find(item => item.id === video.id && item.file.reference === video.file.reference)
      return previous && Date.parse(previous.file.urlExpiresAt) > api.now()
        ? { ...video, file: { ...video.file, url: previous.file.url, urlExpiresAt: previous.file.urlExpiresAt } }
        : video
    }) }
  }
  function applyTraining(workspace: TrainingWorkspace, context: { access: Access; visit: string | null; identity: number | undefined }, refreshMedia = false) {
    if (context.access === 'participant' && context.identity !== api.learning?.participantId) throw new Error('查询人员已切换，请重新打开本人任务')
    for (const [key, cached] of trainings) if (key.startsWith(`${context.access}:`) && cached.record.id === workspace.record.id) {
      const videos = refreshMedia ? workspace.videos : keepVideoUrls(workspace, cached).videos
      trainings.set(key, { ...cached, record: workspace.record, videos, pdf: workspace.pdf, exam: workspace.exam, result: workspace.result, completion: workspace.completion, examHistory: workspace.examHistory })
    }
    const key = trainingKey(String(workspace.record.id), context.visit, context.access)
    trainings.set(key, refreshMedia ? workspace : keepVideoUrls(workspace, trainings.get(key)))
    if (workspace.browserTotals) browserTotals = workspace.browserTotals
    if (context.access === 'participant' && searchTasks.has(workspace.record.id)) searchTasks.set(workspace.record.id, workspace.record)
    for (const [key, app] of apps) if (key.startsWith(`${context.access}:`) && app.tasks?.some(item => item.record.id === workspace.record.id)) {
      apps.set(key, { ...app, tasks: app.tasks.map(item => item.record.id === workspace.record.id ? { ...item, record: workspace.record, actions: workspace.actions } : item) })
    }
    rebuild()
  }
  async function request<T>(path: string, options: Parameters<typeof api.request>[1] = {}): Promise<T> {
    const epoch = generation
    const requestIdentity = api.learning?.participantId
    const visit = applicationId
    try {
      const response = await api.request<T>(path, options)
      if (options.access === 'participant' && epoch !== generation) throw new Error('查询人员已切换，请使用最新查询结果')
      return response
    } catch (error) {
      if (error instanceof ApiError) {
        if (options.access === 'participant' && epoch !== generation) throw error
        if (error.problem.baseData) applyBaseData(error.problem.baseData)
        if (error.problem.workspace) applyApplication(error.problem.workspace as AppWorkspace, options.access || 'owner')
        if (error.problem.trainingWorkspace) applyTraining(error.problem.trainingWorkspace as TrainingWorkspace, { access: options.access || 'owner', visit, identity: requestIdentity })
      }
      throw error
    }
  }
  function context(taskId: string) {
    const value = { access, visit: applicationId, identity: api.learning?.participantId, generation }
    if (value.access === 'participant' && api.learning?.participantId !== Number(store.task(taskId).subjectId)) throw new Error('只能操作本人的培训任务')
    return value
  }
  function assertContext(value: ReturnType<typeof context>) {
    if (value.access === 'participant' && (value.identity !== api.learning?.participantId || value.generation !== generation)) throw new Error('查询人员已切换，请使用最新查询结果')
  }
  function queue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const promise = (writes.get(key) || Promise.resolve()).catch(() => undefined).then(operation)
    writes.set(key, promise)
    void promise.finally(() => { if (writes.get(key) === promise) writes.delete(key) }).catch(() => undefined)
    return promise
  }
  function dedupe(key: string, operation: () => Promise<void>) {
    const current = reads.get(key)
    if (current) return current
    const promise = operation().finally(() => { if (reads.get(key) === promise) reads.delete(key) })
    reads.set(key, promise)
    return promise
  }
  const store = {
    now: () => api.now(),
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    recovered: () => false,
    refresh() { state = { ...state, drafts: drafts() }; publish() },
    browserTotals: () => browserTotals,
    entryTypes: () => baseData().visitTypes.map(type => type.code),
    recordTotals: () => totals,
    recordSummary: (id: string) => ownerList.find(item => String(item.id) === id),
    requiresNotice: (id: string) => apps.get(appKey(id))?.view === 'notice',
    activateContext(visit: string | null | undefined, scope: Access = 'owner') {
      const changed = access !== scope
      access = scope; applicationId = visit || null
      if (changed) rebuild()
    },
    saveDraft(draft: Draft) {
      const saved = { ...state.drafts, [draft.type]: structuredClone(draft) }
      storage.write(STORAGE_KEY, { drafts: saved })
      state = { ...state, drafts: saved }; publish()
    },
    findParticipant(name: string, phone: string) { return state.participants.find(value => value.name === name.trim() && value.phone === phone.trim()) },
    findVehicle(plate: string) { return state.vehicleProfiles.find(value => value.plate === normalizePlate(plate)) },
    course(id: string) { const value = state.tasks.find(task => task.courseId === id)?.courseSnapshot || COURSES.find(course => course.id === id); if (!value) throw new Error('课程不存在'); return value },
    task(id: string) { const value = state.tasks.find(task => task.id === id); if (!value) throw new Error('培训任务不存在'); return value },
    currentTasks(visit?: string) {
      const tasks = visit ? state.tasks.filter(task => state.visits.find(item => item.id === visit)?.taskIds.includes(task.id)) : state.tasks
      return tasks.filter(task => !tasks.some(other => other.subjectId === task.subjectId && other.courseId === task.courseId && other.roundNumber > task.roundNumber))
    },
    isTrainingValid(task: TrainingTask) { return !!task.result?.passed && task.completedAt !== undefined && task.completedAt <= api.now() && task.validUntil !== undefined && api.now() < task.validUntil },
    canWriteTask(id: string) {
      const task = state.tasks.find(item => item.id === id)
      if (!task || access === 'participant' && Number(task.subjectId) !== api.learning?.participantId) return false
      const app = applicationId ? apps.get(appKey(applicationId)) : undefined
      if (app?.application && !task.result && ['cancelled', 'checkedOut', 'rejected'].includes(app.application.status)) return false
      return true
    },
    taskVisits(id: string) {
      const found = state.visits.filter(visit => visit.taskIds.includes(id))
      if (found.length) return found
      return (related.get(id) || []).map(item => ({ id: String(item.id), type: typeCode(-item.id, item.visitTypeName) }))
    },
    taskHome(_id: string, visit?: string | null) { return visit ? `/tasks/${visit}${access === 'participant' ? '?access=participant' : ''}` : '/training' },
    async loadApplication(id: string, scope: Access = 'owner', force = false) {
      const key = appKey(id, scope)
      if (!force && apps.has(key)) { rebuild(); return }
      const epoch = generation
      return dedupe(key, async () => {
        const workspace = await request<AppWorkspace>(`/applications/${id}/workspace`, { method: 'POST', access: scope })
        if (scope !== 'participant' || epoch === generation) applyApplication(workspace, scope)
      })
    },
    async loadTraining(id: string, visit: string | null = null, scope: Access = visit ? 'owner' : 'participant', force = false) {
      const key = trainingKey(id, visit, scope)
      const cached = trainings.get(key)
      const urlsExpired = cached?.videos.some(video => Date.parse(video.file.urlExpiresAt) <= api.now())
      if (!force && cached && !urlsExpired) { rebuild(); return }
      const value = { access: scope, visit, identity: api.learning?.participantId }
      return dedupe(key, async () => {
        if (visit) {
          await store.loadApplication(visit, scope)
          if (apps.get(appKey(visit, scope))?.view === 'notice') return
        }
        const workspace = await request<TrainingWorkspace>(`/training-records/${id}/workspace`, { method: 'POST', access: scope, body: { applicationId: visit ? Number(visit) : null } })
        applyTraining(workspace, value, true)
        if (visit && workspace.currentTrainingRecordId !== workspace.record.id) await store.loadApplication(visit, scope, true)
      })
    },
    async loadRecords(query = '') {
      const sequence = ++recordsSequence
      if (query === lastRecordsQuery) return
      const records: Summary[] = []
      let page = 1
      let response: MyApplications
      do {
        response = await request<MyApplications>(`/applications?q=${encodeURIComponent(query)}&page=${page++}&pageSize=50`)
        records.push(...response.records.items)
      } while (records.length < response.records.totalCount && response.records.items.length)
      if (sequence !== recordsSequence) return
      ownerList = records; totals = response.totals
      lastRecordsQuery = query
      rebuild()
    },
    async register(draft: Draft) {
      const config = configuration(draft.type)
      const errors = registrationErrors(draft)
      if (Object.keys(errors).length) throw new Error(Object.values(errors)[0])
      if (!draft.noticeAccepted || draft.noticeVersion !== config.notice.version) throw new Error('请重新阅读并确认当前须知')
      if (config.fields.some(field => field.required && !fieldKeys[field.key])) throw new Error('该类型的必填业务字段尚无对应输入项，请联系管理员')
      const participants = trainingSubjects(draft).map(value => ({ name: value.name, phone: value.phone, company: value.company, trade: value.trade || null }))
      const vehicles = [...draft.vehicles.map(value => ({ plate: normalizePlate(value.plate), transportCompany: value.company.trim(), driverName: value.driver.trim() || null })),
        ...draft.accompanyingVehicles.map(value => ({ plate: normalizePlate(value.plate), transportCompany: null, driverName: null }))]
      const workspace = await request<AppWorkspace>('/applications', { method: 'POST', body: { clientRequestId: draft.id, visitTypeId: config.visitTypeId,
        configurationVersion: draft.configurationVersion || config.configurationVersion, appointmentDate: draft.appointmentDate,
        timeSlot: baseData().timeSlots.find(option => option.label === draft.timeSlot)?.value, noticeId: config.notice.id, noticeVersion: draft.noticeVersion,
        noticeAccepted: true, dynamicValues: draftValues(draft), participants, vehicles, areaIds: draft.areaIds.map(Number) } })
      access = 'owner'; lastRecordsQuery = undefined; applyApplication(workspace, 'owner')
      const next = { ...state.drafts }; delete next[draft.type]
      state = { ...state, drafts: next }
      try { storage.write(STORAGE_KEY, { drafts: next }) } catch { /* the application is already committed */ }
      publish()
      return visitFrom(workspace)
    },
    acceptNotice(id: string) {
      const current = state.visits.find(visit => visit.id === id)
      if (!current) throw new Error('申请不存在')
      if (current.noticeAcceptedAt !== undefined || notices.has(appKey(id))) return current
      const scope = access
      const key = appKey(id, scope)
      const workspace = apps.get(key)
      const notice = workspace?.application?.notice || workspace?.notice
      const etag = workspace?.application?.etag || workspace?.applicationEtag
      if (!notice || !etag) throw new Error('须知尚未加载，请刷新页面')
      const promise = request<AppWorkspace>(`/applications/${id}/notice-acceptance`, { method: 'POST', access: scope, etag, body: { noticeId: notice.id, accepted: true } })
        .then(value => applyApplication(value, scope)).catch(error => { window.dispatchEvent(new CustomEvent('visitsafe:api-error', { detail: error })) }).finally(() => { notices.delete(key) })
      notices.set(key, promise)
      return current
    },
    async pendingTasks(name: string, phone: string) {
      if (!name.trim() || !new RegExp(baseData().validationRules.phonePattern).test(phone.trim())) throw new Error('请填写登记姓名和有效手机号')
      const epoch = ++generation
      const response = await request<SearchResult>('/learning-task-search', { method: 'POST', body: { name: name.trim(), phone: phone.trim(), pageSize: 50 } })
      if (epoch !== generation) throw new Error('已发起新的查询，请使用最新查询结果')
      api.learning = response.participant && response.learningToken && response.learningTokenExpiresAt ? { token: response.learningToken, participantId: response.participant.id, expiresAt: response.learningTokenExpiresAt } : null
      try { if (api.learning) sessionStorage.setItem('visitsafe.learning.v1', JSON.stringify(api.learning)); else sessionStorage.removeItem('visitsafe.learning.v1') } catch { /* in-memory grant remains usable */ }
      for (const key of apps.keys()) if (key.startsWith('participant:')) apps.delete(key)
      for (const key of trainings.keys()) if (key.startsWith('participant:')) trainings.delete(key)
      for (const key of reads.keys()) if (key.startsWith('participant:')) reads.delete(key)
      searchTasks.clear(); searchPeople.clear(); related.clear()
      if (response.participant) searchPeople.set(String(response.participant.id), { ...person(response.participant), phone: phone.trim() })
      let taskPage = response.tasks
      do {
        for (const task of taskPage.items) { searchTasks.set(task.record.id, task.record); related.set(String(task.record.id), task.relatedApplications) }
        if (searchTasks.size >= taskPage.totalCount || !taskPage.items.length) break
        const more = await request<SearchResult>('/learning-task-search', { method: 'POST', body: { name: name.trim(), phone: phone.trim(), tasksPage: taskPage.page + 1, pageSize: 50 } })
        if (epoch !== generation) throw new Error('查询人员已切换')
        taskPage = more.tasks
      } while (true)
      rebuild()
      return [...searchTasks.values()].map(record => taskFrom(record))
    },
    async startLearning(id: string) { return progress(id, { startPlayback: true }) },
    async completeLesson(id: string, lessonId: string) { return progress(id, { completedVideoIds: [Number(lessonId)] }) },
    async beginExam(id: string) { return startExam(id) },
    async retake(id: string) { return startExam(id) },
    async answer(id: string, questionId: string, values: number[]) {
      const value = context(id)
      const revision = examRevisions.get(id) || 0
      return queue(`exam:${id}`, async () => {
        try {
          assertContext(value)
          if (revision !== (examRevisions.get(id) || 0)) throw new Error('考试内容已在其他页面更新，请重新确认答案')
          const workspace = trainings.get(trainingKey(id, value.visit, value.access))
          if (!workspace?.exam) throw new Error('考试尚未加载')
          const updated = await request<TrainingWorkspace>(`/exam-attempts/${workspace.exam.id}/save`, { method: 'POST', access: value.access, etag: workspace.exam.etag,
            body: { applicationId: value.visit ? Number(value.visit) : null, changes: { [questionId]: values }, submit: false } })
          applyTraining(updated, value); failedAnswers.get(id)?.delete(questionId)
          return store.task(id)
        } catch (error) {
          if (error instanceof ApiError && error.status === 412) { failedAnswers.delete(id); examRevisions.set(id, revision + 1) }
          else { const failed = failedAnswers.get(id) || new Set<string>(); failed.add(questionId); failedAnswers.set(id, failed) }
          throw error
        }
      })
    },
    async submitExam(id: string) {
      const value = context(id)
      const revision = examRevisions.get(id) || 0
      return queue(`exam:${id}`, async () => {
        assertContext(value)
        if (revision !== (examRevisions.get(id) || 0)) throw new Error('考试内容已更新，请重新确认后交卷')
        if (failedAnswers.get(id)?.size) throw new Error('答案尚未保存，请重新选择未保存的答案后再交卷')
        const workspace = trainings.get(trainingKey(id, value.visit, value.access))
        if (!workspace?.exam) throw new Error('考试尚未加载')
        const updated = await request<TrainingWorkspace>(`/exam-attempts/${workspace.exam.id}/save`, { method: 'POST', access: value.access, etag: workspace.exam.etag,
          body: { applicationId: value.visit ? Number(value.visit) : null, changes: {}, submit: true } })
        applyTraining(updated, value)
        if (!updated.result) throw new Error('考试尚未完成')
        return result(updated.result)
      })
    },
    async deleteVisit(id: string) {
      if (access !== 'owner') throw new Error('只能由申请提交者取消申请')
      const workspace = apps.get(appKey(id))
      if (!workspace?.application?.canCancel) throw new Error('当前申请不可取消')
      const updated = await request<AppWorkspace>(`/applications/${id}/cancel`, { method: 'POST', etag: workspace.application.etag })
      lastRecordsQuery = undefined; applyApplication(updated, 'owner')
      return true
    },
  }
  async function progress(id: string, body: { startPlayback?: boolean; completedVideoIds?: number[] }) {
    const value = context(id)
    return queue(`progress:${id}`, async () => {
      assertContext(value)
      const workspace = await request<TrainingWorkspace>(`/training-records/${id}/video-progress`, { method: 'PUT', access: value.access, body: { applicationId: value.visit ? Number(value.visit) : null, ...body } })
      applyTraining(workspace, value)
      return store.task(id)
    })
  }
  async function startExam(id: string) {
    const value = context(id)
    return queue(`exam:${id}`, async () => {
      assertContext(value)
      const previous = trainings.get(trainingKey(id, value.visit, value.access))?.record.latestSubmittedExamAttempt?.id
      const workspace = await request<TrainingWorkspace>(`/training-records/${id}/exam-attempts`, { method: 'POST', access: value.access, body: { applicationId: value.visit ? Number(value.visit) : null, expectedPreviousAttemptId: previous || null } })
      applyTraining(workspace, value); failedAnswers.delete(id)
      return store.task(id)
    })
  }
  return store
}

