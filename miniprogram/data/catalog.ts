import { EntryType, Question } from '../models/visit'

export const AREAS = [
  { id: 'production', name: '生产区', subtitle: '生产车间、仓库与生产相关区域', caption: 'PRODUCTION', color: 'blue', icon: 'factory' },
  { id: 'research', name: '研发区', subtitle: '研发楼、实验室与技术相关区域', caption: 'RESEARCH', color: 'purple', icon: 'flask' },
  { id: 'office', name: '非生产区', subtitle: '办公楼、接待区、食堂等公共区域', caption: 'OFFICE', color: 'green', icon: 'building' }
]

export const ENTRY_DESCRIPTIONS: Record<EntryType, string> = {
  training: '填写信息，直接开始安全培训', visitor: '来访人员登记与培训',
  logistics: '司机及车辆登记与培训', contractor: '施工人员登记与培训'
}

export interface Lesson {
  id: string
  title: string
  description: string
  source: string
  duration: string
}

export interface Plan {
  id: string
  title: string
  subtitle: string
  icon: string
  lessons: Lesson[]
  questions: Question[]
}

const baseQuestions: Omit<Question, 'id'>[] = [
  { title: '进入生产车间必须佩戴哪项个人防护用品？', options: ['安全帽', '太阳镜', '普通耳机', '围巾'], correct: 0, explanation: '进入生产区域应正确佩戴安全帽，并按区域要求配齐防护用品。' },
  { title: '在厂区行走时应该选择哪条路线？', options: ['叉车行驶通道', '标识清晰的人行通道', '最短的设备间隙', '封闭施工区域'], correct: 1, explanation: '行人应走专用人行通道，不与车辆或设备作业区域混行。' },
  { title: '发现设备异常或安全隐患时，应如何处理？', options: ['自行拆卸设备', '继续工作并忽略', '停止相关活动并报告现场负责人', '拍照后离开且不报告'], correct: 2, explanation: '应停止危险活动、远离风险，并及时报告现场负责人。' },
  { title: '发生火警时，正确做法是什么？', options: ['沿疏散指示撤离至集合点', '返回取回随身物品', '乘电梯撤离', '围观事故现场'], correct: 0, explanation: '按疏散指示有序撤离，不乘电梯，不返回取物。' },
  { title: '对于不熟悉的机器设备，访客应该怎么做？', options: ['尝试操作', '未经授权不触碰或操作', '请其他访客操作', '只要戴手套就可以操作'], correct: 1, explanation: '所有设备操作需经过授权和专业培训，访客不得擅自操作。' },
  { title: '发现有人受伤时，应当首先做什么？', options: ['立即搬动伤者', '离开现场', '确认现场安全并呼叫救援', '让伤者继续工作'], correct: 2, explanation: '先确认自身与现场安全，再联系现场负责人和专业救援。' },
  { title: '进入实验室时，应当遵守哪项要求？', options: ['随意触摸试剂', '由授权人员陪同并按要求佩戴防护用品', '携带食物进入', '自行开启实验设备'], correct: 1, explanation: '进入实验室应有授权陪同，佩戴规定的防护用品，禁止饮食。' },
  { title: '厂区禁止吸烟的区域应当如何遵守？', options: ['只在指定吸烟区吸烟', '无人时可以吸烟', '开窗后可以吸烟', '避开摄像头即可'], correct: 0, explanation: '严禁在禁烟区域吸烟，只能在允许的指定区域吸烟。' },
  { title: '看到警戒线和“禁止进入”标识时，应当怎么做？', options: ['跨越警戒线', '跟随其他人进入', '停止进入并联系负责人', '移走标识再进入'], correct: 2, explanation: '警戒线代表危险或限制区域，未获授权不得进入。' },
  { title: '完成培训与考试后，到访人员还需要做什么？', options: ['可自由进入所有区域', '携带访客凭证并遵守现场安排', '把凭证交给他人使用', '无需接受现场管理'], correct: 1, explanation: '培训通过不代表通行授权，应携带凭证、遵守现场安排与访问范围。' }
]

const lesson = (id: string, title: string, description: string, video: string): Lesson => ({
  id, title, description, source: `/assets/videos/${video}.mp4`, duration: '00:06'
})

const definitions = [
  { id: 'general', title: '通用安全培训', subtitle: '了解园区安全规范与应急要求', icon: 'book', lessons: [
    lesson('general-safety', '园区安全基础知识', '了解人行通道、设备安全、个人防护与应急疏散。学习后完成安全知识考试。', 'safety')
  ] },
  { id: 'production', title: '生产区域安全培训', subtitle: '认识风险，安全进入生产现场', icon: 'factory', lessons: [
    lesson('production-safety', '生产区域安全须知', '了解人行通道、设备安全与应急疏散；到访期间请始终遵守现场标识和管理人员安排。', 'safety'),
    lesson('production-ppe', '个人防护用品使用', '正确佩戴安全帽和必要防护用品。未经授权不要触碰设备，发现隐患及时报告。', 'ppe')
  ] },
  { id: 'research', title: '研发区域安全培训', subtitle: '规范进入实验室与研发区域', icon: 'flask', lessons: [
    lesson('research-safety', '实验室访问与防护', '由授权人员陪同进入实验室，不触碰试剂或设备，禁止饮食，按要求佩戴防护用品。', 'research')
  ] },
  { id: 'office', title: '非生产区域安全培训', subtitle: '熟悉公共区域与应急路线', icon: 'building', lessons: [
    lesson('office-safety', '公共区域与应急疏散', '熟悉安全出口，遵守禁烟规定，发生火警沿疏散标识撤离到集合点。', 'office')
  ] },
  { id: 'traffic', title: '物流车辆安全培训', subtitle: '人车分流，规范装卸与停靠', icon: 'truck', lessons: [
    lesson('traffic-safety', '厂区行车与装卸安全', '厂区车辆遵守限速与行车标识，司机走人行通道，装卸按现场指挥进行。', 'traffic')
  ] },
  { id: 'construction', title: '施工人员安全培训', subtitle: '持证作业，做好施工防护', icon: 'helmet', lessons: [
    lesson('construction-safety', '施工许可与现场防护', '施工前确认作业许可和隔离防护，高风险作业须由合格人员执行，发现风险停止作业。', 'construction')
  ] }
]

export const PLANS: Plan[] = definitions.map(plan => ({
  ...plan, questions: baseQuestions.slice(0, 5).map((question, index) => ({ ...question, options: [...question.options], id: `${plan.id}-q${index + 1}` }))
}))

// Dedicated plans also assess the role-specific lesson instead of only generic safety.
PLANS.find(p => p.id === 'traffic')!.questions[0] = {
  id: 'traffic-q1', title: '物流车辆进入厂区后，应当如何行驶？',
  options: ['遵守限速与指定行车路线', '鸣笛后高速通过', '停在人行通道上', '自行进入装卸区'], correct: 0,
  explanation: '遵守厂区限速、指定路线和现场指挥，保证人车分流。'
}
PLANS.find(p => p.id === 'construction')!.questions[0] = {
  id: 'construction-q1', title: '开始高风险施工作业前，首先必须确认什么？',
  options: ['作业许可、人员资质和隔离防护', '工具外观颜色', '同事是否已开始', '进度是否落后'], correct: 0,
  explanation: '作业许可、人员资质和隔离防护是施工作业的前提。'
}

export function getPlan(id: string): Plan {
  const plan = PLANS.find(p => p.id === id)
  if (!plan) throw new Error('培训方案不存在')
  return plan
}

export function matchPlans(type: EntryType, areaIds: string[]) {
  if (type === 'training') return ['general']
  const ids = areaIds.filter(id => AREAS.some(area => area.id === id))
  if (type === 'logistics') ids.push('traffic')
  if (type === 'contractor') ids.push('construction')
  return [...new Set(ids)]
}
