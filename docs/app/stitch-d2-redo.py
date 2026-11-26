from PIL import Image, ImageDraw, ImageFont
import os

base = os.path.join("shots", "d2-redo")

def stitch(items, out, header_prefix=""):
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
        d.text((x0 + 16, 10), header_prefix + label, fill=(240, 244, 250), font=font)
        if idx > 0:
            d.line([(x0, 0), (x0, h + hdr)], fill=(120, 130, 145), width=2)
    canvas.save(os.path.join(base, out)); print("SAVED", os.path.join(base, out), canvas.size)

stitch([
    ("d2r-default-series.png", "默认 镍铬50cm1mm² 闭合  R=4.16Ω I=1.44A"),
    ("d2r-switched-off.png", "断开开关  I=0 粒子停 灯灭"),
    ("d2r-copper-l100.png", "铜 L=100  R=2.08Ω I=2.88A"),
], "d2-redo-compare-3way.png")