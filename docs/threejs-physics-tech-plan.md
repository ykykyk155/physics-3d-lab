# 初中物理 3D 可视化演示 · three.js 技术方案

版本基线：three r160+ / TypeScript / Vite。只依赖 three 包本体，不加载任何外部模型、HDR、字体文件，全部几何体程序化生成。

---

## 1. 渲染器与相机

```ts
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // 移动端 1.5
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
// 投影阴影全局关闭（2026-11-21 定案）：见「光照」，不配 shadowMap
```

- 相机：`PerspectiveCamera(45, w/h, 0.1, 200)`。每个实验注册一组 `cameraPreset { position, target }`，切换场景时用 `Vector3.lerp` + `controls.target.lerp` 在 600ms 内过渡，不做硬切。
- 光照：`HemisphereLight(0xffffff, 0x444466, 0.6)` + 主 `DirectionalLight`（**不 castShadow**）+ 一盏无阴影补光。阴影已全局关闭（`shadowMap.enabled = false`），主光只做照明，不配置 `shadow.*`。
- 环境反射：`RoomEnvironment` + `PMREMGenerator` 生成 envMap，给金属、玻璃材质用（棱镜、透镜、磁铁、镜面）。程序生成，不依赖 .hdr 文件。
- 层次表达：不渲染投影阴影（2026-11-21 定案，用户要求删掉所有影子）。前后/上下关系靠识别色明度分层、光照固有明暗、几何精确相切（轮底、底面贴地）。省掉 shadow pass 的 draw call 与阴影重建峰值帧。
- OrbitControls：`enableDamping = true`、`dampingFactor = 0.08`、`minDistance 2 / maxDistance 30`、`maxPolarAngle = Math.PI * 0.495`（防钻地）、`enablePan = false`（初中演示不需要平移，防迷路）。触摸：`touches.ONE = ROTATE`、`touches.TWO = DOLLY_ROTATE`。

## 2. 材质策略（纯几何体）

- 统一 `MeshStandardMaterial`；玻璃类（棱镜、透镜、水）用 `MeshPhysicalMaterial { transmission: 1, roughness: 0.05, ior: 1.5, thickness: 1 }`。transmission 会额外开一个 render target，只在光学模块启用；移动端降级为 `transparent: true, opacity: 0.35, roughness: 0.1`。
- 材质/几何全局复用池：`getMat(key, params)` / `getGeo(key, factory)` 带引用计数，切场景不销毁共享资源，避免重复编译 shader（shader 编译是切换卡顿的主因）。
- 光路、力矢量、标注线：用 `Line2 / LineMaterial`（addons，粗线且线宽像素级稳定，`LineBasicMaterial` 在多数平台 linewidth 恒为 1）。光束加 `AdditiveBlending`，`depthWrite: false`。
- 中文标注：`CSS2DRenderer` 输出 DOM 标签，不走 `TextGeometry`。理由：中文字体 json 动辄数 MB，且 TextGeometry 无法做可换行、可点击的标签。CSS2D 标签统一挂在 `labelRoot` 下，切场景时整层清空。
- 电流/粒子：`InstancedMesh`，一次 draw call 跑全部小球。
- 箭头：`ArrowHelper` 够用；需要粗箭头就 cone + cylinder 自建，共享几何。

## 3. 各模块几何构建思路

**力学**
- 斜面滑块：`PlaneGeometry` 旋转出斜面 + `BoxGeometry` 物块。受力分解用三支箭头按公式实时算：重力 `mg`、支持力 `mg·cosθ`、摩擦力 `μmg·cosθ`。μ 变化时同步改物块材质 roughness，视觉和数值一起变。
- 单摆：细 `CylinderGeometry` 作绳 + `SphereGeometry` 作球，`θ'' = -(g/L)·sinθ` 用固定步长 RK4 积分，`L` 与初始角可调。
- 弹簧振子：螺旋线用 `TubeGeometry`，参数变化时**只改 position attribute，不重建几何**（重建会掉帧）；振幅/频率驱动 `y = A·sin(ωt)`。
- 滑轮组：`TorusGeometry` 轮 + 绳用 `Line2` + 方块，绳长约束参数化计算物块位置。
- 浮力：半透明水面 + 物块，按排水体积实时算浸没深度，浮力箭头长度随之变化。
- 平抛/自由落体：轨迹用 `BufferGeometry` 预分配 512 个顶点池，`setDrawRange` 逐点增长，不 realloc。

**电学**
- 导线：`CatmullRomCurve3` + `TubeGeometry`，每种电路（串联/并联/电磁）预置一套曲线，切换用显隐 + 材质透明度过渡。
- 电流：沿曲线的实例小球，速度 ∝ I，`InstancedMesh.setMatrixAt` 每帧更新，超过 200 个改 `instanceMatrix.needsUpdate` 分帧写。
- 电磁：通电直导线磁场用同心 `TorusGeometry` 环 + 箭头；螺线管用螺旋 `TubeGeometry`，右手定则用箭头表示。
- 电表：CSS2D 数字 + 3D 表盘指针 `rotation.z` 映射量程。

**光学**
- 反射：平面镜用 `metalness: 1, roughness: 0.05` + envMap，光线按反射公式逐段算。
- 折射/色散：三棱镜用 `CylinderGeometry(radius, radius, h, 3)` 或三角形 `ExtrudeGeometry`；斯涅尔定律算折射方向，色散用 7 条不同颜色的 Line2 分角度射出。
- 凸透镜成像：`LatheGeometry` 旋转双凸剖面做透镜；三条特殊光线 + 薄透镜公式 `1/f = 1/u + 1/v`，u、f 可调，像的位置和大小实时更新（虚像用虚线 + 半透明）。
- 小孔成像：带孔遮光板 + 屏，光线用锥体半透明网格。

**声学**
- 声波：多层 `SphereGeometry` 缩放 + opacity 衰减模拟球面波；或用波纹平面 shader。
- 波形：`Line` 实时更新 y，振幅/频率直接改函数参数，同步频率计数。
- 音叉：两个 `BoxGeometry` 振臂做位移振动，振幅 ∝ 音量。
- 回声/声速：距离标尺 + 往返光点动画，时间 ∝ 距离。

## 4. 场景切换与 GPU 资源释放

```ts
function disposeScene(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.geometry?.dispose();                        // 共享池里的走引用计数，不在此处 dispose
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      for (const k in mat) {                       // 释放所有贴图槽位
        const v = (mat as any)[k];
        if (v && v.isTexture) v.dispose();
      }
      mat.dispose();
    }
  });
}
```

- `SceneManager`：`register(id, factory)` 懒加载工厂，首次进入才构建；同一时刻只保留一个活动场景 + 一个"上一场景"用于淡出。
- 切换流程：全屏 DOM 遮罩淡入（150ms）→ 建新场景、应用相机 preset → 淡出（150ms）→ 300ms 后 dispose 旧场景。切场景时 `labelRoot.innerHTML = ''`，`controls.dispose()` 后重建或复用同一 controls 实例（推荐复用，只换 target）。
- 共享资源池不销毁，用 `refCount` 计数；页面卸载时统一 `renderer.dispose()` + `forceContextLoss()`。
- 监听 `webglcontextlost`：`preventDefault()` 并提示"渲染上下文已丢失，点击恢复"，`webglcontextrestored` 后重建场景。

## 5. 参数 → 物理量 → 画面的更新循环

```ts
let acc = 0;
const FIXED = 1 / 120;
function loop() {
  const dt = Math.min(clock.getDelta(), 1 / 30);  // 切标签页回来防跳变
  if (dirty) { applyParams(currentScene); dirty = false; }  // 每帧最多一次
  if (currentScene.sim) {
    acc += dt;
    while (acc >= FIXED) { currentScene.sim.step(FIXED); acc -= FIXED; }
  }
  controls.update();
  renderer.render(scene, camera);
  css2dRenderer.render(scene, camera);
  requestAnimationFrame(loop);
}
```

- 参数状态：一个轻量 store（`zustand/vanilla` 或自写 `EventEmitter`），滑杆 `input` 事件只 `store.set(key, v)` 并置 `dirty = true`，**不做 debounce**（debounce 会让拖动感觉延迟），靠 rAF 合并。
- 分两类更新：解析型（斜面受力、透镜成像、电阻分流）参数变了直接重算，无需积分；动态型（单摆、弹簧、粒子）走固定步长积分，保证不同帧率下物理一致。
- 数值显示与 3D 更新读同一个 store，UI 数字和画面永远同步，不出现两套数据源。
- 参数范围在场景定义里声明式配置：`{ key:'mu', label:'摩擦系数', min:0, max:1, step:0.01, unit:'' }`，左侧面板由配置自动生成，新增实验零 UI 代码。

## 6. 性能

- draw call：静态几何用 `BufferGeometryUtils.mergeGeometries` 合并；重复元素用 `InstancedMesh`；目标 `renderer.info.render.calls < 100`，`triangles < 200k`。
- 分段数：球 24–32、圆柱 16–24、Tube 曲线 64 段、环 32 段。够圆就停，不要 64/128。
- 阴影：**全局关闭**（`renderer.shadowMap.enabled = false`，2026-11-21 定案），不做 shadow pass，无阴影重建帧、无泄漏面。
- 像素比上限 2（移动端 1.5）；`ResizeObserver` + rAF 防抖处理视区尺寸变化。
- 页面不可见时 `cancelAnimationFrame` 暂停；`IntersectionObserver` 判断视区是否在屏。
- 默认不开后处理（bloom/SSAO）；如需辉光，只在桌面端开且分辨率减半。
- 目标：桌面 60fps、移动端 ≥30fps；首屏 JS 增量 < 200KB gzip（three 按 addons 路径按需引入，别 `import * as THREE` 之外再整包引 addons）。

## 7. 与左侧 UI 的边界

- 3D 侧只暴露三个方法：`mount(container)`、`setExperiment(id)`、`setParams(partial)`；UI 侧不直接碰 scene/object。
- 3D 侧通过回调 `onFrame({ measurements })` 把需要显示的实时物理量（速度、电流、像距……）抛回 UI，UI 只负责渲染数字。
- 容器尺寸由 CSS 决定，3D 侧只监听容器 resize，不参与布局。
