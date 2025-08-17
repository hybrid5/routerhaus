/* assets/js/quiz-modal.js
 * Refined Quiz Modal
 * - Persistent answers (LS), robust open/edit wiring, focus trap
 * - Helpful mesh hinting, progress counter, required-field nudges
 * - Smarter output sent to window.RH_APPLY_QUIZ: includes coverage, devices, use, access, price, wan, mesh
 * - No extra emojis; consistent with your UI
 */
(() => {
  const dlg = document.getElementById('quizModal');
  if (!dlg) return;

  const all = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const firstFocusable = (root) =>
    all('a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', root)
      .filter(el => el.offsetParent !== null)[0] || root;

  const LS_KEY = 'rh.quiz.answers';

  const form        = document.getElementById('quizForm');
  const selCoverage = document.getElementById('qCoverage');
  const selDevices  = document.getElementById('qDevices');
  const selUse      = document.getElementById('qUse');
  const selAccess   = document.getElementById('qAccess');
  const priceSel    = document.getElementById('qPrice');
  const meshAuto    = document.getElementById('qMeshAuto');
  const meshHint    = document.getElementById('meshHint');
  const cancelBtn   = document.getElementById('quizCancel');
  const stepEl      = document.getElementById('quizStep');

  let lastOpener = null;
  let trapHandler = null;

  // ---------- Open / Close ----------
  function openModal(from = document.activeElement) {
    lastOpener = from || null;
    prefillForm();
    try { if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open',''); } catch { dlg.setAttribute('open',''); }
    dlg.classList.add('is-open');
    queueMicrotask(() => firstFocusable(dlg)?.focus());
    attachTrap();
    updateMeshHint();
    updateProgress();
  }
  function closeModal() {
    detachTrap();
    dlg.classList.remove('is-open');
    setTimeout(() => { try { if (dlg.open) dlg.close(); else dlg.removeAttribute('open'); } catch {} restoreFocus(); }, 0);
  }
  function restoreFocus(){ try { lastOpener?.focus?.(); } catch {} }

  // Backdrop click (outside dialog rect)
  dlg.addEventListener('click', (e) => {
    const r = dlg.getBoundingClientRect();
    const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!inside) closeModal();
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeModal(); });

  // Delegated open/edit (works with header injection)
  document.addEventListener('click', (e) => {
    const openProxy = e.target.closest('#openQuiz,[data-open-quiz]');
    if (openProxy) { e.preventDefault(); openModal(openProxy); return; }
    const editProxy = e.target.closest('#editQuiz,[data-edit-quiz]');
    if (editProxy && !editProxy.hasAttribute('hidden')) { e.preventDefault(); openModal(editProxy); }
  });
  document.addEventListener('quiz:open', () => openModal());

  // Close controls
  cancelBtn?.addEventListener('click', closeModal);
  dlg.querySelectorAll('.modal-close,.quiz-close').forEach(b => b.addEventListener('click', closeModal));

  // ---------- Focus Trap ----------
  function attachTrap() {
    trapHandler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key !== 'Tab') return;
      const items = all('a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', dlg)
        .filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const idx = items.indexOf(document.activeElement);
      const last = items.length - 1;
      if (e.shiftKey) { if (idx <= 0 || idx === -1) { e.preventDefault(); items[last].focus(); } }
      else { if (idx === last || idx === -1) { e.preventDefault(); items[0].focus(); } }
    };
    document.addEventListener('keydown', trapHandler, true);
  }
  function detachTrap(){ if (trapHandler) document.removeEventListener('keydown', trapHandler, true); trapHandler = null; }

  // ---------- Persist ----------
  const getStored = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)||'null'); } catch { return null; } };
  const setStored = (a) => { try { localStorage.setItem(LS_KEY, JSON.stringify(a)); } catch {} };

  function prefillForm() {
    const a = getStored() || {};
    if (selCoverage) selCoverage.value = a.coverage || '';
    if (selDevices)  selDevices.value  = a.devices  || '';
    if (selUse)      selUse.value      = a.use      || '';
    if (selAccess)   selAccess.value   = a.access   || '';
    if (priceSel)    priceSel.value    = a.price    || '';

    const qSpeed = form?.elements?.qSpeedLabel;
    if (qSpeed) {
      const want = String(a.wanTierLabel || '');
      [...qSpeed].forEach(r => { r.checked = (r.value === want); });
      if (!want) {
        const unsure = [...qSpeed].find(r => r.value === '');
        if (unsure) unsure.checked = true;
      }
    }
    if (meshAuto) meshAuto.checked = a.meshAuto !== false;
    const meshRadios = form?.elements?.qMesh;
    if (meshRadios) {
      const mv = a.mesh || '';
      [...meshRadios].forEach(r => { r.checked = (r.value === mv); });
    }
  }

  // ---------- Hints / Progress ----------
  function updateMeshHint() {
    const cov = selCoverage?.value || '';
    const auto = !!meshAuto?.checked;
    if (!meshHint) return;
    if (cov === 'Large/Multi-floor') {
      meshHint.textContent = auto
        ? 'Large / multi-floor detected — we’ll prefer mesh systems for even coverage.'
        : 'Tip: mesh greatly improves multi-floor coverage.';
    } else { meshHint.textContent = ''; }
  }
  selCoverage?.addEventListener('change', updateMeshHint);
  meshAuto?.addEventListener('change', updateMeshHint);

  function updateProgress() {
    if (!stepEl || !form) return;
    const groups = all('.q-group', form);
    let current = 0;
    groups.forEach(g => {
      const filled = all('select, input:checked', g).some(inp => !!inp.value);
      if (filled) current++;
    });
    stepEl.textContent = String(current);
  }
  form?.addEventListener('input', updateProgress);
  form?.addEventListener('change', updateProgress);

  // ---------- Submit ----------
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    // required trio
    const coverage = selCoverage?.value || '';
    const devices  = selDevices?.value  || '';
    const use      = selUse?.value      || '';

    [selCoverage, selDevices, selUse].forEach(el => el?.classList.remove('error'));
    if (!coverage) { selCoverage?.classList.add('error'); selCoverage?.focus(); return; }
    if (!devices)  { selDevices?.classList.add('error');  selDevices?.focus();  return; }
    if (!use)      { selUse?.classList.add('error');      selUse?.focus();      return; }

    // optional prefs
    const access = selAccess?.value || '';
    const price  = priceSel?.value  || '';

    const wanTierLabel = readSpeedLabel(form?.elements?.qSpeedLabel);
    let mesh = readMeshChoice();
    const meshAutoVal = !!meshAuto?.checked;

    // Auto-upgrade mesh when requested and large homes
    if (!mesh && meshAutoVal && coverage === 'Large/Multi-floor') mesh = 'yes';

    const answers = { coverage, devices, use, access, price, wanTierLabel, mesh, meshAuto: meshAutoVal };
    setStored(answers);

    if (typeof window.RH_APPLY_QUIZ === 'function') window.RH_APPLY_QUIZ(answers);
    closeModal();
  });

  function readSpeedLabel(radios) {
    if (!radios) return '';
    const r = [...radios].find(x => x.checked);
    const v = r ? String(r.value || '') : '';
    return (v === '10G' || v === '5G' || v === '2.5G' || v === '≤1G') ? v : '';
  }
  function readMeshChoice() {
    const r = form?.querySelector('input[name="qMesh"]:checked');
    const v = r ? r.value : '';
    return (v === 'yes' || v === 'no') ? v : '';
  }

  // Connect legends to hints for a11y
  all('.q-group').forEach(group => {
    const legend = group.querySelector('legend');
    const hint = group.querySelector('.hint');
    if (legend && hint) {
      if (!hint.id) hint.id = `hint-${Math.random().toString(36).slice(2)}`;
      legend.setAttribute('aria-describedby', hint.id);
    }
  });

  // Ready signal + deep-link (?quiz=1)
  document.dispatchEvent(new Event('quiz:ready'));
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('quiz') === '1') setTimeout(() => openModal(), 0);
  } catch {}
})();
