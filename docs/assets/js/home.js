/* ============================
   RouterHaus – home.js
   Persona chips, reveals, and card tilt
============================ */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));


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
    });
  }

  /* ---- FAQ accordion (no HTML changes needed) ---- */
  function wireAccordion(){
    $$(".accordion-item").forEach(item=>{
      item.addEventListener("click", (e)=>{
        if (getSelection()?.toString()) return;
        item.classList.toggle("open");
      });
    });
  }

  /* ---- Subtle tilt on product cards (perf-safe) ---- */
  function tiltCards() {
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
      card.addEventListener("mousemove", onMove);
      card.addEventListener("mouseleave", reset);
      card.addEventListener("blur", reset, true);
    });
  }

  /* ---- Init ---- */
  document.addEventListener("DOMContentLoaded", () => {
    wireQuickChips();
    window.RH?.reveal();
    wireAccordion();
    tiltCards();
  });
})();
