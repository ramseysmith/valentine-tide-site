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

/* Gift season, date driven. Dates are US Mountain time, the shop's own clock.
   Christmas (Nov 1 to Dec 25): the announce bar says order by Dec 3, and from
   Dec 4 that the piece arrives after Christmas.
   Valentine's Day (Dec 26 to Feb 14): the bar says order by Jan 21 and links to
   the Valentine's gift guide, and from Jan 22 that the piece arrives after
   Valentine's Day. Feb 15 to Oct 31 the bar item hides.
   Elements marked data-season="christmas" or data-season="valentines" show only
   in their season (Valentine's elements ship hidden). A form with
   data-success-valentines takes that message in Valentine's season.
   Preview any date with ?vt_date=YYYY-MM-DD. */
(function () {
  let today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver" }).format(new Date());
  const forced = new URLSearchParams(location.search).get("vt_date");
  if (forced && /^\d{4}-\d{2}-\d{2}$/.test(forced)) today = forced;
  const md = today.slice(5);
  const valentines = md >= "12-26" || md <= "02-14";
  const christmas = md >= "11-01" && md < "12-26";

  document.documentElement.dataset.season = valentines ? "valentines" : "christmas";
  document.querySelectorAll("[data-season]").forEach((el) => {
    if (el === document.documentElement) return;
    const hide = el.dataset.season !== (valentines ? "valentines" : "christmas");
    el.hidden = hide;
    el.style.display = hide ? "none" : "";
  });
  if (valentines) {
    document.querySelectorAll("form[data-success-valentines]").forEach((f) => {
      f.dataset.success = f.dataset.successValentines;
    });
  }

  const items = document.querySelectorAll("[data-gift-cutoff]");
  items.forEach((el) => {
    const t = el.querySelector("[data-gift-cutoff-text]");
    if (christmas) {
      if (md >= "12-04" && t) t.textContent = "Ordered now, it arrives after Christmas";
    } else if (valentines) {
      el.setAttribute("href", "/valentines-gifts.html#order-by");
      if (t) t.textContent = md >= "01-22" && md <= "02-14" ? "Ordered now, it arrives after Valentine's Day" : "Order by Jan 21 for Valentine's Day";
    } else {
      el.hidden = true;
    }
  });
})();
