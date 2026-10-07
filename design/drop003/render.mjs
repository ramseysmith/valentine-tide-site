#!/usr/bin/env node
/* =========================================================
   Drop 003 swim set: renders every print panel at Printful's
   exact canvas size. The layout lives in a JSON file (default
   layout.json; options/*.json hold alternatives to compare).

   Positions are measured on Printful's 3000 px templates and
   mapped onto each canvas (the template's print area covers the
   whole canvas). Re-run after any design change:
     cd design/drop003/art && python3 cut.py arch-source-x4.jpg && cd ../../..
     node design/drop003/render.mjs [layout.json] [out dir]
   Needs Playwright with Chromium.
   ========================================================= */

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const layoutPath = path.resolve(process.argv[2] || path.join(here, "layout.json"));
const layout = JSON.parse(await readFile(layoutPath, "utf8"));
// A new folder per artwork, so Printful fetches fresh files instead of reusing cached ones.
const out = path.resolve(root, process.argv[3] || layout.out);
const url = (p) => "file://" + path.join(root, p);

const BASE = "#121212";
const BONE = "#f5f0e8";

/* Template (3000 x 3000) print area -> canvas mapping per product. */
const RASH = { canvas: [4200, 5400], area: { left: 334, top: 0, width: 2332, height: 3000 } };
const SWIM = { canvas: [3750, 5250], area: { left: 429, top: 0, width: 2143, height: 3000 } };

/* Panels list graphics in template coordinates: cx, cy = center, w = width.
   "art" pieces come from design/drop003/art/cut.py. */
const SPECS = { rash: RASH, swim: SWIM };
const PANELS = layout.panels.map((p) => ({ ...p, spec: SPECS[p.spec] }));

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
      if (it.kind === "art") {
        const w = it.w * sx;
        const turn = `${it.flip ? " scaleX(-1)" : ""}${it.rotate ? ` rotate(${it.rotate}deg)` : ""}`;
        return `<img src="${url(it.src)}" style="position:absolute;width:${w}px;left:${X(it.cx) - w / 2}px;top:${Y(it.cy)}px;transform:translateY(-50%)${turn}">`;
      }
      if (it.kind === "tag") {
        return `<div style="position:absolute;left:0;width:${W}px;top:${Y(it.cy)}px;transform:translateY(-50%);text-align:center;font:${it.size * sx}px ${it.font || "Pirata"};letter-spacing:${it.spacing || ".3em"};color:${BONE};text-transform:uppercase">${it.text}</div>`;
      }
      if (it.kind === "vtext") {
        return `<div style="position:absolute;left:${X(it.cx)}px;top:${Y(it.cy)}px;transform:translate(-50%,-50%) rotate(90deg);white-space:nowrap;font:${it.size * sx}px ${it.font || "Pirata"};letter-spacing:${it.spacing || ".32em"};color:${BONE};text-transform:uppercase">${it.text}</div>`;
      }
      return "";
    })
    .join("");
  return `<!doctype html><html><head><style>
    @font-face{font-family:Pirata;src:url(${url("design/drop003/pirata-one.woff2")})}
    @font-face{font-family:Cinzel;src:url(${url("design/drop003/cinzel-500.woff2")})}
    html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:${BASE}}
    .bg{position:absolute;inset:0}
  </style></head><body><div class="bg">${patternSvg(sx)}</div>${items}</body></html>`;
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
for (const panel of PANELS.filter((p) => !process.env.ONLY || process.env.ONLY.split(",").includes(p.name))) {
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
