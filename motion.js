/* =========================================================
   Valentine Tide motion
   Reveals [data-reveal] elements and the children of
   [data-reveal-group] as they scroll into view, and marks the
   nav once the page has scrolled. Without JS, or with reduced
   motion, everything simply shows.
   ========================================================= */

"use strict";

(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = document.querySelector(".nav");

  if (nav) {
    const mark = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
    mark();
    window.addEventListener("scroll", mark, { passive: true });
  }

  if (reduce || !("IntersectionObserver" in window)) return;

  const targets = [...document.querySelectorAll("[data-reveal]")];
  document.querySelectorAll("[data-reveal-group]").forEach((group) => {
    [...group.children].forEach((child, i) => {
      child.style.setProperty("--reveal-delay", `${i * 110}ms`);
      targets.push(child);
    });
  });

  document.documentElement.classList.add("has-reveal");

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    },
    // Any part on screen counts. A ratio threshold never fires for something
    // taller than the screen, like the stacked shop grid on a phone.
    { rootMargin: "0px 0px -8% 0px", threshold: 0 }
  );

  targets.forEach((el) => {
    el.classList.add("reveal");
    io.observe(el);
  });
})();
