# VisitSafe 微信小程序 Demo

原生 TypeScript + WXML + WXSS 实现。使用本地数据和 Storage，不依赖后端、云服务或网络视频。

## 业务流程

![VisitSafe 业务流程](doc/VisitSafe-flow.png)

## 系统架构

![VisitSafe 系统架构](doc/VisitSafe-architecture.png)

## 运行

1. 安装 Node.js（本次验证使用 24.18.1），在仓库根目录执行 `npm install`。
2. 在微信开发者工具中导入本仓库根目录。`project.config.json` 已设置 `miniprogramRoot: "miniprogram/"` 和 TypeScript 编译插件。
3. 使用自己的有效小程序 AppID，或开发者工具提供的测试号；点击“编译”。首页有学习培训、普通访客、物流车辆、施工人员四个入口。
4. 本项目没有运行时 npm 包，不需要点击“构建 npm”。通过“预览”可在手机上检查布局和视频兼容性。

## 图标

使用 [Lucide](https://lucide.dev/) 线性图标，按需下载到 `miniprogram/assets/`，页面直接通过 `image` 引用本地 SVG。底栏使用同一套图标导出的透明 PNG，不需要安装运行时图标库或“构建 npm”。

图标来源固定为 [Lucide 源码版本 70562c1](https://github.com/lucide-icons/lucide/tree/70562c1ee1c4fdcf736fe97bc893fb8511927934/icons)，保留原始 24×24 网格和 2px 线宽，仅调整颜色。`book`、`flask`、`helmet`、`shield`、`user`、`home` 分别对应官方 `book-open`、`flask-conical`、`hard-hat`、`shield-check`、`user-round`、`house`；`chevron`、`close`、`alert` 分别对应 `chevron-right`、`x`、`triangle-alert`。`-white`、`check-green` 和底栏 `-active` 文件为颜色变体。完整开源许可（含部分源自 Feather 的图标许可）见 [LUCIDE-LICENSE.txt](miniprogram/assets/LUCIDE-LICENSE.txt)。

## 演示流程

普通访客、物流车辆、施工人员：入口 → 勾选访客须知 → 添加/编辑/删除人员或车辆 → 多选访问区域 → 确认申请单 → 视频学习 → 考试 → 结果/错题解析 → 我的记录。

学习培训：填写多人信息 → 直接观看通用安全视频 → 考试 → 本地记录；不选择区域，不经过三步到访登记。

- 可点击“填入两条演示数据”快速填写虚构人员或车辆。不会自动添加历史记录。
- 培训按**申请单**完成。无论登记几位人员或几辆车，同一课程只生成一个任务；不显示培训人，也不需要逐人重复学习。
- 生产区、研发区、非生产区匹配对应课程；物流另需交通安全，施工另需施工安全。申请单的全部课程通过后，该申请单显示“已完成”。
- 每段本地教学视频为 6 秒，完整播放后计入进度；全部视频完成才能考试。视频加载失败时启动 6 秒演示倒计时，结束后也计入本段学习进度；返回页面不会重新开始该倒计时。
- 每门课程 5 道单选题，每题 20 分，80 分通过，限时 15 分钟。演示题正确选项依次为 **A、B、C、A、B**。
- 选完答案自动进入下一题，答错立即提示并在答题卡标红；可用“上一题”或题号返回修改。最后一题保留在当前页，确认后交卷，按修改后的最终答案评分。
- 主动交卷前必须答完；到期按已有答案自动评分，未答题不得分。离开、重载不会重置截止时间。
- 未通过可查看错题并重考。重考清空答案、重新计时，保留已完成视频。
- 我的记录支持姓名、单位、车牌搜索，查看登记明细、继续培训以及确认删除。删除申请单会同步删除其培训任务。
- 添加/编辑弹窗右上角的 × 取消当前编辑，保留已保存的登记项。

## 验证命令

```powershell
npm test           # 登记、课程匹配、申请单共享进度、评分、持久化与删除测试
npm run typecheck  # 严格检查小程序 TypeScript 源码
npm run smoke      # 微信开发者工具模拟器端到端验收
```

`smoke` 仅适用于 Windows，需要 PowerShell 7，以及已打开、已登录并授权 Codex 自动化的微信开发者工具。默认 CLI 路径为腾讯安装目录，可通过环境变量 `WECHATIDE_CLI` 指定其他安装位置。运行时请勿操作模拟器。

验收使用虚构数据，先备份本应用的 `visitsafe.demo.v1` 存储，结束时恢复；仅在验收中模拟确认对话框并在结束时撤销。备份临时文件路径打印到终端，截图、日志位于忽略提交的 `doc/verification-artifacts/`。强行结束进程时，需使用打印的备份恢复记录。

## 目录

| 路径 | 内容 |
| --- | --- |
| `miniprogram/pages/` | 首页、登记、任务、视频、考试、结果、完成、记录及明细 |
| `miniprogram/models/visit.ts` | 业务类型、输入校验、评分 |
| `miniprogram/data/catalog.ts` | 区域、培训方案、视频和题库 |
| `miniprogram/services/` | 本地存储事务、进度与页面展示数据 |
| `miniprogram/assets/` | 本地视频、插图及图标 |
| `tests/` | Node 测试，通过 tsx 执行 |
| `doc/` | 需求说明、参考图、实施计划及验收记录 |

## Demo 范围

短视频、题库和培训凭证均为流程演示材料。记录仅保存在当前设备；清除小程序存储会清除记录。旧 Demo 的逐人重复任务会按申请单、课程合并，并保留已有课程进度。十题旧缓存保留前五题答案、重新计算成绩；已完成的视频保留。

尚未接入身份认证、访客审批、真实课程、证件核验或 ASP.NET Core Web API。后续可替换 `services/store.ts` 的存储适配层并扩展课程目录。
