/* Portail BVY — petits comportements (aucune donnée, aucun appel réseau). */
(function () {
  'use strict';
  // Menu « Plus » de la barre d'onglets (téléphone)
  document.querySelectorAll('[data-sheet]').forEach(function (btn) {
    var sheet = document.getElementById(btn.getAttribute('aria-controls'));
    if (!sheet) return;
    btn.addEventListener('click', function () {
      var open = sheet.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('open')) { sheet.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
  });
  // Listes enregistrées dès qu'on les change (ex. : tenue de livres au tableau de bord)
  document.querySelectorAll('select[data-autosubmit]').forEach(function (sel) {
    sel.addEventListener('change', function () { if (sel.form) sel.form.submit(); });
  });
  // Nom du fichier choisi dans une zone de dépôt
  document.querySelectorAll('.dropzone input[type=file]').forEach(function (input) {
    var label = input.closest('.dropzone').querySelector('[data-file]');
    input.addEventListener('change', function () {
      if (label && input.files && input.files[0]) label.textContent = 'Fichier choisi : ' + input.files[0].name;
    });
  });
})();
