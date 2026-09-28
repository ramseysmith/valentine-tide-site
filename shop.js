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
    products.forEach((p) => grid.appendChild(renderProduct(p)));
  });

  function renderProduct(p) {
    const gallery = p.gallery && p.gallery.length ? p.gallery : [{ src: p.image, alt: `${p.name}, ${p.subtitle}` }];
    const ready = cfg.SHOP_PREVIEW || p.variants.some((v) => v.printfulSyncVariantId);
    const el = document.createElement("article");
    el.className = "product";
    el.innerHTML = `
      <div class="product__gallery">
        <div class="product__media" data-zoom>
          <img class="product__img" src="${gallery[0].src}" alt="${esc(gallery[0].alt)}" width="1200" height="1400" />
        </div>
        ${
          gallery.length > 1
            ? `<div class="product__thumbs" role="list">
                ${gallery
                  .map(
                    (g, i) => `
                  <button class="thumb${i === 0 ? " is-active" : ""}" type="button" role="listitem" data-index="${i}" aria-label="Show ${esc(g.alt)}" ${i === 0 ? 'aria-current="true"' : ""}>
                    <img src="${g.src}" alt="" width="1200" height="1400" loading="lazy" />
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
          <button class="btn buy__btn" type="button" ${ready ? "" : "disabled"}>
            ${ready ? "Buy now" : "Dropping soon"}
          </button>
        </div>
        <p class="form-status buy__status" role="status" aria-live="polite"></p>
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

    btn.addEventListener("click", async () => {
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
          body: JSON.stringify({ sku: p.sku, size: variant.size, quantity: Number(qty.value) }),
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

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
})();
