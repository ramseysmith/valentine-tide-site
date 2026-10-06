/* =========================================================
   Valentine Tide shop
   Renders products from catalog.json and sends the buyer to
   Stripe Checkout through the shop worker.
   ========================================================= */

"use strict";

(function () {
  const cfg = window.VT_CONFIG || {};
  const API = cfg.API_BASE && !cfg.API_BASE.startsWith("REPLACE") ? cfg.API_BASE.replace(/\/$/, "") : null;

  const money = (cents) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

  document.addEventListener("DOMContentLoaded", async () => {
    const grid = document.getElementById("shop-grid");
    if (!grid) return;

    let catalog;
    try {
      const res = await fetch("catalog.json", { cache: "no-cache" });
      catalog = await res.json();
    } catch (err) {
      console.error("[Valentine Tide] catalog failed to load", err);
      grid.innerHTML = '<p class="shop__empty">The shop is surfacing. Check back in a moment.</p>';
      return;
    }

    const note = document.getElementById("shop-shipping");
    if (note && catalog.shipping.freeOverCents) {
      note.textContent = `Free US shipping over ${money(catalog.shipping.freeOverCents)}. Printed to order, ships in 5 to 10 business days.`;
    }

    const products = catalog.products.filter((p) => p.active);
    grid.innerHTML = "";
    products.forEach((p) => grid.appendChild(renderProduct(p, catalog.shipping)));
    if (API) Bag.init(catalog);
  });

  function renderProduct(p, shipping) {
    const gallery = p.gallery && p.gallery.length ? p.gallery : [{ src: p.image, alt: `${p.name}, ${p.subtitle}` }];
    // Sellable only when checkout is connected and Printful knows the product.
    const ready = !!API && (cfg.SHOP_PREVIEW || p.variants.some((v) => v.printfulSyncVariantId));
    const el = document.createElement("article");
    el.className = "product";
    el.innerHTML = `
      <div class="product__gallery">
        <div class="product__media" data-zoom>
          <img class="product__img" src="${gallery[0].src}" alt="${esc(gallery[0].alt)}" width="1200" height="1200" />
        </div>
        ${
          gallery.length > 1
            ? `<div class="product__thumbs" role="list">
                ${gallery
                  .map(
                    (g, i) => `
                  <button class="thumb${i === 0 ? " is-active" : ""}" type="button" role="listitem" data-index="${i}" aria-label="Show ${esc(g.alt)}" ${i === 0 ? 'aria-current="true"' : ""}>
                    <img src="${g.src}" alt="" width="1200" height="1200" loading="lazy" />
                  </button>`
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>
      <div class="product__info">
        ${p.drop ? `<p class="product__drop">Drop ${esc(p.drop)}${ready ? "" : " · Coming soon"}</p>` : ""}
        <h3 class="product__name">${esc(p.name)}</h3>
        <p class="product__sub">${esc(p.subtitle)}</p>
        <p class="product__price" data-price>${money(p.priceCents)}</p>
        <p class="product__desc">${esc(p.description)}</p>
        ${
          p.details && p.details.length
            ? `<ul class="product__details">${p.details.map((d) => `<li>${esc(d)}</li>`).join("")}</ul>`
            : ""
        }

        <fieldset class="sizes">
          <legend class="sizes__legend">Size</legend>
          <div class="sizes__list">
            ${p.variants
              .map(
                (v, i) => `
              <label class="size">
                <input type="radio" name="size-${p.sku}" value="${v.size}" ${i === 1 ? "checked" : ""} />
                <span>${v.size}</span>
              </label>`
              )
              .join("")}
          </div>
          ${p.sizeHint ? `<p class="sizes__hint">${esc(p.sizeHint)}</p>` : ""}
        </fieldset>

        <div class="buy">
          <label class="visually-hidden" for="qty-${p.sku}">Quantity</label>
          <select class="buy__qty" id="qty-${p.sku}">
            ${[1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}</option>`).join("")}
          </select>
<button class="btn buy__btn${ready ? "" : " buy__btn--notify"}" type="button">
            ${ready ? "Buy now" : "Notify me when it drops"}
          </button>
        </div>
        ${ready ? `<button class="btn btn--ghost buy__bag" type="button">${icon("bag")}Add to bag</button>` : ""}
        <p class="form-status buy__status" role="status" aria-live="polite"></p>
        <ul class="assure">
          ${shipping && shipping.freeOverCents ? `<li>${icon("truck")}Free US shipping over ${money(shipping.freeOverCents)}</li>` : ""}
          <li>${icon("return")}Free replacement for misprints or damage</li>
          <li>${icon("lock")}Secure checkout through Stripe</li>
        </ul>
      </div>`;

    wireGallery(el, gallery);

    const priceEl = el.querySelector("[data-price]");
    const status = el.querySelector(".buy__status");
    const btn = el.querySelector(".buy__btn");
    const qty = el.querySelector(".buy__qty");

    const selectedVariant = () => {
      const size = el.querySelector(`input[name="size-${p.sku}"]:checked`).value;
      return p.variants.find((v) => v.size === size);
    };
    const updatePrice = () => {
      priceEl.textContent = money(p.priceCents + (selectedVariant().surchargeCents || 0));
    };
    el.querySelectorAll(`input[name="size-${p.sku}"]`).forEach((r) => r.addEventListener("change", updatePrice));

    if (!ready) qty.hidden = true;

    const bagBtn = el.querySelector(".buy__bag");
    if (bagBtn) {
      bagBtn.addEventListener("click", () => {
        const capped = Bag.add(p.sku, selectedVariant().size, Number(qty.value));
        status.dataset.state = capped ? "error" : "";
        status.textContent = capped ? `Bags hold up to ${MAX_UNITS} shirts, 5 of any one size.` : "";
        Bag.open(bagBtn);
      });
    }

    btn.addEventListener("click", async () => {
      // Not live yet: capture the interest instead of a dead button.
      if (!ready) {
        const field = document.getElementById("signup-interest");
        const note = document.getElementById("signup-interest-note");
        if (field) field.value = `${p.name} (${selectedVariant().size})`;
        if (note) {
          note.innerHTML = `We'll email you when the <strong>${esc(p.name)}</strong> drops.`;
          note.hidden = false;
        }
        const signup = document.getElementById("signup");
        if (signup) signup.scrollIntoView({ behavior: "smooth", block: "center" });
        const input = document.getElementById("email");
        if (input) setTimeout(() => input.focus({ preventScroll: true }), 500);
        return;
      }
      if (!API) {
        status.dataset.state = "error";
        status.textContent = "Checkout isn't connected yet.";
        return;
      }
      const variant = selectedVariant();
      btn.disabled = true;
      status.dataset.state = "pending";
      status.textContent = "Opening checkout…";
      try {
        const res = await fetch(`${API}/checkout`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ sku: p.sku, size: variant.size, quantity: Number(qty.value) }],
            sku: p.sku,
            size: variant.size,
            quantity: Number(qty.value),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || `status ${res.status}`);
        window.location.href = data.url;
      } catch (err) {
        console.error("[Valentine Tide] checkout error", err);
        btn.disabled = false;
        status.dataset.state = "error";
        status.textContent = "The tide pulled back. Try again in a moment.";
      }
    });

    return el;
  }

  /* Thumbnails swap the main image; on devices with a mouse, hovering zooms in
     toward the cursor so the print texture is visible. */
  function wireGallery(el, gallery) {
    const main = el.querySelector(".product__img");
    const frame = el.querySelector("[data-zoom]");

    el.querySelectorAll(".thumb").forEach((btn) => {
      btn.addEventListener("click", () => {
        const g = gallery[Number(btn.dataset.index)];
        main.src = g.src;
        main.alt = g.alt;
        el.querySelectorAll(".thumb").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
          if (b === btn) b.setAttribute("aria-current", "true");
          else b.removeAttribute("aria-current");
        });
      });
    });

    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    frame.addEventListener("mousemove", (e) => {
      const r = frame.getBoundingClientRect();
      main.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    });
    frame.addEventListener("mouseenter", () => frame.classList.add("is-zoomed"));
    frame.addEventListener("mouseleave", () => frame.classList.remove("is-zoomed"));
  }

  /* ---------- Bag ----------
     Lives in this browser only (localStorage), so it survives a reload or a
     trip to Stripe and back. Prices shown here are for display; the worker
     prices every line again from catalog.json. */
  const BAG_KEY = "vt_bag";
  const MAX_UNITS = 10;
  const Bag = (() => {
    let items = [];
    let catalog = null;
    let root, fab, lines, totals, nudge, meter, status, checkoutBtn, lastFocus;

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
      const product = catalog.products.find((p) => p.active && p.sku === sku);
      const variant = product && product.variants.find((v) => v.size === size);
      return product && variant ? { product, variant } : null;
    };
    const unitCents = (f) => f.product.priceCents + (f.variant.surchargeCents || 0);
    const units = () => items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = () => items.reduce((c, i) => c + unitCents(find(i.sku, i.size)) * i.quantity, 0);

    function init(cat) {
      catalog = cat;
      items = read().filter((i) => i && find(i.sku, i.size)).map((i) => ({ sku: i.sku, size: i.size, quantity: Math.max(1, Math.min(5, i.quantity | 0)) }));
      build();
      render();
    }

    /* Returns true when a limit stopped part of the add. */
    function add(sku, size, quantity) {
      let capped = false;
      const room = MAX_UNITS - units();
      let q = Math.min(quantity, room);
      const line = items.find((i) => i.sku === sku && i.size === size);
      if (line) {
        const fit = Math.min(q, 5 - line.quantity);
        capped = fit < quantity;
        line.quantity += Math.max(0, fit);
      } else if (q > 0) {
        q = Math.min(q, 5);
        capped = q < quantity;
        items.push({ sku, size, quantity: q });
      } else capped = true;
      write();
      render();
      return capped;
    }

    function setQty(index, quantity) {
      const others = units() - items[index].quantity;
      items[index].quantity = Math.max(0, Math.min(5, quantity, MAX_UNITS - others));
      if (!items[index].quantity) items.splice(index, 1);
      write();
      render();
    }

    function build() {
      fab = document.createElement("button");
      fab.type = "button";
      fab.className = "bag-fab";
      fab.hidden = true;
      fab.setAttribute("aria-haspopup", "dialog");
      fab.addEventListener("click", () => open(fab));

      root = document.createElement("div");
      root.className = "bag";
      root.hidden = true;
      root.innerHTML = `
        <div class="bag__scrim" data-close></div>
        <aside class="bag__panel" role="dialog" aria-modal="true" aria-labelledby="bag-title">
          <div class="bag__head">
            <h2 class="bag__title" id="bag-title">Your bag</h2>
            <button class="bag__close" type="button" data-close aria-label="Close bag">&times;</button>
          </div>
          <ul class="bag__lines"></ul>
          <div class="bag__foot">
            <p class="bag__nudge"></p>
            <div class="bag__meter" aria-hidden="true"><span></span></div>
            <dl class="bag__totals"></dl>
            <button class="btn bag__checkout" type="button">Checkout</button>
            <p class="form-status bag__status" role="status" aria-live="polite"></p>
          </div>
        </aside>`;
      document.body.append(fab, root);
      lines = root.querySelector(".bag__lines");
      totals = root.querySelector(".bag__totals");
      nudge = root.querySelector(".bag__nudge");
      meter = root.querySelector(".bag__meter span");
      status = root.querySelector(".bag__status");
      checkoutBtn = root.querySelector(".bag__checkout");

      root.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", close));
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !root.hidden) close();
      });
      lines.addEventListener("click", (e) => {
        const b = e.target.closest("[data-act]");
        if (!b) return;
        const i = Number(b.dataset.index);
        if (b.dataset.act === "inc") setQty(i, items[i].quantity + 1);
        if (b.dataset.act === "dec") setQty(i, items[i].quantity - 1);
        if (b.dataset.act === "remove") setQty(i, 0);
      });
      checkoutBtn.addEventListener("click", checkout);
    }

    function render() {
      const n = units();
      fab.hidden = n === 0;
      fab.innerHTML = `${icon("bag")}<span>Bag</span><span class="bag-fab__count">${n}</span>`;
      fab.setAttribute("aria-label", `Open bag, ${n} item${n === 1 ? "" : "s"}`);

      if (!items.length) {
        lines.innerHTML = '<li class="bag__empty">Your bag is empty.</li>';
        totals.innerHTML = "";
        nudge.textContent = "";
        meter.parentElement.hidden = true;
        checkoutBtn.disabled = true;
        return;
      }
      lines.innerHTML = items
        .map((i, idx) => {
          const f = find(i.sku, i.size);
          return `
          <li class="bag__line">
            <img class="bag__img" src="${f.product.image}" alt="" width="72" height="72" />
            <div class="bag__info">
              <p class="bag__name">${esc(f.product.name)}</p>
              <p class="bag__meta">Size ${esc(i.size)} · ${money(unitCents(f))}</p>
              <div class="bag__qty">
                <button type="button" data-act="dec" data-index="${idx}" aria-label="One less ${esc(f.product.name)} ${esc(i.size)}">&minus;</button>
                <span aria-live="polite">${i.quantity}</span>
                <button type="button" data-act="inc" data-index="${idx}" aria-label="One more ${esc(f.product.name)} ${esc(i.size)}" ${i.quantity >= 5 || n >= MAX_UNITS ? "disabled" : ""}>+</button>
                <button type="button" class="bag__remove" data-act="remove" data-index="${idx}">Remove</button>
              </div>
            </div>
            <p class="bag__line-total">${money(unitCents(f) * i.quantity)}</p>
          </li>`;
        })
        .join("");

      const sub = subtotal();
      const ship = catalog.shipping;
      const free = ship.freeOverCents && sub >= ship.freeOverCents;
      totals.innerHTML = `
        <div><dt>Subtotal</dt><dd>${money(sub)}</dd></div>
        <div><dt>Shipping</dt><dd>${free ? "Free" : money(ship.flatRateCents)}</dd></div>
        <div class="bag__total"><dt>Total</dt><dd>${money(sub + (free ? 0 : ship.flatRateCents))}</dd></div>`;
      if (ship.freeOverCents) {
        meter.parentElement.hidden = false;
        meter.style.width = `${Math.min(100, (sub / ship.freeOverCents) * 100)}%`;
        nudge.textContent = free ? "You've unlocked free US shipping." : `Add ${money(ship.freeOverCents - sub)} more for free US shipping.`;
      }
      checkoutBtn.disabled = false;
    }

    function open(from) {
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
        status.textContent = "The tide pulled back. Try again in a moment.";
      }
    }

    return { init, add, open };
  })();

  function icon(name) {
    return `<svg class="icon icon--sm" aria-hidden="true"><use href="assets/icons.svg#${name}" /></svg>`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
})();
