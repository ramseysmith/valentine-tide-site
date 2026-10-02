/* =========================================================
   Valentine Tide shop worker (Cloudflare Workers)
   ---------------------------------------------------------
   POST /checkout   site asks for a Stripe Checkout URL
   POST /webhook    Stripe tells us an order was paid; we
                    create (and confirm) the Printful order
   POST /subscribe  email capture for the landing page
   GET  /health     quick uptime check
   ========================================================= */

import catalog from "../../catalog.json";
import { findProduct, priceFor, shippingFor } from "./catalog.js";
import { createCheckoutSession, getCheckoutSession, verifyStripeSignature } from "./stripe.js";
import { buildPrintfulOrder, createPrintfulOrder } from "./printful.js";

export default {
  /* Cron heartbeat for the X agent. GitHub drops many scheduled runs, so the
     worker nudges the agent's workflow every 30 minutes when a token is set.
     AGENT_DISPATCH_TOKEN: fine grained GitHub token with Actions read and
     write on ramseysmith/valentine-tide-agent. */
  async scheduled(event, env, ctx) {
    if (!env.AGENT_DISPATCH_TOKEN) return;
    const repo = env.AGENT_REPO || "ramseysmith/valentine-tide-agent";
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/x-agent.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AGENT_DISPATCH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "valentine-tide-shop",
      },
      body: JSON.stringify({ ref: "main", inputs: { job: "tick", dry_run: false } }),
    });
    if (!res.ok) console.error("[cron] agent dispatch failed", res.status, await res.text());
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    try {
      if (url.pathname === "/health") return json({ ok: true }, 200, cors);
      if (url.pathname === "/checkout" && request.method === "POST") return await handleCheckout(request, env, cors);
      if (url.pathname === "/webhook" && request.method === "POST") return await handleWebhook(request, env, ctx);
      if (url.pathname === "/subscribe" && request.method === "POST") return await handleSubscribe(request, env, cors);
      return json({ error: "not_found" }, 404, cors);
    } catch (err) {
      console.error("[worker] unhandled", err && err.stack ? err.stack : err);
      // Stripe and Printful error messages never contain keys; surfacing them
      // turns "server_error" into something fixable.
      const detail = String((err && err.message) || err).replace(/(sk|rk|whsec)_(live|test)?_?[A-Za-z0-9]+/g, "[redacted]").slice(0, 300);
      return json({ error: "server_error", detail }, 500, cors);
    }
  },
};

/* ---------- Checkout ---------- */
async function handleCheckout(request, env, cors) {
  const body = await readJson(request);
  const sku = String(body.sku || "");
  const size = String(body.size || "");
  const quantity = Math.max(1, Math.min(5, parseInt(body.quantity, 10) || 1));

  const found = findProduct(catalog, sku, size);
  if (!found) return json({ error: "unknown_product" }, 400, cors);
  if (!found.variant.printfulSyncVariantId && env.ALLOW_UNMAPPED !== "true") {
    return json({ error: "not_ready" }, 409, cors);
  }

  const unitCents = priceFor(found.product, found.variant);
  const shippingCents = shippingFor(catalog, unitCents * quantity);
  const site = env.SITE_URL || "https://valentinetide.com";

  const session = await createCheckoutSession(env.STRIPE_SECRET_KEY, {
    product: found.product,
    variant: found.variant,
    quantity,
    unitCents,
    shippingCents,
    currency: catalog.currency,
    countries: catalog.shipping.countries,
    shippingLabel: catalog.shipping.label,
    site,
    automaticTax: env.STRIPE_AUTOMATIC_TAX === "true",
  });

  return json({ url: session.url }, 200, cors);
}

/* ---------- Stripe webhook → Printful ---------- */
async function handleWebhook(request, env) {
  const raw = await request.text();
  const ok = await verifyStripeSignature(raw, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return new Response("bad signature", { status: 400 });

  const event = JSON.parse(raw);
  const paidTypes = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (!paidTypes.includes(event.type)) return new Response("ignored", { status: 200 });

  const lite = event.data.object;
  if (lite.payment_status !== "paid") return new Response("not paid yet", { status: 200 });

  // Re-fetch from Stripe so we act on Stripe's copy, not the payload alone.
  const session = await getCheckoutSession(env.STRIPE_SECRET_KEY, lite.id);

  // Opted-in buyers join the email list (marketing consent from Checkout).
  if (env.SUBSCRIBERS && session.consent && session.consent.promotions === "opt_in" && session.customer_details?.email) {
    await saveSubscriber(env, session.customer_details.email, "checkout");
  }

  const order = buildPrintfulOrder(session, catalog);
  if (!order) {
    console.error("[webhook] could not map session to a Printful order", session.id);
    return new Response("unmappable order", { status: 200 }); // don't make Stripe retry forever
  }

  const result = await createPrintfulOrder(env, order, env.PRINTFUL_AUTO_CONFIRM === "true");
  if (!result.ok) {
    console.error("[webhook] printful failed", result.status, result.body);
    return new Response("printful error", { status: 500 }); // Stripe retries
  }
  return new Response("ok", { status: 200 });
}

/* ---------- Email capture ---------- */
async function handleSubscribe(request, env, cors) {
  const body = await readJson(request);
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: "invalid_email" }, 400, cors);
  }
  if (!env.SUBSCRIBERS) return json({ error: "not_configured" }, 503, cors);
  const interest = String(body.interest || "").slice(0, 80);
  await saveSubscriber(env, email, interest ? `notify: ${interest}` : "landing");
  return json({ ok: true }, 200, cors);
}

async function saveSubscriber(env, email, source) {
  const key = `sub:${email.toLowerCase()}`;
  const existing = await env.SUBSCRIBERS.get(key);
  if (existing) return;
  await env.SUBSCRIBERS.put(key, JSON.stringify({ email, source, at: new Date().toISOString() }));
}

/* ---------- helpers ---------- */
function corsHeaders(request, env) {
  const origin = request.headers.get("origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://valentinetide.com")
    .split(",")
    .map((s) => s.trim());
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function json(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
