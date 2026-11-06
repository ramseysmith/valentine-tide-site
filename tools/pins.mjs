#!/usr/bin/env node
/* Renders 1000x1500 Pinterest pins into assets/pins/<name>.jpg: one per product, one for
   the gift guide and one for the swim set. Pass names to render only those. Pin copy (titles, descriptions, links) lives in
   graysmith_labs_agent docs/valentine-tide/pinterest-pins.md.
   Needs Playwright with Chromium (present in Claude cloud sessions):
     node tools/pins.mjs */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
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
const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const bySku = (sku) => catalog.products.find((p) => p.sku === sku && p.active);
const free = money(catalog.shipping.freeOverCents);

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

const style = `
  @font-face { font-family: Pirata; src: url(${file("assets/fonts/pirata-one.woff2")}); }
  @font-face { font-family: Archivo; src: url(${file("assets/fonts/archivo-var.woff2")}); font-weight: 100 900; font-stretch: 62% 125%; }
  * { margin: 0; box-sizing: border-box; }
  body { width: 1000px; height: 1500px; overflow: hidden; color: #f5f0e8; font-family: Archivo; text-align: center;
    background: radial-gradient(700px 640px at 500px 520px, rgba(139,0,0,.42), transparent 70%), #161616; }
  .arch { position: relative; margin: 70px auto 0; }
  .arch img.photo { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 8%; background: #f3eee6;
    -webkit-mask: url(${file("assets/illustrations/arch-mask.svg")}) center / 100% 100% no-repeat; }
  .arch img.frame { position: absolute; inset: 0; width: 100%; height: 100%; }
  .pair { display: flex; justify-content: center; gap: 36px; margin-top: 90px; }
  .wm { width: 380px; margin-top: 44px; }
  h1 { font-family: Pirata; font-weight: 400; font-size: 104px; line-height: .95; margin-top: 18px; padding: 0 60px; }
  .sub { margin-top: 18px; font-size: 34px; color: rgba(245,240,232,.76); font-stretch: 85%; padding: 0 80px; }
  .tag { margin-top: 30px; display: inline-block; padding: 12px 24px; background: #8b0000; font-size: 34px; font-weight: 700; font-stretch: 85%; }
  .url { position: absolute; left: 0; right: 0; bottom: 46px; font-size: 28px; letter-spacing: .14em; color: rgba(245,240,232,.62); font-stretch: 85%; }
`;

const arch = (photo, w, h) =>
  `<div class="arch" style="width:${w}px;height:${h}px"><img class="photo" src="${file(photo)}"><img class="frame" src="${file("assets/illustrations/hero-arch.svg")}"></div>`;

const page = (inner) => `<!doctype html><html><head><style>${style}</style></head><body>${inner}<p class="url">VALENTINETIDE.COM</p></body></html>`;

const tee = (p, photo) =>
  page(`${arch(photo, 640, 864)}
  <img class="wm" src="${file("assets/wordmark.png")}">
  <h1>${p.name}</h1>
  <p class="sub">${p.subtitle}. Printed to order.</p>
  <p class="tag">Order by Dec 3 for Christmas</p>`);

const wordmark = bySku("vt-wordmark-tee-black");
const crop = bySku("vt-heartbreak-crop-black");

const pins = [
  ["wordmark-tee", tee(wordmark, "assets/lifestyle/wordmark-tee-rocks.jpg")],
  ["heartbreak-crop", tee(crop, "assets/lifestyle/heartbreak-crop-rocks.jpg")],
  [
    "gift-guide",
    page(`<div class="pair">${arch("assets/lifestyle/wordmark-tee-rocks.jpg", 420, 567)}${arch("assets/lifestyle/heartbreak-crop-rocks.jpg", 420, 567)}</div>
  <img class="wm" src="${file("assets/wordmark.png")}">
  <h1>Gifts for the goth who surfs</h1>
  <p class="sub">Black tees and swimwear, printed to order. Free US shipping over ${free}.</p>
  <p class="tag">Order by Dec 3 for Christmas</p>`),
  ],
  ["rash-womens", tee(bySku("vt-night-session-rash-womens"), "assets/lifestyle/rash-guard-dusk.jpg")],
  ["rash-mens", tee(bySku("vt-night-session-rash-mens"), "assets/lifestyle/rash-mens-rocks.jpg")],
  ["one-piece", tee(bySku("vt-night-session-one-piece"), "assets/lifestyle/one-piece-rocks.jpg")],
  [
    "swim-set",
    page(`<div class="pair">${arch("assets/lifestyle/rash-mens-rocks.jpg", 420, 567)}${arch("assets/lifestyle/one-piece-rocks.jpg", 420, 567)}</div>
  <img class="wm" src="${file("assets/wordmark.png")}">
  <h1>Night Session swim</h1>
  <p class="sub">Rash guards and a one piece for the goth who paddles out all year. Printed to order.</p>
  <p class="tag">Order by Dec 3 for Christmas</p>`),
  ],
];

// Pass pin names to render only those: node tools/pins.mjs one-piece swim-set
const only = process.argv.slice(2);
const todo = only.length ? pins.filter(([n]) => only.includes(n)) : pins;

mkdirSync(join(ROOT, "assets/pins"), { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
for (const [name, html] of todo) {
  const tmp = join(ROOT, "assets/pins", `.${name}.html`);
  writeFileSync(tmp, html);
  await tab.goto(file(`assets/pins/.${name}.html`));
  await tab.evaluate(() => document.fonts.ready);
  await tab.waitForTimeout(300);
  await tab.screenshot({ path: join(ROOT, "assets/pins", `${name}.jpg`), type: "jpeg", quality: 86 });
  unlinkSync(tmp);
  console.log(`assets/pins/${name}.jpg`);
}
await browser.close();
server.close();
