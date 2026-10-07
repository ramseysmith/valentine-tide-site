/* Catalog helpers shared by checkout + webhook. Prices always come from
   catalog.json on the server, never from the browser. */

export function findProduct(catalog, sku, size) {
  const product = catalog.products.find((p) => p.sku === sku && p.active);
  if (!product) return null;
  const variant = product.variants.find((v) => v.size === size);
  if (!variant) return null;
  return { product, variant };
}

export function priceFor(product, variant) {
  return product.priceCents + (variant.surchargeCents || 0);
}

export function shippingFor(catalog, subtotalCents) {
  const s = catalog.shipping;
  if (s.freeOverCents && subtotalCents >= s.freeOverCents) return 0;
  return s.flatRateCents;
}

/* A bag is at most 10 lines and 10 shirts; each line at most 5 of one size. */
export const MAX_LINES = 10;
export const MAX_UNITS = 10;

/* Turns what the browser sent (a bag of items, or the older single item
   shape) into priced lines. Same sku and size are merged. */
export function resolveItems(catalog, body) {
  const raw = Array.isArray(body && body.items) ? body.items : [{ sku: body && body.sku, size: body && body.size, quantity: body && body.quantity }];
  if (raw.length > MAX_LINES) return { error: "too_many" };
  const merged = new Map();
  for (const it of raw) {
    const found = findProduct(catalog, String((it && it.sku) || ""), String((it && it.size) || ""));
    if (!found) return { error: "unknown_product" };
    // Shown on the site, but not for sale until its samples are approved.
    if (found.product.comingSoon) return { error: "coming_soon" };
    const quantity = Math.max(1, Math.min(5, parseInt(it.quantity, 10) || 1));
    const key = `${found.product.sku}|${found.variant.size}`;
    const prev = merged.get(key);
    merged.set(key, { ...found, quantity: Math.min(5, (prev ? prev.quantity : 0) + quantity) });
  }
  const lines = [...merged.values()].map((l) => ({ ...l, unitCents: priceFor(l.product, l.variant) }));
  if (!lines.length) return { error: "empty" };
  if (lines.reduce((s, l) => s + l.quantity, 0) > MAX_UNITS) return { error: "too_many" };
  return { lines };
}

/* Compact form stored in Stripe metadata (500 character limit per value). */
export function encodeItems(lines) {
  return lines.map((l) => `${l.product.sku}|${l.variant.size}|${l.quantity}`).join(";");
}

export function decodeItems(catalog, s) {
  const out = [];
  for (const part of String(s || "").split(";").filter(Boolean)) {
    const [sku, size, q] = part.split("|");
    const found = findProduct(catalog, sku, size);
    if (!found) return null;
    out.push({ ...found, quantity: Math.max(1, parseInt(q, 10) || 1) });
  }
  return out.length ? out : null;
}
