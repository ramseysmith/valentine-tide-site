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
