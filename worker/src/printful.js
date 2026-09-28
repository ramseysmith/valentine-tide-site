/* Turns a paid Stripe Checkout Session into a Printful order. */

import { findProduct } from "./catalog.js";

const API = "https://api.printful.com";

export function buildPrintfulOrder(session, catalog) {
  const md = session.metadata || {};
  const found = findProduct(catalog, md.sku, md.size);
  if (!found || !found.variant.printfulSyncVariantId) return null;

  const quantity =
    (session.line_items && session.line_items.data && session.line_items.data[0] && session.line_items.data[0].quantity) ||
    parseInt(md.quantity, 10) ||
    1;

  // Newer Stripe API versions nest shipping under collected_information.
  const ship =
    (session.collected_information && session.collected_information.shipping_details) ||
    session.shipping_details ||
    null;
  const cust = session.customer_details || {};
  const addr = (ship && ship.address) || cust.address;
  if (!addr || !addr.line1) return null;

  return {
    // Printful rejects duplicate external_ids, which makes Stripe retries safe.
    external_id: String(session.payment_intent || session.id).slice(0, 32),
    shipping: "STANDARD",
    recipient: {
      name: (ship && ship.name) || cust.name || "Customer",
      address1: addr.line1,
      address2: addr.line2 || undefined,
      city: addr.city,
      state_code: addr.state || undefined,
      country_code: addr.country,
      zip: addr.postal_code,
      email: cust.email || undefined,
      phone: cust.phone || undefined,
    },
    items: [{ sync_variant_id: found.variant.printfulSyncVariantId, quantity }],
    packing_slip: {
      message: "Thanks for riding the first wave. Surf the shadows. valentinetide.com",
    },
  };
}

export async function createPrintfulOrder(env, order, confirm) {
  const headers = { Authorization: `Bearer ${env.PRINTFUL_TOKEN}`, "Content-Type": "application/json" };
  if (env.PRINTFUL_STORE_ID) headers["X-PF-Store-Id"] = env.PRINTFUL_STORE_ID;

  const res = await fetch(`${API}/orders${confirm ? "?confirm=true" : ""}`, {
    method: "POST",
    headers,
    body: JSON.stringify(order),
  });
  const body = await res.text();
  if (res.ok) return { ok: true, status: res.status, body };

  // A retry for an order we already created is a success, not a failure.
  if (res.status === 400 && /external.?id/i.test(body) && /(exist|already|use)/i.test(body)) {
    return { ok: true, status: res.status, body, duplicate: true };
  }
  return { ok: false, status: res.status, body };
}
