#!/usr/bin/env node
/* =========================================================
   Pulls each product's garment measurements (inches) from
   Printful's size guide and saves them to catalog.json as
   sizeChart, so the shop can show a real size chart.

   Usage (from the repo root):
     PRINTFUL_TOKEN=xxx node worker/scripts/fetch-size-charts.mjs
   ========================================================= */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = path.join(root, "catalog.json");
const headers = { Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}` };
if (process.env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = process.env.PRINTFUL_STORE_ID;
if (!process.env.PRINTFUL_TOKEN) die("Set PRINTFUL_TOKEN");

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const notes = [];

for (const product of catalog.products.filter((p) => p.printful?.syncProductId)) {
  const store = (await pf(`/store/products/${product.printful.syncProductId}`)).result;
  const blankId = store.sync_variants[0].product.product_id;
  const guide = (await pf(`/products/${blankId}/sizes?unit=inches`)).result;
  const tables = guide.size_tables || [];
  // Garment measurements, unless they're labelled only with diagram letters
  // (A, B, C...). Then the body measurement chart is the useful one.
  const lettered = (t) => (t.measurements || []).every((m) => /^[A-Z]$/.test(String(m.type_label || "").trim()));
  const garment = tables.find((t) => t.type === "product_measure" && !lettered(t));
  const body = tables.find((t) => t.type === "measure_yourself" && !lettered(t));
  const table = garment || body || tables[0];
  if (!table) {
    notes.push(`${product.sku}: no size table`);
    continue;
  }
  const ours = new Set(product.variants.map((v) => v.size));
  const rows = (table.measurements || [])
    .map((m) => ({
      label: m.type_label,
      values: Object.fromEntries(
        (m.values || [])
          .filter((v) => ours.has(v.size))
          .map((v) => [v.size, v.value ?? (v.min_value && v.max_value ? `${v.min_value} to ${v.max_value}` : "")])
      ),
    }))
    .filter((r) => Object.keys(r.values).length);
  product.sizeChart = { kind: table === garment ? "garment" : "body", unit: table.unit || "inches", note: stripHtml(table.description || ""), rows };
  notes.push(`${product.sku}: ${rows.map((r) => r.label).join(", ")}`);
}

await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n");
console.log(notes.join("\n"));
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=Size charts::${notes.join(" | ")}`);

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);
}
async function pf(p) {
  const res = await fetch("https://api.printful.com" + p, { headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) die(`Printful GET ${p} failed ${res.status}: ${JSON.stringify(data.error || data.result || data)}`);
  return data;
}
function die(msg) {
  console.error(msg);
  if (process.env.GITHUB_ACTIONS) console.log(`::error title=Size charts::${String(msg).replace(/\s+/g, " ").slice(0, 900)}`);
  process.exit(1);
}
