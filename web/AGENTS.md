# React 手机端开发约定

- 只面向现代手机浏览器，使用 React、TypeScript、Vite、Ant Design Mobile 和 Tailwind CSS。
- 两空格缩进、单引号、不写分号；页面位于 `src/pages/`，公共组件位于 `src/components/`，业务模型位于 `src/domain/`。
- 保留既有品牌颜色、中文业务流程和手机触摸体验；业务代码与当前 React 应用保持独立。
- Ant Design Mobile 用于基础交互，Tailwind 用于布局，组件主题使用 CSS 变量。不要全局覆盖 `.adm-*` 内部选择器。
- 业务数据使用独立本地存储，不接入真实后端。模拟内容在 README 中说明，生产认证与共享数据留待 API 接入。
- 验证命令：`npm test`、`npm run typecheck`、`npm run build`、`npm run test:e2e`。手机页面至少检查 320px、390px、430px 宽度。
