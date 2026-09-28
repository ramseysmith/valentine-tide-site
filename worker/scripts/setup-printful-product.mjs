#!/usr/bin/env node
/* =========================================================
   One time Printful setup for a catalog product.
   Finds the blank (e.g. Comfort Colors 1717, Black) in the
   Printful catalog, creates the store product with the print
   file, and writes the sync variant IDs into catalog.json.

   Usage (from the repo root):
     PRINTFUL_TOKEN=xxx [PRINTFUL_STORE_ID=123] \
       node worker/scripts/setup-printful-product.mjs vt-wordmark-tee-black

   Add --dry-run to see what it would create without creating it.
   ========================================================= */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = path.join(root, "catalog.json");
const SITE = process.env.SITE_URL || "https://valentinetide.com";
const API = "https://api.printful.com";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const sku = args.find((a) => !a.startsWith("--"));
if (!sku) die("Pass a product sku from catalog.json");
if (!process.env.PRINTFUL_TOKEN) die("Set PRINTFUL_TOKEN (Printful dashboard > Settings > API)");

const headers = { Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}`, "Content-Type": "application/json" };
if (process.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const product = catalog.products.find((p) => p.sku === sku);
if (!product) die(`No product ${sku} in catalog.json`);
const pf = product.printful;

// 1. Find the blank in Printful's catalog.
const all = (await pfGet("/products")).result;
const blank = all.find(
  (p) => (p.brand || "").toLowerCase().includes(pf.catalogBrand.toLowerCase()) && (p.model || "").includes(pf.catalogModel)
);
if (!blank) die(`Could not find ${pf.catalogBrand} ${pf.catalogModel} in the Printful catalog`);
console.log(`Blank: #${blank.id} ${blank.brand} ${blank.model}`);

// 2. Find the variant for each size in the chosen color.
const variants = (await pfGet(`/products/${blank.id}`)).result.variants.filter(
  (v) => (v.color || "").toLowerCase() === pf.color.toLowerCase()
);
const bySize = new Map(variants.map((v) => [v.size, v]));
const missing = product.variants.filter((v) => !bySize.has(v.size)).map((v) => v.size);
if (missing.length) console.warn(`Not offered in ${pf.color}: ${missing.join(", ")} (they will be skipped)`);

// 3. Work out where the print goes. catalog.json gives a width and a distance
//    below the top of the print area in inches; Printful's printfile for this
//    blank tells us the area size in pixels.
const printUrl = `${SITE}/${product.printFile}`;
const placement = pf.placement || { widthInches: 10, topInches: 1.2 };
const position = await computePosition(blank.id, placement, product.printFile);
console.log(`Placement: ${JSON.stringify(position)}`);
const syncVariants = product.variants
  .filter((v) => bySize.has(v.size))
  .map((v) => ({
    external_id: `${product.sku}-${v.size}`.toLowerCase(),
    variant_id: bySize.get(v.size).id,
    retail_price: ((product.priceCents + (v.surchargeCents || 0)) / 100).toFixed(2),
    files: [
      {
        type: "front",
        url: printUrl,
        position,
      },
    ],
  }));

const payload = {
  sync_product: { external_id: product.sku, name: `Valentine Tide ${product.name}`, thumbnail: `${SITE}/${product.image}` },
  sync_variants: syncVariants,
};

if (dryRun) {
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

const created = (await pfSend("POST", "/store/products", payload)).result;
console.log(`Created store product #${created.id}`);

// 4. Read back the sync variant IDs and save them.
const full = (await pfGet(`/store/products/${created.id}`)).result;
const idByExternal = new Map(full.sync_variants.map((sv) => [sv.external_id, sv.id]));
pf.syncProductId = created.id;
for (const v of product.variants) {
  const id = idByExternal.get(`${product.sku}-${v.size}`.toLowerCase());
  if (id) v.printfulSyncVariantId = id;
}
await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
console.log("catalog.json updated. Commit it and redeploy the worker (npm run deploy).");

async function computePosition(productId, placement, printFile) {
  // Default: Printful's standard 12 x 16 inch front area at 150 dpi.
  let area = { width: 1800, height: 2400, dpi: 150 };
  try {
    const pfData = (await pfGet(`/mockup-generator/printfiles/${productId}`)).result;
    const frontId = pfData.variant_printfiles?.[0]?.placements?.front;
    const file = pfData.printfiles.find((f) => f.printfile_id === frontId);
    if (file) area = { width: file.width, height: file.height, dpi: file.dpi || 150 };
  } catch {
    console.warn("Could not read the print area, using the 12 x 16 inch default");
  }
  const { width: imgW, height: imgH } = await pngSize(path.join(root, printFile));
  const width = Math.min(area.width, Math.round(placement.widthInches * area.dpi));
  const height = Math.round((width * imgH) / imgW);
  const top = Math.min(Math.max(0, area.height - height), Math.round(placement.topInches * area.dpi));
  return {
    area_width: area.width,
    area_height: area.height,
    width,
    height,
    top,
    left: Math.round((area.width - width) / 2),
    limit_to_print_area: true,
  };
}

async function pngSize(file) {
  const buf = await readFile(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function pfGet(p) {
  return pfSend("GET", p);
}
async function pfSend(method, p, body) {
  const res = await fetch(API + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) die(`Printful ${method} ${p} failed ${res.status}: ${JSON.stringify(data.error || data)}`);
  return data;
}
function die(msg) {
  console.error(msg);
  process.exit(1);
}
