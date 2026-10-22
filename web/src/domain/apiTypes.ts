export type Access = 'owner' | 'participant'
export type Value = string | number | boolean | string[] | null
export type ApplicationStatus = 'pendingApproval' | 'approved' | 'checkedIn' | 'checkedOut' | 'rejected' | 'cancelled' | 'expired'
export type ApprovalKind = 'business' | 'area'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
export type TrainingState = 'notStarted' | 'learning' | 'readyForExam' | 'examInProgress' | 'retakeRequired' | 'passed' | 'expired'
export type QuestionType = 'singleChoice' | 'multipleChoice'

export interface Page<T> { items: T[]; page: number; pageSize: number; totalCount: number }
export interface FileDto { reference: string; fileName: string; contentType: string; sizeBytes: number | null; url: string; urlExpiresAt: string }
export interface UploadedFile { reference: string; fileName: string; contentType: string; sizeBytes: number; expiresAt: string }
export interface PersonInput { name: string; phone: string; company: string | null; trade: string | null; idCardNumber: string | null; attachmentReference: string | null }
export interface VehicleInput { plate: string; transportCompany: string | null; driverName: string | null }
export interface Option { value: string; label: string }
export interface Field { key: string; label: string; control: string; required: boolean; readOnly: boolean; sortOrder: number; minLength: number | null; maxLength: number | null; minimum: number | null; maximum: number | null; options: Option[] }
export interface Notice { id: number; version: string; title: string; content: string }
export interface VisitType { id: number; code: string; name: string; description: string | null; caption: string | null; color: string | null; icon: string | null; sortOrder: number; vehicleRequired: boolean; transportCompanyRequired: boolean }
export interface Area { id: number; code: string; name: string; description: string | null; caption: string | null; color: string | null; icon: string | null; sortOrder: number }
export interface Course { id: number; title: string; subtitle: string | null; icon: string | null; videoCount: number; questionCount: number; passingScore: number; examDurationMinutes: number }
export interface AreaRule { areaId: number; selectable: boolean; unavailableReason: string | null; requiredCourseIds: number[] }
export interface ParticipantRules { minimumCount: number }
export interface RegistrationConfig { visitTypeId: number; configurationVersion: string; applicationTemplateId: number; fields: Field[]; notice: Notice; areaRules: AreaRule[]; participantRules: ParticipantRules }
export interface BaseData {
  generatedAt: string
  visitTypes: VisitType[]
  registrationConfigs: RegistrationConfig[]
  timeSlots: Option[]
  areas: Area[]
  courses: Course[]
  attachmentRules: { allowedContentTypes: string[]; maxSizeBytes: number; maxFilesPerParticipant: number }
  validationRules: { phonePattern: string; platePattern: string; plateIgnoredCharacters: string; plateUppercase: boolean; participantNameMaxLength: number | null; companyMaxLength: number | null; tradeMaxLength: number | null; driverNameMaxLength: number }
}
export interface ClientContext { clientToken: string; businessTimeZone: string; today: string }
export interface BrowserTotals { applicationCount: number; pendingTrainingCount: number }
export interface ProfileMatches {
  participants: { name: string; phone: string; profile: { id: number; company: string | null; trade: string | null } | null }[]
  vehicles: { plate: string; profile: { id: number; transportCompany: string | null; driverName: string | null } | null }[]
}
export interface BootstrapRequest { knownBaseDataVersion?: string | null; participantKeys?: { name: string; phone: string }[]; plates?: string[] }
export interface Bootstrap { clientContext: ClientContext; baseDataVersion: string; baseData: BaseData | null; totals: BrowserTotals; profileMatches: ProfileMatches }
export interface Submission { clientRequestId: string; visitTypeId: number; configurationVersion: string; appointmentDate: string; timeSlot: string; noticeId: number; noticeVersion: string; noticeAccepted: boolean; dynamicValues: Record<string, Value>; participants: PersonInput[]; vehicles: VehicleInput[]; areaIds: number[] }
export interface TrainingSummary { participantCount: number; qualifiedParticipantCount: number; requiredRecordCount: number; validRecordCount: number; allQualified: boolean }
export interface Summary { id: number; visitTypeId: number; visitTypeName: string; status: ApplicationStatus; createdAt: string; appointmentDate: string; timeSlot: string; participantNames: string[]; areaNames: string[]; training: TrainingSummary; canCancel: boolean }
export interface ApplicationNotice { id: number; titleSnapshot: string; contentSnapshot: string; acceptedAt: string | null }
export interface Participant { id: number; name: string; phone: string; company: string | null; trade: string | null; idCardNumber: string | null; attachment: FileDto | null; checkedInAt: string | null; checkedOutAt: string | null }
export interface Vehicle { id: number; plate: string; transportCompany: string | null; checkedInAt: string | null; checkedOutAt: string | null }
export interface ApprovalTask { id: number; kind: ApprovalKind; visitAreaId: number | null; status: ApprovalStatus; reviewedAt: string | null; reviewComment: string | null }
export interface Application extends Summary {
  etag: string
  clientRequestId: string
  source: 'external' | 'internal'
  reviewedAt: string | null
  checkedInAt: string | null
  checkedOutAt: string | null
  notice: ApplicationNotice
  businessFields: { key: string; label: string; value: Value; displayValue: string }[]
  participants: Participant[]
  vehicles: Vehicle[]
  areas: { id: number; name: string }[]
  approvalTasks: ApprovalTask[]
}
export interface Actions { canLearn: boolean; canStartExam: boolean; canRetake: boolean }
export interface AttemptSummary { id: number; attemptNumber: number; startedAt: string; deadlineAt: string; submittedAt: string | null; score: number | null; passed: boolean | null; timedOut: boolean }
export interface TrainingRecord { id: number; participantId: number; trainingCourseId: number; roundNumber: number; state: TrainingState; startedAt: string | null; completedVideoIds: number[]; completedAt: string | null; validUntil: string | null; isValid: boolean; course: Course; activeExamAttempt: AttemptSummary | null; latestSubmittedExamAttempt: AttemptSummary | null }
export interface ApplicationTask { record: TrainingRecord; participantId: number; isCurrentRound: boolean; isExempt: boolean; actions: Actions }
export interface AppWorkspace {
  view: 'notice' | 'detail'
  access: Access
  currentParticipantId: number | null
  browserTotals: BrowserTotals | null
  applicationId?: number
  applicationEtag?: string
  notice?: ApplicationNotice
  application?: Application
  tasks?: ApplicationTask[]
}
export interface ApplicationTotals { applicationCount: number; participantCount: number; validRecordCount: number }
export interface MyApplications { records: Page<Summary>; totals: ApplicationTotals }
export interface Identity { id: number; name: string; maskedPhone: string }
export interface Completion { trainingRecordId: number; sourceExamAttemptId: number; participant: Identity; course: { id: number; title: string }; score: number; completedAt: string; validUntil: string; isValid: boolean }
export interface RelatedApplication { id: number; visitTypeName: string; appointmentDate: string }
export interface LearningTask { record: TrainingRecord; relatedApplications: RelatedApplication[] }
export interface ParticipantApplication { id: number; visitTypeName: string; source: 'external' | 'internal'; status: ApplicationStatus; createdAt: string; appointmentDate: string; timeSlot: string; areaNames: string[]; noticeAccepted: boolean; myTraining: { requiredRecordCount: number; validRecordCount: number; allQualified: boolean } }
export interface CompletedRecord { record: TrainingRecord; completion: Completion }
export interface LearningSearchRequest { name: string; phone: string; tasksPage?: number; applicationsPage?: number; completedRecordsPage?: number; pageSize?: number }
export interface SearchResult { participant: Identity | null; learningToken: string | null; learningTokenExpiresAt: string | null; tasks: Page<LearningTask>; applications: Page<ParticipantApplication>; completedRecords: Page<CompletedRecord> }
export type Answers = Record<string, number[]>
export interface ExamQuestion { id: number; type: QuestionType; title: string; options: string[]; points: number; correctIndexes?: number[] }
export interface Exam extends AttemptSummary { etag: string; trainingRecordId: number; questions: ExamQuestion[]; answers: Answers; passingScore: number; canAnswer: boolean; canSubmit: boolean }
export interface WrongQuestion { id: number; type: QuestionType; title: string; options: string[]; selectedIndexes: number[]; correctIndexes: number[]; explanation: string }
export interface Result { examAttemptId: number; trainingRecordId: number; attemptNumber: number; submittedAt: string; score: number; passed: boolean; timedOut: boolean; answers: Answers; wrongQuestionIds: number[]; wrongQuestions: WrongQuestion[]; completedAt: string | null; validUntil: string | null }
export interface TrainingWorkspace {
  browserTotals: BrowserTotals | null
  record: TrainingRecord
  participant: Identity
  applicationContext: { applicationId: number; status: ApplicationStatus; noticeAccepted: boolean; isExempt: boolean } | null
  currentTrainingRecordId: number
  actions: Actions
  videos: { id: number; title: string; description: string | null; durationSeconds: number; file: FileDto }[]
  pdf: FileDto | null
  exam: Exam | null
  result: Result | null
  examHistory: Page<AttemptSummary>
  completion: Completion | null
}
export interface TrainingContext { access: Access; applicationId: number | null; participantId?: number | null }
export interface TrainingWorkspaceRequest { applicationId?: number | null; examAttemptId?: number | null; examHistoryPage?: number; examHistoryPageSize?: number }
export interface VideoProgressRequest { applicationId?: number | null; startPlayback?: boolean; completedVideoIds?: number[] }
export interface StartExamRequest { applicationId?: number | null; expectedPreviousAttemptId?: number | null }
export interface SaveExamRequest { applicationId: number | null; changes: Answers; submit?: boolean }
