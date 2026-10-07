"""Cuts the Surf the Shadows crest art into print pieces with soft alpha edges.

Usage: python3 cut.py <upscaled crest png>
Coordinates below are on the original 1024 x 1536 art and scale with the input."""
import sys
from PIL import Image, ImageDraw, ImageFilter

src = Image.open(sys.argv[1]).convert("RGB")
k = src.width / 1024


def cut(box, shape, feather, name, pad=0):
    x0, y0, x1, y1 = [round(v * k) for v in box]
    im = src.crop((x0, y0, x1, y1))
    w, h = im.size
    f = round(feather * k)
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    inset = (f, f, w - f, h - f)
    (d.ellipse if shape == "ellipse" else d.rectangle)(inset, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(f / 2))
    im.putalpha(m)
    im.save(name, optimize=True)
    print(name, im.size)


cut((0, 0, 1024, 1536), "rect", 60, "crest-full.png")             # whole poster, for the rash guard back
cut((14, 40, 1010, 990), "ellipse", 36, "crest-emblem.png")      # thorn ring, moon and wave
cut((835, 455, 990, 650), "ellipse", 22, "crest-rose.png")        # the right hand rose
cut((90, 1070, 934, 1460), "rect", 45, "crest-lettering.png")     # Valentine Tide lettering
