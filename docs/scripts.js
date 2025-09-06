// scripts.js
// ============================
//   RouterHaus v5 – scripts.js
//   Partials + global UI wiring
//   Emits `partials:loaded`
// ============================
"use strict";

/* ---------- Utilities ---------- */
const debounce = (fn, d = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn.apply(null, a), d); }; };
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------- Toast (lightweight) ---------- */
function showToast(msg, type = "success") {
  let c = document.getElementById("toast-container");
  if (!c) {
    c = document.createElement("div");
    Object.assign(c.style, {
      position: "fixed", bottom: "1rem", right: "1rem", zIndex: "1100",
      display: "flex", flexDirection: "column", gap: ".5rem",
    });
    c.id = "toast-container";
    document.body.appendChild(c);
  }
  const t = document.createElement("div");
  t.textContent = msg;
  const bg = type === "error" ? "#FF6B7B" : type === "info" ? "#00CFFD" : "#37C978";
  Object.assign(t.style, {
    padding: "0.8rem 1.2rem", borderRadius: "8px", color: "#fff",
    background: bg, opacity: "0", transform: "translateY(10px)", transition: "all .3s ease",
  });
  c.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = "1"; t.style.transform = "translateY(0)"; });
  setTimeout(() => { t.style.opacity = "0"; t.addEventListener("transitionend", () => t.remove()); }, 3400);
}

/* ---------- Partials (robust relative → root fallback) ---------- */
async function loadPartials() {
  // If pages use data-partial (preferred)
  const hosts = document.querySelectorAll("[data-partial]");
  const siteRoot = (location.pathname.includes("/assets/"))
    ? location.pathname.split("/assets/")[0] + "/"
    : "/";

  async function tryFetch(urls) {
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: "no-store" });
        if (r.ok) return await r.text();
      } catch(_) {}
    }
    return null;
  }

  if (hosts.length) {
    for (const host of hosts) {
      if (host.children.length) continue;
      const requested = host.dataset.partial;          // e.g., ../../header.html or header.html
      const file = requested.split("/").pop();         // header.html
      const candidates = [
        requested,                 // as provided (best for subpaths)
        siteRoot + file,           // /docs/header.html (repo/site root)
        "/" + file                 // /header.html (domain root)
      ];
      const html = await tryFetch(candidates);
      if (html) host.innerHTML = html;
    }
  } else {
    // Back-compat: simple placeholders without data-partial
    const headHolder = document.getElementById("header-placeholder");
    if (headHolder && (headHolder.children?.length ?? 0) === 0) {
      try {
        const h = await fetch("/header.html", { cache: "no-store" });
        if (h.ok) headHolder.innerHTML = await h.text();
      } catch {}
    }
    const footHolder = document.getElementById("footer-placeholder");
    if (footHolder && (footHolder.children?.length ?? 0) === 0) {
      try {
        const f = await fetch("/footer.html", { cache: "no-store" });
        if (f.ok) footHolder.innerHTML = await f.text();
      } catch {}
    }
  }

  document.dispatchEvent(new CustomEvent("partials:loaded"));
}

/* ---------- UI Wiring ---------- */
function initUI() {
  const header = document.querySelector(".navbar");
  const hamburger = document.getElementById("hamburger-menu");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebar-overlay");
  const themeToggle = document.getElementById("theme-toggle");

  /* Sticky header blur / elevation */
  if (header) {
    const onScroll = debounce(() => {
      const active = (window.scrollY || document.documentElement.scrollTop) > 50;
      header.style.backdropFilter = active ? "blur(26px)" : "blur(0px)";
      header.style.webkitBackdropFilter = header.style.backdropFilter;
      header.style.boxShadow = active ? "var(--shadow)" : "none";
    }, 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* Sidebar (mobile nav) + body lock */
  if (hamburger && sidebar && overlay) {
    const lock = (on) => {
      document.documentElement.style.overflow = on ? "hidden" : "";
      document.body.style.overflow = on ? "hidden" : "";
    };
    const isOpen = () => sidebar.classList.contains("active");
    const toggleSidebar = (force) => {
      const open = typeof force === "boolean" ? force : !isOpen();
      sidebar.classList.toggle("active", open);
      hamburger.classList.toggle("active", open);
      overlay.classList.toggle("active", open);
      hamburger.setAttribute("aria-expanded", String(open));
      sidebar.setAttribute("aria-hidden", String(!open));
      lock(open);
    };
    hamburger.addEventListener("click", () => toggleSidebar());
    overlay.addEventListener("click", () => toggleSidebar(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) toggleSidebar(false); });

    // Delegated smooth-scroll for in-page anchors; also closes sidebar if open
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute("href");
      const target = href ? document.querySelector(href) : null;
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (isOpen()) toggleSidebar(false);
    });
  } else {
    // Smooth-scroll on pages without sidebar
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const href = link.getAttribute("href");
      const target = href ? document.querySelector(href) : null;
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  /* Theme toggle — respects system; persists manual override; toast only on manual */
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  let userOverride = localStorage.getItem("themeOverride");
  const applyTheme = (mode, silent = false) => {
    document.documentElement.dataset.theme = mode;
    if (themeToggle) themeToggle.textContent = mode === "dark" ? "Light Mode" : "Dark Mode";
    if (!silent) showToast(mode === "dark" ? "Dark mode on" : "Light mode on", "info");
  };
  const initialAttr = document.documentElement.getAttribute("data-theme");
  const initialMode = userOverride || initialAttr || (prefersDark.matches ? "dark" : "light");
  applyTheme(initialMode, true);
  prefersDark.addEventListener("change", (e) => { if (!userOverride) applyTheme(e.matches ? "dark" : "light", true); });
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const newMode = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      userOverride = newMode;
      localStorage.setItem("themeOverride", newMode);
      applyTheme(newMode, false);
    });
  }

  /* Simple accordion (any .accordion-item) */
  $$(".accordion-item").forEach((item) => {
    item.addEventListener("click", () => item.classList.toggle("open"));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); item.classList.toggle("open"); }
    });
    item.setAttribute("tabindex", "0");
  });

  /* ---- Force all quiz CTAs to navigate to kits ---- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("#openQuiz,[data-open-quiz]");
    if (!t) return;
    e.preventDefault();
    window.location.href = "/kits.html?quiz=1";
  });
}

/* ---------- Reveal-on-scroll (hooks into .reveal / .reveal.in-view) ---------- */
function setupRevealObserver() {
  const els = $$(".reveal");
  if (!els.length || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        en.target.classList.add("in-view");
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach((el) => io.observe(el));
}

/* ---------- 404 helper: self-heal & suggest ---------- */
async function routerhaus404() {
  if (!document.body.dataset.page404) return;

  // 1) Analytics beacon
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "404",
      path: location.pathname,
      referrer: document.referrer || null
    });
  } catch(_) {}

  // 2) Report broken link (mailto)
  const rpt = document.getElementById("reportLink");
  if (rpt) {
    const subj = encodeURIComponent("Broken link on RouterHaus");
    const body = encodeURIComponent(`URL: ${location.href}\nReferrer: ${document.referrer || "(direct)"}\nUser agent: ${navigator.userAgent}\n\nNotes:`);
    rpt.href = `mailto:hello@routerhaus.com?subject=${subj}&body=${body}`;
  }

  // 3) Simple auto-fixes
  const path = location.pathname.replace(/\/+$/, "");
  const candidates = [];

  // a) Add .html if missing
  if (!/\.(html?|json)$/i.test(path)) candidates.push(path + ".html");

  // b) Folder → index.html
  if (!path.endsWith("/index.html") && !/\.[a-z]+$/i.test(path)) candidates.push(path + "/index.html");

  // c) Dash/underscore swaps
  const last = path.split("/").pop();
  if (last && /_/.test(last)) candidates.push(path.replace(/_/g, "-"));
  if (last && /-/.test(last)) candidates.push(path.replace(/-/g, "_"));

  // d) Legacy redirect map (extend over time)
  const redirectMap = {
    "/assets/blog/iphone-wifi7.html": "/assets/blog/iphone-wifi7-upgrade.html",
    "/assets/blog/mesh-vs-router.html": "/assets/blog/mesh-vs-single-router-2025.html"
  };
  if (redirectMap[path]) {
    location.replace(redirectMap[path]);
    return;
  }

  // Try candidates with HEAD
  for (const url of candidates) {
    try {
      const r = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (r.ok) { location.replace(url); return; }
    } catch(_) {}
  }

  // 4) Fuzzy suggestions from blog.json (and optional strong auto-redirect)
  let posts = [];
  try {
    const r = await fetch("/assets/blog.json", { cache: "no-store" });
    if (r.ok) posts = await r.json();
  } catch(_) {}

  const targetKey = normalizeKey(last || path);
  let best = null;
  for (const p of posts) {
    const key = normalizeKey(p.slug || p.title || "");
    const score = distanceRatio(targetKey, key);
    if (!best || score < best.score) best = { post: p, score };
  }

  if (best && best.score <= 0.18) {
    const dest = `/assets/blog/${(best.post.slug || "").replace(/^\//, "")}.html`;
    try {
      const r = await fetch(dest, { method: "HEAD", cache: "no-store" });
      if (r.ok) { location.replace(dest); return; }
    } catch(_) {}
  }

  renderSuggestions(posts, targetKey);

  // 5) Client-side search on 404
  const form = document.getElementById("siteSearch");
  const input = document.getElementById("q");
  const results = document.getElementById("searchResults");
  const msg = document.getElementById("searchMsg");
  if (form && input && results) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = input.value.trim();
      if (!q) return;
      const items = scoreAll(posts, q).slice(0, 8);
      results.innerHTML = items.map(toResultLi).join("");
      if (msg) msg.textContent = `${items.length} result(s)`;
    });
  }

  /* Helpers (scoped) */
  function normalizeKey(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = [];
    for (let i = 0; i <= b.length; i++) m[i] = [i];
    for (let j = 0; j <= a.length; j++) m[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        m[i][j] = Math.min(
          m[i-1][j] + 1,
          m[i][j-1] + 1,
          m[i-1][j-1] + (a[j-1] === b[i-1] ? 0 : 1)
        );
      }
    }
    return m[b.length][a.length];
  }
  function distanceRatio(a, b) {
    if (!a || !b) return 1;
    const d = levenshtein(a, b);
    return d / Math.max(a.length, b.length);
  }
  function scoreAll(posts, q) {
    const kq = normalizeKey(q);
    return posts
      .map(p => {
        const k = normalizeKey(`${p.title || ""} ${p.slug || ""} ${(p.tags||[]).join(" ")}`);
        return { p, score: distanceRatio(kq, k) };
      })
      .sort((x, y) => x.score - y.score);
  }
  function renderSuggestions(posts, key) {
    const box = document.getElementById("maybeContainer");
    if (!box || !posts.length) return;
    const top = posts
      .map(p => {
        const k = normalizeKey(`${p.slug || ""} ${p.title || ""}`);
        return { p, score: distanceRatio(key, k) };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    box.innerHTML = top.map(({ p }) => `
      <a class="card" href="/assets/blog/${(p.slug || "").replace(/^\//,"")}.html">
        <div class="card-media" style="background-image:url('/${p.cover || "assets/img/placeholder.jpg"}')"></div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(p.title || "Article")}</div>
          <div class="card-meta">${(p.tags||[]).slice(0,3).join(" • ")}</div>
        </div>
      </a>
    `).join("");
  }
  function toResultLi({ p }) {
    return `<li><a href="/assets/blog/${(p.slug || "").replace(/^\//,"")}.html">${escapeHtml(p.title || p.slug)}</a></li>`;
  }
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }
}

/* ---------- DOM Ready ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadPartials();
  initUI();
  setupRevealObserver();
  routerhaus404();
});
