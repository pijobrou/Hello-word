'use strict';

/**
 * Écrans des dossiers d'impôt sur le revenu (workflow 14).
 */

const { esc, appPage, pageHead, field, icon, csrfField } = require('./views.js');
const { formatAmount } = require('./portal.js');
const { isoDateTime } = require('./dates.js');
const { STATES, CLOSING, FIGS } = require('./incometax.js');

const BADGE = { docs: 'b-watch', books: 'b-act', closing: 'b-info', prep: 'b-info', review: 'b-watch', approval: 'b-watch', filed: 'b-good' };
const NEXT = { docs: 'Recevoir les documents du client', books: 'Terminer la tenue de livres de l’année', closing: 'Faire la fermeture d’exercice',
  prep: 'Préparer les déclarations et inscrire les montants', review: 'Réviser les déclarations', approval: 'Le client doit approuver ; ensuite, produire', filed: '—' };
const badge = (st) => `<span class="badge ${BADGE[st]}">${esc(STATES[st])}</span>`;
const money = (c) => esc(formatAmount(c || 0));
const DOC_STATE = { pending: '<span class="badge b-watch">À envoyer</span>', received: '<span class="badge b-good">Reçu</span>', na: '<span class="badge b-neutral">Ne s’applique pas</span>' };

function balanceBlock(f, { forClient = false } = {}) {
  if (f.balance === null) return '';
  const g = f.figures; const pay = f.balance >= 0;
  return `<dl class="pay-sum">
    ${(FIGS[f.form] || []).filter(([k]) => !['fedTax', 'qcTax', 'paid'].includes(k)).map(([k, l]) => `<div><dt>${esc(l)}</dt><dd>${money(g[k])}</dd></div>`).join('')}
    <div><dt>Impôt fédéral</dt><dd>${money(g.fedTax)}</dd></div><div><dt>Impôt du Québec</dt><dd>${money(g.qcTax)}</dd></div>
    <div class="pay-remit"><dt>${pay ? `Solde à payer${f.pay_due ? ` d’ici le ${esc(f.pay_due)}` : ''}` : 'Remboursement prévu'}</dt><dd>${money(Math.abs(f.balance))}</dd><span>impôts ${money((g.fedTax || 0) + (g.qcTax || 0))} − déjà payé ${money(g.paid)}</span></div>
  </dl>${forClient ? '' : ''}`;
}

/* ----------------------------------------------------- équipe : « Impôts » */
function itBoard(s, { board, flash }) {
  const open = board.rows.filter((r) => r.status !== 'filed');
  const tile = (label, value, line, tone = '') => `<div class="cd-kpi"><small>${esc(label)}</small><b>${value}</b><em class="${tone}">${line}</em></div>`;
  const kpis = `<div class="wq-kpis wq-kpis-3">
    ${tile('Dossiers en cours', String(open.length), open.length ? 'jusqu’à la production' : 'aucun dossier en cours')}
    ${tile('Documents attendus', String(open.filter((r) => r.status === 'docs').length), 'clients qui doivent encore envoyer des documents', open.some((r) => r.status === 'docs') ? 'down' : '')}
    ${tile('Bloqués par la tenue de livres', String(open.filter((r) => r.blocked).length), 'tenue de livres pas « À jour »', open.some((r) => r.blocked) ? 'down' : 'up')}
  </div>`;
  const table = (rows) => `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Client</th><th scope="col">Dossier</th><th scope="col">Date limite</th><th scope="col">Prochaine étape</th><th scope="col">Solde</th><th scope="col"><span class="sr-only">Ouvrir</span></th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><a class="link" href="/clients/${r.client_id}/impots"><b>${esc(r.client_name)}</b></a></td><td>${esc(r.title)}</td>
      <td class="nowrap">${r.late ? `<span class="wq-due late"><b>${esc(r.due_date)}</b><span>en retard</span></span>` : esc(r.due_date)}</td>
      <td>${r.blocked ? '<span class="wq-late">Bloqué : tenue de livres pas à jour</span>' : r.status === 'docs' ? `${r.docsLeft} document${r.docsLeft > 1 ? 's' : ''} attendu${r.docsLeft > 1 ? 's' : ''}` : esc(r.status === 'approval' && r.client_approved ? 'Approuvé : produire les déclarations' : NEXT[r.status])}</td>
      <td class="num">${r.balance === null ? '<span class="t-meta">—</span>' : `${money(Math.abs(r.balance))} <span class="t-meta">${r.balance >= 0 ? 'à payer' : 'remboursement'}</span>`}</td>
      <td><a class="btn btn-outline btn-sm" href="/impots/${r.id}">Ouvrir</a></td></tr>`).join('')}</tbody></table></div>`;
  const sections = board.groups.filter((g) => g.rows.length).map((g) => `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">${esc(g.label)}</h2><span class="t-meta">${g.rows.length}</span></div>${table(g.rows)}</article>`).join('');
  const body = `${pageHead('Impôts', 'Les déclarations de revenus de vos clients', 'Sociétés : T2 et CO-17. Travailleurs autonomes et particuliers : T1 et TP-1 (avec T2125). Les dossiers se créent à la fin de chaque exercice ou année.')}
    ${kpis}${sections || `<article class="card mt-6"><div class="empty">${icon('i-clip', 'i empty-ico')}<p><b>Aucun dossier pour l’instant.</b></p><p>Ils se créent tout seuls à la fin de l’exercice d’une société, ou au 1er janvier pour les particuliers et travailleurs autonomes.</p></div></article>`}`;
  return appPage(s, { title: 'Impôts', current: '/impots', body, flash });
}

function clientItTab(s, { client, files, shell }) {
  return shell(`<article class="card"><div class="card-head"><h2 class="t-h3">Déclarations de revenus</h2></div>
    ${files.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Dossier</th><th scope="col">Date limite</th><th scope="col">État</th><th scope="col">Solde</th><th scope="col">Confirmations</th><th scope="col"><span class="sr-only">Ouvrir</span></th></tr></thead><tbody>
      ${files.map((f) => `<tr><td>${esc(f.title)}</td><td>${esc(f.due_date)}</td><td>${badge(f.status)}</td><td class="num">${f.balance === null ? '—' : `${money(Math.abs(f.balance))} ${f.balance >= 0 ? 'à payer' : 'remb.'}`}</td>
        <td>${esc([f.confirmation_fed, f.confirmation_qc].filter(Boolean).join(' · '))}</td><td><a class="link" href="/impots/${f.id}">Ouvrir</a></td></tr>`).join('')}</tbody></table></div>`
    : `<p class="t-meta">Aucun dossier encore. ${client.kind ? 'Il se créera à la fin de l’exercice ou de l’année.' : 'Indiquez d’abord le type de client dans l’onglet Échéances.'}</p>`}</article>`);
}

/* ------------------------------------------------ fiche d'un dossier (équipe) */
function itFileStaff(s, { f, client, events, booksReady, flash }) {
  const csrf = csrfField(s);
  const amt = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const step = (action, label, cls = 'btn-plum', extra = '') => `<form class="form" method="post" action="/impots/${f.id}/etape">${csrf}<input type="hidden" name="action" value="${action}">${extra}<div class="btn-row"><button class="btn ${cls} btn-sm" type="submit">${esc(label)}</button></div></form>`;
  const docsList = f.form === 't1' ? `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Documents du client</h2><span class="t-meta">${f.docs.filter((x) => x.status !== 'pending').length} / ${f.docs.length}</span></div>
    <ul class="emp-list">${f.docs.map((d) => `<li><span>${esc(d.label)} ${DOC_STATE[d.status]}${d.docId ? ` <a class="link" href="/documents/${d.docId}/telecharger">Télécharger</a>` : ''}</span>
      ${f.status === 'docs' ? `<span class="it-doc-actions">${['received', 'na', 'pending'].filter((st) => st !== d.status).map((st) => `<form class="inline-form" method="post" action="/impots/${f.id}/document">${csrf}<input type="hidden" name="item" value="${esc(d.k)}"><input type="hidden" name="status" value="${st}"><button class="btn btn-ghost btn-sm" type="submit">${{ received: 'Reçu', na: 'Ne s’applique pas', pending: 'À envoyer' }[st]}</button></form>`).join('')}</span>` : ''}</li>`).join('')}</ul>
    ${f.status === 'docs' ? `<form class="form mt-4" method="post" action="/impots/${f.id}/ajouter">${csrf}${field('d-label', 'Demander un autre document', '<input class="input" id="d-label" name="label" maxlength="120" required placeholder="Ex. : relevé de placement non enregistré">')}<div class="btn-row"><button class="btn btn-outline btn-sm" type="submit">Ajouter à la liste</button></div></form>` : ''}</article>` : '';
  let work = '';
  if (f.status === 'docs') work = `<p>Le client envoie ses documents dans son portail. Quand tout est reçu ou marqué « ne s’applique pas », passez à l’étape suivante.</p>${step('docs', 'Tous les documents sont reçus')}`;
  else if (f.status === 'books') work = booksReady ? `<p>La tenue de livres est à jour.</p>${step('books', 'Passer à l’étape suivante')}` : `<div class="alert alert-act">${icon('i-alert')}<div><p class="alert-title">Bloqué : la tenue de livres n’est pas « À jour »</p><p>Terminez la tenue de livres de l’année, puis mettez le client à « À jour » au tableau de bord.</p></div></div>`;
  else if (f.status === 'closing') work = step('closing', 'Fermeture d’exercice terminée', 'btn-plum', `<fieldset class="pay-fs"><legend>Fermeture d’exercice</legend>${CLOSING.map(([k, l]) => `<div class="field"><label class="check"><input type="checkbox" name="chk_${k}" value="1"> ${esc(l)}</label></div>`).join('')}</fieldset>`);
  else if (['prep', 'review'].includes(f.status)) {
    work = `<form class="form" method="post" action="/impots/${f.id}/montants">${csrf}<p class="t-meta">Recopiez les montants des déclarations préparées dans votre logiciel d’impôt.</p>
      <div class="pay-grid">${FIGS[f.form].map(([k, l]) => field(k, `${l} ($)`, `<input class="input num" id="${k}" name="${k}" inputmode="decimal" required value="${esc(amt(f.figures[k]))}">`)).join('')}</div>
      <div class="btn-row"><button class="btn ${f.status === 'prep' ? 'btn-plum' : 'btn-outline'}" type="submit">${f.status === 'prep' ? 'Calculer et envoyer en révision' : 'Corriger les montants'}</button></div></form>
      ${f.status === 'review' ? `<div class="mt-6">${f.prepared_by === s.user.id ? '<p class="wq-late">Vous avez préparé ce dossier : une révision par une autre personne est préférable.</p>' : ''}${step('reviewed', 'Révisé : demander l’approbation du client')}</div>` : ''}`;
  } else if (f.status === 'approval') {
    work = f.client_approved ? `<p><span class="badge b-good">Approuvé par le client</span></p>${step('filed', 'Déclarations produites', 'btn-plum', `<div class="pay-grid">${field('confirmationFed', `Confirmation fédérale (${f.form === 't2' ? 'T2' : 'T1'}) <span class="opt">(facultatif)</span>`, '<input class="input" id="confirmationFed" name="confirmationFed" maxlength="60">')}${field('confirmationQc', `Confirmation Québec (${f.form === 't2' ? 'CO-17' : 'TP-1'}) <span class="opt">(facultatif)</span>`, '<input class="input" id="confirmationQc" name="confirmationQc" maxlength="60">')}</div>`)}`
      : '<p class="t-meta">En attente de l’approbation du client.</p>';
  } else work = `<p><span class="badge b-good">Produites</span> le ${esc(isoDateTime(f.filed_at))}${f.confirmation_fed ? ` — fédéral <b>${esc(f.confirmation_fed)}</b>` : ''}${f.confirmation_qc ? ` · Québec <b>${esc(f.confirmation_qc)}</b>` : ''}.</p>`;
  const back = f.path.indexOf(f.status) > 0 && f.status !== 'filed' ? `<details class="disclose mt-4"><summary>Revenir à l’étape précédente</summary><div>${step('back', 'Revenir en arrière', 'btn-ghost', field('note', 'Raison (obligatoire)', '<input class="input" id="note" name="note" maxlength="300" required>'))}</div></details>` : '';
  const pathLine = `<ol class="it-path">${f.path.map((st) => `<li class="${st === f.status ? 'cur' : f.path.indexOf(st) < f.path.indexOf(f.status) ? 'done' : ''}">${esc(STATES[st])}</li>`).join('')}</ol>`;
  const body = `${pageHead(client.name, f.title, `Date limite de production : ${f.due_date}${f.pay_due ? ` · solde à payer d’ici le ${f.pay_due}` : ''}`)}
    ${pathLine}
    ${f.client_comment && f.status === 'review' ? `<div class="alert alert-watch mt-4">${icon('i-alert')}<div><p class="alert-title">Le client a refusé</p><p>${esc(f.client_comment)}</p></div></div>` : ''}
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">${esc(NEXT[f.status] === '—' ? 'Dossier' : NEXT[f.status])}</h2>${badge(f.status)}</div>${work}${back}</article>
    ${docsList}
    ${f.balance !== null ? `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Résultat</h2></div>${balanceBlock(f)}</article>` : ''}
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Historique</h2></div>
      <ul class="pay-events">${events.map((e) => `<li><span class="t-meta">${esc(isoDateTime(e.at))}</span> ${e.from_status && e.from_status !== e.to_status ? `${esc(STATES[e.from_status])} → ` : ''}<b>${esc(STATES[e.to_status])}</b>${e.user_name ? ` · ${esc(e.user_name)}` : ''}${e.note ? ` — ${esc(e.note)}` : ''}</li>`).join('')}</ul></article>`;
  return appPage(s, { title: 'Impôts', current: '/impots', body, flash });
}

/* ------------------------------------------------ dossier côté client */
function itFileClient(s, { f, nav, flash }) {
  const csrf = csrfField(s);
  let main;
  if (f.status === 'docs') {
    const left = f.docs.filter((d) => d.status === 'pending').length;
    main = `<article class="card"><div class="card-head"><h2 class="t-h3">Documents pour vos impôts</h2><span class="t-meta">${f.docs.length - left} / ${f.docs.length}</span></div>
      <p>Envoyez chaque document que vous avez reçu. Si un document ne vous concerne pas, cliquez « Je ne l’ai pas ». Une photo prise avec votre téléphone convient.</p>
      <ul class="it-docs">${f.docs.map((d) => `<li class="${d.status}"><div class="it-doc-head"><b>${esc(d.label)}</b> ${DOC_STATE[d.status]}</div>
        ${d.status === 'pending' ? `<div class="it-doc-act"><form class="it-upload" method="post" action="/impots/${f.id}/document" enctype="multipart/form-data">${csrf}<input type="hidden" name="item" value="${esc(d.k)}">
            <label class="btn btn-outline btn-sm" for="f-${esc(d.k)}">${icon('i-upload', 'i i-sm')} Choisir le fichier</label><input class="sr-only" id="f-${esc(d.k)}" name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.xlsx,application/pdf,image/jpeg,image/png">
            <button class="btn btn-plum btn-sm" type="submit">Envoyer</button></form>
          <form class="inline-form" method="post" action="/impots/${f.id}/document">${csrf}<input type="hidden" name="item" value="${esc(d.k)}"><input type="hidden" name="status" value="na"><button class="btn btn-ghost btn-sm" type="submit">Je ne l’ai pas / ne s’applique pas</button></form></div>` : ''}</li>`).join('')}</ul>
      <form class="form mt-6" method="post" action="/impots/${f.id}/envoye">${csrf}<div class="btn-row"><button class="btn btn-plum" type="submit"${left ? ' disabled' : ''}>J’ai tout envoyé</button></div>
        ${left ? `<p class="t-meta">Encore ${left} document${left > 1 ? 's' : ''} à envoyer ou à marquer « je ne l’ai pas ».</p>` : ''}</form></article>`;
  } else if (f.status === 'approval' && !f.client_approved) {
    main = `<article class="card"><div class="card-head"><h2 class="t-h3">Approuver vos déclarations</h2></div>
      <p>BVY a préparé vos déclarations. Vérifiez le résultat, puis approuvez-les. Rien n’est produit sans votre accord.</p>${balanceBlock(f, { forClient: true })}
      <form class="form mt-4" method="post" action="/impots/${f.id}/decision">${csrf}
        ${field('d-comment', 'Commentaire <span class="opt">(obligatoire si vous n’approuvez pas)</span>', '<textarea class="input" id="d-comment" name="comment" maxlength="1000"></textarea>')}
        <div class="btn-row"><button class="btn btn-plum" type="submit" name="decision" value="approve">J’approuve</button>
        <button class="btn btn-outline" type="submit" name="decision" value="reject">Je n’approuve pas</button></div></form></article>`;
  } else {
    main = `<article class="card"><div class="card-head"><h2 class="t-h3">Vos déclarations</h2></div>
      <p>${badge(f.status)}</p><p class="mt-4">${f.status === 'filed' ? 'Vos déclarations sont produites.' : f.client_approved ? 'Merci, vous les avez approuvées : BVY les produit.' : 'BVY prépare vos déclarations ; nous vous écrirons si nous avons une question.'}</p>${balanceBlock(f, { forClient: true })}</article>`;
  }
  const body = `${pageHead('Impôts', f.title, `Date limite : ${f.due_date}`)}${main}`;
  return appPage(s, { title: 'Impôts', current: '/a-faire', body, flash, nav });
}

module.exports = { itBoard, clientItTab, itFileStaff, itFileClient };
