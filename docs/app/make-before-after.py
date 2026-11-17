import os, json
from PIL import Image, ImageDraw, ImageFont

ROOT = r"D:\vibe coding\DshBot\docs\app"
PILOT = [
    ("A1-incline-speed", "A1 斜面小车"),
    ("A3-friction", "A3 滑动摩擦力"),
    ("A5-buoyancy", "A5 浮力"),
    ("B5-convex-lens", "B5 凸透镜成像"),
    ("D1-series-parallel", "D1 串并联"),
    ("D6-magnet-solenoid", "D6 磁场与磁感线"),
    ("F3-heat-engine", "F3 热机"),
]
before_dir = os.path.join(ROOT, "shots", "before")
after_dir = os.path.join(ROOT, "shots", "all")

stats = {}
sp = os.path.join(ROOT, "bench-raw.json")
if os.path.exists(sp):
    for r in json.load(open(sp, encoding="utf-8")):
        stats[r["id"]] = {"calls": r["steady"], "tris": r["tris"]}

# 单元格尺寸
CW, CH = 520, 331       # 16:10ish 520x330
GAP = 14
PAD = 18
TOP_H = 74              # 顶部标题 + 改前/改后表头
LEFT_LBL = 156          # 左侧场景名栏

def load_fit(path):
    im = Image.open(path).convert("RGB")
    im = im.resize((CW, CH), Image.LANCZOS)
    return im

W = PAD + LEFT_LBL + CW + GAP + CW + PAD
H = PAD + TOP_H + len(PILOT) * (CH + GAP) + PAD
canvas = Image.new("RGB", (W, H), (14, 18, 30))
d = ImageDraw.Draw(canvas)

try:
    font = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 19)
    font_b = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", 22)
    font_s = ImageFont.truetype("C:/Windows/Fonts/msyh.ttc", 16)
except Exception:
    font = font_b = font_s = ImageFont.load_default()

d.text((PAD, PAD), "实物化试点：改前（积木） vs 改后（真实器材）", font=font_b, fill=(230, 237, 247))
col_x0 = PAD + LEFT_LBL
col_x1 = col_x0 + CW + GAP
ytop = PAD + TOP_H
d.text((col_x0 + CW/2 - 30, PAD + 40), "改前", font=font_b, fill=(255, 138, 120))
d.text((col_x1 + CW/2 - 30, PAD + 40), "改后", font=font_b, fill=(120, 220, 160))

for i, (id_, name) in enumerate(PILOT):
    y = ytop + i * (CH + GAP)
    # 场景名
    d.text((PAD + 4, y + CH/2 - 18), name, font=font, fill=(200, 210, 225))
    bpath = os.path.join(before_dir, id_ + ".png")
    apath = os.path.join(after_dir, id_ + ".png")
    if os.path.exists(bpath):
        canvas.paste(load_fit(bpath), (col_x0, y))
    if os.path.exists(apath):
        canvas.paste(load_fit(apath), (col_x1, y))
    d.rectangle([col_x0, y, col_x1 + CW, y + CH], outline=(60, 72, 96), width=2)
    # 改后 calls/tris 标注
    st = stats.get(id_)
    if st:
        d.text((PAD + 4, y + CH/2 + 6), "calls %d" % st["calls"], font=font_s, fill=(120, 220, 160))
        d.text((PAD + 4, y + CH/2 + 26), "tris %d" % st["tris"], font=font_s, fill=(150, 165, 190))

out = os.path.join(ROOT, "props-before-after.png")
canvas.save(out, quality=92)
print("saved", out, canvas.size)
