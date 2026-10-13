#!/usr/bin/env node
/* Renders a 1200x630 link preview card per product into assets/og/<slug>.jpg:
   the product photo inside the thorn arch, name, cut and price.
   Needs Playwright with Chromium (present in Claude cloud sessions):
     node tools/og-cards.mjs && node tools/build-shop.mjs */

import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
let chromium;
for (const p of ["playwright", "/opt/npm-tools/node_modules/playwright"]) {
  try {
    ({ chromium } = require(p));
    break;
  } catch {}
}
if (!chromium) throw new Error("Playwright is not installed");

const catalog = JSON.parse(readFileSync(join(ROOT, "catalog.json"), "utf8"));
const slugOf = (p) => p.slug || p.sku.replace(/^vt-/, "").replace(/-black$/, "");
const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
// Served over a throwaway local server: CSS masks refuse file URLs.
const server = createServer((req, res) => {
  const path = join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  try {
    const body = readFileSync(path);
    const type = { ".svg": "image/svg+xml", ".html": "text/html", ".woff2": "font/woff2", ".png": "image/png" }[extname(path)] || "image/jpeg";
    res.writeHead(200, { "Content-Type": type }).end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0);
const base = `http://localhost:${server.address().port}`;
const file = (rel) => `${base}/${rel}`;

const card = (p) => {
  const g = p.gallery && p.gallery.length ? p.gallery : [{ src: p.image }];
  // A worn photo reads better small than a flat product shot.
  const photo = (g.find((x) => /model-front|model-1|model\.jpg/.test(x.src)) || g[0]).src;
  return `<!doctype html><html><head><style>
  @font-face { font-family: Pirata; src: url(${file("assets/fonts/pirata-one.woff2")}); }
  @font-face { font-family: Archivo; src: url(${file("assets/fonts/archivo-var.woff2")}); font-weight: 100 900; font-stretch: 62% 125%; }
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #161616; color: #f5f0e8; font-family: Archivo;
    background: radial-gradient(520px 420px at 300px 330px, rgba(139,0,0,.45), transparent 70%), #161616; display: flex; align-items: center; }
  .arch { position: relative; width: 420px; height: 567px; margin: 30px 50px 0 90px; flex: none; }
  .arch img.photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 20%; background: #f3eee6;
    -webkit-mask: url(${file("assets/illustrations/arch-mask.svg")}) center / 100% 100% no-repeat; }
  .arch img.frame { position: absolute; inset: 0; width: 100%; height: 100%; }
  .copy { flex: 1; padding-right: 70px; }
  .wm { width: 300px; }
  h1 { font-family: Pirata; font-weight: 400; font-size: 84px; line-height: .92; margin-top: 34px; }
  .sub { margin-top: 18px; font-size: 27px; color: rgba(245,240,232,.72); font-stretch: 85%; }
  .price { margin-top: 26px; display: inline-block; padding: 10px 18px; background: #8b0000; font-size: 34px; font-weight: 700; font-stretch: 85%; }
  .fine { margin-top: 26px; font-size: 22px; color: rgba(245,240,232,.6); font-stretch: 85%; }
  </style></head><body>
  <div class="arch"><img class="photo" src="${file(photo)}"><img class="frame" src="${file("assets/illustrations/hero-arch.svg")}"></div>
  <div class="copy">
    <img class="wm" src="${file("assets/wordmark.png")}">
    <h1>${p.name}</h1>
    <p class="sub">${p.subtitle}</p>
    <p class="price">${money(p.priceCents)}</p>
    <p class="fine">Printed to order. Free US shipping over ${money(catalog.shipping.freeOverCents)}.</p>
  </div></body></html>`;
};

mkdirSync(join(ROOT, "assets/og"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const p of catalog.products.filter((x) => x.active)) {
  const tmp = join(ROOT, "assets/og", `.${slugOf(p)}.html`);
  (await import("node:fs")).writeFileSync(tmp, card(p));
  await page.goto(file(`assets/og/.${slugOf(p)}.html`));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(ROOT, "assets/og", `${slugOf(p)}.jpg`), type: "jpeg", quality: 86 });
  (await import("node:fs")).unlinkSync(tmp);
  console.log(`assets/og/${slugOf(p)}.jpg`);
}
await browser.close();
server.close();
