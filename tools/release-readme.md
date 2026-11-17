# 初中物理 3D 可视化演示 · 部署说明

纯静态站点，无后端、无需构建。整个目录原样上传即可。

## Netlify（最快，推荐）

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
index.html              页面外壳：面板生成、时间条、播放条
experiments.js          25 个实验的注册表
exp/                    各模块实验实现（力学/光学/声学/电学/热学）
  common.js  props.js  mechanics.js  optics.js
  acoustics.js  electricity.js  thermal.js
vendor/                 three.js r187 本地包 + 所需 addons
data/experiments.json   实验清单数据（页面用它渲染面板与时间轴配置）
```

## 注意

1. 必须用 http(s) 访问，不能双击 `index.html` —— ES Module 不允许 `file://` 加载。
2. 所有路径都是相对路径，放在子目录（如 `/demo/`）也能正常工作。
3. 浏览器需支持 WebGL2：Chrome / Edge 100+、Firefox 100+、Safari 15.4+。
4. 页面完全离线自包含，不请求任何 CDN 或外部接口。