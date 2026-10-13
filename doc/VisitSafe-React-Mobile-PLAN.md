# VisitSafe React Mobile Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** 在新分支交付包含登记、个人培训、考试和记录流程的独立手机端 React 演示应用。

**Architecture:** `web/` 是独立 Vite 应用，业务模型和本地存储位于 `src/domain/`，React Context 提供可订阅的状态；页面通过 React Router 导航。仓库根目录提供启动与验证入口。

**Tech Stack:** React、TypeScript、Vite、Ant Design Mobile、Tailwind CSS、React Router、Vitest、Playwright。

**Spec:** [VisitSafe-React-Mobile-SPEC.md](VisitSafe-React-Mobile-SPEC.md)

## Global Constraints

- 只针对现代手机浏览器；保留科技蓝和现有业务流程。
- 使用模拟数据和本地存储，不接入真实后台服务。
- 仅维护 `web/` 应用；既有产品素材允许使用。
- 改动限定新应用、根目录运行入口和相关文档。

## Review Focus

- 草稿或保存失败后输入不能丢失，提交不能部分成功。
- 手机后台／刷新不重置考试截止时间，到期按实际保存答案评分。
- 重名、相同司机、多申请查询不能把人员进度混合。
- 车牌弹层取消、编辑和新能源第八位不能破坏已保存数据。
- 删除后的旧链接不能创建任务或继续考试。

## Task 1: 项目与业务模型

Files: `web/package.json`、配置文件、`web/src/domain/{types,catalog,store}.ts`、`web/src/domain/store.test.ts`。

Interfaces: `createDemoStore(storage, clock)` 提供快照、草稿保存、登记、视频完成、考试答题／交卷／重考、删除；`matchCourses(type, areaIds)` 返回去重课程。

- [x] 配置依赖、编写业务测试并确认缺少实现时失败。
- [x] 独立实现类型、课程和事务式浏览器存储；验证错误登记、多人员任务、精确查询、超时／重考及删除。
- [x] 运行 `npm --prefix web test` 和 `npm --prefix web run typecheck`。

## Task 2: 完整 React 页面

Files: `web/src/{App,main,styles}`、`web/src/components/`、`web/src/pages/`、`web/e2e/mobile.spec.ts`。

Interfaces: `useVisitSafe()` 提供业务快照和 store；路径覆盖首页、登记、继续学习、任务、视频、考试、结果、凭证和记录详情。

- [x] 编写手机端浏览器流程测试，确认页面行为未实现时失败。
- [x] 实现完整流程、车牌键盘、视频播放器、后台恢复、错误与空状态；使用既有视觉素材。
- [x] 运行业务测试、类型检查、生产构建和手机尺寸浏览器验收。

## Task 3: 文档与交付

Files: 根目录 `package.json`、`.gitignore`、`README.md`、`web/AGENTS.md`。

- [x] 提供根目录 React 启动／构建命令与独立开发约定。
- [x] 检查 Git 差异及手机截图；重建阶段完成过旧客户端回归验证，其源码和测试随后按用户要求移除。
- [x] 完成全分支独立审查并修复重要问题，保留新分支交付。

## 验收补充

- [x] 独立审查发现的局域网 HTTP ID 生成、嵌套缓存校验、多标签页旧状态覆盖问题已修复并回归。
- [x] 按用户反馈统一人员与随行车牌卡片，编辑／删除使用 44px 图标按钮，删除保留确认，编辑保持名单顺序。
- [x] 访问区域采用圆形 SVG 勾选、蓝色标题与加强边框；多选／取消及 320／390／430px 无溢出已验证。
- [x] 最终 React 验证：13 项业务测试、11 项手机浏览器流程、类型检查及生产构建通过。
- 实机手机尚未验证；本轮手机验收使用 Edge 和 Playwright 的手机尺寸。

## Task 4: 移除旧客户端代码

Scope: 用户要求删除微信小程序相关的所有代码。保留 React 应用及其资源、业务规格与视觉参考，历史客户端文档不再作为运行和构建依据。

- [x] 先更新根目录和 `web/AGENTS.md`，取消保留旧代码与旧测试的要求。
- [x] 删除 `miniprogram/`、`typings/`、旧 `tests/`、旧 `scripts/`、微信配置及根目录旧 TypeScript 配置。
- [x] 清理根目录旧依赖、命令和锁文件，更新 README、React SPEC 与忽略规则。
- [x] 检查代码和运行配置没有旧平台引用；13 项 React 业务测试、生产构建（包含类型检查）及 11 项手机浏览器流程通过。

## Task 5: 模拟培训有效期与历史免训

Scope: React 使用模拟课程与本地记录，按姓名＋手机号和同一课程复用有效的历史通过结果；不接入真实后台、课程维护后台或实际通行。

- [x] 每门课程配置 trainingValidityDays，默认 60 天，实际通过时固定截止时间；新申请免训不生成视频进度、考试或新期限。
- [x] 任务、查询、记录、凭证及旧学习／考试链接按当前有效结果展示；过期新增学习轮次，保留通过与复用历史。
- [x] 按用户要求直接清除旧 v1 数据与视频演示计时，改用 v2，不保留迁移逻辑。
- [x] 独立审查发现的申请间复用依赖环已修复，并通过先失败后成功的业务回归。
- [x] 27 项业务测试、类型检查、生产构建及 18 项手机浏览器流程通过；320／390／430px 无溢出，免训按钮触摸高度至少 44px，截图已检查。真实手机尚未验证。
