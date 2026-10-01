// Galerie du design system BVY — petits comportements de démonstration (aucune dépendance).
(() => {
  const toasts = document.querySelector('.toasts');
  function toast(title, text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<svg class="i" aria-hidden="true"><use href="#i-ok"/></svg><div><b></b><span></span></div>' +
      '<button class="toast-close" type="button" aria-label="Fermer"><svg class="i i-sm" aria-hidden="true"><use href="#i-x"/></svg></button>';
    el.querySelector('b').textContent = title;
    el.querySelector('span').textContent = text;
    el.querySelector('button').addEventListener('click', () => el.remove());
    toasts.append(el);
    setTimeout(() => el.remove(), 6000);
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-toast]');
    if (t) { const [a, b] = t.dataset.toast.split('|'); toast(a, b || ''); }
    const open = e.target.closest('[data-open-modal]');
    if (open) document.getElementById(open.dataset.openModal)?.showModal();
    const close = e.target.closest('[data-close]');
    if (close) close.closest('dialog')?.close();
    const busy = e.target.closest('[data-busy]');
    if (busy && busy.getAttribute('aria-busy') !== 'true') {
      busy.setAttribute('aria-busy', 'true');
      setTimeout(() => busy.removeAttribute('aria-busy'), 1600);
    }
    const seg = e.target.closest('.segmented button');
    if (seg) seg.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === seg)));
  });

  // Panneau « Plus » de la barre d'onglets mobile
  const sheetBtn = document.querySelector('[data-sheet]');
  const sheet = sheetBtn && document.getElementById(sheetBtn.getAttribute('aria-controls'));
  const setSheet = (open) => { sheet.classList.toggle('open', open); sheetBtn.setAttribute('aria-expanded', String(open)); };
  if (sheet) {
    sheetBtn.addEventListener('click', () => {
      const open = sheetBtn.getAttribute('aria-expanded') !== 'true';
      setSheet(open);
      if (open) sheet.querySelector('a')?.focus();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheet.classList.contains('open')) { setSheet(false); sheetBtn.focus(); } });
    document.addEventListener('click', (e) => { if (sheet.classList.contains('open') && !e.target.closest('.mnav')) setSheet(false); });
  }

  // Question de validation : « Autre » ouvre un champ ; l'envoi affiche une confirmation
  document.querySelectorAll('form[data-ask]').forEach((form) => {
    const other = form.querySelector('.ask-other');
    form.addEventListener('change', () => {
      const v = form.querySelector('input[type=radio]:checked')?.value;
      other.hidden = v !== 'autre';
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const checked = form.querySelector('input[type=radio]:checked');
      if (!checked) { form.querySelector('input[type=radio]').focus(); return; }
      const label = checked.parentElement.textContent.trim();
      const done = document.createElement('div');
      done.className = 'ask-done';
      done.setAttribute('role', 'status');
      done.tabIndex = -1;
      done.innerHTML = '<span class="empty-ico" aria-hidden="true"><svg class="i"><use href="#i-ok"/></svg></span><div><p class="t-h3">Merci, c\'est noté.</p><p class="t-small t-muted" style="margin-top:4px"></p></div>';
      done.querySelector('.t-small').textContent = `Votre réponse : « ${label} ». Votre comptable BVY s'occupe du reste.`;
      form.replaceWith(done);
      done.focus();
      toast('Réponse envoyée', 'Votre comptable BVY a reçu votre réponse.');
    });
  });
})();
