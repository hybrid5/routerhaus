/* assets/js/consult.js
 * RouterHaus — Consult page interactions
 * - Header/footer partials
 * - Case scroller controls
 * - IntersectionObserver reveals
 * - Intake single-page form with validation
 * - Summary download + nicely formatted mailto handoff (auto-open, cc user, URI-length safe)
 */
(() => {
  // Tiny helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byId = (id) => document.getElementById(id);

  // ----- Mount partials -----
  async function mountPartial(target) {
    const path = target?.dataset?.partial;
    if (!path) return;
    try {
      const res = await fetch(path, { cache: 'no-store' });
      if (res.ok) target.innerHTML = await res.text();
    } catch { /* ignore */ }
  }

  // ----- Intersection reveals -----
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

  function revealify() { $$('.reveal').forEach((el) => io.observe(el)); }

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

    // ---- Build a nicely formatted plain-text email body (works across clients) ----
    function buildEmailBody(data) {
      // Helper: bulletize comma/semicolon-delimited text
      const bulletize = (s) => {
        const v = String(s || '').trim();
        if (!v) return '(none)';
        // split on comma/semicolon/newline
        const parts = v.split(/[,;\n]+/).map(t => t.trim()).filter(Boolean);
        return parts.length ? parts.map(p => `• ${p}`).join('\n') : v;
      };

      const now = new Date();
      const ts = now.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });

      return (
`RouterHaus — Consult Intake
================================

CONTACT
• Name:   ${data.name || '-'}
• Email:  ${data.email || '-'}
• Phone:  ${data.phone || '-'}

PROJECT
• Property: ${data.propertyType || '-'}
• Goals:    ${data.primaryGoal || '-'}

SCOPE
• Size/Floors: ${data.sqft || '-'} sq ft · ${data.floors || '-'} floors
• Backhaul:    ${data.backhaul || '-'}

CONNECTIVITY
• Internet plan: ${data.wanTier || '-'}
• Devices:       ${data.deviceLoad || '-'}

SPECIAL CONSIDERATIONS
${bulletize(data.special)}

TIMING & BUDGET
• Timeline: ${data.timeline || '-'}
• Budget:   ${data.budget || '-'}

NOTES
${(String(data.notes || '').trim() || '(none)')}

—
Submitted: ${ts}
Source: https://www.routerhaus.com/consult.html
`
      );
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateAll()) return;

      const data = Object.fromEntries(new FormData(form).entries());

      // Persist locally
      try { localStorage.setItem('rh.consult.intake', JSON.stringify({ ...data, ts: new Date().toISOString() })); } catch {}

      // Build formatted plain-text summary (email-friendly)
      const summary = buildEmailBody(data);

      // Download brief (JSON)
      try {
        const blob = new Blob([JSON.stringify({ ...data, summary }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        if (downloadBrief) {
          downloadBrief.href = url;
          downloadBrief.download = `routerhaus-consult-${(data.name || 'intake').toLowerCase().replace(/\W+/g,'-')}.json`;
        }
        addEventListener('pagehide', () => URL.revokeObjectURL(url), { once: true });
      } catch { /* ignore */ }

      // Mailto handoff (opens user's default mail app; message sends from their account)
      const to = 'admin@routerhaus.com';
      const subject = encodeURIComponent(`Consult request — ${data.name || ''}`);
      const MAX_URI = 1800; // conservative for common clients

      // Build full body and cc first, then trim if needed
      const ccParam = data.email ? `&cc=${encodeURIComponent(data.email)}` : '';
      const encodedBody = encodeURIComponent(summary);

      let mailto = `mailto:${to}?subject=${subject}&body=${encodedBody}${ccParam}`;
      if (mailto.length > MAX_URI) {
        const shortBody =
`RouterHaus — Consult Intake (short)
================================
Name: ${data.name || '-'}
Email: ${data.email || '-'}
Property: ${data.propertyType || '-'}
Goals: ${data.primaryGoal || '-'}
Size/Floors: ${data.sqft || '-'} · ${data.floors || '-'}
Timeline/Budget: ${data.timeline || '-'} · ${data.budget || '-'}
(Full intake downloaded as JSON and saved locally.)
`;
        mailto = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(shortBody)}${ccParam}`;
      }

      if (mailtoLink) mailtoLink.href = mailto;

      // Try to launch the mail client immediately (still inside user gesture)
      let opened = false;
      try {
        window.location.assign(mailto);
        opened = true;
      } catch { opened = false; }

      // Fallback: copy the summary so user can paste if no mail client is configured
      if (!opened && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(summary);
          msg.textContent = 'Could not open your mail app. Summary copied — paste into an email to admin@routerhaus.com.';
        } catch {
          msg.textContent = 'Could not open your mail app. Please use the “Download summary” link and email it to admin@routerhaus.com.';
        }
      }

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
    const utm = ['utm_source','utm_medium','utm_campaign','utm_term','utm_content']
      .reduce((o,k)=> (p.get(k) ? (o[k]=p.get(k), o) : o), {});
    if (Object.keys(utm).length) {
      try { localStorage.setItem('rh.utm', JSON.stringify({ ...utm, ts: Date.now() })); } catch {}
    }
  }

  // ----- Init -----
  document.addEventListener('DOMContentLoaded', async () => {
    await Promise.all([
      mountPartial(byId('header-placeholder')),
      mountPartial(byId('footer-placeholder')),
    ]);
    revealify();
    wireCases();
    wireIntake();
    storeUTMs();
  });
})();
