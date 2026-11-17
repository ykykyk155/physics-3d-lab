"""5x5 总览拼图：25 张实验截图 + 每格标「实验编号 · 稳态 calls / triangles」。
基准数据取自 bench-raw.json（与 performance-benchmark.md 同源）。"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
SHOTS = ROOT / "shots" / "all"
OUT = ROOT / "25-experiments-contact-sheet.png"
BENCH = ROOT / "bench-raw.json"

ORDER = [
    "A1-incline-speed", "A2-newton-first", "A3-friction", "A4-liquid-pressure", "A5-buoyancy",
    "A6-energy", "A7-lever", "B1-pinhole", "B2-reflection", "B3-plane-mirror",
    "B4-refraction", "B5-convex-lens", "C1-sound-medium", "C2-sound-chars", "C3-noise-control",
    "D1-series-parallel", "D2-resistance-factor", "D3-rheostat-lamp", "D4-ohm-law", "D5-power-joule",
    "D6-magnet-solenoid", "D7-motor-generator", "F1-melting-curve", "F2-boiling", "F3-heat-engine",
]

COLS, ROWS = 5, 5
CELL_W = 400
PAD = 6
LABEL_H = 24
BG = (11, 17, 32)
INK = (230, 237, 247)
MUTED = (140, 156, 184)


def load_font(size):
    for name in ("msyh.ttc", "msyhbd.ttc", "simhei.ttf", "arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    bench = {}
    if BENCH.exists():
        for row in json.loads(BENCH.read_text(encoding="utf-8")):
            bench[row["id"]] = row

    first = Image.open(SHOTS / (ORDER[0] + ".png"))
    scale = CELL_W / first.width
    cell_h = int(first.height * scale)
    font = load_font(13)
    font_small = load_font(12)

    sheet_w = COLS * CELL_W + (COLS + 1) * PAD
    sheet_h = ROWS * (cell_h + LABEL_H) + (ROWS + 1) * PAD
    sheet = Image.new("RGB", (sheet_w, sheet_h), BG)
    draw = ImageDraw.Draw(sheet)

    for idx, exp_id in enumerate(ORDER):
        r, c = divmod(idx, COLS)
        x = PAD + c * (CELL_W + PAD)
        y = PAD + r * (cell_h + LABEL_H + PAD)
        img = Image.open(SHOTS / (exp_id + ".png")).convert("RGB").resize((CELL_W, cell_h), Image.LANCZOS)
        sheet.paste(img, (x, y))
        draw.rectangle([x, y, x + CELL_W - 1, y + cell_h - 1], outline=(48, 62, 88))

        draw.text((x + 4, y + cell_h + 4), exp_id, fill=INK, font=font)
        b = bench.get(exp_id)
        if b:
            stat = f"{b['steady']} calls · {b['tris']:,} tris"
            w = draw.textlength(stat, font=font_small)
            draw.text((x + CELL_W - 4 - w, y + cell_h + 5), stat, fill=MUTED, font=font_small)

    sheet.save(OUT, optimize=True)
    print(f"{OUT} {sheet.width}x{sheet.height}")
    if not bench:
        print("WARNING: bench-raw.json not found, labels without benchmark numbers")


if __name__ == "__main__":
    sys.exit(main())
