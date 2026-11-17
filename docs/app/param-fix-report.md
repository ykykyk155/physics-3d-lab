# 参数联动失效清单与修复记录

> 结论先行：客户端工程师已确认 **116/116 控件都送达 `onParam`**，所以问题全在实验侧。
> 本轮按源码逐个核对每个参数「是否被 `onParam/recompute/step` 真正读取并改变画面」，
> 修掉 **19 个真实失效/半失效参数**，其余动态参数经「播放后」复测全部有效。修复后逐参数复测 **25/25 通过**，25 场景连续切换控制台 **0 报错**。

## 一、判定口径

- **读取**：源码里是否出现 `this.p.<id>` 或 `onParam` 里 `k === '<id>'` 分支。
- **改变画面**：改动前后快照是否有差异（对象 position/scale/quaternion/几何参数/材质颜色·发光·透明度/InstancedMesh 矩阵 + 读数卡文本 + 3D 标签文本）。
- **动态参数**（只影响随时间演化，如阻尼、转速、通电时间）：暂停态本来就无差异，**必须播放 1.5s 后再比**；本表已按此复核，未把动态参数误判为失效。

## 二、真实失效参数与修复（19 项）

| 实验 id | 参数 id | 原是否被读取 | 应改变的对象/读数 | 修复位置 |
|---|---|---|---|---|
| A2-newton-first | mass | 只用于重置判定，画面不变 | 物块随质量放大（速度/距离不变→破「重的快」） | `mechanics.js` A2.recompute（block.scale） |
| A4-liquid-pressure | orient | **完全未读取** | 探头指针绕竖直轴转、Δh 不变 | `mechanics.js` A4.recompute（probeArm.rotation.y） |
| A4-liquid-pressure | vessel | **完全未读取** | 容器上下半径（柱/上宽下窄/上窄下宽） | `mechanics.js` A4.buildVessel |
| A5-buoyancy | submerge | 读取但被物体尺寸 clamp，上半程无反应 | 按物块高度比例映射，0–30cm 全程对应 0–100% 浸没 | `mechanics.js` A5.recompute/layout（subFrac） |
| A6-energy | height | 读取但被 angle 上限永久压制 | 释放高度→摆角（height 与 angle 取「最后改动者」） | `mechanics.js` A6.onParam/recompute（_src） |
| B1-pinhole | hole | 算了 `d` 却未使用 | 光圈大小、像亮度/弥散 | `optics.js` B1.buildAperture/recompute |
| B1-pinhole | shape | **完全未读取** | 光圈形状（圆/方/三角） | `optics.js` B1.buildAperture |
| B3-plane-mirror | altHeight | **完全未读取** | 镜后替代蜡烛高度（与虚像等高对照） | `optics.js` B3.recompute（alt） |
| B4-refraction | scene | **完全未读取** | 情景道具显隐：筷子/鱼/光纤 | `optics.js` B4.recompute（chop/fish/fiber） |
| B5-convex-lens | cover | **完全未读取** | 遮半透镜遮板 + 像变暗 | `optics.js` B5.recompute（coverPlate/dim） |
| B5-convex-lens | source | **完全未读取** | 光源形状 F/蜡烛/箭头 | `optics.js` B5.recompute（srcShape） |
| C1-sound-medium | temp | **完全未读取** | 空气声速 v≈331+0.6T | `acoustics.js` C1.recompute |
| C2-sound-chars | ruler | **完全未读取** | 钢尺伸出长度 + 基频 f≈v/(4L) | `acoustics.js` C2.build/recompute |
| C2-sound-chars | pipe | **完全未读取** | 空气柱长度 + 基频 f≈v/(2L) | `acoustics.js` C2.build/recompute |
| C3-noise-control | stage | **完全未读取** | 控制环节高亮环落点（声源/路径/人耳） | `acoustics.js` C3.recompute（hl） |
| D3-rheostat-lamp | rating | 读取，但默认滑块满位时 R 恒≈0，改规格无感 | 线圈长度随规格变 + 标签显示规格 | `electricity.js` D3.recompute（coil.scale.x） |
| D5-power-joule | time | **完全未读取** | Q总=P·t；水柱预热高度、播放升温速度 | `electricity.js` D5.recompute/step（timeScale） |
| D6-magnet-solenoid | dir | 算了 `dir` 却未使用、`this.dir` 未赋值 | 磁感线颜色 + 小磁针同时反向 | `electricity.js` D6.drawField/drawNeedles |
| F3-heat-engine | rpm | 读取，但探针采样落在整数圈上造成假阴性 | 曲轴/活塞/飞轮随转速转动（播放态） | 无改动，已复测通过 |

## 三、动态参数复测（暂停态无差异属正常，播放后有效）

以下参数只在「播放」时体现，逐一定点复测确认有效，不是 bug：

- A3-friction · pull —— 不同拉动速度，物块/弹簧秤/箭头位置不同
- A6-energy · damping —— 阻尼大→振幅衰减快（Ek/Ep 与摆球位置）
- D2-resistance-factor · temp —— 温度→R→读数 r 变化（0.57→0.66）
- D7-motor-generator · current / speed / moveDir / commutator —— 线圈转动角度、导体运动方向
- C2-sound-chars · amp / wave —— 波形振幅、波形形状
- F2-boiling · volume / flame —— 升温速率、沸腾时刻、气泡
- F3-heat-engine · rpm —— 曲轴角（90°→596°）、活塞相位

## 四、复测证据

- 逐参数定点复测（两取值快照对比）：**25/25 通过，0 仍失效**（`docs/app/verify-fixes.mjs`）。
- 25 场景连续切换：**控制台 0 报错**。
- 25 宫格总览、基准表已按最新代码重出。
