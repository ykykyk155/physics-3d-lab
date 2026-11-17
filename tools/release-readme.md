# 初中物理 3D 可视化演示 · 部署说明

纯静态站点，无后端、无需构建。整个目录原样上传即可。

## 一、在另一台电脑上用（不联网也行）

**双击 `启动实验.bat`。**

会弹一个黑色窗口，几秒后浏览器自动打开页面。用完关掉那个黑窗口就停了。

不需要装 Python、不需要装 Node、不需要联网，只要那台电脑是 Windows——PowerShell 是系统自带的。

> 为什么不能直接双击 `index.html`？浏览器禁止 `file://` 加载 ES Module，直接双击只会看到一片空白。这个 bat 就是替你起了个本地服务器。

如果 Windows 弹出防火墙提示，选允许。它只监听本机 `127.0.0.1`，局域网外访问不到。

端口默认 8931，被占用时会直接报错退出，改 `start-lab.ps1` 里的 `-Port` 即可。

## 二、放到公网（手机也能打开）

以下任选，整个目录原样上传，路径全是相对的，放子目录（如 `/demo/`）也能正常工作。

### Netlify（最快）

打开 https://app.netlify.com/drop ，把这个文件夹拖进去，几秒后得到公网链接。

## Vercel

```
npm i -g vercel
vercel --prod
```

或把文件夹拖到 vercel.com/new。

## 阿里云 OSS / 腾讯云 COS

建 Bucket → 开启「静态网站托管」→ 上传本目录全部文件 → 默认首页填 `index.html`。国内访问速度最好。

## GitHub Pages

把本目录内容推到仓库（如 `gh-pages` 分支）→ Settings → Pages → 选该分支根目录。

## 自有服务器（Nginx）

拷贝到 `/var/www/physics3d`，然后：

```
location / { try_files $uri $uri/ /index.html; }
```

## 目录结构

```
启动实验.bat            双击即用的本地启动器（Windows）
start-lab.ps1           启动器的实现：127.0.0.1 静态服务器
index.html              页面外壳：面板生成、时间条、播放条
experiments.js          25 个实验的注册表
exp/                    各模块实验实现（力学/光学/声学/电学/热学）
  common.js  props.js  mechanics.js  optics.js
  acoustics.js  electricity.js  thermal.js
vendor/                 three.js r187 本地包 + 所需 addons
data/experiments.json   实验清单数据（页面用它渲染面板与时间轴配置）
```

## 注意

1. 不能双击 `index.html` —— ES Module 不允许 `file://` 加载，会白屏。要本地看就双击 `启动实验.bat`。
2. 所有路径都是相对路径，放在子目录（如 `/demo/`）也能正常工作。
3. 浏览器需支持 WebGL2：Chrome / Edge 100+、Firefox 100+、Safari 15.4+。
4. 页面完全离线自包含，不请求任何 CDN 或外部接口。