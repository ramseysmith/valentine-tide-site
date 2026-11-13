/* =========================================================
   Valentine Tide shop status
   Sets <html data-shop="live|soon"> so copy never promises a drop that
   can't be bought yet. Elements marked data-when="live" or data-when="soon"
   show only in the matching state (see styles.css). Default is "soon".
   ========================================================= */

"use strict";

window.VT_SHOP_STATUS = (async function () {
  const cfg = window.VT_CONFIG || {};
  const apiReady = !!cfg.API_BASE && !cfg.API_BASE.startsWith("REPLACE");
  let live = false;
  try {
    const res = await fetch("catalog.json", { cache: "no-cache" });
    const catalog = await res.json();
    const mapped = catalog.products.some((p) => p.active && p.variants.some((v) => v.printfulSyncVariantId));
    live = apiReady && (mapped || !!cfg.SHOP_PREVIEW);
  } catch (err) {
    console.warn("[Valentine Tide] could not read shop status", err);
  }
  document.documentElement.dataset.shop = live ? "live" : "soon";
  return live ? "live" : "soon";
})();

/* Cloudflare Web Analytics, only once a token is set in config.js. */
(function () {
  const token = (window.VT_CONFIG || {}).CF_ANALYTICS_TOKEN;
  if (!token) return;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://static.cloudflareinsights.com/beacon.min.js";
  s.dataset.cfBeacon = JSON.stringify({ token });
  document.head.appendChild(s);
})();

/* Christmas order by date in the announce bar. The static copy says order by
   Dec 3. From Dec 4 it says the piece arrives after Christmas, and from Dec 26
   the item hides. Dates are US Mountain time, the shop's own clock. */
(function () {
  const items = document.querySelectorAll("[data-gift-cutoff]");
  if (!items.length) return;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date());
  const md = today.slice(5);
  if (md >= "12-26" || md < "11-01") {
    items.forEach((el) => { el.hidden = true; });
  } else if (md >= "12-04") {
    items.forEach((el) => {
      const t = el.querySelector("[data-gift-cutoff-text]");
      if (t) t.textContent = "Ordered now, it arrives after Christmas";
    });
  }
})();
