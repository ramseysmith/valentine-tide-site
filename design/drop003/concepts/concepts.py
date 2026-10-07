"""Writes the three Surf the Shadows concept SVGs (transparent, 1000 x 1000)."""
import math, sys
from parts import *

FONT = "font-family:Pirata;"


def svg(body, defs=""):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000"><defs>{defs}</defs>{body}</svg>'


def crest():
    defs = ('<clipPath id="inner"><circle cx="500" cy="500" r="388"/></clipPath>'
            '<path id="arcB" d="M190 560 A315 315 0 0 0 810 560"/>'
            '<path id="arcT" d="M215 470 A290 290 0 0 1 785 470"/>')
    b = [f'<circle cx="500" cy="500" r="400" fill="{INK}"/>',
         '<g clip-path="url(#inner)">',
         moon(345, 255, 78),
         sparkle(560, 170, 13), sparkle(700, 260, 9, op=.8), sparkle(470, 300, 6, op=.7), sparkle(230, 380, 7, op=.7),
         barrel_wave(485, 800, 440, seed=3),
         '</g>',
         f'<circle cx="500" cy="500" r="388" fill="none" stroke="{BONE}" stroke-width="4"/>',
         thorn_ring(500, 500, 418, turns=16, amp=8, thorns=32, width=5),
         rose(82, 500, 38, rot=-20), rose(918, 500, 38, rot=20),
         f'<rect x="230" y="842" width="540" height="74" fill="{INK}" stroke="{BONE}" stroke-width="4"/>',
         f'<path d="M230 842 l-46 37 46 37z M770 842 l46 37 -46 37z" fill="{INK}" stroke="{BONE}" stroke-width="4" stroke-linejoin="round"/>',
         f'<text x="500" y="895" text-anchor="middle" style="{FONT}font-size:48px;letter-spacing:5px" fill="{BONE}">SURF THE SHADOWS</text>']
    return svg("\n".join(b), defs)


def window():
    # pointed gothic arch
    def arch(inset):
        L, R_, top, bottom = 230 + inset, 770 - inset, 120 + inset * 1.4, 860 - inset * .2
        w = R_ - L
        r = w * .95
        return (f"M{f(L)} {f(bottom)} L{f(L)} 470 A{f(r)} {f(r)} 0 0 1 500 {f(top)} "
                f"A{f(r)} {f(r)} 0 0 1 {f(R_)} 470 L{f(R_)} {f(bottom)} Z")
    defs = f'<clipPath id="win"><path d="{arch(22)}"/></clipPath>'
    b = [f'<path d="{arch(0)}" fill="{INK}" stroke="{BONE}" stroke-width="8"/>',
         '<g clip-path="url(#win)">',
         f'<rect x="0" y="0" width="1000" height="1000" fill="#160c0c"/>',
         moon(385, 315, 58),
         sparkle(600, 300, 11), sparkle(680, 380, 7, op=.8), sparkle(330, 430, 6, op=.7),
         barrel_wave(492, 790, 400, seed=5),
         '</g>',
         f'<path d="{arch(22)}" fill="none" stroke="{BONE}" stroke-width="3"/>',
         # mullions and a rose window at the apex
         f'<circle cx="500" cy="212" r="34" fill="{INK}" stroke="{BONE}" stroke-width="4"/>',
         "".join(f'<path d="M500 212 L{f(500 + 34 * math.cos(a))} {f(212 + 34 * math.sin(a))}" stroke="{BONE}" stroke-width="3"/>' for a in [i * math.pi / 4 for i in range(8)]),
         f'<circle cx="500" cy="212" r="9" fill="{BLOOD_BRIGHT}"/>',
         # sill
         f'<rect x="190" y="858" width="620" height="26" fill="{INK}" stroke="{BONE}" stroke-width="5"/>',
         f'<text x="500" y="955" text-anchor="middle" style="{FONT}font-size:56px;letter-spacing:7px" fill="{BONE}">SURF THE SHADOWS</text>']
    # thorn vines climbing both sides of the arch
    for side in (-1, 1):
        pts = []
        for i in range(121):
            t = i / 120
            y = 860 - t * 560
            x = 500 + side * (285 + 14 * math.sin(t * 22))
            pts.append((x, y))
        b.append(f'<path d="{poly(pts)}" fill="none" stroke="{BONE}" stroke-width="5"/>')
        for k in range(12):
            t = (k + .5) / 12
            y = 860 - t * 560
            x = 500 + side * (285 + 14 * math.sin(t * 22))
            d = side * (1 if k % 2 else -1)
            b.append(f'<path d="M{f(x)} {f(y - 7)} L{f(x + d * 24)} {f(y - 2)} L{f(x)} {f(y + 7)} Z" fill="{BONE}"/>')
        b.append(rose(500 + side * 285, 838, 30, rot=side * 15))
    return svg("\n".join(b), defs)


def thorned_wave():
    outer = []
    w = barrel_wave(500, 760, 600, seed=7, collect=outer)
    b = [crescent(800, 170, 54),
         sparkle(200, 220, 14), sparkle(560, 95, 9, op=.75), sparkle(900, 330, 7, op=.7),
         w]
    # a thorned vine climbing the back of the wave, just outside its wall
    wall = outer[:44]
    pts = []
    for i in range(1, len(wall) - 1):
        (x0, y0), (x1, y1), (x2, y2) = wall[i - 1], wall[i], wall[i + 1]
        tx_, ty_ = x2 - x0, y2 - y0
        n = math.hypot(tx_, ty_) or 1
        off = 20 + 7 * math.sin(i * .8)
        pts.append((x1 + ty_ / n * off, y1 - tx_ / n * off))
    b.append(f'<path d="{poly(pts)}" fill="none" stroke="{BLOOD_BRIGHT}" stroke-width="7" stroke-linecap="round"/>')
    for k in range(3, len(pts) - 2, 4):
        (x0, y0), (x1, y1) = pts[k - 1], pts[k + 1]
        tx_, ty_ = x1 - x0, y1 - y0
        n = math.hypot(tx_, ty_) or 1
        ux, uy = tx_ / n, ty_ / n
        side = 1 if (k // 4) % 2 else -1
        nx, ny = uy * side, -ux * side
        x, y = pts[k]
        b.append(f'<path d="M{f(x - ux * 7)} {f(y - uy * 7)} L{f(x + nx * 24 + ux * 6)} {f(y + ny * 24 + uy * 6)} L{f(x + ux * 7)} {f(y + uy * 7)} Z" fill="{BLOOD_BRIGHT}"/>')
    b.append(rose(pts[0][0] + 6, pts[0][1] - 18, 40, rot=-15))
    b.append(rose(pts[-1][0] - 4, pts[-1][1] - 6, 30, rot=20, leaves=False))
    b.append(f'<text x="500" y="895" text-anchor="middle" style="{FONT}font-size:76px;letter-spacing:8px" fill="{BONE}">SURF THE SHADOWS</text>')
    b.append(f'<text x="500" y="955" text-anchor="middle" style="{FONT}font-size:30px;letter-spacing:12px" fill="{BLOOD_BRIGHT}">VALENTINE TIDE</text>')
    return svg("\n".join(b))

for name, fn in [("crest", crest), ("window", window), ("thorned-wave", thorned_wave)]:
    open(f"{name}.svg", "w").write(fn())
print("ok")
