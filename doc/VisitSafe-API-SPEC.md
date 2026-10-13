# VisitSafe API SPEC：React 手机端与 ASP.NET Minimal API

更新日期：2026-10-13。版本：v1 接口设计稿。

## 1. 目标与范围

为现有 `web/` React 手机网页接入 ASP.NET Minimal API 定义请求、响应、访问范围和业务约束。后台继续使用 CleanBlazorServerPro。本轮只交付接口规范，不实现接口、不修改 React 页面或现有部署配置。

依据：

- [后端实体与业务规则](VisitSafe-Backend-SPEC.md)。实体名称统一使用 VisitType、VisitNotice、VisitApprovalTask、VisitApprovalConfig。
- [React 手机端 SPEC](VisitSafe-React-Mobile-SPEC.md)。当前实现是浏览器本地演示，本文定义之后的真实 API 接入要求。
- 现有 `web/src/domain/types.ts`、`store.ts` 和 `web/src/pages/` 中的登记、任务、学习、考试、结果及记录流程。

已确认：React 端不需要登录，不增加账号、密码、短信验证码或微信登录接口。匿名浏览器可登记，同一手机可供多人轮流学习；姓名＋手机号继续用于查询个人待学任务。后台审批和进出厂操作仍要求后台用户及对应权限。

本版包括首页配置、动态登记表单、审批人员选择、课程预览、人员附件、申请提交与查询、申请取消、个人培训、考试、错题及培训凭证。后台操作接口只定义与申请状态衔接的最小边界；基础配置、课程、题库和后台列表的管理 CRUD 沿用后台能力，不在本版展开。

业务规则以后端 SPEC 为准。本文补充的浏览器归属、DTO、并发控制、上传限制和接口路径是接入设计，不表示服务已实现。后端 SPEC 尚未定义的网页提交者适配见第 3 节；本轮不直接修改该文档。

## 2. 通用协议

### 2.1 路径、格式与时间

| 项目 | 约定 |
| --- | --- |
| 移动端前缀 | `/api/v1` |
| 后台操作前缀 | `/api/v1/admin`，沿用后台认证与权限 |
| 请求与成功响应 | `application/json; charset=utf-8`；上传为 `multipart/form-data` |
| 错误响应 | `application/problem+json`，见第 4 节 |
| JSON 字段 | camelCase，不直接序列化数据库实体 |
| 标识 | 不透明 `string`；不得把 Code、人员姓名或数组下标当实体 Id |
| 枚举 | lower camelCase 字符串，例如 `pendingApproval`、`singleChoice`，不传数字枚举 |
| 日期 | `YYYY-MM-DD`，映射 DateOnly |
| 时间 | ISO 8601 带时区时间，例如 `2026-10-13T02:00:00Z`，映射 DateTimeOffset |
| 业务时区 | `Asia/Shanghai`，服务端据此计算今天和预约日边界 |
| 空值 | 响应的可空字段显式返回 `null`；集合返回 `[]`；请求中的选填资料可省略或传 `null` |
| 成功结构 | 直接返回 DTO，不增加 `{ code, message, data }` 包装 |
| 服务端时刻 | 所有 API 响应包含 `X-Server-Time`，值为上述 ISO 时间格式；用于校准显示，业务判定仍在服务端 |
| 敏感数据缓存 | 浏览器上下文、申请、任务、考试、学习查询响应使用 `Cache-Control: no-store` |

客户端不得提交成绩、通过状态、有效期、申请状态、审批结果、进出厂时间或操作人字段。请求 DTO 使用明确的允许字段；未知字段返回 `400 INVALID_REQUEST`，避免旧演示字段被静默接受。

以下 TypeScript 是传输结构描述，不是本轮新增的前端实现：

```typescript
type Id = string
type DateOnlyString = string
type InstantString = string
type ApplicationStatus =
  | 'pendingApproval' | 'approved' | 'checkedIn' | 'checkedOut'
  | 'rejected' | 'cancelled' | 'expired'
type ApprovalKind = 'business' | 'area'
type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
type QuestionType = 'singleChoice' | 'multipleChoice'

interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
}

interface FileDto {
  reference: string
  fileName: string
  contentType: string
  sizeBytes: number | null
  url: string
  urlExpiresAt: InstantString
}
```

文件的 `reference` 是稳定引用，`url` 是当前可用的临时访问地址。历史快照保留引用，不能保存临时地址作为资料来源。客户端只能提交附件上传接口返回的引用，不能提交任意文件 URL。

分页统一从 `page=1` 开始，默认 `pageSize=20`，允许 1–100；越界参数返回 400，空结果返回 200 和空集合。列表稳定排序：申请按 `createdAt DESC, id DESC`，配置按 `sortOrder ASC, code ASC`，人员按保存顺序，课程按快照顺序，考试按 `attemptNumber ASC`。

### 2.2 幂等、并发与事务

- 申请提交以“当前浏览器归属＋clientRequestId”为幂等键。相同键与相同规范化内容返回同一申请，不重复创建人员、车辆、审批任务或培训记录；同键不同内容返回 `409 CLIENT_REQUEST_CONFLICT`。
- 草稿第一次提交后，即使响应丢失也继续使用原 clientRequestId。已确认创建的相同请求重试先返回原申请，不因之后的日期或配置变化再次拒绝；访问范围仍必须先校验。
- 申请、明细、审批任务、课程快照及首轮培训记录原子保存。失败时不返回成功，不留下可见的半张申请。
- 视频完成采用集合追加，重复完成不增加进度，不清空其他视频。
- 创建考试通过第 9 节的 expectedPreviousAttemptId 防止重复首考或重考；交卷对同一考试只结算一次。
- 考试答案修改、首次交卷、申请取消及后台状态操作使用强 `ETag`／`If-Match`。ETag 是当前资源的不透明版本，不要求增加业务版本实体；沿用框架或数据库的并发机制。
- 读取考试或申请详情返回 `ETag` 响应头。修改携带对应的 `If-Match: "资源版本"`；缺失返回 428，版本已变化返回 412。修改响应返回新 ETag。考试的 ETag 属于 ExamAttempt；取消的 ETag 属于 VisitApplication。
- 已交卷考试再次交卷、已取消申请再次取消，以及后台已成功的相同操作，在确认访问范围后返回原结果，不因原 If-Match 已旧而改写或重复执行。其他状态冲突仍按业务规则拒绝。
- 超时或网络中断只表示客户端不知道结果。客户端读取服务端状态或重试原幂等请求，不自行生成新的申请、考试或通过记录。

## 3. 无登录访问与数据归属

### 3.1 浏览器上下文

`POST /api/v1/client-context`，无请求体，成功返回 200：

```json
{
  "csrfToken": "opaque-csrf-token",
  "businessTimeZone": "Asia/Shanghai",
  "today": "2026-10-13"
}
```

此接口自动建立或恢复浏览器上下文，不展示登录页面。服务端生成至少 256 位随机浏览器密钥，通过 `vs_web_client` Cookie 保存；生产环境设置 `HttpOnly; Secure; SameSite=Lax; Path=/api/v1`，有效期 365 天。已有有效 Cookie 时不轮换归属密钥，重新返回可用 CSRF token。

服务端只保存浏览器密钥的哈希作为申请归属。客户端不在 JSON 中传 submitterId、归属密钥或后台用户 Id；Cookie 由浏览器自动发送。匿名上下文仅代表这个浏览器，不能当作人员实名身份。

通过 Cookie 取得访问范围的业务 POST、PUT、DELETE 请求附带 `X-CSRF-Token`；上下文创建本身不要求已有 token，但需校验可信来源。以 X-Learning-Token 取得个人范围的接口不依赖 Cookie 权限或 CSRF token；仍校验该学习凭证。两类接口均执行服务端范围检查，不以“知道资源 Id”为访问依据。

“我的记录”只返回当前浏览器提交的申请。换手机、无痕模式、清除 Cookie 或 Cookie 到期后，原记录仍在后端，但不会自动归属于新浏览器；通过姓名＋手机号仍可查找本人待学课程，不因此取得整单详情或取消权限。

### 3.2 个人学习凭证

跨浏览器学习由第 8 节的姓名＋手机号查询返回 `learningToken`。每个凭证仅允许访问一张申请中的一个 Participant 的培训记录、考试和培训凭证，有效期 2 小时；使用 `X-Learning-Token` 请求头发送。

- 凭证不是用户登录结果，不表示已经验证人员身份；知道正确姓名和手机号的人可以获得对应的学习访问范围，这是现有无登录查询方式的明确边界。
- 查询必须同时精确匹配去除首尾空格后的姓名和手机号。不允许仅手机号、模糊姓名或小程序提交者替代匹配。
- 个人学习凭证不能读取整单人员、身份证、附件、车辆、动态业务信息，不能取消申请，也不能执行审批或进出厂操作。
- 同一浏览器拥有整单时可轮流学习全部人员；请求携带 learningToken 时必须按该凭证的个人范围处理，不与浏览器整单权限合并。客户端进入个人查询结果后清除“全部人员”选项。
- 凭证可保存在 `sessionStorage` 以支持同标签页刷新。到期后重新查询；考试截止时间、已存答案和进度保持不变。凭证不放在页面 URL、普通日志或 localStorage 中。
- 查询无结果统一返回 200 和空集合。接口设置 IP 与浏览器两个独立的查询频率限制，任一来源每 10 分钟最多 30 次，超出返回 429 和 `Retry-After`；不提供全部人员的公开列表。

移动端凭证失效返回 `403 ACCESS_CONTEXT_EXPIRED`，提示恢复浏览器上下文或重新查询，不跳转登录。资源不在范围内统一返回 404，避免通过逐个 Id 枚举其他人员。

### 3.3 对后端实体的必要适配

现有后端 SPEC 将 VisitApplication.SubmitterId 必填并关联 MiniProgramUser；独立无登录 React 网页没有真实 AppId、OpenId，不能伪造小程序提交者。接入时需要如下最小调整：

| 项目 | 网页接入约定 |
| --- | --- |
| SubmitterId | 改为 `string?`；小程序来源仍关联真实 MiniProgramUser，网页来源为空 |
| WebClientKeyHash | VisitApplication 增加 `string?`，由服务端根据匿名 Cookie 写入；不向前端返回 |
| 来源约束 | SubmitterId、WebClientKeyHash 恰好一个有值，两个来源不能混填 |
| 唯一约束 | 网页使用 `WebClientKeyHash + ClientRequestId`；小程序继续使用 `SubmitterId + ClientRequestId`，分别对有效来源建立唯一约束 |

无需新增人员账号、跨申请人员档案或匿名业务用户实体。浏览器上下文、CSRF token 和学习凭证属于接口基础设施，不改变姓名＋手机号的历史免训规则。本节是后端模型的接入调整要求，不是当前实体 SPEC 已实现的能力。

### 3.4 部署边界

第一版推荐网页与 API 同源：网页 `/`，API `/api/v1` 由反向代理转发至 Minimal API。开发环境可由 Vite 代理同一路径。若部署为不同源，显式配置可信 Origin、允许凭据及暴露 `ETag`、`X-Server-Time`、`Retry-After`，前端使用 `credentials: 'include'`，不得用通配来源配合 Cookie。实际跨站部署还需将 Cookie 调整为 `SameSite=None; Secure`，并确认目标浏览器允许该 Cookie；同源为本版首选接入方式。

当前 `docker/nginx.conf` 仅提供静态页面和 SPA 回退。接入时必须增加 API 转发，API 的 404/500 保留 JSON 错误，不能被回退为 `index.html`。本文不修改代理或 Docker 配置。

## 4. 错误响应

错误结构采用 [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html)。`code`、`traceId` 和 `errors` 是本项目扩展成员；前端按 code 与字段路径处理，不解析中文 detail 判断逻辑。

```json
{
  "type": "urn:visitsafe:problem:validation-failed",
  "title": "登记信息校验失败",
  "status": 400,
  "detail": "请检查人员名单",
  "instance": "/api/v1/applications",
  "code": "VALIDATION_FAILED",
  "traceId": "request-trace-id",
  "errors": {
    "/participants/0/phone": ["请输入有效的11位手机号"],
    "/areaIds": ["请至少选择一个访问区域"]
  }
}
```

errors 使用 JSON Pointer 路径；动态字段例如 `/dynamicValues/hostUserId`。非字段错误可省略 errors。生产响应不返回堆栈、SQL、浏览器密钥或完整敏感请求体。

| HTTP | code | 含义及客户端动作 |
| --- | --- | --- |
| 400 | INVALID_REQUEST / VALIDATION_FAILED | 格式、未知字段、必填、日期、手机号、车牌或答案集合错误；保留输入，定位字段 |
| 403 | ACCESS_CONTEXT_EXPIRED / CSRF_INVALID | 上下文或个人学习凭证失效，或 CSRF 校验失败；恢复上下文后重试原操作 |
| 404 | RESOURCE_NOT_FOUND | 资源不存在或不在访问范围内；显示不可访问提示 |
| 409 | CONFIGURATION_CHANGED / NOTICE_CHANGED | 展示后配置或须知已变化；重新取配置并确认，保留草稿 |
| 409 | VISIT_TYPE_DISABLED / AREA_UNAVAILABLE / TRAINING_CONFIGURATION_MISSING | 类型停用、区域不可选或当前类型＋区域缺少有效课程；不能提交 |
| 409 | APPROVER_UNAVAILABLE / ATTACHMENT_UNAVAILABLE | 审批人员已不可用，或附件失效、不属于当前浏览器；重新选择或上传 |
| 409 | CLIENT_REQUEST_CONFLICT | 原幂等键已提交其他内容；读取原申请，确需新申请时新建草稿 |
| 409 | APPLICATION_ENDED / APPLICATION_STATE_CONFLICT | 申请已结束或不允许取消等操作；刷新状态 |
| 409 | TRAINING_RECORD_NOT_CURRENT | 请求指向旧轮次；响应扩展 currentTrainingRecordId，重新打开当前任务 |
| 409 | TRAINING_ALREADY_VALID / TRAINING_NOT_STARTED / VIDEOS_INCOMPLETE | 已有效合格无需再考、未开始播放，或视频未完成；刷新任务 |
| 409 | EXAM_NOT_READY / EXAM_ALREADY_SUBMITTED / EXAM_DEADLINE_REACHED / EXAM_ANSWERS_INCOMPLETE | 不可创建考试、不可再改答案、已到期或主动交卷未答完；读取考试与结果 |
| 412 | VERSION_CONFLICT | If-Match 已旧；先读取服务端版本，不能自动覆盖其他标签页的答案 |
| 413 / 415 | FILE_TOO_LARGE / FILE_TYPE_NOT_ALLOWED | 文件大小或格式不允许；重新选择 |
| 428 | PRECONDITION_REQUIRED | 需要 If-Match 的请求缺少版本 |
| 429 | RATE_LIMITED | 达到限制；按 Retry-After 等待 |
| 500 / 503 | INTERNAL_ERROR / SERVICE_UNAVAILABLE | 未确认操作成功；保留输入并按幂等规则恢复，避免重复新建 |

后台操作额外使用框架标准的 401 未登录、403 权限不足；这两个后台状态不要求 React 网页增加登录流程。各业务接口只使用适用的错误，不以 200 包装失败。

## 5. 接口清单

访问范围：P＝公开配置；B＝当前匿名浏览器；O＝当前浏览器拥有的申请；L＝O 或个人学习凭证；A＝后台用户及对应权限。P 只公开填写所需的数据，不能返回后台题库答案、用户账号资料或全站申请。

| 方法 | 路径（省略 `/api/v1`） | 用途 | 范围 |
| --- | --- | --- | --- |
| POST | `/client-context` | 建立／恢复匿名浏览器上下文 | B |
| GET | `/bootstrap` | 首页类型与业务时区 | P |
| GET | `/visit-types/{visitTypeId}/registration-config` | 须知、动态字段、人员规则、时段及区域 | P |
| GET | `/visit-types/{visitTypeId}/user-options` | 某动态用户字段的可选审批人员 | B |
| POST | `/training-course-preview` | 当前类型＋所选区域的必修课程预览 | B |
| POST | `/participant-attachments` | 上传登记人员附件 | B |
| DELETE | `/participant-attachments/{reference}` | 清理本人尚未绑定申请的临时附件 | B |
| POST | `/applications` | 幂等提交申请并生成审批与培训任务 | B |
| GET | `/applications` | 我的记录、搜索及统计 | B |
| GET | `/applications/{applicationId}` | 整单详情及审批汇总 | O |
| POST | `/applications/{applicationId}/cancel` | 进厂前取消并保留历史 | O |
| POST | `/applications/{applicationId}/training-tasks/query` | 刷新当前轮次并获取整单或个人任务 | L |
| POST | `/learning-task-search` | 姓名＋手机号精确查询本人待学任务 | B |
| GET | `/training-records/{trainingRecordId}` | 本轮学习内容与个人进度 | L |
| POST | `/training-records/{trainingRecordId}/start` | 首次实际播放时记录 StartedAt | L |
| PUT | `/training-records/{trainingRecordId}/videos/{videoId}/completion` | 幂等上报视频完成 | L |
| POST | `/training-records/{trainingRecordId}/exam-attempts` | 首考／重考或恢复相同创建请求 | L |
| GET | `/exam-attempts/{examAttemptId}` | 恢复考试、答案、截止时间及版本 | L |
| PUT | `/exam-attempts/{examAttemptId}/answers/{questionId}` | 保存一个题目的最终答案集合 | L |
| POST | `/exam-attempts/{examAttemptId}/submit` | 幂等交卷并由服务端评分 | L |
| GET | `/exam-attempts/{examAttemptId}/result` | 已交卷结果与错题解析 | L |
| GET | `/training-records/{trainingRecordId}/exam-attempts` | 本轮历次考试摘要 | L |
| GET | `/training-records/{trainingRecordId}/completion` | 个人实际通过或历史免训凭证 | L |

后台审批与进出厂操作见第 12 节，均不开放给匿名浏览器或个人学习凭证。

## 6. 首页、表单配置、预览与附件

### 6.1 首页配置

`GET /bootstrap` 返回 200：

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
  businessTimeZone: string
  today: DateOnlyString
  visitTypes: VisitTypeDto[]
}
```

只返回启用且基础配置完整的登记类型，顺序由后台决定。继续学习入口独立显示；visitTypes 为空时不隐藏学习入口。未知 color、icon 使用默认样式，不阻止新类型登记。Code 只用于展示或初始数据迁移，不作为前端表单分支或 API 关联键。

### 6.2 登记配置

`GET /visit-types/{visitTypeId}/registration-config` 返回 200：

```typescript
interface OptionDto { value: string; label: string }
type FieldValue = string | number | boolean | string[] | null
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
}
interface RegistrationConfigDto {
  version: string
  visitType: VisitTypeDto
  applicationTemplateId: Id
  fields: FieldDto[]
  notice: { id: Id; version: string; title: string; content: string }
  timeSlots: OptionDto[]
  areas: AreaOptionDto[]
  participantRules: {
    companyRequired: boolean
    tradeRequired: boolean
    companyFromFieldKey: string | null
    phoneUnique: boolean
  }
}
```

- fields 是已有动态模块面向 React 的投影，不是另一套字段定义或存储模型。select、multiSelect 的选项来自各自 metadata；timeSlots 来自已有 PicklistSet。
- FieldValue 与 control 对应：文本、日期、单选和用户选择传 string，多选传 string[]，数字传 number，checkbox 传 boolean。必填值不能为 null、空白或空数组；选项必须属于配置。数字的取值范围等已有 metadata 规则由服务端继续校验；不支持的控件不能静默渲染成可提交文本框，返回配置不可用。
- valueFromUserFieldKey 非空时，是由某用户选择字段同步显示姓名的只读字段。例如 hostName 来自 hostUserId、supervisor 来自 supervisorUserId。客户端可显示，提交时由服务端解析并保存显示快照。
- participantRules 是已有业务规则及关联模板 metadata 的 API 投影，不新增人员配置表。普通访客单位必填、手机号唯一；施工工种必填、单位继承 contractorCompany、手机号唯一。物流使用独立人员名单，不从车辆产生人员；新增类型的人员要求通过模板 metadata 明确配置。
- 各类型都至少登记一位人员。同一申请中姓名＋手机号组合不得重复；phoneUnique 为真时额外禁止重复手机号。
- areas 返回启用区域。当前类型下缺少有效课程或区域审批负责人时 selectable 为假并提供原因，不能以其他类型课程补齐。
- version 是本次可提交配置的不透明指纹，覆盖类型、模板、人员／车辆要求、须知、时段、区域可用性、审批来源和培训组合及预览内容；无需增加课程版本实体。相关配置改变则重新取配置，不能静默切换须知或表单。
- Notice 的 3 秒倒计时与勾选继续保留为前端交互；接口确认的是用户提交的同意事实，不把客户端倒计时当作已阅读的可信证明。

初始物流页面已有 logisticsReasons、cargoType、logisticsOrderNumber 等业务字段，若接入后继续使用，必须配置在物流动态模板中，由 fields 与 metadata 下发。logisticsContact 的自由姓名不能代替 logisticsContactUserId；服务端保存相应显示含义。

### 6.3 动态用户选择

`GET /visit-types/{visitTypeId}/user-options?fieldKey=hostUserId&q=王&page=1&pageSize=20`，返回 `Page<{ id: string; displayName: string }>`。

fieldKey 必须是当前启用类型模板中的 user 控件；只能搜索可用且有该审批资格的后台人员。q 去首尾空格，最少 1 个、最多 50 个字符；不提供不带条件的后台全员列表，不返回账号、角色、手机号等资料。请求每个 IP 每分钟最多 60 次，超出返回 429。选中用户仍在提交时重新校验。

### 6.4 必修课程预览

`POST /training-course-preview`：

```json
{
  "visitTypeId": "type-visitor",
  "configurationVersion": "config-v1",
  "areaIds": ["area-production", "area-office"]
}
```

返回 200：

```typescript
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
interface CoursePreviewResponse {
  configurationVersion: string
  courses: CoursePreviewDto[]
  courseCountPerParticipant: number
}
```

按同一 visitTypeId 与每个 areaId 匹配有效启用课程，合并后按 TrainingCourseId 去重。任一区域没有配置即失败，不能返回部分课程作为可提交结果。预览不创建申请、培训记录或考试，也不返回题目答案；个人免训在实际提交时根据服务端历史记录判断。

### 6.5 人员附件

`POST /participant-attachments`，一个 multipart 字段 `file`。第一版允许 JPEG、PNG、PDF，单文件上限 10 MiB，服务端同时检查类型、文件内容与大小，不信任原文件名路径。

成功返回 201：

```json
{
  "reference": "upload-reference",
  "fileName": "人员资料.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 204800,
  "expiresAt": "2026-10-14T02:00:00Z"
}
```

复用框架文件存储，上传元数据不作为新的人员附件业务实体。临时引用只属于当前浏览器，未绑定时保留 24 小时；提交申请时绑定到对应 Participant，并保存稳定文件引用及文件名。每位人员最多一份，同一临时引用不能绑定不同人员。绑定后按历史资料保留，不按临时期限清理。

`DELETE /participant-attachments/{reference}` 只允许清理当前浏览器的未绑定附件，成功返回 204，重复删除仍为 204；已绑定返回 409，不能通过此接口删除历史资料。草稿恢复时若临时文件已失效，应重新上传，不清空其他输入。

身份证号码可选，按文本保存，不能转换为 number。上传附件可选，未上传时引用和文件名均为空；不要求附件必须是身份证图片。

## 7. 申请提交、我的记录与取消

### 7.1 提交 DTO

`POST /applications`：

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
  vehicles: Array<{ plate: string; transportCompany?: string | null }>
  areaIds: Id[]
}
```

普通访客示例：

```json
{
  "clientRequestId": "draft-request-id",
  "visitTypeId": "type-visitor",
  "configurationVersion": "config-v1",
  "appointmentDate": "2026-10-14",
  "timeSlot": "08:30–12:00",
  "noticeId": "notice-visitor",
  "noticeVersion": "notice-v1",
  "noticeAccepted": true,
  "dynamicValues": {
    "hostUserId": "backend-user-1",
    "visitReason": "洽谈"
  },
  "participants": [
    { "name": "张三", "phone": "13800138000", "company": "示例公司" },
    { "name": "李四", "phone": "13900139000", "company": "示例公司" }
  ],
  "vehicles": [{ "plate": "沪A12345", "transportCompany": null }],
  "areaIds": ["area-production"]
}
```

数组顺序作为人员和车辆的保存顺序；明细 Id 由服务端生成，不接收旧本地 Person.id、司机 Id 或本地申请 Id。clientRequestId 使用持久化草稿中的稳定随机标识，不能每次点击提交重新生成。

服务端提交检查：

1. 恢复浏览器归属并处理相同幂等请求；新请求继续以下校验。
2. 类型启用、配置完整且版本匹配；noticeId 属于同一类型，noticeVersion 是当前须知且 noticeAccepted 为 true。
3. appointmentDate 是真实日历日期且不早于工厂业务时区的今天，timeSlot 属于 PicklistSet。TimeSlot 不增加小时级进厂限制。
4. dynamicValues 按当前模板校验，拒绝不存在的字段；只读派生字段由服务端生成，不接受客户端覆盖。解析有效的业务审批用户，并保存用户显示快照。
5. 人员至少一位，姓名去首尾空格后非空，手机号去首尾空格后符合 `^1[3-9]\d{9}$`；遵守 participantRules。施工 Company 从 contractorCompany 取值，不能提交与之不同的人员单位。
6. 所有已录入车辆必须有合法且规范化后唯一的车牌；VehicleRequired 为真至少一辆，TransportCompanyRequired 为真时每辆车运输单位必填。不接受 driver、phone、vehicleType、participantId 等车辆字段。
7. areaIds 至少一个且不重复，区域启用；每个类型＋区域组合都存在有效课程及有效区域审批负责人。
8. 附件引用可用、属于当前浏览器且尚未绑定其他人员。
9. 在同一事务中保存申请、快照、明细、`1 + 区域数` 条审批任务，以及每人每门必修课程的一条首轮培训记录。

成功首次返回 201 和 `Location: /api/v1/applications/{id}`，幂等重试返回 200；响应体均为 ApplicationDetailDto。初始 status 为 pendingApproval。NoticeContentSnapshot 取服务端当前对应正文；NoticeAcceptedAt 为服务端收到本次有效同意提交的时刻，不接受客户端伪造时间。

### 7.2 申请与汇总 DTO

```typescript
interface TrainingSummaryDto {
  participantCount: number
  qualifiedParticipantCount: number
  requiredRecordCount: number
  validRecordCount: number
  allQualified: boolean
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
  id: Id
  name: string
  phone: string
  company: string | null
  trade: string | null
  idCardNumber: string | null
  attachment: FileDto | null
  checkedInAt: InstantString | null
  checkedOutAt: InstantString | null
  sortOrder: number
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
  clientRequestId: string
  reviewedAt: InstantString | null
  checkedInAt: InstantString | null
  checkedOutAt: InstantString | null
  notice: { id: Id; contentSnapshot: string; acceptedAt: InstantString }
  businessFields: Array<{ key: string; label: string; value: FieldValue; displayValue: string }>
  participants: ParticipantDto[]
  vehicles: Array<{ id: Id; plate: string; transportCompany: string | null; sortOrder: number }>
  areas: Array<{ id: Id; name: string }>
  approvalTasks: ApprovalTaskSummaryDto[]
}
```

visitTypeName、areaNames、businessFields 和须知正文使用提交时快照。姓名、手机号、身份证、附件等完整登记资料只在浏览器拥有的申请详情中返回，不向个人学习查询返回。后台操作人 Id 保存在服务端审计记录中，不必暴露给移动端。

TrainingSummaryDto 只汇总每人每门必修课程的当前轮次，在同一服务端时刻计算有效合格数量；没有人员或必修课程不能得到 allQualified=true。课程完成与申请 status 分开显示，不能继续把“培训全部通过”当作申请已批准、已进厂或已结束。

### 7.3 我的记录

`GET /applications?q=张三&page=1&pageSize=20&status=pendingApproval`，返回 200：

```typescript
interface MyApplicationsResponse {
  records: Page<ApplicationSummaryDto>
  totals: {
    applicationCount: number
    participantCount: number
    validRecordCount: number
  }
}
```

仅当前浏览器的数据。q 为可选关键词，去首尾空格后最多 100 字符，在当前范围内搜索提交时类型名、人员姓名／手机号／单位、业务字段显示值、车牌及运输单位；status 为可选合法 ApplicationStatus。records.totalCount 按筛选条件计算，totals 始终统计当前浏览器的全部申请，不能只统计当前分页。

`GET /applications/{applicationId}` 返回 ApplicationDetailDto 和申请 ETag。个人 learningToken 不能调用此整单接口。

### 7.4 取消与删除的接入差异

`POST /applications/{applicationId}/cancel`，无请求体，需要申请 If-Match。

只有当前浏览器拥有且 status 为 pendingApproval 或 approved、无人进厂的申请可取消；事务内改为 cancelled、取消仍 pending 的审批任务，保留已完成审批、人员资料、培训及考试历史，后续不再允许学习或考试。成功返回 200、最新 ApplicationDetailDto 与 ETag；重复取消返回原取消结果。

本版不开放移动端 `DELETE /applications/{id}`。现有“删除申请”是本地演示操作；真实接入改为条件允许时“取消申请”。已结束或已进厂申请只读，后台删除权限与保留政策仍按后端 SPEC 另行确定，不能把前端删除同时清除培训来源、考试和审计数据的逻辑直接搬到后端。

## 8. 任务查询、当前轮次与视频

### 8.1 任务 DTO

```typescript
type TrainingState =
  | 'notStarted' | 'learning' | 'readyForExam' | 'examInProgress'
  | 'retakeRequired' | 'passed' | 'reused' | 'expired'
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
  visitApplicationId: Id
  participantId: Id
  trainingCourseId: Id
  roundNumber: number
  isCurrentRound: boolean
  state: TrainingState
  startedAt: InstantString | null
  completedVideoIds: Id[]
  completedAt: InstantString | null
  validUntil: InstantString | null
  isValid: boolean
  reusedFromTrainingRecordId: Id | null
  course: CoursePreviewDto
  activeExamAttempt: ExamAttemptSummaryDto | null
  latestSubmittedExamAttempt: ExamAttemptSummaryDto | null
  canLearn: boolean
  canStartExam: boolean
  canRetake: boolean
}
interface TaskPageDto {
  application: { id: Id; visitTypeName: string; appointmentDate: DateOnlyString; status: ApplicationStatus }
  accessScope: 'application' | 'participant'
  participants: Array<{ id: Id; name: string; maskedPhone: string; sortOrder: number }>
  training: TrainingSummaryDto
  records: TrainingRecordDto[]
}
```

state 是响应投影，不新增数据库培训状态字段。有效复用为 reused，有效实际通过为 passed；其他状态从视频、考试和当前时间推导。canLearn、canStartExam、canRetake 同时检查申请是否未结束及是否当前轮次；页面状态展示不替代操作时的服务端校验。

### 8.2 整单／个人任务

`POST /applications/{applicationId}/training-tasks/query`：

```json
{ "participantId": null }
```

返回 200 TaskPageDto。浏览器拥有整单时，participantId=null 表示全部人员，也可传该单某人 Id。使用 learningToken 时，null 表示凭证对应人员，其他人员 Id 被拒绝，响应只有该人员；training 也只统计响应范围，不能泄露整单其他人员的数量或姓名。

此接口使用 POST，因为查询需按业务规则刷新过期课程：未结束申请且人员尚未进厂，当前记录已过期时，保留旧轮次并按同一课程快照创建新轮次；可先复用本人另一有效实际通过结果，否则从空视频进度完整重学。并发或重复查询只能生成一个新轮次，已有未合格当前轮次不再增加轮次。

records 默认只返回每人每门课程 RoundNumber 最大的记录。结束申请不生成新轮次、不继续学习；已进厂人员的过期记录不会自动新增轮次或改变在厂状态，仍可显示 expired。旧轮次可通过已有 Id 查询学习历史和凭证，但不能继续写入。

### 8.3 姓名＋手机号继续学习

`POST /learning-task-search`：

```json
{ "name": "张三", "phone": "13800138000", "page": 1, "pageSize": 20 }
```

成功返回 `Page<LearningMatchDto>`：

```typescript
interface LearningMatchDto {
  application: { id: Id; visitTypeName: string; appointmentDate: DateOnlyString; status: ApplicationStatus }
  participant: { id: Id; name: string; maskedPhone: string }
  pendingRecords: TrainingRecordDto[]
  learningToken: string
  learningTokenExpiresAt: InstantString
}
```

先在未结束申请中精确匹配人员，刷新适用的过期轮次，然后按“申请＋匹配人员”分页，只返回本人当前没有有效合格结果的课程。有效实际通过、有效免训、其他人员和结束申请不返回；pendingApproval 可返回，预约日已过本身不停止学习。

查询不创建申请，不重新分配当前类型／区域的课程；只为过期记录按既有快照增加必要新轮次。不把姓名或手机号写入 GET 查询 URL。命中多张申请分别返回，不将相同课程的任务跨申请合并。

### 8.4 学习内容与播放操作

`GET /training-records/{trainingRecordId}` 返回 200：

```typescript
interface LearningContentDto {
  record: TrainingRecordDto
  participant: { id: Id; name: string; maskedPhone: string }
  videos: Array<{ id: Id; title: string; description: string | null; durationSeconds: number; file: FileDto }>
  pdf: FileDto | null
}
```

内容来自该记录的 CourseSnapshotJson。此 DTO 没有题目标准答案或解析，也不返回原始 CourseSnapshotJson。PDF 查看／下载不计为视频完成。

`POST /training-records/{id}/start` 无请求体，在播放器首次实际开始播放时调用。只写一次 StartedAt，成功返回 200 TrainingRecordDto；刷新、重复播放或失败重考不重置。仅打开页面不调用。旧轮次、有效免训／已通过或结束申请不能通过此操作制造学习开始时间。

`PUT /training-records/{id}/videos/{videoId}/completion` 无请求体，成功返回 200 TrainingRecordDto。服务端校验访问范围、未结束申请、当前轮次、需要实际学习、StartedAt 已记录及视频属于本轮快照，然后去重追加 CompletedVideoIds；未开始返回 `409 TRAINING_NOT_STARTED`，重复完成返回已有进度。

第一版由前端正常播放结束事件触发完成上报。播放器继续限制跳播，服务端保存与校验任务进度；这个接口不证明人员确实完整观看，也不包含防代学能力。演示计时不能在真实 API 模式调用完成接口；视频加载失败提供重试，人工处理策略另行定义。

视频和 PDF 返回限定单文件的短时签名地址，默认有效 60 分钟，支持视频 Range 请求。页面可通过重新读取学习内容刷新地址，稳定文件引用、视频完成进度和考试计时不变。签名地址可包含单文件签名参数；浏览器归属密钥与 learningToken 仍不能放入媒体 URL。

## 9. 考试创建、答案保存与服务端交卷

### 9.1 考试 DTO 与题目范围

```typescript
interface ExamQuestionDto {
  id: Id
  type: QuestionType
  title: string
  options: string[]
  points: number
}
interface ExamAttemptDto extends ExamAttemptSummaryDto {
  trainingRecordId: Id
  questions: ExamQuestionDto[]
  answers: Record<Id, number[]>
  passingScore: number
  canAnswer: boolean
  canSubmit: boolean
}
```

题目采用课程快照；第一版五题、四个选项，题目可混合单选和多选，每题 20 分。passingScore 与 examDurationMinutes 由快照确定，不能把前端 80 分、15 分钟常量当接口规则。未交卷响应不含 correctIndexes、explanation、WrongQuestionIds 或客户端实时判对错数据。

### 9.2 创建或恢复首考／重考

`POST /training-records/{trainingRecordId}/exam-attempts`：

```json
{ "expectedPreviousAttemptId": null }
```

首次考试传 null；失败重考传最近一次已交卷失败考试的 Id。首次创建返回 201、Location、ExamAttemptDto 与 ETag；重复相同创建请求返回 200 和原创建的那次考试。

幂等规则不需要新增考试请求业务实体：null 对应 attemptNumber=1；指定前次 Id 对应其 attemptNumber+1。同一个前次考试只能有一个下一次。即使响应丢失后重试时那次考试已经交卷，也返回同一次，不意外再建下一次考试。

创建新考试需申请未结束、本记录为当前轮次且未有效合格、快照全部视频完成。前次考试必须属于同一记录、已经交卷且 passed=false；本记录同时最多一条未交卷考试。存在该请求对应考试时优先恢复，存在其他进行中考试或前次条件不匹配时返回 EXAM_NOT_READY。

StartedAt 取服务端创建时刻，DeadlineAt=StartedAt＋快照考试时长。重考新建 ExamAttempt，answers 为空，保留旧考试与本轮视频进度。过期重训必须通过新 TrainingRecord 重新完成视频，不能用旧记录重考延长有效期。

### 9.3 恢复与保存答案

`GET /exam-attempts/{examAttemptId}` 返回 ExamAttemptDto 和 ETag。离开、重载、换手机或切换标签页均读取相同 StartedAt、DeadlineAt 与服务端已保存答案。

`PUT /exam-attempts/{examAttemptId}/answers/{questionId}`，携带 If-Match：

```json
{ "selectedIndexes": [0, 2] }
```

成功返回 200 最新 ExamAttemptDto 与 ETag。只更新当前题目，不能用本地旧答卷整体覆盖其他题目的进度。

- questionId 必须属于该考试的本轮快照，所有选项下标必须是 0–3 的整数；重复下标去重后按升序保存。
- 单选题非空时恰好一项，多选题可选一项或多项；空集合用于清除答案，等同未作答，字典中删除该题。
- 到达服务端 DeadlineAt 时不能继续修改；此时先结算已保存答案，再返回 EXAM_DEADLINE_REACHED。超过截止时间的新答案不参与评分。
- 同一考试多标签页写冲突返回 412，前端读取最新版本并展示已保存答案，由用户决定是否重新修改，不能自动用旧选项重试覆盖。
- 保存失败保留当前选项并显示“尚未保存”，不能假装服务器已接受。正常交卷前等待所有答案保存完成；答案写入按版本顺序执行，不并行发送相同旧 ETag。

### 9.4 交卷与超时

`POST /exam-attempts/{examAttemptId}/submit`，无请求体，首次交卷携带考试 If-Match，成功返回 200 ExamResultDto 与新 ETag。不接受 score、passed、timedOut、submittedAt 或客户端标准答案。

- 当前时刻早于 DeadlineAt：主动交卷必须五题均有非空答案，缺题返回 EXAM_ANSWERS_INCOMPLETE，保持进行中。
- 当前时刻达到或晚于 DeadlineAt：按截止前已保存的最终答案评分，未答题零分，timedOut=true，允许未答完。
- 标准答案及评分仅在服务端。单选比较单元素集合，多选必须集合完全一致，少选、多选、错选均零分；passed=score>=快照 passingScore。
- 服务端记录 SubmittedAt；passed=true 时，在同一事务中写 TrainingRecord.CompletedAt，并读取来源 TrainingCourse 当前生效的 TrainingValidityDays 计算 ValidUntil。课程有效期不从旧快照或客户端取得。
- 有效区间为 `CompletedAt <= 服务端当前时刻 < ValidUntil`。已经写入的通过时间与截止时间不能因重载、复用、重复交卷或课程配置修改改变。
- 交卷事务与答案写入串行化。答案先成功提交则按该答案结算；交卷先完成则之后答案拒绝，不能出现改完分数后又接受答案的状态。
- 服务端负责未结束申请的超时结算，不依赖前端倒计时或页面仍然打开。可采用后台到期处理，并在读取考试、结果、任务及答题／交卷时兜底；申请仍未结束时，已到期的未交卷考试在返回前按保存答案结算。所有路径结算同一结果，SubmittedAt 记录首次实际服务端结算时刻，不伪造为浏览器计时结束时刻。
- 读取时的到期结算属于已开始考试的既定到期处理，重试读取不延长 DeadlineAt。申请结束与交卷必须串行化：结束前已到期的考试先按规则结算；结束时尚未到期的未交卷考试保留原时间及答案，只读且 canAnswer、canSubmit 为 false，不在申请结束后继续结算成新的通过结果。

培训有效期取实际结算时生效的课程天数，而考试题目、解析、及格分与时长仍取本轮快照。API 不能将有效免训记录当作新考试，也不能让已结束申请继续取得新的通过结果。

## 10. 考试结果、历史与培训凭证

### 10.1 结果与错题

`GET /exam-attempts/{examAttemptId}/result`，已交卷返回 200 ExamResultDto；未结束申请的考试到期时先结算，未交卷且未到期返回 `409 EXAM_NOT_READY`。结束申请中保留的未交卷考试返回 `409 APPLICATION_ENDED`，已有交卷结果仍可查看。

```typescript
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
  canRetake: boolean
}
```

wrongQuestions 使用对应快照，只在已交卷结果中提供标准答案和解析，包括未答题。失败考试 completedAt、validUntil 均为 null；历史通过考试返回其取得的原有效期，不能用后来轮次或其他考试的时间替换。canRetake 同时检查当前轮次、申请未结束、考试失败且无进行中考试。

`GET /training-records/{id}/exam-attempts` 返回按 attemptNumber 升序的 ExamAttemptSummaryDto[]；有效复用记录返回空集合，不伪造本次考试。

### 10.2 培训凭证

`GET /training-records/{trainingRecordId}/completion`，本记录有真实通过或有效历史来源时返回 200：

```typescript
interface CompletionDto {
  trainingRecordId: Id
  participant: { id: Id; name: string; maskedPhone: string }
  course: { id: Id; title: string }
  mode: 'actualPass' | 'historicalReuse'
  sourceTrainingRecordId: Id
  sourceExamAttemptId: Id
  score: number
  completedAt: InstantString
  validUntil: InstantString
  isValid: boolean
}
```

actualPass 的 sourceTrainingRecordId 为本记录，historicalReuse 指向原实际通过记录，sourceExamAttemptId 与 score 始终来自真实通过考试。过期或申请结束的历史凭证仍可查看，isValid 由当前服务端时刻计算；未通过且无有效来源记录返回 EXAM_NOT_READY。

凭证是展示 DTO，不新增证书实体、证书编号或固定证书文件，不意味着申请审批已通过或可以直接进厂。

## 11. 历史免训、过期与结束状态的接口约束

以下约束适用于所有登记类型，服务端统一执行：

1. 先按新申请类型＋所选区域取必修课程，再按规范化姓名＋手机号、同一 TrainingCourseId 查找已交卷实际通过结果。不得只按同名、手机号、浏览器 Cookie、身份证、司机或车辆匹配。
2. 来源必须为非复用记录且当前有效，ValidUntil 还须晚于预约日在 Asia/Shanghai 的 00:00。多条候选按 CompletedAt 最新优先，相同时按 Id 升序，保证结果稳定。
3. 每人每门课程分别判断；命中仍创建新申请自己的首轮 TrainingRecord，引用原实际通过来源，保留原 CompletedAt、ValidUntil，StartedAt=null、视频进度为空、无本次考试。
4. 不形成复用链，已结束来源申请的真实通过结果仍可复用；引用的数据、人员身份资料与考试历史必须保留。
5. 过期当前轮次保留，新轮次沿用原课程快照，不能按最新模板或区域配置重新替换本申请必修课程。新增／修改配置只改变之后的新申请。
6. 申请状态 pendingApproval、approved、checkedIn 与学习进度独立。全部培训有效合格只用于汇总，个人进厂以整单审批及本人当前必修课程为条件，不能要求其他人先完成。
7. AppointmentDate 限制每位人员首次进厂的自然日，不限制培训进行时间，也不阻止已进厂人员跨日出厂。TimeSlot 仅登记展示。
8. rejected、cancelled、checkedOut、expired 是结束状态，不继续学习、答题或重考。expired 仍是预留状态，本版不提供自动过期任务或移动端设置接口，预约日期已过不自动改状态。

## 12. 后台审批与个人进出厂的衔接

React 手机端只查询结果，不提供审批或实际进出厂确认。后台可复用同一业务服务；若后台通过 Minimal API 执行操作，采用下面的最小接口。所有操作先执行后台认证、权限与资源范围校验，匿名上下文和 learningToken 一律无效。

| 方法 | 路径（省略 `/api/v1/admin`） | 请求 | 成功响应 |
| --- | --- | --- | --- |
| GET | `/approval-tasks/{taskId}` | 无 | 200，任务 DTO 与该任务 ETag |
| POST | `/approval-tasks/{taskId}/review` | `{ decision: 'approved' \| 'rejected', comment: string \| null }`，任务 If-Match | 200，更新任务、申请状态及任务 ETag |
| GET | `/applications/{applicationId}` | 无 | 200，后台申请详情与申请 ETag |
| GET | `/applications/{applicationId}/participants/{participantId}` | 无 | 200，后台人员 DTO 与人员 ETag |
| POST | `/applications/{applicationId}/participants/{participantId}/check-in` | 无请求体，人员 If-Match | 200，人员审计字段、申请状态、人员 ETag |
| POST | `/applications/{applicationId}/participants/{participantId}/check-out` | 无请求体，人员 If-Match | 200，人员审计字段、申请状态、人员 ETag |
| POST | `/applications/{applicationId}/complete` | 无请求体，申请 If-Match | 200，申请状态及汇总时间、申请 ETag |

后台 DTO 取对应实体字段的 camelCase 投影，包括后台查看所需的审批人和进出厂操作人标识，不受移动端个人 DTO 的裁剪限制，但仍按后台权限读取。后台请求也不接受客户端操作人或操作时间。

- 本接口设计采用后端 SPEC 的首版建议：业务及区域任务并行，每条一位审批人，任一任务驳回即驳回整单并取消剩余 pending 任务；驳回 comment 必填。任务生成后使用已解析出的 ApproverUserId，不重新按当前配置替换审批人。
- 进厂校验在同一服务端时刻执行：申请为 approved 或 checkedIn、转换到工厂时区的日期等于 AppointmentDate、本人尚未进过厂、整单审批全部通过、本人全部必修课程的当前记录有效合格。失败不写审计字段；培训过期时可生成必要新轮次，但不改变申请审批结论。
- 进厂成功一次性写 CheckedInAt、CheckedInById；首人使申请转为 checkedIn，申请 CheckedInAt 取首位时间。其他人员的培训与进厂状态不阻止本人。
- 出厂要求本人已经进厂，一次性写 CheckedOutAt、CheckedOutById，不重置进厂字段；可以跨日出厂。出厂后同一申请不能再次进厂。
- complete 要求申请 checkedIn，全部实际进厂人员已经出厂，改为 checkedOut，汇总 CheckedOutAt 为最后一位实际出厂时间。未到访人员不补写时间；整单确认人及确认时间由框架操作日志保存。
- 操作使用事务及并发校验。相同成功操作重试返回首次结果，不覆盖原操作人或时间；状态变化后相反审批或再次进厂返回 409。
- 业务失败使用同一 Problem Details 结构，并补充 APPOINTMENT_DATE_MISMATCH、APPROVAL_INCOMPLETE、TRAINING_NOT_VALID、PARTICIPANT_ALREADY_CHECKED_OUT、PARTICIPANT_NOT_CHECKED_IN、PARTICIPANTS_STILL_INSIDE 等明确 code。

上述后台操作不会要求 React 用户登录，也不授予匿名用户后台权限。

## 13. React 接入对应关系

| 当前实现／页面 | API 接入后的职责 |
| --- | --- |
| HomePage / ENTRIES | 获取 bootstrap，按 VisitType.Id 生成动态入口，继续学习入口独立 |
| RegistrationPage / Draft | 草稿继续本地保存，以 visitTypeId 为键，保留稳定 clientRequestId；配置与须知版本改变时重新确认 |
| BusinessInfoCards / 固定类型字段 | 渲染 fields；后台人员选择保存用户 Id，显示姓名由服务端快照产生 |
| RosterCards / Vehicle 与 AccompanyingVehicle | 所有类型使用独立 participants 和统一 vehicles；移除车辆司机生成 subjects 的逻辑 |
| AreaSelectionCard / RequiredCoursesCard | 用配置和 training-course-preview 显示区域与课程；不在本地分配最终课程或决定免训 |
| store.register | 调用 POST applications；收到 201/200 且有完整结果后清除已提交草稿 |
| RecordsPage / 本地搜索和统计 | 服务端分页与 totals，显示申请状态及独立培训汇总 |
| RecordDetailPage / deleteVisit | 获取详情；把演示删除改为 canCancel 时取消，不清除后台历史 |
| TasksPage / currentTasks | 调用 training-tasks/query，以 TrainingRecord.Id 和当前轮次显示课程，受个人访问范围约束 |
| TrainingPage / pendingTasks | 调用 learning-task-search；个人结果不读取整单详情或其他人的课程 |
| LearnPage / completeLesson | 实际播放 start，结束时完成上报；移除 API 模式的演示计时；资料按快照读取 |
| ExamPage / beginExam、answer | 保存 examAttemptId，恢复服务端 DeadlineAt，用选项集合与 ETag 保存答案；答题卡仅标记已答，移除未交卷实时判对错 |
| store.submitExam / 本地评分 | 调用 submit；服务端结果决定成绩、通过、免训与有效期 |
| ResultPage / retake | 获取固定 examAttemptId 的结果；失败重考指定 expectedPreviousAttemptId，不覆盖历史 |
| CompletionPage | 获取 completion，展示实际通过或来源免训及原有效期 |
| AppState / visitsafe.web.v2 | API 模式只保留草稿与必要界面缓存，不将演示通过记录、考试成绩或车辆司机资料作为真实历史上传 |

页面 URL 中 taskId 对应 TrainingRecord.Id；考试页面进入后关联固定 examAttemptId，不能让结果页总是读取“最新一次”而覆盖旧考试展示。当前 registration/:type 路由接入后改用不透明 visitTypeId，不能仅支持 visitor、logistics、contractor。

刷新或回到前台时重新读取当前任务／考试。倒计时可用 X-Server-Time 校准和本地单调计时显示；服务端截止时间不受设备时钟影响。断网期间本地选项可留在界面并显示未保存，但只有截止前服务端已接收的答案参与评分。

现有 Vite 静态应用通过一个 API 访问层承接 DTO 与错误，不把网络操作散落到 domain 纯业务函数中。页面需要 loading、空结果、网络失败、保存失败与版本冲突状态；本版不要求替换 UI 组件库或增加全局状态依赖。

## 14. 契约验收场景

以下是接口及前端接入时的验收要求，本轮文档交付不表示这些场景已经运行通过：

1. 无账号操作即可打开首页并登记；浏览器 A 的我的记录仅有 A 提交的申请，浏览器 B 不能仅凭 Id 读取或取消 A 的申请。
2. B 用完整匹配姓名＋手机号查询后，可恢复该人课程和同一考试；不能修改 participantId 查看其他人，不能访问整单身份证、附件或取消接口。无结果不创建申请。
3. 类型停用、须知正文修改、时段移除或模板变化后，旧草稿提交有明确错误并保留输入；历史申请仍显示原快照。新增类型不增加前端枚举分支。
4. 同一 clientRequestId 双击、并发或响应丢失重试只创建一张申请、`1 + N` 条审批任务及正确数量的个人课程记录；同键不同内容拒绝。
5. 多区域共享课程按人去重；任一区域缺少当前类型课程或负责人则整单提交失败，不能留下部分申请与任务。
6. 物流一单两车三人，生成三套个人课程，与司机名或车辆数无关；普通访客或施工无车辆可提交，物流缺车或运输单位不允许。
7. 相同姓名但不同手机号、或相同手机号不同姓名不能免训；有效来源只复用同一课程，保留原截止时间，不创建考试、不形成复用链。
8. 预约日开始前来源将过期时直接生成待学记录；截止时刻到达时合格变为无效，并发查询只生成一个新轮次，旧轮次写接口拒绝。
9. 未开始播放不写 StartedAt；视频不属于本轮快照、视频未完成或有效免训不能开始考试。重复视频完成不增加计数。
10. 初考和失败重考的创建请求重复各返回同一次考试；历史记录与本轮视频完成情况保留。未交卷 DTO 与课程内容响应均无标准答案或解析。
11. 单选、多选答案按集合保存，单选多项拒绝、多选少选零分；主动未答完不交卷，到期未答题零分，错题包含未答题。
12. 刷新、换手机、离开及浏览器关闭后，StartedAt、DeadlineAt、已保存答案不重置；客户端修改时钟不能延期。到期结算、答案保存与重复交卷并发得到一个固定结果。
13. 两标签页修改同一考试时旧 If-Match 返回 412；网络中断不报告保存或提交成功，恢复后先读取服务端结果，不能丢弃草稿或重复创建。
14. 课程有效期从 60 改为 30 天后，原通过和原免训不改截止；之后实际通过按 30 天计算。题库与 PDF 改动不替换既有快照。
15. 取消只在进厂前允许，保留历史通过供之后申请复用；旧学习链接不再写入取消、驳回或正常结束申请，移动端没有硬删除接口。
16. 同一上传引用不能绑定其他浏览器或多个人；超大、不允许格式、已过期文件提交有明确错误，重新上传不丢草稿。
17. 本人课程合格但整单审批未完成不能进厂；张三合格而李四未完成只允许张三，且必须在预约日当天。TimeSlot 不增加小时限制，跨日出厂仍正常。
18. 进出厂拒绝、重复及并发操作不改写首次审计字段；最后出厂人与整单确认人可不同，未到访人员时间始终为空。
19. 匿名上下文与学习凭证不能调用 admin 操作；个人凭证到期重新查询仍恢复原考试，清除浏览器 Cookie 不删除服务端业务记录。

## 15. Minimal API 实现约定与交付边界

- 使用独立 Request／Response DTO，业务服务执行校验、归属检查、事务及评分；管理实体和完整课程快照不直接返回手机网页。
- 统一 camelCase 属性与字符串枚举；配置 Minimal API 所用的 JSON 选项，不能只配置 MVC 序列化选项。枚举字符串配置参考 [System.Text.Json 官方文档](https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/customize-properties)。
- 错误统一 Problem Details；Minimal API 的错误处理与服务注册参考 [ASP.NET Core API 错误处理](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/error-handling-api?view=aspnetcore-10.0)。框架绑定、校验、404、限流和异常错误也需适配本规范，不能有的接口返回空错误体、有的返回 HTML。
- 实现时为每个接口声明请求、成功／错误响应、operationId、访问要求和示例，导出 OpenAPI 文档供前端联调；Minimal API 支持的元数据方式参考 [ASP.NET Core OpenAPI 官方文档](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/openapi/include-metadata?view=aspnetcore-10.0)。本文为业务接口 SPEC，本轮不生成代码或声称已有可运行 OpenAPI 服务。
- 本文不选择数据库映射、文件存储提供方或新认证框架；浏览器归属字段、动态模板投影、附件绑定与代理配置是正式接入时必须实现的适配。
- 后端 SPEC 尚未明确的申请提交后编辑、后台删除及独立自动过期规则不设计成公开移动端接口；需要这些能力时另行定义业务规则及契约。

本轮交付是一份可供前后端实现与联调的 v1 规范。React 仍运行本地演示，真实跨浏览器数据、后台审批、服务器考试和实际进出厂需后续实现及验收。
