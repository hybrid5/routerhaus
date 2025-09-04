// assets/js/about.js
/* RouterHaus — About page interactions
 * - IntersectionObserver reveal
 * - Simple accordion toggle with keyboard support
 */
(() => {
  const $  = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

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

  document.addEventListener('DOMContentLoaded', () => {
    window.RH?.reveal();
    wireAccordion();
  });
})();
