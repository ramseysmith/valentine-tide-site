#!/usr/bin/env node
/* Lists every rendered option as a mockup job for make-mockups.mjs:
   print-options/manifest.json = [{ name, sku, files: { placement: path } }].
   Run after rendering each options/*.json into its print-options folder. */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const jobs = [];
for (const f of (await readdir(here)).filter((f) => f.endsWith(".json")).sort()) {
  const o = JSON.parse(await readFile(path.join(here, f), "utf8"));
  // rash-front -> front, rash-sleeve-left -> sleeve_left
  const files = Object.fromEntries(o.panels.map((p) => [p.name.replace(/^(rash|swim)-/, "").replace("-", "_"), `${o.out}/${p.name}.png`]));
  for (const sku of o.skus) jobs.push({ name: o.skus.length > 1 ? `${o.name}-${sku.split("-").pop()}` : o.name, sku, files });
}
await writeFile(path.join(root, "print-options/manifest.json"), JSON.stringify(jobs, null, 2) + "\n");
console.log(jobs.map((j) => j.name).join("\n"));
