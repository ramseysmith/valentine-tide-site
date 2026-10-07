"""Cuts the Surf the Shadows arch art into print pieces.

Usage: python3 cut.py <upscaled arch art> [out dir]

The art sits on near black. Its blacks are lifted to the fabric base
(#121212) so it prints as one piece of cloth, and everything outside the
artwork is made transparent so the tonal pattern carries on around it.
Box coordinates are on the original 1024 x 1536 art and scale with the input.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

BASE = np.array([18, 18, 18], float)

src = Image.open(sys.argv[1]).convert("RGB")
out_dir = sys.argv[2] if len(sys.argv) > 2 else "."
k = src.width / 1024
a = np.asarray(src).astype(float)

# Background colour from the corners, then a levels lift so it lands on the base.
corners = np.concatenate([a[:60, :60].reshape(-1, 3), a[:60, -60:].reshape(-1, 3), a[-60:, :60].reshape(-1, 3), a[-60:, -60:].reshape(-1, 3)])
bg = np.median(corners, 0)
lifted = np.clip((a - bg) / (255 - bg), 0, 1) * (255 - BASE) + BASE
art = Image.fromarray(lifted.round().astype(np.uint8))

# Silhouette of the artwork, worked out on a small copy: anything clearly
# brighter than the background, joined up, holes filled, then softened.
small = np.asarray(src.resize((1024, 1536), Image.BILINEAR)).astype(float)
ink = (small - bg).max(2) > 22
ink = ndimage.binary_dilation(ink, iterations=14)
ink = ndimage.binary_fill_holes(ink)
ink = ndimage.binary_erosion(ink, iterations=6)
sil = Image.fromarray((ink * 255).astype(np.uint8)).resize(src.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(10 * k))


def cut(name, box, fade=(0, 0, 0, 0), keep=None):
    """box = x0, y0, x1, y1; fade = left, top, right, bottom widths for edges that cut
    through the art; keep = optional outline (art coordinates) to cut a motif free of
    whatever sits behind it."""
    x0, y0, x1, y1 = [round(v * k) for v in box]
    im = art.crop((x0, y0, x1, y1))
    m = np.asarray(sil.crop((x0, y0, x1, y1))).astype(float) / 255
    if keep:
        poly = Image.new("L", im.size, 0)
        ImageDraw.Draw(poly).polygon([(x * k - x0, y * k - y0) for x, y in keep], fill=255)
        m *= np.asarray(poly.filter(ImageFilter.GaussianBlur(8 * k))).astype(float) / 255
    h, w = m.shape
    for side, width in zip("ltrb", fade):
        n = round(width * k)
        if not n:
            continue
        ramp = np.clip(np.arange(n) / n, 0, 1) ** 1.5
        if side == "l":
            m[:, :n] *= ramp[None, :]
        elif side == "r":
            m[:, w - n:] *= ramp[::-1][None, :]
        elif side == "t":
            m[:n, :] *= ramp[:, None]
        else:
            m[h - n:, :] *= ramp[::-1][:, None]
    im.putalpha(Image.fromarray((m * 255).round().astype(np.uint8)))
    path = os.path.join(out_dir, f"arch-{name}.png")
    im.save(path, optimize=True)
    print(path, im.size)


cut("full", (0, 0, 1024, 1536))                                  # whole design, rash guard back
cut("window", (20, 20, 1004, 1000), (0, 0, 0, 80))               # thorn arch, moon, wave and roses, no lettering
cut("wave", (165, 430, 860, 1000), (70, 90, 70, 70))             # just the breaking wave and the red water
cut("rose", (790, 655, 1010, 915), keep=[(835, 668), (900, 668), (990, 740), (1002, 820), (990, 905), (830, 905), (810, 830), (825, 760)])  # right hand rose
cut("rose-stem", (15, 545, 265, 1040), (0, 30, 0, 30),            # left rose with its leaves and the thorn vine above it
    keep=[(80, 555), (160, 555), (170, 690), (200, 735), (218, 800), (215, 880), (250, 940), (242, 1032), (38, 1032), (22, 880), (28, 740), (70, 700)])
cut("lettering", (70, 995, 954, 1490), (0, 25, 0, 0))            # Valentine Tide, stars and Surf the Shadows
