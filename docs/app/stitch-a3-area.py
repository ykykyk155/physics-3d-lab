from PIL import Image, ImageDraw, ImageFont
import os
base = os.path.join("docs", "app", "shots", "a3-area")
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
    canvas.save(out); print("SAVED", out, canvas.size)

stitch([
    ("a3-area-flat-N2.png", "平放 N=2  底面0.72x0.40 高0.20"),
    ("a3-area-side-N2.png", "侧放 N=2  底面0.72x0.20 高0.40"),
    ("a3-area-side-N2-top.png", "侧放 N=2 顶视"),
], os.path.join(base, "a3-area-compare-flat-side.png"))

stitch([
    ("a3-area-side-p01-t0.png",  "t=0s  x=0.0m"),
    ("a3-area-side-p01-t6.png",  "t=6s  x=0.6m"),
    ("a3-area-side-p01-t12.png", "t=12s x=1.2m"),
], os.path.join(base, "a3-area-side-hline-compare.png"), "侧放 pull=0.1  ")
