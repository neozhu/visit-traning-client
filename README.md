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

本机 Docker 先配置 API 地址和共享访问密钥，再构建启动：

```powershell
$env:VITE_VISITSAFE_API_URL = 'https://api.example.com'
$env:VITE_VISITSAFE_API_KEY = 'replace-with-api-key'
docker compose up --build -d
docker compose ps
```

默认地址为 `http://服务器IP:8080`。可通过 `HTTP_PORT` 调整宿主机端口，例如在 PowerShell 中先执行 `$env:HTTP_PORT = '8090'`，或在 Portainer 的环境变量区域设置 `HTTP_PORT=8090`。

| 变量 | 用途 |
| --- | --- |
| `VITE_VISITSAFE_API_URL` | 浏览器可访问的 API 服务地址，不包含 `/api/v1`。留空时请求当前站点的 `/api/v1`，需由外部反向代理转发到后端；镜像内 Nginx 只提供静态页面。 |
| `VITE_VISITSAFE_API_KEY` | 后端要求的共享访问密钥；为空时前端无法调用接口。此值会包含在浏览器下载的代码中。 |

这两个变量通过 Compose 的 `build.args` 传入 Dockerfile，并在 Vite 生产构建时写入静态文件。修改变量后执行 `docker compose up --build -d` 重新构建；仅重启容器不会更新前端配置。构建不读取本机 `web/.env.local`。

### GitHub Actions 自动发布到 GHCR

[Publish Docker Image 工作流](.github/workflows/docker-publish.yml) 复用根目录 Dockerfile，构建 `linux/amd64` 镜像并发布到 GitHub Container Registry。当前仓库的镜像地址为 `ghcr.io/neozhu/visit-traning-client`；仓库迁移或重命名后，工作流自动使用新的仓库名称。

首次运行前，在仓库 **Settings → Secrets and variables → Actions** 配置：

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| Repository variable | `VITE_VISITSAFE_API_URL` | 浏览器可访问的 API 服务地址，不包含 `/api/v1`；同源反向代理部署可留空 |
| Repository secret | `VITE_VISITSAFE_API_KEY` | 必填，后端要求的共享访问密钥；未配置时工作流会停止并提示 |

发布认证使用 GitHub 自动提供的 `GITHUB_TOKEN`，工作流声明 `contents: read` 和 `packages: write`，无须额外配置镜像仓库密码。上述 API 地址和共享访问密钥仍在构建时写入浏览器代码，修改后需要重新构建镜像。参考：[GitHub 发布 Docker 镜像](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)。

触发方式与标签：

- 推送到 `feat/visitsafe-react-mobile`、`main` 或 `master` 时构建并发布，生成 `latest`、分支标签及 `sha-<提交号前七位>`。
- 推送 `v*` 标签（例如 `v1.0.0`）时发布 `latest`、同名版本标签和提交号标签。
- 工作流文件进入仓库默认分支后，也可从 **Actions → Publish Docker Image → Run workflow** 选择分支手动发布。当前远端默认分支为 `feat/visitsafe-demo`，仅推送开发分支不会显示手动运行入口；开发分支的 push 触发不受影响。参考：[手动运行工作流](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)。

每次发布都会更新 `latest`；需要固定版本时使用版本标签或提交号标签。镜像和版本可在 GitHub 仓库关联的 **Packages** 中查看。

部署已发布镜像，无须在服务器上构建源码：

```powershell
docker pull ghcr.io/neozhu/visit-traning-client:latest
docker run -d --name visitsafe --restart unless-stopped -p 8080:80 ghcr.io/neozhu/visit-traning-client:latest
```

GHCR 首次创建的包默认为私有。拉取私有镜像前，执行 `docker login ghcr.io -u neozhu`，使用具有该包访问权限及 `read:packages` 范围的 personal access token（classic）登录；Portainer 可在 Registries 中配置相同凭据。也可按需要在包设置中调整可见性。参考：[GHCR 认证与可见性](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)。

### Portainer 从源码构建

在 **Portainer 连接本机 Docker socket** 的单机环境中，使用 **Stacks → Add stack → Repository**：

| 配置 | 值 |
| --- | --- |
| Name | `visitsafe` |
| Repository URL | `https://github.com/neozhu/visit-traning-client.git` |
| Repository reference | `refs/heads/feat/visitsafe-react-mobile` |
| Compose path | `docker-compose.yml` |
| Environment variables | `VITE_VISITSAFE_API_URL`、`VITE_VISITSAFE_API_KEY`；可选：`HTTP_PORT=8080` |
| Re-pull image | 关闭，本配置从源码构建本机镜像 |

先将包含这些部署文件的提交推送到上述分支，再点击 **Deploy the stack**。私有仓库在 Portainer 中填写 Git 认证信息。`pull_policy: build` 会在部署和更新时重新构建应用，已有依赖层可复用缓存；之后通过 **Pull and redeploy** 更新。若改用其他分支或仓库，同步修改 Portainer 中的引用。

配置没有宿主机目录挂载；Nginx 配置、页面和视频都在镜像内，不需要启用相对路径卷。当前前端通过 API 获取申请、学习进度和考试数据，本地仅保存草稿与访问凭证；前端容器不需要数据卷。

本方式以本机 Docker socket 为前提；Portainer 官方列出远程 Docker 环境的 Compose `build` 限制。若改成 Agent／远程环境，应先构建并发布镜像，再使用仅含 `image` 的 Stack。参考：[Portainer Git Stack 部署](https://docs.portainer.io/user/docker/stacks/add#option-3-git-repository)、[远程构建限制](https://docs.portainer.io/faqs/known-issues/docker-compose-files-including-build-steps-fail)、[Compose 镜像构建策略](https://docs.docker.com/reference/compose-file/services/#pull_policy)。

React 应用使用独立的 `visitsafe.web.v3` 浏览器存储，不迁移或兼容旧版本数据。三类登记、草稿、人员／车辆增改删、组合课程匹配、姓名＋手机号继续学习、真实短视频、五题考试、错题重考和记录删除均可交互。考试截止时间按绝对时间保存，刷新及后台恢复不会重新计时。视频加载失败时可主动使用演示计时。

人员按去除首尾空格后的姓名＋手机号复用独立档案，车辆按规范化车牌复用独立档案。登记时可带入人员资料或车辆默认运输单位，本次确认的人员和车辆资料保存在申请快照，不自动修改档案或历史申请。物流保留既有车辆及司机表单，仍由司机资料生成本地演示培训人员；独立人员录入的物流页面及后台留待后续实现。

培训任务独立归属于人员＋课程，多张申请直接关联同一任务，共享视频、答卷、实际成绩及有效期。已有未完成任务继续原进度；有效通过结果直接免训；不满足当前及预约日有效期条件时创建新轮次。每门课程默认有效 60 天，实际通过时按当前 `trainingValidityDays` 计算，关联不续期。申请保留自己的课程及轮次关联；删除申请仅解除本申请关联，保留独立档案、培训和历次考试。没有申请的已分配任务也可从姓名＋手机号入口查询，列表不重复展示共享任务。

课程内容、题目、及格分 `passScore` 和考试分钟数 `examDurationMinutes` 在任务创建时保存快照。演示课程默认五道四选项单选题、80 分及格、15 分钟；数据层和答题页面也支持多选题（`kind: 'multiple'`、`correctIndexes` 集合），必须完整选对才得 20 分。重考产生新考试并保留历史及本轮视频；过期重训不沿用旧视频。

演示方式：先登记张三并完成一门课程，再以相同姓名和手机号提交新申请，即可免训；张三未完成的课程共用原任务，李四仍需独立学习。`createDemoStore` 提供 `assignTraining(person, courseIds)` 和 `registerInternal(draft)` 供本地演示数据及测试使用，不提供前端自主选课或后台管理页面。内部申请保存须知快照，打开申请详情或本申请任务时先确认，首次确认时间保持不变；独立学习不受申请须知限制。课程维护后台、真实审批、通行操作和 API 均未接入。

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
| `.github/workflows/docker-publish.yml` | 自动构建 Docker 镜像并发布到 GHCR |
| `docker/nginx.conf` | 静态资源、React 路由回退和健康检查 |

## 图标许可

使用 Lucide 线性图标及其颜色变体，资源与完整许可位于 [web/public/assets/LUCIDE-LICENSE.txt](web/public/assets/LUCIDE-LICENSE.txt)。

历史客户端业务规格与参考图保留供需求追溯；当前开发、运行和验收以 React 规范为准。
