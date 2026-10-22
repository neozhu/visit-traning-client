# VisitSafe API SPEC：React 手机端与 ASP.NET Minimal API

更新日期：2026-10-20。版本：v4 无登录查询、后台分发与申请接续设计稿；请求路径仍使用 `/api/v1`。本文件为待实现契约，不表示 API 已接入。

## 1. 本次 review 与设计目标

以 [后端 SPEC](VisitSafe-Backend-SPEC.md) 的实体和业务规则为准，覆盖 [React 手机端 SPEC](VisitSafe-React-Mobile-SPEC.md) 的登记、申请、学习、考试与记录流程。本轮修订契约及对应业务规范，为当前项目后续实现 Minimal API、React 接入做准备；不表示 API 或页面已经实现。

本次将手机端接口从初稿 **23 个、上一轮 14 个进一步收敛为 12 个**。基础数据在首次 bootstrap 中全量读取，后续类型切换、表单生成、区域课程匹配及常规预校验都在本地完成；审批人由前端填写姓名或 UserName，提交时由后端解析，不下发内部账号列表。动态业务按页面聚合读取，操作响应直接更新页面，减少重复请求。

旧稿还存在以下业务冲突，本次一并修正：

- 培训仍按申请持有、免训复制 TrainingRecord，与人员＋课程独立培训及申请多对多关联不符。
- 学习查询按申请分别返回、凭证只覆盖一张申请，遗漏独立分配任务，也会重复展示共享任务。
- 申请结束即终止培训，与结束申请入口关闭后仍可独立学习的规则不符。
- 网页提交者另设 WebClientKeyHash、人员车辆保存 SortOrder，与最新 MiniProgramUser 及申请关联模型不符。
- 缺少内部申请须知首次确认契约，车辆缺少可选 driverName。

### 1.1 合并与保留

| 旧接口职责 | 本版契约 | 减少的调用 |
| --- | --- | --- |
| client-context＋bootstrap | POST bootstrap 同时建立上下文、返回全部基础数据与首页统计 | 首页及后续各类型登记共用首次加载结果 |
| registration-config＋registration-context＋training-course-preview | bootstrap 下发所有启用类型的表单、须知、规则及类型区域课程映射 | 进入或切换登记类型、改区域、查看确认页均不请求配置 |
| 动态用户 user-options 搜索 | 前端填写姓名字段，提交服务解析后台用户 | 不提供匿名用户搜索，不下发候选账号 |
| 登记时带入人员／车辆档案 | 同一 bootstrap 可附带精确键，批量匹配当前浏览器有权读取的资料 | 不新增档案查询接口，也不为匹配重复传输未变的基础数据 |
| 申请详情＋training-tasks/query | application workspace 返回申请、人员、车辆、审批摘要及当前任务 | 详情页和任务页共用同一份数据 |
| 提交申请后再查任务 | 创建申请直接返回 application workspace | 提交成功可直接显示任务页 |
| 培训内容＋考试恢复＋结果＋考试历史＋凭证 | training workspace 返回本轮完整学习视图 | 视频、考试、结果、凭证页面共用同一份数据 |
| start＋单视频 completion | video-progress 处理首次播放及视频完成集合 | 共用一个进度写入接口；首次播放与播放结束仍按实际时点上报 |
| 逐题 answers＋submit | exam save 批量保存变更题目，可同时交卷 | 连续修改可合并，最后一批答案与交卷一次提交 |
| 临时附件 DELETE | 未绑定附件到期自动回收 | 取消编辑无需发清理请求 |

上传继续使用独立 multipart 接口。基础数据不包含内部用户列表、候选账号、UserName 或用户 Id；审批人只通过用户自行填写的姓名或 UserName 在服务端解析。个人档案、申请、培训记录、试卷及媒体文件仍按访问范围和实际需要读取。

### 1.2 一次加载与复用边界

- 首次一次取得全部可用基础配置，不再按登记类型拆分读取。区域和课程用共享集合保存，各类型通过 Id 引用，避免在多个类型里重复返回相同内容。
- 基础数据包括启用类型、每类型表单及须知、全局时段和下拉选项、人员车辆规则、区域、课程摘要、类型区域课程映射及前端校验约束，不包含内部审批账号。
- 动态业务数据仍以页面聚合：申请一次返回详情和任务；某课程一次返回学习、考试、结果、历史及凭证。不在基础数据里装入全站个人资料、题库答案、申请或视频文件。
- 写入响应直接更新本地页面缓存、关联任务及汇总，不立即补查。普通页面切换、类型切换、筛选、返回和恢复前台不默认发请求；刷新触发规则见第 5、12 节。
- 后端在业务服务内批量查询、组装 DTO，避免逐类型、逐人员、逐课程的重复查询，也不通过 HTTP 调用自身其他接口组装结果。

### 1.3 本地判断与服务端复核

| 事项 | 前端使用已加载数据完成 | 服务端执行最终校验 |
| --- | --- | --- |
| 登记表单 | 按类型生成字段、显示须知、字段必填、长度及数值范围、选项合法性、只读字段显示 | 提交时按当前模板、配置和须知版本复核，不信任客户端派生值 |
| 人员和车辆 | 姓名手机号去首尾空格、车牌规范化、格式检查、本次名单去重、单位继承、车辆和运输单位必填 | 按相同规则复核并处理全局档案唯一性及并发 |
| 审批人姓名 | 在姓名字段填写姓名或 UserName，只检查必填及文本长度 | 提交时精确解析唯一可用且有审批权限的用户，保存稳定 Id 及显示姓名；失败定位原姓名字段 |
| 区域及课程 | 区域可选状态、按类型区域映射取课程并集、去重、排序、人数与课程数量预览 | 提交时确认区域与组合配置仍有效，确定本次必修集合及真实任务关联 |
| 预约及须知 | 按业务时区计算今天、日期与时段预校验，须知倒计时、勾选及页面跳转 | 保存首次确认，校验当前提交版本及真实进厂条件 |
| 任务与结果展示 | 个人／全部筛选、进度计数；基于已返回的实际结果及通过时间、截止时间计算当前展示是否有效 | 提交时决定免训及轮次分配，操作时校验当前关联和实际有效性；进厂时再次检查 |
| 学习和考试 | 已完成视频计数、下一步按钮、已答题数、答案集合格式、剩余时间、未答完提示 | 视频写入、考试创建、截止时间、并发版本、最终评分及有效期 |

本地预校验失败直接提示，不请求“校验”“课程预览”或“下一步”接口。本地结果用于及时展示和减少无效请求；提交、权限、全局唯一性、轮次分配、评分及实际放行必须由服务端复核。考试一次下发本轮题目及标准答案，供前端本地显示答题卡对错提示，不新增判题请求；本地提示不生成真实成绩，交卷仍由服务端根据本轮快照和最终保存答案评分。

### 1.4 后台分发与后台建单的两种接续场景

本轮采用无登录的轻量访问：React 输入姓名＋手机号，精确匹配 Participant 后即可查询本人培训及关联申请，不以账号登录、短信验证或严格身份认证作为前置条件。姓名＋手机号是本轮约定的查询与访问入口，不声明已核验真实身份。

| 场景 | 查询结果与后续操作 |
| --- | --- |
| 后台向人员分发课程，没有申请 | 返回本人待学任务；直接从独立入口学习、答题，无须创建申请或确认申请须知 |
| 后台已创建 VisitApplication，本人有未完成的必修课程 | 返回关联申请及本人待学任务；打开申请时先完成尚未确认的须知，再继续本人视频、考试，已有进度和答案保留 |
| 后台已创建 VisitApplication，本人必修课程均有可用的有效通过记录 | 即使待学任务为空，也返回关联申请；须知需要确认时先确认，之后直接查看完整申请及有效培训结果，不要求重复学习、考试或提交申请 |

同一申请可登记多人。任一匹配到该申请人员的查询者可查看同一张申请单的完整信息；培训写入仍仅作用于本人，其他人员未完成不要求本人重学。此访问不转移提交者归属，不授予取消、编辑、审批或进出厂权限。React 原有外部自主登记入口继续保留。

## 2. 通用协议、幂等与版本

移动端前缀 `/api/v1`，后台前缀 `/api/v1/admin`。请求和成功响应使用 JSON，上传使用 multipart；属性 camelCase，枚举使用 lower camelCase 字符串，集合返回 `[]`，可空字段显式返回 `null`。直接返回业务 DTO，不增加 code/data 包装。

```typescript
type Id = number // 后端业务实体 int；不使用姓名、Code 或数组下标作为 Id
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
  clientToken: string
  businessTimeZone: 'Asia/Shanghai'
  today: DateOnlyString
}
interface BrowserTotalsDto { applicationCount: number; pendingTrainingCount: number }
```

所有响应包含 `X-Server-Time`。业务日期和预约日边界按 Asia/Shanghai；显示校准不代替服务端判定。包含上下文、个人资料、申请、学习或考试的响应使用 `Cache-Control: no-store`。

业务 Id 必须为正整数；框架用户 Id 保持字符串。JSON 字典中的数字题目 Id 使用字符串键，例如 `"501"`，不改变其业务标识含义。

- 分页从 1 开始，默认 20，允许 1–100。申请按 `createdAt DESC, id DESC`；配置沿用配置顺序；人员、车辆按 Id 稳定展示，不为申请人员／车辆关联新增 SortOrder；任务按人员及课程稳定展示，考试历史按 attemptNumber 排序。
- 文件 reference 是稳定引用，url 是临时地址。视频和 PDF 地址默认有效 60 分钟，视频支持 Range；通过 workspace 刷新地址，不改学习记录或考试计时。不得把学习凭证放入媒体 URL。
- 请求只接受已定义字段，不接受客户端提交成绩、标准答案、有效期、审批状态、进出厂时间或操作人。
- 申请提交以服务端确定的提交者＋clientRequestId 幂等；同键重复提交返回首次保存的申请，不比较提交指纹、不覆盖首次内容。响应丢失重试先恢复原申请，不因后续配置变化重新创建。
- 人员／车辆档案复用、申请快照、审批任务、培训关联及必要的新培训任务一致保存；已有真实记录仅关联，不重复新建。
- 创建首考／重考以 expectedPreviousAttemptId 确定唯一的下一次考试。视频完成集合追加，重复不增加进度；须知重复确认保留首次时间；同一次交卷只结算一次。
- 取消、须知确认、考试保存及后台状态操作使用强 ETag／If-Match。聚合响应内的 `application.etag`、`exam.etag` 或明确命名的资源 etag，分别表示对应可修改资源的版本，字符串包含引号，客户端原样放入 If-Match。**不需要为了拿 ETag 再调用单资源 GET，也不使用一个 workspace 版本代替其内部所有资源版本。**
- 缺失 If-Match 返回 428，版本变化返回 412。成功响应包含更新后的资源 etag；已成功的同一次交卷、确认或取消重试在范围校验后返回既有结果，不改首次时间。
- 同一聚合响应的状态、有效性和数量使用同一服务端判定时刻，etag 对应返回的资源状态。

## 3. 无登录访问与范围

### 3.1 浏览器上下文与提交者

所有业务接口使用配置化 `X-Api-Key`，无需登录，不配置域名白名单。`POST /bootstrap` 建立或恢复匿名客户端上下文并返回 clientContext.clientToken，无单独 client-context 接口。服务端签发有效期 30 天的受保护凭证，后续请求通过 `X-Client-Token` 请求头传递，再次 bootstrap 也携带它以保留原提交者归属。API 不读写身份 Cookie，不要求 CSRF token；React 请求使用 credentials=omit，可独立跨源部署，其他客户端沿用同一请求头契约。API key 控制接口访问，不代替 clientToken／learningToken 的数据范围检查。

匿名会话映射到后端已有 MiniProgramUser：外部浏览器复用其 ClientId 对应提交者，内部用户通过 ApplicationUserId 关联框架账号。MiniProgramUser.Id、SubmitterId 为 int，内部申请另存 SubmitterUserId。服务端决定提交者，客户端不指定 submitterId、SubmitterUserId 或浏览器归属。

服务端签发的 clientToken 是匿名客户端访问凭证，React 将其保存在 localStorage；ClientId 本身不作为访问凭证。不新增 VisitApplication.WebClientKeyHash 或与最新后端 SPEC 冲突的网页提交者模型。

“我的记录”只查询当前浏览器提交的申请。清除客户端凭证或换浏览器不删除服务端数据，也不自动取得原浏览器的整单权限。

### 3.2 姓名＋手机号查询后的访问范围

姓名＋手机号查询返回一个 **Participant 范围**的 learningToken，有效 2 小时，用于承接本轮无登录查询结果：覆盖本人独立任务、共享任务、历史考试、有效结果，以及本人关联申请的完整查看和须知确认。不再按“申请＋人员”重复发凭证；该 token 是轻量访问上下文，不代表已完成真实身份认证。使用 X-Learning-Token 请求头，可保存在 sessionStorage 支持刷新；不放入页面 URL、localStorage 或普通日志。

- 姓名和手机号同时精确匹配，去除首尾空格；查询不创建人员或申请。本轮不增加登录、短信验证或额外领取申请访问权的步骤。
- 以服务端确定的 ParticipantId 检查 VisitApplicationParticipant 关联，可查看该人员所在申请的完整业务信息、所有人员和车辆快照、审批摘要及培训任务；包括该申请 DTO 中已有的身份证及附件，不借此开放独立人员档案或无关申请。
- 允许确认关联申请保存的须知快照，仍只保存整单首次 NoticeAcceptedAt，不新增逐人确认记录。本人课程可学习、答题、查看本人考试及凭证；其他人员的培训写入和考试卷面不在此范围内。
- 不允许取消、编辑申请、审批或通行。带 learningToken 的请求仅按该 Participant 范围检查，不与 clientToken 的提交者权限合并；完整申请页可展示全部人员，实际学习操作只为本人启用。
- 学习接口 `applicationId=null` 表示独立入口，要求个人学习凭证；携带 applicationId 时校验本人属于该申请、任务为本人且已关联，以及申请状态和须知。原浏览器从自有申请进入时仍可按提交者范围操作该申请人员任务。
- 凭证到期重新查询，保留原视频、答卷及截止时间。IP 与浏览器分别限制查询每 10 分钟 30 次，超限返回 429 和 Retry-After。

### 3.3 申请归属与档案带入边界

内部后台创建的申请不属于访客浏览器，但属于其申请人员的可查询申请。姓名＋手机号命中该人员后，通过同一 learningToken 即可按第 3.2 节查看完整申请及确认须知，无须后台另发领取链接；同样适用于本人参与的外部申请。仅知道 applicationId 而没有提交者上下文或匹配人员的访问上下文时不返回申请。每次请求重查人员关联，移除关联后不能继续凭该人员上下文访问；不改变 SubmitterId、SubmitterUserId 或“我的记录”的浏览器归属。

登记资料带入仅返回当前浏览器已获授权的人员／车辆资料；不提供任意姓名手机号或车牌的全库档案检索。跨浏览器完整资料带入与附件复用权限需要另行明确，不借聚合响应放开。

支持 React 独立跨源部署，也可同源部署，网页 `/`、API `/api/v1`；代理保留 JSON 错误，不能将 API 404 回退为 index.html。跨源接受任意前端来源，响应回显具体 Origin，不启用 Cookie 凭据，允许 `X-Api-Key`、`X-Client-Token`、`X-Learning-Token`、`If-Match`，暴露 `X-Server-Time`、`ETag`、`Location`、`Retry-After`。不使用域名白名单。

接口文档由 OpenAPI 生成，Scalar 入口为 `/scalar/visitsafe`，契约为 `/openapi/visitsafe.json`；调试时手动填写 API key，页面不预填实际配置密钥。运行配置见 [API 接入说明](../docs/visitsafe-api.md)。

## 4. 手机端接口清单：12 个

B＝当前匿名浏览器；O＝当前浏览器作为提交者的申请；P＝按姓名＋手机号匹配的人员所关联申请；L＝按第 3 节校验的申请学习范围或本人学习凭证。bootstrap 只返回填写所需配置和当前浏览器统计，不返回后台题库或全站申请。

| 方法 | 路径（省略 `/api/v1`） | 一次返回／操作内容 | 范围 |
| --- | --- | --- | --- |
| POST | `/bootstrap` | 上下文、全部基础数据、首页统计；可批量匹配已授权档案，已有版本不重复传输配置 | B |
| POST | `/participant-attachments` | 上传一份可选人员附件 | B |
| POST | `/applications` | 提交申请，返回可直接展示的 application workspace | B |
| GET | `/applications` | 我的记录、搜索、分页和统计 | B |
| POST | `/applications/{applicationId}/workspace` | 申请详情及当前培训任务，必要时刷新过期关联 | O / P |
| POST | `/applications/{applicationId}/notice-acceptance` | 首次确认须知，返回完整 application workspace | O / P |
| POST | `/applications/{applicationId}/cancel` | 取消申请，返回更新后的 application workspace | O |
| POST | `/learning-task-search` | 一次查询本人待学、关联申请及通过结果，返回访问上下文 | B |
| POST | `/training-records/{trainingRecordId}/workspace` | 视频／PDF、进度、选定考试、结果、历史摘要和凭证 | L |
| PUT | `/training-records/{trainingRecordId}/video-progress` | 首次播放及视频完成集合，返回 training workspace | L |
| POST | `/training-records/{trainingRecordId}/exam-attempts` | 创建／恢复首考或重考，返回含试卷及版本的 training workspace | L |
| POST | `/exam-attempts/{examAttemptId}/save` | 批量保存变更答案，可同时交卷，返回 training workspace | L |

workspace 使用 POST：申请读取可能刷新过期任务关联，培训读取可能进行已到期考试的结算。重复调用不得重复创建轮次或考试，不能因读取重置任何开始时间。

后台边界另见第 10 节，不计入这 12 个手机端接口。

## 5. 一次加载基础数据、缓存与附件

### 5.1 bootstrap 请求和响应

首次请求体可省略，等同没有缓存版本及没有档案匹配键。恢复基础数据缓存、或确有档案带入需求时，可发送：

```json
{
  "knownBaseDataVersion": "base-data-v3",
  "participantKeys": [{ "name": "张三", "phone": "13800138000" }],
  "plates": ["沪A12345"]
}
```

首次没有完整缓存时 knownBaseDataVersion 省略或为 null。participantKeys、plates 可省略，分别最多 20 项；可以随首次请求一次发送草稿里已有的精确键。成功返回 200：

```typescript
interface BootstrapRequest {
  knownBaseDataVersion?: string | null
  participantKeys?: Array<{ name: string; phone: string }>
  plates?: string[]
}
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
interface OptionDto { value: string; label: string }
interface FieldDto {
  key: string
  label: string
  control: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiSelect' | 'checkbox'
  required: boolean
  readOnly: boolean
  sortOrder: number
  minLength: number | null
  maxLength: number | null
  minimum: number | null
  maximum: number | null
  options: OptionDto[]
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
}
interface RegistrationConfigDto {
  visitTypeId: Id
  configurationVersion: string
  applicationTemplateId: Id
  fields: FieldDto[]
  notice: { id: Id; version: string; title: string; content: string }
  areaRules: Array<{
    areaId: Id
    selectable: boolean
    unavailableReason: string | null
    requiredCourseIds: Id[]
  }>
  participantRules: {
    minimumCount: number
  }
}
interface BaseDataDto {
  generatedAt: InstantString
  visitTypes: VisitTypeDto[]
  registrationConfigs: RegistrationConfigDto[]
  timeSlots: OptionDto[]
  areas: AreaOptionDto[]
  courses: CoursePreviewDto[]
  attachmentRules: {
    allowedContentTypes: string[]
    maxSizeBytes: number
    maxFilesPerParticipant: number
  }
  validationRules: {
    phonePattern: string
    platePattern: string
    plateIgnoredCharacters: string
    plateUppercase: boolean
    participantNameMaxLength: number | null
    companyMaxLength: number | null
    tradeMaxLength: number | null
    driverNameMaxLength: number
  }
}
interface ProfileMatchesDto {
  participants: Array<{
    name: string
    phone: string
    profile: { id: Id; company: string | null; trade: string | null } | null
  }>
  vehicles: Array<{
    plate: string
    profile: { id: Id; transportCompany: string | null; driverName: string | null } | null
  }>
}
interface BootstrapDto {
  clientContext: ClientContextDto
  baseDataVersion: string
  baseData: BaseDataDto | null
  totals: BrowserTotalsDto
  profileMatches: ProfileMatchesDto
}
```

- baseData 是当前浏览器允许使用的全部启用登记基础配置，不按单类型分页或返回截断列表。每个 visitType 都有对应完整 registrationConfig，areaRules、requiredCourseIds 均能解析到共享集合，前端无需额外补查。
- 只返回启用且配置完整、允许新建申请的类型；学习入口始终独立。未知颜色和图标使用默认值，Code 不作为固定类型分支。
- fields 投影已有动态模块及 metadata。必填、长度、数值范围和选项一次返回；没有约束的项目为 null，未使用的选项集合为 []。审批用户字段仅在服务端使用，React 只取得其姓名伴随字段，按可编辑且必填的 text 控件填写姓名或 UserName；该对应关系来自模板配置，不按类型 Code 分支。其他不支持的控件不能静默变成文本框，不向客户端下发任意可执行表达式。
- timeSlots 来自共用 PicklistSet。其他业务下拉选项放在 fields.options；同一业务区域和课程摘要只在共享集合保存一份，各类型引用其 Id。
- areaRules 保存每个类型下各区域的可选状态、不可选原因及必修课程 Id；缺少有效课程或审批负责人时不可选。选择区域后，本地取课程并集即可预览，无课程预览接口。
- bootstrap 不返回用户候选集合，字段 options 和原始 metadata 也不得夹带内部账号或用户 Id。前端不做用户搜索或自动补全，姓名字段提交及解析规则见第 6.1 节。
- validationRules 下发与服务端一致、可由前端执行的格式和长度规则；正则限 JavaScript RegExp 兼容的格式表达式。车牌删除空白，再按 plateIgnoredCharacters 中列出的其他分隔符和大写规则规范化；人员姓名、手机号去首尾空格。服务端仍执行相同规则和最终业务校验。
- attachmentRules 一次返回允许格式、字节上限及每人文件数，初始为 JPEG／PNG／PDF、10 MiB、1 份；本地选择文件时据此预校验，不为获取上传限制单独请求，也不要求前端硬编码这些配置。
- participantRules.minimumCount 所有类型恒为 1；同申请内姓名＋手机号组合不得重复，不单独限制手机号唯一。人员单位、工种按本次提交值保存，车辆／运输单位必填仍由类型配置决定。

participantRules 仅包含固定的 minimumCount，不在 VisitType 保存人员单位／工种必填、单位继承或手机号唯一规则，也不从 Code 推断这些规则。人员明细规则见后端 SPEC 第 4.3、7.2 节，不新增人员字段存储或另一套规则实体。driverNameMaxLength 本版为 100，前后端一致。

首页、登记页或其他入口均可触发首次 bootstrap；同次应用运行只共享一份基础数据，不因页面或类型不同重复初始化。进入任何已载入类型的登记表单不再发配置请求。

pendingTrainingCount 在当前浏览器可访问的申请范围内按真实 TrainingRecord 去重，统计当前未完成任务；不将无继续培训需求的过期历史算作未完成，也不统计全站任务。该统计是 bootstrap 时刻的快照，后续优先使用业务操作响应更新，不为计数轮询 bootstrap。

### 5.2 基础数据版本与本地复用

- 首次返回完整 baseData 及其 baseDataVersion，前端以这对值作为完整缓存，放入当前应用内存；可将纯基础数据缓存到 sessionStorage 支持同标签页重载，不保存 token、身份证、附件和档案匹配结果到这份缓存。
- 同次应用运行中的页面切换、类型切换、下拉选项筛选、区域切换和表单预校验直接读缓存，不先请求“版本检查”。完整网页重载或用户主动刷新时，可在同一次 bootstrap 中传 knownBaseDataVersion：相同版本返回 baseData=null，否则一次返回完整新数据，不先返回“有更新”再让前端补取。
- baseData=null 仅表示版本相同、继续使用完整缓存，不表示没有类型或不需要配置。没有可用完整缓存时必须传 null／省略版本；缓存缺损时清除版本和数据，并重新 bootstrap 一次。
- 指纹覆盖基础配置，不包含内部用户信息、generatedAt、今天、首页统计、档案匹配结果或临时文件地址，避免每次时间或查询变化都触发全量更新。基础数据版本不能替代申请和考试 etag；用户可用性在提交时重新校验。
- 每类型 configurationVersion 只覆盖本类型的实际提交依赖；其他类型变化不要求重填当前草稿。提交仍携带本类型版本及 noticeVersion；如果本类型已变化，服务端在同一错误响应附完整新 baseData 和 baseDataVersion，前端直接替换，保留输入并对受影响须知重新确认，无后续配置补查。
- 普通后台恢复、每次点击下一步或固定轮询不刷新基础数据。用户主动刷新、缺损缓存、会话失效恢复，或服务端明确配置失效且没有附最新基础数据时才重新 bootstrap；审批人解析失败仅提示重填，不为此刷新基础数据。
- HTTP 响应继续 no-store；上述复用是应用对纯基础数据的显式缓存。浏览器归属改变或当前数据访问范围被撤销时清除对应缓存，不能复用其他范围的数据。

### 5.3 档案匹配与本地资料带入

人员车辆档案是动态业务数据，不是可以公开全量下载的基础字典。首次 bootstrap 可随草稿一起批量匹配；后续新增姓名手机号或车牌时，先复用已获得的匹配结果，确有新的带入需求再把多个精确键合并到一次 bootstrap，并携带已缓存的 knownBaseDataVersion，避免重复下载基础配置。用户只录入并提交新资料时不强制先匹配。

profileMatches 只按请求键及当前浏览器权限返回最少字段；不存在或不可访问均为 null，不返回身份证、附件或他人资料。请求列表为空时相应匹配数组为空，不返回全库人员或车辆。

用户确认后本地带入单位、工种或默认运输单位；本次修改写申请快照，不自动改档案或历史。匹配不创建档案、申请或培训任务，提交仍由服务端按规范化身份和车牌复用档案，不信任客户端的匹配 Id。

初始物流业务字段通过对应动态模板下发。前端填写 logisticsContactName（厂内对接人姓名），后端从本次输入解析用户并填充 logisticsContactUserId，前端不提供该 Id。车辆司机仅有可选 driverName，不携带手机号或 ParticipantId。

### 5.4 附件

`POST /participant-attachments` 接收 multipart 字段 file，允许 JPEG、PNG、PDF，单文件最大 10 MiB；检查实际文件类型和大小。文件类型、已知大小和每人一份先在本地预校验，合格后才上传。返回 201：

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

首次新建 Participant 时保存本次身份证及附件作为档案初始资料；复用已有 Participant 时，本次输入仅保存到申请人员快照，不覆盖已有档案。省略本次身份证或附件表示本申请未填写，不自动从档案读取敏感资料。文件引用绑定及授权校验不等同于更新档案字段，后续档案维护仍沿用后台权限。

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

审批人员的输入保存在 dynamicValues 的姓名字段中，值为用户自行填写的姓名或 UserName；对应用户 Id 字段由服务端填充，不接受 React 指定：

| 初始类型 | React 填写并提交的字段 | 服务端解析后填充的字段 |
| --- | --- | --- |
| 普通访客 | hostName（被访人姓名） | hostUserId |
| 物流车辆 | logisticsContactName（厂内对接人姓名） | logisticsContactUserId |
| 施工人员 | supervisor（现场负责人姓名） | supervisorUserId |

例如普通访客的请求片段为 `"dynamicValues": { "hostName": "张三", "visitReason": "会议" }`，不能将姓名或 UserName 放入 hostUserId。其他类型使用本类型模板对应的姓名字段，新增类型沿用配置的审批用户字段与姓名伴随字段关系，不按上述三种 Code 硬编码。

服务端去除输入首尾空格，先按框架 UserName 规范化规则精确匹配；未命中再按显示姓名精确匹配。只有唯一、启用且有相应审批权限的用户才能继续提交，随后填充内部用户 Id，并将姓名字段保存为解析后的显示姓名。未命中、停用或无权限时返回 APPROVER_UNAVAILABLE，提示“未找到可用人员，请重新填写姓名或 UserName”；姓名重名时返回 APPROVER_AMBIGUOUS，提示“存在重名，请填写准确的 UserName”。errors 定位到原姓名字段，例如 `/dynamicValues/hostName`；不返回候选账号、不模糊匹配、不随机取第一人。全部校验成功才一致保存申请和关联，不留下部分数据。

人员按去首尾空格后的姓名＋手机号，车辆按规范化车牌复用档案；车辆和本次运输单位必填来自 VisitType，driverName 不关联人员。新建 Vehicle 时保存初始 DriverName，复用档案时不覆盖其默认值，不另存申请司机姓名快照。服务端分别建立申请人员及车辆快照，新关联的进出厂时间和操作人全部为空。

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
  | { view: 'notice'; access: 'owner' | 'participant'; currentParticipantId: Id | null; applicationId: Id; applicationEtag: string; notice: NoticeDto; browserTotals: BrowserTotalsDto | null }
  | { view: 'detail'; access: 'owner' | 'participant'; currentParticipantId: Id | null; application: ApplicationDetailDto; tasks: ApplicationTaskDto[]; browserTotals: BrowserTotalsDto | null }
```

`POST /applications/{id}/workspace` 无业务请求体，返回 200。先检查提交者归属或匹配人员关联；未结束申请尚未确认须知时返回 notice 分支，前端只展示保存的须知快照。确认后返回 detail 分支，可直接展示完整详情或本申请任务，全部／个人切换在页面内筛选，不再按人发查询。已结束申请直接返回只读 detail，不要求补确认须知。

access=owner 时 currentParticipantId=null，返回当前浏览器 browserTotals；access=participant 时返回当前人员 Id、browserTotals=null、application.canCancel=false。两种范围的申请详情字段及任务集合一致，人员范围内仅本人任务的 actions 可为 true，其他人员只展示进度。本人当前必修课程全部有效时展示“培训已合格，无需重复学习”及申请详情，不因待学为空隐藏申请，也不要求其他人员先完成。

businessFields 按关联字段定义及已保存字段值投影业务显示值，不单独保存字段定义快照；定义变更可能影响历史展示解释。审批人员只返回 hostName、logisticsContactName、supervisor 等解析后的显示姓名，不返回其内部用户 Id 字段、UserName 或原始动态字段记录。完整申请信息及 Problem Details 扩展均遵守此规则，不能因查看整单而公开内部账号。

未结束且人员尚未进厂时，读取必要的过期课程可按第 9 节追加新关联；tasks 每人每必修课程只取本申请关联中最大 RoundNumber。申请结束或已进厂人员不因页面查询强制新增轮次；历史只读。列表字段、审批及培训进度在同一判定时刻汇总，不能把培训合格当作申请已审批或已结束。

### 6.3 须知首次确认

`POST /applications/{id}/notice-acceptance` 携带申请 If-Match，请求 `{ "noticeId": 11, "accepted": true }`，返回 200 最新 ApplicationWorkspaceDto。确认已有申请保存的须知快照，不要求当前须知配置版本，也不因配置改动替换历史正文。

前端使用 3 秒倒计时及勾选交互；服务端只在 NoticeAcceptedAt 为空时保存首次确认时刻。重复确认不覆盖。提交者或任一通过姓名＋手机号查询、仍关联本申请的人员均可确认同一份须知；不新增逐人确认或严格身份验证步骤。内部创建尚未确认不阻碍审批；本申请入口先确认再继续，独立培训不受限制。已结束且未确认的申请保持只读，不补写确认时间。未经查询匹配或提交者范围检查，不能仅凭 Id 调用此接口。

### 6.4 我的记录与取消

`GET /applications?q=张三&page=1&pageSize=20&status=pendingApproval` 返回：

```typescript
interface MyApplicationsResponse {
  records: Page<ApplicationSummaryDto>
  totals: { applicationCount: number; participantCount: number; validRecordCount: number }
}
```

q 可省略，去首尾空格最多 100 字符，在当前范围内搜索历史人员资料、业务显示值、类型名、车牌和运输单位。分页按筛选计算，totals 统计当前浏览器全部申请；validRecordCount 按真实记录去重，人员数按申请人员关联计数。汇总查询不为了统计无需求的过期历史而创建培训。

`POST /applications/{id}/cancel` 仅允许原提交者浏览器范围，无业务请求体、携带申请 If-Match，返回 200 最新 ApplicationWorkspaceDto。仅 pendingApproval／approved 且所有人员、车辆均无进出厂记录时允许；车辆已进厂而人员尚未进厂也不能取消。canCancel 使用相同规则。服务端在同一事务内重查人员与车辆审计，处理与进厂操作的并发，不能仅凭页面按钮或旧 ETag 放行。成功后取消未处理审批，保留独立人员、车辆、培训与考试。已取消重试返回既有结果。

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
  browserTotals: BrowserTotalsDto | null
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

提交者范围的申请及培训 workspace 返回当前浏览器的 browserTotals，方便操作后直接更新首页。learningToken 范围下该字段为 null，即使可查看完整关联申请也不返回原提交者浏览器的统计。本地更新已载入任务和单申请汇总；没有完整数据时不自行推算全局去重数量，直接使用这些返回值，避免为统计补查 bootstrap。

### 7.2 姓名＋手机号查询

`POST /learning-task-search` 同时支持后台分发学习和后台建单后的申请查找。首次请求只需 `{ "name": "张三", "phone": "13800138000" }`，三个集合各返回第一页；分页请求仍调用同一接口，返回 200：

```typescript
interface LearningSearchRequest {
  name: string
  phone: string
  tasksPage?: number
  applicationsPage?: number
  completedRecordsPage?: number
  pageSize?: number
}
interface ParticipantApplicationSummaryDto {
  id: Id
  visitTypeName: string
  source: 'external' | 'internal'
  status: ApplicationStatus
  createdAt: InstantString
  appointmentDate: DateOnlyString
  timeSlot: string
  areaNames: string[]
  noticeAccepted: boolean
  myTraining: { requiredRecordCount: number; validRecordCount: number; allQualified: boolean }
}
interface LearningSearchResponse {
  participant: { id: Id; name: string; maskedPhone: string } | null
  learningToken: string | null
  learningTokenExpiresAt: InstantString | null
  tasks: Page<{
    record: TrainingRecordDto
    relatedApplications: Array<{ id: Id; visitTypeName: string; appointmentDate: DateOnlyString }>
  }>
  applications: Page<ParticipantApplicationSummaryDto>
  completedRecords: Page<{ record: TrainingRecordDto; completion: CompletionDto }>
}
```

按姓名＋手机号定位独立 Participant，一次返回三个分别分页的集合；页码默认 1，pageSize 默认 20、范围 1–100。前端按“待学习”“访客申请”“培训结果”展示，不以 tasks 是否为空决定整个查询是否有结果。

- tasks 返回本人当前待学任务，包括没有申请的后台分发任务。共享任务按 TrainingRecord.Id 去重，不按申请拆成重复课程；本人的其他轮次已通过不能隐藏当前待学轮次。
- applications 按 VisitApplicationParticipant.ParticipantId 查询本人参与的申请，包括后台代建、原浏览器外部提交及已有有效培训而无待学任务的申请；每张申请仅一条，包含结束后的只读历史。myTraining 仅按该申请已关联的本人当前轮次汇总，不能被同单其他人员进度影响。按 createdAt DESC、id DESC 排序；点击后用相同 token 读取完整 application workspace，无须重新登记或额外领取权限。
- completedRecords 返回本人所有实际通过记录及凭证，包含仍有效和已过期的历史，按 CompletedAt DESC、Id DESC 排序。即使没有待学任务或申请，也能发现通过记录 Id、查看有效截止时间及进入培训 workspace；不只允许访问“已知 Id”的历史。历史结果展示不代替当前待学轮次，也不创建免训副本。

对本人在未结束申请中尚未进厂、且有继续学习需求的过期关联进行刷新；不刷新同单其他人员，不创建申请，不重算已提交申请的必修课程，也不为没有需求的独立过期历史自动分配任务。有效通过且没有待学新轮次的课程不放入 tasks，但其申请仍放入 applications，通过记录仍放入 completedRecords。关联申请结束后，实际未完成的独立任务仍可返回。

无匹配人员时 participant、learningToken、learningTokenExpiresAt 均为 null，三个分页集合的 items 均为空、totalCount=0。匹配到人员后即返回访问上下文，不要求 tasks 非空；全部培训有效的申请显示“查看申请”，有未完成课程的未结束申请显示“继续培训”。本人已进厂或申请已结束时按只读申请展示，不因历史培训到期要求在该申请重学。

### 7.3 一次取得课程页面数据

`POST /training-records/{id}/workspace` 请求：

```json
{ "applicationId": null, "examAttemptId": null, "examHistoryPage": 1, "examHistoryPageSize": 20 }
```

可省略分页参数使用默认值。applicationId 指定已有申请入口，否则是独立入口。examAttemptId 指定固定一次考试；为空时选择进行中考试，否则选择本轮最近一次已交卷考试。正常返回 200 TrainingWorkspaceDto。

申请入口先校验提交者或人员关联及任务归属。直接打开课程链接而未确认须知时，workspace、视频进度、考试创建及保存均返回 409 NOTICE_NOT_ACCEPTED，并在 Problem Details.workspace 附同范围的申请 notice 分支，包含须知快照和 applicationEtag；不写学习进度或接受新答案。前端确认后按原链接继续，不能靠跳过申请页绕开须知。已结束申请仍可只读查看历史课程和结果，全部写入拒绝；独立入口不受申请须知或结束状态影响。

- 一次返回本轮视频／PDF、进度、选定考试的题目与已存答案、该次结果、分页历史摘要及已有真实凭证。没有考试／结果／通过记录时相应字段为 null，不再以“尚未生成”为由强制客户端逐个请求结果和凭证接口。
- 同一 workspace 供 LearnPage、ExamPage、ResultPage、CompletionPage 使用。创建考试、写视频、保存或交卷后，响应就是更新后的 workspace，不再补查考试／结果／凭证。
- 指定旧 examAttemptId 时展示该次考试，不替换成最新一次；历史切换、分页可调用同一路径。record 始终是请求的那轮记录；currentTrainingRecordId 按入口上下文计算，旧记录不被静默替换。
- exam.canAnswer、exam.canSubmit 仅针对当前选定考试；已交卷历史只读。actions 按当前培训及入口计算，不因查看旧失败考试而允许覆盖历史或再创建一份进行中考试。
- 结束申请入口只读，不因另一申请分配了更高轮次就改写本申请依据。独立入口可继续已分配的未完成任务，不受历史申请状态或其须知限制。
- 视频／PDF及试题来自本轮快照；不返回原始 CourseSnapshotJson。考试 questions 一次返回本轮全部题目及 correctIndexes，供前端本地显示答题卡对错提示；不新增判题接口，不接受前端判定作为成绩。未交卷时不返回解析，仅已交卷 result 提供该次错题解析。
- PDF 不计视频完成；媒体签名地址到期时重读此 workspace，不新建培训或考试。
- PDF 存储在 TrainingVideo，课程快照的视频明细保留相应引用。课程级 pdf 响应字段保留为空；现有后台视频 PDF 上传与展示继续沿用，手机端逐视频文档入口尚未对接。

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
interface ExamQuestionDto { id: Id; type: QuestionType; title: string; options: string[]; points: number; correctIndexes: number[] }
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
2. 逐人逐课程优先选择实际已交卷通过且 `CompletedAt <= 当前时刻 < ValidUntil` 的记录；申请还要求 ValidUntil 晚于预约日 00:00。多条结果按 CompletedAt 最新、同时间按 Id 升序。后台特批生成的合法实际通过结果按后端 SPEC 同样参与判断；命中时申请仍可查询和查看，不再要求学习或答题，须知、审批及进厂条件分别判断。
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
| 403 | ACCESS_CONTEXT_EXPIRED | 恢复 bootstrap 或重新查询本人任务；不能将失效凭证当作成功 |
| 404 | RESOURCE_NOT_FOUND | 不存在或不在范围内统一处理，不附带别人的 workspace |
| 409 | CONFIGURATION_CHANGED / NOTICE_CHANGED | 直接附完整新 baseData 及 baseDataVersion，保留草稿、复用新配置并按需重新确认；已有申请仍用原须知快照 |
| 409 | VISIT_TYPE_DISABLED / AREA_UNAVAILABLE / TRAINING_CONFIGURATION_MISSING | 配置不可用，不允许部分提交 |
| 409 | APPROVER_UNAVAILABLE / APPROVER_AMBIGUOUS | 定位 dynamicValues 中原姓名字段，提示重填姓名或准确 UserName；不返回候选用户，不刷新基础数据，保留其他资料 |
| 409 | ATTACHMENT_UNAVAILABLE | 附件失效则重新上传，保留其他资料 |
| 409 | APPLICATION_ENDED / APPLICATION_STATE_CONFLICT | 返回有权取得的当前 application workspace，按入口处理只读；人员或车辆已有进出厂记录时拒绝取消 |
| 409 | NOTICE_NOT_ACCEPTED | 申请入口先展示附带的 notice workspace，确认后继续原学习链接；独立学习不受影响 |
| 409 | TRAINING_RECORD_NOT_CURRENT / TRAINING_ALREADY_VALID / TRAINING_NOT_STARTED / VIDEOS_INCOMPLETE | 有权时附 currentTrainingRecordId 和 trainingWorkspace，不另读多次状态 |
| 409 | EXAM_NOT_READY / EXAM_ALREADY_SUBMITTED / EXAM_DEADLINE_REACHED / EXAM_ANSWERS_INCOMPLETE | 有权时附当前 trainingWorkspace；未被接受的本地选项不标记已保存 |
| 412 | VERSION_CONFLICT | 有权时附最新 workspace 及各资源 etag，由用户解决冲突 |
| 413 / 415 | FILE_TOO_LARGE / FILE_TYPE_NOT_ALLOWED | 重新选文件 |
| 428 | PRECONDITION_REQUIRED | 请求缺少目标资源 If-Match |
| 429 | RATE_LIMITED | 按 Retry-After 等待 |
| 500 / 503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE | 未确认成功；保留输入，恢复状态或重试原幂等操作 |

workspace、trainingWorkspace、baseData、baseDataVersion 是 Problem Details 的可选扩展，只有通过当前范围检查且能取得一致状态时返回；没有相应扩展时才调用对应聚合读取接口恢复。NOTICE_NOT_ACCEPTED 已通过申请范围检查时必须附 notice workspace。不以 200 包装业务失败。后台另使用框架 401／403，以及 APPOINTMENT_DATE_MISMATCH、APPROVAL_INCOMPLETE、TRAINING_NOT_VALID、PARTICIPANTS_STILL_INSIDE、VEHICLES_STILL_INSIDE 等业务 code。

TRAINING_RECORD_NOT_CURRENT 的 trainingWorkspace 可直接返回 currentTrainingRecordId 对应的新轮次，供前端切换；它是明确的错误恢复信息，不改变正常 workspace 对指定历史记录的展示规则。考试版本冲突返回的 exam 仍为请求指定的 examAttemptId，不替换成其他次考试。

## 12. 页面调用预算与接入方式

以下计数指数据已获授权、没有冲突和网络重试的正常业务请求。基础数据只初始化一次；业务分页、文件上传和确需服务端状态时按实际需要请求，不为本地可判断的事项增加接口调用。

| 场景 | 本版正常调用 | 直接使用的数据 |
| --- | --- | --- |
| 首次打开应用（首页或直达登记） | bootstrap 1 次 | 会话、全部类型、表单、须知、时段、区域、课程映射及校验规则，不含内部用户列表 |
| 从首页进入或切换任一启用登记类型 | 0 次 | 同一份完整基础数据 |
| 填写审批人姓名、筛选业务下拉选项 | 0 次 | 姓名仅检查必填及长度，业务下拉使用已加载选项；用户解析随申请提交完成 |
| 改区域、预览课程、切换登记步骤及确认页 | 0 次 | 本地校验、映射、并集及计数 |
| 精确匹配新输入人员／车辆以带入资料 | 如有需要，合并为 bootstrap 1 次 | 已有版本时 baseData=null，仅接收本次匹配及上下文等动态数据 |
| 提交申请进入任务页 | applications 1 次 | application workspace，无后续详情／任务补查 |
| 从记录进入详情再切换任务页或人员 | application workspace 1 次 | 全部申请资料及任务；切换本地筛选 |
| 确认已有申请须知 | notice-acceptance 1 次 | 可继续使用的 application workspace |
| 姓名＋手机号查后台分发任务或已建申请 | learning-task-search 1 次 | 去重待学、关联申请、通过结果与本人访问上下文；全部有效仍有申请可查看 |
| 打开查询到的后台申请 | application workspace 1 次 | 同张完整申请及全部任务；只启用本人学习，已有效无需重复培训 |
| 打开某一课程学习 | training workspace 1 次 | 视频、PDF、考试、历史及凭证状态 |
| 开始／恢复首考或重考 | exam-attempts 1 次 | 完整考试、服务端时间、已存答案及版本 |
| 从已载入 workspace 切换考试／结果／凭证页 | 0 次 | 复用响应，历史按固定 examAttemptId 展示 |
| 修改答案、下一题、答题卡及倒计时显示 | 本地立即处理；保存队列合并发送 | 已有试卷、答案和绝对截止时间，不请求逐题校验 |
| 保存最后一批答案并交卷，进入结果／凭证 | save(submit=true) 1 次 | 结果、错题、有效期及凭证，无额外结果查询 |
| 完整网页刷新并恢复考试 | training workspace 1 次；缺少上下文时另 bootstrap 1 次 | 同一考试、已存答案、原 DeadlineAt；基础缓存可通过版本复用 |
| 取消申请 | cancel 1 次 | 更新后的 application workspace |

### 12.1 本地派生状态和按需刷新

- 使用 API 访问层及按 applicationId／trainingRecordId／examAttemptId 定位的页面缓存；涉及范围的 workspace 同时包含 access、当前 ParticipantId 和 applicationId，不能将提交者操作权限带入姓名查询范围。共享任务仅同步真实进度和结果，actions、canCancel、isExempt 等按各自入口保留；不因切换到另一个页面立即重复读取刚收到的数据。
- 根据 X-Server-Time 和本地经过时间推算业务当前时刻，按 Asia/Shanghai 更新“今天”、预约日期提示、剩余秒数和有效期展示。倒计时每秒、跨过午夜或有效期截止不调用时间／校验接口，不能只缓存服务端某一时刻的 isValid 布尔值。
- 本地展示有效性只基于已返回的真实通过及 CompletedAt、ValidUntil；未拿到本人记录时不推断免训。申请任务只在本申请关联内选当前轮次，不将其他申请的更高轮次替换过来。
- 普通页面返回、人员切换及恢复前台优先复用缓存并重算派生状态。只在用户主动刷新、凭证失效、版本冲突且响应未附现状、考试到期需要结算、或待使用媒体地址到期时，调用相应聚合接口；同一资源并发需求合并成一次请求。
- 恢复前台时如本地判断考试已到期，读取 training workspace 一次，服务端按实际 DeadlineAt 判断是否结算，响应直接用于结果页，不先读一次再自动交卷。未过期且缓存和凭证可用时沿用同一试卷、截止时间和答案，并继续原保存队列；未确认成功的交卷或未知的远端状态也通过一次 training workspace 恢复，避免设备时钟误差导致提前交卷。
- 后台审批可能在缓存期间变化。页面标注当前已读取状态的时间并提供主动刷新，不为显示审批状态持续轮询；发起真实业务动作时仍由服务端按当前状态校验，冲突响应直接刷新页面数据。
- token 到期或访问范围切换时只恢复对应凭证／清除对应个人缓存，不重新下载未变的全部基础数据。媒体地址刷新不重建培训或考试。

过程答案仍按第 8 节合并后异步保存；播放器首次实际播放与完成在各自时点上报。本地预判断减少读请求和无效写请求，不将未保存答案或未提交的视频进度标记为服务端成功。

未交卷时不本地判对错；API 模式移除演示计时及本地评分，不上传 visitsafe.web.v3 的演示成绩或本地 Id。现有登记步骤保持，物流独立人员及统一 vehicles 的适配按 React／后端 SPEC 实现。

## 13. 契约验收与交付边界

本轮只进行文档 review，以下为后续接口和前端接入验收要求，不表示已有服务或测试通过。

1. 首次一次 bootstrap 获得全部启用基础配置，不含内部用户账号；随后进入或切换登记类型、填写审批人姓名、改区域、下一步及确认页均不请求配置或校验。前端能完成第 1.3 节列出的本地预判断。
2. 创建申请返回可直接展示的任务页；重复提交只创建一张申请和正确的审批／课程关联，既有任务不复制。动态类型、字段及业务下拉选项遵循模板，不增加固定类型分支。
3. 申请 workspace 同时支持详情、全部／个人任务；各内部资源 etag 已返回，不额外为取消、须知或考试取得版本。
4. 人员车辆复用独立档案、本次人员、车牌及运输单位按现有快照保存，申请人员与车辆无 SortOrder；司机姓名仅在新建车辆时保存为默认资料，不另存申请司机快照；物流两车三人按三人分别分配课程，车辆不生成人员或课程。
5. 未确认申请返回原须知快照并保留首次确认时间，确认一次即可继续；直接课程链接返回同范围 notice workspace，独立学习不等待申请须知或审批。姓名＋手机号匹配后可查看同张完整申请及确认须知，但不取得取消、编辑、审批、通行或他人答题权限。
6. 独立分配任务可被本人查询；多申请共享任务只返回一份，同一视频、考试、答案和有效期从不同入口一致；新申请按课程分别免训、继续或新建。
7. 当前及预约日有效期边界、更高轮次追加、本申请轮次选择和过期原快照重训遵守第 9 节；旧通过不能隐藏当前待学，其他申请新轮次不替换本申请。
8. 已载入课程 workspace 可展示学习、已有考试、选定结果、历史及凭证；创建或交卷后无恢复考试、取结果、取凭证的连续补查。历史考试始终按固定 Id 展示。
9. 视频首次播放记录 StartedAt，重复不重置；完成集合只能追加，非法视频或未完成视频不能考试；不把开始和结束延迟到同一上报时刻。
10. 批量保存只修改 changes 中的题目，空集合清除、单选多项拒绝，多选少选零分。交卷携带最后一批变更时一次保存并评分；缺题或版本冲突不部分写入。
11. 两标签页旧 etag 返回 412 和有权取得的当前 workspace，不能自动覆盖新答案。失败或断网显示未保存；只恢复服务端接受的答案。
12. 到期后的 changes 不被接受，服务端按截止前已存答案结算；save、到期处理、查询和重试交卷只生成同一结果，不重置计时。应用结束不冻结独立考试。
13. 成功交卷响应直接包含成绩、错题、原期限及真实凭证；关联有效通过不生成新成绩或考试；课程配置调整不追溯已有通过时间和截止。
14. 取消须重查人员与车辆均无进出厂记录，车辆已进厂、人员未进厂时同样拒绝，并处理取消与进厂并发；取消／删除关联保留独立档案、培训、考试和文件。结束申请入口只读，本人和其他申请仍能使用独立任务；过期独立历史没有需求时不自动新建轮次。
15. 聚合读取和错误扩展都遵循当前范围：查询人员可读取其所在申请完整快照，不能读取无关申请、独立档案、他人考试卷面或使用原提交者操作权限。浏览器清除客户端凭证后仍可通过姓名＋手机号查本人任务及关联申请，不删除服务端业务；token 失效不重置学习。
16. 附件超限、格式错误、过期或越权拒绝；未绑定附件自动回收，已绑定资料按历史保留，取消编辑不需要 DELETE。
17. 后台一次 workspace 提供审批、人员及版本，操作响应足够更新页面；放行仍检查须知、审批、预约日及本人有效课程，重复操作不改首次审计，未出厂的已进厂车辆阻止整单完成。
18. 基础数据集合及所有引用完整，不按类型补查；React 只填写并提交 hostName、logisticsContactName、supervisor 等姓名字段，不提交对应用户 Id。后台按姓名或 UserName 精确解析，未找到或重名时定位原姓名字段并拒绝整次提交；bootstrap、申请及错误响应不下发内部用户列表、账号或用户 Id。
19. 已有完整缓存且版本相同时 baseData=null、缓存继续可用；版本不同时同次返回完整新数据。缓存缺损不能只保留版本，日期或档案查询变化不导致基础数据指纹变化。
20. 某类型配置变化后，提交错误直接携带最新基础数据，保留草稿并只对受影响须知重新确认；无关类型变化不使本类型请求失效。篡改客户端必填、审批人输入、课程集合、免训或本地时钟不能绕过服务端校验。
21. 回到前台、切换页面、每秒倒计时、午夜及有效期展示变化不自动产生重复查询；必要的结算、媒体刷新、版本／权限恢复按第 12 节执行。
22. 档案带入键批量合并，空键不返回档案列表；相同基础版本不重复传输字典。档案匹配可跳过，不影响正常提交时复用真实档案。
23. 后台仅分发课程时，无申请也能按姓名＋手机号学习答题；后台已建申请时，同样查询返回该申请，无须访客重新登记。三个集合分别分页，某集合为空不隐藏其他集合。
24. 本人必修培训全部有效时，查询仍显示申请及真实通过结果；只需确认尚未确认的申请须知并查看申请，不创建新任务、考试或延长有效期，不因其他人员未完成而要求本人重学。无申请、无待学时也能发现历史通过记录并查看凭证。
25. participantRules.minimumCount 所有类型恒为 1，人员按姓名＋手机号组合去重，单位和工种按提交值保存；初始与新增类型使用同一校验，不按 Code 判断人员必填、手机号唯一或单位继承。

实现时使用独立 Request／Response DTO、统一 JSON 字符串枚举及 Problem Details，为每个操作声明访问范围、operationId 和成功／错误响应并导出 OpenAPI。权限、事务、评分和共享轮次处理由业务服务复用，不直接序列化 EF 实体或完整课程快照。

本轮已明确姓名＋手机号的轻量访问边界、后台分发课程及后台建单的 React 接续，不将严格身份认证作为实现前置条件。跨浏览器独立档案的完整资料带入、附件跨申请复用、车辆通行写入及独立自动过期仍待相应业务契约明确；不影响本轮查询关联申请及查看其已有快照附件。本文不表示 API 或 React 已接入。
