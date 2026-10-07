#!/usr/bin/env node
/* Dumps Printful print templates (placements, printfile sizes per variant)
   and variant sizes/colors for catalog product IDs, to research/printfiles.json.
   Usage: PRINTFUL_TOKEN=xxx node worker/scripts/printfile-info.mjs 301 302 272 */

import { mkdir, writeFile } from "node:fs/promises";

const headers = { Authorization: `Bearer ${process.env.PRINTFUL_TOKEN}` };
const ids = process.argv.slice(2);
const out = {};
for (const id of ids) {
  const prod = (await pf(`/products/${id}`)).result;
  const pfiles = (await pf(`/mockup-generator/printfiles/${id}`)).result;
  const templates = await pf(`/mockup-generator/templates/${id}`).then((r) => r.result).catch(() => null);
  out[id] = {
    title: prod.product.title,
    techniques: prod.product.techniques,
    files: prod.product.files,
    options: prod.product.options,
    variants: prod.variants.map((v) => ({ id: v.id, size: v.size, color: v.color, price: v.price, in_stock: v.in_stock })),
    printfiles: pfiles,
    templates: templates && { version: templates.version, variant_mapping: templates.variant_mapping, templates: (templates.templates || []).map((t) => ({ template_id: t.template_id, placement: t.placement, image_url: t.image_url, background_url: t.background_url, template_width: t.template_width, template_height: t.template_height, print_area_width: t.print_area_width, print_area_height: t.print_area_height, print_area_top: t.print_area_top, print_area_left: t.print_area_left })) },
  };
  await new Promise((r) => setTimeout(r, 1500));
}
await mkdir("research/templates", { recursive: true });
// Save each template outline image so panels can be designed against it.
for (const v of Object.values(out)) {
  for (const t of v.templates?.templates || []) {
    for (const [kind, url] of [["outline", t.image_url], ["background", t.background_url]]) {
      if (!url) continue;
      const res = await fetch(url);
      if (res.ok) await writeFile(`research/templates/${t.template_id}-${kind}.png`, Buffer.from(await res.arrayBuffer()));
    }
  }
}
await writeFile("research/printfiles.json", JSON.stringify(out, null, 1));
console.log(`::notice title=Printfiles::${Object.entries(out).map(([k, v]) => `${k} ${v.title}`).join(" | ")}`);

async function pf(path) {
  for (let i = 0; i < 5; i++) {
    const res = await fetch("https://api.printful.com" + path, { headers });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 15000)); continue; }
    const data = await res.json();
    if (!res.ok) throw new Error(`${path} ${res.status} ${JSON.stringify(data.error || data.result)}`);
    return data;
  }
  throw new Error("rate limited");
}
