from PIL import Image, ImageDraw, ImageFont
import os

base = os.path.join("shots", "d1-redo")

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
    ("d1r-default-series.png", "串联默认 A+L1  0.10A / 1.00V"),
    ("d1r-default-parallel.png", "并联默认 a+L1  0.45A / 3.00V"),
    ("d1r-series-amp3-concl.png", "串联测齐 A/B/C 弹结论：处处相等"),
], "d1-redo-compare-3way.png")

stitch([
    ("d1r-mis-vol.png", "误接：电压表放电流槽 → toast+读数—"),
    ("d1r-mis-amp.png", "误接：电流表放电压槽 → toast+读数—"),
], "d1-redo-miscompare-2way.png", "误接反馈  ")
