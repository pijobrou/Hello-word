'use strict';

/**
 * Écrans du tableau de bord de l'équipe (workflow 05) : vue d'ensemble par type de client, échéances d'un client,
 * QuickBooks du cabinet. Réservés à l'équipe BVY.
 */

const { esc, appPage, pageHead, field, icon, csrfField } = require('./views.js');
const { formatAmount } = require('./portal.js');
const { KIND_ONE, GST_FREQ, dayFr } = require('./deadlines.js');

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const URG = { late: 'b-act', week: 'b-watch', month: 'b-info', later: 'b-neutral' };
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function qboCell(q, n, id) {
  const badge = !q ? '<span class="t-meta">Non relié</span>'
    : q.status !== 'connected' ? '<span class="badge b-act">À reconnecter</span>'
      : q.lastSyncStatus === 'failed' ? '<span class="badge b-watch">Synchro en échec</span>'
        : '<span class="badge b-good">Connecté</span>';
  return `${badge}${n ? ` <a class="badge b-info" href="/clients/${id}/quickbooks">${plural(n, 'suggestion', 'suggestions')}</a>` : ''}`;
}

function nextCell(r) {
  if (!r.kind) return `<a class="link" href="/clients/${r.id}/echeances">Compléter le profil fiscal</a>`;
  if (!r.next) return '<span class="t-meta">Aucune échéance d’ici un an</span>';
  const d = r.next;
  return `<span class="badge ${URG[d.urgency.level]}">${esc(d.urgency.label)}</span>
    <span class="wq-date">${esc(dayFr(d.date))}</span><a class="wq-what" href="/clients/${r.id}/echeances">${esc(d.title)}</a>`;
}

function owedCell(r, firmConnected) {
  if (!firmConnected) return '<span class="t-meta">—</span>';
  const o = r.owed;
  if (!o) return '<span class="t-meta" title="Aucun client du même nom dans le QuickBooks du cabinet">Non trouvé</span>';
  if (!o.balance) return '<span class="t-meta">Rien</span>';
  return `<b class="num">${esc(formatAmount(o.balance))}</b>${o.overdue
    ? `<span class="wq-late">dont ${esc(formatAmount(o.overdue))} en retard${o.oldestDue ? ` depuis le ${esc(dayFr(o.oldestDue))}` : ''}</span>` : `<span class="t-meta">${plural(o.invoices, 'facture', 'factures')}, pas en retard</span>`}`;
}

function waitingCell(r) {
  const parts = [];
  if (r.unread) parts.push(`<a class="badge b-act" href="/clients/${r.id}/messages">${r.unread} non lu${r.unread > 1 ? 's' : ''}</a>`);
  if (r.waiting) parts.push(`<a class="badge b-watch" href="/clients/${r.id}/taches">${plural(r.waiting, 'demande sans réponse', 'demandes sans réponse')}</a>`);
  if (r.answered) parts.push(`<a class="badge b-info" href="/clients/${r.id}/taches">${plural(r.answered, 'réponse à traiter', 'réponses à traiter')}</a>`);
  return parts.length ? parts.join(' ') : '<span class="t-meta">Rien</span>';
}

function groupTable(g, firmConnected) {
  if (!g.rows.length) return `<p class="t-meta">Aucun client de ce type pour l’instant.</p>`;
  return `<div class="table-wrap"><table class="table wq-table"><thead><tr>
    <th scope="col">Client</th><th scope="col">Prochaine échéance</th><th scope="col">Doit à BVY</th><th scope="col">En attente</th><th scope="col">QuickBooks</th></tr></thead><tbody>
    ${g.rows.map((r) => `<tr><th scope="row"><a class="link" href="/clients/${r.id}"><b>${esc(r.name)}</b></a></th>
      <td class="wq-next">${nextCell(r)}</td><td class="wq-owed">${owedCell(r, firmConnected)}</td><td>${waitingCell(r)}</td><td>${qboCell(r.qbo, r.suggestions, r.id)}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function staffDashboard(s, { data, flash }) {
  const u = s.user;
  const first = esc(u.name.split(' ')[0]);
  const { summary: m, groups, unset, firm } = data;
  const firmConnected = Boolean(firm && firm.qbo && firm.qbo.status === 'connected');
  const mfaWarn = !u.totp_enabled
    ? `<div class="alert alert-watch">${icon('i-eye')}<div><p class="alert-title">Protégez mieux votre accès</p><p>Vous voyez des dossiers de clients : activez une application d’authentification.</p><div class="btn-row"><a class="btn btn-plum btn-sm" href="/compte#application">Activer maintenant</a></div></div></div>` : '';
  const firmNote = firmConnected ? (firm.qbo.lastSyncStatus === 'failed'
    ? `<div class="alert alert-watch">${icon('i-alert')}<div><p class="alert-title">Les factures de BVY ne sont plus à jour</p><p>La dernière lecture du QuickBooks du cabinet a échoué.${u.role === 'admin' ? ' <a class="link" href="/cabinet">Voir le détail</a>.' : ''}</p></div></div>` : '')
    : u.role === 'admin'
      ? `<div class="alert alert-info">${icon('i-info')}<div><p class="alert-title">Reliez le QuickBooks du cabinet</p><p>Pour voir ce que chaque client doit à BVY, le portail lit vos factures dans le QuickBooks de BVY (lecture seule).</p><div class="btn-row"><a class="btn btn-plum btn-sm" href="/cabinet">Relier le QuickBooks du cabinet</a></div></div></div>`
      : '';
  const tile = (label, value, line, tone = '', href = '') => {
    const inner = `<small>${esc(label)}</small><b>${value}</b><em class="${tone}">${line}</em>`;
    return href ? `<a class="cd-kpi" href="${href}">${inner}</a>` : `<div class="cd-kpi">${inner}</div>`;
  };
  const kpis = `<div class="wq-kpis">
    ${tile('Échéances en retard', String(m.late), m.late ? 'à régler en priorité' : 'aucune', m.late ? 'down' : 'up')}
    ${tile('Cette semaine', String(m.week), m.week ? plural(m.week, 'échéance', 'échéances') + ' dans 7 jours' : 'rien d’urgent', m.week ? 'down' : '')}
    ${tile('Impayé à BVY', firmConnected ? esc(formatAmount(m.owed)) : '—', firmConnected ? (m.owed ? `${plural(m.owedClients, 'client', 'clients')}${m.overdue ? ` · ${esc(formatAmount(m.overdue))} en retard` : ''}` : 'tout est payé') : 'QuickBooks du cabinet non relié', firmConnected && m.overdue ? 'down' : '', u.role === 'admin' ? '/cabinet' : '')}
    ${tile('En attente des clients', String(m.waiting), m.waiting ? plural(m.waiting, 'demande ouverte', 'demandes ouvertes') : 'aucune demande ouverte', '')}
    ${tile('QuickBooks à vérifier', String(m.qboIssues), m.qboIssues ? 'connexion ou synchronisation' : 'tout est synchronisé', m.qboIssues ? 'down' : 'up')}
  </div>`;
  const all = [...groups, ...(unset.length ? [{ kind: 'unset', label: 'Type à préciser', rows: unset }] : [])];
  const jump = `<nav class="subnav" aria-label="Types de clients">${all.map((g) => `<a href="#g-${g.kind}">${esc(g.label)} (${g.rows.length})</a>`).join('')}</nav>`;
  const sections = all.map((g) => `<article class="card mt-6" id="g-${g.kind}"><div class="card-head"><h2 class="t-h3">${esc(g.label)}</h2><span class="t-meta">${plural(g.rows.length, 'client', 'clients')}</span></div>
    ${g.kind === 'unset' ? `<p class="t-meta">Indiquez le type de ces clients (onglet « Échéances » de leur dossier) pour calculer leurs échéances.</p>` : ''}
    ${groupTable(g, firmConnected)}</article>`).join('');
  const body = `${pageHead('Tableau de bord', `Bonjour ${first}.`, `${plural(data.total, 'client', 'clients')} dans votre périmètre, regroupés par type. Les échéances sont calculées à partir du profil fiscal de chaque client.`)}
    ${mfaWarn}${firmNote}${kpis}${jump}${sections}`;
  return appPage(s, { title: 'Tableau de bord', current: '/accueil', body, flash });
}

/* --------------------------------------------- onglet « Échéances » d'un client */
function staffDeadlines(s, { client, deadlines, customers, owed, firmConnected, shell }) {
  const csrf = csrfField(s);
  const k = client.kind || '';
  const opt = (v, l, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
  const list = deadlines.filter((d) => d.date <= horizon);
  const profile = `<article class="card"><div class="card-head"><h2 class="t-h3">Profil fiscal</h2></div>
    <p class="t-meta">Ces quelques réponses suffisent à calculer les échéances du client.</p>
    <form class="form mt-4" method="post" action="/clients/${client.id}/profil">${csrf}
      ${field('kind', 'Type de client', `<select class="input" id="kind" name="kind" required><option value="">— Choisir —</option>${Object.entries(KIND_ONE).map(([v, l]) => opt(v, l, k)).join('')}</select>`)}
      ${field('yearEndMonth', 'Fin d’exercice (société)', `<select class="input" id="yearEndMonth" name="yearEndMonth">${MONTHS.map((mo, i) => opt(i + 1, `Dernier jour de ${mo}`, client.year_end_month || 12)).join('')}</select>`)}
      ${field('gstFreq', 'Déclarations TPS/TVQ', `<select class="input" id="gstFreq" name="gstFreq">${Object.entries(GST_FREQ).map(([v, l]) => opt(v, l, client.gst_freq || 'none')).join('')}</select>`)}
      <div class="field"><label class="check"><input type="checkbox" name="payroll" value="1"${client.payroll ? ' checked' : ''}> A des employés (retenues à la source, T4 et RL-1, CNESST)</label></div>
      <div class="field"><label class="check"><input type="checkbox" name="installments" value="1"${client.installments ? ' checked' : ''}> Doit verser des acomptes provisionnels</label></div>
      ${firmConnected ? field('billingCustomerId', 'Client correspondant dans le QuickBooks de BVY', `<select class="input" id="billingCustomerId" name="billingCustomerId"><option value="">Automatique (même nom)${owed && owed.matched === 'name' ? ' — trouvé' : ''}</option>${customers.map((c) => opt(c.customer_id, c.name, client.billing_customer_id || '')).join('')}</select>`) : ''}
      <p class="t-meta">Particuliers et travailleurs autonomes : année civile. TPS/TVQ et paie ne s’appliquent pas aux particuliers.</p>
      <div class="btn-row"><button class="btn btn-plum" type="submit">Enregistrer le profil</button></div></form></article>`;
  const addForm = `<article class="card"><div class="card-head"><h2 class="t-h3">Ajouter une échéance</h2></div>
    <p class="t-meta">Pour ce que le calcul ne couvre pas : avis de cotisation, demande de documents, rendez-vous, etc.</p>
    <form class="form mt-4" method="post" action="/clients/${client.id}/echeances">${csrf}
      ${field('d-title', 'Échéance', '<input class="input" id="d-title" name="title" required maxlength="160" placeholder="Ex. : Répondre à la lettre de Revenu Québec">')}
      ${field('d-date', 'Date', `<input class="input" id="d-date" name="date" type="date" required min="${today}">`)}
      <div class="btn-row"><button class="btn btn-outline" type="submit">Ajouter</button></div></form></article>`;
  const markBtn = (d, status, label, cls = 'btn-ghost') => `<form class="inline-form" method="post" action="/clients/${client.id}/echeances/marquer">${csrf}<input type="hidden" name="key" value="${esc(d.key)}"><input type="hidden" name="status" value="${status}"><button class="btn ${cls} btn-sm" type="submit">${label}</button></form>`;
  const rows = list.map((d) => `<tr${d.mark ? ' class="task-done"' : ''}><td class="nowrap">${esc(dayFr(d.date))}</td>
    <td>${esc(d.title)}${d.custom ? ' <span class="badge b-neutral">Ajoutée</span>' : ''}</td>
    <td>${d.mark === 'done' ? '<span class="badge b-good">Fait</span>' : d.mark === 'na' ? '<span class="badge b-neutral">Ne s’applique pas</span>' : `<span class="badge ${URG[d.urgency.level]}">${esc(d.urgency.label)}</span>`}</td>
    <td class="wq-actions">${d.mark ? markBtn(d, 'open', 'Rétablir') : `${markBtn(d, 'done', 'Fait', 'btn-outline')}${d.custom ? '' : markBtn(d, 'na', 'Ne s’applique pas')}`}
      ${d.custom ? `<form class="inline-form" method="post" action="/clients/${client.id}/echeances/${d.id}/supprimer">${csrf}<button class="btn btn-ghost btn-sm" type="submit">Supprimer</button></form>` : ''}</td></tr>`).join('');
  const table = `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Échéances des 12 prochains mois</h2></div>
    ${!client.kind ? '<p>Choisissez le type de client dans le profil fiscal pour calculer ses échéances.</p>'
    : list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Date</th><th scope="col">Échéance</th><th scope="col">État</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="t-meta mt-4">Solde d’impôt d’une société : 2 mois après la fin d’exercice, 3 mois pour une SPCC admissible. Les dates qui tombent un samedi ou un dimanche sont reportées au lundi. Les jours fériés ne sont pas encore pris en compte : vérifiez les dates qui en sont proches.</p>`
      : '<p>Aucune échéance d’ici un an.</p>'}</article>`;
  return shell(`<div class="cols-2">${profile}${addForm}</div>${table}`);
}

/* ------------------------------------------------------- QuickBooks du cabinet */
function firmPage(s, { qbo, enabled, receivables, links, flash }) {
  const csrf = csrfField(s);
  const connected = qbo && qbo.status === 'connected';
  const status = !enabled ? '<p>La connexion QuickBooks n’est pas configurée sur ce serveur.</p>'
    : !qbo ? `<p>Le portail lira, en lecture seule, les factures que BVY envoie à ses clients, pour montrer qui doit quoi au tableau de bord.</p>
      <p class="t-meta mt-4">Sur l’écran d’Intuit, choisissez l’entreprise de BVY (votre cabinet), pas celle d’un client.</p>
      <form class="mt-4" method="post" action="/cabinet/quickbooks/connecter">${csrf}<button class="btn btn-plum" type="submit">Relier le QuickBooks du cabinet</button></form>`
      : `<p><span class="badge ${connected ? (qbo.lastSyncStatus === 'failed' ? 'b-watch' : 'b-good') : 'b-act'}">${connected ? (qbo.lastSyncStatus === 'failed' ? 'Synchronisation en échec' : 'Connecté') : 'Reconnexion nécessaire'}</span>
        ${qbo.companyName ? ` <b>${esc(qbo.companyName)}</b>` : ''}</p>
      ${qbo.lastSyncAt ? `<p class="t-meta mt-4">Dernière lecture : ${esc(new Intl.DateTimeFormat('fr-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Toronto' }).format(new Date(qbo.lastSyncAt)))}</p>` : ''}
      ${qbo.lastError ? `<p class="t-meta">${esc(qbo.lastError)}</p>` : ''}
      <div class="btn-row mt-4">${connected ? `<form method="post" action="/cabinet/quickbooks/synchroniser">${csrf}<button class="btn btn-plum btn-sm" type="submit">Lire maintenant</button></form>` : `<form method="post" action="/cabinet/quickbooks/connecter">${csrf}<button class="btn btn-plum btn-sm" type="submit">Reconnecter</button></form>`}
        <form method="post" action="/cabinet/quickbooks/deconnecter">${csrf}<button class="btn btn-ghost btn-sm" type="submit">Déconnecter</button></form></div>`;
  const total = receivables.reduce((a, r) => a + r.balance_cents, 0);
  const table = receivables.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Client dans QuickBooks</th><th scope="col">Solde</th><th scope="col">En retard</th><th scope="col">Client BVY</th></tr></thead><tbody>
    ${receivables.map((r) => { const l = links.get(r.customer_id); return `<tr><td>${esc(r.customer_name || r.customer_id)}</td><td class="num">${esc(formatAmount(r.balance_cents))}</td>
      <td class="num">${r.overdue_cents ? `<span class="wq-late">${esc(formatAmount(r.overdue_cents))}</span>${r.oldest_due ? `<br><span class="t-meta">depuis le ${esc(dayFr(r.oldest_due))}</span>` : ''}` : '<span class="t-meta">—</span>'}</td>
      <td>${l ? `<a class="link" href="/clients/${l.id}/echeances">${esc(l.name)}</a>` : '<span class="t-meta">Non lié</span>'}</td></tr>`; }).join('')}
    </tbody></table></div><p class="t-meta mt-4">Total impayé : <b>${esc(formatAmount(total))}</b>. Un client « Non lié » se relie dans son dossier, onglet « Échéances ».</p>`
    : `<p class="t-meta">${connected ? 'Aucune facture impayée.' : 'Aucune donnée pour l’instant.'}</p>`;
  const body = `${pageHead('Administration', 'QuickBooks du cabinet', 'Les factures de BVY à ses clients, lues dans le QuickBooks de BVY (lecture seule, toutes les heures).')}
    <div class="cols-2"><article class="card"><div class="card-head"><h2 class="t-h3">Connexion</h2></div>${status}</article>
    <article class="card"><div class="card-head"><h2 class="t-h3">Bon à savoir</h2></div><p>Réservé à l’administrateur. Cette connexion n’apparaît jamais comme un client et n’est visible d’aucun client.</p>
      <p class="mt-4">Le portail ne modifie rien dans QuickBooks : pour relancer un client, ouvrez la facture dans QuickBooks.</p></article></div>
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Factures impayées par client</h2></div>${table}</article>`;
  return appPage(s, { title: 'QuickBooks du cabinet', current: '/admin', body, flash });
}

module.exports = { staffDashboard, staffDeadlines, firmPage };
