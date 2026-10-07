#!/usr/bin/env node
/* =========================================================
   Creates a Printful store product for an all over print
   (cut and sew) catalog entry: every size gets every panel
   file from catalog.json printful.files, plus any options
   (black stitching). Saves the sync IDs back to catalog.json.
   Safe to re-run: an existing store product is reused.

   Usage (repo root):
     PRINTFUL_TOKEN=xxx node worker/scripts/setup-aop-product.mjs <sku> [--dry-run]
   ========================================================= */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = path.join(root, "catalog.json");
const SITE = process.env.SITE_URL || "https://valentinetide.com";
const API = "https://api.printful.com";
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const sku = args.find((a) => !a.startsWith("--"));
const headers = { Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}`, "Content-Type": "application/json" };
if (process.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;
if (!sku) die("Pass a product sku");
if (!process.env.PRINTFUL_TOKEN) die("Set PRINTFUL_TOKEN");

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const product = catalog.products.find((p) => p.sku === sku);
if (!product) die(`No product ${sku} in catalog.json`);
const pf = product.printful;
if (pf.type !== "aop") die(`${sku} is not an all over print product`);

const blank = (await pfSend("GET", `/products/${pf.catalogProductId}`)).result;
const bySize = new Map(blank.variants.map((v) => [v.size, v]));
const missing = product.variants.filter((v) => !bySize.has(v.size)).map((v) => v.size);
if (missing.length) console.warn(`Not offered: ${missing.join(", ")} (skipped)`);

const files = Object.entries(pf.files).map(([type, file]) => ({ type, url: `${SITE}/${file}` }));
const options = Object.entries(pf.options || {}).map(([id, value]) => ({ id, value }));
const payload = {
  sync_product: { external_id: product.sku, name: `Valentine Tide ${product.name} (${product.subtitle})`, thumbnail: `${SITE}/${pf.files.front}` },
  sync_variants: product.variants
    .filter((v) => bySize.has(v.size))
    .map((v) => ({
      external_id: `${product.sku}-${v.size}`.toLowerCase(),
      variant_id: bySize.get(v.size).id,
      retail_price: ((product.priceCents + (v.surchargeCents || 0)) / 100).toFixed(2),
      files,
      options,
    })),
};

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

let created = await pfTry(`/store/products/@${product.sku}`);
if (created) {
  created = created.sync_product;
  console.log(`Store product #${created.id} already exists, reusing it`);
} else {
  created = (await pfSend("POST", "/store/products", payload)).result;
  console.log(`Created store product #${created.id}`);
}

const full = (await pfSend("GET", `/store/products/${created.id}`)).result;
const idByExternal = new Map(full.sync_variants.map((sv) => [sv.external_id, sv.id]));
pf.syncProductId = created.id;
for (const v of product.variants) {
  const id = idByExternal.get(`${product.sku}-${v.size}`.toLowerCase());
  if (id) v.printfulSyncVariantId = id;
}
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
console.log(`${sku}: saved ${idByExternal.size} variant IDs`);

async function pfTry(p) {
  const res = await fetch(API + p, { headers });
  if (!res.ok) return null;
  return (await res.json()).result;
}
async function pfSend(method, p, body) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) die(`Printful ${method} ${p} failed ${res.status}: ${JSON.stringify(data.error || data.result || data)}`);
    return data;
  }
  die(`Printful ${method} ${p} kept rate limiting`);
}
function die(msg) {
  console.error(msg);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Printful setup::${String(msg).replace(/\s+/g, " ").slice(0, 900)}`);
  process.exit(1);
}
