/* RouterHaus Journal — HTML-post aware blog */
// No partial mounting changes required; scripts.js handles header/footer.
(() => {
  // ---------- Small utils ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);
  const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
  const nopunct = (s) => String(s||'').toLowerCase().replace(/[\W_]+/g, '');
  const collator = new Intl.Collator(undefined, { numeric:true, sensitivity:'base' });
  const fmtDate = (dStr) => { try {
    return new Intl.DateTimeFormat(undefined, { year:'numeric', month:'short', day:'2-digit' }).format(new Date(dStr));
  } catch { return dStr || ''; } };
  const debounce = (fn, d=200) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), d); }; };

  const LS = {
    get: (k, d=null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    del: (k) => localStorage.removeItem(k),
  };

  // Config
  const CFG = Object.assign({
    blogJsonUrl: 'assets/blog/blog.json',
    blogPostBase: 'assets/blog',
    postSelector: 'article, main article, .post, #post',
    openPostsInNewTab: false
  }, window.RH_CONFIG || {});

  const postUrl = (slug) => `${CFG.blogPostBase.replace(/\/$/,'')}/${slug}.html`;

  // ---------- Elements ----------
  const el = {
    searchInput: byId('searchInput'),
    searchBtn: byId('searchBtn'),
    sortSelect: byId('sortSelect'),
    pageSizeSelect: byId('pageSizeSelect'),
    tagsBar: byId('tagsBar'),
    activeChips: byId('activeChips'),
    emptyQuickChips: byId('emptyQuickChips'),
    featuredHero: byId('featuredHero'),
    paginationTop: byId('paginationTop'),
    paginationBottom: byId('paginationBottom'),
    skeletonTpl: byId('skeletonTpl'),
    postCardTpl: byId('postCardTpl'),
    skeletonGrid: byId('skeletonGrid'),
    resultsGrid: byId('postResults'),
    emptyState: byId('emptyState'),
    matchCount: byId('matchCount'),
    // preview modal
    previewModal: byId('postPreviewModal'),
    previewClose: byId('previewClose'),
    previewTitle: byId('previewTitle'),
    previewMeta: byId('previewMeta'),
    previewBody: byId('previewBody'),
    previewCover: byId('previewCover'),
    previewReadLink: byId('previewReadLink'),
    // newsletter
    nlForm: byId('newsletterForm'),
    nlEmail: byId('nlEmail'),
    nlMsg: byId('nlMsg'),
  };

  // ---------- State ----------
  const urlQS = new URLSearchParams(location.search);
  const state = {
    posts: [],
    filtered: [],
    tags: new Set((urlQS.get('tags') || '').split(',').filter(Boolean)),
    tagList: [],
    sort: urlQS.get('sort') || 'newest',
    page: Math.max(1, Number(urlQS.get('page')) || 1),
    pageSize: Number(urlQS.get('ps')) || 12,
    search: (urlQS.get('q') || '').trim().toLowerCase(),
    contentIndexed: false,  // set true after we lazily index HTML bodies
  };

  // ---------- Reveal ----------
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
  const revealify = () => $$('.reveal').forEach(n => io.observe(n));

  // ---------- Data ----------
  const FALLBACK_POSTS = [
    { id:'p1', title:'Wi-Fi 7 vs 6E: What Actually Changes at Home?', slug:'wifi-7-vs-6e', author:'RouterHaus', date:'2025-02-10',
      tags:['Wi-Fi 7','How-To','Buying Guide'], excerpt:'A plain-English breakdown of Wi-Fi 7 and whether you’ll feel the difference on your phone, console, and smart home.',
      cover:'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1400&auto=format&fit=crop', minutes:7, featured:true, views:12840 },
  ];

  const fetchPostsIndex = async () => {
    try {
      const res = await fetch(CFG.blogJsonUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error('bad status');
      const arr = await res.json();
      if (!Array.isArray(arr) || !arr.length) return FALLBACK_POSTS;
      return arr.map(normalizePost);
    } catch {
      return FALLBACK_POSTS.map(normalizePost);
    }
  };

  function normalizePost(p, idx) {
    const o = { ...p };
    o.id = o.id || `bp_${idx}_${(o.slug || o.title || 'post').replace(/\W+/g,'').slice(0,18)}`;
    o.title = String(o.title || 'Untitled').trim();
    o.slug = String(o.slug || o.id);
    o.url  = o.url || postUrl(o.slug);
    o.author = o.author || 'RouterHaus';
    o.date = o.date || new Date().toISOString().slice(0,10);
    o.tags = Array.isArray(o.tags) ? o.tags.filter(Boolean) : [];
    o.excerpt = o.excerpt || '';
    o.cover = typeof o.cover === 'string' ? o.cover : '';
    o.minutes = Number.isFinite(Number(o.minutes)) ? Number(o.minutes) : undefined; // we can compute later
    o.featured = !!o.featured;
    o.views = Number.isFinite(Number(o.views)) ? Number(o.views) : 0;

    // placeholders for lazy content indexing
    o._contentHtml = '';
    o._contentText = '';
    return o;
  }

  // Fetch and extract a post’s HTML -> {html,text,minutes?}
  async function fetchPostBody(p) {
    if (p._contentHtml) return p;
    try {
      const res = await fetch(p.url, { cache: 'no-store' });
      if (!res.ok) throw new Error('bad status');
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const container = doc.querySelector(CFG.postSelector) || doc.body;
      const sanitized = sanitizeForPreview(container.cloneNode(true));
      const text = extractText(sanitized);
      p._contentHtml = sanitized.innerHTML;
      p._contentText = text;
      if (!p.minutes) p.minutes = Math.max(3, Math.round(text.split(/\s+/).filter(Boolean).length / 200));
    } catch {
      // fallback to excerpt only
      p._contentHtml ||= `<p>${escapeHtml(p.excerpt || '')}</p>`;
      p._contentText ||= String(p.excerpt || '');
      if (!p.minutes) p.minutes = Math.max(3, Math.round(p._contentText.split(/\s+/).filter(Boolean).length / 200));
    }
    return p;
  }

  // Lazy index all posts’ text content (for search-in-content)
  async function ensureContentIndexed() {
    if (state.contentIndexed) return;
    await Promise.all(state.posts.map(fetchPostBody));
    state.contentIndexed = true;
  }

  // Strip scripts/iframes/styles for safe preview, keep basic formatting
  function sanitizeForPreview(node) {
    node.querySelectorAll('script, style, iframe, object, embed, link').forEach(n => n.remove());
    // Make links open in new tab for preview
    node.querySelectorAll('a[href]').forEach(a => { a.setAttribute('target','_blank'); a.setAttribute('rel','noopener'); });
    return node;
  }
  function extractText(node){ return node.textContent || ''; }

  // ---------- URL sync ----------
  const syncUrl = () => {
    const qs = new URLSearchParams();
    if (state.search) qs.set('q', state.search);
    if (state.sort !== 'newest') qs.set('sort', state.sort);
    if (state.page > 1) qs.set('page', String(state.page));
    if (state.pageSize !== 12) qs.set('ps', String(state.pageSize));
    if (state.tags.size) qs.set('tags', [...state.tags].join(','));
    history.replaceState(null, '', qs.toString() ? `?${qs}` : location.pathname);
  };

  // ---------- Tags ----------
  function collectTags(posts) {
    const map = new Map();
    posts.forEach(p => (p.tags||[]).forEach(t => map.set(t, (map.get(t)||0) + 1)));
    const arr = [...map.entries()].sort((a,b) => collator.compare(a[0], b[0]));
    state.tagList = arr.map(([tag]) => tag);
    return map;
  }

  function renderTagsBar(_counts, filteredBase) {
    el.tagsBar.innerHTML = '';
    const base = filteredBase;
    state.tagList.forEach(tag => {
      const nextCount = base.filter(p => p.tags.includes(tag)).length;
      const btn = document.createElement('button');
      btn.className = 'chip'; btn.type = 'button';
      btn.setAttribute('aria-pressed', state.tags.has(tag) ? 'true' : 'false');
      btn.textContent = tag;
      const small = document.createElement('span');
      small.className = 'count'; small.textContent = ` (${nextCount})`;
      btn.appendChild(small);
      const impossible = nextCount === 0 && !state.tags.has(tag);
      if (impossible) btn.classList.add('disabled');
      btn.addEventListener('click', () => {
        if (impossible) return;
        if (state.tags.has(tag)) state.tags.delete(tag); else state.tags.add(tag);
        state.page = 1; onStateChanged({});
      });
      el.tagsBar.appendChild(btn);
    });
  }

  // ---------- Filtering ----------
  function passesSearch(p, term) {
    if (!term) return true;
    const hayBasic = [p.title, p.author, p.excerpt, ...(p.tags || [])].join(' ').toLowerCase();
    const hayContent = (state.contentIndexed ? p._contentText : '').toLowerCase();
    const hayRaw = `${hayBasic} ${hayContent}`;
    const hayComp = nopunct(hayRaw);
    const tokens = term.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const tComp = nopunct(t);
      if (!(hayRaw.includes(t) || hayComp.includes(tComp))) return false;
    }
    return true;
  }

  function applyFilters() {
    const withSearch = state.posts.filter(p => passesSearch(p, state.search));
    const filteredBase = withSearch.slice();
    const withTags = [...state.tags].reduce((arr, tag) => arr.filter(p => p.tags.includes(tag)), filteredBase);
    state.filtered = withTags;
    return { filteredBase, tagCounts: collectTags(withSearch) };
  }

  // ---------- Sorting ----------
  const comparators = {
    newest: (a,b) => new Date(b.date) - new Date(a.date),
    popular: (a,b) => (b.views - a.views) || (new Date(b.date) - new Date(a.date)),
    'reading-asc': (a,b) => (a.minutes - b.minutes) || (new Date(b.date) - new Date(a.date)),
    'reading-desc': (a,b) => (b.minutes - a.minutes) || (new Date(b.date) - new Date(a.date)),
  };

  // ---------- Pagination ----------
  function paginate() {
    const total = state.filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
    state.page = clamp(state.page, 1, pageCount);
    const start = (state.page - 1) * state.pageSize;
    const end = start + state.pageSize;
    renderPagination(el.paginationTop, pageCount);
    renderPagination(el.paginationBottom, pageCount);
    return state.filtered.slice(start, end);
  }

  function renderPagination(container, pageCount) {
    if (!container) return;
    container.innerHTML = '';
    if (pageCount <= 1) return;

    const makeBtn = (label, page, cls='page') => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = cls; b.textContent = label;
      b.dataset.page = String(page);
      b.disabled = page === state.page;
      if (cls === 'page' && page === state.page) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => { state.page = page; onStateChanged({ scrollToTop:true }); });
      return b;
    };

    const prev = makeBtn('Prev', Math.max(1, state.page - 1), 'page prev');
    prev.disabled = state.page === 1;
    container.appendChild(prev);

    const nums = numberedPages(state.page, pageCount);
    for (const p of nums) {
      if (p === '…') {
        const s = document.createElement('span'); s.className = 'page disabled'; s.textContent = '…';
        container.appendChild(s);
      } else {
        container.appendChild(makeBtn(String(p), p));
      }
    }

    const next = makeBtn('Next', Math.min(pageCount, state.page + 1), 'page next');
    next.disabled = state.page === pageCount;
    container.appendChild(next);
  }

  function numberedPages(current, total) {
    const arr = []; const win = 2;
    const start = Math.max(1, current - win);
    const end = Math.min(total, current + win);
    if (start > 1) { arr.push(1); if (start > 2) arr.push('…'); }
    for (let i=start;i<=end;i++) arr.push(i);
    if (end < total) { if (end < total - 1) arr.push('…'); arr.push(total); }
    return arr;
  }

  // ---------- Rendering ----------
  function renderSkeletons(n = state.pageSize) {
    el.skeletonGrid.innerHTML = ''; el.skeletonGrid.style.display = '';
    for (let i=0;i<n;i++) el.skeletonGrid.appendChild(el.skeletonTpl.content.cloneNode(true));
  }
  function hideSkeletons(){ el.skeletonGrid.style.display = 'none'; }

  function renderFeatured() {
    const f = state.posts.find(p => p.featured) || state.posts.slice().sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
    if (!f) { el.featuredHero.innerHTML=''; el.featuredHero.style.display='none'; return; }
    el.featuredHero.style.display='';
    const href = f.url;
    const target = CFG.openPostsInNewTab ? ' target="_blank" rel="noopener"' : ' target="_self"';
    el.featuredHero.innerHTML = `
      <div class="hero-wrap reveal">
        <div class="hero-text">
          <div class="hero-meta">
            <strong>${escapeHtml(f.author)}</strong><span class="dot">•</span><time>${fmtDate(f.date)}</time><span class="dot">•</span><span>${f.minutes ?? ''} ${f.minutes ? 'min read' : ''}</span>
          </div>
          <h2><a href="${escapeAttr(href)}"${target}>${escapeHtml(f.title)}</a></h2>
          <p>${escapeHtml(f.excerpt)}</p>
          <div class="chips hero-tags">
            ${(f.tags||[]).map(t => `<button class="chip" type="button" data-tag="${escapeAttr(t)}">${escapeHtml(t)}</button>`).join('')}
          </div>
          <div class="hero-actions">
            <a class="btn primary" href="${escapeAttr(href)}"${target}>Read the article</a>
            <button class="btn ghost" type="button" data-preview="${f.id}">Quick preview</button>
          </div>
        </div>
        <div class="hero-cover"><img src="${escapeAttr(f.cover || '')}" alt="" /></div>
      </div>
    `;
    $$('.hero-tags .chip', el.featuredHero).forEach(ch => {
      ch.addEventListener('click', () => { const t = ch.dataset.tag; if (t) state.tags.add(t); state.page = 1; onStateChanged({ scrollToTop:true }); });
    });
    el.featuredHero.querySelector('[data-preview]')?.addEventListener('click', async () => openPreview(await fetchPostBody(f)));
    revealify();
  }

  function renderActiveChips() {
    el.activeChips.innerHTML = '';
    if (!state.tags.size) { el.activeChips.style.display='none'; return; }
    el.activeChips.style.display='';
    for (const t of state.tags) {
      const btn = document.createElement('button');
      btn.type='button'; btn.className='chip';
      btn.setAttribute('role','listitem');
      btn.setAttribute('aria-label', `Remove tag: ${t}`);
      btn.textContent = `${t} ✕`;
      btn.addEventListener('click', () => { state.tags.delete(t); state.page=1; onStateChanged({}); });
      el.activeChips.appendChild(btn);
    }
  }

  function renderResults(items) {
    el.resultsGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const p of items) frag.appendChild(renderCard(p));
    el.resultsGrid.appendChild(frag);
    revealify();
  }

  function renderCard(p) {
    const node = el.postCardTpl.content.cloneNode(true);
    const aCover = node.querySelector('.cover');
    const img = node.querySelector('img');
    const featured = node.querySelector('.featured-badge');
    const titleLink = node.querySelector('.title-link');
    const author = node.querySelector('.author');
    const date = node.querySelector('.date');
    const read = node.querySelector('.read');
    const viewsDot = node.querySelector('.views-dot');
    const views = node.querySelector('.views');
    const excerpt = node.querySelector('.excerpt');
    const tags = node.querySelector('.chips.line.tags');
    const readBtn = node.querySelector('.ctaRow a');
    const previewBtn = node.querySelector('.previewBtn');

    const href = p.url;
    const target = CFG.openPostsInNewTab ? '_blank' : '_self';

    aCover.href = href; aCover.setAttribute('aria-label', p.title); aCover.target = target; aCover.rel = 'noopener';
    img.src = p.cover || ''; img.alt = '';
    if (p.featured) featured.hidden = false;

    titleLink.href = href; titleLink.textContent = p.title; titleLink.target = target; titleLink.rel = 'noopener';
    author.textContent = p.author; date.textContent = fmtDate(p.date);
    if (p.minutes) read.textContent = `${p.minutes} min read`;

    if (p.views > 0) { views.textContent = `${p.views.toLocaleString()} views`; views.hidden = false; viewsDot.hidden = false; }

    excerpt.textContent = p.excerpt;
    tags.innerHTML = '';
    (p.tags || []).forEach(t => {
      const chip = document.createElement('button');
      chip.className = 'chip'; chip.type = 'button'; chip.textContent = t;
      chip.addEventListener('click', () => { state.tags.add(t); state.page=1; onStateChanged({}); });
      tags.appendChild(chip);
    });

    readBtn.href = href; readBtn.target = target; readBtn.rel = 'noopener';
    previewBtn.addEventListener('click', async () => openPreview(await fetchPostBody(p)));
    // Light prefetch on hover for snappy preview
    [aCover, titleLink, previewBtn].forEach(elm => elm.addEventListener('mouseenter', () => { fetchPostBody(p); }));

    return node;
  }

  // ---------- Preview Modal ----------
  async function openPreview(p) {
    if (!el.previewModal) return;
    await fetchPostBody(p);
    el.previewTitle.textContent = p.title;
    el.previewMeta.textContent = `${p.author} • ${fmtDate(p.date)}${p.minutes ? ` • ${p.minutes} min read` : ''}`;
    el.previewCover.innerHTML = p.cover ? `<img src="${escapeAttr(p.cover)}" alt="">` : '';
    el.previewBody.innerHTML = p._contentHtml || `<p>${escapeHtml(p.excerpt)}</p>`;
    el.previewReadLink.href = p.url;
    el.previewReadLink.target = CFG.openPostsInNewTab ? '_blank' : '_self';
    try { if (typeof el.previewModal.showModal === 'function') el.previewModal.showModal(); else el.previewModal.setAttribute('open',''); }
    catch { el.previewModal.setAttribute('open',''); }
  }
  function closePreview(){ try{ el.previewModal.close(); }catch{ el.previewModal.removeAttribute('open'); } }
  el.previewClose?.addEventListener('click', closePreview);
  el.previewModal?.addEventListener('click', (e) => {
    const r = el.previewModal.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) closePreview();
  });
  el.previewModal?.addEventListener('cancel', (e)=>{ e.preventDefault(); closePreview(); });

  // ---------- Toolbar / Search ----------
  function wireToolbar() {
    if (el.sortSelect) {
      el.sortSelect.value = state.sort;
      el.sortSelect.addEventListener('change', () => { state.sort = el.sortSelect.value; state.page=1; onStateChanged({}); });
    }
    if (el.pageSizeSelect) {
      el.pageSizeSelect.value = String(state.pageSize);
      el.pageSizeSelect.addEventListener('change', () => { state.pageSize = Number(el.pageSizeSelect.value); state.page=1; onStateChanged({}); });
    }
    if (el.searchInput) {
      el.searchInput.value = state.search;
      const apply = async () => {
        state.search = (el.searchInput.value||'').trim().toLowerCase();
        state.page=1;
        if (state.search.length >= 3 && !state.contentIndexed) await ensureContentIndexed();
        onStateChanged({ scrollToTop:true });
      };
      const onType = debounce(apply, 220);
      el.searchInput.addEventListener('input', onType);
      el.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); apply(); }
        if (e.key === 'Escape' && el.searchInput.value) { e.preventDefault(); el.searchInput.value=''; apply(); }
      });
      el.searchBtn?.addEventListener('click', apply);
      document.addEventListener('keydown', (e) => {
        const tag = (document.activeElement?.tagName || '').toLowerCase();
        const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;
        const modK = (e.key.toLowerCase()==='k' && (e.ctrlKey || e.metaKey));
        if (typing && !modK) return;
        if (modK || e.key === '/') { e.preventDefault(); el.searchInput.focus(); el.searchInput.select(); }
      });
    }
  }

  // ---------- Lifecycle ----------
  async function init(){
    renderSkeletons(12);
    try {
      state.posts = (await fetchPostsIndex()).map(normalizePost);
      // Compute minutes quickly for any that already have _contentText (none yet) or have an explicit minutes
      // (we compute precisely when preview is fetched)
      hideSkeletons();
    } catch {
      hideSkeletons();
      state.posts = FALLBACK_POSTS.map(normalizePost);
    }
    wireToolbar();
    renderFeatured();
    onStateChanged({ initial:true });
    if (state.search) el.searchInput?.focus();
  }

  function onStateChanged(opts) {
    const { filteredBase, tagCounts } = applyFilters();
    (comparators[state.sort] || comparators.newest) && state.filtered.sort(comparators[state.sort] || comparators.newest);
    renderTagsBar(tagCounts, filteredBase);
    const total = state.filtered.length, all = state.posts.length;
    el.matchCount.textContent = `${total} match${total===1?'':'es'} / ${all}`;
    renderActiveChips();
    const pageItems = paginate();
    renderResults(pageItems);
    el.emptyState.classList.toggle('hide', total > 0);
    renderEmptyChips();
    syncUrl();
    if (opts?.scrollToTop) window.scrollTo({ top:0, behavior:'smooth' });
  }

  function renderEmptyChips() {
    const c = el.emptyQuickChips; if (!c) return;
    c.innerHTML = '';
    const add = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'chip'; b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => { fn(); state.page=1; onStateChanged({}); });
      c.appendChild(b);
    };
    add('Show Featured', () => { state.search=''; el.searchInput.value=''; state.tags.clear(); state.sort='popular'; });
    add('Short Reads (≤6 min)', () => { state.search=''; state.tags.clear(); state.sort='reading-asc'; });
    if (state.tagList[0]) add(`Tag: ${state.tagList[0]}`, () => { state.tags.clear(); state.tags.add(state.tagList[0]); });
  }

  // ---------- Helpers ----------
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

  document.addEventListener('DOMContentLoaded', init);
})();
