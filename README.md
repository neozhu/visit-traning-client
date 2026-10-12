# VisitSafe 手机端应用

使用 React 19、TypeScript 7、Vite 8、Ant Design Mobile 5、Tailwind CSS 4 和 React Router 8，面向现代手机浏览器。应用位于 `web/`，提供登记、个人培训、视频学习、考试、结果、凭证和我的记录流程。

## 启动 React 应用

```powershell
npm --prefix web install
npm run dev
```

打开终端显示的本地地址。在同一局域网中，手机可打开 Vite 显示的 Network 地址。页面针对手机宽度设计，预览时可使用浏览器设备模拟模式。

```powershell
npm test                  # React 业务测试
npm run typecheck         # React TypeScript 检查
npm run build             # React 生产构建，输出 web/dist/
npx --prefix web playwright install chromium
npm run test:e2e          # 手机尺寸的完整浏览器流程
```

部署时将 `web/dist/` 作为静态网站目录，并将应用路径回退到 `index.html`，确保直接访问任务及考试链接可用。图标与视频随构建一起发布，不依赖外部图像服务。

React 应用使用独立的 `visitsafe.web.v1` 浏览器存储。三类登记、草稿、人员／车辆增改删、组合课程匹配、个人独立进度、姓名＋手机号继续学习、真实短视频、五题考试、错题重考和记录删除均可交互。考试截止时间按绝对时间保存，刷新及后台恢复不会重新计时。视频加载失败时可主动使用演示计时。

同一浏览器、同一地址的多个标签页会同步学习进度、考试答案和删除操作；写入前读取最新存储，避免旧页面恢复已删除申请。若缓存结构损坏或必修任务缺失，页面显示恢复提示并使用空白演示状态，继续登记后保存新数据。不同地址（例如 localhost 和局域网 IP）的浏览器存储独立。

当前是本地演示版本，课程、视频及培训凭证属于演示材料。数据仅在当前浏览器共享；姓名＋手机号查询不构成身份认证。本轮未实现后台服务、真实审批或实际通行授权，后续按后端 SPEC 接入 ASP.NET Minimal API。React 需求见 [React 手机端 SPEC](doc/VisitSafe-React-Mobile-SPEC.md)，开发约定见 [AGENTS.md](AGENTS.md)。

## 目录

| 路径 | 内容 |
| --- | --- |
| `web/src/pages/` | 手机端页面与业务流程 |
| `web/src/components/` | 公共 UI、车牌键盘和状态提供器 |
| `web/src/domain/` | 类型、模拟课程、校验和本地存储 |
| `web/src/domain/store.test.ts` | React 业务测试 |
| `web/e2e/` | Playwright 手机浏览器验收 |
| `web/public/assets/` | 图标、插图和演示视频 |
| `doc/` | React 规范、业务需求与视觉参考 |

## 图标许可

使用 Lucide 线性图标及其颜色变体，资源与完整许可位于 [web/public/assets/LUCIDE-LICENSE.txt](web/public/assets/LUCIDE-LICENSE.txt)。

历史客户端业务规格与参考图保留供需求追溯；当前开发、运行和验收以 React 规范为准。
