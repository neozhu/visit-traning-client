# VisitSafe

**让每一次到访，更安全、更安心。**

[English](README.md) | [简体中文](README.zh-CN.md)

![施工人员从接待登记、身份核验、安全培训和考试，到工作人员确认后进入厂区的过程](doc/images/visitsafe-cover.png)

*施工人员入场示意：接待登记、身份核验、安全培训、考试，再由工作人员核对来访条件后入场。*

将来访登记与安全培训，串成一条清晰的手机办理流程。VisitSafe 帮助访客、施工人员和物流司机提前准备来访信息、完成必修培训，随时查看自己的学习结果。

面向工厂、工业园区、仓储物流场地，以及负责接待与安全管理的团队。

## 在线体验 VisitSafe

| 演示网站 | 体验内容 |
| --- | --- |
| **[访客与学习前台](https://visit-safe.blazorserver.com/)** | 手机来访登记、本人信息核验与任务查询、视频学习、考试与培训结果 |
| **[业务管理后台](https://visit-training.blazorserver.com/)** | 运营看板，以及来访、审批、人员、车辆、课程与培训记录管理入口 |

建议先用手机打开前台，选择来访身份体验登记，或从学习入口查询已分配的培训。后台运营看板使用示例业务数据，便于了解整体管理场景。

## 少一些反复沟通，多一份到访准备

来访安排应当清楚，安全要求也应当容易理解。VisitSafe 将每位来访人员需要完成的下一步呈现在眼前。

| 业务需求 | VisitSafe 带来的体验 |
| --- | --- |
| 提前准备来访信息 | 通过引导式登记，收集预约、访问区域、人员、车辆及相关业务资料 |
| 让每个人学到所需内容 | 按登记类型与访问区域匹配必修课程，独立跟踪每位人员的进度 |
| 让办理和学习持续推进 | 保存登记草稿，继续尚未完成的学习任务 |
| 减少重复学习 | 同一人员、同一课程的有效合格结果可按规则复用，保留原有效期限 |
| 让培训完成情况看得见 | 集中查看课程进度、考试成绩和培训有效期 |
| 方便不同语言的使用者 | 访客界面支持简体中文与 English |

## 围绕不同来访人员设计

**普通访客与供应商**可以预约来访、阅读须知、添加同行人员，并完成各自需要的培训。

**物流司机**可以在来访登记中填写司机与车辆信息，让运输业务与实际来访人员保持关联。

**施工与服务团队**可以登记作业来访，并按访问区域完成相应的安全学习。

**提前安排培训的人员**可以直接查找并完成已分配的学习任务，无需先创建来访申请。

## 一部手机，走完清晰的培训流程

1. **登记来访信息。** 选择来访身份，阅读须知，填写预约、访问区域、参加人员，以及适用的车辆或业务资料。
2. **核验本人信息。** 查询或继续个人学习时，填写登记时使用的姓名和手机号，找到对应的本人培训任务。
3. **完成安全学习。** 按每位人员的课程安排，完成必修安全视频。
4. **参加课程考试。** 提交答卷、查看结果，需要时重新考试。
5. **保留培训结果。** 查看完成情况和有效期，继续未完成的任务，并在后续来访中按规则使用仍有效的结果。

来访审批与学习培训可以并行推进。业务与区域审批、人员进出厂操作由管理后台衔接。培训合格是进厂准备的一部分，实际进厂仍需满足本次来访的相关要求。

## 访客办理与业务管理，衔接同一次来访

手机前台与管理后台面向不同角色，共同服务于一条来访业务流程。

| 面向访客与学习人员 | 面向运营与安全团队 |
| --- | --- |
| 登记并查看来访信息 | 管理来访申请、人员档案与车辆档案 |
| 查询课程并继续学习 | 组织课程、分配任务并管理培训记录 |
| 完成考试并查看个人结果 | 了解学习进度、成绩及培训有效期 |
| 为下一次来访做好准备 | 协调审批责任与进出厂操作 |

本仓库提供 **React 访客与学习前端**，配套管理平台采用 Blazor 与 ASP.NET Minimal API。产品持续迭代，当前接入范围详见[前端说明](web/README.md)及下方业务规范。

## 在自己的环境中使用

参考[环境变量示例](web/.env.example)，在 `web/.env.local` 中配置 VisitSafe API 地址和共享访问密钥，然后启动：

```powershell
npm --prefix web ci
npm run dev
```

Docker 与 Portainer 的配置见 **[开发与部署指南](doc/DEPLOYMENT.md)**。

### 使用 GHCR 镜像本地部署

通过 [docker-compose.ghcr.yml](docker-compose.ghcr.yml) 一次启动访客前台、管理后台和 SQL Server。请先安装支持 Compose v2 的 Docker 并启动 Docker 引擎，无需在本机安装 Node.js 或编译前端。

在仓库根目录创建 `.env.ghcr.local`，填写以下配置，并替换共享密钥与数据库密码。该文件包含敏感配置，请妥善保管，不要提交到 Git：

```dotenv
VISITSAFE_API_URL=http://localhost:5505
APP_URL=http://localhost:5505
VISITSAFE_API_KEY=replace-with-a-long-random-key
SQL_SERVER_PASSWORD=ReplaceWithAStrongPassword123!
ASPNETCORE_URLS=http://+:80
```

`VISITSAFE_API_URL` 必须是浏览器可访问的后台地址，不包含 `/api/v1`。使用同一局域网内的手机访问时，将两个 URL 中的 `localhost` 都改为 Docker 主机的局域网 IP。共享 API 密钥也会传给前端，浏览器用户可以查看。此示例使用 HTTP；HTTPS 需要另行配置证书或反向代理。

在仓库根目录执行：

```powershell
docker compose --env-file .env.ghcr.local -f docker-compose.ghcr.yml config --quiet
docker compose --env-file .env.ghcr.local -f docker-compose.ghcr.yml pull
docker compose --env-file .env.ghcr.local -f docker-compose.ghcr.yml up -d
docker compose --env-file .env.ghcr.local -f docker-compose.ghcr.yml ps
```

启动后访问访客前台 `http://localhost:8080`、管理后台 `http://localhost:5505`。需要调整端口时，在环境文件中设置 `WEB_PORT` 和 `BACKEND_HTTP_PORT`，并同步修改后台 URL。后台会等待 SQL Server 健康检查通过后启动；启动异常时，可用 `docker compose --env-file .env.ghcr.local -f docker-compose.ghcr.yml logs --tail 100` 查看日志。

更新镜像时重新执行 `pull` 和 `up -d`。停止服务使用 `docker compose --env-file .env.ghcr.local -f docker-compose.ghcr.yml down`。数据库与上传文件分别保存在 `mssql_data` 和 `backend_files` 数据卷中；添加 `--volumes` 会删除这些数据。

此方案使用 GHCR 发布镜像，其中前端镜像须支持 Compose 传入的运行时 `VITE_VISITSAFE_*` 变量；上方源码构建方案使用的是构建时配置。SMTP、对象存储等可选集成按需通过 Compose 文件中列出的变量配置。

前端采用 React、TypeScript、Vite、Ant Design Mobile 与 Tailwind CSS，面向现代手机浏览器设计。

## 项目资料

- [前端启动与接口接入说明](web/README.md)
- [React 手机端业务规范](doc/VisitSafe-React-Mobile-SPEC.md)
- [后端业务规范](doc/VisitSafe-Backend-SPEC.md)
- [API 规范](doc/VisitSafe-API-SPEC.md)
- [开发协作约定](AGENTS.md)
- [Lucide 图标许可](web/public/assets/LUCIDE-LICENSE.txt)

**[立即体验访客前台](https://visit-safe.blazorserver.com/) · [查看业务管理后台](https://visit-training.blazorserver.com/)**
