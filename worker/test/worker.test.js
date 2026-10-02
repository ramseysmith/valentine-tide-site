import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { verifyStripeSignature } from "../src/stripe.js";
import { buildPrintfulOrder, createPrintfulOrder } from "../src/printful.js";
import { findProduct, priceFor, shippingFor } from "../src/catalog.js";

const catalog = JSON.parse(readFileSync(new URL("../../catalog.json", import.meta.url)));
const mapped = structuredClone(catalog);
mapped.products[0].variants.forEach((v, i) => (v.printfulSyncVariantId = 1000 + i));

async function sign(payload, secret, t) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

test("stripe signature: valid, tampered, stale", async () => {
  const t = 1_800_000_000;
  const body = '{"id":"evt_1"}';
  const good = await sign(body, "whsec_test", t);
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${good}`, "whsec_test", 300, t + 10), true);
  assert.equal(await verifyStripeSignature(body + " ", `t=${t},v1=${good}`, "whsec_test", 300, t + 10), false);
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${good}`, "whsec_test", 300, t + 999), false);
  assert.equal(await verifyStripeSignature(body, null, "whsec_test"), false);
});

test("pricing and shipping come from the catalog", () => {
  const { product, variant } = findProduct(catalog, "vt-wordmark-tee-black", "2XL");
  assert.equal(priceFor(product, variant), 4100);
  assert.equal(shippingFor(catalog, 3800), 500);
  assert.equal(shippingFor(catalog, 7600), 0);
  assert.equal(findProduct(catalog, "vt-wordmark-tee-black", "XXS"), null);
  assert.equal(findProduct(catalog, "nope", "M"), null);
});

const session = {
  id: "cs_test_" + "a".repeat(60),
  payment_intent: "pi_3Qabcdefghijklmnopqrstu",
  metadata: { sku: "vt-wordmark-tee-black", size: "M", quantity: "2" },
  line_items: { data: [{ quantity: 2 }] },
  customer_details: { email: "a@b.co", name: "Ada", phone: "+13035550100" },
  collected_information: {
    shipping_details: { name: "Ada L", address: { line1: "1 Wave St", line2: null, city: "Denver", state: "CO", country: "US", postal_code: "80202" } },
  },
};

test("builds a Printful order from a paid session", () => {
  const o = buildPrintfulOrder(session, mapped);
  assert.equal(o.external_id, "pi_3Qabcdefghijklmnopqrstu");
  assert.ok(o.external_id.length <= 32);
  assert.deepEqual(o.items, [{ sync_variant_id: 1001, quantity: 2 }]);
  assert.equal(o.recipient.state_code, "CO");
  assert.equal(o.recipient.name, "Ada L");
});

test("falls back to legacy shipping_details", () => {
  const legacy = { ...session, collected_information: undefined, shipping_details: session.collected_information.shipping_details };
  assert.equal(buildPrintfulOrder(legacy, mapped).recipient.city, "Denver");
});

test("unmapped variants are refused", () => {
  const unmapped = structuredClone(catalog);
  unmapped.products.forEach((p) => p.variants.forEach((v) => (v.printfulSyncVariantId = null)));
  assert.equal(buildPrintfulOrder(session, unmapped), null);
});

test("printful duplicate external_id counts as success", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('{"code":400,"result":"Order with this external ID already exists"}', { status: 400 });
  try {
    const r = await createPrintfulOrder({ PRINTFUL_TOKEN: "x" }, {}, true);
    assert.equal(r.ok, true);
    assert.equal(r.duplicate, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});
