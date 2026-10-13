/* =========================================================
   Valentine Tide storefront
   Renders everything shoppable from catalog.json:
   - product cards with filters and quick add (index.html #shop-grid)
   - the Night Session set builder (index.html #set-builder)
   - the product page (product.html?p=<slug>)
   - the bag, on every page that loads this script
   Checkout goes to Stripe through the shop worker (config.js API_BASE).
   ========================================================= */

"use strict";

(function () {
  const cfg = window.VT_CONFIG || {};
  const API = cfg.API_BASE && !cfg.API_BASE.startsWith("REPLACE") ? cfg.API_BASE.replace(/\/$/, "") : null;
  const BAG_KEY = "vt_bag";
  const MAX_UNITS = 10;
  const MAX_EACH = 5;

  const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const icon = (name, cls = "icon icon--sm") => `<svg class="${cls}" aria-hidden="true"><use href="assets/icons.svg#${name}" /></svg>`;

  /* ---------- Catalog helpers ---------- */
  const slugOf = (p) => p.slug || p.sku.replace(/^vt-/, "").replace(/-black$/, "");
  const urlOf = (p) => `/shop/${slugOf(p)}/`;
  const categoryOf = (p) => p.category || (/rash|one-piece|swim/.test(p.sku) ? "swim" : "tees");
  const galleryOf = (p) => (p.gallery && p.gallery.length ? p.gallery : [{ src: p.image, alt: `${p.name}, ${p.subtitle}` }]);
  // Sellable only when checkout is connected and Printful knows the product.
  const isReady = (p) => !!API && !p.comingSoon && (cfg.SHOP_PREVIEW || p.variants.some((v) => v.printfulSyncVariantId));
  const defaultSize = (p) => {
    const sizes = p.variants.map((v) => v.size);
    return sizes.includes("M") ? "M" : sizes[Math.min(1, sizes.length - 1)];
  };
  const unitCents = (p, size) => {
    const v = p.variants.find((x) => x.size === size);
    return p.priceCents + ((v && v.surchargeCents) || 0);
  };

  let catalog = null;
  let products = [];

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const res = await fetch("catalog.json", { cache: "no-cache" });
      catalog = await res.json();
    } catch (err) {
      console.error("[Valentine Tide] catalog failed to load", err);
      document.querySelectorAll("#shop-grid, #pdp").forEach((el) => {
        el.innerHTML = '<p class="store__empty">The shop did not load. Refresh the page to try again.</p>';
      });
      return;
    }
    products = catalog.products.filter((p) => p.active);

    Bag.init();
    fillPrices();
    const ship = document.getElementById("shop-shipping");
    if (ship && catalog.shipping.freeOverCents) {
      ship.textContent = `Free US shipping over ${money(catalog.shipping.freeOverCents)}. Printed to order and shipped in 5 to 10 business days.`;
    }

    if (document.getElementById("shop-grid")) initGrid();
    if (document.getElementById("set-builder")) initSet();
    if (document.getElementById("pdp")) initProductPage();
  });

  /* Any element with data-price-of="<sku>" shows that product's live price. */
  function fillPrices() {
    document.querySelectorAll("[data-price-of]").forEach((el) => {
      const p = products.find((x) => x.sku === el.dataset.priceOf);
      if (p) el.textContent = money(p.priceCents);
    });
  }

  /* =========================================================
     Product cards
     ========================================================= */
  function card(p) {
    const g = galleryOf(p);
    const ready = isReady(p);
    const el = document.createElement("article");
    el.className = "card";
    el.dataset.cat = categoryOf(p);
    el.id = p.sku;
    el.innerHTML = `
      <a class="card__media" href="${urlOf(p)}" tabindex="-1" aria-hidden="true">
        <img class="card__img" src="${g[0].src}" alt="" width="1200" height="1200" loading="lazy" />
        ${g[1] ? `<img class="card__img card__img--alt" src="${g[1].src}" alt="" width="1200" height="1200" loading="lazy" />` : ""}
        ${p.drop ? `<span class="card__drop">Drop ${esc(p.drop)}</span>` : ""}
      </a>
      <div class="card__body">
        <h3 class="card__name"><a href="${urlOf(p)}">${esc(p.name)}</a></h3>
        <p class="card__sub">${esc(p.subtitle)}</p>
        <p class="card__price">${ready ? money(p.priceCents) : "Coming soon"}</p>
        ${ready ? `<button class="card__add" type="button">${icon("bag")}Choose size</button>` : ""}
      </div>
      ${
        ready
          ? `<div class="card__quick" role="group" aria-label="Quick add ${esc(p.name)}">
              <span class="card__quick-label">${icon("plus")}Quick add</span>
              <div class="card__sizes">
                ${p.variants.map((v) => `<button type="button" class="card__size" data-size="${esc(v.size)}" aria-label="Add ${esc(p.name)} in ${esc(v.size)} to bag">${esc(v.size)}</button>`).join("")}
              </div>
            </div>`
          : ""
      }`;
    const addBtn = el.querySelector(".card__add");
    if (addBtn) addBtn.addEventListener("click", () => openQuickAdd(p, addBtn));
    el.querySelectorAll(".card__size").forEach((b) =>
      b.addEventListener("click", () => {
        Bag.add(p.sku, b.dataset.size, 1);
        Bag.open(b);
      })
    );
    return el;
  }

  /* A card that sends shoppers to the set builder, when the set is on sale. */
  function promoCard() {
    const set = document.getElementById("set");
    const rash = products.find((p) => p.sku === "vt-night-session-rash-womens");
    const piece = products.find((p) => p.sku === "vt-night-session-one-piece");
    if (!set || !rash || !piece || !isReady(rash) || !isReady(piece)) return null;
    const el = document.createElement("article");
    el.className = "card card--promo";
    el.dataset.cat = "swim";
    el.innerHTML = `
      <img class="card--promo__art" src="assets/illustrations/hero-arch.svg" alt="" width="400" height="540" loading="lazy" />
      <h3 class="card--promo__title">The Night Session set</h3>
      <p>Rash guard and one piece for ${money(rash.priceCents + piece.priceCents)}. Ships free.</p>
      <a class="text-link" href="#set">Build your set ${icon("arrow")}</a>`;
    return el;
  }

  function initGrid() {
    const grid = document.getElementById("shop-grid");
    grid.innerHTML = "";
    // Newest drop first so the latest pieces lead.
    const ordered = [...products].sort((a, b) => String(b.drop || "").localeCompare(String(a.drop || "")));
    ordered.forEach((p) => grid.appendChild(card(p)));
    const promo = promoCard();
    if (promo) grid.appendChild(promo);
    addProductData(products);

    const counts = { all: products.length, swim: 0, tees: 0 };
    products.forEach((p) => (counts[categoryOf(p)] = (counts[categoryOf(p)] || 0) + 1));
    document.querySelectorAll("[data-count]").forEach((el) => (el.textContent = counts[el.dataset.count] || 0));

    const buttons = [...document.querySelectorAll(".filter")];
    const apply = (f) => {
      buttons.forEach((b) => {
        const on = b.dataset.filter === f;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-selected", String(on));
      });
      grid.querySelectorAll(".card").forEach((c) => (c.hidden = f !== "all" && c.dataset.cat !== f));
      // The set promo fills the empty slot only while every piece shows.
      if (promo) promo.hidden = f === "tees";
    };
    buttons.forEach((b) => b.addEventListener("click", () => apply(b.dataset.filter)));

    // Nav links like /#shop-swim land on the shop with that filter on.
    const fromHash = () => {
      const m = location.hash.match(/^#shop-(swim|tees)$/);
      if (!m) return;
      apply(m[1]);
      document.getElementById("shop").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("hashchange", fromHash);
    fromHash();
  }

  /* =========================================================
     Night Session set builder (home page)
     ========================================================= */
  function initSet() {
    const form = document.getElementById("set-builder");
    const piece = products.find((p) => p.sku === "vt-night-session-one-piece");
    const cuts = [...form.querySelectorAll('input[name="set-cut"]')];
    const rashSel = form.querySelector('[data-set-size="rash"]');
    const swimSel = form.querySelector('[data-set-size="vt-night-session-one-piece"]');
    const total = form.querySelector("[data-set-total]");
    const status = form.querySelector(".form-status");
    const rash = () => products.find((p) => p.sku === cuts.find((c) => c.checked).value);

    if (!piece || !rash() || !isReady(piece) || !isReady(rash())) {
      document.getElementById("set").hidden = true;
      return;
    }
    const fill = (sel, p) => {
      const keep = sel.value;
      sel.innerHTML = p.variants.map((v) => `<option value="${esc(v.size)}">Size ${esc(v.size)}</option>`).join("");
      sel.value = p.variants.some((v) => v.size === keep) ? keep : defaultSize(p);
    };
    const update = () => {
      total.textContent = ` for ${money(unitCents(rash(), rashSel.value) + unitCents(piece, swimSel.value))}`;
    };
    fill(rashSel, rash());
    fill(swimSel, piece);
    update();
    cuts.forEach((c) => c.addEventListener("change", () => (fill(rashSel, rash()), update())));
    [rashSel, swimSel].forEach((s) => s.addEventListener("change", update));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const a = Bag.add(rash().sku, rashSel.value, 1);
      const b = Bag.add(piece.sku, swimSel.value, 1);
      status.dataset.state = a || b ? "error" : "";
      status.textContent = a || b ? `A bag holds up to ${MAX_UNITS} pieces, ${MAX_EACH} of any one size.` : "";
      Bag.open(form.querySelector("button[type=submit]"));
    });

    form.querySelectorAll("[data-set-guide]").forEach((b) =>
      b.addEventListener("click", () => {
        const isRash = b.dataset.setGuide === "rash";
        const p = isRash ? rash() : piece;
        const sel = isRash ? rashSel : swimSel;
        openGuide(p, { selected: sel.value, from: b, onChoose: (s) => ((sel.value = s), update()) });
      })
    );
  }

  /* =========================================================
     Product page
     ========================================================= */
  function initProductPage() {
    const root = document.getElementById("pdp");
    // Built pages carry data-sku; product.html?p=<slug> still works and moves to the built page.
    const key = root.dataset.sku || new URLSearchParams(location.search).get("p") || "";
    const p = products.find((x) => slugOf(x) === key || x.sku === key);
    if (p && !root.dataset.sku && /product\.html$/.test(location.pathname)) {
      location.replace(urlOf(p));
      return;
    }
    if (!p) {
      root.innerHTML = `
        <div class="pdp__missing">
          <h1 class="pdp__title">That piece drifted off.</h1>
          <p>It may have sold out or moved. Everything we sell right now is in the shop.</p>
          <a class="btn" href="/#shop">Go to the shop</a>
        </div>`;
      return;
    }
    const g = galleryOf(p);
    const ready = isReady(p);
    const cat = categoryOf(p);

    if (!root.dataset.sku) setMeta(p);
    root.innerHTML = `
      <nav class="crumbs" aria-label="Breadcrumb">
        <a href="/#shop">Shop</a><span aria-hidden="true">/</span>
        <a href="/#shop-${cat}">${cat === "swim" ? "Swim" : "Tees"}</a><span aria-hidden="true">/</span>
        <span aria-current="page">${esc(p.name)}</span>
      </nav>
      <div class="pdp__grid">
        <div class="pdp__gallery">
          <div class="pdp__slides" tabindex="0" aria-label="Photos of the ${esc(p.name)}">
            ${g.map((x, i) => `<figure class="pdp__slide"><img src="${x.src}" alt="${esc(x.alt)}" width="1200" height="1200" ${i ? 'loading="lazy"' : 'fetchpriority="high"'} /></figure>`).join("")}
          </div>
          ${
            g.length > 1
              ? `<div class="pdp__thumbs">
                  ${g.map((x, i) => `<button class="thumb${i ? "" : " is-active"}" type="button" data-index="${i}" aria-label="Photo ${i + 1} of ${g.length}"${i ? "" : ' aria-current="true"'}><img src="${x.src}" alt="" width="1200" height="1200" loading="lazy" /></button>`).join("")}
                </div>`
              : ""
          }
        </div>

        <div class="pdp__info">
          ${p.drop ? `<p class="pill">${icon(cat === "swim" ? "moon" : "crest")}Drop ${esc(p.drop)}</p>` : ""}
          <h1 class="pdp__title">${esc(p.name)}</h1>
          <p class="pdp__sub">${esc(p.subtitle)}</p>
          <p class="pdp__price" data-price>${money(p.priceCents)}</p>

          <fieldset class="sizes">
            <div class="sizes__top">
              <legend class="sizes__legend">Size</legend>
              ${hasChart(p) ? `<button class="sizes__guide" type="button">${icon("ruler")}Size guide and fit finder</button>` : ""}
            </div>
            <div class="sizes__list">
              ${p.variants
                .map(
                  (v) => `
                <label class="size">
                  <input type="radio" name="size" value="${esc(v.size)}" ${v.size === defaultSize(p) ? "checked" : ""} />
                  <span>${esc(v.size)}</span>
                </label>`
                )
                .join("")}
            </div>
            ${hasChart(p) ? `<p class="sizes__fit" data-fit aria-live="polite"></p>` : ""}
            ${p.sizeHint ? `<p class="sizes__hint">${icon("stretch")}${esc(p.sizeHint)}</p>` : ""}
          </fieldset>

          <div class="pdp__buy">
            ${
              ready
                ? `<button class="btn btn--wide pdp__add" type="button">${icon("bag")}<span data-add-label>Add to bag</span></button>
                   <button class="btn btn--ghost btn--wide pdp__now" type="button">Buy it now</button>`
                : `<a class="btn btn--wide" href="/#signup">Get an email when it drops</a>`
            }
            <p class="pdp__ship" data-ship></p>
            <p class="form-status pdp__status" role="status" aria-live="polite"></p>
          </div>

          <ul class="assure">
            <li>${icon("return")}Misprint or damage? We replace it free.</li>
            <li>${icon("lock")}Secure checkout through Stripe</li>
            <li>${icon("crest")}<span>10% of profits go to the <a href="help.html#giving">American Foundation for Suicide Prevention</a></span></li>
          </ul>

          <div class="acc">
            <details open>
              <summary>${icon("rose")}The piece</summary>
              <div class="acc__body">
                <p>${esc(p.description)}</p>
                ${p.details && p.details.length ? `<ul class="pdp__details">${p.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}
              </div>
            </details>
            ${
              p.sizeChart && p.sizeChart.rows && p.sizeChart.rows.length
                ? `<details id="size-guide">
                    <summary>${icon("ruler")}Size guide</summary>
                    <div class="acc__body">${sizeChart(p)}<button class="btn btn--ghost btn--small acc__finder" type="button">${icon("ruler")}Find my size</button></div>
                  </details>`
                : ""
            }
            <details>
              <summary>${icon("truck")}Shipping and returns</summary>
              <div class="acc__body">
                <p>Printed when you order, then shipped with tracking in 5 to 10 business days.
                ${catalog.shipping.freeOverCents ? `US shipping is free over ${money(catalog.shipping.freeOverCents)}, otherwise ${money(catalog.shipping.flatRateCents)} flat.` : ""}</p>
                <p>Because every piece is made for you, we cannot take returns for fit, but a misprint or damage gets a free replacement. <a href="help.html#returns">Read the full policy</a>.</p>
              </div>
            </details>
          </div>
        </div>
      </div>`;

    wireGallery(root);

    const priceEl = root.querySelector("[data-price]");
    const status = root.querySelector(".pdp__status");
    const shipEl = root.querySelector("[data-ship]");
    const size = () => root.querySelector('input[name="size"]:checked').value;
    const updateShip = () => {
      const free = catalog.shipping.freeOverCents;
      if (!free || !ready) return (shipEl.textContent = "");
      const after = Bag.subtotal() + unitCents(p, size());
      shipEl.innerHTML =
        after >= free
          ? `${icon("truck")}<span>With this piece your order ships free.</span>`
          : `${icon("truck")}<span>Add this and ${money(free - after)} more for free US shipping.</span>`;
    };
    const fitEl = root.querySelector("[data-fit]");
    const addLabel = root.querySelector("[data-add-label]");
    const update = () => {
      priceEl.textContent = money(unitCents(p, size()));
      if (fitEl) fitEl.innerHTML = `${icon("ruler")}<span>${fitLine(p, size())}</span>`;
      if (addLabel) addLabel.textContent = `Add size ${size()} to bag`;
      updateShip();
    };
    root.querySelectorAll('input[name="size"]').forEach((r) => r.addEventListener("change", update));
    document.addEventListener("vt:bag", updateShip);
    update();

    // The size guide opens in a side panel; choosing a size there picks it here.
    const choose = (s) => {
      const r = root.querySelector(`input[name="size"][value="${CSS.escape(s)}"]`);
      if (!r) return;
      r.checked = true;
      r.dispatchEvent(new Event("change"));
    };
    root.querySelectorAll(".sizes__guide, .acc__finder").forEach((b) =>
      b.addEventListener("click", () => openGuide(p, { selected: size(), onChoose: choose, from: b }))
    );

    if (ready) {
      const addBtn = root.querySelector(".pdp__add");
      const add = (from) => {
        const capped = Bag.add(p.sku, size(), 1);
        status.dataset.state = capped ? "error" : "";
        status.textContent = capped ? `A bag holds up to ${MAX_UNITS} pieces, ${MAX_EACH} of any one size.` : "";
        Bag.open(from);
      };
      addBtn.addEventListener("click", () => add(addBtn));
      root.querySelector(".pdp__now").addEventListener("click", (e) => buyNow(p, size(), e.currentTarget, status));
      wireBuybar(p, addBtn, add, size);
    }

    if (!root.dataset.sku) addProductData([p]);
    renderPairs(p);
  }

  function renderPairs(p) {
    const wrap = document.getElementById("pairs");
    const grid = document.getElementById("pairs-grid");
    if (!wrap || !grid) return;
    const others = products.filter((x) => x.sku !== p.sku && x.name !== p.name);
    const same = others.filter((x) => categoryOf(x) === categoryOf(p));
    const rest = others.filter((x) => categoryOf(x) !== categoryOf(p));
    const picks = [...same, ...rest].slice(0, 3);
    if (!picks.length) return;
    picks.forEach((x) => grid.appendChild(card(x)));
    wrap.hidden = false;
  }

  function setMeta(p) {
    const title = `${p.name} | Valentine Tide`;
    const desc = `${p.subtitle}. ${p.description}`.slice(0, 300);
    const img = `${location.origin}/${p.image}`;
    const url = `${location.origin}${urlOf(p)}`;
    document.title = title;
    const set = (sel, attr, val) => {
      let el = document.head.querySelector(sel);
      if (!el) {
        const [, k, v] = sel.match(/\[(\w+)="([^"]+)"\]/);
        el = document.createElement(sel.startsWith("link") ? "link" : "meta");
        el.setAttribute(k, v);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, val);
    };
    set('meta[name="description"]', "content", desc);
    set('meta[property="og:title"]', "content", title);
    set('meta[property="og:description"]', "content", desc);
    set('meta[property="og:image"]', "content", img);
    set('meta[property="og:url"]', "content", url);
    set('link[rel="canonical"]', "href", url);
  }

  /* Swipe or tap thumbnails; thumbnails follow the swipe. */
  function wireGallery(root) {
    const track = root.querySelector(".pdp__slides");
    const thumbs = [...root.querySelectorAll(".pdp__thumbs .thumb")];
    if (!track || !thumbs.length) return;
    const mark = (i) =>
      thumbs.forEach((t, j) => {
        t.classList.toggle("is-active", i === j);
        if (i === j) t.setAttribute("aria-current", "true");
        else t.removeAttribute("aria-current");
      });
    thumbs.forEach((t, i) =>
      t.addEventListener("click", () => {
        track.scrollTo({ left: track.clientWidth * i, behavior: "smooth" });
        mark(i);
      })
    );
    let raf;
    track.addEventListener("scroll", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => mark(Math.round(track.scrollLeft / track.clientWidth)));
    });
    track.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      track.scrollBy({ left: (e.key === "ArrowRight" ? 1 : -1) * track.clientWidth, behavior: "smooth" });
    });
  }

  function wireBuybar(p, addBtn, add, size) {
    const bar = document.getElementById("buybar");
    if (!bar || !("IntersectionObserver" in window)) return;
    bar.querySelector(".buybar__name").textContent = p.name;
    const price = bar.querySelector(".buybar__price");
    const btn = bar.querySelector(".buybar__btn");
    const sync = () => {
      price.textContent = `Size ${size()}, ${money(unitCents(p, size()))}`;
      btn.textContent = `Add size ${size()}`;
    };
    document.querySelectorAll('input[name="size"]').forEach((r) => r.addEventListener("change", sync));
    sync();
    btn.addEventListener("click", () => add(btn));
    bar.hidden = false;
    new IntersectionObserver(([e]) => {
      bar.classList.toggle("is-on", !e.isIntersecting && e.boundingClientRect.top < 0);
    }).observe(addBtn);
  }

  async function buyNow(p, size, btn, status) {
    btn.disabled = true;
    status.dataset.state = "pending";
    status.textContent = "Opening checkout…";
    try {
      const res = await fetch(`${API}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ sku: p.sku, size, quantity: 1 }], sku: p.sku, size, quantity: 1 }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || `status ${res.status}`);
      window.location.href = data.url;
    } catch (err) {
      console.error("[Valentine Tide] checkout error", err);
      btn.disabled = false;
      status.dataset.state = "error";
      status.textContent = "Checkout did not open. Check your connection and try again.";
    }
  }

  /* =========================================================
     Sizing: fit line, size guide panel with a fit finder, quick add sheet
     ========================================================= */
  const hasChart = (p) => !!(p.sizeChart && p.sizeChart.rows && p.sizeChart.rows.length);
  const num = (v) => Number(inches(v));
  const rowOf = (p, label) => hasChart(p) && p.sizeChart.rows.find((r) => r.label === label);
  const chartSizes = (p) => p.variants.map((v) => v.size).filter((sz) => p.sizeChart.rows.some((r) => r.values[sz]));
  const inUnit = (n, unit) => (unit === "cm" ? String(Math.round(n * 2.54)) : String(Math.round(n * 10) / 10));

  /* One plain sentence about the chosen size, shown under the size buttons. */
  function fitLine(p, size) {
    if (!hasChart(p)) return "";
    const v = (label) => {
      const r = rowOf(p, label);
      return r && r.values[size] ? inches(r.values[size]) : null;
    };
    if (p.sizeChart.kind === "body") {
      const parts = [["chest", v("Chest")], ["waist", v("Waist")], ["hips", v("Hips")]].filter(([, x]) => x);
      if (!parts.length) return "";
      const list = parts.map(([k, x]) => `${x} in ${k}`);
      return `Size ${esc(size)} fits a ${list.slice(0, -1).join(", ")}${list.length > 1 ? " and " : ""}${list[list.length - 1]}.`;
    }
    const w = v("Width");
    const l = v("Length");
    return `Size ${esc(size)} measures ${w ? `${w} in across the chest` : ""}${w && l ? " and " : ""}${l ? `${l} in long` : ""}, laid flat.`;
  }

  /* Picks a size from what the shopper measured (inches). Body charts: the
     smallest size that covers every measurement. Garment charts: the closest
     chest width to a tee they already like. */
  function recommend(p, m) {
    const sizes = chartSizes(p);
    if (p.sizeChart.kind === "body") {
      let pick = -1;
      let over = false;
      for (const [label, val] of [["Chest", m.chest], ["Hips", m.hips]]) {
        const r = rowOf(p, label);
        if (!r || !val) continue;
        let i = sizes.findIndex((s) => num(r.values[s]) >= val - 0.5);
        if (i < 0) (i = sizes.length - 1), (over = true);
        pick = Math.max(pick, i);
      }
      return pick < 0 ? null : { size: sizes[pick], over };
    }
    const r = rowOf(p, "Width");
    if (!r || !m.chest) return null;
    let best = 0;
    sizes.forEach((s, i) => {
      if (Math.abs(num(r.values[s]) - m.chest) < Math.abs(num(r.values[sizes[best]]) - m.chest)) best = i;
    });
    return { size: sizes[best], over: false };
  }

  const Sheet = (() => {
    let root, title, body, lastFocus;
    function build() {
      root = document.createElement("div");
      root.className = "sheet";
      root.hidden = true;
      root.innerHTML = `
        <div class="sheet__scrim" data-close></div>
        <aside class="sheet__panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <div class="sheet__head">
            <h2 class="sheet__title" id="sheet-title"></h2>
            <button class="bag__close" type="button" data-close aria-label="Close">${icon("close", "icon")}</button>
          </div>
          <div class="sheet__body"></div>
        </aside>`;
      document.body.append(root);
      title = root.querySelector(".sheet__title");
      body = root.querySelector(".sheet__body");
      root.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
      document.addEventListener("keydown", (e) => {
        if (root.hidden) return;
        if (e.key === "Escape") close();
        if (e.key === "Tab") {
          const f = [...root.querySelectorAll("button:not([disabled]), a[href], input, select")].filter((el) => el.offsetParent);
          if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), f[f.length - 1].focus());
          else if (!e.shiftKey && document.activeElement === f[f.length - 1]) (e.preventDefault(), f[0].focus());
        }
      });
    }
    function open(heading, html, from) {
      if (!root) build();
      if (root.hidden) lastFocus = from || document.activeElement;
      title.textContent = heading;
      body.innerHTML = html;
      body.scrollTop = 0;
      root.hidden = false;
      document.documentElement.classList.add("bag-is-open");
      requestAnimationFrame(() => root.classList.add("is-open"));
      root.querySelector(".bag__close").focus();
      return body;
    }
    function close(keepFocus) {
      if (!root || root.hidden) return;
      root.classList.remove("is-open");
      document.documentElement.classList.remove("bag-is-open");
      setTimeout(() => (root.hidden = true), 250);
      if (keepFocus !== true && lastFocus && lastFocus.focus) lastFocus.focus();
    }
    return { open, close };
  })();

  function openGuide(p, { selected, onChoose, from, back } = {}) {
    const c = p.sizeChart;
    const body = c.kind === "body";
    const sizes = chartSizes(p);
    const ORDER = ["Chest", "Width", "Waist", "Hips", "Length", "Sleeve length"];
    const rank = (r) => ORDER.indexOf(r.label) + 1 || 99;
    const rows = [...c.rows].sort((a, b) => rank(a) - rank(b));
    let unit = "in";
    let pick = selected;

    const el = Sheet.open(
      "Size guide",
      `
      <p class="guide__for">${esc(p.name)}, ${esc(p.subtitle.replace(/ in black$/i, ""))}</p>
      ${p.sizeHint ? `<p class="guide__hint">${icon("stretch")}<span>${esc(p.sizeHint)}</span></p>` : ""}

      <section class="guide__find" aria-labelledby="find-title">
        <div class="guide__row">
          <h3 class="guide__h" id="find-title">Find your size</h3>
          <div class="seg seg--small" role="radiogroup" aria-label="Units">
            <label><input type="radio" name="guide-unit" value="in" checked /><span>in</span></label>
            <label><input type="radio" name="guide-unit" value="cm" /><span>cm</span></label>
          </div>
        </div>
        <p class="guide__how">${
          body
            ? "Measure yourself with a soft tape, snug but not tight."
            : "Lay a tee you love flat and measure straight across the chest, armpit to armpit."
        }</p>
        <div class="guide__inputs">
          <label class="guide__field"><span>${body ? "Chest" : "Chest of your tee, flat"}</span>
            <input type="number" inputmode="decimal" min="10" max="200" step="0.5" data-m="chest" placeholder="${body ? "38" : "21"}" /><em data-u>in</em></label>
          ${
            body && rowOf(p, "Hips")
              ? `<label class="guide__field"><span>Hips <small>(optional)</small></span>
                  <input type="number" inputmode="decimal" min="10" max="200" step="0.5" data-m="hips" placeholder="40" /><em data-u>in</em></label>`
              : ""
          }
        </div>
        <div class="guide__result" aria-live="polite" hidden></div>
      </section>

      <section class="guide__measure">
        <img src="assets/illustrations/${body ? "measure-body" : "measure-tee"}.svg" alt="" width="${body ? 220 : 240}" height="${body ? 300 : 240}" />
        <ul>
          ${
            body
              ? `<li><strong>Chest:</strong> around the fullest part, under the arms.</li>
                 <li><strong>Waist:</strong> around your natural waist, above the belly button.</li>
                 <li><strong>Hips:</strong> around the fullest part of your hips.</li>`
              : `<li><strong>Chest:</strong> straight across, one armpit seam to the other.</li>
                 <li><strong>Length:</strong> from the top of the collar down to the hem.</li>`
          }
        </ul>
      </section>

      <section class="guide__chart">
        <h3 class="guide__h">${body ? "Body measurements" : "Garment measurements"}</h3>
        <div class="sizechart__scroll"><table class="sizechart__table" data-table></table></div>
        <p class="sizechart__note">${
          body ? "Between two sizes? Take the larger one." : "Measured flat on the garment and may vary by up to 2 inches."
        }</p>
      </section>

      <p class="guide__policy">${icon("print")}<span>Every piece is printed for you, so we cannot swap sizes after it ships. Unsure? <a href="help.html#contact">Ask us</a> before you order.</span></p>
      ${onChoose ? `<div class="guide__foot"><button class="btn btn--wide" type="button" data-choose></button></div>` : ""}`,
      from
    );

    const table = el.querySelector("[data-table]");
    const result = el.querySelector(".guide__result");
    const chooseBtn = el.querySelector("[data-choose]");
    const draw = () => {
      table.innerHTML = `
        <thead><tr><th scope="col">${unit}</th>${sizes.map((s) => `<th scope="col" class="${s === pick ? "is-pick" : ""}">${esc(s)}</th>`).join("")}</tr></thead>
        <tbody>${rows
          .map(
            (r) =>
              `<tr><th scope="row">${esc(LABELS[r.label] || r.label)}</th>${sizes
                .map((s) => `<td class="${s === pick ? "is-pick" : ""}">${r.values[s] ? inUnit(num(r.values[s]), unit) : ""}</td>`)
                .join("")}</tr>`
          )
          .join("")}</tbody>`;
      if (chooseBtn) chooseBtn.textContent = `Choose size ${pick}`;
    };
    const read = () => {
      const m = {};
      el.querySelectorAll("[data-m]").forEach((i) => {
        const v = parseFloat(i.value);
        if (v > 0) m[i.dataset.m] = unit === "cm" ? v / 2.54 : v;
      });
      const rec = m.chest || m.hips ? recommend(p, m) : null;
      result.hidden = !rec;
      if (rec) {
        pick = rec.size;
        result.innerHTML = rec.over
          ? `${icon("ruler")}<span>Your measurements run past our largest size. <strong>${esc(rec.size)}</strong> is the closest, and it will fit snug.</span>`
          : `${icon("check")}<span>Your size is <strong>${esc(rec.size)}</strong>. ${fitLine(p, rec.size).replace(/^Size \S+ /, "It ")}</span>`;
      }
      draw();
    };
    el.querySelectorAll("[data-m]").forEach((i) => i.addEventListener("input", read));
    el.querySelectorAll('input[name="guide-unit"]').forEach((r) =>
      r.addEventListener("change", () => {
        const next = r.value;
        el.querySelectorAll("[data-m]").forEach((i) => {
          const v = parseFloat(i.value);
          if (v > 0) i.value = next === "cm" ? Math.round(v * 2.54) : Math.round((v / 2.54) * 2) / 2;
        });
        el.querySelectorAll("[data-u]").forEach((u) => (u.textContent = next));
        unit = next;
        read();
      })
    );
    if (chooseBtn)
      chooseBtn.addEventListener("click", () => {
        onChoose(pick);
        if (back) back(pick);
        else Sheet.close();
      });
    draw();
  }

  /* Quick add on phones (and anywhere a card's Choose size button shows). */
  function openQuickAdd(p, from, preset) {
    let pick = preset || defaultSize(p);
    const el = Sheet.open(
      "Choose your size",
      `
      <div class="quick__top">
        <img src="${p.image}" alt="" width="96" height="96" />
        <div>
          <p class="quick__name">${esc(p.name)}</p>
          <p class="quick__sub">${esc(p.subtitle)}</p>
          <p class="quick__price" data-qprice></p>
        </div>
      </div>
      <fieldset class="sizes">
        <div class="sizes__top">
          <legend class="sizes__legend">Size</legend>
          ${hasChart(p) ? `<button class="sizes__guide" type="button">${icon("ruler")}Size guide</button>` : ""}
        </div>
        <div class="sizes__list">
          ${p.variants.map((v) => `<label class="size"><input type="radio" name="qsize" value="${esc(v.size)}" ${v.size === pick ? "checked" : ""} /><span>${esc(v.size)}</span></label>`).join("")}
        </div>
        ${hasChart(p) ? `<p class="sizes__fit" data-qfit></p>` : ""}
        ${p.sizeHint ? `<p class="sizes__hint">${icon("stretch")}${esc(p.sizeHint)}</p>` : ""}
      </fieldset>
      <div class="guide__foot">
        <button class="btn btn--wide" type="button" data-qadd></button>
        <a class="quick__more" href="${urlOf(p)}">See photos and details</a>
      </div>`,
      from
    );
    const sync = () => {
      pick = el.querySelector('input[name="qsize"]:checked').value;
      el.querySelector("[data-qprice]").textContent = money(unitCents(p, pick));
      const fit = el.querySelector("[data-qfit]");
      if (fit) fit.innerHTML = `${icon("ruler")}<span>${fitLine(p, pick)}</span>`;
      el.querySelector("[data-qadd]").innerHTML = `${icon("bag")}Add size ${esc(pick)} to bag`;
    };
    el.querySelectorAll('input[name="qsize"]').forEach((r) => r.addEventListener("change", sync));
    sync();
    const guide = el.querySelector(".sizes__guide");
    if (guide)
      guide.addEventListener("click", () =>
        openGuide(p, { selected: pick, onChoose: () => {}, back: (s) => openQuickAdd(p, null, s) })
      );
    el.querySelector("[data-qadd]").addEventListener("click", () => {
      Bag.add(p.sku, pick, 1);
      Sheet.close(true);
      setTimeout(() => Bag.open(from), 260);
    });
  }

  const LABELS = { Width: "Chest (flat)", Length: "Length", "Sleeve length": "Sleeve" };
  /* "26.62" and "17 1/2" both become one tidy number like 26.6 or 17.5. */
  function inches(v) {
    if (v == null || v === "") return "";
    const m = String(v).trim().match(/^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?$/);
    if (!m) return String(v);
    const n = Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
    return String(Math.round(n * 10) / 10);
  }

  /* Garment or body measurements from Printful (catalog.json sizeChart). */
  function sizeChart(p) {
    const c = p.sizeChart;
    const sizes = p.variants.map((v) => v.size).filter((sz) => c.rows.some((r) => r.values[sz]));
    const ORDER = ["Chest", "Width", "Waist", "Hips", "Length", "Sleeve length"];
    const rank = (r) => ORDER.indexOf(r.label) + 1 || 99;
    const rows = [...c.rows].sort((a, b) => rank(a) - rank(b));
    return `
      <div class="sizechart__scroll">
        <table class="sizechart__table">
          <caption>${c.kind === "body" ? "Body measurements" : "Garment measurements"}, in ${esc(c.unit)}</caption>
          <thead><tr><th scope="col"></th>${sizes.map((sz) => `<th scope="col">${esc(sz)}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.map((r) => `<tr><th scope="row">${esc(LABELS[r.label] || r.label)}</th>${sizes.map((sz) => `<td>${esc(inches(r.values[sz]))}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="sizechart__note">${
        c.kind === "body"
          ? "Measure your body with a soft tape. Between sizes? Size up."
          : "Measured flat on the garment and may vary by up to 2 inches. Compare with a tee you already own."
      }</p>`;
  }

  /* Product data for search engines (Google reads it after the page runs). */
  function addProductData(list) {
    const data = list.map((p) => ({
      "@context": "https://schema.org",
      "@type": "Product",
      name: `Valentine Tide ${p.name}`,
      description: p.description,
      image: galleryOf(p).map((g) => `${location.origin}/${g.src}`),
      sku: p.sku,
      category: categoryOf(p) === "swim" ? "Swimwear" : "T-shirts",
      brand: { "@type": "Brand", name: "Valentine Tide" },
      offers: {
        "@type": "Offer",
        url: `${location.origin}${urlOf(p)}`,
        priceCurrency: String(catalog.currency || "usd").toUpperCase(),
        price: (p.priceCents / 100).toFixed(2),
        availability: isReady(p) ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
      },
    }));
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.textContent = JSON.stringify(data.length === 1 ? data[0] : data);
    document.head.appendChild(tag);
  }

  /* =========================================================
     Bag
     Lives in this browser only (localStorage), so it survives a reload or a
     trip to Stripe and back. Prices shown here are for display; the worker
     prices every line again from catalog.json.
     ========================================================= */
  const Bag = (() => {
    let items = [];
    let root, lines, totals, nudge, meter, suggest, status, checkoutBtn, lastFocus;
    let built = false;

    const read = () => {
      try {
        const v = JSON.parse(localStorage.getItem(BAG_KEY) || "[]");
        return Array.isArray(v) ? v : [];
      } catch (e) {
        return [];
      }
    };
    const write = () => {
      try {
        localStorage.setItem(BAG_KEY, JSON.stringify(items));
      } catch (e) {}
    };
    const find = (sku, size) => {
      const product = products.find((p) => p.sku === sku);
      const variant = product && product.variants.find((v) => v.size === size);
      return product && variant ? { product, variant } : null;
    };
    const units = () => items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = () => items.reduce((c, i) => c + unitCents(find(i.sku, i.size).product, i.size) * i.quantity, 0);

    function init() {
      const buttons = document.querySelectorAll("[data-bag-open]");
      if (!API) {
        buttons.forEach((b) => (b.hidden = true));
        return;
      }
      items = read()
        .filter((i) => i && find(i.sku, i.size))
        .map((i) => ({ sku: i.sku, size: i.size, quantity: Math.max(1, Math.min(MAX_EACH, i.quantity | 0)) }));
      build();
      buttons.forEach((b) => b.addEventListener("click", () => open(b)));
      render();
    }

    /* Returns true when a limit stopped part of the add. */
    function add(sku, size, quantity) {
      if (!built) return true;
      let capped = false;
      const room = MAX_UNITS - units();
      let q = Math.min(quantity, room);
      const line = items.find((i) => i.sku === sku && i.size === size);
      if (line) {
        const fit = Math.min(q, MAX_EACH - line.quantity);
        capped = fit < quantity;
        line.quantity += Math.max(0, fit);
      } else if (q > 0) {
        q = Math.min(q, MAX_EACH);
        capped = q < quantity;
        items.push({ sku, size, quantity: q });
      } else capped = true;
      write();
      render();
      return capped;
    }

    function setQty(index, quantity) {
      const others = units() - items[index].quantity;
      items[index].quantity = Math.max(0, Math.min(MAX_EACH, quantity, MAX_UNITS - others));
      if (!items[index].quantity) items.splice(index, 1);
      write();
      render();
    }

    function build() {
      root = document.createElement("div");
      root.className = "bag";
      root.hidden = true;
      root.innerHTML = `
        <div class="bag__scrim" data-close></div>
        <aside class="bag__panel" role="dialog" aria-modal="true" aria-labelledby="bag-title">
          <div class="bag__head">
            <h2 class="bag__title" id="bag-title">Your bag</h2>
            <button class="bag__close" type="button" data-close aria-label="Close bag">${icon("close", "icon")}</button>
          </div>
          <div class="bag__ship">
            <p class="bag__nudge"></p>
            <div class="bag__meter" aria-hidden="true"><span></span></div>
          </div>
          <ul class="bag__lines"></ul>
          <div class="bag__suggest"></div>
          <div class="bag__foot">
            <dl class="bag__totals"></dl>
            <button class="btn btn--wide bag__checkout" type="button">${icon("lock")}Check out securely</button>
            <p class="bag__fine">Have a promo code? Enter it at checkout. Payment is handled by Stripe.</p>
            <p class="form-status bag__status" role="status" aria-live="polite"></p>
          </div>
        </aside>`;
      document.body.append(root);
      lines = root.querySelector(".bag__lines");
      totals = root.querySelector(".bag__totals");
      nudge = root.querySelector(".bag__nudge");
      meter = root.querySelector(".bag__meter span");
      suggest = root.querySelector(".bag__suggest");
      status = root.querySelector(".bag__status");
      checkoutBtn = root.querySelector(".bag__checkout");

      root.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !root.hidden) close();
        if (e.key === "Tab" && !root.hidden) trap(e);
      });
      lines.addEventListener("click", (e) => {
        const b = e.target.closest("[data-act]");
        if (!b) return;
        const i = Number(b.dataset.index);
        if (b.dataset.act === "inc") setQty(i, items[i].quantity + 1);
        if (b.dataset.act === "dec") setQty(i, items[i].quantity - 1);
        if (b.dataset.act === "remove") setQty(i, 0);
      });
      suggest.addEventListener("click", (e) => {
        const b = e.target.closest("[data-suggest]");
        if (!b) return;
        add(b.dataset.suggest, b.dataset.size, 1);
      });
      checkoutBtn.addEventListener("click", checkout);
      built = true;
    }

    /* Keep keyboard focus inside the open bag. */
    function trap(e) {
      const f = [...root.querySelectorAll("button:not([disabled]), a[href]")].filter((el) => el.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), f[f.length - 1].focus());
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) (e.preventDefault(), f[0].focus());
    }

    /* One piece the shopper does not have yet: same drop first. */
    function suggestion() {
      const inBag = new Set(items.map((i) => i.sku));
      const drops = new Set(items.map((i) => find(i.sku, i.size).product.drop));
      const pool = products.filter((p) => !inBag.has(p.sku) && isReady(p));
      // Never suggest the other cut of a rash guard someone already chose.
      const filtered = pool.filter((p) => !(/rash/.test(p.sku) && [...inBag].some((s) => /rash/.test(s))));
      // Someone shopping women's cuts sees the women's rash guard first, and the reverse.
      const bagText = items.map((i) => `${i.sku} ${find(i.sku, i.size).product.subtitle}`).join(" ").toLowerCase();
      const leansWomen = /women's|one-piece|crop/.test(bagText);
      const leansMen = /\bmen's/.test(bagText) && !leansWomen;
      const score = (p) => (leansWomen && /\bmen's/i.test(p.subtitle) ? 1 : 0) + (leansMen && /women's/i.test(p.subtitle) ? 1 : 0);
      const ranked = [...filtered].sort((a, b) => score(a) - score(b));
      return ranked.find((p) => drops.has(p.drop)) || ranked[0] || null;
    }

    function render() {
      const n = units();
      document.querySelectorAll("[data-bag-count]").forEach((el) => {
        el.textContent = n;
        el.hidden = n === 0;
      });
      document.querySelectorAll("[data-bag-open]").forEach((b) => b.setAttribute("aria-label", `Open bag, ${n} item${n === 1 ? "" : "s"}`));
      document.dispatchEvent(new CustomEvent("vt:bag"));

      const ship = catalog.shipping;
      if (!items.length) {
        lines.innerHTML = `
          <li class="bag__empty">
            <img src="assets/illustrations/empty-bag.svg" alt="" width="160" height="160" />
            <p>Your bag is empty.</p>
            <a class="btn" href="/#shop" data-close-link>Shop the drops</a>
          </li>`;
        const link = lines.querySelector("[data-close-link]");
        link.addEventListener("click", () => {
          if (location.pathname === "/" || location.pathname.endsWith("index.html")) close();
        });
        totals.innerHTML = "";
        suggest.innerHTML = "";
        nudge.textContent = ship.freeOverCents ? `Free US shipping on orders over ${money(ship.freeOverCents)}.` : "";
        meter.parentElement.hidden = true;
        checkoutBtn.hidden = true;
        return;
      }
      checkoutBtn.hidden = false;
      lines.innerHTML = items
        .map((i, idx) => {
          const f = find(i.sku, i.size);
          const each = unitCents(f.product, i.size);
          return `
          <li class="bag__line">
            <a href="${urlOf(f.product)}"><img class="bag__img" src="${f.product.image}" alt="" width="72" height="72" /></a>
            <div class="bag__info">
              <p class="bag__name"><a href="${urlOf(f.product)}">${esc(f.product.name)}</a></p>
              <p class="bag__meta">${esc(f.product.subtitle)}, size ${esc(i.size)}</p>
              <div class="bag__qty">
                <button type="button" data-act="dec" data-index="${idx}" aria-label="One less ${esc(f.product.name)} ${esc(i.size)}">${icon("minus")}</button>
                <span aria-live="polite">${i.quantity}</span>
                <button type="button" data-act="inc" data-index="${idx}" aria-label="One more ${esc(f.product.name)} ${esc(i.size)}" ${i.quantity >= MAX_EACH || n >= MAX_UNITS ? "disabled" : ""}>${icon("plus")}</button>
                <button type="button" class="bag__remove" data-act="remove" data-index="${idx}">Remove</button>
              </div>
            </div>
            <p class="bag__line-total">${money(each * i.quantity)}</p>
          </li>`;
        })
        .join("");

      const sub = subtotal();
      const free = ship.freeOverCents && sub >= ship.freeOverCents;
      totals.innerHTML = `
        <div><dt>Subtotal</dt><dd>${money(sub)}</dd></div>
        <div><dt>US shipping</dt><dd>${free ? "Free" : money(ship.flatRateCents)}</dd></div>
        <div class="bag__total"><dt>Total</dt><dd>${money(sub + (free ? 0 : ship.flatRateCents))}</dd></div>`;
      if (ship.freeOverCents) {
        meter.parentElement.hidden = false;
        meter.style.width = `${Math.min(100, (sub / ship.freeOverCents) * 100)}%`;
        nudge.innerHTML = free
          ? `${icon("check")}<span>Your order ships free.</span>`
          : `${icon("truck")}<span>You are <strong>${money(ship.freeOverCents - sub)}</strong> away from free US shipping.</span>`;
      }

      const s = n < MAX_UNITS ? suggestion() : null;
      suggest.innerHTML = s
        ? `<p class="bag__suggest-title">${free ? "Goes with your order" : "Gets you to free shipping"}</p>
           <div class="bag__suggest-row">
             <a href="${urlOf(s)}"><img src="${s.image}" alt="" width="56" height="56" /></a>
             <div class="bag__suggest-info">
               <a class="bag__name" href="${urlOf(s)}">${esc(s.name)}</a>
               <span class="bag__meta">${esc(s.subtitle)}, ${money(s.priceCents)}</span>
             </div>
             <button class="btn btn--ghost btn--small" type="button" data-suggest="${s.sku}" data-size="${esc(defaultSize(s))}" aria-label="Add ${esc(s.name)} in size ${esc(defaultSize(s))}">Add ${esc(defaultSize(s))}</button>
           </div>`
        : "";
      checkoutBtn.disabled = false;
    }

    function open(from) {
      if (!built) return;
      lastFocus = from || document.activeElement;
      root.hidden = false;
      document.documentElement.classList.add("bag-is-open");
      requestAnimationFrame(() => root.classList.add("is-open"));
      root.querySelector(".bag__close").focus();
    }

    function close() {
      root.classList.remove("is-open");
      document.documentElement.classList.remove("bag-is-open");
      setTimeout(() => (root.hidden = true), 250);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    async function checkout() {
      checkoutBtn.disabled = true;
      status.dataset.state = "pending";
      status.textContent = "Opening checkout…";
      try {
        const res = await fetch(`${API}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || `status ${res.status}`);
        try {
          localStorage.setItem(`${BAG_KEY}_pending`, "1");
        } catch (e) {}
        window.location.href = data.url;
      } catch (err) {
        console.error("[Valentine Tide] bag checkout error", err);
        checkoutBtn.disabled = false;
        status.dataset.state = "error";
        status.textContent = "Checkout did not open. Check your connection and try again.";
      }
    }

    return { init, add, open, subtotal: () => (built ? subtotal() : 0) };
  })();
})();
