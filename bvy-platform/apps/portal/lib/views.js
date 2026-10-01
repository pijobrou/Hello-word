'use strict';

/**
 * Pages HTML du portail (rendu serveur, aucun script en ligne, design system approuvé).
 * Toute valeur affichée passe par esc().
 */

const { ROLES, can } = require('./rbac.js');

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const icon = (name, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="/assets/icons.svg#${name}"/></svg>`;
const csrfField = (s) => (s ? `<input type="hidden" name="_csrf" value="${esc(s.csrf)}">` : '');

function head(title) {
  return `<!doctype html>
<html lang="fr-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} — Portail BVY</title>
<link rel="icon" href="/assets/favicon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Jost:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/tokens.css">
<link rel="stylesheet" href="/assets/components.css">
<link rel="stylesheet" href="/assets/portal.css">
</head>`;
}

function alerts({ error, notice } = {}) {
  let out = '';
  if (error) out += `<div class="alert alert-act" role="alert">${icon('i-alert')}<div><p>${esc(error)}</p></div></div>`;
  if (notice) out += `<div class="alert alert-good" role="status">${icon('i-ok')}<div><p>${esc(notice)}</p></div></div>`;
  return out;
}

/* ------------------------------------------------- écrans de connexion */

function authPage(title, body, flash) {
  return `${head(title)}
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<main class="auth" id="contenu">
  <div class="auth-card">
    <a class="auth-brand" href="/"><img src="/assets/bvy-logo-96.png" alt="" width="44" height="44"><span><b>BVY</b><small>Portail sécurisé</small></span></a>
    ${alerts(flash)}
    ${body}
    <p class="auth-foot">Besoin d’aide ? Écrivez à <a href="mailto:bvypjb@protonmail.com">bvypjb@protonmail.com</a>.</p>
  </div>
</main>
</body>
</html>`;
}

const field = (id, label, input, hint = '') =>
  `<div class="field"><label class="label" for="${id}">${label}</label>${input}${hint ? `<p class="hint" id="${id}-hint">${hint}</p>` : ''}</div>`;

function loginPage({ email = '', flash, csrf }) {
  return authPage('Connexion', `
    <h1 class="t-h1">Connexion</h1>
    <p class="lead">Accédez à votre dossier BVY.</p>
    <form class="form" method="post" action="/connexion">
      ${csrf}
      ${field('email', 'Courriel', `<input class="input" id="email" name="email" type="email" autocomplete="username" required value="${esc(email)}">`)}
      ${field('password', 'Mot de passe', '<input class="input" id="password" name="password" type="password" autocomplete="current-password" required>')}
      <button class="btn btn-plum btn-block" type="submit">Continuer</button>
    </form>
    <div class="auth-links"><a class="link" href="/mot-de-passe-oublie">Mot de passe oublié ?</a></div>`, flash);
}

function verifyPage({ method, email, flash, csrf }) {
  const app = method === 'app';
  return authPage('Vérification', `
    <h1 class="t-h1">Vérification</h1>
    <p class="lead">${app
    ? 'Entrez le code à 6 chiffres affiché dans votre application d’authentification.'
    : `Nous avons envoyé un code à 6 chiffres à <b>${esc(email)}</b>. Il est valable 10 minutes.`}</p>
    <form class="form" method="post" action="/verification">
      ${csrf}
      <input type="hidden" name="method" value="${app ? 'app' : 'email'}">
      ${field('code', 'Code', '<input class="input code-input" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9 ]{6,7}" maxlength="7" required autofocus>')}
      <button class="btn btn-plum btn-block" type="submit">Vérifier</button>
    </form>
    <div class="auth-links">
      <form method="post" action="/verification/courriel">${csrf}<button class="link-btn link" type="submit">${app ? 'Recevoir plutôt un code par courriel' : 'Renvoyer un code'}</button></form>
      <form method="post" action="/deconnexion">${csrf}<button class="link-btn link" type="submit">Annuler</button></form>
    </div>`, flash);
}

function invitePage({ token, user, flash }) {
  return authPage('Bienvenue', `
    <h1 class="t-h1">Bienvenue, ${esc(user.name.split(' ')[0])}</h1>
    <p class="lead">Choisissez votre mot de passe pour activer votre accès au portail BVY (${esc(user.email)}).</p>
    <form class="form" method="post" action="/invitation">
      <input type="hidden" name="jeton" value="${esc(token)}">
      ${field('password', 'Mot de passe', '<input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required aria-describedby="password-hint">',
    'Au moins 12 caractères. Une phrase de quelques mots est facile à retenir et difficile à deviner.')}
      ${field('password2', 'Confirmez le mot de passe', '<input class="input" id="password2" name="password2" type="password" autocomplete="new-password" required>')}
      <button class="btn btn-plum btn-block" type="submit">Activer mon accès</button>
    </form>`, flash);
}

function invalidLinkPage(message) {
  return authPage('Lien invalide', `<h1 class="t-h1">Lien invalide</h1><p class="lead">${esc(message)}</p>
    <div class="auth-links"><a class="link" href="/connexion">Aller à la connexion</a></div>`);
}

function forgotPage({ flash, sent, csrf }) {
  return authPage('Mot de passe oublié', sent
    ? `<h1 class="t-h1">Vérifiez vos courriels</h1><p class="lead">Si un compte existe pour cette adresse, un lien de réinitialisation vient d’y être envoyé. Il est valable 30 minutes.</p>
       <div class="auth-links"><a class="link" href="/connexion">Retour à la connexion</a></div>`
    : `<h1 class="t-h1">Mot de passe oublié</h1><p class="lead">Entrez votre courriel : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
    <form class="form" method="post" action="/mot-de-passe-oublie">
      ${csrf}
      ${field('email', 'Courriel', '<input class="input" id="email" name="email" type="email" autocomplete="username" required>')}
      <button class="btn btn-plum btn-block" type="submit">Envoyer le lien</button>
    </form>
    <div class="auth-links"><a class="link" href="/connexion">Retour à la connexion</a></div>`, flash);
}

function resetPage({ token, flash }) {
  return authPage('Nouveau mot de passe', `
    <h1 class="t-h1">Nouveau mot de passe</h1>
    <p class="lead">Après ce changement, vous devrez vous connecter de nouveau avec la vérification habituelle.</p>
    <form class="form" method="post" action="/reinitialiser">
      <input type="hidden" name="jeton" value="${esc(token)}">
      ${field('password', 'Nouveau mot de passe', '<input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required>', 'Au moins 12 caractères.')}
      ${field('password2', 'Confirmez le mot de passe', '<input class="input" id="password2" name="password2" type="password" autocomplete="new-password" required>')}
      <button class="btn btn-plum btn-block" type="submit">Enregistrer</button>
    </form>`, flash);
}

/* ------------------------------------------------ coquille de l'application */

function navItems(user) {
  const items = [{ href: '/accueil', label: 'Accueil', icon: 'i-home' }];
  if (can(user, 'audit.view') || can(user, 'users.invite_client')) items.push({ href: '/admin', label: 'Administration', icon: 'i-users' });
  items.push({ href: '/compte', label: 'Mon compte', icon: 'i-lock' });
  return items;
}

function appPage(s, { title, current, body, flash }) {
  const user = s.user;
  const items = navItems(user);
  const nav = items.map((it) => `<li><a class="nav-item" href="${it.href}"${it.href === current ? ' aria-current="page"' : ''}>${icon(it.icon)}${esc(it.label)}</a></li>`).join('');
  const tabs = items.map((it) => `<a class="tab" href="${it.href}"${it.href === current ? ' aria-current="page"' : ''}>${icon(it.icon)}${esc(it.label === 'Administration' ? 'Admin' : it.label)}</a>`).join('');
  const logout = `<form method="post" action="/deconnexion">${csrfField(s)}<button class="link-btn" type="submit">Se déconnecter</button></form>`;
  return `${head(title)}
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<div class="app">
  <aside class="sidebar" aria-label="Menu du portail">
    <a class="sb-brand" href="/accueil"><img src="/assets/bvy-logo-96.png" alt="" width="36" height="36"><span><b>BVY</b><small>${user.role === 'client' ? 'Portail client' : 'Espace BVY'}</small></span></a>
    <nav aria-label="Navigation principale"><ul class="nav-list">${nav}</ul></nav>
    <div class="sb-foot"><p class="sb-user"><b>${esc(user.name)}</b>${esc(ROLES[user.role])}</p>${logout}</div>
  </aside>
  <div class="main">
    <header class="topbar">
      <a class="topbar-brand" href="/accueil"><img src="/assets/bvy-logo-96.png" alt="" width="32" height="32"><b>BVY</b></a>
      <span class="topbar-spacer"></span>
      <span class="show-m">${logout}</span>
      <span class="avatar hide-m" aria-label="${esc(user.name)}">${esc(initials(user.name))}</span>
    </header>
    <main class="content" id="contenu">
      ${alerts(flash)}
      ${body}
    </main>
    <div class="mnav"><nav class="tabbar tabs-${items.length}" aria-label="Navigation principale (mobile)">${tabs}</nav></div>
  </div>
</div>
</body>
</html>`;
}

function initials(name) {
  return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
}

const pageHead = (eyebrow, title, intro) => `<div class="page-head"><div>
  <p class="t-eyebrow"><span>${esc(eyebrow)}</span></p>
  <h1 class="t-display">${esc(title)}</h1>${intro ? `<p>${intro}</p>` : ''}</div></div>`;

/* ----------------------------------------------------------------- accueil */

function homePage(s, { clients, flash }) {
  const u = s.user;
  const first = esc(u.name.split(' ')[0]);
  let body;
  if (u.role === 'client') {
    const c = clients[0];
    body = `${pageHead(c ? c.name : 'Portail client', `Bonjour ${first}.`, 'Votre accès sécurisé au portail BVY est actif.')}
    <div class="cols-2">
      <article class="card"><div class="card-head"><h2 class="t-h3">Votre tableau de bord arrive</h2></div>
        <p>Bientôt, vous verrez ici en un coup d’œil votre argent disponible, ce que vos clients vous doivent, vos factures à payer, ce que vous avez à faire et ce que BVY fait pour vous.</p>
        <p class="t-meta mt-4">En attendant, votre comptable BVY vous écrit par courriel comme d’habitude.</p></article>
      <article class="card"><div class="card-head"><h2 class="t-h3">Votre sécurité</h2></div>
        <p>${u.totp_enabled ? 'Vous utilisez une application d’authentification.' : 'Vous recevez un code par courriel à chaque connexion.'}</p>
        <div class="btn-row mt-4"><a class="btn btn-outline btn-sm" href="/compte">Gérer mon compte</a></div></article>
    </div>`;
  } else {
    const rows = clients.map((c) => `<tr><td>${esc(c.name)}</td><td>${c.qbo_realm_id ? '<span class="badge b-good">QuickBooks connecté</span>' : '<span class="badge b-neutral">QuickBooks non connecté</span>'}</td></tr>`).join('');
    const mfaWarn = !u.totp_enabled
      ? `<div class="alert alert-watch">${icon('i-eye')}<div><p class="alert-title">Protégez mieux votre accès</p><p>Vous voyez des dossiers de clients : activez une application d’authentification.</p><div class="btn-row"><a class="btn btn-plum btn-sm" href="/compte#application">Activer maintenant</a></div></div></div>`
      : '';
    body = `${pageHead(ROLES[u.role], `Bonjour ${first}.`, `${clients.length} client${clients.length > 1 ? 's' : ''} ${clients.length > 1 ? 'sont visibles' : 'est visible'} avec votre rôle.`)}
    ${mfaWarn}
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Vos clients</h2></div>
      ${clients.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Entreprise</th><th scope="col">QuickBooks</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="empty">${icon('i-users', 'i empty-ico')}<p><b>Aucun client pour l’instant.</b></p><p>${can(u, 'clients.manage') ? 'Créez votre premier client dans Administration.' : 'Un administrateur doit vous assigner des clients.'}</p></div>`}
    </article>`;
  }
  return appPage(s, { title: 'Accueil', current: '/accueil', body, flash });
}

/* --------------------------------------------------------------- mon compte */

function accountPage(s, { sessions, pendingSecret, pendingUri, flash }) {
  const u = s.user;
  const csrf = csrfField(s);
  const fmt = (ms) => new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }).format(new Date(ms));
  const sessionRows = sessions.map((x) => `<tr><td>${esc(shortAgent(x.user_agent))}${x.id_hash === s.id_hash ? ' <span class="badge b-info">Cet appareil</span>' : ''}</td><td>${esc(fmt(x.last_seen))}</td>
    <td>${x.id_hash === s.id_hash ? '' : `<form method="post" action="/compte/sessions/fermer">${csrf}<input type="hidden" name="id" value="${esc(x.id_hash)}"><button class="btn btn-ghost btn-sm" type="submit">Fermer</button></form>`}</td></tr>`).join('');

  const app = u.totp_enabled
    ? `<p><span class="badge b-good">${icon('i-ok')}Activée</span></p><p class="mt-4">À chaque connexion, le code vient de votre application. Vous pouvez toujours demander un code par courriel si vous n’avez pas votre téléphone.</p>
       <form class="mt-4" method="post" action="/compte/application/desactiver">${csrf}<button class="btn btn-outline btn-sm" type="submit">Désactiver l’application</button></form>`
    : pendingSecret
      ? `<ol class="steps">
           <li>Ouvrez Google Authenticator ou Microsoft Authenticator, puis « Ajouter un compte » → « Saisir une clé de configuration ».</li>
           <li><div>Nom du compte : <b>BVY</b>. Clé :<p class="secret mt-4">${esc(pendingSecret.match(/.{1,4}/g).join(' '))}</p><p class="mt-4">Sur ce téléphone, vous pouvez aussi <a class="link" href="${esc(pendingUri)}">ouvrir directement l’application</a>.</p></div></li>
           <li>Entrez le code à 6 chiffres affiché pour terminer.</li></ol>
         <form class="form mt-4" method="post" action="/compte/application/activer">${csrf}
           ${field('code', 'Code de l’application', '<input class="input code-input" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" required>')}
           <div class="btn-row"><button class="btn btn-plum" type="submit">Activer</button></div></form>`
      : `<p>${u.role === 'client' ? 'Facultatif : au lieu d’un code par courriel, utilisez une application sur votre téléphone.' : '<b>Recommandé pour l’équipe BVY</b> : un code sur votre téléphone, même si votre boîte courriel est compromise.'}</p>
         <form class="mt-4" method="post" action="/compte/application/commencer">${csrf}<button class="btn btn-plum btn-sm" type="submit">Configurer l’application</button></form>`;

  const body = `${pageHead('Mon compte', 'Sécurité de votre accès', `${esc(u.email)} · ${esc(ROLES[u.role])}`)}
  <div class="cols-2">
    <article class="card" id="application"><div class="card-head"><h2 class="t-h3">Application d’authentification</h2></div>${app}</article>
    <article class="card"><div class="card-head"><h2 class="t-h3">Changer le mot de passe</h2></div>
      <form class="form" method="post" action="/compte/mot-de-passe">${csrf}
        ${field('current', 'Mot de passe actuel', '<input class="input" id="current" name="current" type="password" autocomplete="current-password" required>')}
        ${field('password', 'Nouveau mot de passe', '<input class="input" id="password" name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required>', 'Au moins 12 caractères. Vos autres appareils seront déconnectés.')}
        ${field('password2', 'Confirmez', '<input class="input" id="password2" name="password2" type="password" autocomplete="new-password" required>')}
        <div class="btn-row"><button class="btn btn-plum" type="submit">Changer le mot de passe</button></div></form></article>
  </div>
  <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Appareils connectés</h2><span class="t-meta">Fermez ceux que vous ne reconnaissez pas</span></div>
    <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Appareil</th><th scope="col">Dernière activité</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>${sessionRows}</tbody></table></div></article>`;
  return appPage(s, { title: 'Mon compte', current: '/compte', body, flash });
}

function shortAgent(ua) {
  const a = String(ua || '');
  const os = /iPhone|iPad/.test(a) ? 'iPhone / iPad' : /Android/.test(a) ? 'Android' : /Windows/.test(a) ? 'Windows' : /Mac OS/.test(a) ? 'Mac' : /Linux/.test(a) ? 'Linux' : 'Appareil';
  const br = /Edg\//.test(a) ? 'Edge' : /Chrome\//.test(a) ? 'Chrome' : /Firefox\//.test(a) ? 'Firefox' : /Safari\//.test(a) ? 'Safari' : 'navigateur';
  return `${os} · ${br}`;
}

/* ------------------------------------------------------------ administration */

function adminPage(s, { users, clients, flash }) {
  const u = s.user;
  const csrf = csrfField(s);
  const roleOptions = Object.entries(ROLES)
    .filter(([r]) => (r === 'client' ? can(u, 'users.invite_client') : can(u, 'users.invite_staff')))
    .map(([r, label]) => `<option value="${r}">${esc(label)}</option>`).join('');
  const clientOptions = clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const status = { invited: '<span class="badge b-watch">Invitation envoyée</span>', active: '<span class="badge b-good">Actif</span>', disabled: '<span class="badge b-neutral">Désactivé</span>' };
  const clientName = Object.fromEntries(clients.map((c) => [c.id, c.name]));
  const userRows = users.map((x) => `<tr><td><b>${esc(x.name)}</b><br><span class="t-meta">${esc(x.email)}</span></td>
    <td>${esc(ROLES[x.role])}${x.client_id ? `<br><span class="t-meta">${esc(clientName[x.client_id] || '')}</span>` : ''}</td>
    <td>${status[x.status]}${x.totp_enabled ? ' <span class="badge b-info">Application</span>' : ''}</td>
    <td>${can(u, 'users.manage') ? `<a class="link" href="/admin/utilisateurs/${x.id}">Gérer</a>` : ''}</td></tr>`).join('');

  const body = `${pageHead('Administration', 'Personnes et clients', 'Invitez les personnes, créez les clients et choisissez qui voit quoi.')}
  <div class="cols-2">
    <article class="card"><div class="card-head"><h2 class="t-h3">Inviter une personne</h2></div>
      <form class="form" method="post" action="/admin/inviter">${csrf}
        ${field('i-name', 'Nom complet', '<input class="input" id="i-name" name="name" required maxlength="120">')}
        ${field('i-email', 'Courriel', '<input class="input" id="i-email" name="email" type="email" required maxlength="160">')}
        ${field('i-role', 'Rôle', `<select class="input" id="i-role" name="role" required>${roleOptions}</select>`)}
        ${field('i-client', 'Entreprise (pour un client seulement)', `<select class="input" id="i-client" name="clientId"><option value="">—</option>${clientOptions}</select>`)}
        <div class="btn-row"><button class="btn btn-plum" type="submit">Envoyer l’invitation</button></div>
        <p class="hint">La personne reçoit un lien valable 72 heures et choisit elle-même son mot de passe.</p></form></article>
    ${can(u, 'clients.manage') ? `<article class="card"><div class="card-head"><h2 class="t-h3">Créer un client</h2></div>
      <form class="form" method="post" action="/admin/clients">${csrf}
        ${field('c-name', 'Nom de l’entreprise', '<input class="input" id="c-name" name="name" required maxlength="160">')}
        <div class="btn-row"><button class="btn btn-outline" type="submit">Créer le client</button></div></form>
      <p class="t-meta mt-4">${clients.length} client${clients.length > 1 ? 's' : ''} actif${clients.length > 1 ? 's' : ''}.</p></article>` : ''}
  </div>
  <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Personnes</h2>${can(u, 'audit.view') ? '<a class="link" href="/admin/journal">Journal d’audit</a>' : ''}</div>
    <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Personne</th><th scope="col">Rôle</th><th scope="col">État</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>${userRows}</tbody></table></div></article>`;
  return appPage(s, { title: 'Administration', current: '/admin', body, flash });
}

function adminUserPage(s, { target, clients, assigned, flash }) {
  const csrf = csrfField(s);
  const assignable = ['bookkeeper', 'payroll', 'tax'].includes(target.role);
  const rows = clients.map((c) => `<tr><td>${esc(c.name)}</td><td>${assigned.has(c.id) ? '<span class="badge b-good">Assigné</span>' : '<span class="badge b-neutral">Non assigné</span>'}</td>
    <td><form method="post" action="/admin/utilisateurs/${target.id}/assignation">${csrf}<input type="hidden" name="clientId" value="${c.id}"><input type="hidden" name="assigned" value="${assigned.has(c.id) ? '0' : '1'}">
    <button class="btn btn-ghost btn-sm" type="submit">${assigned.has(c.id) ? 'Retirer' : 'Assigner'}</button></form></td></tr>`).join('');
  const body = `${pageHead('Administration', target.name, `${esc(target.email)} · ${esc(ROLES[target.role])}`)}
  <div class="btn-row">
    ${target.status === 'active' ? `<form method="post" action="/admin/utilisateurs/${target.id}/statut">${csrf}<input type="hidden" name="status" value="disabled"><button class="btn btn-danger btn-sm" type="submit">Désactiver l’accès</button></form>` : ''}
    ${target.status === 'disabled' ? `<form method="post" action="/admin/utilisateurs/${target.id}/statut">${csrf}<input type="hidden" name="status" value="active"><button class="btn btn-outline btn-sm" type="submit">Réactiver l’accès</button></form>` : ''}
    ${target.status === 'invited' ? `<form method="post" action="/admin/utilisateurs/${target.id}/reinviter">${csrf}<button class="btn btn-outline btn-sm" type="submit">Renvoyer l’invitation</button></form>` : ''}
    ${target.totp_enabled ? `<form method="post" action="/admin/utilisateurs/${target.id}/application">${csrf}<button class="btn btn-outline btn-sm" type="submit">Réinitialiser l’application (téléphone perdu)</button></form>` : ''}
  </div>
  ${assignable ? `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Clients assignés</h2><span class="t-meta">Cette personne ne voit que ces clients</span></div>
    <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Entreprise</th><th scope="col">État</th><th scope="col"><span class="sr-only">Action</span></th></tr></thead><tbody>${rows}</tbody></table></div></article>`
    : `<p class="t-meta mt-6">${target.role === 'client' ? 'Un client voit seulement son entreprise.' : 'Ce rôle voit tous les clients.'}</p>`}
  <p class="mt-6"><a class="link" href="/admin">← Retour à l’administration</a></p>`;
  return appPage(s, { title: target.name, current: '/admin', body, flash });
}

function auditPage(s, { rows, names }) {
  const fmt = (iso) => new Intl.DateTimeFormat('fr-CA', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'America/Toronto' }).format(new Date(iso));
  const body = `${pageHead('Administration', 'Journal d’audit', 'Les 200 derniers événements. Ce journal ne peut être ni modifié ni effacé.')}
  <article class="card"><div class="table-wrap"><table class="table"><thead><tr><th scope="col">Date</th><th scope="col">Personne</th><th scope="col">Action</th><th scope="col">Cible</th><th scope="col">Adresse IP</th></tr></thead><tbody>
  ${rows.map((r) => `<tr><td class="t-mono">${esc(fmt(r.at))}</td><td>${esc(r.user_id ? names[r.user_id] || `#${r.user_id}` : '—')}</td><td>${esc(r.action)}</td><td>${esc(r.target || '')}</td><td class="t-mono">${esc(r.ip || '')}</td></tr>`).join('')}
  </tbody></table></div></article>
  <p class="mt-6"><a class="link" href="/admin">← Retour à l’administration</a></p>`;
  return appPage(s, { title: 'Journal d’audit', current: '/admin', body });
}

function errorPage(status, message) {
  return authPage(String(status), `<h1 class="t-h1">${status === 404 ? 'Page introuvable' : status === 403 ? 'Accès refusé' : 'Oups'}</h1>
    <p class="lead">${esc(message)}</p><div class="auth-links"><a class="link" href="/">Retour au portail</a></div>`);
}

module.exports = {
  esc, loginPage, verifyPage, invitePage, invalidLinkPage, forgotPage, resetPage,
  homePage, accountPage, adminPage, adminUserPage, auditPage, errorPage, csrfField,
};
