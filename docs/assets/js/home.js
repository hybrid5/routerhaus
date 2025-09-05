/* ============================
   RouterHaus – home.js
   Stable, aligned with other pages; safe partial mounting
============================ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const prefersReduced = matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const isCoarsePointer = matchMedia?.("(pointer: coarse)")?.matches ?? false;

  /* ---- Partials (robust + idempotent; mirrors blog loader) ---- */
  async function mountPartial(target){
    const requested = target?.dataset?.partial;
    if (!requested || (target?.children?.length ?? 0) > 0) return;

    const siteRoot = (location.pathname.includes('/assets/')
      ? location.pathname.split('/assets/')[0] + '/'
      : '/');
    const file = requested.split('/').pop();
    const candidates = [
      requested,          // as-given (relative)
      siteRoot + file,    // site root (e.g., /docs/header.html)
      '/' + file          // domain root (/header.html)
    ];

    for (const url of candidates){
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok){
          const html = await res.text();
          // Only set if still empty (avoid racing with global scripts.js)
          if ((target?.children?.length ?? 0) === 0) target.innerHTML = html;
          return;
        }
      } catch { /* swallow and try next */ }
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
      // keyboard affordance (Enter/Space) if not naturally a button
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
      });
      btn.setAttribute("aria-label", btn.textContent.trim());
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

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in-view");
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
  }

  /* ---- FAQ accordion (ARIA without HTML edits) ---- */
  function wireAccordion(){
    $$(".accordion-item").forEach(item=>{
      // make the header region focusable
      item.setAttribute("role","button");
      item.setAttribute("tabindex","0");
      item.setAttribute("aria-expanded", "false");

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
        // avoid toggling when selecting text or clicking links inside
        if (getSelection()?.toString()) return;
        if ((e.target as HTMLElement).closest('a,button')) return;
        toggle();
      });
      item.addEventListener("keydown", (e)=>{
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        if (e.key === "Escape" && item.classList.contains("open")) { e.preventDefault(); toggle(); }
      });
    });
  }

  /* ---- Subtle tilt on product cards (perf-safe, respects reduced motion) ---- */
  function tiltCards() {
    if (prefersReduced || isCoarsePointer) return; // skip on mobile / reduced motion
    const cards = $$(".product");
    if (!cards.length) return;

    cards.forEach((card) => {
      let rAF = 0;

      const onMove = (e) => {
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

      card.addEventListener("mousemove", onMove, { passive: true });
      card.addEventListener("mouseleave", reset);
      card.addEventListener("blur", reset, true);
      // defensive: if pointer becomes coarse mid-session (e.g., switch to touch)
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
    // If your global scripts.js already mounts partials, the above is a no-op.

    wireQuickChips();
    revealify();
    wireAccordion();
    tiltCards();
  });
})();
