#!/usr/bin/env node
/* =========================================================
   Renders photo mockups of each store product with Printful's
   mockup generator, using the exact print file and placement
   already on the store product. Saves every style Printful
   offers (flat, folded, on model, lifestyle...) to
   mockups/<sku>/ so the best ones can be picked for the site.

   Usage (from the repo root):
     PRINTFUL_TOKEN=xxx node worker/scripts/make-mockups.mjs [sku ...]
   ========================================================= */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const API = "https://api.printful.com";
const headers = { Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}`, "Content-Type": "application/json" };
if (process.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;
if (!process.env.PRINTFUL_TOKEN) die("Set PRINTFUL_TOKEN");

const catalog = JSON.parse(await readFile(path.join(root, "catalog.json"), "utf8"));
const wanted = process.argv.slice(2);
const products = catalog.products.filter((p) => p.active && p.printful?.syncProductId && (!wanted.length || wanted.includes(p.sku)));
const summary = [];

for (const product of products) {
  const store = (await pf("GET", `/store/products/${product.printful.syncProductId}`)).result;
  // One size is enough: every size is the same color and print.
  const sv = store.sync_variants.find((v) => /\/ M$/.test(v.name)) || store.sync_variants[0];
  const blankId = sv.product.product_id;
  const printFile = sv.files.find((f) => f.type !== "preview");
  if (!printFile) die(`${product.sku}: no print file on the store product`);

  const info = (await pf("GET", `/mockup-generator/printfiles/${blankId}`)).result;
  const optionGroups = info.option_groups || [];
  // Store products report the main print as "default"; the mockup generator
  // wants the blank's real front placement (front, front_dtf, ...).
  const offered = Object.keys(info.available_placements || {});
  if (!offered.includes(printFile.type)) {
    printFile.type = ["front", "front_dtf", "front_large"].find((k) => offered.includes(k)) || offered.find((k) => k.startsWith("front")) || printFile.type;
  }
  console.log(`${product.sku}: blank #${blankId}, placement ${printFile.type}, styles: ${optionGroups.join(", ") || "default"}`);

  if (!printFile.position) printFile.position = await positionFor(product, info, printFile.type);

  const task = (
    await pf("POST", `/mockup-generator/create-task/${blankId}`, {
      variant_ids: [sv.product.variant_id],
      format: "jpg",
      width: 1600,
      option_groups: optionGroups,
      files: [{ placement: printFile.type, image_url: printFile.url, position: printFile.position }],
    })
  ).result;

  let result;
  for (let i = 0; i < 40; i++) {
    await sleep(6000);
    result = (await pf("GET", `/mockup-generator/task?task_key=${encodeURIComponent(task.task_key)}`)).result;
    if (result.status !== "pending") break;
  }
  if (result.status !== "completed") die(`${product.sku}: mockup task ${result.status} ${result.error || ""}`);

  const dir = path.join(root, "mockups", product.sku);
  await mkdir(dir, { recursive: true });
  const images = [];
  for (const m of result.mockups) {
    images.push({ name: `${m.placement}-main`, url: m.mockup_url });
    for (const e of m.extra || []) images.push({ name: `${e.option_group || "extra"}-${e.option || e.title}`, url: e.url });
  }
  const used = new Set();
  for (const img of images) {
    let name = img.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    while (used.has(name)) name += "_2";
    used.add(name);
    const res = await fetch(img.url);
    if (!res.ok) continue;
    await writeFile(path.join(dir, `${name}.jpg`), Buffer.from(await res.arrayBuffer()));
  }
  summary.push(`${product.sku}: ${used.size} mockups`);
  console.log(`${product.sku}: saved ${used.size} mockups to mockups/${product.sku}/`);
  await sleep(15000); // the mockup generator is rate limited
}
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Mockups::${summary.join(" | ")}`);

/* Same placement maths as setup-printful-product.mjs: catalog width and top
   offset in inches, scaled to this blank's print area. */
async function positionFor(product, info, placementType) {
  let area = { width: 1800, height: 2400, dpi: 150 };
  const id = info.variant_printfiles?.[0]?.placements?.[placementType];
  const file = (info.printfiles || []).find((f) => f.printfile_id === id);
  if (file) area = { width: file.width, height: file.height, dpi: file.dpi || 150 };
  const buf = await readFile(path.join(root, product.printFile));
  const imgW = buf.readUInt32BE(16), imgH = buf.readUInt32BE(20);
  const place = product.printful.placement || { widthInches: 10, topInches: 1.2 };
  const width = Math.min(area.width, Math.round(place.widthInches * area.dpi));
  const height = Math.round((width * imgH) / imgW);
  const top = Math.min(Math.max(0, area.height - height), Math.round(place.topInches * area.dpi));
  return { area_width: area.width, area_height: area.height, width, height, top, left: Math.round((area.width - width) / 2) };
}

async function pf(method, p, body) {
  const res = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) die(`Printful ${method} ${p} failed ${res.status}: ${JSON.stringify(data.error || data.result || data)}`);
  return data;
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
function die(msg) {
  console.error(msg);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Mockups::${String(msg).replace(/\s+/g, " ").slice(0, 900)}`);
  process.exit(1);
}
