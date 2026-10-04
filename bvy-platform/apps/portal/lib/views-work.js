'use strict';

/**
 * Écrans du tableau de bord de l'équipe (workflow 05) : vue d'ensemble par type de client, échéances d'un client,
 * QuickBooks du cabinet. Réservés à l'équipe BVY.
 */

const { esc, appPage, pageHead, field, icon, csrfField } = require('./views.js');
const { formatAmount } = require('./portal.js');
const { KIND_ONE, GST_FREQ, dayFr } = require('./deadlines.js');
const { isoDay, isoDateTime } = require('./dates.js');

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const URG = { late: 'b-act', week: 'b-watch', month: 'b-info', later: 'b-neutral' };
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

const shortDate = (date) => isoDay(date);
const BOOKS = { done: ['À jour', 'bk-done'], progress: ['En cours', 'bk-progress'], todo: ['Pas encore traité', 'bk-todo'] };

// QuickBooks du client : connecté (vert), déconnecté (rouge), non relié (gris)
function qboCell(q, n, id) {
  const badge = !q ? '<span class="badge b-neutral">Non relié</span>'
    : q.status !== 'connected' ? '<span class="badge b-act">Déconnecté</span>'
      : q.lastSyncStatus === 'failed' ? '<span class="badge b-watch">Synchro en échec</span>'
        : '<span class="badge b-good">Connecté</span>';
  return `<a class="wq-qbo" href="/clients/${id}/quickbooks">${badge}</a>${n ? `<a class="wq-sub" href="/clients/${id}/quickbooks">${plural(n, 'suggestion', 'suggestions')}</a>` : ''}`;
}

// Une échéance dans sa colonne : pastille de couleur (date courte) + délai
function dueCell(d, id, applies = true) {
  if (!applies) return '<span class="wq-na" title="Ne s’applique pas">—</span>';
  if (!d) return '<span class="wq-na" title="Aucune échéance d’ici un an">✓</span>';
  const u = d.urgency;
  return `<a class="wq-due ${u.level}" href="/clients/${id}/echeances" title="${esc(d.title)} — ${esc(dayFr(d.date))}"><b>${esc(shortDate(d.date))}</b><span>${esc(u.level === 'late' ? `en retard ${-u.days} j` : u.days === 0 ? 'aujourd’hui' : `dans ${u.days} j`)}</span></a>`;
}

// Tenue de livres : liste à 3 couleurs, enregistrée dès qu'on la change
function booksCell(s, r) {
  const cls = (BOOKS[r.books] || BOOKS.todo)[1];
  return `<form class="wq-books ${cls}" method="post" action="/clients/${r.id}/tenue">${csrfField(s)}
    <label class="sr-only" for="bk-${r.id}">Tenue de livres de ${esc(r.name)}</label>
    <select id="bk-${r.id}" name="status" data-autosubmit>${Object.entries(BOOKS).map(([v, [l]]) => `<option value="${v}"${v === r.books ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
    <button class="sr-only" type="submit">Enregistrer</button></form>`;
}

function waitingCell(r) {
  const parts = [];
  if (r.unread) parts.push(`<a class="badge b-act" href="/clients/${r.id}/messages">${r.unread} message${r.unread > 1 ? 's' : ''} non lu${r.unread > 1 ? 's' : ''}</a>`);
  if (r.waiting) parts.push(`<a class="badge b-watch" href="/clients/${r.id}/taches">${plural(r.waiting, 'tâche', 'tâches')} chez le client</a>`);
  if (r.answered) parts.push(`<a class="badge b-info" href="/clients/${r.id}/taches">${plural(r.answered, 'réponse à traiter', 'réponses à traiter')}</a>`);
  if (r.cols && r.cols.other) parts.push(`<a class="badge b-neutral" href="/clients/${r.id}/echeances" title="${esc(r.cols.other.title)}">${esc(shortDate(r.cols.other.date))} · ${esc(r.cols.other.title.slice(0, 28))}${r.cols.other.title.length > 28 ? '…' : ''}</a>`);
  return parts.length ? `<div class="wq-stack">${parts.join('')}</div>` : '<span class="wq-na">Rien</span>';
}

// Colonnes selon le type de client
const COLUMNS = {
  entreprise: [['books', 'Tenue de livres'], ['taxes', 'TPS/TVQ'], ['das', 'RS', 'Retenues à la source (et T4/RL-1)'], ['t2', 'T2 / CO-17'], ['cnesst', 'CNESST']],
  autonome: [['books', 'Tenue de livres'], ['taxes', 'TPS/TVQ'], ['das', 'RS', 'Retenues à la source (et T4/RL-1)'], ['t1', 'T1 / TP-1'], ['cnesst', 'CNESST']],
  particulier: [['t1', 'T1 / TP-1'], ['acompte', 'Acomptes provisionnels']],
  unset: [],
};

function groupTable(s, g) {
  if (!g.rows.length) return '<p class="t-meta">Aucun client de ce type pour l’instant.</p>';
  const cols = COLUMNS[g.kind];
  const cell = (r, key) => {
    if (key === 'books') return booksCell(s, r);
    const applies = key in r.applies ? r.applies[key] : true;
    return dueCell(r.cols[key], r.id, applies);
  };
  return `<div class="table-wrap"><table class="table wq-table"><thead><tr><th scope="col">Client</th>
    ${cols.map(([, l, full]) => `<th scope="col">${full ? `<abbr title="${esc(full)}">${esc(l)}</abbr>` : esc(l)}</th>`).join('')}${g.kind === 'unset' ? '<th scope="col">Profil fiscal</th>' : ''}<th scope="col">En attente</th><th scope="col">QBO</th></tr></thead><tbody>
    ${g.rows.map((r) => `<tr><th scope="row"><a class="link" href="/clients/${r.id}"><b>${esc(r.name)}</b></a>${r.late ? `<span class="wq-sub late">${plural(r.late, 'échéance en retard', 'échéances en retard')}</span>` : ''}</th>
      ${cols.map(([k]) => `<td>${cell(r, k)}</td>`).join('')}${g.kind === 'unset' ? `<td><a class="link" href="/clients/${r.id}/echeances">Compléter le profil fiscal</a></td>` : ''}
      <td>${waitingCell(r)}</td><td>${qboCell(r.qbo, r.suggestions, r.id)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

const LEGEND = `<p class="wq-legend"><span><i class="wq-dot late"></i>En retard</span><span><i class="wq-dot week"></i>7 jours ou moins</span><span><i class="wq-dot month"></i>Ce mois-ci</span><span><i class="wq-dot later"></i>Plus tard</span><span>— ne s’applique pas</span><span>RS = retenues à la source</span>
  <span class="wq-legend-sep">Tenue de livres :</span><span><i class="wq-dot bk-done"></i>À jour</span><span><i class="wq-dot bk-progress"></i>En cours</span><span><i class="wq-dot bk-todo"></i>Pas encore traité</span></p>`;

function staffDashboard(s, { data, flash }) {
  const u = s.user;
  const first = esc(u.name.split(' ')[0]);
  const { summary: m, groups, unset, firm } = data;
  const firmConnected = Boolean(firm && firm.qbo && firm.qbo.status === 'connected');
  const canBill = ['admin', 'lead'].includes(u.role);
  const mfaWarn = !u.totp_enabled
    ? `<div class="alert alert-watch">${icon('i-eye')}<div><p class="alert-title">Protégez mieux votre accès</p><p>Vous voyez des dossiers de clients : activez une application d’authentification.</p><div class="btn-row"><a class="btn btn-plum btn-sm" href="/compte#application">Activer maintenant</a></div></div></div>` : '';
  const tile = (label, value, line, tone = '', href = '') => {
    const inner = `<small>${esc(label)}</small><b>${value}</b><em class="${tone}">${line}</em>`;
    return href ? `<a class="cd-kpi" href="${href}">${inner}</a>` : `<div class="cd-kpi">${inner}</div>`;
  };
  const kpis = `<div class="wq-kpis">
    ${tile('Échéances en retard', String(m.late), m.late ? `chez ${plural(m.lateClients, 'client', 'clients')}` : 'aucune', m.late ? 'down' : 'up')}
    ${tile('Cette semaine', String(m.week), m.week ? 'prochaines échéances dans 7 jours' : 'rien d’urgent', m.week ? 'down' : '')}
    ${tile('Tenue de livres', `${m.books.done} / ${m.books.done + m.books.progress + m.books.todo}`, `à jour · ${m.books.progress} en cours · ${m.books.todo} pas traité${m.books.todo > 1 ? 's' : ''}`, m.books.todo ? 'down' : 'up')}
    ${canBill ? tile('Impayé à BVY', firmConnected ? esc(formatAmount(m.owed)) : '—', firmConnected ? (m.owed ? `${plural(m.owedClients, 'client', 'clients')}${m.overdue ? ` · ${esc(formatAmount(m.overdue))} en retard` : ''}` : 'tout est payé') : 'QuickBooks du cabinet non relié', firmConnected && m.overdue ? 'down' : '', '/facturation')
    : tile('En attente des clients', String(m.waiting), m.waiting ? plural(m.waiting, 'tâche ouverte', 'tâches ouvertes') : 'rien en attente')}
    ${tile('QBO à vérifier', String(m.qboIssues), m.qboIssues ? 'déconnecté ou en échec' : 'tout est synchronisé', m.qboIssues ? 'down' : 'up', '/anomalies?gravite=system&etat=active')}
    ${tile('Anomalies urgentes', String(m.urgent || 0), m.urgent ? 'trésorerie, échéances, paie, factures' : 'rien d’urgent', m.urgent ? 'down' : 'up', '/anomalies?gravite=urgent&etat=active')}
  </div>`;
  const all = [...groups, ...(unset.length ? [{ kind: 'unset', label: 'Type à préciser', rows: unset }] : [])];
  const jump = `<nav class="subnav" aria-label="Types de clients">${all.map((g) => `<a href="#g-${g.kind}">${esc(g.label)} (${g.rows.length})</a>`).join('')}</nav>`;
  const sections = all.map((g) => `<article class="card mt-6" id="g-${g.kind}"><div class="card-head"><h2 class="t-h3">${esc(g.label)}</h2><span class="t-meta">${plural(g.rows.length, 'client', 'clients')}</span></div>
    ${g.kind === 'unset' ? '<p class="t-meta">Indiquez le type de ces clients (onglet « Échéances » de leur dossier) pour calculer leurs échéances.</p>' : ''}
    ${groupTable(s, g)}</article>`).join('');
  const body = `${pageHead('Tableau de bord', `Bonjour ${first}.`, `${plural(data.total, 'client', 'clients')} dans votre périmètre. Chaque date mène aux échéances du client ; changez l’état de la tenue de livres directement dans le tableau.`)}
    ${mfaWarn}${kpis}${jump}${LEGEND}${sections}`;
  return appPage(s, { title: 'Tableau de bord', current: '/accueil', body, flash });
}

/* ------------------------------------------------------------ Facturation */
function billingPage(s, { data, firmQbo, flash }) {
  const u = s.user;
  const connected = firmQbo && firmQbo.status === 'connected';
  const tile = (label, value, line, tone = '') => `<div class="cd-kpi"><small>${esc(label)}</small><b>${value}</b><em class="${tone}">${line}</em></div>`;
  const qboCust = (id) => `https://app.qbo.intuit.com/app/customerdetail?nameId=${encodeURIComponent(id)}`;
  const intro = !data.firm || !firmQbo
    ? `<div class="alert alert-info">${icon('i-info')}<div><p class="alert-title">Le QuickBooks du cabinet n’est pas relié</p><p>La facturation affiche les factures de BVY lues dans le QuickBooks de BVY (lecture seule).</p>${u.role === 'admin' ? '<div class="btn-row"><a class="btn btn-plum btn-sm" href="/cabinet">Relier le QuickBooks du cabinet</a></div>' : '<p>Demandez à l’administrateur de le relier.</p>'}</div></div>`
    : !connected ? `<div class="alert alert-watch">${icon('i-alert')}<div><p class="alert-title">QuickBooks du cabinet déconnecté</p><p>Les montants ci-dessous datent de la dernière lecture.${u.role === 'admin' ? ' <a class="link" href="/cabinet">Reconnecter</a>.' : ''}</p></div></div>` : '';
  const kpis = `<div class="wq-kpis wq-kpis-3">
    ${tile('Total impayé', esc(formatAmount(data.total)), data.owing.length ? plural(data.owing.length, 'client doit', 'clients doivent') : 'aucun solde', '')}
    ${tile('En retard', esc(formatAmount(data.overdue)), data.overdue ? 'factures passées dues' : 'rien en retard', data.overdue ? 'down' : 'up')}
    ${tile('Dernière lecture', data.syncedAt ? esc(isoDateTime(data.syncedAt)) : '—', 'QuickBooks du cabinet, toutes les heures', '')}
  </div>`;
  const owing = data.owing.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Client</th><th scope="col">Type</th><th scope="col">Solde</th><th scope="col">En retard</th><th scope="col">Factures</th><th scope="col"><span class="sr-only">QuickBooks</span></th></tr></thead><tbody>
    ${data.owing.map((r) => `<tr><td><a class="link" href="/clients/${r.id}"><b>${esc(r.name)}</b></a></td><td>${esc(r.kind ? KIND_ONE[r.kind] : '—')}</td>
      <td class="num"><b>${esc(formatAmount(r.owed.balance))}</b></td>
      <td class="num">${r.owed.overdue ? `<span class="wq-late">${esc(formatAmount(r.owed.overdue))}</span>${r.owed.oldestDue ? `<span class="t-meta">depuis le ${esc(dayFr(r.owed.oldestDue))}</span>` : ''}` : '<span class="t-meta">—</span>'}</td>
      <td class="num">${r.owed.invoices}</td><td><a class="qbo-link" href="${qboCust(r.owed.customerId)}" target="_blank" rel="noopener">Voir dans QuickBooks <span aria-hidden="true">↗</span><span class="sr-only">(nouvel onglet)</span></a></td></tr>`).join('')}
    </tbody></table></div>` : '<p class="t-meta">Aucun client ne doit d’argent à BVY.</p>';
  const unlinked = data.unlinked.length ? `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Soldes non liés à un dossier BVY</h2></div>
    <p class="t-meta">Clients du QuickBooks de BVY sans dossier correspondant au portail (nom différent). Reliez-les dans le dossier du client, onglet « Échéances ».</p>
    <div class="table-wrap mt-4"><table class="table"><thead><tr><th scope="col">Client dans QuickBooks</th><th scope="col">Solde</th><th scope="col">En retard</th></tr></thead><tbody>
    ${data.unlinked.map((r) => `<tr><td>${esc(r.customer_name || r.customer_id)}</td><td class="num">${esc(formatAmount(r.balance_cents))}</td><td class="num">${r.overdue_cents ? `<span class="wq-late">${esc(formatAmount(r.overdue_cents))}</span>` : '<span class="t-meta">—</span>'}</td></tr>`).join('')}
    </tbody></table></div></article>` : '';
  const body = `${pageHead('Facturation', 'Qui doit quoi à BVY', 'Les factures de BVY à ses clients, lues dans le QuickBooks du cabinet. Pour relancer ou encaisser, ouvrez le client dans QuickBooks.')}
    ${intro}${kpis}
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Clients qui doivent</h2></div>${owing}</article>${unlinked}
    ${data.notFound.length && data.firm ? `<p class="t-meta mt-4">Sans correspondance dans le QuickBooks de BVY : ${data.notFound.map((r) => `<a class="link" href="/clients/${r.id}/echeances">${esc(r.name)}</a>`).join(', ')}.</p>` : ''}`;
  return appPage(s, { title: 'Facturation', current: '/facturation', body, flash });
}

/* --------------------------------------------- onglet « Échéances » d'un client */
function staffDeadlines(s, { client, deadlines, customers = [], owed = null, firmConnected = false, shell, base = `/clients/${client.id}`, firm = false }) {
  const csrf = csrfField(s);
  const k = client.kind || '';
  const opt = (v, l, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const list = deadlines.filter((d) => d.date <= horizon);
  const profile = `<article class="card"><div class="card-head"><h2 class="t-h3">Profil fiscal</h2></div>
    <p class="t-meta">${firm ? 'Les obligations de BVY elle-même, calculées comme pour un client.' : 'Ces quelques réponses suffisent à calculer les échéances du client.'}</p>
    <form class="form mt-4" method="post" action="${base}/profil">${csrf}
      ${firm ? '<p><b>BVY Accounting &amp; Tax Services Inc.</b> — société</p>' : field('kind', 'Type de client', `<select class="input" id="kind" name="kind" required><option value="">— Choisir —</option>${Object.entries(KIND_ONE).map(([v, l]) => opt(v, l, k)).join('')}</select>`)}
      ${field('yearEndMonth', 'Fin d’exercice (société)', `<select class="input" id="yearEndMonth" name="yearEndMonth">${MONTHS.map((mo, i) => opt(i + 1, `Dernier jour de ${mo}`, client.year_end_month || 12)).join('')}</select>`)}
      ${field('gstFreq', 'Déclarations TPS/TVQ', `<select class="input" id="gstFreq" name="gstFreq">${Object.entries(GST_FREQ).map(([v, l]) => opt(v, l, client.gst_freq || 'none')).join('')}</select>`)}
      <div class="field"><label class="check"><input type="checkbox" name="payroll" value="1"${client.payroll ? ' checked' : ''}> A des employés (retenues à la source, T4 et RL-1, CNESST)</label></div>
      <div class="field"><label class="check"><input type="checkbox" name="installments" value="1"${client.installments ? ' checked' : ''}> Doit verser des acomptes provisionnels</label></div>
      ${firmConnected && !firm ? field('billingCustomerId', 'Client correspondant dans le QuickBooks de BVY', `<select class="input" id="billingCustomerId" name="billingCustomerId"><option value="">Automatique (même nom)${owed && owed.matched === 'name' ? ' — trouvé' : ''}</option>${customers.map((c) => opt(c.customer_id, c.name, client.billing_customer_id || '')).join('')}</select>`) : ''}
      <p class="t-meta">Particuliers et travailleurs autonomes : année civile. TPS/TVQ et paie ne s’appliquent pas aux particuliers.</p>
      <div class="btn-row"><button class="btn btn-plum" type="submit">Enregistrer le profil</button></div></form></article>`;
  const addForm = `<article class="card"><div class="card-head"><h2 class="t-h3">Ajouter une échéance</h2></div>
    <p class="t-meta">Pour ce que le calcul ne couvre pas : avis de cotisation, demande de documents, rendez-vous, etc.</p>
    <form class="form mt-4" method="post" action="${base}/echeances">${csrf}
      ${field('d-title', 'Échéance', '<input class="input" id="d-title" name="title" required maxlength="160" placeholder="Ex. : Répondre à la lettre de Revenu Québec">')}
      ${field('d-date', 'Date', `<input class="input" id="d-date" name="date" type="date" required min="${today}">`)}
      <div class="btn-row"><button class="btn btn-outline" type="submit">Ajouter</button></div></form></article>`;
  const markBtn = (d, status, label, cls = 'btn-ghost') => `<form class="inline-form" method="post" action="${base}/echeances/marquer">${csrf}<input type="hidden" name="key" value="${esc(d.key)}"><input type="hidden" name="status" value="${status}"><button class="btn ${cls} btn-sm" type="submit">${label}</button></form>`;
  const rows = list.map((d) => `<tr${d.mark ? ' class="task-done"' : ''}><td class="nowrap">${esc(dayFr(d.date))}</td>
    <td>${esc(d.title)}${d.custom ? ' <span class="badge b-neutral">Ajoutée</span>' : ''}</td>
    <td>${d.mark === 'done' ? '<span class="badge b-good">Fait</span>' : d.mark === 'na' ? '<span class="badge b-neutral">Ne s’applique pas</span>' : `<span class="badge ${URG[d.urgency.level]}">${esc(d.urgency.label)}</span>`}</td>
    <td class="wq-actions">${d.mark ? markBtn(d, 'open', 'Rétablir') : `${markBtn(d, 'done', 'Fait', 'btn-outline')}${d.custom ? '' : markBtn(d, 'na', 'Ne s’applique pas')}`}
      ${d.custom ? `<form class="inline-form" method="post" action="${base}/echeances/${d.id}/supprimer">${csrf}<button class="btn btn-ghost btn-sm" type="submit">Supprimer</button></form>` : ''}</td></tr>`).join('');
  const table = `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Échéances des 12 prochains mois</h2></div>
    ${!client.kind ? (firm ? '<p>Enregistrez le profil fiscal de BVY pour calculer ses obligations.</p>' : '<p>Choisissez le type de client dans le profil fiscal pour calculer ses échéances.</p>')
    : list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Date</th><th scope="col">Échéance</th><th scope="col">État</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="t-meta mt-4">Solde d’impôt d’une société : 2 mois après la fin d’exercice, 3 mois pour une SPCC admissible. Les dates qui tombent un samedi ou un dimanche sont reportées au lundi. Les jours fériés ne sont pas encore pris en compte : vérifiez les dates qui en sont proches.</p>`
      : '<p>Aucune échéance d’ici un an.</p>'}</article>`;
  return shell(`<div class="cols-2">${profile}${addForm}</div>${table}`);
}

/* ------------------------------------------------------- QuickBooks du cabinet */
function firmPage(s, { qbo, enabled, deadlinesHtml, flash }) {
  const csrf = csrfField(s);
  const connected = qbo && qbo.status === 'connected';
  const status = !enabled ? '<p>La connexion QuickBooks n’est pas configurée sur ce serveur.</p>'
    : !qbo ? `<p>Le portail lira, en lecture seule, les factures que BVY envoie à ses clients (page « Facturation »).</p>
      <p class="t-meta mt-4">Sur l’écran d’Intuit, choisissez l’entreprise de BVY (votre cabinet), pas celle d’un client.</p>
      <form class="mt-4" method="post" action="/cabinet/quickbooks/connecter">${csrf}<button class="btn btn-plum" type="submit">Relier le QuickBooks du cabinet</button></form>`
      : `<p><span class="badge ${connected ? (qbo.lastSyncStatus === 'failed' ? 'b-watch' : 'b-good') : 'b-act'}">${connected ? (qbo.lastSyncStatus === 'failed' ? 'Synchronisation en échec' : 'Connecté') : 'Déconnecté'}</span>
        ${qbo.companyName ? ` <b>${esc(qbo.companyName)}</b>` : ''}</p>
      ${qbo.lastSyncAt ? `<p class="t-meta mt-4">Dernière lecture : ${esc(isoDateTime(qbo.lastSyncAt))}</p>` : ''}
      ${qbo.lastError ? `<p class="t-meta">${esc(qbo.lastError)}</p>` : ''}
      <div class="btn-row mt-4">${connected ? `<form method="post" action="/cabinet/quickbooks/synchroniser">${csrf}<button class="btn btn-plum btn-sm" type="submit">Lire maintenant</button></form>` : `<form method="post" action="/cabinet/quickbooks/connecter">${csrf}<button class="btn btn-plum btn-sm" type="submit">Reconnecter</button></form>`}
        <a class="btn btn-outline btn-sm" href="/facturation">Voir la facturation</a>
        <form method="post" action="/cabinet/quickbooks/deconnecter">${csrf}<button class="btn btn-ghost btn-sm" type="submit">Déconnecter</button></form></div>`;
  const body = `${pageHead('Administration', 'QBO du cabinet', 'Le QuickBooks de BVY (lecture seule) et les obligations fiscales de BVY elle-même.')}
    <nav class="subnav" aria-label="Administration"><a href="/admin">Personnes et clients</a><a href="/cabinet" aria-current="page">QBO du cabinet</a><a href="/admin/ia">IA</a></nav>
    <div class="cols-2"><article class="card"><div class="card-head"><h2 class="t-h3">QuickBooks de BVY</h2></div>${status}</article>
    <article class="card"><div class="card-head"><h2 class="t-h3">Bon à savoir</h2></div><p>Réservé à l’administrateur. Cette fiche n’apparaît jamais comme un client et n’est visible d’aucun client.</p>
      <p class="mt-4">Le portail ne modifie rien dans QuickBooks.</p></article></div>
    <h2 class="t-h2 mt-6" id="obligations">Obligations de BVY</h2>
    ${deadlinesHtml}`;
  return appPage(s, { title: 'QBO du cabinet', current: '/admin', body, flash });
}

// Carte « QBO du cabinet » de la page Administration
function firmCard(s, { qbo, deadlines }) {
  const connected = qbo && qbo.status === 'connected';
  const next = deadlines.filter((d) => !d.mark).slice(0, 4);
  return `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">QBO du cabinet</h2><a class="link" href="/cabinet">Gérer</a></div>
    <p>${!qbo ? '<span class="badge b-neutral">Non relié</span>' : connected ? '<span class="badge b-good">Connecté</span>' : '<span class="badge b-act">Déconnecté</span>'}${qbo && qbo.companyName ? ` <b>${esc(qbo.companyName)}</b>` : ''}</p>
    <h3 class="t-label mt-4">Prochaines obligations de BVY</h3>
    ${next.length ? `<ul class="wq-list">${next.map((d) => `<li><span class="wq-due ${d.urgency.level}"><b>${esc(shortDate(d.date))}</b><span>${esc(d.urgency.level === 'late' ? `en retard ${-d.urgency.days} j` : `dans ${d.urgency.days} j`)}</span></span><span>${esc(d.title)}</span></li>`).join('')}</ul>`
    : `<p class="t-meta">${deadlines.length ? 'Tout est fait.' : 'Remplissez le profil fiscal de BVY pour voir ses obligations.'} <a class="link" href="/cabinet#obligations">Ouvrir</a></p>`}
  </article>`;
}

module.exports = { staffDashboard, staffDeadlines, firmPage, firmCard, billingPage };
