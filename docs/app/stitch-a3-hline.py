from PIL import Image, ImageDraw, ImageFont
import os
base = os.path.join("docs", "app", "shots", "a3-hscale")
items = [
    ("a3-hline-p03-t0.png",  "t=0s   x=0.0m"),
    ("a3-hline-p03-t6.png",  "t=6s   x=1.8m"),
    ("a3-hline-p03-t12.png", "t=12s  x=3.6m"),
]
imgs = [Image.open(os.path.join(base, f)).convert("RGB") for f, _ in items]
w = min(i.width for i in imgs); h = min(i.height for i in imgs)
imgs = [i.crop((0, 0, w, h)) for i in imgs]
hdr = 46
try:
    font = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 26)
except Exception:
    font = ImageFont.load_default()
canvas = Image.new("RGB", (w * 3, h + hdr), (245, 247, 250))
d = ImageDraw.Draw(canvas)
for idx, (img, (_, label)) in enumerate(zip(imgs, items)):
    x0 = idx * w
    canvas.paste(img, (x0, hdr))
    d.rectangle([x0, 0, x0 + w, hdr], fill=(30, 42, 58))
    d.text((x0 + 16, 10), "pull=0.3  " + label, fill=(240, 244, 250), font=font)
    if idx > 0:
        d.line([(x0, 0), (x0, h + hdr)], fill=(120, 130, 145), width=2)
out = os.path.join(base, "a3-hline-compare-t.png")
canvas.save(out)
print("SAVED", out, canvas.size)
