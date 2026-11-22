import os
from PIL import Image
base = r"D:\vibe coding\DshBot\docs\app\shots"
out = os.path.join(base, "design")
os.makedirs(out, exist_ok=True)
im = Image.open(os.path.join(base, "a2-walk-wood-stop.png"))
print("size", im.size)
im.crop((330, 200, 1170, 560)).save(os.path.join(out, "a2-current-crop.png"))
im2 = Image.open(os.path.join(base, "a2-tilt-top-close.png"))
im2.crop((555, 175, 1170, 655)).save(os.path.join(out, "a2-top-crop.png"))
print("done")
