'use strict';

/**
 * Écrans des déclarations de TPS/TVQ (workflow 13).
 */

const { esc, appPage, pageHead, field, icon, csrfField } = require('./views.js');
const { formatAmount } = require('./portal.js');
const { isoDateTime } = require('./dates.js');
const { STATES, CHECKLIST } = require('./salestax.js');

const BADGE = { books: 'b-act', validation: 'b-info', calc: 'b-info', review: 'b-watch', approval: 'b-watch', filed: 'b-good' };
const NEXT = { books: 'Terminer la tenue de livres de la période', validation: 'Faire la validation comptable', calc: 'Inscrire les montants du rapport de taxes de QuickBooks',
  review: 'Réviser les montants', approval: 'Le client doit approuver ; ensuite, produire', filed: '—' };
const badge = (st) => `<span class="badge ${BADGE[st]}">${esc(STATES[st])}</span>`;
const money = (c) => esc(formatAmount(c || 0));
const qbo = (url) => `<a class="qbo-link" href="${esc(url)}" target="_blank" rel="noopener">Ouvrir les taxes dans QuickBooks <span aria-hidden="true">↗</span><span class="sr-only">(nouvel onglet)</span></a>`;
const signed = (c, pay, refund) => (c >= 0 ? `${money(c)} <span class="t-meta">${pay}</span>` : `${money(-c)} <span class="t-meta">${refund}</span>`);

function amountsBlock(r, { forClient = false } = {}) {
  const t = r.totals;
  if (!t) return '';
  return `<dl class="pay-sum">
      <div><dt>TPS — ${t.netGst >= 0 ? 'à payer à l’ARC' : 'remboursement de l’ARC'}</dt><dd>${money(Math.abs(t.netGst))}</dd><span>perçue ${money(r.gst_cents)} − crédits (CTI) ${money(r.itc_cents)}</span></div>
      <div><dt>TVQ — ${t.netQst >= 0 ? 'à payer à Revenu Québec' : 'remboursement de Revenu Québec'}</dt><dd>${money(Math.abs(t.netQst))}</dd><span>perçue ${money(r.qst_cents)} − remboursements (RTI) ${money(r.itr_cents)}</span></div>
      <div class="pay-remit"><dt>${t.net >= 0 ? `Total à payer d’ici le ${esc(r.due_date)}` : 'Total remboursé'}</dt><dd>${money(Math.abs(t.net))}</dd><span>${forClient ? 'TPS et TVQ ensemble' : `ventes taxables ${money(r.sales_cents)}`}</span></div>
    </dl>
    ${!forClient && t.checks.length ? `<div class="alert alert-watch mt-4">${icon('i-alert')}<div><p class="alert-title">À vérifier</p>${t.checks.map((c) => `<p>${esc(c)}</p>`).join('')}</div></div>` : ''}`;
}

/* ----------------------------------------------- équipe : menu « TPS/TVQ » */
function taxBoard(s, { board, flash }) {
  const open = board.rows.filter((r) => r.status !== 'filed');
  const tile = (label, value, line, tone = '') => `<div class="cd-kpi"><small>${esc(label)}</small><b>${value}</b><em class="${tone}">${line}</em></div>`;
  const kpis = `<div class="wq-kpis wq-kpis-3">
    ${tile('Déclarations en cours', String(open.length), open.length ? 'jusqu’à la production' : 'aucune en cours')}
    ${tile('Bloquées par la tenue de livres', String(open.filter((r) => r.blocked).length), 'tenue de livres pas « À jour »', open.some((r) => r.blocked) ? 'down' : 'up')}
    ${tile('En retard', String(open.filter((r) => r.late).length), 'date limite dépassée', open.some((r) => r.late) ? 'down' : 'up')}
  </div>`;
  const table = (rows) => `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Client</th><th scope="col">Période</th><th scope="col">Date limite</th><th scope="col">Prochaine étape</th><th scope="col">Montant net</th><th scope="col"><span class="sr-only">Ouvrir</span></th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><a class="link" href="/clients/${r.client_id}/tps-tvq"><b>${esc(r.client_name)}</b></a></td><td>${esc(r.period ? r.period.label : r.deadline_key)}</td>
      <td class="nowrap">${r.late ? `<span class="wq-due late"><b>${esc(r.due_date)}</b><span>en retard</span></span>` : esc(r.due_date)}</td>
      <td>${r.blocked ? '<span class="wq-late">Bloquée : tenue de livres pas à jour</span>' : esc(r.status === 'approval' && r.client_approved ? 'Approuvée : produire la déclaration' : NEXT[r.status])}</td>
      <td class="num">${r.totals ? signed(r.totals.net, 'à payer', 'remboursement') : '<span class="t-meta">—</span>'}</td>
      <td><a class="btn btn-outline btn-sm" href="/tps-tvq/${r.id}">Ouvrir</a></td></tr>`).join('')}</tbody></table></div>`;
  const sections = board.groups.filter((g) => g.rows.length).map((g) => `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">${esc(g.label)}</h2><span class="t-meta">${g.rows.length}</span></div>${table(g.rows)}</article>`).join('');
  const body = `${pageHead('TPS/TVQ', 'Les déclarations de vos clients', 'Tenue de livres à jour → validation → calcul → révision → approbation du client → produite. Une déclaration n’avance jamais tant que la tenue de livres n’est pas à jour.')}
    ${kpis}${sections || `<article class="card mt-6"><div class="empty">${icon('i-clip', 'i empty-ico')}<p><b>Aucune déclaration pour l’instant.</b></p><p>Elles se créent toutes seules à la fin de chaque période, pour les clients inscrits à la TPS/TVQ (profil fiscal, onglet « Échéances »).</p></div></article>`}`;
  return appPage(s, { title: 'TPS/TVQ', current: '/tps-tvq', body, flash });
}

/* ---------------------------------- équipe : onglet « TPS/TVQ » d'un client */
function clientTaxTab(s, { client, returns, shell }) {
  if (!client.gst_freq || client.gst_freq === 'none' || client.kind === 'particulier') {
    return shell(`<article class="card"><p>Ce client n’est pas inscrit à la TPS/TVQ selon son profil fiscal. Indiquez sa fréquence de déclaration dans l’onglet <a class="link" href="/clients/${client.id}/echeances">Échéances</a>.</p></article>`);
  }
  return shell(`<article class="card"><div class="card-head"><h2 class="t-h3">Déclarations de TPS/TVQ</h2>${qbo('https://app.qbo.intuit.com/app/salestax')}</div>
    <p>Tenue de livres : ${client.books_status === 'done' ? '<span class="badge b-good">À jour</span>' : client.books_status === 'progress' ? '<span class="badge b-watch">En cours</span> — les déclarations attendent qu’elle soit à jour' : '<span class="badge b-act">Pas encore traitée</span> — les déclarations attendent qu’elle soit à jour'}</p>
    ${returns.length ? `<div class="table-wrap mt-4"><table class="table"><thead><tr><th scope="col">Période</th><th scope="col">Date limite</th><th scope="col">État</th><th scope="col">Net</th><th scope="col">Confirmation</th><th scope="col"><span class="sr-only">Ouvrir</span></th></tr></thead><tbody>
      ${returns.map((r) => `<tr><td>${esc(r.period ? r.period.label : r.deadline_key)}</td><td>${esc(r.due_date)}</td><td>${badge(r.status)}</td><td class="num">${r.totals ? signed(r.totals.net, 'à payer', 'remb.') : '—'}</td><td>${esc(r.confirmation || '')}</td><td><a class="link" href="/tps-tvq/${r.id}">Ouvrir</a></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="t-meta mt-4">Aucune déclaration encore : elles se créent à la fin de chaque période.</p>'}</article>`);
}

/* ------------------------------------------- fiche d'une déclaration (équipe) */
function taxReturnStaff(s, { r, client, period, events, booksReady, flash }) {
  const csrf = csrfField(s);
  const amt = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const step = (action, label, cls = 'btn-plum', extra = '') => `<form class="form" method="post" action="/tps-tvq/${r.id}/etape">${csrf}<input type="hidden" name="action" value="${action}">${extra}<div class="btn-row"><button class="btn ${cls} btn-sm" type="submit">${esc(label)}</button></div></form>`;
  let work = '';
  if (r.status === 'books') {
    work = booksReady ? `<p>La tenue de livres est à jour : la déclaration peut passer à la validation comptable.</p>${step('books', 'Passer à la validation comptable')}`
      : `<div class="alert alert-act">${icon('i-alert')}<div><p class="alert-title">Bloquée : la tenue de livres n’est pas « À jour »</p><p>Terminez la tenue de livres de la période, puis mettez le client à « À jour » au tableau de bord.</p></div></div>`;
  } else if (r.status === 'validation') {
    work = step('validate', 'Validation terminée', 'btn-plum', `<fieldset class="pay-fs"><legend>Validation comptable de la période</legend>${CHECKLIST.map(([k, l]) => `<div class="field"><label class="check"><input type="checkbox" name="chk_${k}" value="1"> ${esc(l)}</label></div>`).join('')}</fieldset>`);
  } else if (['calc', 'review'].includes(r.status)) {
    const num = (k, label, v) => field(k, label, `<input class="input num" id="${k}" name="${k}" inputmode="decimal" required value="${esc(amt(v))}">`);
    work = `<form class="form" method="post" action="/tps-tvq/${r.id}/montants">${csrf}
      <p class="t-meta">Recopiez les lignes du rapport de TPS/TVQ de QuickBooks pour la période du ${esc(r.period_start)} au ${esc(r.period_end)}.</p>
      <div class="pay-grid">${num('sales', 'Ventes taxables ($)', r.sales_cents)}${num('gst', 'TPS perçue ($)', r.gst_cents)}${num('itc', 'Crédits de taxe sur les intrants — CTI ($)', r.itc_cents)}
      ${num('qst', 'TVQ perçue ($)', r.qst_cents)}${num('itr', 'Remboursements de la taxe sur les intrants — RTI ($)', r.itr_cents)}</div>
      <div class="btn-row"><button class="btn ${r.status === 'calc' ? 'btn-plum' : 'btn-outline'}" type="submit">${r.status === 'calc' ? 'Calculer et envoyer en révision' : 'Corriger les montants'}</button></div></form>
      ${r.status === 'review' ? `<div class="mt-6">${r.prepared_by === s.user.id ? '<p class="wq-late">Vous avez préparé cette déclaration : une révision par une autre personne est préférable.</p>' : ''}${step('reviewed', 'Révisée : demander l’approbation du client')}</div>` : ''}`;
  } else if (r.status === 'approval') {
    work = r.client_approved ? `<p><span class="badge b-good">Approuvée par le client</span></p>${step('filed', 'Déclaration produite', 'btn-plum', field('confirmation', 'Numéro de confirmation <span class="opt">(facultatif)</span>', '<input class="input" id="confirmation" name="confirmation" maxlength="60">'))}`
      : '<p class="t-meta">En attente de l’approbation du client.</p>';
  } else {
    work = `<p><span class="badge b-good">Produite</span> le ${esc(isoDateTime(r.filed_at))}${r.confirmation ? ` — confirmation <b>${esc(r.confirmation)}</b>` : ''}.</p>`;
  }
  const back = !['books', 'filed'].includes(r.status) ? `<details class="disclose mt-4"><summary>Revenir à l’étape précédente</summary><div>${step('back', 'Revenir en arrière', 'btn-ghost', field('note', 'Raison (obligatoire)', '<input class="input" id="note" name="note" maxlength="300" required>'))}</div></details>` : '';
  const body = `${pageHead(client.name, `TPS/TVQ — ${period ? period.label.toLowerCase() : ''}`, `Du ${r.period_start} au ${r.period_end} · date limite ${r.due_date}`)}
    <p>${badge(r.status)} ${qbo('https://app.qbo.intuit.com/app/salestax')}</p>
    ${r.client_comment && r.status === 'review' ? `<div class="alert alert-watch mt-4">${icon('i-alert')}<div><p class="alert-title">Le client a refusé les montants</p><p>${esc(r.client_comment)}</p></div></div>` : ''}
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">${esc(NEXT[r.status] === '—' ? 'Déclaration' : NEXT[r.status])}</h2></div>${work}${back}</article>
    ${r.totals ? `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Montants</h2></div>${amountsBlock(r)}</article>` : ''}
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Historique</h2></div>
      <ul class="pay-events">${events.map((e) => `<li><span class="t-meta">${esc(isoDateTime(e.at))}</span> ${e.from_status && e.from_status !== e.to_status ? `${esc(STATES[e.from_status])} → ` : ''}<b>${esc(STATES[e.to_status])}</b>${e.user_name ? ` · ${esc(e.user_name)}` : ''}${e.note ? ` — ${esc(e.note)}` : ''}</li>`).join('')}</ul></article>`;
  return appPage(s, { title: 'TPS/TVQ', current: '/tps-tvq', body, flash });
}

/* ------------------------------------------- fiche d'une déclaration (client) */
function taxReturnClient(s, { r, period, nav, flash }) {
  const csrf = csrfField(s);
  const waiting = r.status === 'approval' && !r.client_approved;
  const main = waiting ? `<article class="card"><div class="card-head"><h2 class="t-h3">Votre déclaration de TPS/TVQ</h2></div>
      <p>BVY a préparé votre déclaration pour la période du ${esc(r.period_start)} au ${esc(r.period_end)}. Vérifiez les montants, puis approuvez-la. Rien n’est produit sans votre accord.</p>
      ${amountsBlock(r, { forClient: true })}
      <form class="form mt-4" method="post" action="/tps-tvq/${r.id}/decision">${csrf}
        ${field('d-comment', 'Commentaire <span class="opt">(obligatoire si vous n’approuvez pas)</span>', '<textarea class="input" id="d-comment" name="comment" maxlength="1000"></textarea>')}
        <div class="btn-row"><button class="btn btn-plum" type="submit" name="decision" value="approve">J’approuve</button>
        <button class="btn btn-outline" type="submit" name="decision" value="reject">Je n’approuve pas</button></div></form></article>`
    : `<article class="card"><div class="card-head"><h2 class="t-h3">Votre déclaration de TPS/TVQ</h2></div>
      <p>${r.status === 'filed' ? `Produite par BVY${r.confirmation ? ` (confirmation ${esc(r.confirmation)})` : ''}.` : r.client_approved ? 'Merci, vous l’avez approuvée : BVY la produit.' : 'BVY prépare votre déclaration.'}</p>${amountsBlock(r, { forClient: true })}</article>`;
  const body = `${pageHead('TPS/TVQ', period ? period.label : 'Déclaration', `Date limite : ${r.due_date}`)}${main}`;
  return appPage(s, { title: 'TPS/TVQ', current: '/a-faire', body, flash, nav });
}

module.exports = { taxBoard, clientTaxTab, taxReturnStaff, taxReturnClient };
