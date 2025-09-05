/* ============================
   RouterHaus – home.js (final)
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
    const gotoKits = (qs) => {
      // keep relative to current dir so it works under /docs/ or root
      window.location.href = `kits.html?${qs}`;
    };
    chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.qpick;
        gotoKits(map[key] || "quiz=1");
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
        if (t && t.nodeType === 1 && t.closest && t.closest('a,button')) return; // no TS cast
        toggle();
      });

      item.addEventListener("keydown", (e)=>{
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
        if (e.key === "Escape" && item.classList.contains("open")) { e.preventDefault(); toggle(); }
      });
    });
  }

  /* ---- Load & wire Journal carousel ---- */
  async function initJournalCarousel(){
    const root = $("#journalCarousel");
    if (!root) return;

    const jsonUrl = root.dataset.blogJson;
    const openNew = root.dataset.openNewTab === "true";
    const track = $(".jc-track", root);
    const dots = $(".jc-dots", root);
    const skeletons = $(".jc-skeletons", root);
    const tpl = $("#jcCardTpl");
    if (!jsonUrl || !track || !tpl) return;

    const fmtDate = (d) => {
      try {
        return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" }).format(new Date(d));
      } catch { return d || ""; }
    };

    let posts = [];
    try {
      const res = await fetch(jsonUrl, { cache: "no-store" });
      posts = await res.json();
    } catch { posts = []; }
    if (!Array.isArray(posts) || !posts.length) return;

    posts.forEach(p => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      const url = p.url || `assets/blog/${p.slug}.html`;
      const coverA = node.querySelector(".cover");
      const coverImg = coverA.querySelector("img");
      const titleA = node.querySelector(".jc-title a");
      coverA.href = titleA.href = url;
      if (openNew) { coverA.target = titleA.target = "_blank"; }
      if (p.cover) coverImg.src = p.cover;
      coverImg.alt = p.title || "";
      titleA.textContent = p.title || "";
      node.querySelector(".author").textContent = p.author || "";
      node.querySelector(".date").textContent = fmtDate(p.date);
      if (p.minutes){
        node.querySelector(".read").textContent = `${p.minutes} min read`;
        node.querySelector(".read").hidden = false;
        node.querySelector(".read-dot").hidden = false;
      }
      node.querySelector(".jc-excerpt").textContent = p.excerpt || "";
      track.appendChild(node);
    });

    skeletons?.remove();

    // Carousel wiring
    const container = root.parentElement;
    const prevBtn = $(".ctrl.prev", container);
    const nextBtn = $(".ctrl.next", container);
    const viewport = $(".jc-viewport", root);

    let idx = 0;
    let groups = 1;

    const calcGroups = () => {
      const first = track.firstElementChild;
      if (!first) return 1;
      const style = getComputedStyle(track);
      const gap = parseFloat(style.columnGap || style.gap || "0");
      const cardWidth = first.getBoundingClientRect().width + gap;
      const visible = Math.max(1, Math.floor((viewport.clientWidth + gap) / cardWidth));
      groups = Math.max(1, Math.ceil(track.children.length / visible));
      dots.innerHTML = "";
      for (let i = 0; i < groups; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.setAttribute("aria-label", `Go to slide ${i + 1}`);
        b.addEventListener("click", () => { idx = i; update(); });
        dots.appendChild(b);
      }
    };

    const updateDots = () => {
      $$("button", dots).forEach((b, i) => b.setAttribute("aria-selected", i === idx ? "true" : "false"));
    };

    const update = () => {
      viewport.scrollTo({ left: viewport.clientWidth * idx, behavior: "smooth" });
      updateDots();
    };

    prevBtn?.addEventListener("click", () => { idx = (idx - 1 + groups) % groups; update(); });
    nextBtn?.addEventListener("click", () => { idx = (idx + 1) % groups; update(); });

    let rT;
    const onResize = () => { clearTimeout(rT); rT = setTimeout(() => { idx = 0; calcGroups(); update(); }, 200); };
    addEventListener("resize", onResize, { passive: true });

    calcGroups();
    update();
  }

  /* ---- Subtle tilt on product cards (skip inside carousels; mouse-only) ---- */
  function tiltCards() {
    if (prefersReduced || isCoarsePointer) return;

    const cards = $$(".product");
    if (!cards.length) return;

    // Track last pointer type globally to avoid adding many window listeners
    let lastPointerType = 'mouse';
    addEventListener('pointerdown', (ev) => { lastPointerType = ev.pointerType || lastPointerType; }, { passive: true });

    const isInCarousel = (el) => !!el.closest(
      '.carousel, .carousel-track, .splide, .splide__track, .swiper, .swiper-wrapper, .glide, .keen-slider, .slick-slider, .flickity-enabled, [data-slider], [role="region"][aria-roledescription="carousel"]'
    );

    cards.forEach((card) => {
      if (card.matches('[data-no-tilt], [data-tilt="off"]')) return;
      if (isInCarousel(card)) return;

      let rAF = 0;

      const onMove = (e) => {
        if ((e.pointerType && e.pointerType !== "mouse") || lastPointerType !== 'mouse') return;

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
    initJournalCarousel();
    tiltCards();
  });
})();
