"""Generates the storefront illustrations in assets/illustrations/.
Run: python3 design/storefront/illustrations.py
Hand tuned geometry; the thorn vine is sampled along the arch so thorns sit on the curve."""
import math, random, os

OUT = os.path.join(os.path.dirname(__file__), "..", "..", "assets", "illustrations")
BONE, BLOOD, EMBER, INK = "#f5f0e8", "#8b0000", "#c4161c", "#161616"

def quad(p0, p1, p2, t):
    return tuple((1-t)**2*a + 2*(1-t)*t*b + t*t*c for a, b, c in zip(p0, p1, p2))

def arch_points(x0, x1, top, spring, base, n=220):
    """Pointed gothic arch: two quadratic curves meeting at the apex, straight jambs."""
    cx = (x0 + x1) / 2
    left = [(x0, base - (base - spring) * i / 40) for i in range(40)]
    curve_l = [quad((x0, spring), (x0, top + (spring - top) * 0.28), (cx, top), i / 80) for i in range(80)]
    curve_r = [quad((cx, top), (x1, top + (spring - top) * 0.28), (x1, spring), i / 80) for i in range(1, 81)]
    right = [(x1, spring + (base - spring) * i / 40) for i in range(1, 41)]
    return left + curve_l + curve_r + right

def arch_path(x0, x1, top, spring, base, closed=True):
    cx = (x0 + x1) / 2
    k = top + (spring - top) * 0.28
    return f"M{x0} {base}V{spring}Q{x0} {k:.1f} {cx} {top}Q{x1} {k:.1f} {x1} {spring}V{base}" + ("Z" if closed else "")

def resample(pts, step):
    out, acc = [pts[0]], 0.0
    for a, b in zip(pts, pts[1:]):
        d = math.dist(a, b)
        acc += d
        if acc >= step:
            out.append(b); acc = 0.0
    return out

def vine(pts, amp, wavelength, phase=0.0):
    """A sine vine that winds around the arch line."""
    res = resample(pts, 2)
    out, s = [], 0.0
    for i in range(1, len(res) - 1):
        (ax, ay), (bx, by) = res[i - 1], res[i + 1]
        tx, ty = bx - ax, by - ay
        l = math.hypot(tx, ty) or 1
        nx, ny = -ty / l, tx / l
        s += 2
        off = amp * math.sin(s / wavelength * 2 * math.pi + phase)
        x, y = res[i]
        out.append((x + nx * off, y + ny * off, nx, ny, tx / l, ty / l, off))
    return out

def polyline(points):
    return "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y, *_ in points)

def thorns(v, every, size, rnd):
    paths = []
    for i in range(every // 2, len(v), every):
        x, y, nx, ny, tx, ty, off = v[i]
        side = 1 if off >= 0 else -1
        s = size * (0.75 + rnd.random() * 0.5)
        # base along tangent, tip outward on the normal, raked forward
        bx1, by1 = x - tx * s * 0.45, y - ty * s * 0.45
        bx2, by2 = x + tx * s * 0.45, y + ty * s * 0.45
        px, py = x + nx * side * s * 1.25 + tx * s * 0.55, y + ny * side * s * 1.25 + ty * s * 0.55
        paths.append(f"M{bx1:.1f} {by1:.1f}L{px:.1f} {py:.1f}L{bx2:.1f} {by2:.1f}Z")
    return "".join(paths)

def rose(cx, cy, r, rot=0, petal=BLOOD, line=BONE):
    """Stylized engraved rose: outer petal ring, cupped inner petals, spiral heart."""
    g = [f'<g transform="translate({cx} {cy}) rotate({rot})">']
    for i in range(6):
        a = i * 60
        g.append(f'<path transform="rotate({a})" d="M0 {-r*0.15}C{r*0.55} {-r*0.35} {r*0.75} {-r*0.95} 0 {-r*1.02}C{-r*0.75} {-r*0.95} {-r*0.55} {-r*0.35} 0 {-r*0.15}Z" fill="{petal}" stroke="{INK}" stroke-width="{r*0.06:.2f}"/>')
    for i in range(5):
        a = i * 72 + 36
        g.append(f'<path transform="rotate({a})" d="M0 0C{r*0.4} {-r*0.2} {r*0.48} {-r*0.62} 0 {-r*0.7}C{-r*0.48} {-r*0.62} {-r*0.4} {-r*0.2} 0 0Z" fill="{EMBER}" stroke="{INK}" stroke-width="{r*0.05:.2f}"/>')
    # spiral
    pts = []
    for i in range(60):
        t = i / 59
        ang = t * 4.2 * math.pi
        rr = r * 0.42 * (1 - t)
        pts.append(f"{rr*math.cos(ang):.2f} {rr*math.sin(ang):.2f}")
    g.append(f'<path d="M{" L".join(pts)}" fill="none" stroke="{line}" stroke-width="{r*0.07:.2f}" stroke-linecap="round" opacity=".85"/>')
    g.append("</g>")
    return "".join(g)

def leaf(x, y, l, ang, color=BONE):
    return (f'<g transform="translate({x} {y}) rotate({ang})"><path d="M0 0C{l*0.3} {-l*0.28} {l*0.75} {-l*0.25} {l} 0C{l*0.75} {l*0.25} {l*0.3} {l*0.28} 0 0Z" '
            f'fill="none" stroke="{color}" stroke-width="1.4"/><path d="M{l*0.08} 0H{l*0.86}" stroke="{color}" stroke-width="1" opacity=".7"/></g>')

def sparkle(x, y, s, color=BONE, opacity=1):
    return (f'<path transform="translate({x} {y}) scale({s})" opacity="{opacity}" fill="{color}" '
            f'd="M0 -10C.6 -3 3 -.6 10 0C3 .6 .6 3 0 10C-.6 3 -3 .6 -10 0C-3 -.6 -.6 -3 0 -10Z"/>')

def heart_wave(x, y, s, color=BONE):
    """Brand crest: heart outline cradling a curling wave."""
    return (f'<g transform="translate({x} {y}) scale({s})" fill="none" stroke="{color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
            f'<path d="M0 16C-14 6 -22 -1 -22 -9C-22 -16 -16 -21 -10 -21C-5 -21 -2 -18 0 -14C2 -18 5 -21 10 -21C16 -21 22 -16 22 -9C22 -1 14 6 0 16Z"/>'
            f'<path d="M-13 3C-9 -6 -1 -10 6 -7C11 -5 11 1 6 2C3 2.6 1.5 .5 2.6 -1.5"/></g>')

def write(name, body):
    with open(os.path.join(OUT, name), "w") as f:
        f.write(body)
    print("wrote", name, len(body))

# ------------------------------------------------------------------ hero arch frame
def hero_arch():
    rnd = random.Random(13)
    W, H = 400, 540
    x0, x1, top, spring, base = 28, 372, 46, 228, 540
    inner = arch_points(x0 + 14, x1 - 14, top + 22, spring + 6, base)
    outer = arch_points(x0, x1, top, spring, base)
    v1 = vine(outer, 7, 46)
    v2 = vine(outer, 7, 46, math.pi)
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" fill="none">',
             "<title>Thorn and rose arch</title>",
             f'<path d="{arch_path(x0, x1, top, spring, base, False)}" stroke="{BONE}" stroke-width="2.4" opacity=".95"/>',
             f'<path d="{arch_path(x0+14, x1-14, top+22, spring+6, base, False)}" stroke="{BONE}" stroke-width="1" opacity=".55"/>',
             f'<path d="{polyline(v1)}" stroke="{BONE}" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>',
             f'<path d="{polyline(v2)}" stroke="{BONE}" stroke-width="1.1" stroke-linecap="round" opacity=".55"/>',
             f'<path d="{thorns(v1, 14, 5, rnd)}" fill="{BONE}" opacity=".9"/>',
             f'<path d="{thorns(v2, 22, 4, rnd)}" fill="{BONE}" opacity=".55"/>']
    # apex: blood moon, crest, sparkles
    cx = (x0 + x1) / 2
    parts.append(f'<circle cx="{cx}" cy="{top-6}" r="30" fill="{INK}"/>')
    parts.append(f'<circle cx="{cx}" cy="{top-6}" r="24" fill="{BLOOD}" stroke="{BONE}" stroke-width="1.6"/>')
    parts.append(f'<path d="M{cx-14} {top-14}a6 6 0 1 0 0.1 0M{cx+8} {top-2}a3.5 3.5 0 1 0 0.1 0" stroke="{INK}" stroke-width="1.2" opacity=".55"/>')
    parts.append(heart_wave(cx, top - 6, 0.62))
    parts.append(sparkle(cx - 58, top + 8, 0.9))
    parts.append(sparkle(cx + 58, top + 8, 0.9))
    parts.append(sparkle(cx - 92, top + 46, 0.55, opacity=.7))
    parts.append(sparkle(cx + 92, top + 46, 0.55, opacity=.7))
    # roses on the jambs
    for (x, y, r, rot, la) in [(x0, 452, 22, 10, 200), (x1, 452, 22, -14, -20), (x0 + 3, 352, 13, 40, 160), (x1 - 3, 330, 13, -30, 20)]:
        parts.append(leaf(x, y + r * 0.6, r * 1.7, la + 20))
        parts.append(leaf(x, y - r * 0.4, r * 1.4, la - 25))
        parts.append(rose(x, y, r, rot))
    parts.append("</svg>")
    write("hero-arch.svg", "".join(parts))

# ------------------------------------------------------------------ arch mask (for photos)
def arch_mask():
    write("arch-mask.svg",
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 540" preserveAspectRatio="none">'
          f'<path d="{arch_path(42, 358, 68, 234, 540)}" fill="#000"/></svg>')
    # a plain full width arch for small product frames
    write("arch-mask-full.svg",
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 520" preserveAspectRatio="none">'
          f'<path d="{arch_path(0, 400, 0, 170, 520)}" fill="#000"/></svg>')

# ------------------------------------------------------------------ empty bag
def empty_bag():
    p = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" fill="none">', "<title>An empty bag under a red moon</title>",
         f'<circle cx="138" cy="44" r="18" fill="{BLOOD}" stroke="{BONE}" stroke-width="1.5"/>',
         sparkle(52, 40, .7, opacity=.8), sparkle(168, 92, .45, opacity=.6),
         f'<path d="M48 82h104l-9 92H57z" stroke="{BONE}" stroke-width="2.5" stroke-linejoin="round"/>',
         f'<path d="M78 96V70a22 22 0 0 1 44 0v26" stroke="{BONE}" stroke-width="2.5" stroke-linecap="round"/>',
         f'<path d="M60 146c8 0 8-6 16-6s8 6 16 6 8-6 16-6 8 6 16 6 8-6 16-6" stroke="{BONE}" stroke-width="1.8" stroke-linecap="round" opacity=".7"/>',
         f'<path d="M62 160c8 0 8-6 16-6s8 6 16 6 8-6 16-6 8 6 16 6 8-6 16-6" stroke="{BONE}" stroke-width="1.4" stroke-linecap="round" opacity=".45"/>',
         heart_wave(100, 118, .7, EMBER), "</svg>"]
    write("empty-bag.svg", "".join(p))

# ------------------------------------------------------------------ set band ornament (rose & thorn rule)
def rose_rule():
    rnd = random.Random(4)
    line = [(x, 20.0) for x in range(0, 401, 2)]
    v = vine([(x, y) for x, y in line], 4, 38)
    p = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 40" fill="none">',
         f'<path d="{polyline(v)}" stroke="{BONE}" stroke-width="1.3" opacity=".7"/>',
         f'<path d="{thorns(v, 12, 3.4, rnd)}" fill="{BONE}" opacity=".7"/>',
         f'<rect x="170" y="4" width="60" height="32" fill="{INK}"/>',
         leaf(186, 22, 18, 200), leaf(214, 22, 18, -20), rose(200, 20, 11, 15), "</svg>"]
    write("rose-rule.svg", "".join(p))

if __name__ == "__main__":
    hero_arch(); arch_mask(); empty_bag(); rose_rule()
