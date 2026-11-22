from PIL import Image, ImageDraw, ImageFont
import os
base = os.path.join("docs", "app", "shots", "a3-hscale")
items = [
    ("a3-hscale-N0.5-t6.png", "N=0.5  f=0.20N  1片"),
    ("a3-hscale-N2-t6.png",   "N=2      f=0.80N  4片"),
    ("a3-hscale-N5-t6.png",   "N=5      f=2.00N  10片"),
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
    d.text((x0 + 16, 10), label, fill=(240, 244, 250), font=font)
    if idx > 0:
        d.line([(x0, 0), (x0, h + hdr)], fill=(120, 130, 145), width=2)
out = os.path.join(base, "a3-hscale-compare-N.png")
canvas.save(out)
print("SAVED", out, canvas.size)
