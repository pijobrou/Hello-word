/* BVY — comportements du site public (aucune dépendance) */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.remove('no-js');

  // Photo absente : on garde le fond prune au lieu d'une image cassée
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.parentNode && t.parentNode.matches('.media, .sector-media, .niche-photo')) t.remove();
  }, true);
  document.querySelectorAll('.media img, .sector-media img, .niche-photo img').forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) img.remove();
  });

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

  var started = Date.now();
  var TYPOS = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com', 'gmail.con': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com',
    'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com', 'hotmial.ca': 'hotmail.ca', 'outlok.com': 'outlook.com',
    'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'videotron.com': 'videotron.ca', 'sympatico.com': 'sympatico.ca', 'iclod.com': 'icloud.com' };
  // Téléphone : 10 chiffres nord-américains valides (ou international avec +), mis en forme (418) 555-1234
  function phoneCheck(v) {
    var main = v.replace(/\s*(poste|ext\.?|x)\s*\d{1,6}$/i, '');
    var d = main.replace(/\D/g, '');
    if (/^\+/.test(main) && !/^\+1/.test(main)) return d.length >= 8 && d.length <= 15 ? { ok: true, display: v } : { ok: false };
    if (d.length === 11 && d.charAt(0) === '1') d = d.slice(1);
    if (d.length !== 10 || /[01]/.test(d.charAt(0)) || /[01]/.test(d.charAt(3)) || /^(\d)\1{9}$/.test(d) || /^\d11/.test(d) || /^\d{3}\d11/.test(d)
      || /^\d{3}55501\d\d$/.test(d) || /^(555|900|976)/.test(d) || d === '1234567890') return { ok: false };
    return { ok: true, display: '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) + v.slice(main.length) };
  }
  function fieldMsg(name, text) {
    var el = form.querySelector('[name="' + name + '"]'); var field = el && el.closest('.field'); if (!field) return;
    field.classList.toggle('invalid', Boolean(text)); var err = field.querySelector('.err'); if (err) err.textContent = text || '';
  }
  function suggestEmail(s) {
    var field = form.courriel.closest('.field'); var err = field.querySelector('.err');
    field.classList.add('invalid');
    err.textContent = 'Vouliez-vous écrire ';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'link-btn'; b.textContent = s + ' ?';
    b.addEventListener('click', function () { form.courriel.value = s; fieldMsg('courriel', ''); form.courriel.focus(); });
    err.appendChild(b);
  }
  if (form.courriel) form.courriel.addEventListener('blur', function () {
    var v = form.courriel.value.trim().toLowerCase(); if (!v) return;
    var dom = v.split('@')[1];
    if (dom && TYPOS[dom]) suggestEmail(v.split('@')[0] + '@' + TYPOS[dom]);
    else if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) fieldMsg('courriel', 'Cette adresse courriel n’est pas valide. Exemple : vous@entreprise.ca');
    else fieldMsg('courriel', '');
  });
  if (form.telephone) form.telephone.addEventListener('blur', function () {
    var v = form.telephone.value.trim(); if (!v) return;
    var c = phoneCheck(v);
    if (c.ok) { form.telephone.value = c.display; fieldMsg('telephone', ''); } else fieldMsg('telephone', 'Numéro invalide : 10 chiffres, indicatif régional compris. Exemple : 418 555-1234');
  });

  // Case « Je ne suis pas un robot » : affichée seulement si le serveur a un fournisseur configuré
  var captcha = null;
  var capField = form.querySelector('.captcha-field');
  if (capField && window.fetch) {
    fetch('/api/captcha', { headers: { 'Accept': 'application/json' } }).then(function (r) { return r.json(); }).then(function (c) {
      if (!c || !c.provider || !c.siteKey) return;
      var api = c.provider === 'hcaptcha' ? 'hcaptcha' : 'grecaptcha';
      captcha = { api: api, id: null };
      capField.hidden = false;
      window.bvyCaptchaReady = function () {
        captcha.id = window[api].render('captcha', { sitekey: c.siteKey, callback: function () { fieldMsg('captcha', ''); } });
      };
      var sc = document.createElement('script');
      sc.async = true; sc.defer = true;
      sc.src = c.provider === 'hcaptcha'
        ? 'https://js.hcaptcha.com/1/api.js?hl=fr&render=explicit&onload=bvyCaptchaReady'
        : 'https://www.google.com/recaptcha/api.js?hl=fr-CA&render=explicit&onload=bvyCaptchaReady';
      document.head.appendChild(sc);
    }).catch(function () {});
  }
  function captchaToken() {
    if (!captcha || captcha.id === null || !window[captcha.api]) return '';
    try { return window[captcha.api].getResponse(captcha.id) || ''; } catch (e) { return ''; }
  }
  function captchaReset() {
    if (captcha && captcha.id !== null && window[captcha.api]) { try { window[captcha.api].reset(captcha.id); } catch (e) { /* rien */ } }
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
    data._t = String(Date.now() - started);
    if (captcha) data.captcha = captchaToken();

    var local = {};
    if (!data.prenom) local.prenom = 'Indiquez votre prénom.';
    if (!data.nom) local.nom = 'Indiquez votre nom.';
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(data.courriel || '')) local.courriel = 'Indiquez un courriel valide.';
    if (!data.telephone) local.telephone = 'Indiquez votre numéro de téléphone.';
    else if (!phoneCheck(data.telephone).ok) local.telephone = 'Numéro invalide : 10 chiffres, indicatif régional compris. Exemple : 418 555-1234';
    if (captcha && !data.captcha) local.captcha = 'Cochez la case « Je ne suis pas un robot ».';
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
      if (r.res.status === 422) { showErrors(r.body.errors); if (r.body.suggestion) suggestEmail(r.body.suggestion); captchaReset(); }
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
