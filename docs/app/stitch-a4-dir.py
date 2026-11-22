from PIL import Image, ImageDraw, ImageFont
import os
base = os.path.join("docs", "app", "shots", "a4-dir")
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
            d.line([(x0, 0), (x0, w * len(imgs) - 1), (x0, h + hdr)], fill=(120, 130, 145), width=2)
    canvas.save(out); print("SAVED", out, canvas.size)

stitch([
    ("a4-dir-down.png",  "朝向 下 (默认)  p=980Pa Δh=100mm"),
    ("a4-dir-up.png",    "朝向 上       p=980Pa Δh=100mm"),
    ("a4-dir-left.png",  "朝向 左       p=980Pa Δh=100mm"),
    ("a4-dir-right.png", "朝向 右       p=980Pa Δh=100mm"),
], os.path.join(base, "a4-dir-compare-4way.png"))