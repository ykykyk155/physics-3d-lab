from PIL import Image, ImageDraw, ImageFont
import os
base = os.path.join("docs", "app", "shots", "a5-float")
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
    ("a5-float-wood.png",      "漂浮 木0.6+水  浸没60% 示数0"),
    ("a5-float-wood-salt.png", "漂浮 木0.6+盐水1.1  浸没55%"),
    ("a5-suspend.png",         "悬浮 实心1.0+水  浸没100% 示数0"),
    ("a5-sink-half.png",       "下沉中 铝2.7+水 下潜3cm"),
    ("a5-sink-full.png",       "完全浸没·示数恒定 铝 下潜30cm"),
], os.path.join(base, "a5-float-compare-5way.png"))

stitch([
    ("a5-float-wood.png",      "塑料0.9+水 漂浮 滑块置灰"),
    ("a5-ballast-sink.png",    "塑料+ballast50% ρ_eff1.26>1.0 下沉"),
], os.path.join(base, "a5-ballast-compare.png"), "潜水艇配重  ")