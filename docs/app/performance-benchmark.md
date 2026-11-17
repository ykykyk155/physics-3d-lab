# 25 个实验 · 性能基准表（实物化后）

> 采集：无头 Edge + SwiftShader，3D 取景区 1100×700，pixelRatio=1。红线：draw calls ≤60、triangles <200k（稳态帧判定）。
> 下表为实物化铺开后的稳态 calls / triangles（切换完成、暂停播放、连采中位数）；播放峰值与三轮纹理/内存由 acceptance.mjs 复测另附。

| # | id | module | 稳态 calls | triangles | 判定(≤60 / <200k) |
|---|---|---|---|---|---|
| 1 | A1-incline-speed | mechanics | 18 | 1,746 | ✅ |
| 2 | A2-newton-first | mechanics | 13 | 1,716 | ✅ |
| 3 | A3-friction | mechanics | 21 | 2,068 | ✅ |
| 4 | A4-liquid-pressure | mechanics | 12 | 862 | ✅ |
| 5 | A5-buoyancy | mechanics | 15 | 2,702 | ✅ |
| 6 | A6-energy | mechanics | 8 | 1,044 | ✅ |
| 7 | A7-lever | mechanics | 8 | 1,976 | ✅ |
| 8 | D1-series-parallel | electricity | 24 | 12,068 | ✅ |
| 9 | D2-resistance-factor | electricity | 10 | 3,900 | ✅ |
| 10 | D3-rheostat-lamp | electricity | 9 | 11,388 | ✅ |
| 11 | D4-ohm-law | electricity | 23 | 12,076 | ✅ |
| 12 | D5-power-joule | electricity | 13 | 1,344 | ✅ |
| 13 | D6-magnet-solenoid | electricity | 13 | 4,212 | ✅ |
| 14 | D7-motor-generator | electricity | 9 | 328 | ✅ |
| 15 | B1-pinhole | optics | 10 | 940 | ✅ |
| 16 | B2-reflection | optics | 11 | 222 | ✅ |
| 17 | B3-plane-mirror | optics | 16 | 4,968 | ✅ |
| 18 | B4-refraction | optics | 9 | 198 | ✅ |
| 19 | B5-convex-lens | optics | 20 | 2,690 | ✅ |
| 20 | C1-sound-medium | acoustics | 15 | 8,412 | ✅ |
| 21 | C2-sound-chars | acoustics | 6 | 840 | ✅ |
| 22 | C3-noise-control | acoustics | 19 | 1,976 | ✅ |
| 23 | F1-melting-curve | thermal | 16 | 3,826 | ✅ |
| 24 | F2-boiling | thermal | 12 | 9,380 | ✅ |
| 25 | F3-heat-engine | thermal | 35 | 10,706 | ✅ |

稳态最大 calls = **35**（F3-heat-engine）；最大 triangles = **12,076**（D4-ohm-law）。全部 ≤60 / <200k。
