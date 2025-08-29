/* ==========================================================
   RouterHaus — Post.js (2025, cleaned)
   Progress bar • ToC scroll-spy • Copy • Share • Reveal
   ========================================================== */
(() => {
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------- Utilities ---------- */
  const throttle = (fn, wait = 80) => {
    let t = 0, id;
    return (...args) => {
      const now = Date.now();
      if (now - t >= wait) { t = now; fn(...args); }
      else { clearTimeout(id); id = setTimeout(() => { t = Date.now(); fn(...args); }, wait - (now - t)); }
    };
  };

  /* ---------- Reading progress (auto-inject) ---------- */
  function mountProgress(){
    let bar = $('.reading-progress');
    if (!bar){
      bar = document.createElement('div');
      bar.className = 'reading-progress';
      document.body.appendChild(bar);
    }
    const update = () => {
      const doc = document.documentElement;
      const max = (doc.scrollHeight - doc.clientHeight) || 1;
      const pct = Math.min(1, Math.max(0, (doc.scrollTop || document.body.scrollTop) / max));
      bar.style.width = (pct * 100).toFixed(2) + '%';
    };
    update();
    addEventListener('scroll', throttle(update, 40), { passive: true });
  }

  /* ---------- Copy buttons for <pre><code> ---------- */
  function enhanceCopy(){
    $('.post-body') && $$('.post-body pre').forEach(pre => {
      if (pre.querySelector('.copy-btn')) return;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'copy-btn';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        const code = pre.querySelector('code')?.innerText ?? '';
        try {
          await navigator.clipboard.writeText(code);
          btn.textContent = 'Copied'; btn.classList.add('success');
          setTimeout(()=>{ btn.textContent = 'Copy'; btn.classList.remove('success'); }, 1200);
        } catch {
          btn.textContent = 'Press ⌘/Ctrl+C';
          setTimeout(()=>{ btn.textContent = 'Copy'; }, 1200);
        }
      });
      pre.appendChild(btn);
    });
  }

  /* ---------- Share (Web Share + fallbacks) ---------- */
  function mountShare(){
    const box = $('.post-share'); if (!box) return;
    const url = location.href, encUrl = encodeURIComponent(url);
    const title = document.title, encTitle = encodeURIComponent(title);
    box.innerHTML = `
      <span>Share:</span>
      <button type="button" class="btn-like share-btn">Share</button>
      <button type="button" class="btn-like copy-link">Copy link</button>
      <a class="btn-like" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}">Twitter/X</a>
      <a class="btn-like" target="_blank" rel="noopener" href="https://www.linkedin.com/shareArticle?mini=true&url=${encUrl}&title=${encTitle}">LinkedIn</a>
      <a class="btn-like" target="_blank" rel="noopener" href="mailto:?subject=${encTitle}&body=${encUrl}">Email</a>
    `;
    $('.share-btn', box)?.addEventListener('click', async () => {
      const data = { title, text: $('meta[name="description"]')?.content || '', url };
      if (navigator.share){ try { await navigator.share(data); } catch {} }
      else { try { await navigator.clipboard.writeText(url); } catch {} }
    });
    $('.copy-link', box)?.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(url); } catch {}
    });
  }

  /* ---------- ToC scroll-spy ---------- */
  function wireTOC(){
    const links = $$('.toc a[href^="#"]'); if (!links.length) return;
    const heads = $$('article.post-body h2[id], article.post-body h3[id]');
    if (!heads.length) return;

    const NAV = $('.navbar');
    const navH = () => (NAV?.offsetHeight ?? 72);

    const setActive = (id) => {
      links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === id));
    };

    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive('#' + visible.target.id);
    }, { rootMargin: `-${navH()+24}px 0px -60% 0px`, threshold: [0.1, 0.25, 0.6] });

    heads.forEach(h => io.observe(h));
  }

  /* ---------- Reveal on scroll ---------- */
  function wireReveal(){
    const items = $$('.post-body > *'); if (!items.length) return;
    const io = new IntersectionObserver((entries,o)=>{
      entries.forEach(e => { if (e.isIntersecting){ e.target.classList.add('in-view'); o.unobserve(e.target); }});
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    items.forEach(el => { el.classList.add('reveal'); io.observe(el); });
  }

  /* ---------- Newsletter (simple stub) ---------- */
  function wireNewsletter(){
    const form = $('#newsletterForm'); if (!form) return;
    const input = $('#nlEmail'); const msg = $('#nlMsg');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = (input.value || '').trim();
      if (!val){ msg.textContent = 'Please enter an email.'; return; }
      msg.textContent = 'Subscribed! 🎉';
      form.reset();
    });
  }

  /* ---------- Boot ---------- */
  function init(){
    mountProgress();
    enhanceCopy();
    mountShare();
    wireTOC();
    wireReveal();
    wireNewsletter();
  }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
