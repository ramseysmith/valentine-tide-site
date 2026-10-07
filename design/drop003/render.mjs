#!/usr/bin/env node
/* =========================================================
   Drop 003 swim set: renders every print panel at Printful's
   exact canvas size into assets/prints/drop003/.

   Positions are measured on Printful's 3000 px templates and
   mapped onto each canvas (the template's print area covers the
   whole canvas). Re-run after any design change:
     node design/drop003/render.mjs
   Needs Playwright with Chromium.
   ========================================================= */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const out = path.join(root, "assets/prints/drop003");
const url = (p) => "file://" + path.join(root, p);

const BASE = "#121212";
const BONE = "#f5f0e8";

/* Template (3000 x 3000) print area -> canvas mapping per product. */
const RASH = { canvas: [4200, 5400], area: { left: 334, top: 0, width: 2332, height: 3000 } };
const SWIM = { canvas: [3750, 5250], area: { left: 429, top: 0, width: 2143, height: 3000 } };

/* Each panel lists graphics in template coordinates: cx, cy = center, w = width. */
const PANELS = [
  { name: "rash-front", spec: RASH, items: [{ kind: "mark", cx: 1500, cy: 1150, w: 430 }] },
  { name: "rash-back", spec: RASH, items: [{ kind: "wordmark", cx: 1500, cy: 930, w: 860 }, { kind: "tag", text: "Surf the Shadows", cx: 1500, cy: 1090, size: 52 }] },
  { name: "rash-sleeve-left", spec: RASH, items: [{ kind: "vtext", text: "Surf the Shadows", cx: 1500, cy: 1850, size: 120 }] },
  { name: "rash-sleeve-right", spec: RASH, items: [{ kind: "mark", cx: 1500, cy: 2350, w: 230 }] },
  { name: "swim-front", spec: SWIM, items: [{ kind: "mark", cx: 1800, cy: 1720, w: 260 }] },
  { name: "swim-back", spec: SWIM, items: [{ kind: "wordmark", cx: 1500, cy: 1980, w: 820 }] },
];

/* Tonal thorns and wave crests, with a few blood red thorn tips. */
const patternSvg = (scale) => `
<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
  <defs>
    <pattern id="p" width="${360 * scale}" height="${360 * scale}" patternUnits="userSpaceOnUse">
      <g transform="scale(${scale})" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M-20 120c40 0 60-30 100-30s50 30 90 30 60-30 100-30 50 30 90 30" stroke="${BONE}" stroke-opacity=".07" stroke-width="3"/>
        <path d="M80 90c-6-16 6-30 22-24" stroke="${BONE}" stroke-opacity=".07" stroke-width="3"/>
        <path d="M260 90c-6-16 6-30 22-24" stroke="${BONE}" stroke-opacity=".07" stroke-width="3"/>
        <path d="M0 330C70 300 110 250 170 240S290 270 360 210" stroke="${BONE}" stroke-opacity=".06" stroke-width="3"/>
        <path d="M60 296l-8-22M118 258l2-24M178 240l-6-22M236 254l10-20M300 240l2-24" stroke="${BONE}" stroke-opacity=".07" stroke-width="3"/>
        <path d="M118 258l2-24M300 240l2-24" stroke="#8b0000" stroke-opacity=".55" stroke-width="3"/>
        <circle cx="200" cy="30" r="3" fill="${BONE}" fill-opacity=".06" stroke="none"/>
        <circle cx="40" cy="200" r="2.5" fill="${BONE}" fill-opacity=".05" stroke="none"/>
      </g>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="${BASE}"/>
  <rect width="100%" height="100%" fill="url(#p)"/>
</svg>`;

function html(panel) {
  const [W, H] = panel.spec.canvas;
  const a = panel.spec.area;
  const sx = W / a.width;
  const sy = H / a.height;
  const X = (tx) => (tx - a.left) * sx;
  const Y = (ty) => (ty - a.top) * sy;
  const items = panel.items
    .map((it) => {
      if (it.kind === "mark" || it.kind === "wordmark") {
        const src = it.kind === "mark" ? url("design/drop003/skull-heart-print.png") : url("assets/wordmark.png");
        const w = it.w * sx;
        return `<img src="${src}" style="position:absolute;width:${w}px;left:${X(it.cx) - w / 2}px;top:${Y(it.cy)}px;transform:translateY(-50%)">`;
      }
      if (it.kind === "tag") {
        return `<div style="position:absolute;left:0;width:${W}px;top:${Y(it.cy)}px;transform:translateY(-50%);text-align:center;font:${it.size * sx}px Pirata;letter-spacing:.3em;color:${BONE};text-transform:uppercase">${it.text}</div>`;
      }
      if (it.kind === "vtext") {
        return `<div style="position:absolute;left:${X(it.cx)}px;top:${Y(it.cy)}px;transform:translate(-50%,-50%) rotate(90deg);white-space:nowrap;font:${it.size * sx}px Pirata;letter-spacing:.32em;color:${BONE};text-transform:uppercase">${it.text}</div>`;
      }
      return "";
    })
    .join("");
  return `<!doctype html><html><head><style>
    @font-face{font-family:Pirata;src:url(${url("design/drop003/pirata-one.woff2")})}
    html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${BASE}}
    .bg{position:absolute;inset:0}
  </style></head><body><div class="bg">${patternSvg(sx)}</div>${items}</body></html>`;
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const panel of PANELS) {
  const [W, H] = panel.spec.canvas;
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const file = path.join(here, `.render-${panel.name}.html`);
  const { writeFile, unlink } = await import("node:fs/promises");
  await writeFile(file, html(panel));
  await page.goto("file://" + file);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(out, `${panel.name}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  await unlink(file);
  await page.close();
  console.log(`rendered ${panel.name} ${W}x${H}`);
}
await browser.close();
