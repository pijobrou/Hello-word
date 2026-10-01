/* Jessica — assistante virtuelle (IA) de BVY. Aucune dépendance.
   Le widget ne s'affiche que si le serveur indique que le service est actif (GET /api/chat).
   L'historique reste dans l'onglet (sessionStorage) : il disparaît à la fermeture de l'onglet. */
(function () {
  'use strict';
  var KEY = 'bvy-jessica';
  var MAX_CHARS = 1500;
  var RDV = '/rendez-vous/';
  var history = [];
  var busy = false;

  function load() {
    try { var v = JSON.parse(sessionStorage.getItem(KEY) || '[]'); if (Array.isArray(v)) history = v.slice(-40); } catch (e) { history = []; }
  }
  function save() {
    try { sessionStorage.setItem(KEY, JSON.stringify(history.slice(-40))); } catch (e) { /* stockage indisponible */ }
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  // Texte -> nœuds sûrs : seuls les liens vers bvyaccountingtax.ca et les adresses courriel deviennent cliquables.
  function render(text, into) {
    var re = /(https:\/\/(?:www\.)?bvyaccountingtax\.ca(?:\/[\w\-\/#?=&.%]*)?|https:\/\/calendar\.app\.google\/[\w-]+|https:\/\/calendar\.google\.com\/calendar\/appointments\/[\w\-\/?=&.%]+|[\w.+-]+@[\w-]+\.[\w.]+)/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) into.appendChild(document.createTextNode(text.slice(last, m.index)));
      var url = m[0].replace(/[.,;:)]+$/, '');
      var a = el('a', null, url);
      if (url.indexOf('@') > 0 && url.indexOf('http') !== 0) a.href = 'mailto:' + url;
      else if (/^https:\/\/calendar\./.test(url)) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
      else a.href = url.replace(/^https:\/\/(?:www\.)?bvyaccountingtax\.ca/, '') || '/';
      into.appendChild(a);
      last = m.index + url.length;
      re.lastIndex = last;
    }
    if (last < text.length) into.appendChild(document.createTextNode(text.slice(last)));
  }

  function init(bookingUrl) {
    load();
    var launcher = el('button', 'jx-launch');
    launcher.type = 'button';
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'jx-panel');
    launcher.setAttribute('aria-label', 'Discuter avec Jessica, l’assistante virtuelle (IA)');
    launcher.innerHTML = '<span class="jx-dot" aria-hidden="true">J</span><span class="jx-launch-t">Une question ? <b>Jessica</b></span>';

    var panel = el('section', 'jx-panel');
    panel.id = 'jx-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Jessica, assistante virtuelle de BVY');

    var head = el('header', 'jx-head');
    var who = el('div', 'jx-who');
    who.appendChild(el('span', 'jx-dot', 'J')).setAttribute('aria-hidden', 'true');
    var names = el('div');
    names.appendChild(el('strong', null, 'Jessica'));
    names.appendChild(el('span', null, 'Assistante virtuelle · IA'));
    who.appendChild(names);
    var close = el('button', 'jx-close');
    close.type = 'button';
    close.setAttribute('aria-label', 'Fermer la conversation');
    close.innerHTML = '<span aria-hidden="true">×</span>';
    head.appendChild(who);
    head.appendChild(close);

    var log = el('div', 'jx-log');
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');

    var notice = el('p', 'jx-notice');
    notice.appendChild(document.createTextNode('Je suis une intelligence artificielle : mes réponses sont générales et ne remplacent pas un conseil professionnel. N’écrivez aucun renseignement sensible (NAS, numéros de compte). Vos messages sont traités par Anthropic, hors du Canada, et ne sont pas conservés par BVY. '));
    var pol = el('a', null, 'Confidentialité');
    pol.href = '/confidentialite/#jessica';
    notice.appendChild(pol);

    var form = el('form', 'jx-form');
    var label = el('label', 'jx-sr', 'Votre question');
    label.setAttribute('for', 'jx-input');
    var input = el('textarea', 'jx-input');
    input.id = 'jx-input';
    input.rows = 1;
    input.maxLength = MAX_CHARS;
    input.placeholder = 'Écrivez votre question…';
    var send = el('button', 'jx-send', 'Envoyer');
    send.type = 'submit';
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(send);

    var foot = el('a', 'jx-cta', bookingUrl
      ? 'Choisir un moment dans notre agenda (30 min, gratuit) →'
      : 'Réserver une consultation gratuite de 30 minutes →');
    foot.href = bookingUrl || RDV;
    if (bookingUrl) { foot.target = '_blank'; foot.rel = 'noopener'; }

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(notice);
    panel.appendChild(form);
    panel.appendChild(foot);

    var root = el('div', 'jx');
    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);

    function bubble(role, text) {
      var b = el('div', 'jx-msg ' + (role === 'user' ? 'jx-me' : 'jx-bot'));
      render(text, b);
      log.appendChild(b);
      log.scrollTop = log.scrollHeight;
      return b;
    }
    function greet() {
      log.textContent = '';
      bubble('assistant', 'Bonjour, je suis Jessica, l’assistante virtuelle de BVY. Je peux vous renseigner sur nos services, nos offres et notre façon de travailler. Comment puis-je vous aider ?');
      history.forEach(function (m) { bubble(m.role, m.content); });
    }
    function setOpen(open) {
      panel.hidden = !open;
      launcher.setAttribute('aria-expanded', String(open));
      root.classList.toggle('open', open);
      if (open) { greet(); input.focus(); } else { launcher.focus(); }
    }
    launcher.addEventListener('click', function () { setOpen(panel.hidden); });
    close.addEventListener('click', function () { setOpen(false); });
    panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit')); }
    });
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var q = input.value.trim();
      if (!q || busy) return;
      busy = true;
      send.disabled = true;
      input.value = '';
      input.style.height = 'auto';
      bubble('user', q);
      history.push({ role: 'user', content: q.slice(0, MAX_CHARS) });
      save();
      var wait = bubble('assistant', 'Jessica écrit…');
      wait.classList.add('jx-wait');
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ messages: history })
      }).then(function (res) {
        return res.json().catch(function () { return {}; });
      }).then(function (body) {
        wait.remove();
        if (body && body.ok && body.reply) {
          bubble('assistant', body.reply);
          history.push({ role: 'assistant', content: body.reply.slice(0, MAX_CHARS) });
        } else {
          history.pop(); // la question sans réponse n'est pas gardée (l'historique doit alterner)
          bubble('assistant', (body && body.error) || 'Je ne peux pas répondre pour le moment. Écrivez-nous à bvypjb@protonmail.com.');
        }
        save();
      }).catch(function () {
        wait.remove();
        history.pop();
        save();
        bubble('assistant', 'La connexion a échoué. Réessayez, ou écrivez-nous à bvypjb@protonmail.com.');
      }).then(function () {
        busy = false;
        send.disabled = false;
        input.focus();
      });
    });
  }

  if (!window.fetch || !document.body) return;
  fetch('/api/chat', { headers: { 'Accept': 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (s) { if (s && s.enabled) init(typeof s.bookingUrl === 'string' && /^https:\/\/calendar\./.test(s.bookingUrl) ? s.bookingUrl : ''); })
    .catch(function () { /* service indisponible : pas de widget */ });
})();
