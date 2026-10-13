#!/usr/bin/env node
/* Builds the static shop files from catalog.json:
     shop/<slug>/index.html   one page per active product, with its own title,
                              description, link preview card and product data,
                              so X, iMessage and Google see the real piece
     feed.xml                 Google Merchant Center product feed (free listings)
     sitemap.xml              every page, product pages included
   Run after any change to catalog.json:   node tools/build-shop.mjs
   Preview cards (assets/og/<slug>.jpg) come from tools/og-cards.mjs. */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://valentinetide.com";
const catalog = JSON.parse(readFileSync(join(ROOT, "catalog.json"), "utf8"));
const template = readFileSync(join(ROOT, "product.html"), "utf8");

export const slugOf = (p) => p.slug || p.sku.replace(/^vt-/, "").replace(/-black$/, "");
export const categoryOf = (p) => p.category || (/rash|one-piece|swim/.test(p.sku) ? "swim" : "tees");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const money = (c) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
const ready = (p) => !p.comingSoon && p.variants.some((v) => v.printfulSyncVariantId);
const products = catalog.products.filter((p) => p.active);

function ogImage(p) {
  const card = `assets/og/${slugOf(p)}.jpg`;
  return existsSync(join(ROOT, card)) ? `${SITE}/${card}` : `${SITE}/${p.image}`;
}

function productPage(p) {
  const slug = slugOf(p);
  const url = `${SITE}/shop/${slug}/`;
  const title = `${p.name}${/men's|women's/i.test(p.subtitle) ? `, ${p.subtitle.match(/(men's|women's)/i)[1]}` : ""} | Valentine Tide`;
  const desc = `${p.subtitle}, ${money(p.priceCents)}. ${p.description}`.slice(0, 290);
  const gallery = p.gallery && p.gallery.length ? p.gallery : [{ src: p.image, alt: p.name }];
  const ld = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `Valentine Tide ${p.name}`,
    description: p.description,
    image: gallery.map((g) => `${SITE}/${g.src}`),
    sku: p.sku,
    category: categoryOf(p) === "swim" ? "Swimwear" : "T-shirts",
    brand: { "@type": "Brand", name: "Valentine Tide" },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: String(catalog.currency || "usd").toUpperCase(),
      price: (p.priceCents / 100).toFixed(2),
      availability: ready(p) ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      itemCondition: "https://schema.org/NewCondition",
    },
  };

  const head = `
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="theme-color" content="#161616" />
  <link rel="canonical" href="${url}" />

  <link rel="icon" href="assets/favicon-32.png" type="image/png" sizes="32x32" />
  <link rel="icon" href="assets/favicon-192.png" type="image/png" sizes="192x192" />
  <link rel="apple-touch-icon" href="assets/apple-touch-icon.png" />

  <meta property="og:type" content="product" />
  <meta property="og:site_name" content="Valentine Tide" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${ogImage(p)}" />
  <meta property="og:image:alt" content="${esc(`${p.name}, ${p.subtitle}`)}" />
  <meta property="product:price:amount" content="${(p.priceCents / 100).toFixed(2)}" />
  <meta property="product:price:currency" content="USD" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@valentinetide" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${ogImage(p)}" />
  <script type="application/ld+json">${JSON.stringify(ld)}</script>`;

  // What crawlers and no JS visitors see; shop.js replaces it with the full page.
  const fallback = `
    <div class="pdp" id="pdp" data-sku="${esc(p.sku)}">
      <div class="pdp__grid">
        <div class="pdp__gallery"><img src="${esc(gallery[0].src)}" alt="${esc(gallery[0].alt)}" width="1200" height="1200" /></div>
        <div class="pdp__info">
          <h1 class="pdp__title">${esc(p.name)}</h1>
          <p class="pdp__sub">${esc(p.subtitle)}</p>
          <p class="pdp__price">${money(p.priceCents)}</p>
          <p>${esc(p.description)}</p>
        </div>
      </div>
    </div>`;

  let html = template
    .replace("<head>", '<head>\n  <base href="/" />')
    .replace(/\s*<!-- Title, description[\s\S]*?<meta name="twitter:site" content="@valentinetide" \/>/, head)
    .replace(/\s*<div class="pdp" id="pdp">[\s\S]*?<\/div>/, fallback)
    .replace('href="#content"', `href="/shop/${slug}/#content"`)
    .replace("<!DOCTYPE html>", `<!DOCTYPE html>\n<!-- Built by tools/build-shop.mjs from catalog.json and product.html. Edit those, then rebuild. -->`);
  return html;
}

function feed() {
  const items = products
    .filter(ready)
    .flatMap((p) =>
      p.variants.map((v) => {
        const swim = categoryOf(p) === "swim";
        const gender = /women's/i.test(p.subtitle) || /one-piece|crop/.test(p.sku) ? "female" : /men's/i.test(p.subtitle) ? "male" : "unisex";
        const gallery = p.gallery && p.gallery.length ? p.gallery : [{ src: p.image }];
        const price = p.priceCents + (v.surchargeCents || 0);
        return `
    <item>
      <g:id>${esc(`${p.sku}-${v.size}`.toLowerCase())}</g:id>
      <g:item_group_id>${esc(p.sku)}</g:item_group_id>
      <g:title>${esc(`Valentine Tide ${p.name}, ${p.subtitle.replace(/ in black$/i, "")}, black, size ${v.size}`)}</g:title>
      <g:description>${esc(`${p.description} ${(p.details || []).join(". ")}.`)}</g:description>
      <g:link>${SITE}/shop/${slugOf(p)}/</g:link>
      <g:image_link>${SITE}/${esc(gallery[0].src)}</g:image_link>
${gallery
  .slice(1, 10)
  .map((g) => `      <g:additional_image_link>${SITE}/${esc(g.src)}</g:additional_image_link>`)
  .join("\n")}
      <g:availability>in_stock</g:availability>
      <g:price>${(price / 100).toFixed(2)} USD</g:price>
      <g:condition>new</g:condition>
      <g:brand>Valentine Tide</g:brand>
      <g:identifier_exists>no</g:identifier_exists>
      <g:google_product_category>${swim ? "Apparel &amp; Accessories &gt; Clothing &gt; Swimwear" : "Apparel &amp; Accessories &gt; Clothing &gt; Shirts &amp; Tops"}</g:google_product_category>
      <g:product_type>${swim ? "Swim" : "Tees"}</g:product_type>
      <g:color>Black</g:color>
      <g:size>${esc(v.size)}</g:size>
      <g:size_system>US</g:size_system>
      <g:gender>${gender}</g:gender>
      <g:age_group>adult</g:age_group>
      <g:shipping>
        <g:country>US</g:country>
        <g:service>Standard</g:service>
        <g:price>${price >= catalog.shipping.freeOverCents ? "0.00" : (catalog.shipping.flatRateCents / 100).toFixed(2)} USD</g:price>
      </g:shipping>
    </item>`;
      })
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Valentine Tide</title>
    <link>${SITE}/</link>
    <description>Gothic surf clothing and swimwear, printed to order.</description>${items}
  </channel>
</rss>
`;
}

function sitemap() {
  const urls = [
    [`${SITE}/`, "weekly", "1.0"],
    ...products.map((p) => [`${SITE}/shop/${slugOf(p)}/`, "weekly", "0.9"]),
    [`${SITE}/vision.html`, "monthly", "0.6"],
    [`${SITE}/help.html`, "monthly", "0.5"],
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, f, pr]) => `  <url><loc>${u}</loc><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join("\n")}
</urlset>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const p of products) {
    const dir = join(ROOT, "shop", slugOf(p));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), productPage(p));
    console.log(`shop/${slugOf(p)}/`);
  }
  writeFileSync(join(ROOT, "feed.xml"), feed());
  writeFileSync(join(ROOT, "sitemap.xml"), sitemap());
  console.log(`feed.xml (${products.filter(ready).reduce((n, p) => n + p.variants.length, 0)} items), sitemap.xml`);
}
