# 25 个实验 · 性能基准表（实物化后）

> 采集：无头 Edge + SwiftShader，3D 取景区 1100×700，pixelRatio=1。红线：draw calls ≤60、triangles <200k（稳态帧判定）。
> 下表为实物化铺开后的稳态 calls / triangles（切换完成、暂停播放、连采中位数）；播放峰值与三轮纹理/内存由 acceptance.mjs 复测另附。
> A2/A7 接入 ammo 刚体后于 2026-11-21 用 bench.mjs 全量重测（25 场景同一轮、同一口径，每 5 个重启浏览器）。

| # | id | module | 稳态 calls | triangles | 判定(≤60 / <200k) |
|---|---|---|---|---|---|
| 1 | A1-incline-speed | mechanics | 18 | 1,746 | ✅ |
| 2 | A2-newton-first | mechanics | 18 | 1,856 | ✅ |
| 3 | A3-friction | mechanics | 21 | 2,068 | ✅ |
| 4 | A4-liquid-pressure | mechanics | 12 | 862 | ✅ |
| 5 | A5-buoyancy | mechanics | 15 | 2,702 | ✅ |
| 6 | A6-energy | mechanics | 8 | 1,044 | ✅ |
| 7 | A7-lever | mechanics | 9 | 2,276 | ✅ |
| 8 | D1-series-parallel | electricity | 24 | 12,068 | ✅ |
| 9 | D2-resistance-factor | electricity | 13 | 4,296 | ✅ |
| 10 | D3-rheostat-lamp | electricity | 9 | 11,388 | ✅ |
| 11 | D4-ohm-law | electricity | 37 | 13,006 | ✅ |
| 12 | D5-power-joule | electricity | 17 | 11,872 | ✅ |
| 13 | D6-magnet-solenoid | electricity | 13 | 2,102 | ✅ |
| 14 | D7-motor-generator | electricity | 15 | 2,868 | ✅ |
| 15 | B1-pinhole | optics | 10 | 940 | ✅ |
| 16 | B2-reflection | optics | 11 | 222 | ✅ |
| 17 | B3-plane-mirror | optics | 16 | 4,968 | ✅ |
| 18 | B4-refraction | optics | 10 | 918 | ✅ |
| 19 | B5-convex-lens | optics | 20 | 2,690 | ✅ |
| 20 | C1-sound-medium | acoustics | 11 | 5,532 | ✅ |
| 21 | C2-sound-chars | acoustics | 6 | 840 | ✅ |
| 22 | C3-noise-control | acoustics | 24 | 3,372 | ✅ |
| 23 | F1-melting-curve | thermal | 25 | 5,654 | ✅ |
| 24 | F2-boiling | thermal | 12 | 9,380 | ✅ |
| 25 | F3-heat-engine | thermal | 37 | 10,716 | ✅ |

稳态最大 calls = **37**（D4-ohm-law、F3-heat-engine）；最大 triangles = **13,006**（D4-ohm-law）。全部 ≤60 / <200k。
