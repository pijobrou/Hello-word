'use strict';

/**
 * Écrans de la conciliation assistée (workflow 07, partie B) : onglet « Conciliation » du dossier et page d'une
 * conciliation. Seulement les exceptions ; ce qui concorde est compté et replié.
 */

const { esc, appPage, pageHead, field, icon, csrfField } = require('./views.js');
const { formatAmount } = require('./portal.js');
const { isoDay } = require('./dates.js');

const money = (c) => (c === null || c === undefined ? '—' : formatAmount(c));
const KIND = {
  missing: ['b-act', 'Au relevé, pas dans QuickBooks', 'À saisir dans QuickBooks (dépense, dépôt ou virement), puis cocher dans le rapprochement.'],
  amount: ['b-act', 'Montant différent', 'Corriger le montant dans QuickBooks pour qu’il soit identique au relevé.'],
  extra: ['b-watch', 'Dans QuickBooks, pas au relevé', 'Doublon ou mauvaise date probable : vérifier, puis corriger ou supprimer dans QuickBooks.'],
  outstanding: ['b-neutral', 'En circulation', 'Normal si encaissé le mois prochain : laisser non coché dans le rapprochement.'],
};
const NEW_URL = { true: 'deposit', false: 'expense' };

function exceptionRow(s, r, e) {
  const csrf = csrfField(s);
  const [cls, label, action] = KIND[e.kind];
  const st = e.stmt; const q = e.qbo;
  const appBase = (q && q.url && q.url.split('/app/')[0]) || 'https://app.qbo.intuit.com';
  return `<li class="an-item rc-ex rc-${e.kind}${e.done ? ' rc-done' : ''}" id="${esc(e.key)}">
    <div class="rc-head"><div>
      <p class="an-tags"><span class="badge ${cls}">${esc(label)}</span>${e.done ? ' <span class="badge b-good">Réglé</span>' : ''}</p>
      ${st ? `<p class="an-title">Relevé : ${esc(st.date)} — ${esc(st.desc)} — <span class="num">${esc(money(st.amount))}</span></p>` : ''}
      ${q ? `<p class="${st ? 't-meta' : 'an-title'}">QuickBooks : ${esc(q.date)} — ${esc(q.type)}${q.docNum ? ` no ${esc(q.docNum)}` : ''}${q.name ? ` — ${esc(q.name)}` : ''} — <span class="num">${esc(money(q.amount))}</span></p>` : ''}
      ${e.kind === 'amount' ? `<p class="t-meta">Écart : ${esc(money(e.diff))}${e.note ? ` (${esc(e.note)})` : ''}</p>` : ''}
      <p class="an-action">${esc(action)}</p></div>
      <div class="btn-row">
        ${q && q.url ? `<a class="qbo-link" href="${esc(q.url)}" target="_blank" rel="noopener">Ouvrir dans QuickBooks ↗</a>` : ''}
        ${!q && st ? `<a class="qbo-link" href="${esc(`${appBase}/app/${NEW_URL[st.amount > 0]}`)}" target="_blank" rel="noopener">Saisir dans QuickBooks ↗</a>` : ''}
        <form class="inline-form" method="post" action="/conciliations/${r.id}/ligne">${csrf}<input type="hidden" name="key" value="${esc(e.key)}"><input type="hidden" name="done" value="${e.done ? '0' : '1'}">
          <button class="btn ${e.done ? 'btn-ghost' : 'btn-outline'} btn-sm" type="submit">${e.done ? 'Rouvrir' : 'Réglé'}</button></form></div></div></li>`;
}

function matchedList(r) {
  const rows = r.result.matched.map((m) => {
    const st = m.stmt || (m.stmts && { date: m.stmts[0].date, desc: m.stmts.map((x) => x.desc).join(' + '), amount: m.stmts.reduce((t, x) => t + x.amount, 0) });
    const qs = m.qbo ? [m.qbo] : m.qbos;
    return `<tr><td>${esc(st.date)}</td><td>${esc(st.desc)}</td><td class="num">${esc(money(st.amount))}</td>
      <td>${qs.map((q) => `${esc(q.date)} · ${esc(q.type)}${q.docNum ? ` ${esc(q.docNum)}` : ''}${q.name ? ` · ${esc(q.name)}` : ''}${qs.length > 1 ? ` (${esc(money(q.amount))})` : ''}`).join('<br>')}${m.how === 'group' ? ' <span class="badge b-info">regroupé</span>' : ''}</td></tr>`;
  }).join('');
  return `<details class="an-more"><summary>Voir les ${r.result.matched.length} opérations qui concordent (à cocher dans QuickBooks)</summary>
    <div class="table-wrap mt-4"><table class="table"><thead><tr><th scope="col">Date</th><th scope="col">Relevé</th><th scope="col">Montant</th><th scope="col">QuickBooks</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}

function reconcilePage(s, { r, flash }) {
  const csrf = csrfField(s);
  const ex = r.result.exceptions;
  const open = ex.filter((e) => !e.done && e.kind !== 'outstanding');
  const outstanding = ex.filter((e) => e.kind === 'outstanding');
  const sum = (list) => list.reduce((t, e) => t + ((e.stmt || e.qbo).amount || 0), 0);
  // Effet net des corrections sur le solde QuickBooks : saisir ce qui manque, corriger les montants, retirer les doublons
  const effect = (list) => list.reduce((t, e) => t + (e.kind === 'missing' ? e.stmt.amount : e.kind === 'amount' ? e.diff : e.kind === 'extra' ? -e.qbo.amount : 0), 0);
  const chk = r.statement.check;
  const readNote = r.check_ok
    ? `Relevé lu et vérifié : ${esc(money(r.opening))} + dépôts ${esc(money(r.statement.totals.credits))} − retraits ${esc(money(r.statement.totals.debits))} = ${esc(money(r.closing))}${chk.balancesChecked ? ` ; ${chk.balancesChecked} soldes du relevé contrôlés` : ''}${chk.summaryOk ? ' ; totaux du sommaire de la banque identiques' : ''}.`
    : 'Attention : la lecture du relevé ne balance pas exactement. Vérifiez les lignes signalées avant de vous y fier.';
  const body = `${pageHead(r.client.name, `Conciliation — ${r.account_name}`, `Du ${esc(r.period_start)} au ${esc(r.period_end)} · relevé ${r.doc ? `<a class="link" href="/documents/${r.doc.id}/telecharger">${esc(r.doc.name)}</a>` : ''}${r.bank ? ` (${esc(r.bank)})` : ''}`)}
    <div class="alert ${r.check_ok ? 'alert-good' : 'alert-watch'}">${icon(r.check_ok ? 'i-ok' : 'i-alert')}<div><p>${readNote}</p></div></div>
    <div class="wq-kpis wq-kpis-3 mt-6">
      <div class="cd-kpi"><small>Concordent</small><b>${r.result.matched.length}</b><em class="up">à cocher dans QuickBooks</em></div>
      <div class="cd-kpi"><small>Écarts à régler</small><b>${open.length}</b><em class="${open.length ? 'down' : 'up'}">${open.length ? `effet net sur QuickBooks : ${esc(money(effect(open)))}` : 'aucun'}</em></div>
      <div class="cd-kpi"><small>En circulation</small><b>${outstanding.length}</b><em>${outstanding.length ? esc(money(sum(outstanding))) : 'aucune'}</em></div>
    </div>
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">À faire</h2>${r.status === 'done' ? `<span class="badge b-good">Terminée le ${esc(isoDay(r.finished_at))}</span>` : ''}</div>
      <ol class="rc-steps">
        <li>Dans QuickBooks, ouvrez le rapprochement du compte « ${esc(r.account_name)} », solde de fin du relevé <b>${esc(money(r.closing))}</b> au ${esc(r.period_end)}.</li>
        <li>Réglez les écarts ci-dessous (bouton « Ouvrir » ou « Saisir dans QuickBooks »), puis cochez « Réglé ».</li>
        <li>Cochez dans QuickBooks les opérations qui concordent (liste repliée plus bas) ; laissez les opérations en circulation non cochées.</li>
        <li>La différence affichée par QuickBooks doit être 0,00 $ — si le solde de début de QuickBooks est égal au solde d’ouverture du relevé (${esc(money(r.opening))}).</li>
      </ol>
      ${ex.length ? `<ul class="rc-list mt-4">${ex.map((e) => exceptionRow(s, r, e)).join('')}</ul>` : `<div class="empty">${icon('i-ok', 'i empty-ico')}<p><b>Aucun écart.</b></p><p>Tout le relevé concorde avec QuickBooks.</p></div>`}
      <div class="mt-6">${matchedList(r)}</div>
      ${r.status === 'open' ? `<form class="mt-6" method="post" action="/conciliations/${r.id}/terminer">${csrf}<button class="btn btn-plum" type="submit"${open.length ? ' disabled' : ''}>Conciliation terminée</button>${open.length ? ` <span class="t-meta">Réglez d’abord les ${open.length} écart${open.length > 1 ? 's' : ''}.</span>` : ''}</form>` : ''}</article>
    <p class="mt-6"><a class="link" href="/clients/${r.client_id}/conciliation">← Conciliations du client</a></p>`;
  return appPage(s, { title: `Conciliation — ${r.account_name}`, current: '/accueil', body, flash });
}

function reconcileTab(s, { client, list, accounts, statements, shell }) {
  const csrf = csrfField(s);
  const form = !accounts.length
    ? '<p class="t-meta">Reliez QuickBooks et lancez une synchronisation : les comptes bancaires du client apparaîtront ici.</p>'
    : `<form class="form" method="post" action="/clients/${client.id}/conciliation" enctype="multipart/form-data">${csrf}
      <div class="gv-grid">${field('accountId', 'Compte bancaire dans QuickBooks', `<select class="input" id="accountId" name="accountId" required>${accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select>`)}
      ${field('docId', 'Relevé déjà reçu', `<select class="input" id="docId" name="docId"><option value="">— ou envoyez le PDF ci-dessous —</option>${statements.map((d) => `<option value="${d.id}">${esc(d.name)}${d.period ? ` (${esc(d.period)})` : ''}</option>`).join('')}</select>`)}</div>
      <label class="dropzone" for="file">${icon('i-upload')}<b data-file>Ou choisissez le relevé PDF</b><span>PDF téléchargé de la banque (pas une photo ni un scan)</span>
        <input class="sr-only" id="file" name="file" type="file" accept=".pdf,application/pdf"></label>
      <div class="btn-row"><button class="btn btn-plum" type="submit">Comparer avec QuickBooks</button></div>
      <p class="t-meta">Le relevé est lu sur le serveur de BVY et vérifié par le calcul. Seuls les écarts sont montrés.</p></form>`;
  const rows = list.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Période</th><th scope="col">Compte</th><th scope="col">Concordent</th><th scope="col">Écarts ouverts</th><th scope="col">État</th></tr></thead><tbody>
    ${list.map((r) => `<tr><td class="nowrap"><a class="link" href="/conciliations/${r.id}">${esc(r.period_start)} au ${esc(r.period_end)}</a></td><td>${esc(r.account_name)}</td><td class="num">${r.matched}</td>
      <td class="num">${r.open ? `<span class="badge b-watch">${r.open}</span>` : '0'}</td><td>${r.status === 'done' ? '<span class="badge b-good">Terminée</span>' : '<span class="badge b-info">En cours</span>'}${r.check_ok ? '' : ' <span class="badge b-act">Lecture à vérifier</span>'}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="t-meta">Aucune conciliation pour l’instant.</p>';
  return shell(`<div class="cols-2"><article class="card"><div class="card-head"><h2 class="t-h3">Nouvelle conciliation</h2></div>${form}</article></div>
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Conciliations</h2></div>${rows}</article>`);
}

module.exports = { reconcilePage, reconcileTab };
