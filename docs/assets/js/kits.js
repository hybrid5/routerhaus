/* assets/js/kits.js
 * RouterHaus Kits — Polished app logic
 * - Fast: minimal DOM churn, batched renders, debounced inputs
 * - Helpful: live facet counts, impossible options disabled (but never your selected)
 * - Smart recos: honors quiz price/access/mesh/speed + inclusive "applicable*" envelopes
 * - A11y-first: proper aria-live, keyboard, focus restore, details state persistence
 * - URL sync: clean, stable links you can copy/share
 * - Zero new emojis; only the ones your UI already uses
 */

(() => {
  // ---------- Small utils ----------
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);
  const clamp = (n,a,b) => Math.max(a, Math.min(b, n));
  const uniq  = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const fmtMoney = (v) => (v == null || Number(v) === 0 ? '' : `$${Number(v).toLocaleString(undefined,{maximumFractionDigits:0})}`);
  const collator = new Intl.Collator(undefined, { numeric:true, sensitivity:'base' });
  const debounce = (fn, d=200) => { let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a), d); }; };
  const rafBatch = (() => { let p = Promise.resolve(); return (fn) => (p = p.then(()=>new Promise(r=>requestAnimationFrame(()=>{ try{fn();}finally{r();} })))) })();
  const nopunct = (s) => String(s||'').toLowerCase().replace(/[\W_]+/g, ''); // fuzzy token compare
  const LS = {
    get: (k, d=null) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
    del: (k) => localStorage.removeItem(k),
  };

  // ---------- State ----------
  const urlQS = new URLSearchParams(location.search);
  const state = {
    data: [],
    filtered: [],
    facets: {},                      // key -> Set of selected raw values
    facetDefs: {},                   // definitions (built below)
    facetOptList: {},                // key -> ordered array of option raw values
    openDetails: LS.get('rh.details', {}), // key -> boolean (persisted)
    sort: urlQS.get('sort') || 'relevance',
    page: Math.max(1, Number(urlQS.get('page')) || 1),
    pageSize: Number(urlQS.get('ps')) || 12,
    compare: new Set(LS.get('rh.compare', [])),
    // Default OFF; only user toggle may enable (ignore URL/localStorage)
    showRecos: false,
    search: (urlQS.get('q') || '').trim().toLowerCase(),
    quiz: null,                      // latest quiz answers (object) or null
  };

  // ---------- Elements ----------
  const el = {
    headerMount: byId('header-placeholder'),
    footerMount: byId('footer-placeholder'),

    filtersAside: byId('filtersAside'),
    filtersForm: byId('filtersForm'),
    expandAll: byId('expandAll'),
    collapseAll: byId('collapseAll'),
    clearAllFacets: byId('clearAllFacets'),

    matchCount: byId('matchCount'),
    activeChips: byId('activeChips'),

    sortSelect: byId('sortSelect'),
    pageSizeSelect: byId('pageSizeSelect'),
    toggleRecos: byId('toggleRecos'),

    recommendations: byId('recommendations'),
    recoGrid: byId('recoGrid'),
    recoNote: byId('recoNote'),

    paginationTop: byId('paginationTop'),
    paginationBottom: byId('paginationBottom'),

    kitsStatus: byId('kitsStatus'),
    kitsError: byId('kitsError'),

    skeletonTpl: byId('skeletonTpl'),
    cardTpl: byId('cardTpl'),
    skeletonGrid: byId('skeletonGrid'),
    resultsGrid: byId('kitResults'),
    emptyState: byId('emptyState'),

    filtersFab: byId('filtersFab'),
    activeCountBadge: byId('activeCount'),
    filtersDrawer: byId('filtersDrawer'),
    drawerFormMount: byId('drawerFormMount'),
    applyDrawer: byId('applyDrawer'),

    openFiltersHeader: byId('openFiltersHeader'),

    copyLink: byId('copyLink'),
    resetAll: byId('resetAll'),

    comparePanel: byId('comparePanel'),
    compareItemsPanel: byId('compareItemsPanel'),
    clearCompare: byId('clearCompare'),
    compareDrawer: byId('compareDrawer'),
    compareItems: byId('compareItems'),
    clearCompareMobile: byId('clearCompareMobile'),
    compareSticky: byId('compareSticky'),
    compareCount: byId('compareCount'),

    // badges
    badge_brand: byId('badge-brand'),
    badge_wifi: byId('badge-wifiGen'),
    badge_mesh: byId('badge-meshReady'),
    badge_wan: byId('badge-wanTier'),
    badge_cov: byId('badge-coverageBucket'),
    badge_dev: byId('badge-deviceLoad'),
    badge_use: byId('badge-primaryUse'),
    badge_price: byId('badge-priceBucket'),

    // facet option containers
    facet_brand: byId('facet-brand'),
    facet_wifiGen: byId('facet-wifiGen'),
    facet_wifiBands: byId('facet-wifiBands'),
    facet_meshReady: byId('facet-meshReady'),
    facet_meshEco: byId('facet-meshEco'),
    facet_wanTier: byId('facet-wanTier'),
    facet_lanCount: byId('facet-lanCount'),
    facet_multiGigLan: byId('facet-multiGigLan'),
    facet_usb: byId('facet-usb'),
    facet_coverageBucket: byId('facet-coverageBucket'),
    facet_deviceLoad: byId('facet-deviceLoad'),
    facet_primaryUse: byId('facet-primaryUse'),
    facet_access: byId('facet-access'),
    facet_priceBucket: byId('facet-priceBucket'),
  };

  // ---------- Partials (header/footer) ----------
  const mountPartial = async (target) => {
    const path = target?.dataset?.partial;
    if (!path) return;
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (res.ok) target.innerHTML = await res.text();
    } catch {}
  };

  // ---------- Data load / normalize ----------
  const getJsonUrl = () => (window.RH_CONFIG?.jsonUrl || 'kits.json');
  const fetchData = async () => {
    const urls = [getJsonUrl(), './kits.json'];
    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) continue;
        const arr = await res.json();
        if (Array.isArray(arr)) return arr.map(deriveFields);
      } catch {}
    }
    throw new Error('Unable to load kits.json');
  };

  const num = (v) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : 0; };
  const guessBrand = (m) => (m || '').split(' ')[0] || 'Unknown';
  const normWifi = (w) => {
    const s = String(w).toUpperCase().replace(/\s+/g,'');
    if (s.includes('7')) return '7';
    if (s.includes('6E')) return '6E';
    if (s.includes('6')) return '6';
    if (s.includes('5')) return '5';
    return '6';
  };
  const guessBands = (wifiStandard) => (/6E|7/.test(String(wifiStandard)) ? ['2.4','5','6'] : ['2.4','5']);

  const wanLabelFromMbps = (mbps) => {
    if (!mbps) return '';
    if (mbps >= 10000) return '10G';
    if (mbps >= 5000)  return '5G';
    if (mbps >= 2500)  return '2.5G';
    return '≤1G';
  };
  const wanNumericFromLabel = (label) => (label==='10G'?10000:label==='5G'?5000:label==='2.5G'?2500:label==='≤1G'?1000:0);
  const wanRank = (o) => ({'':0,'≤1G':1,'2.5G':2,'5G':3,'10G':4}[o.wanTierLabel || wanLabelFromMbps(o.maxWanSpeedMbps) || ''] || 0);

  const priceToBucket = (p) => {
    if (!p) return 'N/A';
    if (p < 150) return '<150';
    if (p < 300) return '150–299';
    if (p < 600) return '300–599';
    return '600+';
  };
  const priceOrder = ['<150','150–299','300–599','600+'];
  const priceRank = (b) => Math.max(0, priceOrder.indexOf(b));

  const coverageToBucket = (sq) => {
    if (!sq) return '';
    if (sq < 1800) return 'Apartment/Small';
    if (sq <= 3200) return '2–3 Bedroom';
    return 'Large/Multi-floor';
  };
  const capacityToLoad = (n) => {
    if (!n) return '';
    if (n <= 8)   return '1–5';
    if (n <= 20)  return '6–15';
    if (n <= 40)  return '16–30';
    if (n <= 80)  return '31–60';
    if (n <= 120) return '61–100';
    return '100+';
  };

  function deriveFields(x, idx) {
    const o = { ...x };
    o.id = o.id ?? `k_${idx}_${(o.model || '').replace(/\W+/g,'').slice(0,12)}`;
    o.brand = o.brand || o.manufacturer || guessBrand(o.model);
    o.model = (o.model || '').trim();

    o.wifiStandard = normWifi(o.wifiStandard || o.wifi || '');
    if (!Array.isArray(o.wifiBands) || !o.wifiBands.length) o.wifiBands = guessBands(o.wifiStandard);

    o.meshReady = !!o.meshReady;

    o.coverageSqft = num(o.coverageSqft);
    o.coverageBucket = o.coverageBucket || coverageToBucket(o.coverageSqft);

    o.maxWanSpeedMbps = num(o.maxWanSpeedMbps);
    o.wanTierLabel = o.wanTierLabel || wanLabelFromMbps(o.maxWanSpeedMbps);
    o.wanTier = o.wanTier ?? wanNumericFromLabel(o.wanTierLabel);

    o.lanCount = Number.isFinite(Number(o.lanCount)) ? Number(o.lanCount) : null;
    o.multiGigLan = !!o.multiGigLan;
    o.usb = !!o.usb;

    o.deviceCapacity = num(o.deviceCapacity);
    o.deviceLoad = o.deviceLoad || capacityToLoad(o.deviceCapacity);

    if (!Array.isArray(o.primaryUses)) o.primaryUses = o.primaryUse ? [String(o.primaryUse)] : [];
    if (!o.primaryUse && o.primaryUses.length) o.primaryUse = o.primaryUses[0];
    o.primaryUse = o.primaryUse || 'All-Purpose';

    o.applicableDeviceLoads = Array.isArray(o.applicableDeviceLoads) && o.applicableDeviceLoads.length ? uniq(o.applicableDeviceLoads) : uniq([o.deviceLoad]);
    o.applicableCoverageBuckets = Array.isArray(o.applicableCoverageBuckets) && o.applicableCoverageBuckets.length ? uniq(o.applicableCoverageBuckets) : uniq([o.coverageBucket]);
    o.applicableWanTiers = Array.isArray(o.applicableWanTiers) && o.applicableWanTiers.length ? uniq(o.applicableWanTiers) : uniq([o.wanTierLabel].filter(Boolean));
    o.applicablePrimaryUses = Array.isArray(o.applicablePrimaryUses) && o.applicablePrimaryUses.length ? uniq(o.applicablePrimaryUses.concat(o.primaryUses)) : uniq(o.primaryUses);

    o.accessSupport = Array.isArray(o.accessSupport) && o.accessSupport.length ? o.accessSupport : ['Cable','Fiber'];

    o.priceUsd = num(o.priceUsd);
    o.priceBucket = o.priceBucket || priceToBucket(o.priceUsd);

    o.reviewCount = num(o.reviewCount ?? o.reviews);
    o.reviews = o.reviewCount;
    o.rating = Number.isFinite(Number(o.rating)) ? Number(o.rating) : 0;

    o.img = typeof o.img === 'string' ? o.img : (o.image || '');
    o.url = typeof o.url === 'string' ? o.url : '';

    o.updatedAt = o.updatedAt || '';

    // crude interest score (still used for "relevance")
    o._score =
      (o.wifiStandard === '7' ? 5 : o.wifiStandard === '6E' ? 4 : o.wifiStandard === '6' ? 3 : 1) +
      (o.meshReady ? 1 : 0) +
      (wanRank(o) >= 3 ? 1 : 0) +
      (o.priceUsd > 0 ? 1 : 0);

    return o;
  }

  // ---------- URL sync ----------
  const syncUrl = () => {
    const qs = new URLSearchParams();
    if (state.sort !== 'relevance') qs.set('sort', state.sort);
    if (state.page > 1) qs.set('page', String(state.page));
    if (state.pageSize !== 12) qs.set('ps', String(state.pageSize));
    // Do not persist recos state; default is OFF and only user toggle changes it
    if (state.search) qs.set('q', state.search);
    for (const [k, set] of Object.entries(state.facets)) if (set.size) qs.set(k, [...set].join(','));
    history.replaceState(null, '', qs.toString() ? `?${qs}` : location.pathname);
  };

  // ---------- Facets ----------
  function buildFacetDefs() {
    state.facetDefs = {
      brand: { id:'brand', label:'Brand', el: el.facet_brand,  badge: el.badge_brand,  getValues:o=>[o.brand].filter(Boolean) },
      wifi:  { id:'wifi',  label:'Wi-Fi', el: el.facet_wifiGen, badge: el.badge_wifi,   getValues:o=>[o.wifiStandard].filter(Boolean), order:['7','6E','6','5'] },
      bands: { id:'bands', label:'Bands', el: el.facet_wifiBands, getValues:o=>Array.isArray(o.wifiBands)?o.wifiBands.filter(Boolean):[], order:['2.4','5','6'] },
      mesh:  { id:'mesh',  label:'Mesh', el: el.facet_meshReady, badge: el.badge_mesh,
               getValues:o=>[o.meshReady?'Mesh-ready':'Standalone'],
               map:{ 'Mesh-ready': o=>!!o.meshReady, 'Standalone': o=>!o.meshReady },
               order:['Mesh-ready','Standalone'] },
      wan:   { id:'wan',   label:'WAN Tier', el: el.facet_wanTier, badge: el.badge_wan,
               getValues:o=> (Array.isArray(o.applicableWanTiers)&&o.applicableWanTiers.length?o.applicableWanTiers:[o.wanTierLabel].filter(Boolean)),
               order:['10G','5G','2.5G','≤1G'] },
      lanCount: { id:'lanCount', label:'LAN Ports', el: el.facet_lanCount, getValues:o=>Number.isFinite(o.lanCount)?[String(o.lanCount)]:[] },
      multiGigLan: { id:'multiGigLan', label:'Multi-Gig LAN', el: el.facet_multiGigLan, getValues:o=>[o.multiGigLan?'Yes':'No'], order:['Yes','No'] },
      usb: { id:'usb', label:'USB', el: el.facet_usb, getValues:o=>[o.usb?'Yes':'No'], order:['Yes','No'] },
      coverage: { id:'coverage', label:'Coverage', el: el.facet_coverageBucket, badge: el.badge_cov,
                  getValues:o=> (Array.isArray(o.applicableCoverageBuckets)&&o.applicableCoverageBuckets.length?o.applicableCoverageBuckets:[o.coverageBucket].filter(Boolean)),
                  order:['Apartment/Small','2–3 Bedroom','Large/Multi-floor'] },
      device: { id:'device', label:'Device Load', el: el.facet_deviceLoad, badge: el.badge_dev,
                getValues:o=> (Array.isArray(o.applicableDeviceLoads)&&o.applicableDeviceLoads.length?o.applicableDeviceLoads:[o.deviceLoad].filter(Boolean)),
                order:['1–5','6–15','16–30','31–60','61–100','100+'] },
      use: { id:'use', label:'Primary Use', el: el.facet_primaryUse, badge: el.badge_use,
             getValues:o=> uniq([...(o.primaryUses||[]), ...(o.applicablePrimaryUses||[]), o.primaryUse]).filter(Boolean) },
      access: { id:'access', label:'Access', el: el.facet_access, getValues:o=>Array.isArray(o.accessSupport)?o.accessSupport.filter(Boolean):[], order:['Cable','Fiber','FixedWireless5G','Satellite','DSL'] },
      price: { id:'price', label:'Price', el: el.facet_priceBucket, badge: el.badge_price,
               getValues:o=>[o.priceBucket].filter(Boolean).filter(x=>x!=='N/A'), order:['<150','150–299','300–599','600+'] },
    };

    // init selected sets from URL
    for (const k of Object.keys(state.facetDefs)) {
      const raw = urlQS.get(k);
      state.facets[k] = new Set(raw ? raw.split(',') : []);
    }
  }

  function collectFacetOptions() {
    const pool = {};
    for (const k of Object.keys(state.facetDefs)) pool[k] = new Set();
    for (const o of state.data) {
      for (const [k, def] of Object.entries(state.facetDefs)) {
        def.getValues(o).forEach(v => { const s = String(v||'').trim(); if (s) pool[k].add(s); });
      }
    }
    for (const [k, def] of Object.entries(state.facetDefs)) {
      let arr = [...pool[k]];
      if (def.order) {
        const ordered = def.order.filter(v => pool[k].has(v));
        for (const v of arr) if (!ordered.includes(v)) ordered.push(v);
        arr = ordered;
      } else {
        arr.sort(collator.compare);
      }
      state.facetOptList[k] = arr;
    }
  }

  function renderAllFacets() {
    for (const [key, def] of Object.entries(state.facetDefs)) {
      const container = def.el;
      if (!container) continue;
      container.innerHTML = '';
      const frag = document.createDocumentFragment();

      (state.facetOptList[key] || []).forEach(value => {
        const id = `f_${key}_${value.replace(/\W+/g,'')}`;
        const label = document.createElement('label');
        label.className = 'facet-opt';
        label.dataset.value = value;

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = id;
        input.value = value;
        input.checked = state.facets[key].has(value);

        const span = document.createElement('span');
        span.className = 'label';
        span.textContent = value;

        const count = document.createElement('small');
        count.className = 'opt-count'; // will be filled dynamically

        label.appendChild(input);
        label.appendChild(span);
        label.appendChild(count);

        input.addEventListener('change', () => {
          if (input.checked) state.facets[key].add(value); else state.facets[key].delete(value);
          state.page = 1;
          onStateChanged({ focusAfter: label });
        });

        frag.appendChild(label);
      });

      container.appendChild(frag);

      // details open/close persistence
      const details = document.querySelector(`details.facet[data-facet="${key}"]`);
      if (details && typeof state.openDetails[key] === 'boolean') details.open = state.openDetails[key];
      details?.addEventListener('toggle', () => {
        state.openDetails[key] = details.open;
        LS.set('rh.details', state.openDetails);
      });

      // update badges (initial)
      if (def.badge) {
        const n = state.facets[key].size;
        def.badge.textContent = String(n);
        def.badge.style.visibility = n ? 'visible' : 'hidden';
      }
    }
  }

  // ---------- Filtering ----------
  function passesSearch(o, term) {
    if (!term) return true;
    // Expand search surface w/ friendly tokens
    const hayRaw = [
      o.brand, o.model,
      `wifi ${o.wifiStandard}`, `wifi-${o.wifiStandard}`, `wifi${o.wifiStandard}`,
      o.wifiStandard,
      o.wanTierLabel,
      o.meshReady ? 'mesh mesh-ready' : 'standalone router',
      ...(o.primaryUses || []),
      ...(o.applicablePrimaryUses || []),
      ...(o.useTags || []),
    ].join(' ').toLowerCase();

    const hayComp = nopunct(hayRaw);
    const tokens = term.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const tComp = nopunct(t);
      if (!(hayRaw.includes(t) || hayComp.includes(tComp))) return false;
    }
    return true;
  }

  function passesFacetForKey(o, key, def, sel) {
    if (!sel || sel.size === 0) return true;
    if (def.map) {
      // boolean-mapped facet (e.g., mesh)
      for (const v of sel) { if (def.map[v]?.(o)) return true; }
      return false;
    }
    // Raw values from getValues (inclusive-ready)
    const vals = new Set(def.getValues(o).map(String));
    for (const v of sel) if (vals.has(v)) return true;
    return false;
  }

  function applyFilters() {
    const term = state.search;
    const out = state.data.filter(o => {
      if (!passesSearch(o, term)) return false;
      for (const [key, def] of Object.entries(state.facetDefs)) {
        if (!passesFacetForKey(o, key, def, state.facets[key])) return false;
      }
      return true;
    });

    state.filtered = out;
    return out;
  }

  // ---------- Live facet counts (disable impossible options) ----------
  function computeFacetCounts() {
    const counts = {}; // key -> Map(value -> n)

    // Helper: filter by everything except a given facet key
    const baseByFacet = {};
    for (const [excludeKey] of Object.entries(state.facetDefs)) {
      baseByFacet[excludeKey] = state.data.filter(o => {
        if (!passesSearch(o, state.search)) return false;
        for (const [key, def] of Object.entries(state.facetDefs)) {
          if (key === excludeKey) continue;
          if (!passesFacetForKey(o, key, def, state.facets[key])) return false;
        }
        return true;
      });
    }

    for (const [key, def] of Object.entries(state.facetDefs)) {
      const base = baseByFacet[key];
      const map = new Map();
      if (def.map) {
        // evaluate only declared option keys
        for (const v of state.facetOptList[key] || []) {
          const n = base.reduce((acc, o) => acc + (def.map[v]?.(o) ? 1 : 0), 0);
          map.set(v, n);
        }
      } else {
        // increment by actual values returned by getValues(o)
        for (const o of base) {
          def.getValues(o).forEach(v => {
            const raw = String(v || '').trim();
            if (!raw) return;
            map.set(raw, (map.get(raw) || 0) + 1);
          });
        }
        // ensure all known options exist with at least 0
        (state.facetOptList[key] || []).forEach(v => { if (!map.has(v)) map.set(v, 0); });
      }
      counts[key] = map;
    }
    return counts;
  }

  function renderFacetCounts(counts) {
    for (const [key, def] of Object.entries(state.facetDefs)) {
      const map = counts[key] || new Map();
      const selected = state.facets[key];

      // update badges
      if (def.badge) {
        const n = selected.size;
        def.badge.textContent = String(n);
        def.badge.style.visibility = n ? 'visible' : 'hidden';
      }

      // update each option count + disabled state
      $$(`details.facet[data-facet="${key}"] .facet-opt`).forEach(row => {
        const value = row.dataset.value;
        const n = map.get(value) || 0;
        const small = row.querySelector('.opt-count');
        if (small) small.textContent = ` (${n})`;

        const input = row.querySelector('input[type="checkbox"]');
        const impossible = n === 0 && !selected.has(value);
        input.disabled = impossible;
        row.classList.toggle('disabled', impossible);
        input.setAttribute('aria-disabled', impossible ? 'true' : 'false');
      });
    }
  }

  // ---------- Sorting ----------
  const cmpPriceAsc = (a,b) => (a.priceUsd || Infinity) - (b.priceUsd || Infinity);
  const rankWifi = (o) => (o.wifiStandard==='7'?4:o.wifiStandard==='6E'?3:o.wifiStandard==='6'?2:1);

  const comparators = {
    relevance:    (a,b) => (b._score - a._score) || cmpPriceAsc(a,b),
    'wifi-desc':  (a,b) => (rankWifi(b) - rankWifi(a)) || cmpPriceAsc(a,b),
    'price-asc':  (a,b) => cmpPriceAsc(a,b),
    'price-desc': (a,b) => (b.priceUsd - a.priceUsd),
    'coverage-desc': (a,b) => (b.coverageSqft - a.coverageSqft) || cmpPriceAsc(a,b),
    'wan-desc':   (a,b) => (wanRank(b) - wanRank(a)) || cmpPriceAsc(a,b),
    'reviews-desc': (a,b) => (b.reviews - a.reviews) || cmpPriceAsc(a,b),
    'rating-desc':  (a,b) => (b.rating - a.rating) || (b.reviews - a.reviews) || cmpPriceAsc(a,b),
  };

  function sortResults() {
    (comparators[state.sort] || comparators.relevance) && state.filtered.sort(comparators[state.sort] || comparators.relevance);
  }

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
      b.type = 'button';
      b.className = cls;
      b.textContent = label;
      b.dataset.page = String(page);
      b.disabled = page === state.page;
      if (cls === 'page' && page === state.page) b.setAttribute('aria-current', 'page');
      b.addEventListener('click', () => { state.page = page; onStateChanged({ scrollToTop: true }); });
      b.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') b.click(); });
      return b;
    };

    const prev = makeBtn('Prev', clamp(state.page - 1, 1, pageCount), 'page prev');
    prev.disabled = state.page === 1;
    container.appendChild(prev);

    const pages = numberedPages(state.page, pageCount);
    for (const p of pages) {
      if (p === '…') {
        const span = document.createElement('span');
        span.className = 'page disabled';
        span.textContent = '…';
        container.appendChild(span);
      } else {
        container.appendChild(makeBtn(String(p), p));
      }
    }

    const next = makeBtn('Next', clamp(state.page + 1, 1, pageCount), 'page next');
    next.disabled = state.page === pageCount;
    container.appendChild(next);
  }

  function numberedPages(current, total) {
    const arr = [];
    const win = 2;
    const start = Math.max(1, current - win);
    const end = Math.min(total, current + win);
    if (start > 1) { arr.push(1); if (start > 2) arr.push('…'); }
    for (let i=start;i<=end;i++) arr.push(i);
    if (end < total) { if (end < total - 1) arr.push('…'); arr.push(total); }
    return arr;
  }

  // ---------- Chips (active filters) ----------
  function renderActiveChips() {
    el.activeChips.innerHTML = '';
    let any = false;
    for (const [key, def] of Object.entries(state.facetDefs)) {
      const sel = state.facets[key];
      if (!sel || sel.size === 0) continue;
      any = true;
      for (const v of sel) {
        const chipBtn = document.createElement('button');
        chipBtn.type = 'button';
        chipBtn.className = 'chip';
        chipBtn.setAttribute('role','listitem');
        chipBtn.setAttribute('aria-label', `Remove ${def.label}: ${v}`);
        chipBtn.textContent = `${def.label}: ${v} ✕`;
        chipBtn.addEventListener('click', () => {
          sel.delete(v);
          state.page = 1;
          onStateChanged({ focusAfter: el.activeChips });
        });
        el.activeChips.appendChild(chipBtn);
      }
    }
    el.activeChips.style.display = any ? '' : 'none';

    // mobile FAB badge
    const activeCount = Object.values(state.facets).reduce((n, s) => n + (s?.size || 0), 0);
    if (el.activeCountBadge) el.activeCountBadge.textContent = String(activeCount);
  }

  // Esc quick-remove: if search focused, clear it; else remove last active filter
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const input = byId('searchInput');
    if (document.activeElement === input && state.search) {
      input.value = '';
      state.search = '';
      state.page = 1;
      onStateChanged({});
      return;
    }
    const keys = Object.keys(state.facetDefs);
    for (let i = keys.length - 1; i >= 0; i--) {
      const sel = state.facets[keys[i]];
      if (sel && sel.size) {
        const first = sel.values().next().value;
        sel.delete(first);
        state.page = 1;
        onStateChanged({});
        break;
      }
    }
  });

  // ---------- Compare ----------
  const MAX_COMPARE = 4;

  function toggleCompare(id) {
    if (state.compare.has(id)) state.compare.delete(id);
    else {
      if (state.compare.size >= MAX_COMPARE) { alert(`You can compare up to ${MAX_COMPARE}.`); return; }
      state.compare.add(id);
    }
    LS.set('rh.compare', [...state.compare]);
    updateCompareUI();
  }
  function clearCompareAll() { state.compare.clear(); LS.set('rh.compare', []); updateCompareUI(); }

  function compareBadge(it) {
    const span = document.createElement('span');
    span.className = 'item';
    span.title = it.model;
    span.textContent = it.model;
    span.addEventListener('click', () => toggleCompare(it.id));
    return span;
  }

  function updateCompareUI() {
    const items = [...state.compare].map(id => state.data.find(x => x.id === id)).filter(Boolean);

    el.compareItemsPanel.innerHTML = '';
    items.forEach(it => el.compareItemsPanel.appendChild(compareBadge(it)));

    el.compareItems.innerHTML = '';
    items.forEach(it => el.compareItems.appendChild(compareBadge(it)));

    el.compareCount.textContent = String(items.length);
    el.compareSticky.hidden = items.length === 0;

    el.clearCompare?.addEventListener('click', clearCompareAll, { once:true });
    el.clearCompareMobile?.addEventListener('click', clearCompareAll, { once:true });

    $$('.compare-btn').forEach(btn => {
      const id = btn.closest('.product')?.dataset?.id;
      btn.setAttribute('aria-pressed', state.compare.has(id) ? 'true' : 'false');
    });

    if (items.length === 0) el.compareDrawer.hidden = true;
  }
  el.compareSticky?.addEventListener('click', () => { el.compareDrawer.hidden = !el.compareDrawer.hidden; });

  // ---------- Recommendations ----------
  function quizMatch(o, q) {
    const covOK  = !q.coverage || (o.applicableCoverageBuckets || [o.coverageBucket]).includes(q.coverage);
    const devOK  = !q.devices  || (o.applicableDeviceLoads    || [o.deviceLoad]).includes(q.devices);
    const useOK  = !q.use      || uniq([...(o.primaryUses||[]), ...(o.applicablePrimaryUses||[]), o.primaryUse]).includes(q.use);
    const accessOK = !q.access || (Array.isArray(o.accessSupport) && o.accessSupport.includes(q.access));
    const meshChoice = q.mesh; // 'yes'|'no'|''
    const meshOK = !meshChoice || (meshChoice==='yes' ? !!o.meshReady : !o.meshReady);

    // WAN: allow >= selected tier
    let wanOK = true;
    if (q.wanTierLabel) {
      const want = wanNumericFromLabel(q.wanTierLabel);
      const provided = Math.max(...(o.applicableWanTiers||[o.wanTierLabel]).map(wanNumericFromLabel));
      wanOK = provided >= want;
    }

    // Price: allow <= selected bucket if provided
    let priceOK = true;
    if (q.price) priceOK = priceRank(o.priceBucket) <= priceRank(q.price);

    return covOK && devOK && useOK && accessOK && meshOK && wanOK && priceOK;
  }

  function computeRecommendations() {
    const base = state.data.slice();
    if (!state.quiz) {
      return base.sort((a,b) =>
        (rankWifi(b)-rankWifi(a)) || (wanRank(b)-wanRank(a)) || (b.rating-a.rating) || (b._score-a._score)
      ).slice(0, 8);
    }
    const q = state.quiz;
    return base
      .filter(o => quizMatch(o, q))
      .sort((a,b) =>
        (rankWifi(b)-rankWifi(a)) ||
        (wanRank(b)-wanRank(a)) ||
        (priceRank(a.priceBucket)-priceRank(b.priceBucket)) || // prefer better value when tied
        (b.rating - a.rating) ||
        (b._score - a._score)
      )
      .slice(0, 8);
  }

  function renderRecommendations() {
    if (!state.showRecos) { el.recommendations.style.display = 'none'; return; }
    const rec = computeRecommendations();
    el.recommendations.style.display = rec.length ? '' : 'none';
    el.recoGrid.innerHTML = '';
    el.recoNote.textContent = state.quiz ? 'Based on your quiz answers' : 'Top picks right now';
    for (const o of rec) el.recoGrid.appendChild(renderCard(o));
  }

  // ---------- Render cards ----------
  function renderSkeletons(n = state.pageSize) {
    el.skeletonGrid.innerHTML = '';
    el.skeletonGrid.style.display = '';
    for (let i=0;i<n;i++) el.skeletonGrid.appendChild(el.skeletonTpl.content.cloneNode(true));
  }
  function hideSkeletons(){ el.skeletonGrid.style.display = 'none'; }

  function wanChip(o) {
    const l = o.wanTierLabel || wanLabelFromMbps(o.maxWanSpeedMbps);
    if (!l) return '';
    return l === '≤1G' ? 'Up to 1G WAN' : `${l} WAN`;
  }

  function buildBullets(o) {
    const out = [];
    if (o.coverageBucket) out.push(`Home size: ${o.coverageBucket}`);
    if (o.deviceLoad) out.push(`Devices: ${o.deviceLoad}`);
    const l = o.wanTierLabel || wanLabelFromMbps(o.maxWanSpeedMbps);
    if (l) out.push(`Internet: ${l === '≤1G' ? 'up to 1 Gbps' : l + 'bps'}`);
    if (o.primaryUse) out.push(`Best for: ${o.primaryUse}`);
    if (out.length < 3 && Array.isArray(o.wifiBands) && o.wifiBands.length) out.push(`${o.wifiBands.join(' / ')} GHz`);
    if (out.length < 3 && o.multiGigLan) out.push('Multi-Gig LAN');
    if (out.length < 3 && Number.isFinite(o.lanCount)) out.push(`${o.lanCount} LAN ports`);
    return out.slice(0,4);
  }

  function renderCard(o) {
    const node = el.cardTpl.content.cloneNode(true);
    const art = node.querySelector('article');
    art.dataset.id = o.id;

    const img = node.querySelector('img');
    if (o.img) { img.src = o.img; img.alt = o.model || 'Router image'; }
    else { img.remove(); }

    const titleEl = node.querySelector('.title');
    titleEl.textContent = ''; // clear any template text

    const brandEl = document.createElement('em');
    brandEl.className = 'brand';
    brandEl.textContent = o.brand || '';

    const modelEl = document.createElement('span');
    modelEl.className = 'model';
    modelEl.textContent = o.model || '';

    if (brandEl.textContent) titleEl.appendChild(brandEl);
    titleEl.appendChild(modelEl);


    const chips = node.querySelector('.chips.line');
    const chipTexts = Array.isArray(o.chipsOverride) && o.chipsOverride.length
      ? o.chipsOverride.slice(0, 3)
      : [ `Wi-Fi ${o.wifiStandard}`, o.meshReady ? 'Mesh-ready' : null, wanChip(o) || null ].filter(Boolean);
    chipTexts.forEach(t => { const s=document.createElement('span'); s.className='chip'; s.textContent=t; chips.appendChild(s); });
    if (chipTexts.length < 3 && o.coverageBucket) { const s=document.createElement('span'); s.className='chip'; s.textContent=o.coverageBucket; chips.appendChild(s); }

    const specs = node.querySelector('.specs');
    const bullets = (Array.isArray(o.fitBullets) && o.fitBullets.length >= 3) ? o.fitBullets.slice(0,4) : buildBullets(o);
    bullets.forEach(t => { const li=document.createElement('li'); li.textContent=t; specs.appendChild(li); });

    node.querySelector('.price').textContent = fmtMoney(o.priceUsd);
    const buy = node.querySelector('.ctaRow a');
    if (o.url) { buy.href=o.url; buy.removeAttribute('aria-disabled'); buy.classList.remove('disabled'); buy.textContent='Buy'; }
    else { buy.href='#'; buy.setAttribute('aria-disabled','true'); buy.classList.add('disabled'); buy.textContent='Details'; }

    const cmpBtn = node.querySelector('.compare-btn');
    cmpBtn.setAttribute('aria-pressed', state.compare.has(o.id) ? 'true' : 'false');
    cmpBtn.addEventListener('click', () => toggleCompare(o.id));

    // Optional: share quick action (if present in template)
    const shareBtn = node.querySelector('.quick-actions .quick-btn[title="Share"]');
    if (shareBtn) {
      shareBtn.addEventListener('click', async () => {
        const url = o.url || location.href;
        const text = `${o.brand} ${o.model}`;
        try {
          if (navigator.share) await navigator.share({ title:text, text, url });
          else {
            await navigator.clipboard.writeText(url);
            shareBtn.classList.add('ok'); setTimeout(()=>shareBtn.classList.remove('ok'), 800);
          }
        } catch {}
      });
    }

    return node;
  }

  function renderResults(items) {
    el.resultsGrid.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const o of items) frag.appendChild(renderCard(o));
    el.resultsGrid.appendChild(frag);
  }

  // ---------- Toolbar / Search ----------
  function wireToolbar() {
    if (el.sortSelect) {
      el.sortSelect.value = state.sort;
      el.sortSelect.addEventListener('change', () => { state.sort = el.sortSelect.value; state.page = 1; onStateChanged({}); });
    }
    if (el.pageSizeSelect) {
      el.pageSizeSelect.value = String(state.pageSize);
      el.pageSizeSelect.addEventListener('change', () => { state.pageSize = Number(el.pageSizeSelect.value); state.page = 1; onStateChanged({}); });
    }
    if (el.toggleRecos) {
      el.toggleRecos.checked = state.showRecos; // starts false
      el.toggleRecos.addEventListener('change', () => {
        // Only user action here may enable/disable recommendations
        state.showRecos = el.toggleRecos.checked;
        syncUrl();
        renderRecommendations();
      });
    }
    el.openFiltersHeader?.addEventListener('click', openDrawer);
    el.filtersFab?.addEventListener('click', () => { openDrawer(); el.filtersFab.setAttribute('aria-expanded','true'); });

    wireSearch();
    wireCommandBarCondense();
  }

  function wireSearch() {
    const input = byId('searchInput');
    const btn   = byId('searchBtn');
    if (!input) return;

    input.value = state.search;

    const apply = () => { state.search = (input.value || '').trim().toLowerCase(); state.page=1; onStateChanged({ scrollToTop:true }); };
    const onType = debounce(apply, 220);

    input.addEventListener('input', onType);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); apply(); }
      if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value=''; apply(); }
    });
    if (btn) btn.addEventListener('click', apply);

    // "/" or Cmd/Ctrl+K to focus
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;
      const modK = (e.key.toLowerCase()==='k' && (e.ctrlKey || e.metaKey));
      if (typing && !modK) return;
      if (modK || e.key === '/') { e.preventDefault(); input.focus(); input.select(); }
    });
  }

  function wireCommandBarCondense() {
    const bar = $('.command-bar');
    if (!bar) return;
    const onScroll = () => { bar.classList.toggle('is-condensed', (window.scrollY||document.documentElement.scrollTop) > 80); };
    addEventListener('scroll', onScroll, { passive:true });
    onScroll();
  }

  // ---------- Drawer (mobile filters) ----------
  function openDrawer() {
    el.drawerFormMount.innerHTML = '';
    const clone = el.filtersForm.cloneNode(true);
    el.drawerFormMount.appendChild(clone);
    el.filtersDrawer.setAttribute('aria-hidden','false');
    document.documentElement.classList.add('scroll-lock');

    $$('[data-close-drawer]').forEach(b => b.addEventListener('click', closeDrawer, { once:true }));
    el.applyDrawer.onclick = () => {
      syncChecks(clone, el.filtersForm);
      closeDrawer();
      onStateChanged({});
    };

    function syncChecks(src, dst) {
      const map = new Map();
      $$('input[type="checkbox"]', src).forEach(i => map.set(i.value + '::' + i.closest('.facet')?.dataset?.facet, i.checked));
      $$('input[type="checkbox"]', dst).forEach(i => {
        const key = i.value + '::' + i.closest('.facet')?.dataset?.facet;
        if (map.has(key)) i.checked = map.get(key);
      });
      rebuildFacetSelectionsFromDOM();
    }
  }
  function closeDrawer() {
    el.filtersDrawer.setAttribute('aria-hidden','true');
    el.filtersFab?.setAttribute('aria-expanded','false');
    document.documentElement.classList.remove('scroll-lock');
  }

  // ---------- Form-wide controls ----------
  function wireFacetsControls() {
    $$('.facet-clear,[class*="facet__clear"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.clear;
        if (!key) return;
        (state.facets[key] || new Set()).clear();
        $$(`details.facet[data-facet="${key}"] input[type="checkbox"]`).forEach(b => { b.checked = false; });
        state.page = 1;
        onStateChanged({ focusAfter: btn });
      });
    });
    el.expandAll?.addEventListener('click', () => {
      $$('details.facet').forEach(d => { d.open = true; state.openDetails[d.dataset.facet]=true; });
      LS.set('rh.details', state.openDetails);
    });
    el.collapseAll?.addEventListener('click', () => {
      $$('details.facet').forEach(d => { d.open = false; state.openDetails[d.dataset.facet]=false; });
      LS.set('rh.details', state.openDetails);
    });
    el.clearAllFacets?.addEventListener('click', () => {
      for (const k of Object.keys(state.facets)) state.facets[k].clear();
      $$('input[type="checkbox"]', el.filtersForm).forEach(i => { i.checked = false; });
      state.page = 1;
      onStateChanged({});
    });
  }

  function rebuildFacetSelectionsFromDOM() {
    for (const [key] of Object.entries(state.facetDefs)) {
      const sel = new Set();
      $$(`details.facet[data-facet="${key}"] input[type="checkbox"]`).forEach(i => { if (i.checked) sel.add(i.value); });
      state.facets[key] = sel;
    }
  }

  // ---------- Status / A11y ----------
  function updateCounts() {
    const total = state.filtered.length;
    const all = state.data.length;
    if (el.matchCount) el.matchCount.textContent = `${total} match${total === 1 ? '' : 'es'} / ${all}`;
    if (el.kitsStatus) el.kitsStatus.textContent = `Showing ${Math.min(total, state.pageSize)} of ${total} matches`;
  }

  // ---------- Quick picks (rebuilds chips in both areas) ----------
  function renderQuickChips() {
    const make = (label, fn) => {
      const c = document.createElement('button');
      c.type = 'button'; c.className = 'chip'; c.textContent = label;
      c.addEventListener('click', () => { fn(); state.page = 1; onStateChanged({}); });
      return c;
    };
    const picks = [
      ['Best for Families', () => { state.facets.use.add('Family Streaming'); state.facets.device.add('16–30'); }],
      ['Budget-Friendly', () => state.facets.price.add('<150')],
      ['Gaming Ready', () => { state.facets.use.add('Gaming'); state.facets.wan.add('2.5G'); }],
      ['Whole-Home Wi-Fi', () => state.facets.mesh.add('Mesh-ready')],
      ['Fast Internet', () => state.facets.wifi.add('7')],
      ['Work from Home', () => state.facets.use.add('Work-From-Home')],
    ];
    const quick = byId('quickChips');
    const empty = byId('emptyQuickChips');
    if (quick) { quick.innerHTML=''; for (const [l,fn] of picks) quick.appendChild(make(l,fn)); }
    if (empty) { empty.innerHTML=''; for (const [l,fn] of picks) empty.appendChild(make(l,fn)); }
  }

  // ---------- Copy link / Reset ----------
  el.copyLink?.addEventListener('click', async () => {
    syncUrl();
    try {
      await navigator.clipboard.writeText(location.href);
      el.copyLink.textContent = 'Copied!';
      setTimeout(() => el.copyLink.textContent = 'Copy link', 1200);
    } catch {}
  });

  el.resetAll?.addEventListener('click', () => {
    for (const k of Object.keys(state.facets)) state.facets[k].clear();
    state.sort = 'relevance';
    state.page = 1;
    state.pageSize = 12;
    // Reset returns to default OFF
    state.showRecos = false;
    state.quiz = null;
    state.search = '';
    state.compare.clear();
    $$('input[type="checkbox"]', el.filtersForm).forEach(i => { i.checked = false; });
    const si = byId('searchInput'); if (si) si.value = '';
    if (el.sortSelect) el.sortSelect.value = state.sort;
    if (el.pageSizeSelect) el.pageSizeSelect.value = String(state.pageSize);
    if (el.toggleRecos) el.toggleRecos.checked = state.showRecos; // false
    LS.set('rh.compare', []);
    onStateChanged({});
  });

  // ---------- Quiz bridge (apply answers to facets + recos) ----------
  window.RH_APPLY_QUIZ = (answers) => {
    state.quiz = answers;

    // Clear conflicting facets, then set guided ones
    if (answers.coverage) { state.facets.coverage.clear(); state.facets.coverage.add(answers.coverage); }
    if (answers.devices)  { state.facets.device.clear();   state.facets.device.add(answers.devices);   }
    if (answers.use)      { state.facets.use.clear();      state.facets.use.add(answers.use);          }
    if (answers.access)   { state.facets.access.clear();   state.facets.access.add(answers.access);     }
    if (answers.price)    { state.facets.price.clear();    state.facets.price.add(answers.price);       }
    if (answers.wanTierLabel) { state.facets.wan.clear();  state.facets.wan.add(answers.wanTierLabel);  }
    if (answers.mesh === 'yes') { state.facets.mesh.clear(); state.facets.mesh.add('Mesh-ready'); }
    if (answers.mesh === 'no')  { state.facets.mesh.clear(); state.facets.mesh.add('Standalone'); }

    // Do NOT auto-enable recos; respect current toggle state.
    if (el.toggleRecos) el.toggleRecos.checked = state.showRecos;
    onStateChanged(state.showRecos ? { scrollToRecos: true } : {});

    // Reveal an "Edit quiz" button in header if present
    byId('editQuiz')?.removeAttribute('hidden');
  };

  // Add an empty-state CTA to open quiz (if not present)
  (function ensureEmptyQuizButton(){
    if (!el.emptyState) return;
    if (el.emptyState.querySelector('[data-open-quiz]')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn primary'; b.setAttribute('data-open-quiz',''); b.textContent = 'Try Our Quiz for Suggestions';
    el.emptyState.appendChild(b);
  })();

  // Enable header "open/edit quiz" bridges even when header is injected
  function wireHeaderQuizBridges() {
    document.addEventListener('click', (e) => {
      const openBtn = e.target.closest('[data-open-quiz]');
      if (openBtn) { const t = byId('openQuiz'); if (t) t.click(); else document.dispatchEvent(new CustomEvent('quiz:open')); }
    });
    document.addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-quiz]');
      if (editBtn) { const t = byId('editQuiz'); if (t && !t.hasAttribute('hidden')) t.click(); }
    });
    const editHeader = byId('editQuiz');
    const editMobile = document.querySelector('[data-edit-quiz]');
    if (editHeader && editMobile) {
      const sync = () => { editMobile.hidden = editHeader.hasAttribute('hidden'); };
      new MutationObserver(sync).observe(editHeader, { attributes:true, attributeFilter:['hidden'] });
      sync();
    }
  }

  // ---------- Lifecycle ----------
  async function init() {
    await Promise.all([mountPartial(el.headerMount), mountPartial(el.footerMount)]);
    wireHeaderQuizBridges();

    renderSkeletons(12);

    try {
      state.data = await fetchData();
      hideSkeletons();
    } catch (e) {
      hideSkeletons();
      el.kitsError.classList.remove('hide');
      el.kitsError.textContent = 'Failed to load kits. Please try again later.';
      return;
    }

    buildFacetDefs();
    collectFacetOptions();
    renderAllFacets();
    wireFacetsControls();
    wireToolbar();
    renderQuickChips();

    // Apply initial URL selections to checkboxes
    for (const [key] of Object.entries(state.facetDefs)) {
      const details = document.querySelector(`details.facet[data-facet="${key}"]`);
      if (!details) continue;
      $$('input[type="checkbox"]', details).forEach(i => { if (state.facets[key]?.has(i.value)) i.checked = true; });
    }

    onStateChanged({ initial:true });

    // autofocus search if q present
    if (state.search) byId('searchInput')?.focus();
  }

  function onStateChanged(opts) {
    // Batch DOM work inside a frame for smoothness
    rafBatch(() => {
      syncUrl();
      renderActiveChips();

      // filter/sort/paginate
      applyFilters();
      sortResults();
      updateCounts();

      // live facet counts & disabled states
      renderFacetCounts(computeFacetCounts());

      // results + recos
      const pageItems = paginate();
      renderResults(pageItems);
      renderRecommendations();
      updateCompareUI();

      el.emptyState.classList.toggle('hide', state.filtered.length > 0);

      if (opts?.focusAfter?.focus) requestAnimationFrame(() => opts.focusAfter.focus());
      if (opts?.scrollToTop) window.scrollTo({ top:0, behavior:'smooth' });
      if (opts?.scrollToRecos && state.showRecos) el.recommendations?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
