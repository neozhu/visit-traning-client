export type EntryType = 'visitor' | 'logistics' | 'contractor'
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
}
export interface Visit extends Draft { createdAt: number; subjects: Person[]; courseIds: string[] }
export interface Lesson { id: string; title: string; description: string; source: string }
export interface Question { id: string; title: string; options: string[]; correct: number; explanation: string }
export interface Course { id: string; title: string; subtitle: string; icon: string; trainingValidityDays: number; lessons: Lesson[]; questions: Question[] }
export interface ExamAttempt { startedAt: number; deadlineAt: number; answers: Record<string, number> }
export interface ExamResult { score: number; passed: boolean; timedOut: boolean; submittedAt: number; answers: Record<string, number>; wrongIds: string[] }
export interface TrainingTask { id: string; visitId: string; subjectId: string; courseId: string; roundNumber: number; reusedFromTaskId?: string; completedLessons: string[]; attempt?: ExamAttempt; result?: ExamResult; completedAt?: number; validUntil?: number }
export interface AppState { version: 2; drafts: Partial<Record<EntryType, Draft>>; visits: Visit[]; tasks: TrainingTask[] }
export interface StoragePort { read(key: string): unknown; write(key: string, value: unknown): void }
