# Valentine Tide shop worker

A tiny Cloudflare Worker that turns the site into a store:

```
buyer taps Buy → /checkout → Stripe Checkout → paid
Stripe webhook → /webhook → Printful order (auto confirmed) → ships to buyer
```

Prices, sizes and Printful IDs come from `../catalog.json`, the same file the site renders from. The browser never sets a price.

## Launch checklist (about 30 minutes)

**1. Printful product**
1. In Printful: Stores, add a **Manual order / API** store if you don't have one. Settings, API: create a private token scoped to that store.
2. Add a card under Billing (Printful charges you per order at base cost).
3. From the repo root:
   ```bash
   PRINTFUL_TOKEN=xxx node worker/scripts/setup-printful-product.mjs vt-wordmark-tee-black --dry-run   # look first
   PRINTFUL_TOKEN=xxx node worker/scripts/setup-printful-product.mjs vt-wordmark-tee-black
   ```
   That finds the Comfort Colors 1717 in Black, creates the product with `assets/print-front.png` high on the chest, and writes the variant IDs into `catalog.json`. The print file has to be live on valentinetide.com first, so push `assets/print-front.png` before running it.
4. In Printful, open the product, check the placement on the mockup, and download a couple of mockups into `assets/products/` to replace the interim image.
5. Order one sample to yourself before you post the drop. Photos of the real shirt beat any mockup.

**2. Stripe**
1. Create an account for Graysmith Labs LLC, stay in **test mode** for now.
2. Developers, Webhooks, add endpoint `https://<worker url>/webhook` listening for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Copy the signing secret.
3. Settings, Public details: set the statement descriptor to `VALENTINETIDE` so buyers recognize the charge.

**3. Deploy the worker**
```bash
cd worker
npm install
npx wrangler login
npx wrangler kv namespace create SUBSCRIBERS      # paste the id into wrangler.toml
npx wrangler secret put STRIPE_SECRET_KEY         # sk_test_... for now
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put PRINTFUL_TOKEN
npm run deploy
```
Paste the worker URL into `config.js` (`API_BASE`) at the site root and push.

**4. Test the full loop**
Buy a tee on the site with Stripe's test card 4242 4242 4242 4242. The order shows up in Printful. With a test key Printful will still create a real order, so set `PRINTFUL_AUTO_CONFIRM = "false"` in `wrangler.toml` for this test (it lands as a draft you can delete), then flip it back to `"true"` and redeploy.

**5. Go live**
Swap in `sk_live_...` and the live webhook secret, redeploy. Done: every paid order prints and ships with nobody touching it.

## Everyday

- `npm test` runs the unit tests (signature check, pricing, order mapping, retry safety).
- `npm run export:subscribers` lists the email list (landing page signups plus buyers who opted in at checkout).
- New product: add an entry to `catalog.json`, run the setup script with its sku, push. The site and checkout pick it up automatically.
- Sales tax: once you're registered in Colorado, enable Stripe Tax and set `STRIPE_AUTOMATIC_TAX = "true"`.

## Keep the X agent on time (optional, recommended)

GitHub skips many scheduled runs. Once this worker is deployed it can nudge the agent every 30 minutes:
1. GitHub, Settings, Developer settings, Fine grained tokens: new token, only `valentine-tide-agent`, permission **Actions: Read and write**.
2. `npx wrangler secret put AGENT_DISPATCH_TOKEN` and paste it. The cron in `wrangler.toml` does the rest.

