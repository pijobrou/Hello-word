'use strict';

/**
 * Écrans du portail client (phase 3) et de l'espace client côté équipe BVY.
 * Chaque écran répond : qu'est-ce que je regarde, pourquoi c'est important, dois-je agir, où cliquer ensuite.
 */

const { esc, appPage, pageHead, field, icon, csrfField } = require('./views.js');
const { formatAmount, HEALTH, KINDS } = require('./portal.js');

const TZ = 'America/Toronto';
const dateFr = (iso) => (iso ? new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? 'UTC' : TZ }).format(new Date(iso)) : '');
const dateTimeFr = (iso) => new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: TZ }).format(new Date(iso));
const todayFr = () => new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ }).format(new Date());
const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);
const qboLink = (url, label = 'Voir dans QuickBooks') => (url
  ? `<a class="qbo-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span><span class="sr-only">(nouvel onglet)</span></a>` : '');
const healthBadge = (state) => ({
  good: `<span class="badge b-good">${icon('i-ok')}${HEALTH.good}</span>`,
  watch: `<span class="badge b-watch">${icon('i-eye')}${HEALTH.watch}</span>`,
  action: `<span class="badge b-act">${icon('i-alert')}${HEALTH.action}</span>`,
}[state] || '');
const KIND_ICON = { question: 'i-question', document: 'i-upload', approval: 'i-ok', info: 'i-info' };

/* ================================================================ CLIENT */

function taskItem(t, s, { compact = false, staff = false } = {}) {
  const csrf = csrfField(s);
  const meta = [
    `<span>${esc(KINDS[t.kind])}</span>`,
    t.due_date && t.status === 'open' ? `<span>À faire d’ici le ${esc(dateFr(t.due_date))}</span>` : '',
    t.answered_at ? `<span>Répondu par ${esc(t.answered_by_name || '')} le ${esc(dateTimeFr(t.answered_at))}</span>` : '',
    qboLink(t.qbo_url),
  ].filter(Boolean).join('');
  let action = '';
  if (t.status === 'open' && !staff && !compact) {
    if (t.kind === 'question') {
      action = `<form class="task-form" method="post" action="/a-faire/${t.id}/repondre">${csrf}
        <fieldset><legend class="label">Votre réponse</legend><div class="choices">
        ${t.choices.map((c, i) => `<label class="choice"><input type="radio" name="choice" value="${esc(c)}"${i === 0 ? ' required' : ''}>${esc(c)}</label>`).join('')}
        </div></fieldset>
        ${field(`c-${t.id}`, 'Précision <span class="opt">(obligatoire si « Autre »)</span>', `<textarea class="input" id="c-${t.id}" name="comment" maxlength="1000"></textarea>`)}
        <div class="btn-row"><button class="btn btn-plum" type="submit">Envoyer ma réponse</button></div></form>`;
    } else if (t.kind === 'approval') {
      action = `<form class="task-form" method="post" action="/a-faire/${t.id}/repondre">${csrf}
        ${field(`c-${t.id}`, 'Commentaire <span class="opt">(facultatif)</span>', `<textarea class="input" id="c-${t.id}" name="comment" maxlength="1000"></textarea>`)}
        <div class="btn-row"><button class="btn btn-plum" type="submit" name="decision" value="approve">J’approuve</button>
        <button class="btn btn-outline" type="submit" name="decision" value="reject">Je n’approuve pas</button></div></form>`;
    } else if (t.kind === 'info') {
      action = `<form class="task-form" method="post" action="/a-faire/${t.id}/repondre">${csrf}<div class="btn-row"><button class="btn btn-outline btn-sm" type="submit">C’est noté</button></div></form>`;
    } else {
      action = `<form class="task-form" method="post" action="/documents" enctype="multipart/form-data">${csrf}
        <input type="hidden" name="taskId" value="${t.id}">
        <label class="dropzone" for="f-${t.id}">${icon('i-upload')}<b data-file>Choisissez le document</b><span>PDF, JPG ou PNG · 20 Mo maximum · une photo prise avec le téléphone convient</span>
        <input class="sr-only" id="f-${t.id}" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required></label>
        <div class="btn-row"><button class="btn btn-plum" type="submit">Envoyer le document</button></div></form>`;
    }
  }
  const staffActions = staff && t.status !== 'done' ? `<div class="todo-actions">
    <form method="post" action="/taches/${t.id}/fermer">${csrf}<input type="hidden" name="status" value="done"><button class="btn btn-ghost btn-sm" type="submit">Marquer terminé</button></form>
    ${t.status === 'open' ? `<form method="post" action="/taches/${t.id}/fermer">${csrf}<input type="hidden" name="status" value="cancelled"><button class="btn btn-ghost btn-sm" type="submit">Annuler</button></form>` : ''}</div>` : '';
  return `<li class="todo${t.status === 'open' ? '' : ' task-done'}" id="t${t.id}">
    <span class="todo-ico">${icon(t.status === 'open' ? KIND_ICON[t.kind] : 'i-ok')}</span>
    <div><p class="todo-title">${esc(t.title)}</p>${t.detail ? `<p class="todo-why">${esc(t.detail)}</p>` : ''}
      <p class="todo-meta">${meta}</p>${t.answer ? `<p class="answer"><b>Réponse :</b> ${esc(t.answer)}</p>` : ''}${action}</div>
    ${staffActions || (compact && t.status === 'open' ? `<div class="todo-actions"><a class="btn btn-plum btn-sm" href="/a-faire#t${t.id}">Faire</a></div>` : '')}</li>`;
}

// « il y a 5 min » pour la barre du tableau de bord
function ago(iso) {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!(min >= 0)) return `le ${dateTimeFr(iso)}`;
  if (min < 1) return 'à l’instant';
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`;
  return `le ${dateTimeFr(iso)}`;
}

// Chiffre du tableau de bord client : libellé, montant, une ligne courte colorée (comme sur le site).
function dashKpi(label, block, href) {
  const has = block && block.amount !== null && block.amount !== undefined;
  const line = block && (block.hint || block.note);
  const tone = block && block.tone === 'down' ? ' down' : block && block.tone === 'up' ? ' up' : '';
  const inner = `<small>${esc(label)}</small><b${has ? '' : ' class="empty"'}>${has ? esc(formatAmount(block.amount)) : 'À venir'}</b>
    <em class="${tone.trim()}">${line ? esc(line) : has ? '' : 'Ajouté à la prochaine mise à jour'}</em>`;
  return href
    ? `<a class="cd-kpi" href="${esc(href)}" target="_blank" rel="noopener" title="Voir dans QuickBooks (nouvel onglet)">${inner}</a>`
    : `<div class="cd-kpi">${inner}</div>`;
}

function clientHome(s, { client, snap, tasks, nav, flash, sync = null }) {
  const first = esc(s.user.name.split(' ')[0]);
  const open = tasks.filter((t) => t.status === 'open');
  const qbo = nav.qboUrl;
  const okSync = sync && sync.status === 'connected' && sync.lastSyncStatus !== 'failed';
  const syncTxt = sync
    ? (sync.status === 'connected'
      ? `QuickBooks synchronisé${sync.lastSyncAt ? ` · ${esc(ago(sync.lastSyncAt))}` : ''}`
      : 'Connexion QuickBooks à renouveler · BVY s’en occupe')
    : (snap ? `Mis à jour par BVY le ${esc(dateFr(snap.asOf))}` : '');
  const bar = `<div class="cd-bar"><span class="cd-who"><img src="/assets/bvy-logo-96.png" alt="" width="26" height="26">${esc(client.name)}</span>
    ${syncTxt ? `<span class="cd-sync" role="status"><span class="dot${!sync || okSync ? '' : ' watch'}" aria-hidden="true"></span>${syncTxt}</span>` : ''}</div>`;

  const todo = `<section class="cd-panel" aria-labelledby="h-todo"><h2 id="h-todo">À faire ${open.length
    ? `<span class="badge b-watch">${open.length} action${open.length > 1 ? 's' : ''}</span>`
    : '<span class="badge b-good">● À jour</span>'}</h2>
    ${open.length ? `<ul class="cd-todo">${open.slice(0, 5).map((t) => `<li><a class="t" href="/a-faire#t${t.id}"><span class="box" aria-hidden="true"></span>${esc(t.title)}</a>${t.qbo_url ? `<a class="qbo" href="${esc(t.qbo_url)}" target="_blank" rel="noopener">Voir ↗<span class="sr-only"> dans QuickBooks (nouvel onglet)</span></a>` : ''}</li>`).join('')}</ul>
      <p class="cd-more"><a class="link" href="/a-faire">${open.length > 5 ? `Voir les ${open.length} actions` : 'Tout voir et répondre'}</a></p>`
    : '<p class="muted">Tout est à jour de votre côté. Une question ? <a class="link" href="/messages">Écrivez à BVY</a>.</p>'}</section>`;

  let body;
  if (snap) {
    const health = snap.health ? `<section class="cd-panel" aria-labelledby="h-sante"><h2 id="h-sante">Santé financière ${healthBadge(snap.health.state)}</h2>
      <p>${esc(snap.health.why)}</p></section>` : '';
    const changes = snap.changes.length ? `<section class="cd-panel" aria-labelledby="h-chg"><h2 id="h-chg">Ce qui a changé</h2>
      <ul class="cd-changes">${snap.changes.map((c) => (c.label
        ? `<li><span>${esc(c.label)}</span><span class="${c.tone === 'down' ? 'dn' : c.tone === 'up' ? 'up' : ''}">${esc(c.delta)}</span></li>`
        : `<li class="long"><span>${esc(c.what)}</span></li>`)).join('')}</ul>
      ${snap.changes.some((c) => c.label && c.why) ? `<p class="cd-foot">${esc(((snap.changes.find((c) => c.label && /^Compar/.test(c.why || '')) || {}).why || '').replace(/\s*\([^)]*\)/, ''))}</p>` : ''}</section>` : '';
    const work = snap.work.length ? `<section class="cd-panel" aria-labelledby="h-work"><h2 id="h-work">BVY travaille sur</h2>
      <div class="cd-bars">${snap.work.map((w) => `<div class="cd-barrow"><span>${esc(w.name)}</span>${w.progress === null
        ? `<span class="track" aria-hidden="true"><span class="fill p0"></span></span><span>${esc(w.status)}</span>`
        : `<span class="track" role="progressbar" aria-label="${esc(w.name)}" aria-valuenow="${w.progress}" aria-valuemin="0" aria-valuemax="100"><span class="fill p${Math.round(w.progress / 5) * 5}"></span></span><span>${w.progress} %</span>`}</div>`).join('')}</div></section>` : '';
    body = `<div class="cd">
      ${bar}
      <div class="cd-body">
        <div class="cd-kpis">
          ${dashKpi('Argent disponible', snap.cash, qbo)}
          ${dashKpi('Vos clients vous doivent', snap.receivable, qbo)}
          ${dashKpi('Factures à payer', snap.payable, qbo)}
        </div>
        ${health}
        ${todo}
        ${changes || work ? `<div class="cd-2">${changes}${work}</div>` : ''}
      </div>
      <p class="cd-note">${snap.source === 'qbo'
    ? `Chiffres synchronisés avec QuickBooks le ${esc(dateTimeFr(snap.updatedAt))}.${qbo ? ' Touchez un chiffre pour le voir dans QuickBooks.' : ''}`
    : `Chiffres au ${esc(dateFr(snap.asOf))}, mis à jour par BVY${snap.updatedBy ? ` (${esc(snap.updatedBy)})` : ''}.`}</p>
    </div>`;
  } else {
    body = `<div class="cd">${bar}<div class="cd-body">
      <section class="cd-panel"><h2>Votre tableau de bord se prépare</h2>
        <p>BVY ajoutera ici votre argent disponible, ce que vos clients vous doivent, vos factures à payer et la santé de votre entreprise, expliquée en mots simples.</p></section>
      ${todo}</div></div>`;
  }
  const head = `<div class="cd-hello"><p class="t-eyebrow"><span>${esc(todayFr())}</span></p><h1 class="t-h1">Bonjour ${first}.</h1></div>`;
  return appPage(s, { title: 'Accueil', current: '/accueil', body: head + body, flash, nav });
}

function clientTasks(s, { tasks, nav, flash }) {
  const open = tasks.filter((t) => t.status === 'open');
  const done = tasks.filter((t) => t.status !== 'open');
  const body = `${pageHead('À faire', open.length ? `${open.length} chose${open.length > 1 ? 's' : ''} à faire` : 'Tout est à jour', 'Ce que BVY attend de vous, en mots simples. Répondez directement ici.')}
    <article class="card">${open.length ? `<ul class="todo-list">${open.map((t) => taskItem(t, s)).join('')}</ul>`
    : `<div class="empty">${icon('i-ok', 'i empty-ico')}<p><b>Rien à faire pour l’instant.</b></p><p>BVY vous préviendra par courriel s’il a besoin de vous.</p></div>`}</article>
    ${done.length ? `<details class="disclose card mt-6"><summary>Déjà fait (${done.length})</summary><div><ul class="todo-list">${done.map((t) => taskItem(t, s)).join('')}</ul></div></details>` : ''}`;
  return appPage(s, { title: 'À faire', current: '/a-faire', body, flash, nav });
}

function docTable(docs, { staff = false } = {}) {
  if (!docs.length) return `<div class="empty">${icon('i-folder', 'i empty-ico')}<p><b>Aucun document pour l’instant.</b></p></div>`;
  return `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Document</th><th scope="col">Envoyé par</th><th scope="col">Date</th><th scope="col">Taille</th></tr></thead><tbody>
    ${docs.map((d) => `<tr><td><a class="link" href="/documents/${d.id}/telecharger">${esc(d.name)}</a>${d.category === 'report' ? ' <span class="badge b-info">Rapport</span>' : ''}${d.note ? `<br><span class="t-meta">${esc(d.note)}</span>` : ''}</td>
      <td>${d.origin === 'bvy' ? 'BVY' : esc(staff ? d.uploaded_by_name || 'Client' : d.uploaded_by_name || 'Vous')}</td><td>${esc(dateTimeFr(d.created_at))}</td><td class="num">${esc(size(d.size))}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function uploadForm(s, action, { staff = false } = {}) {
  return `<form class="form" method="post" action="${action}" enctype="multipart/form-data">${csrfField(s)}
    <label class="dropzone" for="upload">${icon('i-upload')}<b data-file>Choisissez un fichier</b><span>PDF, JPG ou PNG · 20 Mo maximum · une photo prise avec le téléphone convient</span>
      <input class="sr-only" id="upload" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required></label>
    ${field('note', `Note ${staff ? 'pour le client' : 'pour votre comptable'} <span class="opt">(facultatif)</span>`, '<input class="input" id="note" name="note" maxlength="500">')}
    ${staff ? '<div class="field"><label class="check"><input type="checkbox" name="category" value="report"> C’est un rapport (visible dans « Rapports »)</label></div>' : ''}
    <div class="btn-row"><button class="btn btn-plum" type="submit">${staff ? 'Partager avec le client' : 'Envoyer le document'}</button></div></form>`;
}

function clientDocuments(s, { docs, nav, flash }) {
  const body = `${pageHead('Documents', 'Vos documents', 'Envoyez vos factures, relevés et reçus à BVY, et retrouvez ce que BVY vous a transmis.')}
    <div class="cols-2"><article class="card"><div class="card-head"><h2 class="t-h3">Envoyer un document</h2></div>${uploadForm(s, '/documents')}</article>
    <article class="card"><div class="card-head"><h2 class="t-h3">Bon à savoir</h2></div><p>Vos documents sont conservés au Canada et seuls vous et l’équipe BVY qui s’occupe de votre dossier peuvent les ouvrir.</p>
    <p class="mt-4">N’envoyez pas de mots de passe. Pour une question, utilisez <a class="link" href="/messages">Messages</a>.</p></article></div>
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Tous les documents</h2></div>${docTable(docs)}</article>`;
  return appPage(s, { title: 'Documents', current: '/documents', body, flash, nav });
}

function clientReports(s, { docs, nav }) {
  const body = `${pageHead('Rapports', 'Vos rapports', 'Résumés, états financiers et déclarations préparés par BVY.')}
    <article class="card">${docTable(docs)}</article>`;
  return appPage(s, { title: 'Rapports', current: '/rapports', body, nav });
}

function thread(s, messages, action) {
  const items = messages.map((m) => `<div class="msg${m.author_id === s.user.id ? ' mine' : ''}"><span class="msg-meta">${esc(m.author_role === 'client' ? m.author_name : `${m.author_name} · BVY`)} — ${esc(dateTimeFr(m.created_at))}</span>${esc(m.body)}</div>`).join('');
  return `<div class="thread">${items || `<div class="empty">${icon('i-message', 'i empty-ico')}<p><b>Aucun message pour l’instant.</b></p><p>Écrivez ci-dessous : la réponse arrive ici et vous êtes prévenu par courriel.</p></div>`}</div>
    <form class="form mt-6" method="post" action="${action}">${csrfField(s)}
      ${field('body', 'Votre message', '<textarea class="input" id="body" name="body" maxlength="4000" required></textarea>')}
      <div class="btn-row"><button class="btn btn-plum" type="submit">Envoyer</button></div></form>`;
}

function clientMessages(s, { messages, nav, flash }) {
  const body = `${pageHead('Messages', 'Vos échanges avec BVY', 'Toutes vos questions et nos réponses au même endroit, plutôt que dispersées dans vos courriels.')}
    <article class="card">${thread(s, messages, '/messages')}</article>`;
  return appPage(s, { title: 'Messages', current: '/messages', body, flash, nav });
}

/* ================================================================= ÉQUIPE */

function staffHome(s, { rows, flash }) {
  const u = s.user;
  const first = esc(u.name.split(' ')[0]);
  const mfaWarn = !u.totp_enabled
    ? `<div class="alert alert-watch">${icon('i-eye')}<div><p class="alert-title">Protégez mieux votre accès</p><p>Vous voyez des dossiers de clients : activez une application d’authentification.</p><div class="btn-row"><a class="btn btn-plum btn-sm" href="/compte#application">Activer maintenant</a></div></div></div>` : '';
  const body = `${pageHead('Espace BVY', `Bonjour ${first}.`, `${rows.length} client${rows.length > 1 ? 's' : ''} dans votre périmètre.`)}${mfaWarn}
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Vos clients</h2></div>
    ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Entreprise</th><th scope="col">Tâches ouvertes</th><th scope="col">Messages non lus</th><th scope="col">Tableau de bord</th><th scope="col">QuickBooks</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><a class="link" href="/clients/${r.id}"><b>${esc(r.name)}</b></a></td><td class="num">${r.tasks}</td>
        <td>${r.unread ? `<a class="badge b-act" href="/clients/${r.id}/messages">${r.unread} non lu${r.unread > 1 ? 's' : ''}</a>` : '<span class="t-meta">—</span>'}</td>
        <td>${r.asOf ? `<span class="t-meta">au ${esc(dateFr(r.asOf))}</span>` : '<span class="badge b-watch">À préparer</span>'}</td>
        <td>${qboBadge(r.qbo)}${r.suggestions ? ` <a class="badge b-info" href="/clients/${r.id}/quickbooks">${r.suggestions} suggestion${r.suggestions > 1 ? 's' : ''}</a>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : `<div class="empty">${icon('i-users', 'i empty-ico')}<p><b>Aucun client pour l’instant.</b></p></div>`}</article>`;
  return appPage(s, { title: 'Clients', current: '/accueil', body, flash });
}

function staffClientShell(s, client, tab, inner, flash, counts = {}) {
  const q = counts.qbo;
  const qboHome = q ? (q.environment === 'sandbox' ? 'https://app.sandbox.qbo.intuit.com/app/homepage' : 'https://app.qbo.intuit.com/app/homepage') : null;
  const qboHead = client.qbo_url ? qboLink(client.qbo_url, 'Ouvrir QuickBooks')
    : q ? `${qboLink(qboHome, 'Ouvrir QuickBooks')} ${q.status === 'connected' ? '' : '<span class="badge b-act">Reconnexion nécessaire</span>'}` : 'QuickBooks non relié';
  const tabs = [['', 'Tableau de bord'], ['/quickbooks', `QuickBooks${counts.suggestions ? ` (${counts.suggestions})` : ''}`], ['/taches', `Tâches${counts.tasks ? ` (${counts.tasks})` : ''}`], ['/documents', 'Documents'], ['/messages', `Messages${counts.unread ? ` (${counts.unread})` : ''}`]];
  const body = `${pageHead('Dossier client', client.name, qboHead)}
    <nav class="subnav" aria-label="Sections du dossier">${tabs.map(([p, l]) => `<a href="/clients/${client.id}${p}"${p === tab ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</nav>
    ${inner}`;
  return appPage(s, { title: client.name, current: '/accueil', body, flash });
}

function staffDashboardForm(s, { client, snap, flash, counts }) {
  const v = snap || { asOf: new Date().toISOString().slice(0, 10), cash: {}, receivable: {}, payable: {}, health: null, changes: [], work: [] };
  const amt = (b) => (b && b.amount !== null && b.amount !== undefined ? (b.amount / 100).toFixed(2).replace('.', ',') : '');
  const csrf = csrfField(s);
  const inner = `<div class="cols-2">
    <article class="card"><div class="card-head"><h2 class="t-h3">Tableau de bord du client</h2>${snap ? `<span class="t-meta">Mis à jour le ${esc(dateTimeFr(snap.updatedAt))}</span>` : ''}</div>
      <form class="form" method="post" action="/clients/${client.id}/tableau">${csrf}
        ${field('asOf', 'Chiffres en date du', `<input class="input" id="asOf" name="asOf" type="date" required value="${esc(v.asOf)}">`)}
        ${field('cash', 'Argent disponible ($)', `<input class="input num" id="cash" name="cash" inputmode="decimal" value="${esc(amt(v.cash))}">`)}
        ${field('cashNote', 'Explication', `<input class="input" id="cashNote" name="cashNote" maxlength="200" placeholder="Ex. : dans vos 2 comptes bancaires" value="${esc(v.cash.note || '')}">`)}
        ${field('receivable', 'Les clients doivent ($)', `<input class="input num" id="receivable" name="receivable" inputmode="decimal" value="${esc(amt(v.receivable))}">`)}
        ${field('receivableNote', 'Explication', `<input class="input" id="receivableNote" name="receivableNote" maxlength="200" placeholder="Ex. : 7 factures, 2 en retard de plus de 30 jours" value="${esc(v.receivable.note || '')}">`)}
        ${field('payable', 'Factures à payer ($)', `<input class="input num" id="payable" name="payable" inputmode="decimal" value="${esc(amt(v.payable))}">`)}
        ${field('payableNote', 'Explication', `<input class="input" id="payableNote" name="payableNote" maxlength="200" value="${esc(v.payable.note || '')}">`)}
        ${field('health', 'Santé financière', `<select class="input" id="health" name="health"><option value="">— (non évaluée)</option>${Object.entries(HEALTH).map(([k, l]) => `<option value="${k}"${v.health && v.health.state === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}
        ${field('healthWhy', 'Pourquoi (obligatoire si un état est choisi)', `<textarea class="input" id="healthWhy" name="healthWhy" maxlength="600">${esc(v.health ? v.health.why : '')}</textarea>`)}
        ${field('changes', 'Ce qui a changé — une ligne par élément : <i>Ce qui change | pourquoi c’est important</i>', `<textarea class="input" id="changes" name="changes">${esc(v.changes.map((c) => `${c.what} | ${c.why}`).join('\n'))}</textarea>`)}
        ${field('work', 'BVY travaille sur — une ligne par élément : <i>Travail | 85 %</i> ou <i>Travail | en attente</i>', `<textarea class="input" id="work" name="work">${esc(v.work.map((w) => `${w.name} | ${w.progress === null ? w.status : `${w.progress} %`}`).join('\n'))}</textarea>`)}
        <div class="btn-row"><button class="btn btn-plum" type="submit">Publier pour le client</button></div></form></article>
    <article class="card"><div class="card-head"><h2 class="t-h3">QuickBooks Online</h2></div>
      <p>Collez le lien de l’entreprise dans QuickBooks : le client verra « Ouvrir QuickBooks ↗ » partout dans son portail.</p>
      <form class="form mt-4" method="post" action="/clients/${client.id}/quickbooks">${csrf}
        ${field('qboUrl', 'Lien QuickBooks (https://…intuit.com/…)', `<input class="input" id="qboUrl" name="qboUrl" type="url" maxlength="500" value="${esc(client.qbo_url || '')}">`)}
        <div class="btn-row"><button class="btn btn-outline" type="submit">Enregistrer le lien</button></div></form>
      <p class="t-meta mt-4">Les chiffres sont saisis par BVY tant que la synchronisation automatique avec QuickBooks (phase 4) n’est pas en place. Le client voit toujours leur date.</p></article></div>`;
  return staffClientShell(s, client, '', inner, flash, counts);
}

function staffTasks(s, { client, tasks, flash, counts }) {
  const csrf = csrfField(s);
  const inner = `<div class="cols-2">
    <article class="card"><div class="card-head"><h2 class="t-h3">Nouvelle tâche pour le client</h2></div>
      <form class="form" method="post" action="/clients/${client.id}/taches">${csrf}
        ${field('kind', 'Type', `<select class="input" id="kind" name="kind">${Object.entries(KINDS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>`)}
        ${field('title', 'La tâche, en une phrase simple', '<input class="input" id="title" name="title" required maxlength="200" placeholder="Ex. : Nous avons trouvé un paiement Costco de 842,37 $. Était-ce une dépense d’entreprise ?">')}
        ${field('detail', 'Pourquoi c’est important <span class="opt">(facultatif)</span>', '<textarea class="input" id="detail" name="detail" maxlength="1500"></textarea>')}
        ${field('choices', 'Choix de réponse (question) — un par ligne <span class="opt">(sinon : Oui, dépense d’entreprise / Non, personnel / Autre)</span>', '<textarea class="input" id="choices" name="choices"></textarea>')}
        ${field('dueDate', 'À faire d’ici <span class="opt">(facultatif)</span>', '<input class="input" id="dueDate" name="dueDate" type="date">')}
        ${field('qboUrl', 'Lien QuickBooks de l’élément <span class="opt">(facultatif)</span>', '<input class="input" id="qboUrl" name="qboUrl" type="url" maxlength="500">')}
        <div class="btn-row"><button class="btn btn-plum" type="submit">Créer et prévenir le client</button></div></form></article>
    <article class="card"><div class="card-head"><h2 class="t-h3">Tâches</h2></div>
      ${tasks.length ? `<ul class="todo-list">${tasks.map((t) => taskItem(t, s, { staff: true })).join('')}</ul>` : '<p>Aucune tâche.</p>'}</article></div>`;
  return staffClientShell(s, client, '/taches', inner, flash, counts);
}

function staffDocuments(s, { client, docs, flash, counts }) {
  const inner = `<div class="cols-2"><article class="card"><div class="card-head"><h2 class="t-h3">Partager un document</h2></div>${uploadForm(s, `/clients/${client.id}/documents`, { staff: true })}</article></div>
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Documents du client</h2></div>${docTable(docs, { staff: true })}</article>`;
  return staffClientShell(s, client, '/documents', inner, flash, counts);
}

function staffMessages(s, { client, messages, flash, counts }) {
  return staffClientShell(s, client, '/messages', `<article class="card">${thread(s, messages, `/clients/${client.id}/messages`)}</article>`, flash, counts);
}

function qboBadge(q) {
  if (!q) return '<span class="badge b-neutral">Non relié</span>';
  if (q.status !== 'connected') return '<span class="badge b-act">Reconnexion nécessaire</span>';
  if (q.lastSyncStatus === 'failed') return '<span class="badge b-watch">Synchronisation en échec</span>';
  return '<span class="badge b-good">Connecté</span>';
}

function staffQuickbooks(s, { client, sync, items, enabled, flash, counts }) {
  const csrf = csrfField(s);
  const KIND = { uncategorized: 'Dépense non catégorisée', overdue_invoice: 'Facture en retard' };
  let card;
  if (!enabled) {
    card = `<p>La connexion QuickBooks n’est pas encore configurée sur ce serveur (clés de l’application Intuit). Voir le guide DEPLOIEMENT.md, section QuickBooks.</p>`;
  } else if (!sync) {
    card = `<p>Reliez l’entreprise QuickBooks Online de ce client : BVY lira ses soldes bancaires, factures et dépenses (lecture seule, aucune modification dans QuickBooks) et vous proposera les tâches à faire.</p>
      <form class="mt-4" method="post" action="/clients/${client.id}/quickbooks/connecter">${csrf}<button class="btn btn-plum" type="submit">Connecter QuickBooks</button></form>
      <p class="t-meta mt-4">Il faut un accès administrateur à l’entreprise dans QuickBooks (par QuickBooks Online Accountant, ou par le client).</p>`;
  } else {
    card = `<p>${qboBadge(sync)} ${sync.companyName ? `<b>${esc(sync.companyName)}</b>` : ''} ${sync.environment === 'sandbox' ? '<span class="badge b-watch">Bac à sable (essai)</span>' : ''}</p>
      <p class="mt-4">${sync.lastSyncAt ? `Dernière synchronisation : ${esc(dateTimeFr(sync.lastSyncAt))}.` : 'Pas encore synchronisé.'}</p>
      ${sync.lastError ? `<div class="alert alert-watch mt-4">${icon('i-alert')}<div><p>${esc(sync.lastError)}</p></div></div>` : ''}
      <div class="btn-row mt-4">
        ${sync.status === 'connected'
    ? `<form method="post" action="/clients/${client.id}/quickbooks/synchroniser">${csrf}<button class="btn btn-plum btn-sm" type="submit">Synchroniser maintenant</button></form>`
    : `<form method="post" action="/clients/${client.id}/quickbooks/connecter">${csrf}<button class="btn btn-plum btn-sm" type="submit">Reconnecter QuickBooks</button></form>`}
        <form method="post" action="/clients/${client.id}/quickbooks/deconnecter">${csrf}<button class="btn btn-ghost btn-sm" type="submit">Déconnecter</button></form>
      </div>`;
  }
  const rows = items.map((it) => `<tr><td>${esc(KIND[it.kind] || it.kind)}</td><td>${esc(it.counterparty || '—')}${it.detail ? `<br><span class="t-meta">${esc(it.detail)}</span>` : ''}</td>
    <td class="num">${it.amount_cents === null ? '—' : esc(formatAmount(it.amount_cents))}</td><td>${it.txn_date ? esc(dateFr(it.txn_date)) : ''}</td>
    <td>${qboLink(it.qbo_url, 'Voir')}</td>
    <td><div class="btn-row"><form method="post" action="/suggestions/${it.id}/envoyer">${csrf}<button class="btn btn-plum btn-sm" type="submit">Envoyer au client</button></form>
      <form method="post" action="/suggestions/${it.id}/ignorer">${csrf}<button class="btn btn-ghost btn-sm" type="submit">Ignorer</button></form></div></td></tr>`).join('');
  const inner = `<div class="cols-2"><article class="card"><div class="card-head"><h2 class="t-h3">Connexion QuickBooks Online</h2></div>${card}</article>
    <article class="card"><div class="card-head"><h2 class="t-h3">Comment ça marche</h2></div>
      <p>Chaque heure, BVY lit QuickBooks : argent en banque, factures impayées, factures à payer, revenus et dépenses des deux derniers mois. Le tableau de bord du client se met à jour tout seul ; la santé financière et « BVY travaille sur » restent écrits par vous.</p>
      <p class="mt-4">Les éléments à faire détectés apparaissent ci-dessous. Rien n’est envoyé au client sans votre clic. Quand c’est corrigé dans QuickBooks, la tâche se ferme seule.</p></article></div>
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Suggestions QuickBooks</h2><span class="t-meta">${items.length} à traiter</span></div>
      ${items.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Type</th><th scope="col">Tiers</th><th scope="col">Montant</th><th scope="col">Date</th><th scope="col">QuickBooks</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="empty">${icon('i-ok', 'i empty-ico')}<p><b>Rien à traiter.</b></p><p>${sync ? 'Aucune dépense non catégorisée ni facture en retard de plus de 30 jours.' : 'Connectez QuickBooks pour recevoir des suggestions.'}</p></div>`}</article>`;
  return staffClientShell(s, client, '/quickbooks', inner, flash, counts);
}

module.exports = {
  staffQuickbooks,
  clientHome, clientTasks, clientDocuments, clientReports, clientMessages,
  staffHome, staffDashboardForm, staffTasks, staffDocuments, staffMessages,
};
