# -*- coding: utf-8 -*-
# A7 一键平衡三联对比图：默认已平衡 / 点左基准配平 / 点右基准配平
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "shots", "a7-balance")
OUT = os.path.join(SRC, "a7-balance-compare-3way.png")
FONT = None
for p in [r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\msyhl.ttc", r"C:\Windows\Fonts\simhei.ttf"]:
    if os.path.exists(p):
        FONT = p
        break

files = [
    ("a7-balance-default.png", "默认 F1=2·L1=4 / F2=4·L2=2 已平衡，两按钮不动参数"),
    ("a7-balance-left.png", "扰动 F2=3·L2=5 → 点「以左边为基准」：F2=2·L2=4，8 N·m 配平"),
    ("a7-balance-right.png", "扰动 F1=3.5·L1=7 → 点「以右边为基准」：F1=1·L1=8，8 N·m 配平"),
]
imgs = [Image.open(os.path.join(SRC, f)) for f, _ in files]
w = max(i.width for i in imgs)
h = sum(i.height for i in imgs) + 130 * len(imgs)
canvas = Image.new("RGB", (w, h), (24, 26, 34))
font = ImageFont.truetype(FONT, 44) if FONT else ImageFont.load_default()
y = 0
for (f, cap), img in zip(files, imgs):
    draw = ImageDraw.Draw(canvas)
    draw.text((24, y + 24), cap, fill=(255, 232, 138), font=font)
    y += 130
    canvas.paste(img, (0, y))
    y += img.height
canvas.save(OUT)
print("SAVED", OUT, canvas.size)