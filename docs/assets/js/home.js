/* ============================
   RouterHaus – home.js (patched)
   Stable, aligned with other pages; safe partial mounting
============================ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const prefersReduced = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const isCoarsePointer = globalThis.matchMedia?.("(pointer: coarse)")?.matches ?? false;

  /* ---- Partials (robust + idempotent) ---- */
  async function mountPartial(target){
    const requested = target?.dataset?.partial;
    if (!requested || (target?.children?.length ?? 0) > 0) return;

    const file = requested.split('/').pop();
    const path = location.pathname;
    const siteRoot = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
    const docsRoot = path.includes('/docs/') ? path.split('/docs/')[0] + '/docs/' : null;

    const candidates = [
      requested,                      // as-given
      docsRoot ? docsRoot + file : null,
      siteRoot + file,                // current dir root
      '/' + file                      // domain root
    ].filter(Boolean);

    for (const url of candidates){
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok){
          const html = await res.text();
          if ((target?.children?.length ?? 0) === 0) target.innerHTML = html;
          return;
        }
      } catch { /* try next */ }
    }
    console.warn('Partial load failed for', candidates);
  }

  /* ---- Persona quick chips → route to kits with mapped filters ---- */
  function wireQuickChips() {
    const chips = $$(".persona-chips .chip");
    if (!chips.length) return;
    const map = {
      apt: "coverage=Apartment%2FSmall&recos=1",
      large: "coverage=Large%2FMulti-floor&mesh=Mesh-ready&recos=1",
      wfh: "use=Work%20from%20Home&recos=1",
      gaming: "use=Gaming&wan=2.5G&recos=1",
    };
    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.qpick;
        const qs = map[key] || "quiz=1";
        window.location.href = `kits.html?${qs}`;
      });
      // Keyboard affordance
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
      });
      if (!btn.hasAttribute("aria-label")) btn.setAttribute("aria-label", btn.textContent.trim());
      if (!btn.hasAttribute("tabindex")) btn.setAttribute("tabindex", "0");
      if (!btn.hasAttribute("role")) btn.setAttribute("role", "button");
    });
  }

  /* ---- Reveal animations on scroll ---- */
  function revealify() {
    const els = $$(".reveal");
    if (!els.length) return;
    if (prefersReduced || !("IntersectionObserver" in window)) {
      els.forEach(el => el.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("in-view");
          io.unobserve(en.target);
        }
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });
    els.forEach((el) => io.observe(el));
  }

  /* ---- FAQ accordion (ARIA without HTML edits) ---- */
  function wireAccordion(){
    $$(".accordion-item").forEach(item=>{
      item.setAttribute("role","button");
      item.setAttribute("tabindex","0");
      item.setAttribute("aria-expanded","false");

      const content = $("p", item);
      if (content) {
        const cid = content.id || `acc_${Math.random().toString(36).slice(2)}`;
        content.id = cid;
        item.setAttribute("aria-controls", cid);
      }

      const toggle = () => {
        const isOpen = item.classList.toggle("open");
        item.setAttribute("aria-expanded", String(isOpen));
      };

      item.addEventListener("click", (e)=>{
        if (getSelection()?.toString()) return;
        const t = e.target;
        if (t && t.nodeType === 1 && /** Element */ t.closest && t.closest('a,button')) return; // ✅ no TS cast
        toggle();
      });

      item.addEventListener("keydown", (e)=>{
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        if (e.key === "Escape" && item.classList.contains("open")) { e.preventDefault(); toggle(); }
      });
    });
  }

  /* ---- Subtle tilt on product cards (skip inside carousels; mouse-only) ---- */
  function tiltCards() {
    if (prefersReduced || isCoarsePointer) return;

    const cards = $$(".product");
    if (!cards.length) return;

    cards.forEach((card) => {
      // Skip if the card lives inside a slider/carousel wrapper
      if (card.closest('.carousel, .splide, .swiper, .glide, .keen-slider, [data-slider], [role="region"][aria-roledescription="carousel"]')) {
        return;
      }

      let rAF = 0;

      const onMove = (e) => {
        // Only react to actual mouse pointers (don’t interfere with drag/swipe)
        if (e.pointerType && e.pointerType !== "mouse") return;

        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        cancelAnimationFrame(rAF);
        rAF = requestAnimationFrame(() => {
          card.style.transform =
            `perspective(800px) rotateX(${(-dy * 5).toFixed(2)}deg) rotateY(${(dx * 5).toFixed(2)}deg) translateY(-6px)`;
        });
      };

      const reset = () => {
        cancelAnimationFrame(rAF);
        card.style.transform = "";
      };

      card.addEventListener("pointermove", onMove, { passive: true });
      card.addEventListener("pointerleave", reset);
      card.addEventListener("blur", reset, true);

      // Defensive: if input switches to touch/pen mid-session
      window.addEventListener("pointerdown", (ev) => {
        if (ev.pointerType !== "mouse") reset();
      }, { passive: true });
    });
  }

  /* ---- Init ---- */
  document.addEventListener("DOMContentLoaded", async () => {
    await Promise.all([
      mountPartial($("#header-placeholder")),
      mountPartial($("#footer-placeholder")),
    ]);

    wireQuickChips();
    revealify();
    wireAccordion();
    tiltCards();
  });
})();
