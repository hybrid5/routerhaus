// assets/js/about.js
/* RouterHaus — About page interactions
 * - Mount header/footer partials (matches other pages)
 * - IntersectionObserver reveal
 * - Simple accordion toggle
 */
(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);

  // ---- Mount header/footer partials ----
  async function mountPartial(target){
    const path = target?.dataset?.partial;
    if(!path) return;
    try{
      const res = await fetch(path, { cache: 'no-store' });
      if(res.ok) target.innerHTML = await res.text();
    }catch{}
  }

  // ---- Reveal on scroll ----
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add('in-view'); io.unobserve(e.target); }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -10% 0px' });
  function revealify(){ $$('.reveal').forEach(n => io.observe(n)); }

  // ---- Accordion ----
  function wireAccordion(){
    $$('.accordion-item').forEach(item => {
      item.addEventListener('click', () => {
        // single-open behavior
        $$('.accordion-item.open', item.parentElement).forEach(i => { if(i!==item) i.classList.remove('open'); });
        item.classList.toggle('open');
      });
      // keyboard a11y
      item.setAttribute('tabindex', '0');
      item.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); item.click(); }
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
