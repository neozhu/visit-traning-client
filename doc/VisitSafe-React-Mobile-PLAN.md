# VisitSafe React Mobile Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task.

**Goal:** 在新分支交付与现有小程序同等主要流程的独立手机端 React 演示应用。

**Architecture:** `web/` 是独立 Vite 应用，业务模型和本地存储位于 `src/domain/`，React Context 提供可订阅的状态；页面通过 React Router 导航。原小程序保留，业务源码重新编写。

**Tech Stack:** React、TypeScript、Vite、Ant Design Mobile、Tailwind CSS、React Router、Vitest、Playwright。

**Spec:** [VisitSafe-React-Mobile-SPEC.md](VisitSafe-React-Mobile-SPEC.md)

## Global Constraints

- 只针对现代手机浏览器；保留科技蓝和现有业务流程。
- 使用模拟数据和本地存储，不接入真实后台服务。
- 新源码不导入 `miniprogram/`；既有素材允许使用。
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
- [x] 验证原小程序测试未受影响，检查 Git 差异及手机截图。
- [ ] 完成全分支独立审查并修复重要问题，保留新分支交付。
