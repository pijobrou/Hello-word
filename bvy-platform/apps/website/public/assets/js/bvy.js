/* BVY — comportements du site public (aucune dépendance) */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.remove('no-js');

  // Menu mobile
  var toggle = document.querySelector('.nav-toggle');
  var menu = document.getElementById('nav-mobile');
  if (toggle && menu) {
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('open')) toggle.click();
    });
  }

  // Ombre de la barre de navigation au défilement
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Apparition au défilement
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (r) { io.observe(r); });
  } else {
    reveals.forEach(function (r) { r.classList.add('visible'); });
  }

  // Préremplir le service depuis ?service=
  var form = document.getElementById('contact-form');
  if (!form) return;
  var params = new URLSearchParams(window.location.search);
  var pre = params.get('service');
  if (pre && form.service) {
    Array.prototype.forEach.call(form.service.options, function (o) {
      if (o.value === pre) form.service.value = pre;
    });
  }

  var status = form.querySelector('.form-status');
  var submit = form.querySelector('button[type=submit]');
  var label = submit ? submit.textContent : '';

  function clearErrors() {
    form.querySelectorAll('.field.invalid').forEach(function (f) { f.classList.remove('invalid'); });
    form.querySelectorAll('.err').forEach(function (e) { e.textContent = ''; });
  }
  function showErrors(errors) {
    Object.keys(errors || {}).forEach(function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      var field = el && el.closest('.field');
      if (!field) return;
      field.classList.add('invalid');
      var err = field.querySelector('.err');
      if (err) err.textContent = errors[name];
    });
    var first = form.querySelector('.field.invalid .input, .field.invalid input');
    if (first) first.focus();
  }
  function setStatus(kind, text) {
    status.className = 'form-status ' + kind;
    status.textContent = text;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    status.className = 'form-status';
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
    data.consentement = form.consentement && form.consentement.checked;

    var local = {};
    if (!data.prenom) local.prenom = 'Indiquez votre prénom.';
    if (!data.nom) local.nom = 'Indiquez votre nom.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.courriel || '')) local.courriel = 'Indiquez un courriel valide.';
    if (!data.consentement) local.consentement = 'Votre consentement est nécessaire pour traiter la demande.';
    if (Object.keys(local).length) { showErrors(local); return; }

    submit.disabled = true;
    submit.textContent = 'Envoi en cours…';
    fetch(form.action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) { return { res: res, body: body }; });
    }).then(function (r) {
      if (r.res.ok && r.body.ok) {
        form.reset();
        setStatus('ok', 'Merci ! Votre demande est bien reçue. Nous vous répondons dans un délai d’un jour ouvrable.');
        submit.textContent = '✓ Demande envoyée';
        return;
      }
      if (r.res.status === 422) showErrors(r.body.errors);
      setStatus('ko', r.body.error || 'Certaines informations sont à corriger.');
      submit.disabled = false;
      submit.textContent = label;
    }).catch(function () {
      setStatus('ko', 'L’envoi n’a pas fonctionné. Écrivez-nous directement à bvypjb@protonmail.com.');
      submit.disabled = false;
      submit.textContent = label;
    });
  });
})();
