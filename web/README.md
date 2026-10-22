# VisitSafe React 前端

界面基于 `D:\github\visitor-safe\web`。原有 `src/components` 和 CSS 定义保持原样，API 请求与数据适配位于 `src/domain/api*.ts`，页面仅调整数据绑定和接口事件。

本地启动：`npm ci`，配置 `.env` 后执行 `npm run dev -- --port 5173 --strictPort`。API 地址使用 `VITE_VISITSAFE_API_URL`，同源反向代理时留空。`VITE_VISITSAFE_API_KEY` 是浏览器可见的共享访问密钥，含 `#` 时必须使用引号。

请求使用 `credentials: 'omit'`；浏览器提交者使用 `X-Client-Token`，本人学习范围单独使用 `X-Learning-Token`。申请、进度、考试和评分来自服务端；本地仅保存草稿与访问凭证，不导入原演示记录。

界面支持简体中文与 English，仅在首页提供切换入口，默认中文，选择保存在 `visitsafe.language`。界面文案位于 `src/locales/en.ts`，基础组件和时间显示跟随语言切换；切换不重建页面，不清除当前输入或学习、考试状态。后台录入的须知、课程、题目、区域及业务选项保留原文。此功能仅修改 React 前端，无后端或数据库变更。

已绑定现有登记、申请记录、本人任务查询、视频学习、考试、重考和结果页面。物流登记沿用车辆及司机表单：车牌、运输单位和司机姓名作为车辆资料，司机姓名、手机号及单位分别作为本次来访人员资料提交；相同姓名＋手机号只登记一位人员，车辆档案不关联人员。新增类型的任意动态字段、附件/PDF、关联申请与历史培训查询结果也尚无完整展示入口，不视为已经完成整合。

验证：`npm test`、`npm run build`。`localStore.ts` 仅保留复制来的本地模型供原有单元测试使用；原有 `e2e` 中通过本地演示存储造数的场景仍需转换为 API 场景，不能作为当前接口验证结果。
