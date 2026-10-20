# VisitSafe API SPEC：React 手机端与 ASP.NET Minimal API

更新日期：2026-10-20。版本：v2 聚合接口设计稿；请求路径仍使用 `/api/v1`。本文件为待实现契约，不表示 API 已接入。

## 1. 本次 review 与设计目标

以 [后端 SPEC](VisitSafe-Backend-SPEC.md) 的实体和业务规则为准，覆盖 [React 手机端 SPEC](VisitSafe-React-Mobile-SPEC.md) 的登记、申请、学习、考试与记录流程。当前 React 继续使用本地存储；本次只调整本文，不实现 API、修改页面或部署。

本次将手机端接口从 **23 个收敛为 14 个**。核心要求是：一次读取返回当前页面所需的数据，操作成功返回操作后页面的数据，减少客户端为组装页面连续补查。

旧稿还存在以下业务冲突，本次一并修正：

- 培训仍按申请持有、免训复制 TrainingRecord，与人员＋课程独立培训及申请多对多关联不符。
- 学习查询按申请分别返回、凭证只覆盖一张申请，遗漏独立分配任务，也会重复展示共享任务。
- 申请结束即终止培训，与结束申请入口关闭后仍可独立学习的规则不符。
- 网页提交者另设 WebClientKeyHash、人员车辆保存 SortOrder，与最新 MiniProgramUser 及申请关联模型不符。
- 缺少内部申请须知首次确认契约，车辆缺少可选 driverName。

### 1.1 合并与保留

| 旧接口职责 | 本版契约 | 减少的调用 |
| --- | --- | --- |
| client-context＋bootstrap | POST bootstrap 同时建立上下文、返回首页配置与统计 | 首页不先取上下文再取首页 |
| registration-config＋training-course-preview | registration-context 返回表单、须知、区域及课程映射 | 切换区域、查看确认页不再调用课程预览 |
| 申请详情＋training-tasks/query | application workspace 返回申请、人员、车辆、审批摘要及当前任务 | 详情页和任务页共用同一份数据 |
| 提交申请后再查任务 | 创建申请直接返回 application workspace | 提交成功可直接显示任务页 |
| 培训内容＋考试恢复＋结果＋考试历史＋凭证 | training workspace 返回本轮完整学习视图 | 视频、考试、结果、凭证页面共用同一份数据 |
| start＋单视频 completion | video-progress 处理首次播放及视频完成集合 | 共用一个进度写入接口；首次播放与播放结束仍按实际时点上报 |
| 逐题 answers＋submit | exam save 批量保存变更题目，可同时交卷 | 连续修改可合并，最后一批答案与交卷一次提交 |
| 临时附件 DELETE | 未绑定附件到期自动回收 | 取消编辑无需发清理请求 |

上传与动态用户搜索独立保留：文件使用 multipart，用户搜索按输入及分页读取，不把全量人员和文件塞进页面初始化响应。

### 1.2 聚合边界

- 聚合单位是页面及其紧邻的下一步，不是全站数据。首页不下载全部类型表单；申请不预载全部人的视频地址和试卷。
- 申请面板仅含任务卡片所需课程信息；用户打开某一课程时再取该课程的 training workspace。
- 写入接口返回最新 workspace，前端直接使用，不立即追加同一资源的读取。用户主动刷新、外部状态可能变化或文件地址到期时再读取。
- 后端在业务服务内批量查询、组装 DTO；避免通过 HTTP 调用本服务的其他接口，也避免逐人员、逐课程重复查询。
- 聚合不扩大权限，不取消分页，也不把事务边界不同的操作强行合并。

## 2. 通用协议、幂等与版本

移动端前缀 `/api/v1`，后台前缀 `/api/v1/admin`。请求和成功响应使用 JSON，上传使用 multipart；属性 camelCase，枚举使用 lower camelCase 字符串，集合返回 `[]`，可空字段显式返回 `null`。直接返回业务 DTO，不增加 code/data 包装。

```typescript
type Id = number // 后端业务实体 int；不使用姓名、Code 或数组下标作为 Id
type UserId = string // 框架后台用户标识
type InstantString = string // ISO 8601 带时区时间
type DateOnlyString = string // YYYY-MM-DD
type ApplicationStatus = 'pendingApproval' | 'approved' | 'checkedIn' | 'checkedOut' | 'rejected' | 'cancelled' | 'expired'
type ApprovalKind = 'business' | 'area'
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type QuestionType = 'singleChoice' | 'multipleChoice'
type FieldValue = string | number | boolean | string[] | null

interface Page<T> { items: T[]; page: number; pageSize: number; totalCount: number }
interface FileDto {
  reference: string
  fileName: string
  contentType: string
  sizeBytes: number | null
  url: string
  urlExpiresAt: InstantString
}
interface ClientContextDto {
  csrfToken: string
  businessTimeZone: 'Asia/Shanghai'
  today: DateOnlyString
}
```

所有响应包含 `X-Server-Time`。业务日期和预约日边界按 Asia/Shanghai；显示校准不代替服务端判定。包含上下文、个人资料、申请、学习或考试的响应使用 `Cache-Control: no-store`。

业务 Id 必须为正整数；框架用户 Id 保持字符串。JSON 字典中的数字题目 Id 使用字符串键，例如 `"501"`，不改变其业务标识含义。

- 分页从 1 开始，默认 20，允许 1–100。申请按 `createdAt DESC, id DESC`；配置沿用配置顺序；人员、车辆按 Id 稳定展示，不为申请人员／车辆关联新增 SortOrder；任务按人员及课程稳定展示，考试历史按 attemptNumber 排序。
- 文件 reference 是稳定引用，url 是临时地址。视频和 PDF 地址默认有效 60 分钟，视频支持 Range；通过 workspace 刷新地址，不改学习记录或考试计时。不得把学习凭证放入媒体 URL。
- 请求只接受已定义字段，不接受客户端提交成绩、标准答案、有效期、审批状态、进出厂时间或操作人。
- 申请提交以服务端确定的提交者＋clientRequestId 幂等；相同规范化内容返回同一申请，同键不同内容返回 409。响应丢失重试先恢复原申请，不因后续配置变化重新创建。
- 人员／车辆档案复用、申请快照、审批任务、培训关联及必要的新培训任务一致保存；已有真实记录仅关联，不重复新建。
- 创建首考／重考以 expectedPreviousAttemptId 确定唯一的下一次考试。视频完成集合追加，重复不增加进度；须知重复确认保留首次时间；同一次交卷只结算一次。
- 取消、须知确认、考试保存及后台状态操作使用强 ETag／If-Match。聚合响应内的 `application.etag`、`exam.etag` 或明确命名的资源 etag，分别表示对应可修改资源的版本，字符串包含引号，客户端原样放入 If-Match。**不需要为了拿 ETag 再调用单资源 GET，也不使用一个 workspace 版本代替其内部所有资源版本。**
- 缺失 If-Match 返回 428，版本变化返回 412。成功响应包含更新后的资源 etag；已成功的同一次交卷、确认或取消重试在范围校验后返回既有结果，不改首次时间。
- 同一聚合响应的状态、有效性和数量使用同一服务端判定时刻，etag 对应返回的资源状态。

## 3. 无登录访问与范围

### 3.1 浏览器上下文与提交者

`POST /bootstrap` 建立或恢复匿名浏览器上下文并返回 csrfToken，无单独 client-context 接口。服务端使用受保护的 HttpOnly、Secure、SameSite Cookie；已存在有效会话时不轮换数据归属。bootstrap 校验可信来源，之后依 Cookie 取得权限的写入及 POST 查询携带 X-CSRF-Token。

匿名会话映射到后端已有 MiniProgramUser：外部浏览器复用其 ClientId 对应提交者，内部用户通过 ApplicationUserId 关联框架账号。MiniProgramUser.Id、SubmitterId 为 int，内部申请另存 SubmitterUserId。服务端决定提交者，客户端不指定 submitterId、SubmitterUserId 或浏览器归属。

Cookie／服务端会话是访问凭证；ClientId 本身不作为访问凭证。不新增 VisitApplication.WebClientKeyHash 或与最新后端 SPEC 冲突的网页提交者模型。

“我的记录”只查询当前浏览器提交的申请。清除 Cookie 或换浏览器不删除服务端数据，也不自动取得原浏览器的整单权限。

### 3.2 个人学习范围

姓名＋手机号查询返回一个 **Participant 范围**的 learningToken，有效 2 小时，覆盖本人有权学习的独立任务、共享任务及历史考试，不再按“申请＋人员”重复发凭证。使用 X-Learning-Token 请求头，可保存在 sessionStorage 支持刷新；不放入页面 URL、localStorage 或普通日志。

- 姓名和手机号同时精确匹配，去除首尾空格；查询不是身份认证，不增加登录或短信接口。
- 个人凭证仅允许本人培训、考试及培训凭证，不返回其他人员、整单资料、身份证或附件，不允许取消申请、审批或通行。
- 带 learningToken 的请求仅按个人范围检查，不与浏览器的整单权限合并。个人学习界面不出现全部人员选择。
- 学习接口 `applicationId=null` 表示独立入口，要求个人学习凭证。浏览器从自有申请进入时携带 applicationId，以该申请的关联及状态校验；姓名查询可供同一浏览器的人员切换到独立入口。
- 凭证到期重新查询，保留原视频、答卷及截止时间。IP 与浏览器分别限制查询每 10 分钟 30 次，超限返回 429 和 Retry-After。

### 3.3 本轮未扩大的授权边界

内部后台创建的申请不属于访客浏览器。仅知道 applicationId 或取得个人 learningToken，不能因此读取整单或确认整单须知。内部申请如何安全交付 React 申请入口访问权，后端 SPEC 仍待明确；本次不新增公开领取整单权限的接口。第 6 节须知确认契约只适用于已经获得申请访问权限的调用者。

登记资料带入仅返回当前浏览器已获授权的人员／车辆资料；不提供任意姓名手机号或车牌的全库档案检索。跨浏览器完整资料带入与附件复用权限需要另行明确，不借聚合响应放开。

默认同源部署，网页 `/`、API `/api/v1`；代理保留 JSON 错误，不能将 API 404 回退为 index.html。跨源时显式配置可信 Origin、凭据及需要暴露的响应头，不使用通配来源配合 Cookie。本轮不修改部署。

## 4. 手机端接口清单：14 个

B＝当前匿名浏览器；O＝当前浏览器已获授权的申请；L＝按第 3 节校验的申请学习范围或个人学习凭证。bootstrap 只返回填写所需配置和当前浏览器统计，不返回后台题库或全站申请。

| 方法 | 路径（省略 `/api/v1`） | 一次返回／操作内容 | 范围 |
| --- | --- | --- | --- |
| POST | `/bootstrap` | 浏览器上下文、启用类型、首页统计；可预载一个指定类型的登记上下文 | B |
| POST | `/registration-context` | 指定类型的表单、须知、人员车辆规则、时段、区域课程映射及已授权档案带入 | B |
| GET | `/visit-types/{visitTypeId}/user-options` | 动态用户字段按关键词分页搜索 | B |
| POST | `/participant-attachments` | 上传一份可选人员附件 | B |
| POST | `/applications` | 提交申请，返回可直接展示的 application workspace | B |
| GET | `/applications` | 我的记录、搜索、分页和统计 | B |
| POST | `/applications/{applicationId}/workspace` | 申请详情及当前培训任务，必要时刷新过期关联 | O |
| POST | `/applications/{applicationId}/notice-acceptance` | 首次确认须知，返回完整 application workspace | O |
| POST | `/applications/{applicationId}/cancel` | 取消申请，返回更新后的 application workspace | O |
| POST | `/learning-task-search` | 精确查本人待学任务，按真实记录去重并返回学习凭证 | B |
| POST | `/training-records/{trainingRecordId}/workspace` | 视频／PDF、进度、选定考试、结果、历史摘要和凭证 | L |
| PUT | `/training-records/{trainingRecordId}/video-progress` | 首次播放及视频完成集合，返回 training workspace | L |
| POST | `/training-records/{trainingRecordId}/exam-attempts` | 创建／恢复首考或重考，返回含试卷及版本的 training workspace | L |
| POST | `/exam-attempts/{examAttemptId}/save` | 批量保存变更答案，可同时交卷，返回 training workspace | L |

workspace 使用 POST：申请读取可能刷新过期任务关联，培训读取可能进行已到期考试的结算。重复调用不得重复创建轮次或考试，不能因读取重置任何开始时间。

后台边界另见第 10 节，不计入这 14 个手机端接口。

## 5. 首页、登记上下文与附件

### 5.1 bootstrap

请求体可省略，或 `{ "visitTypeId": 1 }`，返回 200：

```typescript
interface VisitTypeDto {
  id: Id
  code: string
  name: string
  description: string | null
  caption: string | null
  color: string | null
  icon: string | null
  sortOrder: number
  vehicleRequired: boolean
  transportCompanyRequired: boolean
}
interface BootstrapDto {
  clientContext: ClientContextDto
  visitTypes: VisitTypeDto[]
  totals: { applicationCount: number; pendingTrainingCount: number }
  registration: RegistrationContextDto | null
}
```

只返回启用且基础配置完整的登记类型。学习入口独立，类型为空也可查本人任务。Code 不作为固定前端类型分支；未知图标、颜色使用默认值。

首页不预载全部表单；直接打开登记页时可指定一个 visitTypeId，首次请求同时取得上下文和该表单，不强制先 bootstrap 再 registration-context。预载类型失效时仍可建立上下文，registration=null，页面根据启用类型提示不能新建。

pendingTrainingCount 在当前浏览器可访问的申请范围内按真实 TrainingRecord 去重，统计当前未完成任务；不将无继续培训需求的过期历史算作未完成，也不统计其他浏览器或全站任务。

### 5.2 registration-context

请求指定 visitTypeId；可附带需要带入资料的精确键，每种最多 20 项：

```json
{
  "visitTypeId": 1,
  "participantKeys": [{ "name": "张三", "phone": "13800138000" }],
  "plates": ["沪A12345"]
}
```

不传 participantKeys、plates 时使用空集合，不影响首次表单加载。返回 200：

```typescript
interface OptionDto { value: string; label: string }
interface FieldDto {
  key: string
  label: string
  control: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiSelect' | 'checkbox' | 'user'
  required: boolean
  readOnly: boolean
  sortOrder: number
  maxLength: number | null
  options: OptionDto[]
  valueFromUserFieldKey: string | null
}
interface CoursePreviewDto {
  id: Id
  title: string
  subtitle: string | null
  icon: string | null
  videoCount: number
  questionCount: number
  passingScore: number
  examDurationMinutes: number
}
interface AreaOptionDto {
  id: Id
  code: string
  name: string
  description: string | null
  caption: string | null
  color: string | null
  icon: string | null
  sortOrder: number
  selectable: boolean
  unavailableReason: string | null
  requiredCourseIds: Id[]
}
interface RegistrationContextDto {
  configurationVersion: string
  visitType: VisitTypeDto
  applicationTemplateId: Id
  fields: FieldDto[]
  notice: { id: Id; version: string; title: string; content: string }
  timeSlots: OptionDto[]
  areas: AreaOptionDto[]
  courses: CoursePreviewDto[]
  participantRules: {
    companyRequired: boolean
    tradeRequired: boolean
    companyFromFieldKey: string | null
    phoneUnique: boolean
  }
  participantMatches: Array<{
    name: string
    phone: string
    profile: { id: Id; company: string | null; trade: string | null } | null
  }>
  vehicleMatches: Array<{
    plate: string
    profile: { id: Id; transportCompany: string | null; driverName: string | null } | null
  }>
}
```

- fields 投影已有动态模块和 metadata，不新建模板体系。控件对应 FieldValue；不支持的控件不能静默变成可提交文本框。只读姓名等字段由所选后台用户标识派生，提交时服务端重新解析。
- 各类型至少一位独立人员，姓名＋手机号不得重复；phoneUnique 为真时还禁止重复手机号。施工单位继承本次 contractorCompany，不自动更新全局人员档案。
- areas 按当前 visitTypeId 下发 requiredCourseIds，courses 是这些区域命中课程的去重摘要。前端对所选区域做课程 Id 并集即可展示课程、人数及考试规则，不再请求预览；不返回题目、答案或媒体文件。
- 区域缺少本类型课程或有效审批负责人时 selectable=false 并说明原因。configurationVersion 覆盖类型、模板、须知、时段、规则、区域可用性、审批来源及区域课程映射。提交时重新校验版本和当前配置；前端预览不决定最终免训或任务创建。
- profile 只按精确键及当前浏览器权限返回最少带入字段；没有记录或不可访问均为 null，不返回身份证、附件或他人资料。申请提交仍按姓名＋手机号和规范化车牌在服务端复用全局档案，不依赖客户端传档案 Id。
- 资料带入由用户确认；本次修改写申请快照，不自动修改档案或历史。批量匹配不创建档案、申请或培训任务。

初始物流的 logisticsReasons、cargoType、logisticsOrderNumber 等放入对应动态模板。审批人保存 logisticsContactUserId 等框架用户标识，自由姓名不能代替账号；车辆司机仅有可选 driverName，不携带手机号或 ParticipantId。

### 5.3 用户搜索

`GET /visit-types/{visitTypeId}/user-options?fieldKey=hostUserId&q=王&page=1&pageSize=20` 返回 `Page<{ id: UserId; displayName: string }>`。fieldKey 必须是该类型的 user 控件；q 去首尾空格，1–50 字符。仅返回可选且有资格的人员显示信息，不返回账号、角色、手机号或无条件的全员列表；提交时再次校验可用性。

界面输入短暂停顿后再搜索，同一关键词复用当前页面结果；不逐键触发请求。每个 IP 每分钟最多 60 次，超限返回 429。

### 5.4 附件

`POST /participant-attachments` 接收 multipart 字段 file，允许 JPEG、PNG、PDF，单文件最大 10 MiB；检查实际文件类型和大小。返回 201：

```json
{
  "reference": "upload-reference",
  "fileName": "人员资料.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 204800,
  "expiresAt": "2026-10-21T02:00:00Z"
}
```

每位人员最多一份附件。未绑定引用属于当前浏览器，保留 24 小时；放弃编辑或替换文件只清除草稿引用，由服务端自动回收，无 DELETE 请求。提交时绑定实际人员并保存本申请引用和文件名快照；同一临时引用不能绑定其他人，已绑定文件不按临时期限清理。可选身份证号码按文本处理，附件不要求是身份证图片。

## 6. 申请 workspace、提交与须知

### 6.1 创建申请

```typescript
interface CreateApplicationRequest {
  clientRequestId: string
  visitTypeId: Id
  configurationVersion: string
  appointmentDate: DateOnlyString
  timeSlot: string
  noticeId: Id
  noticeVersion: string
  noticeAccepted: true
  dynamicValues: Record<string, FieldValue>
  participants: Array<{
    name: string
    phone: string
    company?: string | null
    trade?: string | null
    idCardNumber?: string | null
    attachmentReference?: string | null
  }>
  vehicles: Array<{ plate: string; transportCompany?: string | null; driverName?: string | null }>
  areaIds: Id[]
}
```

`POST /applications` 首次成功 201 并返回 Location，幂等重试 200；两者均返回 ApplicationWorkspaceDto 的 detail 分支，含任务页数据，不再读取详情或任务接口。

服务端校验启用类型、配置／须知版本、同类型须知已同意、真实且不早于今天的预约日期、合法时段、动态字段与审批人、人员及车辆必填规则、区域课程和审批负责人、附件访问权。客户端草稿始终保留相同 clientRequestId，不上传本地 Person.id、Vehicle.id 或申请 Id。

人员按去首尾空格后的姓名＋手机号，车辆按规范化车牌复用档案；车辆和本次运输单位必填来自 VisitType，driverName 不关联人员。服务端分别建立申请人员及车辆快照，新关联的进出厂时间和操作人全部为空。

申请保存去重的必修课程集合；逐人逐课程关联有效通过记录、已有未完成任务或新任务，不能固定要求每次新建首轮 TrainingRecord。新申请、关联及必要的新数据原子保存，生成一条业务和每区域一条审批任务，初始 pendingApproval。外部提交以服务端时刻保存首次须知确认及须知标题、正文快照。

### 6.2 页面 DTO

```typescript
interface TrainingSummaryDto {
  participantCount: number
  qualifiedParticipantCount: number
  requiredRecordCount: number
  validRecordCount: number
  allQualified: boolean
}
interface NoticeDto {
  id: Id
  titleSnapshot: string
  contentSnapshot: string
  acceptedAt: InstantString | null
}
interface ApplicationSummaryDto {
  id: Id
  visitTypeId: Id
  visitTypeName: string
  status: ApplicationStatus
  createdAt: InstantString
  appointmentDate: DateOnlyString
  timeSlot: string
  participantNames: string[]
  areaNames: string[]
  training: TrainingSummaryDto
  canCancel: boolean
}
interface ParticipantDto {
  id: Id // Participant.Id；以下资料和进出厂时间来自本申请关联
  name: string
  phone: string
  company: string | null
  trade: string | null
  idCardNumber: string | null
  attachment: FileDto | null
  checkedInAt: InstantString | null
  checkedOutAt: InstantString | null
}
interface VehicleDto {
  id: Id // Vehicle.Id
  plate: string
  transportCompany: string | null
  driverName: string | null
  checkedInAt: InstantString | null
  checkedOutAt: InstantString | null
}
interface ApprovalTaskSummaryDto {
  id: Id
  kind: ApprovalKind
  visitAreaId: Id | null
  status: ApprovalStatus
  reviewedAt: InstantString | null
  reviewComment: string | null
}
interface ApplicationDetailDto extends ApplicationSummaryDto {
  etag: string
  clientRequestId: string
  source: 'external' | 'internal'
  reviewedAt: InstantString | null
  checkedInAt: InstantString | null
  checkedOutAt: InstantString | null
  notice: NoticeDto
  businessFields: Array<{ key: string; label: string; value: FieldValue; displayValue: string }>
  participants: ParticipantDto[]
  vehicles: VehicleDto[]
  areas: Array<{ id: Id; name: string }>
  approvalTasks: ApprovalTaskSummaryDto[]
}
interface ApplicationTaskDto {
  record: TrainingRecordDto
  participantId: Id
  isCurrentRound: boolean
  isExempt: boolean // 本申请关联已通过结果的展示属性，不是培训副本
  actions: TrainingActionsDto
}
type ApplicationWorkspaceDto =
  | { view: 'notice'; applicationId: Id; applicationEtag: string; notice: NoticeDto }
  | { view: 'detail'; application: ApplicationDetailDto; tasks: ApplicationTaskDto[] }
```

`POST /applications/{id}/workspace` 无业务请求体，返回 200。先检查申请权限；尚未确认须知返回 notice 分支，前端只展示保存的须知快照。确认后返回 detail 分支，可直接展示详情或本申请任务，全部／个人切换在页面内筛选，不再按人发查询。

未结束且人员尚未进厂时，读取必要的过期课程可按第 9 节追加新关联；tasks 每人每必修课程只取本申请关联中最大 RoundNumber。申请结束或已进厂人员不因页面查询强制新增轮次；历史只读。列表字段、审批及培训进度在同一判定时刻汇总，不能把培训合格当作申请已审批或已结束。

### 6.3 须知首次确认

`POST /applications/{id}/notice-acceptance` 携带申请 If-Match，请求 `{ "noticeId": 11, "accepted": true }`，返回 200 最新 ApplicationWorkspaceDto。确认已有申请保存的须知快照，不要求当前须知配置版本，也不因配置改动替换历史正文。

前端使用 3 秒倒计时及勾选交互；服务端只在 NoticeAcceptedAt 为空时保存首次确认时刻。重复确认不覆盖。内部创建尚未确认不阻碍审批；本申请入口先确认再继续，独立培训不受限制。未经授权的内部申请不能仅凭 Id 调用此接口。

### 6.4 我的记录与取消

`GET /applications?q=张三&page=1&pageSize=20&status=pendingApproval` 返回：

```typescript
interface MyApplicationsResponse {
  records: Page<ApplicationSummaryDto>
  totals: { applicationCount: number; participantCount: number; validRecordCount: number }
}
```

q 可省略，去首尾空格最多 100 字符，在当前范围内搜索历史人员资料、业务显示值、类型名、车牌和运输单位。分页按筛选计算，totals 统计当前浏览器全部申请；validRecordCount 按真实记录去重，人员数按申请人员关联计数。汇总查询不为了统计无需求的过期历史而创建培训。

`POST /applications/{id}/cancel` 无业务请求体、携带申请 If-Match，返回 200 最新 ApplicationWorkspaceDto。仅 pendingApproval／approved 且尚无人进厂时允许，取消未处理审批，保留独立人员、车辆、培训与考试。已取消重试返回既有结果。

真实接入不提供手机端硬删除；本地“删除”与真实“取消”分别处理。结束本申请只关闭它的操作入口，不终止独立培训或影响其他申请的关联；本人仍可查询后从独立入口继续已分配任务。

## 7. 个人查询、培训 workspace 与视频

### 7.1 任务及学习视图

```typescript
type TrainingState = 'notStarted' | 'learning' | 'readyForExam' | 'examInProgress' | 'retakeRequired' | 'passed' | 'expired'
interface ExamAttemptSummaryDto {
  id: Id
  attemptNumber: number
  startedAt: InstantString
  deadlineAt: InstantString
  submittedAt: InstantString | null
  score: number | null
  passed: boolean | null
  timedOut: boolean
}
interface TrainingRecordDto {
  id: Id
  participantId: Id
  trainingCourseId: Id
  roundNumber: number
  state: TrainingState
  startedAt: InstantString | null
  completedVideoIds: Id[]
  completedAt: InstantString | null
  validUntil: InstantString | null
  isValid: boolean
  course: CoursePreviewDto // 本轮快照的展示信息和考试规则
  activeExamAttempt: ExamAttemptSummaryDto | null
  latestSubmittedExamAttempt: ExamAttemptSummaryDto | null
}
interface TrainingActionsDto { canLearn: boolean; canStartExam: boolean; canRetake: boolean }
interface TrainingWorkspaceDto {
  record: TrainingRecordDto
  participant: { id: Id; name: string; maskedPhone: string }
  applicationContext: {
    applicationId: Id
    status: ApplicationStatus
    noticeAccepted: boolean
    isExempt: boolean
  } | null
  currentTrainingRecordId: Id
  actions: TrainingActionsDto
  videos: Array<{ id: Id; title: string; description: string | null; durationSeconds: number; file: FileDto }>
  pdf: FileDto | null
  exam: ExamAttemptDto | null
  result: ExamResultDto | null
  examHistory: Page<ExamAttemptSummaryDto>
  completion: CompletionDto | null
}
```

TrainingRecord 不包含 visitApplicationId 或 reusedFromTrainingRecordId。state 从真实进度、考试和时间推导；isExempt 属于申请使用该结果的上下文。同一实际通过记录的有效期、分数和考试历史只有一份。

### 7.2 姓名＋手机号查询

`POST /learning-task-search` 请求 `{ "name": "张三", "phone": "13800138000", "page": 1, "pageSize": 20 }`，返回 200：

```typescript
interface LearningSearchResponse {
  participant: { id: Id; name: string; maskedPhone: string } | null
  learningToken: string | null
  learningTokenExpiresAt: InstantString | null
  tasks: Page<{
    record: TrainingRecordDto
    relatedApplications: Array<{ id: Id; visitTypeName: string; appointmentDate: DateOnlyString }>
  }>
}
```

按姓名＋手机号定位独立 Participant，查询本人当前待学任务，包括无申请分配的任务。共享任务按 TrainingRecord.Id 去重，按真实任务分页，相关申请仅返回有权展示的最少关联信息；不按申请拆成重复课程。

对有继续学习需求的未结束申请刷新适用的过期关联；不创建新申请，不重算已提交申请的必修课程，不为没有需求的独立过期历史自动分配新任务。有效通过且没有待学新轮次的课程不返回；同课程其他轮次已通过不能隐藏待学新轮次。关联申请结束后，实际未完成的独立任务仍可返回。

无匹配人员时 participant、token、expiresAt 均为 null，tasks 为空；匹配到本人但无待学任务时可返回本人凭证及空 tasks，用于继续访问已知的本人历史。查询不创建人员或授予整单权限。

### 7.3 一次取得课程页面数据

`POST /training-records/{id}/workspace` 请求：

```json
{ "applicationId": null, "examAttemptId": null, "examHistoryPage": 1, "examHistoryPageSize": 20 }
```

可省略分页参数使用默认值。applicationId 指定已有申请入口，否则是独立入口。examAttemptId 指定固定一次考试；为空时选择进行中考试，否则选择本轮最近一次已交卷考试。返回 200 TrainingWorkspaceDto。

- 一次返回本轮视频／PDF、进度、选定考试的题目与已存答案、该次结果、分页历史摘要及已有真实凭证。没有考试／结果／通过记录时相应字段为 null，不再以“尚未生成”为由强制客户端逐个请求结果和凭证接口。
- 同一 workspace 供 LearnPage、ExamPage、ResultPage、CompletionPage 使用。创建考试、写视频、保存或交卷后，响应就是更新后的 workspace，不再补查考试／结果／凭证。
- 指定旧 examAttemptId 时展示该次考试，不替换成最新一次；历史切换、分页可调用同一路径。record 始终是请求的那轮记录；currentTrainingRecordId 按入口上下文计算，旧记录不被静默替换。
- exam.canAnswer、exam.canSubmit 仅针对当前选定考试；已交卷历史只读。actions 按当前培训及入口计算，不因查看旧失败考试而允许覆盖历史或再创建一份进行中考试。
- 结束申请入口只读，不因另一申请分配了更高轮次就改写本申请依据。独立入口可继续已分配的未完成任务，不受历史申请状态或其须知限制。
- 视频／PDF及试题来自本轮快照；不返回原始 CourseSnapshotJson。未交卷试卷和所有课程资料均不包含正确答案、解析或实时判对错信息；仅已交卷 result 提供该次错题解析。
- PDF 不计视频完成；媒体签名地址到期时重读此 workspace，不新建培训或考试。

### 7.4 合并视频进度接口

`PUT /training-records/{id}/video-progress`：

```json
{ "applicationId": null, "startPlayback": true, "completedVideoIds": [] }
```

首次实际播放本轮视频时 startPlayback=true，只在 StartedAt 为空时记录服务端当前时刻；仅进入页面不调用。之后视频结束时传 startPlayback=false 和本次新增的 completedVideoIds，服务端去重追加，返回 200 TrainingWorkspaceDto。可将同时待上报的完成标识合并在一个集合；已有进度不因缺少某 Id 被清空。

首次播放和播放结束是不同业务时点，不能为了少一次请求而只在结束时伪造开始。完成上报要求 StartedAt 已存在、视频属于本轮快照，且入口允许学习；尚未开始返回 TRAINING_NOT_STARTED。已经完成过的同一上报重试返回原进度，不受之后已通过状态影响；不得追加新的非法进度。

第一版正常播放结束事件负责完成上报，不承诺防代学。API 模式移除演示计时完成能力；播放失败可重试，人工处理按后台权限及后端 SPEC，不由匿名接口直接补全。

## 8. 考试创建、批量保存与交卷

### 8.1 考试、结果及凭证 DTO

```typescript
interface ExamQuestionDto { id: Id; type: QuestionType; title: string; options: string[]; points: number }
interface ExamAttemptDto extends ExamAttemptSummaryDto {
  etag: string
  trainingRecordId: Id
  questions: ExamQuestionDto[]
  answers: Record<Id, number[]>
  passingScore: number
  canAnswer: boolean
  canSubmit: boolean
}
interface ExamResultDto {
  examAttemptId: Id
  trainingRecordId: Id
  attemptNumber: number
  submittedAt: InstantString
  score: number
  passed: boolean
  timedOut: boolean
  answers: Record<Id, number[]>
  wrongQuestionIds: Id[]
  wrongQuestions: Array<{
    id: Id
    type: QuestionType
    title: string
    options: string[]
    selectedIndexes: number[]
    correctIndexes: number[]
    explanation: string
  }>
  completedAt: InstantString | null
  validUntil: InstantString | null
}
interface CompletionDto {
  trainingRecordId: Id
  sourceExamAttemptId: Id
  participant: { id: Id; name: string; maskedPhone: string }
  course: { id: Id; title: string }
  score: number
  completedAt: InstantString
  validUntil: InstantString
  isValid: boolean
}
```

恰好五道四选项题，每题 20 分，可混合单选和多选。题目、解析、及格分和时长取课程快照。CompletionDto 指向真实培训和实际通过考试；申请免训仍看同一凭证，用 applicationContext.isExempt 补充说明，不创建历史免训副本或新考试。

### 8.2 创建或恢复考试

`POST /training-records/{id}/exam-attempts` 请求 `{ "applicationId": null, "expectedPreviousAttemptId": null }`。

首考传 null，失败重考传最近一次已交卷失败考试 Id。同一前次考试最多创建一次后继考试；首考对应 attemptNumber=1。首次创建 201、Location，重复请求 200；响应均为 TrainingWorkspaceDto，exam 为该次考试，包含完整试卷、服务端时间、已存答案及 etag，无需再 GET 考试。

新建时检查允许学习的入口、当前实际轮次、尚未有效通过及快照全部视频完成。首次创建固定 StartedAt 和 DeadlineAt，重试恢复该次考试，即使它已交卷也不意外创建下一次；重考保留本轮视频及历次考试。已通过轮次过期重训必须另建 TrainingRecord，不能用旧轮次重考续期。

### 8.3 一个接口批量保存，也可带最后一批答案交卷

`POST /exam-attempts/{id}/save` 携带 **exam.etag 对应 If-Match**：

```json
{
  "applicationId": null,
  "changes": { "501": [0], "502": [0, 2] },
  "submit": false
}
```

返回 200 TrainingWorkspaceDto。submit=false 保存变更，submit=true 在同一事务中保存这些变更并交卷；客户端不需要先逐题保存、再发 submit、再读 result 或 completion。

- changes 是本次变更题目的补丁，不是整个答案字典替换；未出现题目保留原答案。questionId 必须属于本轮快照，下标为 0–3 整数；去重升序保存，空集合清除该题。单选非空恰好一项，多选允许一项或多项。
- 同一考试本地只维护一条按版本顺序执行的保存队列，合并等待期间的题目变更，以最新选项覆盖队列中同一题；不能并行携带同一旧 etag 写入。
- 前端短暂合并连续操作、异步保存，不要求每点一个选项或自动进入下一题都发请求。保存成功才标记已保存；保存失败保留未保存选项。刷新、关闭或进入后台只能恢复服务端已接受答案，不把本地未保存状态当作成功。
- 在切换学习人员、离开考试页面等可控导航前尝试保存并提示失败；不依赖浏览器关闭时的最后一次请求。不能为了固定“一场考试一个请求”取消过程保存，导致断网、刷新或超时丢失全部答案。
- 交卷将尚未保存的 changes 一并发送；服务器锁定考试、校验 If-Match 和截止时间后，按合并后的最终答案检查完整性并一次评分。主动交卷缺题返回 EXAM_ANSWERS_INCOMPLETE，整个请求不部分写入，页面继续保留待保存选项。
- 版本冲突返回 412 及有权读取的最新 workspace，前端不另发 GET 才发现冲突，也不自动将旧选项覆盖回去。用户确认后基于最新 etag 重新提交变更。

### 8.4 截止时间、重试及评分

达到或超过 DeadlineAt 后，不接受请求中的新 changes，先按已保存答案结算。submit=true 返回已有或刚结算的结果；submit=false 返回 EXAM_DEADLINE_REACHED，并附带已结算的 workspace，显示结果而非“保存成功”。

主动截止前交卷要求五题均作答；到期允许未答题、记零分。单选及多选均按完整答案集合比较，少选、多选、错选均零分，不设部分得分。服务端评分，客户端不在未交卷时判对错。

通过时在同一事务中保存实际结果、TrainingRecord.CompletedAt 和 ValidUntil；有效天数取 TrainingCourse **实际通过时**的当前 TrainingValidityDays，题目与考试规则仍取本轮快照。CompletedAt 为首次实际服务端结算时刻，不伪造为客户端倒计时结束时刻。

读写 workspace、保存、创建／恢复考试时兜底处理到期结算，服务端亦需处理无人打开页面的到期考试，不依赖前端定时器。独立／共享考试不因某一申请结束而冻结或取消；该申请入口变为只读，本人仍能从独立入口继续，原 DeadlineAt 不变。并发保存、到期结算及重复交卷只能产生一个固定结果。

已交卷后 submit=true 重试先返回该次固定结果，不处理新 changes，也不因旧 If-Match 重新评分；submit=false 拒绝改卷并返回当前 workspace。旧结果通过明确 examAttemptId 查看，不被后来的重考覆盖。

## 9. 档案、共享轮次与申请结束的统一规则

1. Participant 按去首尾空格后的姓名＋手机号组合唯一，Vehicle 按规范化车牌唯一。申请关联保存本次资料快照和本次进出厂审计，不保存人员／车辆 SortOrder，不将车辆与 Participant 绑定。
2. 逐人逐课程优先选择实际已交卷通过且 `CompletedAt <= 当前时刻 < ValidUntil` 的记录；申请还要求 ValidUntil 晚于预约日 00:00。多条结果按 CompletedAt 最新、同时间按 Id 升序。后台特批生成的合法实际通过结果按后端 SPEC 同样参与判断。
3. 未命中有效结果时沿用同人同课程未完成任务，否则新建全局最大 RoundNumber＋1。课程快照只在创建真实任务时确定，关联不复制视频、考试或时间，也不续期。
4. 本申请仅在自身已关联记录中按人员＋课程取最大 RoundNumber；其他申请新分配的轮次不自动覆盖本申请，旧有效轮次也不能掩盖本申请当前待学轮次。
5. 需要刷新本申请过期关联时，只能关联更高轮次的有效结果或未完成任务；都没有时按原快照创建新轮次。旧记录及旧关联保留，重复或并发刷新仅生成一套待学任务，不重新匹配最新类型区域配置。
6. 没有后续培训需求的过期独立结果，不因查询首页、列表或历史自动创建重训任务。已有独立未完成任务不会因没有申请或某申请结束被遗漏。
7. 结束、取消、拒绝或解除申请关联不级联删除人员、车辆、真实培训、考试及文件；本申请入口只读，独立入口和其他申请按各自范围继续使用共享任务。
8. 审批、须知、培训、预约日及进出厂是各自独立条件。申请培训汇总不代替本人进厂检查，不因其他人未完成阻止已合格人员。
9. AppointmentDate 仅限制首次进厂日期，TimeSlot 仅登记展示；预约日已过不自动结束学习、取消审批或将申请标记 expired。独立自动过期规则仍待明确。

## 10. 后台边界与聚合读取

后台继续使用 CleanBlazorServerPro 及已有权限、页面和业务服务。本节只列与手机端状态衔接的最小 HTTP 边界，不要求为后台每个按钮另建一组 API；直接调用同一业务服务时不需要绕行 HTTP。

| 方法 | 路径（省略 `/api/v1/admin`） | 请求与返回 |
| --- | --- | --- |
| GET | `/applications/{id}/workspace` | 一次返回有权查看的申请、审批任务及各自 etag、人员车辆快照与进出厂信息、培训汇总 |
| POST | `/approval-tasks/{taskId}/review` | decision、comment、任务 If-Match；返回更新后的后台 workspace |
| POST | `/applications/{id}/participants/{participantId}/check-in` | 人员关联 If-Match；返回更新后的后台 workspace |
| POST | `/applications/{id}/participants/{participantId}/check-out` | 人员关联 If-Match；返回更新后的后台 workspace |
| POST | `/applications/{id}/complete` | 申请 If-Match；返回更新后的后台 workspace |

不再单独定义“读审批任务”和“读申请内某个人”接口，版本及操作所需上下文已在 workspace。后台 DTO 按权限裁剪；指定审批人只处理自己的待办，管理员依已有权限操作。所有时间及操作人由服务端取得。

每条审批任务一位审批人、业务及所有区域任务并行；任一驳回结束整单审批并取消剩余 pending，驳回意见必填。进厂前必须检查本申请须知已确认、当天为预约日、全部审批通过及本人当前必修课程有效；先按规则刷新过期关联，拒绝不写审计。进出厂首次时间和操作人成对写入，重试不覆盖。

人员出厂、已进厂车辆出厂及整单自动／手动完成规则以后端 SPEC 为准；存在未出厂的已进厂车辆时不能完成整单。车辆通行写入的具体操作规则与接口尚待明确，本次不为减少接口而将车辆混入人员放行接口。

内部创建、人员课程分配、后台单条培训特批完成、申请编辑及符合规则的删除沿用后端 SPEC 和后台服务，不新增匿名能力。特批必须校验 Permissions.TrainingRecords.Complete，保存 BackOfficeCompletion 日志，不改变审批或通行条件；若后续需要对外提供这些后台操作的 HTTP 契约，再按实际页面确定，不恢复本轮已合并的细粒度查询。

## 11. 错误与就地恢复

错误使用 application/problem+json，保留 type、title、status、detail、instance，并扩展 code、traceId、errors。字段 errors 使用 JSON Pointer，例如 `/participants/0/phone`、`/changes/501`。不解析中文 detail 决定业务分支。

| HTTP | code | 客户端处理 |
| --- | --- | --- |
| 400 | INVALID_REQUEST / VALIDATION_FAILED | 未知字段、格式、日期、必填、车牌、选项集合等；定位字段并保留输入 |
| 403 | ACCESS_CONTEXT_EXPIRED / CSRF_INVALID | 恢复 bootstrap 或重新查询本人任务；不能将失效凭证当作成功 |
| 404 | RESOURCE_NOT_FOUND | 不存在或不在范围内统一处理，不附带别人的 workspace |
| 409 | CONFIGURATION_CHANGED / NOTICE_CHANGED | 返回有权取得的最新 registrationContext，保留草稿并重新确认；已有申请使用原须知快照，不按新配置重签 |
| 409 | VISIT_TYPE_DISABLED / AREA_UNAVAILABLE / TRAINING_CONFIGURATION_MISSING | 配置不可用，不允许部分提交 |
| 409 | APPROVER_UNAVAILABLE / ATTACHMENT_UNAVAILABLE | 重新选择人员或上传，保留其他资料 |
| 409 | CLIENT_REQUEST_CONFLICT | 不自动换 clientRequestId 再创建 |
| 409 | APPLICATION_ENDED / APPLICATION_STATE_CONFLICT | 返回有权取得的当前 application workspace，按入口处理只读 |
| 409 | TRAINING_RECORD_NOT_CURRENT / TRAINING_ALREADY_VALID / TRAINING_NOT_STARTED / VIDEOS_INCOMPLETE | 有权时附 currentTrainingRecordId 和 trainingWorkspace，不另读多次状态 |
| 409 | EXAM_NOT_READY / EXAM_ALREADY_SUBMITTED / EXAM_DEADLINE_REACHED / EXAM_ANSWERS_INCOMPLETE | 有权时附当前 trainingWorkspace；未被接受的本地选项不标记已保存 |
| 412 | VERSION_CONFLICT | 有权时附最新 workspace 及各资源 etag，由用户解决冲突 |
| 413 / 415 | FILE_TOO_LARGE / FILE_TYPE_NOT_ALLOWED | 重新选文件 |
| 428 | PRECONDITION_REQUIRED | 请求缺少目标资源 If-Match |
| 429 | RATE_LIMITED | 按 Retry-After 等待 |
| 500 / 503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE | 未确认成功；保留输入，恢复状态或重试原幂等操作 |

workspace、trainingWorkspace、registrationContext 是 Problem Details 的可选扩展，只有通过当前授权检查且能取得一致状态时返回；没有扩展时才调用对应聚合读取接口恢复。不以 200 包装业务失败。后台另使用框架 401／403，以及 APPOINTMENT_DATE_MISMATCH、NOTICE_NOT_ACCEPTED、APPROVAL_INCOMPLETE、TRAINING_NOT_VALID、PARTICIPANTS_STILL_INSIDE、VEHICLES_STILL_INSIDE 等业务 code。

TRAINING_RECORD_NOT_CURRENT 的 trainingWorkspace 可直接返回 currentTrainingRecordId 对应的新轮次，供前端切换；它是明确的错误恢复信息，不改变正常 workspace 对指定历史记录的展示规则。考试版本冲突返回的 exam 仍为请求指定的 examAttemptId，不替换成其他次考试。

## 12. 页面调用预算与接入方式

以下计数指已有上下文、数据可用时的业务请求；新会话 bootstrap 最多增加一次。搜索、上传、主动刷新、分页及网络重试按实际需要另计，不承诺所有操作永远只有一次请求。

| 场景 | 本版正常调用 | 响应可直接使用的数据 |
| --- | --- | --- |
| 首次打开首页 | bootstrap 1 次，已含上下文 | 类型及统计 |
| 从首页进入登记 | registration-context 1 次 | 表单、须知、区域和全部课程摘要 |
| 直接打开登记链接 | 指定 visitTypeId 的 bootstrap 1 次 | 上下文及该类型登记页 |
| 改区域／登记确认页 | 0 次 | 从配置映射取课程并集 |
| 提交申请进入任务页 | applications 1 次 | application workspace，无后续详情／任务补查 |
| 从记录进入详情再切换任务页或人员 | application workspace 1 次 | 全部申请资料及任务；切换时本地筛选 |
| 确认已有申请须知 | notice-acceptance 1 次 | 可继续使用的 application workspace |
| 查询本人待学 | learning-task-search 1 次 | 去重任务与本人 token |
| 打开某一课程学习 | training workspace 1 次 | 视频、PDF、考试、历史及凭证可用状态 |
| 开始／恢复首考或重考 | exam-attempts 1 次 | 含题目、已存答案、截止时间和 etag 的 workspace |
| 从已载入 workspace 切换考试／结果／凭证页 | 0 次 | 使用同一份已返回数据，旧考试按固定 Id 展示 |
| 保存最后一批答案并交卷，进入结果／凭证 | save(submit=true) 1 次 | 结果、错题、实际有效期及凭证，无额外结果查询 |
| 暂停后恢复或刷新考试页 | training workspace 1 次 | 相同考试、服务端已存答案和原 DeadlineAt |
| 取消申请 | cancel 1 次 | 更新后的 application workspace |

过程答案仍按短暂合并后的变更异步保存；播放器首次实际播放与完成仍在各自时点上报，不能用减少请求替代进度和截止时间要求。

前端使用一个 API 访问层和按 applicationId／trainingRecordId／examAttemptId 定位的页面缓存。接收操作返回的 workspace 后直接替换对应状态；姓名查询时切换到个人范围，清除其他人员页面数据。跨标签页或后台审批可能改变状态，回到前台时对当前正在使用的聚合资源重新读取一次，不并行读取其各个子资源。

未交卷时移除本地判对错；真实接入移除演示计时和本地评分，不上传 visitsafe.web.v3 的演示成绩或本地 Id。现有登记顺序保持，物流独立人员及统一 vehicles 的 API DTO 适配按 React／后端 SPEC 实现。

## 13. 契约验收与交付边界

本轮只进行文档 review，以下为后续接口和前端接入验收要求，不表示已有服务或测试通过。

1. 首页一次 bootstrap 获得会话、类型和统计；直达登记时可同时获得该类型上下文。改区域和确认页无课程预览请求；配置变化仍在提交时拒绝旧内容并保留草稿。
2. 创建申请返回可直接展示的任务页；重复提交只创建一张申请和正确的审批／课程关联，既有任务不复制。动态类型、字段及用户选项遵循模板，不增加固定类型分支。
3. 申请 workspace 同时支持详情、全部／个人任务；各内部资源 etag 已返回，不额外为取消、须知或考试取得版本。
4. 人员车辆复用独立档案、本次修改只写快照，申请人员与车辆无 SortOrder；物流两车三人按三人分别分配课程，车辆不生成人员或课程。
5. 未确认申请返回原须知快照并保留首次确认时间，确认一次即可继续；独立学习不等待申请须知或审批。无整单授权不能从个人查询升级为申请访问。
6. 独立分配任务可被本人查询；多申请共享任务只返回一份，同一视频、考试、答案和有效期从不同入口一致；新申请按课程分别免训、继续或新建。
7. 当前及预约日有效期边界、更高轮次追加、本申请轮次选择和过期原快照重训遵守第 9 节；旧通过不能隐藏当前待学，其他申请新轮次不替换本申请。
8. 已载入课程 workspace 可展示学习、已有考试、选定结果、历史及凭证；创建或交卷后无恢复考试、取结果、取凭证的连续补查。历史考试始终按固定 Id 展示。
9. 视频首次播放记录 StartedAt，重复不重置；完成集合只能追加，非法视频或未完成视频不能考试；不把开始和结束延迟到同一上报时刻。
10. 批量保存只修改 changes 中的题目，空集合清除、单选多项拒绝，多选少选零分。交卷携带最后一批变更时一次保存并评分；缺题或版本冲突不部分写入。
11. 两标签页旧 etag 返回 412 和有权取得的当前 workspace，不能自动覆盖新答案。失败或断网显示未保存；只恢复服务端接受的答案。
12. 到期后的 changes 不被接受，服务端按截止前已存答案结算；save、到期处理、查询和重试交卷只生成同一结果，不重置计时。应用结束不冻结独立考试。
13. 成功交卷响应直接包含成绩、错题、原期限及真实凭证；关联有效通过不生成新成绩或考试；课程配置调整不追溯已有通过时间和截止。
14. 取消／删除关联保留独立档案、培训、考试和文件；结束申请入口只读，本人和其他申请仍能使用独立任务；过期独立历史没有需求时不自动新建轮次。
15. 聚合读取和错误扩展都遵循范围裁剪；个人凭证不含整单资料和他人数据。浏览器清除 Cookie 不删除服务端业务，个人 token 失效不重置学习。
16. 附件超限、格式错误、过期或越权拒绝；未绑定附件自动回收，已绑定资料按历史保留，取消编辑不需要 DELETE。
17. 后台一次 workspace 提供审批、人员及版本，操作响应足够更新页面；放行仍检查须知、审批、预约日及本人有效课程，重复操作不改首次审计，未出厂的已进厂车辆阻止整单完成。

实现时使用独立 Request／Response DTO、统一 JSON 字符串枚举及 Problem Details，为每个操作声明访问范围、operationId 和成功／错误响应并导出 OpenAPI。权限、事务、评分和共享轮次处理由业务服务复用，不直接序列化 EF 实体或完整课程快照。

内部申请入口授权、跨浏览器完整档案及附件带入、车辆通行写入和独立自动过期仍待相应业务契约明确；本次不额外扩展公开接口。这不影响先实现已明确的聚合读写边界，也不表示 React 已接入真实后端。
