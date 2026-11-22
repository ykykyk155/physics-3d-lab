from PIL import Image, ImageDraw, ImageFont
import os
base = os.path.join("docs", "app", "shots", "a4-liquid")
def stitch(items, out):
    imgs = [Image.open(os.path.join(base, f)).convert("RGB") for f, _ in items]
    w = min(i.width for i in imgs); h = min(i.height for i in imgs)
    imgs = [i.crop((0, 0, w, h)) for i in imgs]
    hdr = 46
    font = None
    for fp in ["C:/Windows/Fonts/msyhbd.ttc", "C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/simhei.ttf", "C:/Windows/Fonts/arialbd.ttf"]:
        try:
            font = ImageFont.truetype(fp, 26); break
        except Exception:
            continue
    if font is None:
        font = ImageFont.load_default()
    canvas = Image.new("RGB", (w * len(imgs), h + hdr), (245, 247, 250))
    d = ImageDraw.Draw(canvas)
    for idx, (img, (_, label)) in enumerate(zip(imgs, items)):
        x0 = idx * w
        canvas.paste(img, (x0, hdr))
        d.rectangle([x0, 0, x0 + w, hdr], fill=(30, 42, 58))
        d.text((x0 + 16, 10), label, fill=(240, 244, 250), font=font)
        if idx > 0:
            d.line([(x0, 0), (x0, h + hdr)], fill=(120, 130, 145), width=2)
    canvas.save(out); print("SAVED", out, canvas.size)

stitch([
    ("a4-liquid-a08.png", "ρ=0.8 酒精"),
    ("a4-liquid-a09.png", "ρ=0.9 过渡"),
    ("a4-liquid-a10.png", "ρ=1.0 水"),
    ("a4-liquid-a11.png", "ρ=1.1 盐水"),
    ("a4-liquid-a12.png", "ρ=1.2 过渡"),
    ("a4-liquid-a13.png", "ρ=1.3 硫酸铜"),
], os.path.join(base, "a4-liquid-compare-6way.png"))