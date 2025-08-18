// assets/js/about.js
/* RouterHaus — About page interactions
 * - Mount header/footer partials (matches other pages)
 * - IntersectionObserver reveal
 * - Simple accordion toggle with keyboard support
 */
(() => {
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);

  // ---- Mount header/footer partials (idempotent) ----
  async function mountPartial(target){
    const path = target?.dataset?.partial;
    if(!path || (target?.children?.length ?? 0) > 0) return;
    try{
      const res = await fetch(path, { cache: 'no-store' });
      if(res.ok){
        const html = await res.text();
        if ((target?.children?.length ?? 0) === 0) target.innerHTML = html;
      }
    }catch{}
  }

  // ---- Reveal on scroll ----
  function revealify(){
    const nodes = $$('.reveal');
    if(!nodes.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
    nodes.forEach(n => io.observe(n));
  }

  // ---- Accordion (single-open; keyboard-friendly) ----
  function wireAccordion(){
    $$('.accordion-item').forEach(item => {
      item.setAttribute('tabindex', '0');
      item.addEventListener('click', () => {
        // prevent selecting text from toggling unexpectedly
        if (getSelection()?.toString()) return;
        $$('.accordion-item.open', item.parentElement).forEach(i => { if(i!==item) i.classList.remove('open'); });
        item.classList.toggle('open');
      });
      item.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); item.click(); }
        if(e.key === 'ArrowDown'){ e.preventDefault(); item.nextElementSibling?.focus(); }
        if(e.key === 'ArrowUp'){ e.preventDefault(); item.previousElementSibling?.focus(); }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await Promise.all([
      mountPartial(byId('header-placeholder')),
      mountPartial(byId('footer-placeholder')),
    ]);
    revealify();
    wireAccordion();
  });
})();
