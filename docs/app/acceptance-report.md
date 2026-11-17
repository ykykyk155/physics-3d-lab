# 外壳侧整体验收报告

时间：2026-11-17T06:18:03.325Z
环境：headless Chromium(Edge) + SwiftShader，1280×900 → 390×844

## 结论总览

| 验收项 | 标准 | 结果 |
|---|---|---|
| ① 移动端抽屉 | <768px 面板变底部抽屉，把手可见、可展开，3D 区可拖拽 | handle=PASS 展开位移=matrix(1, 0, 0, 1, 0, 0) 拖拽位移=6.348 → PASS |
| ② 内存增幅(3轮×25场景) | ≤10% | -2.74% → PASS |
| ② WebGL 泄漏告警 | 控制台无泄漏类告警（性能提示不计） | 泄漏类 0 条、性能提示 4 条 → PASS |
| ③ shader 重编译 | programs.length 切换后不增长 | R1=10 R2=10 R3=10（轮内峰值 10）→ PASS |
| ③ 共享资源不重建 | geometries/textures 三轮后不增长(容差2%) | geo 34→34 PASS；tex 3→3 PASS |
| ④ 绘制预算（props 实物化后复核） | 稳态 calls ≤60、tris <200k | 最高 48 calls / 14,188 tris → PASS |
## 明细

- UI 布线抽查：Tab 点击切模块 → PASS（electricity）；卡片点击切场景 → PASS
- 稳态 draw calls（切换后 ≥800ms 采样，旧场景已释放）：最高 48 calls / 14,188 tris

| 实验 | calls | triangles |
|---|---|---|
| A1-incline-speed | 18 | 1746 |
| A2-newton-first | 15 | 1836 |
| A3-friction | 21 | 2068 |
| A4-liquid-pressure | 12 | 862 |
| A5-buoyancy | 15 | 2702 |
| A6-energy | 8 | 1044 |
| A7-lever | 9 | 2276 |
| D1-series-parallel | 20 | 11252 |
| D2-resistance-factor | 13 | 4296 |
| D3-rheostat-lamp | 9 | 11388 |
| D4-ohm-law | 37 | 13006 |
| D5-power-joule | 17 | 11872 |
| D6-magnet-solenoid | 13 | 2102 |
| D7-motor-generator | 15 | 2868 |
| B1-pinhole | 10 | 940 |
| B2-reflection | 11 | 222 |
| B3-plane-mirror | 16 | 4968 |
| B4-refraction | 9 | 198 |
| B5-convex-lens | 20 | 2690 |
| C1-sound-medium | 11 | 5532 |
| C2-sound-chars | 6 | 840 |
| C3-noise-control | 22 | 3348 |
| F1-melting-curve | 25 | 5654 |
| F2-boiling | 12 | 9380 |
| F3-heat-engine | 48 | 14188 |

## 控制台告警

泄漏类（判 FAIL）：（无）

性能提示（不计入判定）4 条：
- [.WebGL-0x3da400083400]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
- [.WebGL-0x3da400083400]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
- [.WebGL-0x3da400083400]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels
- [.WebGL-0x3da400083400]GL Driver Message (OpenGL, Performance, GL_CLOSE_PATH_NV, High): GPU stall due to ReadPixels (this message will no longer repeat)
