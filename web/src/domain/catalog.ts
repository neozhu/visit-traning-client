import type { Course, EntryType, Question } from './types'

export const TIME_SLOTS = ['08:30–12:00', '13:00–17:00']
export const VISIT_REASONS = ['会议', '面试', '洽谈']
export const LOGISTICS_REASONS = ['送货', '提货', '退货', '空车入厂']
export const CARGO_TYPES = ['原材料', '设备', '成品', '废料', '其他']
export const ENTRIES = {
  visitor: { label: '普通访客', description: '来访人员登记与安全培训', icon: 'user-home', color: 'green', notice: '请如实填写来访人员资料，遵守厂区管理规定，在被访人安排下进入申请区域。' },
  logistics: { label: '物流车辆', description: '司机及车辆登记与安全培训', icon: 'truck-home', color: 'orange', notice: '车辆遵守厂区限速与指定路线，装卸须听从现场指挥，每位司机均须取得有效的安全培训合格结果。' },
  contractor: { label: '施工人员', description: '施工人员登记与安全培训', icon: 'helmet-home', color: 'purple', notice: '施工前确认作业许可，按要求做好个人防护和现场隔离，服从现场负责人的安全管理。' },
} satisfies Record<EntryType, { label: string; description: string; icon: string; color: string; notice: string }>
export const AREAS = [
  { id: 'production', name: '生产区', caption: 'PRODUCTION', description: '生产车间、仓库及生产相关区域', icon: 'factory', color: 'blue' },
  { id: 'research', name: '研发区', caption: 'RESEARCH', description: '研发楼、实验室及技术相关区域', icon: 'flask', color: 'purple' },
  { id: 'office', name: '非生产区', caption: 'OFFICE', description: '办公楼、接待区及公共区域', icon: 'building', color: 'green' },
]
const questions: Omit<Question, 'id'>[] = [
  { title: '进入生产车间必须佩戴哪项个人防护用品？', options: ['安全帽', '太阳镜', '普通耳机', '围巾'], kind: 'single', correctIndexes: [0], explanation: '进入生产区域应正确佩戴安全帽，并按区域要求配齐防护用品。' },
  { title: '在厂区行走时应该选择哪条路线？', options: ['叉车行驶通道', '标识清晰的人行通道', '最短的设备间隙', '封闭施工区域'], kind: 'single', correctIndexes: [1], explanation: '行人应走专用人行通道，不与车辆或设备作业区域混行。' },
  { title: '发现设备异常或安全隐患时，应如何处理？', options: ['自行拆卸设备', '继续工作并忽略', '停止相关活动并报告现场负责人', '拍照后离开且不报告'], kind: 'single', correctIndexes: [2], explanation: '应停止危险活动、远离风险，并及时报告现场负责人。' },
  { title: '发生火警时，正确做法是什么？', options: ['沿疏散指示撤离至集合点', '返回取回随身物品', '乘电梯撤离', '围观事故现场'], kind: 'single', correctIndexes: [0], explanation: '按疏散指示有序撤离，不乘电梯，不返回取物。' },
  { title: '对于不熟悉的机器设备，访客应该怎么做？', options: ['尝试操作', '未经授权不触碰或操作', '请其他访客操作', '只要戴手套就可以操作'], kind: 'single', correctIndexes: [1], explanation: '所有设备操作需经过授权和专业培训，访客不得擅自操作。' },
]
const lesson = (id: string, title: string, description: string, video: string) => ({ id, title, description, source: `/assets/videos/${video}.mp4` })
const definitions: Omit<Course, 'questions'>[] = [
  { id: 'production', title: '生产区域安全培训', subtitle: '认识风险，安全进入生产现场', icon: 'factory', trainingValidityDays: 60, passScore: 80, examDurationMinutes: 15, lessons: [lesson('production-safety', '生产区域安全须知', '熟悉人行通道、设备安全和应急疏散，遵守现场标识与管理人员安排。', 'safety'), lesson('production-ppe', '个人防护用品使用', '正确佩戴安全帽和必要的防护用品，未经授权不要触碰设备，发现隐患及时报告。', 'ppe')] },
  { id: 'research', title: '研发区域安全培训', subtitle: '规范进入实验室与研发区域', icon: 'flask', trainingValidityDays: 60, passScore: 80, examDurationMinutes: 15, lessons: [lesson('research-safety', '实验室访问与防护', '由授权人员陪同进入实验室，按要求佩戴防护用品，不触碰试剂或设备。', 'research')] },
  { id: 'office', title: '非生产区域安全培训', subtitle: '熟悉公共区域与应急路线', icon: 'building', trainingValidityDays: 60, passScore: 80, examDurationMinutes: 15, lessons: [lesson('office-safety', '公共区域与应急疏散', '熟悉安全出口和指定集合点，遵守禁烟规定，发生火警时沿疏散标识有序撤离。', 'office')] },
  { id: 'traffic', title: '物流车辆安全培训', subtitle: '人车分流，规范装卸与停靠', icon: 'truck', trainingValidityDays: 60, passScore: 80, examDurationMinutes: 15, lessons: [lesson('traffic-safety', '厂区行车与装卸安全', '车辆遵守厂区限速、指定行车路线和现场指挥，司机走人行通道。', 'traffic')] },
  { id: 'construction', title: '施工人员安全培训', subtitle: '持证作业，做好施工防护', icon: 'helmet', trainingValidityDays: 60, passScore: 80, examDurationMinutes: 15, lessons: [lesson('construction-safety', '施工许可与现场防护', '施工前确认作业许可、人员资质和隔离防护，发现风险停止作业并报告。', 'construction')] },
]
export const COURSES: Course[] = definitions.map(course => ({ ...course, questions: questions.map((question, index) => ({ ...question, id: `${course.id}-q${index + 1}` })) }))
export const COURSE_RULES: Record<EntryType, Record<string, string[]>> = {
  visitor: { production: ['production'], research: ['research'], office: ['office'] },
  logistics: { production: ['production', 'traffic'], research: ['research', 'traffic'], office: ['office', 'traffic'] },
  contractor: { production: ['production', 'construction'], research: ['research', 'construction'], office: ['office', 'construction'] },
}
