/* assets/js/quiz-modal.js
 * RouterHaus — Friendly Wizard Quiz (low-knowledge optimized)
 * - 7 clear steps, one screen at a time (Back / Next / Submit)
 * - Accepts “I’m not sure” everywhere (never blocks you)
 * - Autos: mesh hint + auto-mesh on large homes (if enabled)
 * - Gentle defaults for speed/type/budget when unknown
 * - Persists to localStorage (rh.quiz.answers), pre-fills on reopen
 * - Fully integrated with kits.js via window.RH_APPLY_QUIZ
 * - Keyboard: Esc closes, ←/→ navigate steps, Enter = Next/Submit
 */

(() => {
  const dlg = document.getElementById('quizModal');
  if (!dlg) return;

  const LS_KEY = 'rh.quiz.answers';
  const hasShowModal = typeof dlg.showModal === 'function';

  // ---------- Helpers ----------
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const firstFocusable = (root) =>
    $$('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])', root)
      .find(el => el.offsetParent !== null) || root;

  const readChecked = (name) => {
    const picked = $(`input[name="${name}"]:checked`, dlg);
    if (picked) return picked.value ?? '';
    // support legacy select if present
    const sel = $(`#${name}, select[name="${name}"]`, dlg);
    return sel ? String(sel.value || '') : '';
  };
  const anyChosen = (name) => {
    const hasRadio = !!$(`input[name="${name}"]`, dlg);
    if (hasRadio) return !!$(`input[name="${name}"]:checked`, dlg);
    const sel = $(`#${name}, select[name="${name}"]`, dlg);
    return !!sel && sel.selectedIndex > -1;
  };

  const store = {
    get() { try { return JSON.parse(localStorage.getItem(LS_KEY)||'null'); } catch { return null; } },
    set(v) { try { localStorage.setItem(LS_KEY, JSON.stringify(v)); } catch {} }
  };

  // ---------- Fallback backdrop (for non-top-layer dialogs) ----------
  let fbBackdrop = document.getElementById('quizBackdrop');
  if (!fbBackdrop) {
    fbBackdrop = document.createElement('div');
    fbBackdrop.id = 'quizBackdrop'; // style in CSS; z-index just under dialog
    fbBackdrop.style.display = 'none';
    document.body.appendChild(fbBackdrop);
    fbBackdrop.addEventListener('click', () => closeModal());
  }

  // ---------- Elements ----------
  const form = document.getElementById('quizForm');
  const stepEls = $$('.q-step', form);
  const totalSteps = stepEls.length;
  const stepText = document.getElementById('quizStep');
  const stepTotalText = document.getElementById('quizTotal');
  const fill = $('.progress-fill', form);

  const meshAuto = document.getElementById('qMeshAuto');
  const meshHint = document.getElementById('meshHint');

  const btnPrev = document.getElementById('quizPrev');
  const btnNext = document.getElementById('quizNext');
  const btnSubmit = document.getElementById('quizSubmit');
  const btnCancel = document.getElementById('quizCancel');

  stepTotalText && (stepTotalText.textContent = String(totalSteps));

  let currentStep = 1;
  let lastOpener = null;
  let trapHandler = null;

  // ---------- Open / Close ----------
  function openModal(from = document.activeElement) {
    lastOpener = from || null;
    prefillForm();
    showStep(1);

    try {
      if (hasShowModal) {
        dlg.showModal();                 // native top layer + ::backdrop
        dlg.classList.remove('no-toplayer');
        dlg.style.removeProperty('display');
        fbBackdrop.style.display = 'none';
      } else {
        // Fallback: show dialog + our manual backdrop
        dlg.setAttribute('open','');
        dlg.classList.add('no-toplayer');
        dlg.style.display = 'block';
        fbBackdrop.style.display = 'block';
      }
    } catch {
      // Ultra-safe fallback
      dlg.setAttribute('open','');
      dlg.classList.add('no-toplayer');
      dlg.style.display = 'block';
      fbBackdrop.style.display = 'block';
    }

    dlg.classList.add('is-open');
    // lock background scroll for both modes
    document.documentElement.style.overflow = 'hidden';

    queueMicrotask(() => firstFocusable(dlg)?.focus());
    attachTrap();
    updateMeshHint();
    updateProgress();
  }

  function closeModal() {
    detachTrap();

    // unlock background scroll
    document.documentElement.style.overflow = '';

    // hide fallback backdrop
    fbBackdrop.style.display = 'none';

    // Remove cosmetic flags immediately
    dlg.classList.remove('is-open','no-toplayer');

    try {
      if (hasShowModal) {
        // Native: close() is authoritative
        if (dlg.open) dlg.close();
      } else {
        // Fallback: ensure it disappears visually even if UA doesn't hide <dialog>
        dlg.removeAttribute('open');
        dlg.style.display = 'none';
      }
    } catch {
      // Belt & suspenders in weird engines
      dlg.removeAttribute('open');
      dlg.style.display = 'none';
    }

    // Return focus to opener on the next tick
    setTimeout(() => {
      try { lastOpener?.focus?.(); } catch {}
    }, 0);
  }

  // Backdrop click (outside the card) closes
  dlg.addEventListener('click', (e) => {
    if (!e.target.closest('.modal-content')) closeModal();
  });
  // Escape key from native <dialog>
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeModal(); });

  // Wire global open/edit hooks (header, empty state, etc.)
  document.addEventListener('click', (e) => {
    const openProxy = e.target.closest('#openQuiz,[data-open-quiz]');
    if (openProxy) { e.preventDefault(); openModal(openProxy); return; }
    const editProxy = e.target.closest('#editQuiz,[data-edit-quiz]');
    if (editProxy && !editProxy.hasAttribute('hidden')) { e.preventDefault(); openModal(editProxy); }
  });
  document.addEventListener('quiz:open', () => openModal());

  // Buttons
  btnCancel?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
  $('.modal-close', dlg)?.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });

  // ---------- Focus Trap & Keys ----------
  function attachTrap() {
    trapHandler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); nextStep(); return; }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); prevStep(); return; }
      if (e.key !== 'Tab') return;
      const items = $$('a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', dlg)
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

  // ---------- Prefill ----------
  function prefillForm() {
    const a = store.get() || {};
    // coverage/devices/use/access/price radios
    const map = [
      ['qCoverage', a.coverage],
      ['qDevices', a.devices],
      ['qUse', a.use],
      ['qAccess', a.access],
      ['qPrice', a.price],
    ];
    for (const [name, val] of map) {
      if (val == null) continue;
      const el = $(`input[name="${name}"][value="${CSS.escape(String(val))}"]`, dlg);
      if (el) el.checked = true;
    }
    // speed radios
    if (a.wanTierLabel) {
      const el = $(`input[name="qSpeedLabel"][value="${CSS.escape(String(a.wanTierLabel))}"]`, dlg);
      if (el) el.checked = true;
    } else {
      // default to "I'm not sure" if nothing stored
      const unsure = $(`input[name="qSpeedLabel"][value=""]`, dlg);
      if (unsure && !$$('input[name="qSpeedLabel"]:checked', dlg).length) unsure.checked = true;
    }
    // mesh auto + explicit mesh choice
    if (typeof a.meshAuto === 'boolean') meshAuto.checked = a.meshAuto;
    const meshRad = $(`input[name="qMesh"][value="${a.mesh ?? ''}"]`, dlg);
    if (meshRad) meshRad.checked = true;

    // live hints
    updateMeshHint();
  }

  // ---------- Hints / Progress ----------
  function updateMeshHint() {
    if (!meshHint) return;
    const cov = readChecked('qCoverage');
    const auto = !!meshAuto?.checked;
    if (cov === 'Large/Multi-floor') {
      meshHint.textContent = auto
        ? 'Large / multi-floor home — we’ll prefer mesh for even coverage.'
        : 'Tip: mesh greatly improves multi-floor coverage.';
    } else if (cov === '2–3 Bedroom') {
      meshHint.textContent = auto ? 'Medium homes sometimes benefit from 2-pack mesh.' : '';
    } else {
      meshHint.textContent = '';
    }
  }
  $$('input[name="qCoverage"]').forEach(r => r.addEventListener('change', () => { updateMeshHint(); updateNextState(); }));
  meshAuto?.addEventListener('change', updateMeshHint);

  function updateProgress() {
    if (!stepText || !fill) return;
    stepText.textContent = String(currentStep);
    const pct = Math.max(1, Math.min(100, Math.round((currentStep / totalSteps) * 100)));
    fill.style.width = pct + '%';
  }

  // count a group as answered if any option selected (even if value is "")
  function answeredGroupsCount() {
    const keys = ['qCoverage','qDevices','qUse','qMesh','qSpeedLabel','qAccess','qPrice'];
    return keys.reduce((n, k) => n + (anyChosen(k) ? 1 : 0), 0);
  }

  // ---------- Stepper ----------
  function showStep(n) {
    currentStep = Math.min(totalSteps, Math.max(1, n));
    stepEls.forEach(fs => fs.hidden = Number(fs.dataset.step) !== currentStep);
    // Buttons
    btnPrev.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    btnNext.style.display = currentStep === totalSteps ? 'none' : '';
    btnSubmit.style.display = currentStep === totalSteps ? '' : 'none';
    updateProgress();
    updateNextState();
    // move focus
    setTimeout(() => {
      const target = stepEls.find(fs => Number(fs.dataset.step) === currentStep);
      firstFocusable(target)?.focus();
    }, 0);
  }

  function nextStep() {
    if (currentStep <= 3 && !validateRequired(currentStep, { quiet:true })) return; // nudge on required steps
    showStep(currentStep + 1);
  }
  function prevStep() { showStep(currentStep - 1); }

  btnNext?.addEventListener('click', nextStep);
  btnPrev?.addEventListener('click', prevStep);

  function updateNextState() {
    // On the first 3 steps, enable Next only after the user makes a choice (including "I'm not sure")
    if (!btnNext) return;
    if (currentStep <= 3) {
      const name = currentStep === 1 ? 'qCoverage' : currentStep === 2 ? 'qDevices' : 'qUse';
      btnNext.disabled = !anyChosen(name);
    } else {
      btnNext.disabled = false;
    }
  }

  function validateRequired(step, { quiet=false } = {}) {
    // Required steps are 1..3 (coverage/devices/use) — selection may be an empty value, but a choice must be made.
    const name = step === 1 ? 'qCoverage' : step === 2 ? 'qDevices' : 'qUse';
    const fs = stepEls.find(s => Number(s.dataset.step) === step);
    fs?.classList.remove('error');
    const ok = anyChosen(name);
    if (!ok && !quiet) {
      fs?.classList.add('error');
      firstFocusable(fs)?.focus();
    }
    return ok;
  }

  // ---------- Submit ----------
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    // final nudge for required groups
    for (let s = 1; s <= 3; s++) {
      if (!validateRequired(s)) { showStep(s); return; }
    }

    const coverage = readChecked('qCoverage');  // may be ""
    const devices  = readChecked('qDevices');   // may be ""
    const use      = readChecked('qUse');       // may be ""
    const access   = readChecked('qAccess');    // may be ""
    const price    = readChecked('qPrice');     // may be ""
    const wanTierLabel = normalizeSpeedLabel(readChecked('qSpeedLabel')); // "" | ≤1G | 2.5G | 5G | 10G
    const meshAutoVal = !!meshAuto?.checked;
    let mesh = readMeshChoice();

    // Heuristics
    if (!mesh && meshAutoVal && coverage === 'Large/Multi-floor') mesh = 'yes';
    let finalWan = wanTierLabel;
    if (!finalWan && (use === 'Gaming' || use === 'Prosumer')) finalWan = '2.5G';

    const answers = { coverage, devices, use, access, price, wanTierLabel: finalWan, mesh, meshAuto: meshAutoVal };
    store.set(answers);

    if (typeof window.RH_APPLY_QUIZ === 'function') window.RH_APPLY_QUIZ(answers);
    closeModal();
  });

  function normalizeSpeedLabel(v) {
    const s = String(v || '');
    return (s === '≤1G' || s === '2.5G' || s === '5G' || s === '10G') ? s : '';
  }
  function readMeshChoice() {
    const r = form?.querySelector('input[name="qMesh"]:checked');
    const v = r ? r.value : '';
    return (v === 'yes' || v === 'no') ? v : '';
  }

  // Connect legends to hints for a11y
  $$('.q-step').forEach(group => {
    const legend = group.querySelector('legend');
    const hint = group.querySelector('.hint');
    if (legend && hint) {
      if (!hint.id) hint.id = `hint-${Math.random().toString(36).slice(2)}`;
      legend.setAttribute('aria-describedby', hint.id);
    }
  });

  // ---------- Deep link & ready ----------
  document.dispatchEvent(new Event('quiz:ready'));
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('quiz') === '1') setTimeout(() => openModal(), 0);
  } catch {}

  // ---------- Public extras ----------
  function onInputChange() {
    answeredGroupsCount(); // placeholder for future live preview
  }
  form?.addEventListener('input', onInputChange);
  form?.addEventListener('change', onInputChange);

  // expose open from custom events if needed
  window.RH_OPEN_QUIZ = openModal;

  // ---------- Internal ----------
  function setError(el, on=true) { el?.classList.toggle('error', !!on); }

  // Keep mesh hint and next state in sync when user interacts
  $$('input, select', form).forEach(el => {
    el.addEventListener('change', () => {
      if (el.name === 'qCoverage' || el.id === 'qMeshAuto') updateMeshHint();
      updateNextState();
    });
  });

  // initialize step UI on first load (in case prefill marked radios)
  function initUIOnce() {
    updateNextState();
    updateProgress();
  }
  initUIOnce();

})();
