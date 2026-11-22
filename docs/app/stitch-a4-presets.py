# A4 密度滑块+快捷按钮三联对比图
from PIL import Image, ImageDraw, ImageFont
import os
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots", "a4-liquid")
def font(sz):
    for p in (r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhl.ttc"):
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()
imgs = [
    ("a4-presets-alcohol-btn.png", "点「酒精」按钮 → 滑块跳 0.8、淡琥珀、酒精高亮"),
    ("a4-presets-slider-125.png",  "拖滑块到 1.25 → 四个按钮全部取消高亮"),
    ("a4-presets-default-enter.png","默认进入 / 重置 → 回 1.0 水蓝，「水」高亮"),
]
im = imgs[0]
W, H = 1600, 900
gap = 24
out = Image.new("RGB", (W*3 + gap*4, H + 140), (16, 20, 32))
d = ImageDraw.Draw(out)
f_title = font(40); f_cap = font(30)
d.text((gap, 22), "A4 液体密度：滑块 + 特殊液体快捷按钮共存", fill=(255, 226, 138, 255), font=f_title)
y = 0
for name, cap in imgs:
    im0 = Image.open(os.path.join(base, name)).convert("RGB")
    x = gap + y * (W + gap)
    out.paste(im0, (x, 90))
    d.text((x + 12, 90 + H + 16), cap, fill=(235, 240, 248, 255), font=f_cap)
    y += 1
outp = os.path.join(base, "a4-presets-compare-3way.png")
out.save(outp)
print("SAVED", outp, out.size)