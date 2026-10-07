#!/usr/bin/env node
/* Scans Printful's catalog for product types that could join the line
   (swim, beach, layers, hats, accessories) and records base cost and
   whether black is offered. Writes research/catalog-scan.json.

   Usage: PRINTFUL_TOKEN=xxx node worker/scripts/catalog-scan.mjs */

import { mkdir, writeFile } from "node:fs/promises";

const headers = { Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}` };
const KEYWORDS = /swim|bikini|rash|board ?short|trunk|towel|bucket|hat|cap|beanie|hoodie|zip|long ?sleeve|crewneck|sweatshirt|poncho|tote|blanket|beach|bandana|sock|fanny|legging|tank|dress|sarong|jacket|windbreaker|shorts|crop|bag|patch|sticker|poster|flag|mug|tumbler|bottle/i;

const all = (await pf("/products")).result.filter((p) => !p.is_discontinued && KEYWORDS.test(`${p.title} ${p.type_name}`));
const out = [];
for (const p of all) {
  try {
    const d = (await pf(`/products/${p.id}`)).result;
    const vs = d.variants.filter((v) => v.in_stock !== false);
    const prices = vs.map((v) => Number(v.price)).filter(Boolean);
    const colors = [...new Set(vs.map((v) => v.color).filter(Boolean))];
    out.push({
      id: p.id,
      title: p.title,
      type: p.type_name,
      brand: p.brand,
      model: p.model,
      techniques: (p.techniques || []).map((t) => t.display_name),
      min: Math.min(...prices),
      max: Math.max(...prices),
      black: colors.some((c) => /black/i.test(c)),
      allOver: /all.?over|aop|sublimation|cut ?& ?sew/i.test(`${p.title} ${p.type_name} ${(p.techniques || []).map((t) => t.key).join(" ")}`),
      colors: colors.length,
    });
  } catch (e) {
    console.warn(`skip ${p.id}: ${e.message}`);
  }
  await new Promise((r) => setTimeout(r, 400));
}
await mkdir("research", { recursive: true });
await writeFile("research/catalog-scan.json", JSON.stringify(out, null, 1));
console.log(`::notice title=Catalog scan::${out.length} products scanned`);

async function pf(path) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch("https://api.printful.com" + path, { headers });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 15000)); continue; }
    const data = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data.error || data.result)}`);
    return data;
  }
  throw new Error("rate limited");
}
