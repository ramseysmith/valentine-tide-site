/* Site wide config. After `npm run deploy` in /worker, paste the worker URL here
   (e.g. https://valentine-tide-shop.<you>.workers.dev or https://shop.valentinetide.com). */
window.VT_CONFIG = {
  API_BASE: "REPLACE_WITH_WORKER_URL",
  // true = show Buy buttons even before Printful IDs are in catalog.json (use with Stripe test keys only)
  SHOP_PREVIEW: false,
};
