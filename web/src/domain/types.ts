export type EntryType = string
export interface Person { id: string; name: string; phone: string; company: string; trade?: string }
export interface Vehicle { id: string; plate: string; driver: string; phone: string; company: string }
export interface AccompanyingVehicle { id: string; plate: string }
export interface Draft {
  id: string
  type: EntryType
  noticeAccepted: boolean
  appointmentDate: string
  timeSlot: string
  hostName: string
  visitReason: string
  logisticsReasons?: string[]
  logisticsContact?: string
  cargoType?: string
  logisticsOrderNumber?: string
  projectName: string
  workArea: string
  contractorCompany: string
  supervisor: string
  people: Person[]
  vehicles: Vehicle[]
  accompanyingVehicles: AccompanyingVehicle[]
  areaIds: string[]
  configurationVersion?: string
  noticeVersion?: string
}
export interface VehicleProfile { id: string; plate: string; company: string; driverName?: string }
export interface VehicleSnapshot { vehicleId: string; plate: string; company: string; driverName?: string; checkedInAt?: number; checkedInById?: string; checkedOutAt?: number; checkedOutById?: string }
export interface NoticeSnapshot { title: string; content: string }
export interface Visit extends Draft { createdAt: number; subjects: Person[]; courseIds: string[]; taskIds: string[]; exemptTaskIds: string[]; vehicleSnapshots: VehicleSnapshot[]; noticeSnapshot: NoticeSnapshot; noticeAcceptedAt?: number; source: 'external' | 'internal' }
export interface Lesson { id: string; title: string; description: string; source: string; durationSeconds?: number }
export interface Question { id: string; title: string; options: string[]; kind: 'single' | 'multiple'; correctIndexes: number[]; explanation: string }
export interface Course { id: string; title: string; subtitle: string; icon: string; trainingValidityDays: number; passScore: number; examDurationMinutes: number; lessons: Lesson[]; questions: Question[] }
export interface ExamAttempt { id: string; attemptNumber: number; startedAt: number; deadlineAt: number; answers: Record<string, number[]> }
export interface ExamResult { score: number; passed: boolean; timedOut: boolean; submittedAt: number; answers: Record<string, number[]>; wrongIds: string[] }
export interface CompletedExam extends ExamAttempt { result: ExamResult }
export interface TrainingTask { id: string; subjectId: string; courseId: string; roundNumber: number; courseSnapshot: Course; startedAt?: number; completedLessons: string[]; attempt?: ExamAttempt; result?: ExamResult; examHistory: CompletedExam[]; completedAt?: number; validUntil?: number }
export interface AppState { version: 3; drafts: Partial<Record<EntryType, Draft>>; visits: Visit[]; tasks: TrainingTask[]; participants: Person[]; vehicleProfiles: VehicleProfile[] }
export interface StoragePort { read(key: string): unknown; write(key: string, value: unknown): void }
