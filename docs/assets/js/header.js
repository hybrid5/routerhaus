/* RouterHaus — Header wiring (mobile drawer, theme, a11y, active link, quiz forwarding) */
(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  // ---------- Theme ----------
  const THEME_KEY = 'rh-theme';
  const prefersDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
  const getTheme = () => localStorage.getItem(THEME_KEY) || (prefersDark() ? 'dark' : 'light');
  const setTheme = (mode) => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(THEME_KEY, mode);
    const tbtn = $('#theme-toggle');
    if (tbtn) tbtn.textContent = mode === 'dark' ? 'Light Mode' : 'Dark Mode';
  };
  const wireTheme = () => {
    setTheme(getTheme()); // apply saved/system
    const btn = $('#theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
      setTheme(next);
    });
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Only follow system if user hasn't explicitly chosen
      if (!localStorage.getItem(THEME_KEY)) setTheme(e.matches ? 'dark' : 'light');
    });
  };

  // ---------- Mobile sidebar ----------
  let lastFocus = null;
  const selectors = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  const openSidebar = (hamburger, sidebar, overlay) => {
    lastFocus = document.activeElement;
    hamburger.classList.add('active');
    hamburger.setAttribute('aria-expanded', 'true');
    sidebar.classList.add('active');
    sidebar.setAttribute('aria-hidden', 'false');
    overlay.classList.add('active');
    document.body.classList.add('nav-open');

    // focus trap
    const focusables = $$(selectors, sidebar);
    (focusables[0] || sidebar).focus();
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const first = focusables[0];
      const last  = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    sidebar.addEventListener('keydown', trap);
    sidebar._trapHandler = trap;
  };

  const closeSidebar = (hamburger, sidebar, overlay) => {
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    sidebar.classList.remove('active');
    sidebar.setAttribute('aria-hidden', 'true');
    overlay.classList.remove('active');
    document.body.classList.remove('nav-open');
    if (sidebar._trapHandler) sidebar.removeEventListener('keydown', sidebar._trapHandler);
    if (lastFocus) lastFocus.focus();
  };

  const wireSidebar = () => {
    const hamburger = $('#hamburger-menu');
    const sidebar   = $('#sidebar');
    const overlay   = $('#sidebar-overlay');
    if (!hamburger || !sidebar || !overlay) return;

    hamburger.addEventListener('click', () => {
      const open = hamburger.getAttribute('aria-expanded') === 'true';
      open ? closeSidebar(hamburger, sidebar, overlay) : openSidebar(hamburger, sidebar, overlay);
    });

    overlay.addEventListener('click', () => closeSidebar(hamburger, sidebar, overlay));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('active')) {
        closeSidebar(hamburger, sidebar, overlay);
      }
    });

    // Close when a sidebar nav link is clicked
    $$('#sidebar nav a').forEach(a => a.addEventListener('click', () => closeSidebar(hamburger, sidebar, overlay)));

    // Close on resize to desktop
    let w = innerWidth;
    addEventListener('resize', () => {
      if (innerWidth >= 769 && w < 769 && sidebar.classList.contains('active')) {
        closeSidebar(hamburger, sidebar, overlay);
      }
      w = innerWidth;
    });
  };

  // ---------- Forward CTAs (mobile -> main) ----------
  const wireForwardCTAs = () => {
    // FIX: original inline script had a broken selector interpolation
    document.addEventListener('click', (e) => {
      const openQuizBtn = e.target.closest('[data-open-quiz]');
      if (openQuizBtn) { $('#openQuiz')?.click(); }
      const editQuizBtn = e.target.closest('[data-edit-quiz]');
      if (editQuizBtn) { $('#editQuiz')?.click(); }
    });

    // Keep "Edit my answers" visibility in sync (if present)
    const editHeader = $('#editQuiz');
    const editMobile = $('[data-edit-quiz]');
    if (editHeader && editMobile) {
      const sync = () => { editMobile.hidden = editHeader.hasAttribute('hidden'); };
      const mo = new MutationObserver(sync);
      mo.observe(editHeader, { attributes: true, attributeFilter: ['hidden'] });
      sync();
    }
  };

  // ---------- Active link highlight ----------
  const wireActiveLink = () => {
    const path = location.pathname.split('/').pop() || 'index.html';
    // desktop + sidebar
    const links = [...$$('.nav-desktop a'), ...$$('#sidebar nav a')];
    links.forEach(a => {
      const href = a.getAttribute('href');
      if (!href) return;
      const match = href === path || (href === 'index.html' && (path === '' || path === '/'));
      if (match) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  };

  // ---------- Wire when header exists (handles partials) ----------
  const wireHeader = () => {
    if (!$('header.navbar')) return false;
    wireTheme();
    wireSidebar();
    wireForwardCTAs();
    wireActiveLink();
    return true;
  };

  const waitForHeader = () => {
    if (wireHeader()) return;
    const mo = new MutationObserver(() => { if (wireHeader()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  };

  document.addEventListener('DOMContentLoaded', waitForHeader);
})();
