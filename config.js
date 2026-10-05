/* Site wide config.
   API_BASE: after `npm run deploy` in /worker, paste the worker URL here
   (e.g. https://valentine-tide-shop.<you>.workers.dev or https://shop.valentinetide.com).
   Once it is set, checkout, signups and the live/coming soon copy all switch on. */
window.VT_CONFIG = {
  API_BASE: "https://valentine-tide-shop.graysmithlabs.workers.dev",
  // true = show Buy buttons even before Printful IDs are in catalog.json (use with Stripe test keys only)
  SHOP_PREVIEW: false,
  // Until the worker is live, signups are emailed here through FormSubmit
  // (formsubmit.co). The first signup triggers a one time activation email.
  SIGNUP_FALLBACK_EMAIL: "graysmithlabs@gmail.com",
};
