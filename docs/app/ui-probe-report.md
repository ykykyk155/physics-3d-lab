# UI→引擎通路探针报告

时间：2026-11-22T04:08:44.197Z
方法：包裹每个实验的 exp.onParam 计数；滑杆用原生 input 事件、枚举用真实点击驱动；每控件触发后等 2 帧再读计数。

| 实验 | 控件 | 类型 | onParam 送达 | 判定 |
|---|---|---|---|---|
| A1-incline-speed | theta | number | 1（store=5） | ✅ |
| A1-incline-speed | length | number | 1（store=0.5） | ✅ |
| A1-incline-speed | mu | number | 1（store=0） | ✅ |
| A1-incline-speed | mass | number | 1（store=0.1） | ✅ |
| A1-incline-speed | duration 快照校验 | getter | actual=0.9778712455346528 vs 快照 0.98（±10%） | ✅ |
| A1-incline-speed | 置灰文案=zeroHint | branch | 期望「当前静止，小车不下滑（μ ≥ tanθ，改大倾角或减小摩擦即有过程）」实际「当前静止，小车不下滑（μ ≥ tanθ，改大倾角或减小摩擦即有过程）」 | ✅ |
| A1-incline-speed | seek 拖动一致性 | 0.36→0.71→0.36 | simTime 回位=true、无NaN=true | ✅ |
| A1-incline-speed | zeroKind=branch | 默认 d0=0.9778712455346528 → 触发后 d1=0 | | ✅ 0↔非0 互斥成立 |
| A1-incline-speed | 统计面板 | readouts() | 6/6 项渲染一致、无NaN | ✅ |
| A1-incline-speed | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 0.25×（期望 0.25×） | ✅ |
| A1-incline-speed | 表实门禁 | duration | 有时长=true snap=true kind=branch | ✅ |
| A2-newton-first | surface | enum | 1（store=0.6） | ✅ |
| A2-newton-first | height | number | 1（store=0.05） | ✅ |
| A2-newton-first | mass | number | 1（store=0.1） | ✅ |
| A2-newton-first | duration 快照校验 | getter | actual=2.9 vs 快照 2.9（±10%） | ✅ |
| A2-newton-first | seek 拖动一致性 | 1.07→2.12→1.07 | simTime 回位=true、无NaN=true | ✅ |
| A2-newton-first | 统计面板 | readouts() | 6/6 项渲染一致、无NaN | ✅ |
| A2-newton-first | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 0.5×（期望 0.5×） | ✅ |
| A2-newton-first | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| A3-friction | normal | number | 1（store=0.5） | ✅ |
| A3-friction | mu | number | 1（store=0.1） | ✅ |
| A3-friction | area | enum | 1（store=small） | ✅ |
| A3-friction | pull | number | 1（store=0.05） | ✅ |
| A3-friction | duration 快照校验 | getter | actual=12 vs 快照 12（±10%） | ✅ |
| A3-friction | seek 拖动一致性 | 4.44→8.76→4.44 | simTime 回位=true、无NaN=true | ✅ |
| A3-friction | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| A3-friction | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| A3-friction | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| A4-liquid-pressure | depth | number | 1（store=30） | ✅ |
| A4-liquid-pressure | liquid | enum | 1（store=1） | ✅ |
| A4-liquid-pressure | orient | number | 1（store=0） | ✅ |
| A4-liquid-pressure | vessel | enum | 1（store=cyl） | ✅ |
| A4-liquid-pressure | zeroKind=static | 参数极值下恒 0 | | ✅ |
| A4-liquid-pressure | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| A4-liquid-pressure | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| A4-liquid-pressure | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| A5-buoyancy | volume | number | 1（store=500） | ✅ |
| A5-buoyancy | rhoObj | number | 1（store=8） | ✅ |
| A5-buoyancy | rhoLiquid | number | 1（store=1.3） | ✅ |
| A5-buoyancy | submerge | number | 1（store=30） | ✅ |
| A5-buoyancy | hollow | enum | 1（store=solid） | ✅ |
| A5-buoyancy | ballast | number | 1（store=0） | ✅ |
| A5-buoyancy | zeroKind=static | 参数极值下恒 0 | | ✅ |
| A5-buoyancy | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| A5-buoyancy | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| A5-buoyancy | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| A6-energy | mass | number | 1（store=0.05） | ✅ |
| A6-energy | height | number | 1（store=0.05） | ✅ |
| A6-energy | pendLen | number | 1（store=0.2） | ✅ |
| A6-energy | angle | number | 1（store=5） | ✅ |
| A6-energy | damping | number | 1（store=0.3） | ✅ |
| A6-energy | duration 快照校验 | getter | actual=6.21874067737446 vs 快照 6.22（±10%） | ✅ |
| A6-energy | seek 拖动一致性 | 2.3→4.54→2.3 | simTime 回位=true、无NaN=true | ✅ |
| A6-energy | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| A6-energy | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| A6-energy | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| A7-lever | f1 | number | 1（store=0.5） | ✅ |
| A7-lever | l1 | number | 1（store=1） | ✅ |
| A7-lever | f2 | number | 1（store=0.5） | ✅ |
| A7-lever | l2 | number | 1（store=1） | ✅ |
| A7-lever | duration 快照校验 | getter | actual=0 vs 快照 0（±10%） | ✅ |
| A7-lever | 置灰文案=zeroHint | branch | 期望「当前平衡，杠杆静止（改动任一参数使力矩不等即转动）」实际「当前平衡，杠杆静止（改动任一参数使力矩不等即转动）」 | ✅ |
| A7-lever | zeroKind=branch | 默认 d0=0 → 触发后 d1=2.2 | | ✅ 0↔非0 互斥成立 |
| A7-lever | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| A7-lever | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 0.5×（期望 0.5×） | ✅ |
| A7-lever | 表实门禁 | duration | 有时长=false snap=true kind=branch | ✅ |
| D1-series-parallel | voltage | number | 1（store=1.5） | ✅ |
| D1-series-parallel | r1 | number | 1（store=5） | ✅ |
| D1-series-parallel | r2 | number | 1（store=5） | ✅ |
| D1-series-parallel | mode | enum | 1（store=parallel） | ✅ |
| D1-series-parallel | switch | enum | 1（store=off） | ✅ |
| D1-series-parallel | duration 快照校验 | getter | actual=4 vs 快照 4（±10%） | ✅ |
| D1-series-parallel | seek 拖动一致性 | 1.48→2.92→1.48 | simTime 回位=true、无NaN=true | ✅ |
| D1-series-parallel | 统计面板 | readouts() | 6/6 项渲染一致、无NaN | ✅ |
| D1-series-parallel | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| D1-series-parallel | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| D2-resistance-factor | len | number | 1（store=100） | ✅ |
| D2-resistance-factor | area | number | 1（store=4） | ✅ |
| D2-resistance-factor | mat | enum | 1（store=1.1） | ✅ |
| D2-resistance-factor | temp | number | 1（store=100） | ✅ |
| D2-resistance-factor | strands | number | 1（store=1） | ✅ |
| D2-resistance-factor | zeroKind=static | 参数极值下恒 0 | | ✅ |
| D2-resistance-factor | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| D2-resistance-factor | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| D2-resistance-factor | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| D3-rheostat-lamp | wiper | number | 1（store=100） | ✅ |
| D3-rheostat-lamp | rating | enum | 1（store=20） | ✅ |
| D3-rheostat-lamp | voltage | number | 1（store=6） | ✅ |
| D3-rheostat-lamp | wiring | enum | 1（store=correct） | ✅ |
| D3-rheostat-lamp | zeroKind=static | 参数极值下恒 0 | | ✅ |
| D3-rheostat-lamp | 统计面板 | readouts() | 4/4 项渲染一致、无NaN | ✅ |
| D3-rheostat-lamp | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| D3-rheostat-lamp | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| D4-ohm-law | voltage | number | 1（store=6） | ✅ |
| D4-ohm-law | rfix | enum | 1（store=10） | ✅ |
| D4-ohm-law | graph | enum | 1（store=iu） | ✅ |
| D4-ohm-law | dut | enum | 1（store=resistor） | ✅ |
| D4-ohm-law | zeroKind=static | 参数极值下恒 0 | | ✅ |
| D4-ohm-law | 统计面板 | readouts() | 4/4 项渲染一致、无NaN | ✅ |
| D4-ohm-law | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| D4-ohm-law | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| D5-power-joule | voltage | number | 1（store=1.5） | ✅ |
| D5-power-joule | r | number | 1（store=5） | ✅ |
| D5-power-joule | time | number | 1（store=0） | ✅ |
| D5-power-joule | ra | number | 1（store=5） | ✅ |
| D5-power-joule | rb | number | 1（store=5） | ✅ |
| D5-power-joule | link | enum | 1（store=parallel） | ✅ |
| D5-power-joule | duration 快照校验 | getter | actual=180 vs 快照 180（±10%） | ✅ |
| D5-power-joule | seek 拖动一致性 | 66.6→131.4→66.6 | simTime 回位=true、无NaN=true | ✅ |
| D5-power-joule | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| D5-power-joule | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| D5-power-joule | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| D6-magnet-solenoid | layout | enum | 1（store=bar） | ✅ |
| D6-magnet-solenoid | current | number | 1（store=3） | ✅ |
| D6-magnet-solenoid | turns | number | 1（store=200） | ✅ |
| D6-magnet-solenoid | core | enum | 1（store=air） | ✅ |
| D6-magnet-solenoid | dir | enum | 1（store=1） | ✅ |
| D6-magnet-solenoid | needles | number | 1（store=12） | ✅ |
| D6-magnet-solenoid | zeroKind=static | 参数极值下恒 0 | | ✅ |
| D6-magnet-solenoid | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| D6-magnet-solenoid | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| D6-magnet-solenoid | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| D7-motor-generator | mode | enum | 1（store=cut） | ✅ |
| D7-motor-generator | current | number | 1（store=0） | ✅ |
| D7-motor-generator | field | number | 1（store=0.1） | ✅ |
| D7-motor-generator | speed | number | 1（store=0） | ✅ |
| D7-motor-generator | moveDir | enum | 1（store=along） | ✅ |
| D7-motor-generator | commutator | enum | 1（store=off） | ✅ |
| D7-motor-generator | duration 快照校验 | getter | actual=9 vs 快照 9（±10%） | ✅ |
| D7-motor-generator | seek 拖动一致性 | 3.33→6.57→3.33 | simTime 回位=true、无NaN=true | ✅ |
| D7-motor-generator | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| D7-motor-generator | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| D7-motor-generator | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| B1-pinhole | objDist | number | 1（store=50） | ✅ |
| B1-pinhole | screenDist | number | 1（store=50） | ✅ |
| B1-pinhole | hole | number | 1（store=10） | ✅ |
| B1-pinhole | shape | enum | 1（store=circle） | ✅ |
| B1-pinhole | zeroKind=static | 参数极值下恒 0 | | ✅ |
| B1-pinhole | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| B1-pinhole | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| B1-pinhole | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| B2-reflection | incidence | number | 1（store=80） | ✅ |
| B2-reflection | plane | number | 1（store=0） | ✅ |
| B2-reflection | kind | enum | 1（store=specular） | ✅ |
| B2-reflection | zeroKind=static | 参数极值下恒 0 | | ✅ |
| B2-reflection | 统计面板 | readouts() | 4/4 项渲染一致、无NaN | ✅ |
| B2-reflection | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| B2-reflection | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| B3-plane-mirror | objDist | number | 1（store=20） | ✅ |
| B3-plane-mirror | tilt | number | 1（store=90） | ✅ |
| B3-plane-mirror | altHeight | number | 1（store=10） | ✅ |
| B3-plane-mirror | screen | enum | 1（store=off） | ✅ |
| B3-plane-mirror | zeroKind=static | 参数极值下恒 0 | | ✅ |
| B3-plane-mirror | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| B3-plane-mirror | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| B3-plane-mirror | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| B4-refraction | incidence | number | 1（store=85） | ✅ |
| B4-refraction | pair | enum | 1（store=air-glass） | ✅ |
| B4-refraction | scene | enum | 1（store=laser） | ✅ |
| B4-refraction | zeroKind=static | 参数极值下恒 0 | | ✅ |
| B4-refraction | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| B4-refraction | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| B4-refraction | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| B5-convex-lens | focal | number | 1（store=30） | ✅ |
| B5-convex-lens | objDist | number | 1（store=60） | ✅ |
| B5-convex-lens | aperture | number | 1（store=10） | ✅ |
| B5-convex-lens | cover | enum | 1（store=off） | ✅ |
| B5-convex-lens | source | enum | 1（store=F） | ✅ |
| B5-convex-lens | zeroKind=static | 参数极值下恒 0 | | ✅ |
| B5-convex-lens | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| B5-convex-lens | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| B5-convex-lens | 表实门禁 | duration | 有时长=false snap=false kind=static | ✅ |
| C1-sound-medium | medium | enum | 1（store=1500） | ✅ |
| C1-sound-medium | temp | number | 1（store=-20） | ✅ |
| C1-sound-medium | pressure | number | 1（store=0） | ✅ |
| C1-sound-medium | freq | enum | 1（store=256） | ✅ |
| C1-sound-medium | dist | number | 1（store=0.2） | ✅ |
| C1-sound-medium | duration 快照校验 | getter | actual=6 vs 快照 6（±10%） | ✅ |
| C1-sound-medium | seek 拖动一致性 | 2.22→4.38→2.22 | simTime 回位=true、无NaN=true | ✅ |
| C1-sound-medium | 统计面板 | readouts() | 6/6 项渲染一致、无NaN | ✅ |
| C1-sound-medium | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| C1-sound-medium | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| C2-sound-chars | freq | number | 1（store=50） | ✅ |
| C2-sound-chars | amp | number | 1（store=0） | ✅ |
| C2-sound-chars | wave | enum | 1（store=square） | ✅ |
| C2-sound-chars | ruler | number | 1（store=5） | ✅ |
| C2-sound-chars | pipe | number | 1（store=5） | ✅ |
| C2-sound-chars | duration 快照校验 | getter | actual=4 vs 快照 4（±10%） | ✅ |
| C2-sound-chars | seek 拖动一致性 | 1.48→2.92→1.48 | simTime 回位=true、无NaN=true | ✅ |
| C2-sound-chars | 统计面板 | readouts() | 6/6 项渲染一致、无NaN | ✅ |
| C2-sound-chars | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| C2-sound-chars | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| C3-noise-control | level | number | 1（store=0） | ✅ |
| C3-noise-control | range | number | 1（store=1） | ✅ |
| C3-noise-control | material | enum | 1（store=3） | ✅ |
| C3-noise-control | stage | enum | 1（store=source） | ✅ |
| C3-noise-control | duration 快照校验 | getter | actual=4 vs 快照 4（±10%） | ✅ |
| C3-noise-control | seek 拖动一致性 | 1.48→2.92→1.48 | simTime 回位=true、无NaN=true | ✅ |
| C3-noise-control | 统计面板 | readouts() | 6/6 项渲染一致、无NaN | ✅ |
| C3-noise-control | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 1×（期望 1×） | ✅ |
| C3-noise-control | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| F1-melting-curve | substance | enum | 1（store=hypo） | ✅ |
| F1-melting-curve | power | number | 1（store=100） | ✅ |
| F1-melting-curve | mass | number | 1（store=50） | ✅ |
| F1-melting-curve | t0 | number | 1（store=-20） | ✅ |
| F1-melting-curve | duration | number | 1（store=1） | ✅ |
| F1-melting-curve | duration 快照校验 | getter | actual=600 vs 快照 600（±10%） | ✅ |
| F1-melting-curve | seek 拖动一致性 | 222→438→222 | simTime 回位=true、无NaN=true | ✅ |
| F1-melting-curve | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| F1-melting-curve | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 8×（期望 8×） | ✅ |
| F1-melting-curve | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| F2-boiling | pressure | number | 1（store=70） | ✅ |
| F2-boiling | volume | number | 1（store=50） | ✅ |
| F2-boiling | t0 | number | 1（store=90） | ✅ |
| F2-boiling | flame | number | 1（store=1） | ✅ |
| F2-boiling | duration 快照校验 | getter | actual=246.64323433243067 vs 快照 246.64（±10%） | ✅ |
| F2-boiling | seek 拖动一致性 | 91.26→180.05→91.26 | simTime 回位=true、无NaN=true | ✅ |
| F2-boiling | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| F2-boiling | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 8×（期望 8×） | ✅ |
| F2-boiling | 表实门禁 | duration | 有时长=true snap=true kind=— | ✅ |
| F3-heat-engine | material | enum | 1（store=2.1） | ✅ |
| F3-heat-engine | mass | number | 2（store=0.1） | ✅ |
| F3-heat-engine | heatQ | number | 1（store=0） | ✅ |
| F3-heat-engine | rpm | number | 1（store=0） | ✅ |
| F3-heat-engine | stroke | enum | 2（store=intake） | ✅ |
| F3-heat-engine | qTotal | number | 2（store=0） | ✅ |
| F3-heat-engine | wUseful | number | 1（store=0） | ✅ |
| F3-heat-engine | duration 快照校验 | getter | actual=1.2000000000000002 vs 快照 1.2（±10%） | ✅ |
| F3-heat-engine | 置灰文案=zeroHint | branch | 期望「当前转速为零，曲轴不转（调大转速即有循环）」实际「当前转速为零，曲轴不转（调大转速即有循环）」 | ✅ |
| F3-heat-engine | seek 拖动一致性 | 0.44→0.88→0.44 | simTime 回位=true、无NaN=true | ✅ |
| F3-heat-engine | zeroKind=branch | 默认 d0=1.2000000000000002 → 触发后 d1=0 | | ✅ 0↔非0 互斥成立 |
| F3-heat-engine | 统计面板 | readouts() | 5/5 项渲染一致、无NaN | ✅ |
| F3-heat-engine | 速度六档 | playbar | 档位[0.25×,0.5×,1×,2×,4×,8×] 高亮 0.25×（期望 0.25×） | ✅ |
| F3-heat-engine | 表实门禁 | duration | 有时长=true snap=true kind=branch | ✅ |

## 结论

- 控件总数 115，onParam 送达 115。**UI→引擎通路完好：所有控件都能把改动送进 onParam。**画面不动的问题出在实验侧 onParam 实现。
- duration 快照校验（durationIsSnapshot 场景）：14/14 通过。getter 与 JSON 快照一致，无脱节。
- 无界时长断言（duration=Infinity 场景）：0/0 通过。（尚无场景声明 ∞）
- seek 拖动一致性（验收第 9 条，有 seek 且 duration>0 的场景）：13/13 通过。
- durationZeroKind 双类断言：static（任何参数下恒 0）11/11；branch（默认与触发参数下 0↔非 0）3/3。两类分开统计，断言不同。
- branch 置灰文案取 JSON zeroHint：3/3 通过。
- 统计面板收起/展开：默认展开 → 点击收起 → 再点恢复，✅。
- 统计面板（exp.readouts() → 100ms 渲染）：25/25 通过。
- 播放速度六档（0.25/0.5/1/2/4/8，高亮=defaultSpeed，置灰=duration≤0）：25/25 通过。
- 表实一致门禁（有 duration 必带 durationIsSnapshot 或 durationZeroKind）：25/25 通过。
- 平移视角：右键拖动 target 生效且在限内、越界钳制（20,-5,0 → 7.98,0.00,0.02）、重置回初始机位，✅。
- 音频引擎：开关开/关+localStorage 记忆 ✅；非声学场景返回 null 静音 ✅；C2 tone（freq 跟音调 440→50）✅；C1 pulse（interval 1.7647058823529411→0.39999999999999997 随介质）✅；C3 noise（gain 0.12328615384615384→0.14663999999999996、filterHz 4560→5460 隔声材料）✅。
- ammo.js 惰性加载：首屏 0 次（应为 0）、默认路径 A1/A3/A6 切换新增 0 次（应为 0）、刚体场景 A7-lever/A2-newton-first 合计注入 1 次（≤1，缓存复用）、全新页面首进 A2 遮罩出现→消失=true→true（headless 秒解析时 seen 允许为 false），✅。
- A2 刚体确定性（外壳侧）：seek(0)→seek(duration) 两轮末态位姿逐位一致（0,0,0,0,0,0,1…），✅。
- 刚体物理量门禁（位移 vs 解析式）：停止距离 1.17m vs v0²/2μg=1.167m，|Δ|=0.0033m ≤ max(5%×理论, 0.03)=0.058m，✅。
- A2 三档统一口径（同一轮）：毛巾 μ0.6 0.58m（理论 0.583m，|Δ|=0.0033m ✅）；棉布 μ0.3 1.17m（理论 1.167m，|Δ|=0.0033m ✅）；木板 μ0.12 2.94m（理论 2.917m，|Δ|=0.0233m ✅），两两差距 毛巾→棉布 +101.7%、棉布→木板 +151.3%。
