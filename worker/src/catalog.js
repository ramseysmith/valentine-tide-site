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
