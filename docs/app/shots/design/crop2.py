from PIL import Image
p = r"D:\vibe coding\DshBot\docs\app\shots"
im = Image.open(p + r"\a2-walk-arc.png")
im.crop((330, 200, 1170, 560)).save(p + r"\design\a2-arc-crop.png")
print("ok", im.size)
