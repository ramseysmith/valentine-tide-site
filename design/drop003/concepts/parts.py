"""Shared vector parts for the Night Session concepts (woodcut wave, thorn ring,
moon, stars, rose). Each function returns SVG markup in a 1000 x 1000 space."""
import math

BONE = "#f5f0e8"
BLOOD = "#8b0000"
BLOOD_BRIGHT = "#b30000"
INK = "#121212"


def f(n):
    return f"{n:.1f}"


def poly(points, close=False):
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in points)
    return d + (" Z" if close else "")


def moon(cx, cy, r, bite=True):
    s = [f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 1.27)}" fill="none" stroke="{BONE}" stroke-opacity=".18" stroke-width="3"/>',
         f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r * 1.5)}" fill="none" stroke="{BLOOD_BRIGHT}" stroke-opacity=".6" stroke-width="4" stroke-dasharray="4 16"/>',
         f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r)}" fill="{BONE}"/>']
    for dx, dy, rr in [(-.32, -.25, .17), (.29, .2, .12), (-.07, .41, .07), (.47, -.4, .06), (-.57, .27, .05)]:
        s.append(f'<circle cx="{f(cx + dx * r)}" cy="{f(cy + dy * r)}" r="{f(rr * r)}" fill="#d6cdbf"/>')
    if bite:
        k = r / 150
        s.append(f'<path transform="translate({f(cx)} {f(cy)}) scale({k:.3f})" d="M-150 20a150 150 0 0 0 300 0c-40 36-100 58-150 58S-110 56-150 20z" fill="{BLOOD}" opacity=".85"/>')
    return "\n".join(s)


def crescent(cx, cy, r, color=BONE):
    return (f'<path d="M{f(cx + r * .2)} {f(cy - r)} A{f(r)} {f(r)} 0 1 0 {f(cx + r * .2)} {f(cy + r)} '
            f'A{f(r * 1.25)} {f(r * 1.25)} 0 0 1 {f(cx + r * .2)} {f(cy - r)} Z" fill="{color}"/>')


def sparkle(cx, cy, s, color=BONE, op=1):
    pts = []
    for i in range(8):
        a = i * math.pi / 4 - math.pi / 2
        rr = s if i % 2 == 0 else s * .22
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return f'<path d="{poly(pts, True)}" fill="{color}" fill-opacity="{op}"/>'


def thorn_ring(cx, cy, r, turns=14, amp=9, thorns=28, width=5, color=BONE):
    """Two vines twisting around a circle, with thorns pointing out and in."""
    out = []
    for phase in (0, math.pi):
        pts = []
        for i in range(721):
            t = i / 720 * 2 * math.pi
            rr = r + amp * math.sin(turns * t + phase)
            pts.append((cx + rr * math.cos(t), cy + rr * math.sin(t)))
        out.append(f'<path d="{poly(pts, True)}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round"/>')
    for k in range(thorns):
        t = k / thorns * 2 * math.pi + .07
        sign = 1 if k % 2 == 0 else -1
        base = r + sign * amp * .6
        tip = r + sign * (amp + 26)
        a1, a2 = t - .022, t + .022
        pts = [(cx + base * math.cos(a1), cy + base * math.sin(a1)), (cx + tip * math.cos(t + .012 * sign), cy + tip * math.sin(t + .012 * sign)), (cx + base * math.cos(a2), cy + base * math.sin(a2))]
        out.append(f'<path d="{poly(pts, True)}" fill="{color}"/>')
    return "\n".join(out)


def bez(p0, p1, p2, p3, n=40):
    out = []
    for i in range(n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t ** 2, t ** 3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out


def rose(cx, cy, r, color=BLOOD_BRIGHT, rot=0, leaves=True):
    """Woodcut rose: rings of scalloped petals in red, carved with dark lines."""
    s = [f'<g transform="rotate({rot} {f(cx)} {f(cy)})">']
    if leaves:
        for side in (-1, 1):
            tip = (cx + side * r * 1.9, cy + r * .55)
            base = (cx + side * r * .55, cy + r * .45)
            up = bez(base, (base[0] + side * r * .5, base[1] - r * .55), (tip[0] - side * r * .4, tip[1] - r * .5), tip, 20)
            dn = bez(tip, (tip[0] - side * r * .45, tip[1] + r * .35), (base[0] + side * r * .45, base[1] + r * .45), base, 20)
            s.append(f'<path d="{poly(up + dn, True)}" fill="{BONE}"/>')
            s.append(f'<path d="M{f(base[0])} {f(base[1])} L{f(tip[0] - side * r * .25)} {f(tip[1] - r * .05)}" stroke="{INK}" stroke-width="{f(r * .06)}"/>')
    for ring, (rr, n, off) in enumerate([(1.0, 7, 0), (.72, 6, .4), (.46, 5, .9)]):
        pts = []
        for i in range(n * 12 + 1):
            t = i / (n * 12) * 2 * math.pi + off
            bump = 1 + .16 * abs(math.sin(n * t / 2))
            pts.append((cx + r * rr * bump * math.cos(t), cy + r * rr * bump * .9 * math.sin(t)))
        s.append(f'<path d="{poly(pts, True)}" fill="{color}" stroke="{INK}" stroke-width="{f(r * .07)}" stroke-linejoin="round"/>')
    sp = []
    for i in range(50):
        t = i / 49 * 4.4
        q = r * .3 * (1 - i / 60)
        sp.append((cx + q * math.cos(t), cy + q * .9 * math.sin(t)))
    s.append(f'<path d="{poly(sp)}" fill="none" stroke="{INK}" stroke-width="{f(r * .07)}" stroke-linecap="round"/>')
    s.append("</g>")
    return "\n".join(s)


_wave_id = [0]


def wave(x0, base, width, height, color=BONE, ink=INK, lines=12, curl=1.0, flip=False):
    """Woodcut breaking wave travelling right. The lip pitches forward over a
    hollow barrel; carved lines follow the water and spiral into the curl;
    a foam band rides the crest and ends in claws. Returns (svg, back_curve)."""
    _wave_id[0] += 1
    wid = f"wv{_wave_id[0]}"
    W, H = width, height

    def P(u, v):
        return (x0 + (1 - u if flip else u) * W, base - v * H)

    back = bez(P(0, 0), P(.22, .02), P(.3, .78), P(.5, .98), 60)
    lip_out = bez(P(.5, .98), P(.72, 1.1), P(1.0, .95), P(.96, .5), 50)
    lip_in = bez(P(.96, .5), P(.93, .36), P(.8, .4), P(.76, .56), 30)
    face = bez(P(.76, .56), P(.72, .7), P(.66, .2), P(.9, 0), 40)
    edge = back + lip_out[1:]
    body = edge + lip_in[1:] + face[1:]
    d_body = poly(body, True)
    out = [f'<defs><clipPath id="{wid}"><path d="{d_body}"/></clipPath></defs>',
           f'<path d="{d_body}" fill="{ink}"/>']
    # carved lines: copies of the outer edge shrinking toward the barrel, so
    # they run up the back and spiral over into the curl
    ax, ay = P(.82, .5)
    carved = []
    for k in range(1, lines + 1):
        sc = 1 - k * (.78 / (lines + 1))
        pts = [(ax + (x - ax) * sc, ay + (y - ay) * sc) for x, y in edge[4:]]
        sw = 5.6 - 3.2 * k / lines
        carved.append(f'<path d="{poly(pts)}" fill="none" stroke="{color}" stroke-width="{f(sw)}" stroke-linecap="round" opacity="{f(1 - .4 * k / lines)}"/>')
    # the steep wall under the curl: lines that follow the face down to the trough
    for k in range(1, 6):
        dx = (1 if flip else -1) * W * .038 * k
        pts = [(x + dx, y) for x, y in face[3:]]
        carved.append(f'<path d="{poly(pts)}" fill="none" stroke="{color}" stroke-width="{f(4.2 - .5 * k)}" stroke-linecap="round" opacity="{f(.9 - .1 * k)}"/>')
    out.append(f'<g clip-path="url(#{wid})">' + "".join(carved) + "</g>")
    # foam band along the crest, from the shoulder to the lip tip
    crest = edge[int(len(back) * .72):]
    inner = [(ax + (x - ax) * .9, ay + (y - ay) * .9) for x, y in crest]
    out.append(f'<path d="{poly(crest + list(reversed(inner)), True)}" fill="{color}" clip-path="url(#{wid})"/>')
    out.append(f'<path d="{d_body}" fill="none" stroke="{color}" stroke-width="7" stroke-linejoin="round"/>')
    # foam claws hanging from the lip, curling forward
    tip_seg = lip_out[int(len(lip_out) * .45):]
    dirx = -1 if flip else 1
    for j, (bx, by) in enumerate(tip_seg[::5]):
        L = W * (.045 + .012 * (j % 2))
        pts = bez((bx, by), (bx + dirx * L * .9, by - L * .2), (bx + dirx * L * 1.1, by + L * .7), (bx + dirx * L * .45, by + L * .75), 12)
        out.append(f'<path d="{poly(pts)}" fill="none" stroke="{color}" stroke-width="6" stroke-linecap="round"/>')
        out.append(f'<circle cx="{f(pts[-1][0])}" cy="{f(pts[-1][1])}" r="5" fill="{color}"/>')
    # spray beyond the lip
    for j, (u, v, r) in enumerate([(1.02, .86, 6), (1.06, .74, 4.5), (1.0, .99, 4), (1.09, .9, 3.5), (.97, 1.08, 3)]):
        x, y = P(u, v)
        out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{r}" fill="{color}"/>')
    # inside the barrel: a curl echo
    cx, cy = P(.84, .47)
    rr = W * .05
    arc = [(cx + dirx * rr * math.cos(a), cy - rr * math.sin(a)) for a in [math.pi * (1.1 - 1.3 * i / 30) for i in range(31)]]
    out.append(f'<path d="{poly(arc)}" fill="none" stroke="{color}" stroke-width="3.5" stroke-linecap="round" opacity=".8"/>')
    # sea lines at the base
    for i, y in enumerate([base + 24, base + 50, base + 76]):
        amp = 8 - i * 2
        pts = [(x0 - 80 + j * 12, y + amp * math.sin(j * .7 + i)) for j in range(int((W + 160) / 12) + 1)]
        out.append(f'<path d="{poly(pts)}" fill="none" stroke="{color}" stroke-width="{4 - i}" stroke-linecap="round" opacity="{f(.8 - .2 * i)}"/>')
    return "\n".join(out), back


def barrel_wave(cx, base, size, color=BONE, ink=INK, seed=7, flip=False, collect=None):
    """Engraved breaking wave built around a round barrel, after classic
    etchings: a rising wall, lines that wrap the hollow, a whitewater crest
    with a rough edge, a foam curtain pouring off the lip, and spray.
    (cx, base) is the bottom centre; size is the overall height."""
    import random
    rnd = random.Random(seed)
    H = size
    sx = -1 if flip else 1
    tx, ty = cx + sx * H * .1, base - H * .45  # barrel centre
    R = H * .27
    th = H * .2  # wall thickness above the barrel

    def ang(a, r):
        return (tx + sx * r * math.cos(a), ty - r * math.sin(a))

    # outer edge of the wall: from the base on the left, up and around the barrel
    outer = bez((cx - sx * H * .62, base), (cx - sx * H * .38, base - H * .08), (cx - sx * H * .36, base - H * .55), ang(math.radians(150), R + th * .9), 40)
    outer += [ang(math.radians(150 - i * 4), R + th * (.9 + .1 * math.sin(i / 6))) for i in range(1, 41)]  # over the top to the right
    lip = ang(math.radians(-6), R * 1.02)
    outer += bez(outer[-1], ang(math.radians(-5), R + th * 1.1), ang(math.radians(-25), R + th * .6), lip, 16)[1:]
    # the barrel's edge back around to the bottom left, then the trough
    tube = [ang(math.radians(-6 + i * 5.5), R) for i in range(0, 41)]
    trough = bez(tube[-1], (tube[-1][0] + sx * H * .05, base - H * .05), (cx + sx * H * .25, base), (cx + sx * H * .62, base), 30)
    body = outer + tube[1:] + trough[1:]
    if collect is not None:
        collect.extend(outer)
    d = poly(body, True)
    wid = f"bw{seed}"
    out = [f'<defs><clipPath id="{wid}"><path d="{d}"/></clipPath></defs>', f'<path d="{d}" fill="{ink}"/>']
    g = []
    # engraved lines wrapping the barrel through the wall
    for k in range(1, 15):
        r = R + th * 1.25 * k / 14
        j = rnd.uniform(-2, 2)
        pts = [ang(math.radians(a), r + j + 1.2 * math.sin(a / 23 + k)) for a in range(-30, 236, 3)]
        g.append(f'<path d="{poly(pts)}" fill="none" stroke="{color}" stroke-width="{f(3.6 - 1.4 * k / 14)}" stroke-linecap="round" opacity="{f(.95 - .35 * k / 14)}"/>')
    # lines running down the wall into the trough
    for k in range(1, 12):
        f_ = k / 12
        a = math.radians(160 + 60 * f_)
        start = ang(a, R + th * (1 - f_ * .5))
        end = (cx - sx * H * (.55 - .5 * f_), base)
        pts = bez(start, (start[0], start[1] + H * .1), (end[0] + sx * H * .05, end[1] - H * .12), end, 20)
        g.append(f'<path d="{poly(pts)}" fill="none" stroke="{color}" stroke-width="2.6" stroke-linecap="round" opacity="{f(.75 - .3 * f_)}"/>')
    out.append(f'<g clip-path="url(#{wid})">' + "".join(g) + "</g>")
    # inside the barrel: the hollow, with a few faint arcs
    for k, rr in enumerate((.82, .62)):
        pts = [ang(math.radians(a), R * rr) for a in range(10, 200, 4)]
        out.append(f'<path d="{poly(pts)}" fill="none" stroke="{color}" stroke-width="{2.5 - k}" opacity="{.45 - .15 * k}" stroke-linecap="round"/>')
    # outline without the flat bottom edge, so the wave rises out of the sea
    out.append(f'<path d="{poly(body)}" fill="none" stroke="{color}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>')
    # swell lines across the face in front of the barrel
    for k in range(1, 6):
        yy = base - H * .035 * k
        x_end = cx + sx * H * (.6 - .06 * k)
        x_start = tube[-1][0] + sx * H * (.06 + .05 * k)
        n = 14
        pts = [(x_start + (x_end - x_start) * i / n, yy + 2.5 * math.sin(i * 1.1 + k)) for i in range(n + 1)]
        out.append(f'<path d="{poly(pts)}" fill="none" stroke="{color}" stroke-width="2.2" stroke-linecap="round" opacity="{f(.6 - .08 * k)}" clip-path="url(#{wid})"/>')
    # whitewater crest: a rough band riding the top of the wall
    crest_out, crest_in = [], []
    for i in range(0, 61):
        a = math.radians(165 - i * 2.9)
        rough = rnd.uniform(-.05, .09) * th
        crest_out.append(ang(a, R + th * (1.02 + .12 * math.sin(i / 3)) + rough))
        crest_in.append(ang(a, R + th * (.62 + .08 * math.sin(i / 2.3)) + rnd.uniform(-.06, .06) * th))
    out.append(f'<path d="{poly(crest_out + list(reversed(crest_in)), True)}" fill="{color}"/>')
    # bubbly whitewater: overlapping round puffs along the crest's outer edge
    for i in range(0, 61, 2):
        a = math.radians(165 - i * 2.9)
        px, py = ang(a, R + th * rnd.uniform(.9, 1.06))
        out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(th * rnd.uniform(.1, .2))}" fill="{color}"/>')
    # dark pores in the foam so it reads as churning water
    for _ in range(70):
        a = math.radians(rnd.uniform(-2, 160))
        px, py = ang(a, R + th * rnd.uniform(.7, 1.0))
        out.append(f'<circle cx="{f(px)}" cy="{f(py)}" r="{f(rnd.uniform(1.2, 3))}" fill="{ink}" opacity=".85"/>')
    # stipple falling off the crest
    for _ in range(140):
        a = math.radians(rnd.uniform(-10, 160))
        r = R + th * rnd.uniform(.25, .62)
        x, y = ang(a, r)
        out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(1.2, 3.2))}" fill="{color}" opacity="{f(rnd.uniform(.5, 1))}" clip-path="url(#{wid})"/>')
    # foam curtain pouring off the lip into the barrel
    for i in range(7):
        a0 = math.radians(rnd.uniform(-8, 22))
        x0_, y0_ = ang(a0, R * rnd.uniform(.98, 1.1))
        L = H * rnd.uniform(.08, .2)
        pts = bez((x0_, y0_), (x0_ - sx * H * .01, y0_ + L * .3), (x0_ - sx * H * .03, y0_ + L * .7), (x0_ - sx * H * .025, y0_ + L), 10)
        out.append(f'<path d="{poly(pts)}" fill="none" stroke="{color}" stroke-width="{f(rnd.uniform(2.5, 5))}" stroke-linecap="round" opacity=".9"/>')
    # spray thrown up and forward
    for _ in range(46):
        a = math.radians(rnd.uniform(-5, 70))
        r = R + th * rnd.uniform(1.15, 1.9)
        x, y = ang(a, r)
        out.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(rnd.uniform(1.5, 4.2))}" fill="{color}"/>')
    # sea lines
    for i, y in enumerate([base, base + 26, base + 52]):
        amp = 6 - i * 1.5
        span = H * (1.7 - .25 * i)
        pts = [(cx - span / 2 + j * 12, y + amp * math.sin(j * .7 + i)) for j in range(int(span / 12) + 1)]
        out.append(f'<path d="{poly(pts)}" fill="none" stroke="{color}" stroke-width="{4 - i}" stroke-linecap="round" opacity="{f(.8 - .2 * i)}"/>')
    return "\n".join(out)
