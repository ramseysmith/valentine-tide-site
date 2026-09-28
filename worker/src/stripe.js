/* Minimal Stripe client using fetch (no SDK needed on Workers). */

const API = "https://api.stripe.com/v1";

export async function createCheckoutSession(secretKey, o) {
  const p = new URLSearchParams();
  p.set("mode", "payment");
  p.set("success_url", `${o.site}/success.html?session_id={CHECKOUT_SESSION_ID}`);
  p.set("cancel_url", `${o.site}/#shop`);
  p.set("allow_promotion_codes", "true");
  p.set("billing_address_collection", "auto");
  p.set("phone_number_collection[enabled]", "true");
  p.set("consent_collection[promotions]", "auto");

  p.set("line_items[0][quantity]", String(o.quantity));
  p.set("line_items[0][price_data][currency]", o.currency);
  p.set("line_items[0][price_data][unit_amount]", String(o.unitCents));
  p.set("line_items[0][price_data][product_data][name]", `${o.product.name} (${o.variant.size})`);
  p.set("line_items[0][price_data][product_data][description]", o.product.subtitle);
  p.set("line_items[0][price_data][product_data][images][0]", `${o.site}/${o.product.image}`);
  if (o.automaticTax) p.set("line_items[0][price_data][tax_behavior]", "exclusive");

  o.countries.forEach((c, i) => p.set(`shipping_address_collection[allowed_countries][${i}]`, c));
  p.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  p.set("shipping_options[0][shipping_rate_data][display_name]", o.shippingCents === 0 ? "Free shipping" : o.shippingLabel);
  p.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(o.shippingCents));
  p.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", o.currency);
  p.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]", "business_day");
  p.set("shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]", "5");
  p.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]", "business_day");
  p.set("shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]", "10");
  if (o.automaticTax) {
    p.set("automatic_tax[enabled]", "true");
    p.set("shipping_options[0][shipping_rate_data][tax_behavior]", "exclusive");
  }

  // The webhook reads these to know exactly what to print.
  p.set("metadata[sku]", o.product.sku);
  p.set("metadata[size]", o.variant.size);
  p.set("metadata[quantity]", String(o.quantity));

  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: p.toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`stripe checkout ${res.status}: ${JSON.stringify(data.error || data)}`);
  return data;
}

export async function getCheckoutSession(secretKey, id) {
  const res = await fetch(`${API}/checkout/sessions/${encodeURIComponent(id)}?expand[]=line_items`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`stripe get session ${res.status}: ${JSON.stringify(data.error || data)}`);
  return data;
}

/* Verifies the Stripe-Signature header (HMAC SHA256 over "t.payload"). */
export async function verifyStripeSignature(payload, header, secret, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  const parts = Object.create(null);
  const v1 = [];
  for (const kv of header.split(",")) {
    const [k, v] = kv.split("=");
    if (k === "v1") v1.push(v);
    else parts[k] = v;
  }
  const t = parseInt(parts.t, 10);
  if (!t || v1.length === 0) return false;
  if (Math.abs(nowSec - t) > toleranceSec) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return v1.some((candidate) => timingSafeEqual(candidate, expected));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
