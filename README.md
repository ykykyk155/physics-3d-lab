# 初中物理 3D 可视化演示

25 个可交互的初中物理实验场景（力学 / 光学 / 声学 / 电学 / 热学），纯静态、离线自包含，基于 three.js r187 本地包。

线上地址：`https://<用户名>.github.io/<仓库名>/`（启用 Pages 后生效）

## 怎么发布

改完代码后，一条命令：

```
powershell -NoProfile -ExecutionPolicy Bypass -File tools/publish.ps1 -Message "这次改了什么"
```

它会依次做四件事：

1. `make-release.ps1` —— 生成 `release/physics-3d-lab/` 发布包，逐个点名 19 个必需文件，缺一个就拒绝出包
2. `verify-release.mjs` —— 起本地服务器 + 无头浏览器，逐个切换 25 个场景，断言 0 个 404、0 个报错、绘制预算不超红线；**不通过就不推送**
3. `git commit`
4. 推送 `main`，并把发布目录以 `gh-pages` 分支强推，GitHub Pages 自动重新发布

加 `-SkipVerify` 可跳过浏览器验收（只建议在改文档时用）。

## 目录

| 路径 | 作用 |
|---|---|
| `docs/app/index.html` | 页面外壳：面板自动生成、时间条、播放条 |
| `docs/app/experiments.js` | 25 个实验的注册表 |
| `docs/app/exp/` | 各模块实现（common / props / mechanics / optics / acoustics / electricity / thermal） |
| `docs/app/vendor/` | three.js r187 本地包与所需 addons |
| `docs/app/data/experiments.json` | 实验清单数据：参数、快照、时间轴配置 |
| `docs/*.md`、`*.docx` | 开发提示词、技术方案、器材对照表等文档 |
| `release/physics-3d-lab/` | 构建产物（会被推送到 gh-pages 分支） |
| `tools/` | 打包、验收、发布脚本 |

## 本地预览

```
cd docs
python -m http.server 8765
```

打开 `http://127.0.0.1:8765/app/index.html`。

**不能双击 `index.html` 打开** —— ES Module 不允许 `file://` 协议加载。

## 关键约定（改代码前请先看）

- `duration` 是**时间轴秒数**，不是墙钟秒数；必须是 getter，随参数实时变化。
- 三种零时长要分清：`static`（本来就没有过程，恒为 0）、`branch`（参数导致的零，换参数必须能变非零）、理想光滑的 `Infinity`（禁拖时间条）。
- 置灰文案不硬编码，`branch` 场景取 JSON 里的 `zeroHint`。
- 玻璃用 `opacity`，不用 `transmission`；阴影用 `PCFShadowMap`（r187 已移除 `PCFSoftShadowMap`）。
- 卡片文字溢出改 2 列 + 内部滚动，**不缩字号**。
- 只有结构性主体 `castShadow`，描点、粒子、装饰一律 false。
- Windows 上改中文源码只能用 `read`/`write`/`edit`，不要用 `Get-Content`/`Set-Content`（PS 5.1 按 ANSI 读写会写坏 UTF-8）。