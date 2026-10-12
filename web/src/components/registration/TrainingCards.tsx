import { AREAS } from '../../domain/store'
import type { Course } from '../../domain/types'
import { FieldError, Icon, Section } from '../UI'

export function AreaSelectionCard({ selectedIds, error, subjectCount, courseCount, onToggle }: {
  selectedIds: string[]
  error?: string
  subjectCount: number
  courseCount: number
  onToggle: (id: string) => void
}) {
  return <Section title="请选择访问区域" subtitle="可多选，按登记类型与区域匹配必修课程">
    {AREAS.map(area => <button type="button" key={area.id} aria-label={area.name} aria-pressed={selectedIds.includes(area.id)} className={`area-card ${selectedIds.includes(area.id) ? 'selected' : ''}`} onClick={() => onToggle(area.id)}>
      <span className={`entry-icon ${area.color}`}><Icon name={area.icon} size={30} /></span>
      <span className="entry-copy"><strong>{area.name}</strong><span>{area.description}</span><small>{area.caption}</small></span>
      <span className="selection-check" aria-hidden="true">{selectedIds.includes(area.id) && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4 10-10" /></svg>}</span>
    </button>)}
    <FieldError message={error} />
    {courseCount > 0 && <div className="info-banner">{subjectCount} 位人员 · 每人 {courseCount} 门课程 · 共 {subjectCount * courseCount} 项任务</div>}
  </Section>
}

export function RequiredCoursesCard({ courses, subjectCount }: { courses: Course[]; subjectCount: number }) {
  return <Section title="每人必修课程">
    <div className="card">
      {courses.map(course => <div className="course-line" key={course.id}><Icon name="check-green" size={18} />{course.title}</div>)}
      <p className="muted small">{subjectCount} 位人员，共 {subjectCount * courses.length} 项个人课程任务</p>
    </div>
  </Section>
}
