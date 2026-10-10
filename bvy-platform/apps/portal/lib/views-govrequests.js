'use strict';

/**
 * Écrans des demandes du gouvernement (workflow 17), côté équipe.
 */

const { esc, appPage, pageHead, field, icon, csrfField } = require('./views.js');
const { AGENCIES, KINDS, PROGRAMS, STATES, SENT_HOW } = require('./govrequests.js');
const { formatAmount } = require('./portal.js');
const { isoDay, isoDateTime } = require('./dates.js');

const ORDER = ['received', 'gathering', 'ready', 'sent', 'closed'];
const options = (map, sel) => Object.entries(map).map(([k, l]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(l)}</option>`).join('');
const ITEM = { todo: ['b-watch', 'À obtenir'], received: ['b-good', 'Reçu'], na: ['b-neutral', 'Ne s’applique pas'] };

function dueBadge(r) {
  if (r.status === 'closed') return `<span class="t-meta">${esc(r.due_date)}</span>`;
  if (r.status === 'sent') return `<span class="wq-due later"><b>${esc(r.due_date)}</b><span>réponse envoyée</span></span>`;
  const cls = r.days < 0 ? 'late' : r.days <= 7 ? 'week' : r.days <= 31 ? 'month' : 'later';
  const txt = r.days < 0 ? `en retard de ${-r.days} j` : r.days === 0 ? 'aujourd’hui' : `dans ${r.days} j`;
  return `<span class="wq-due ${cls}"><b>${esc(r.due_date)}</b><span>${txt}</span></span>`;
}

function createForm(s, { clients, clientId = null, doc = null, action = '/gouvernement' }) {
  const today = isoDay(Date.now());
  return `<form class="form" method="post" action="${action}">${csrfField(s)}
    ${clientId ? `<input type="hidden" name="clientId" value="${clientId}">` : field('clientId', 'Client', `<select class="input" id="clientId" name="clientId" required><option value="">— choisir —</option>${clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>`)}
    ${doc ? `<input type="hidden" name="letterDocId" value="${doc.id}"><p class="t-meta">Lettre jointe : <a class="link" href="/documents/${doc.id}/telecharger">${esc(doc.name)}</a></p>` : ''}
    <div class="gv-grid">
      ${field('agency', 'Organisme', `<select class="input" id="agency" name="agency" required>${options(AGENCIES)}</select>`)}
      ${field('kind', 'Type de demande', `<select class="input" id="kind" name="kind" required>${options(KINDS)}</select>`)}
      ${field('program', 'Programme visé', `<select class="input" id="program" name="program" required>${options(PROGRAMS)}</select>`)}
      ${field('reference', 'Numéro de référence ou de dossier <span class="opt">(facultatif)</span>', '<input class="input" id="reference" name="reference" maxlength="60">')}
      ${field('letterDate', 'Date de la lettre', `<input class="input" id="letterDate" name="letterDate" type="date" max="${today}" required>`)}
      ${field('dueDate', 'Date limite de réponse <span class="opt">(avis de cotisation : vide = 90 jours pour s’opposer)</span>', '<input class="input" id="dueDate" name="dueDate" type="date">')}
      ${field('amount', 'Montant en jeu ($) <span class="opt">(facultatif)</span>', '<input class="input num" id="amount" name="amount" inputmode="decimal">')}
    </div>
    ${field('summary', 'Ce que demande l’organisme, en une ou deux phrases', '<textarea class="input" id="summary" name="summary" maxlength="1500" required></textarea>')}
    ${field('items', 'Documents à fournir — un par ligne <span class="opt">(facultatif)</span>', '<textarea class="input" id="items" name="items" placeholder="Relevés bancaires de janvier à juin 2026&#10;Factures d’achat de plus de 500 $"></textarea>')}
    <div class="btn-row"><button class="btn btn-plum" type="submit">Enregistrer la demande</button></div></form>`;
}

function table(items, { showClient = true } = {}) {
  if (!items.length) return `<div class="empty">${icon('i-ok', 'i empty-ico')}<p><b>Aucune demande.</b></p><p>Enregistrez chaque lettre reçue de l’ARC, de Revenu Québec ou d’un autre organisme le jour où elle arrive.</p></div>`;
  return `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Date limite</th>${showClient ? '<th scope="col">Client</th>' : ''}<th scope="col">Demande</th><th scope="col">Étape</th><th scope="col">Documents</th></tr></thead><tbody>
    ${items.map((r) => `<tr><td class="nowrap">${dueBadge(r)}</td>${showClient ? `<td>${esc(r.client)}</td>` : ''}
      <td><a class="link" href="/gouvernement/${r.id}">${esc(r.title)}</a>${r.reference ? `<br><span class="t-meta">Réf. ${esc(r.reference)}</span>` : ''}</td>
      <td>${esc(STATES[r.status])}</td><td>${r.items.length ? (r.missing ? `<span class="badge b-watch">${r.missing} à obtenir</span>` : '<span class="badge b-good">Complets</span>') : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function govBoard(s, { items, closed, clients, flash }) {
  const late = items.filter((r) => r.late).length;
  const body = `${pageHead('Gouvernement', closed ? 'Demandes fermées' : items.length ? `${items.length} demande${items.length > 1 ? 's' : ''} en cours` : 'Aucune demande en cours',
    `Contrôles, demandes de documents et avis de l’ARC, de Revenu Québec, de la CNESST et des autres organismes, triés par date limite.${late ? ` ${late} en retard.` : ''}`)}
    <nav class="chips" aria-label="Filtrer"><a class="chip" href="/gouvernement"${closed ? '' : ' aria-current="true"'}>En cours</a><a class="chip" href="/gouvernement?etat=closed"${closed ? ' aria-current="true"' : ''}>Fermées</a></nav>
    <article class="card">${table(items)}</article>
    ${closed ? '' : `<details class="card mt-6 disclose"${items.length ? '' : ' open'}><summary>Enregistrer une lettre reçue</summary><div class="mt-4">${createForm(s, { clients })}</div></details>`}`;
  return appPage(s, { title: 'Gouvernement', current: '/gouvernement', body, flash });
}

function newPage(s, { client, doc, flash }) {
  const body = `${pageHead('Gouvernement', 'Enregistrer une lettre reçue', `${esc(client.name)} — la date limite apparaîtra dans les anomalies urgentes 7 jours avant.`)}
    <article class="card">${createForm(s, { clients: [], clientId: client.id, doc })}</article>`;
  return appPage(s, { title: 'Gouvernement', current: '/gouvernement', body, flash });
}

function sheet(s, { r, flash }) {
  const csrf = csrfField(s);
  const open = r.status !== 'closed';
  const path = `<ol class="it-path">${ORDER.map((st) => `<li class="${ORDER.indexOf(st) < ORDER.indexOf(r.status) ? 'done' : st === r.status ? 'cur' : ''}">${esc(STATES[st])}</li>`).join('')}</ol>`;
  const items = r.items.length ? `<ul class="it-docs">${r.items.map((i) => `<li class="${i.status}"><b>${esc(i.label)}</b> <span class="badge ${ITEM[i.status][0]}">${ITEM[i.status][1]}</span>
      ${open && r.status !== 'sent' ? `<span class="it-doc-actions">${['received', 'na', 'todo'].filter((st) => st !== i.status).map((st) => `<form class="inline-form" method="post" action="/gouvernement/${r.id}/element">${csrf}<input type="hidden" name="item" value="${esc(i.k)}"><input type="hidden" name="status" value="${st}"><button class="btn btn-ghost btn-sm" type="submit">${ITEM[st][1]}</button></form>`).join('')}</span>` : ''}</li>`).join('')}</ul>`
    : '<p class="t-meta">Aucun document listé pour l’instant.</p>';
  const taskLine = r.task ? `<p class="t-meta mt-4">Demande au client : « ${esc(r.task.title)} » — ${r.task.status === 'open' ? 'en attente (rappels automatiques)' : 'répondue'} · <a class="link" href="/clients/${r.client_id}/taches">voir la tâche</a></p>` : '';
  const gather = open && !['sent'].includes(r.status) ? `
    <form class="rc-search mt-4" method="post" action="/gouvernement/${r.id}/ajouter">${csrf}<label class="rc-f"><span class="label">Ajouter un document à fournir</span><input class="input" name="label" maxlength="160" required></label><button class="btn btn-outline btn-sm" type="submit">Ajouter</button></form>
    ${r.missing ? `<form class="mt-4" method="post" action="/gouvernement/${r.id}/demander">${csrf}<button class="btn btn-plum btn-sm" type="submit">Demander au client les ${r.missing} document${r.missing > 1 ? 's' : ''} manquant${r.missing > 1 ? 's' : ''}</button></form>` : ''}` : '';
  let step = '';
  if (r.status === 'received') step = `<form method="post" action="/gouvernement/${r.id}/etape">${csrf}<input type="hidden" name="action" value="ready"><button class="btn btn-plum" type="submit">Réponse prête à envoyer</button></form>`;
  if (r.status === 'gathering') step = `<form method="post" action="/gouvernement/${r.id}/etape">${csrf}<input type="hidden" name="action" value="ready"><button class="btn btn-plum" type="submit"${r.missing ? ' disabled' : ''}>Réponse prête à envoyer</button></form>${r.missing ? `<p class="t-meta">Il manque ${r.missing} document${r.missing > 1 ? 's' : ''}.</p>` : ''}`;
  if (r.status === 'ready') {
    step = `<form class="form" method="post" action="/gouvernement/${r.id}/etape">${csrf}<input type="hidden" name="action" value="sent">
      <div class="gv-grid">${field('sentOn', 'Envoyée le', `<input class="input" id="sentOn" name="sentOn" type="date" required value="${esc(isoDay(Date.now()))}">`)}
      ${field('sentHow', 'Comment', `<select class="input" id="sentHow" name="sentHow" required>${SENT_HOW.map((h) => `<option>${esc(h)}</option>`).join('')}</select>`)}
      ${field('confirmation', 'Numéro de confirmation <span class="opt">(facultatif)</span>', '<input class="input" id="confirmation" name="confirmation" maxlength="80">')}</div>
      <div class="btn-row"><button class="btn btn-plum" type="submit">Réponse envoyée</button></div></form>`;
  }
  if (r.status === 'sent' || (open && r.kind === 'cotisation')) {
    step += `<form class="form${step ? ' mt-6' : ''}" method="post" action="/gouvernement/${r.id}/etape">${csrf}<input type="hidden" name="action" value="closed">
      ${field('note', 'Résultat <span class="opt">(ex. : aucun changement ; nouvelle cotisation de 1 250,00 $ ; objection déposée)</span>', '<textarea class="input" id="note" name="note" maxlength="600" required></textarea>')}
      <div class="btn-row"><button class="btn btn-outline" type="submit">Fermer la demande</button></div></form>`;
  }
  const back = r.status !== 'received' ? `<details class="an-more mt-4"><summary>Revenir à l’étape précédente</summary><form class="form mt-4" method="post" action="/gouvernement/${r.id}/etape">${csrf}<input type="hidden" name="action" value="back">
      ${field('nb', 'Raison', '<input class="input" id="nb" name="note" maxlength="600" required>')}<div class="btn-row"><button class="btn btn-ghost btn-sm" type="submit">Revenir en arrière</button></div></form></details>` : '';
  const edit = open ? `<details class="an-more"><summary>Modifier la date limite ou le résumé</summary><form class="form mt-4" method="post" action="/gouvernement/${r.id}/modifier">${csrf}
      <div class="gv-grid">${field('dueDate', 'Date limite', `<input class="input" id="dueDate" name="dueDate" type="date" required value="${esc(r.due_date)}">`)}
      ${field('reason', 'Pourquoi <span class="opt">(ex. : délai accordé par l’agent le …)</span>', '<input class="input" id="reason" name="reason" maxlength="200">')}
      ${field('reference', 'Référence', `<input class="input" id="reference" name="reference" maxlength="60" value="${esc(r.reference || '')}">`)}
      ${field('amount', 'Montant en jeu ($)', `<input class="input num" id="amount" name="amount" inputmode="decimal" value="${r.amount_cents === null ? '' : esc((r.amount_cents / 100).toFixed(2).replace('.', ','))}">`)}</div>
      ${field('summary', 'Résumé', `<textarea class="input" id="summary" name="summary" maxlength="1500" required>${esc(r.summary)}</textarea>`)}
      <div class="btn-row"><button class="btn btn-outline btn-sm" type="submit">Enregistrer</button></div></form></details>` : '';
  const body = `${pageHead(r.client.name, r.title, `Lettre du ${esc(r.letter_date)}${r.reference ? ` · réf. ${esc(r.reference)}` : ''} · date limite ${esc(r.due_date)}${r.amount_cents !== null ? ` · montant en jeu ${esc(formatAmount(r.amount_cents))}` : ''}`)}
    ${path}
    <div class="cols-2 mt-6">
      <article class="card"><div class="card-head"><h2 class="t-h3">La demande</h2>${dueBadge(r)}</div>
        <p class="gv-summary">${esc(r.summary)}</p>
        <p class="t-meta mt-4">Responsable : ${esc(r.ownerName || '—')} · <a class="link" href="/clients/${r.client_id}/gouvernement">Dossier du client</a></p>
        ${r.docs.length ? `<h3 class="t-h4 mt-6">Lettre et pièces</h3><ul class="rc-rows">${r.docs.map((d) => `<li><a class="link" href="/documents/${d.id}/telecharger">${esc(d.name)}</a><span class="t-meta">${d.id === r.letter_doc_id ? 'Lettre' : d.origin === 'client' ? 'Envoyé par le client' : 'BVY'} · ${esc(isoDay(d.created_at))}</span></li>`).join('')}</ul>` : '<p class="t-meta mt-4">Lettre non jointe : classez-la depuis la Réception ou l’onglet Documents du client.</p>'}
        ${r.sent_on ? `<p class="mt-4"><b>Envoyée le ${esc(r.sent_on)}</b> (${esc(r.sent_how)})${r.confirmation ? ` — confirmation ${esc(r.confirmation)}` : ''}</p>` : ''}
        ${r.outcome ? `<p class="rc-answer mt-4"><b>Résultat :</b> ${esc(r.outcome)}</p>` : ''}
        ${edit}</article>
      <article class="card"><div class="card-head"><h2 class="t-h3">Documents à fournir</h2>${r.items.length ? `<span class="t-meta">${r.items.length - r.missing} / ${r.items.length}</span>` : ''}</div>
        ${items}${taskLine}${gather}</article></div>
    ${open ? `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Étape suivante</h2><span class="badge b-info">${esc(STATES[r.status])}</span></div>${step}${back}</article>` : ''}
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Historique</h2></div><ol class="an-history">${r.events.map((e) => `<li><span class="rc-when">${esc(isoDateTime(e.at))}</span> ${esc(STATES[e.to_status])}${e.note ? ` — ${esc(e.note)}` : ''}${e.name ? ` <span class="t-meta">(${esc(e.name)})</span>` : ''}</li>`).join('')}</ol></article>`;
  return appPage(s, { title: r.title, current: '/gouvernement', body, flash });
}

function clientGovTab(s, { client, items, shell }) {
  return shell(`<article class="card"><div class="card-head"><h2 class="t-h3">Demandes du gouvernement</h2><a class="btn btn-plum btn-sm" href="/gouvernement/nouvelle?client=${client.id}">Enregistrer une lettre reçue</a></div>${table(items, { showClient: false })}</article>`);
}

module.exports = { govBoard, newPage, sheet, clientGovTab };
