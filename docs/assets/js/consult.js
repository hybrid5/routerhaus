/* assets/js/consult.js
 * RouterHaus — Consult page interactions
 * - Case scroller controls
 * - IntersectionObserver reveals
 * - Intake multi-step form with validation
 * - Summary download + mailto handoff
 */
(() => {
  // Tiny helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);

  // ----- Case scroller -----
  function wireCases() {
    const scroller = byId('caseScroller');
    if (!scroller) return;
    byId('casePrev')?.addEventListener('click', () => scroller.scrollBy({ left: -360, behavior: 'smooth' }));
    byId('caseNext')?.addEventListener('click', () => scroller.scrollBy({ left:  360, behavior: 'smooth' }));
  }

// ----- Intake form (single-page, validate all) -----
function wireIntake() {
  const form = byId('intakeForm');
  if (!form) return;

  const steps = $$('.step', form);
  const msg = byId('formMsg');
  const after = byId('afterIntake');
  const downloadBrief = byId('downloadBrief');
  const mailtoLink = byId('mailtoLink');

  // Show all steps (remove wizard)
  steps.forEach(s => s.hidden = false);

  // Hide progress & nav; force submit button visible
  form.querySelector('.progress')?.style && (form.querySelector('.progress').style.display = 'none');
  byId('prevStep')?.remove();
  byId('nextStep')?.remove();
  const submitBtn = byId('submitIntake');
  if (submitBtn) { submitBtn.hidden = false; submitBtn.type = 'submit'; }

  // Validate entire form
  const validateAll = () => {
    msg.textContent = '';
    // clear previous errors
    $$('[data-error="1"]', form).forEach(n => n.removeAttribute('data-error'));

    const required = $$('input[required],select[required],textarea[required]', form);
    let firstBad = null;

    for (const el of required) {
      const val = String(el.value || '').trim();
      const invalid = !val || (el.type === 'email' && !/^\S+@\S+\.\S+$/.test(val));
      if (invalid) {
        el.setAttribute('data-error', '1');
        if (!firstBad) firstBad = el;
      }
    }

    if (firstBad) {
      msg.textContent = 'Please complete the required fields.';
      try { firstBad.focus({ preventScroll: true }); } catch { firstBad.focus(); }
      firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!validateAll()) return;

    const data = Object.fromEntries(new FormData(form).entries());

    // Persist locally
    try { localStorage.setItem('rh.consult.intake', JSON.stringify({ ...data, ts: new Date().toISOString() })); } catch {}

    // Build human summary
    const summary =
`RouterHaus Consult Intake
———————————————
Property: ${data.propertyType || '-'}
Goal: ${data.primaryGoal || '-'}
Size/Floors: ${data.sqft || '-'} sq ft · ${data.floors || '-'} floors
Backhaul: ${data.backhaul || '-'}
Internet/Devices: ${data.wanTier || '-'} · ${data.deviceLoad || '-'}
Special: ${data.special || '-'}
Timeline/Budget: ${data.timeline || '-'} · ${data.budget || '-'}
Contact: ${data.name || '-'} · ${data.email || '-'} · ${data.phone || '-'}
Notes:
${(data.notes || '').trim() || '(none)'}
`;

    // Download brief (JSON)
    const blob = new Blob([JSON.stringify({ ...data, summary }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadBrief.href = url;
    downloadBrief.download = `routerhaus-consult-${(data.name || 'intake').toLowerCase().replace(/\W+/g,'-')}.json`;

    // Mailto handoff
    const to = 'admin@routerhaus.com';
    const subject = encodeURIComponent('Consult request');
    const body = encodeURIComponent(summary);
    mailtoLink.href = `mailto:${to}?subject=${subject}&body=${body}`;

    form.hidden = true;
    after.hidden = false;
    after.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Open from hero/footer buttons
  $$('.js-open-intake').forEach((b) =>
    b.addEventListener('click', () => {
      form.hidden = false;
      after.hidden = true;
      document.querySelector('.intake')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    })
  );
}

  // Capture UTM tags (if present) to localStorage for later CRM imports
  function storeUTMs() {
    const p = new URLSearchParams(location.search);
    const utm = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].reduce((o,k)=> (p.get(k)? (o[k]=p.get(k),o):o), {});
    if (Object.keys(utm).length) {
      try { localStorage.setItem('rh.utm', JSON.stringify({ ...utm, ts: Date.now() })); } catch {}
    }
  }

  // ----- Init -----
  document.addEventListener('DOMContentLoaded', () => {
    window.RH?.reveal();
    wireCases();
    wireIntake();
    storeUTMs();
  });
})();
