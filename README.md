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

## Docker 与 Portainer 部署

根目录的 `Dockerfile` 使用 Node 24 安装锁定依赖并构建应用，再将静态产物和资源复制到 Nginx Alpine 镜像。已配置 React 路由回退、资源缺失时返回 404、首页缓存重验证和 `/healthz` 健康检查。

本机 Docker 可直接运行：

```powershell
docker compose up --build -d
docker compose ps
```

默认地址为 `http://服务器IP:8080`。可通过 `HTTP_PORT` 调整宿主机端口，例如在 PowerShell 中先执行 `$env:HTTP_PORT = '8090'`，或在 Portainer 的环境变量区域设置 `HTTP_PORT=8090`。

在 **Portainer 连接本机 Docker socket** 的单机环境中，使用 **Stacks → Add stack → Repository**：

| 配置 | 值 |
| --- | --- |
| Name | `visitsafe` |
| Repository URL | `https://github.com/neozhu/visitor-safe-wechat.git` |
| Repository reference | `refs/heads/feat/visitsafe-react-mobile` |
| Compose path | `docker-compose.yml` |
| Environment variables | 可选：`HTTP_PORT=8080` |
| Re-pull image | 关闭，本配置从源码构建本机镜像 |

先将包含这些部署文件的提交推送到上述分支，再点击 **Deploy the stack**。私有仓库在 Portainer 中填写 Git 认证信息。`pull_policy: build` 会在部署和更新时重新构建应用，已有依赖层可复用缓存；之后通过 **Pull and redeploy** 更新。若改用其他分支或仓库，同步修改 Portainer 中的引用。

配置没有宿主机目录挂载；Nginx 配置、页面和视频都在镜像内，不需要启用相对路径卷。应用数据仍保存在访问者浏览器中，不需要容器数据卷，也不会变成跨设备共享数据。

本方式以本机 Docker socket 为前提；Portainer 官方列出远程 Docker 环境的 Compose `build` 限制。若改成 Agent／远程环境，应先构建并发布镜像，再使用仅含 `image` 的 Stack。参考：[Portainer Git Stack 部署](https://docs.portainer.io/user/docker/stacks/add#option-3-git-repository)、[远程构建限制](https://docs.portainer.io/faqs/known-issues/docker-compose-files-including-build-steps-fail)、[Compose 镜像构建策略](https://docs.docker.com/reference/compose-file/services/#pull_policy)。

React 应用使用独立的 `visitsafe.web.v2` 浏览器存储。三类登记、草稿、人员／车辆增改删、组合课程匹配、个人独立进度、姓名＋手机号继续学习、真实短视频、五题考试、错题重考和记录删除均可交互。考试截止时间按绝对时间保存，刷新及后台恢复不会重新计时。视频加载失败时可主动使用演示计时。

培训有效期由模拟课程的 `trainingValidityDays` 配置，每门默认 60 天，配置位于 `web/src/domain/catalog.ts`。姓名＋手机号完全一致且同一课程的历史通过结果仍有效时，新申请显示“有效期内免训”，无需重复观看视频或答题；其他人员、未通过、已过期和新增课程仍需学习。有效期从实际通过起算，重复登记不续期；免训凭证展示上次通过时间和有效截止，不生成新成绩。过期会创建新的学习轮次，保留旧结果；被其他申请复用的来源申请需先解除关联申请才能删除。

演示方式：先登记张三并完成一门课程，再在同一浏览器以相同姓名和手机号提交新申请，所需的同一课程即可免训；同时登记的李四仍需独立学习。新版打开时直接清除旧 `visitsafe.web.v1` 数据及旧视频演示计时，不迁移旧记录；之后的登记与学习继续保存在 v2 中。课程配置维护后台和服务端进厂校验仍留待 API 接入。

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
| `Dockerfile`、`docker-compose.yml` | 生产镜像与 Portainer Git Stack 部署 |
| `docker/nginx.conf` | 静态资源、React 路由回退和健康检查 |

## 图标许可

使用 Lucide 线性图标及其颜色变体，资源与完整许可位于 [web/public/assets/LUCIDE-LICENSE.txt](web/public/assets/LUCIDE-LICENSE.txt)。

历史客户端业务规格与参考图保留供需求追溯；当前开发、运行和验收以 React 规范为准。
