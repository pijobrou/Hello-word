'use strict';

/**
 * Écrans de la Réception (workflows 09 et 10) : documents à classer, réponses, messages, clients sans réponse ;
 * documents d'un dossier (recherche, classement) et historique.
 */

const { esc, appPage, pageHead, icon, csrfField } = require('./views.js');
const { DOC_TYPES } = require('./doctypes.js');
const { isoDay, isoDateTime } = require('./dates.js');

const size = (n) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`);
const typeOptions = (sel, { blank = '' } = {}) => `${blank ? `<option value="">${esc(blank)}</option>` : ''}${Object.entries(DOC_TYPES)
  .map(([k, l]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(l)}</option>`).join('')}`;

function suggestionNote(d) {
  if (!d.suggested) return '<span class="t-meta">Aucune suggestion : choisissez le type.</span>';
  return `<span class="badge b-info">Suggestion : ${esc(DOC_TYPES[d.suggested])}</span> <span class="t-meta">${d.suggested_by === 'client' ? 'selon le client' : 'd’après le nom du fichier'}</span>`;
}

// Formulaire de classement d'un document (type, période, lien), et « c'est un doublon » le cas échéant.
function fileForm(s, d, links, back) {
  const csrf = csrfField(s);
  const id = `d${d.id}`;
  return `<form class="rc-file" method="post" action="/documents/${d.id}/classer">${csrf}<input type="hidden" name="back" value="${esc(back)}">
      <label class="rc-f"><span class="label">Type</span><select class="input" id="${id}-t" name="type" required>${typeOptions(d.suggested, { blank: '— choisir —' })}</select></label>
      <label class="rc-f rc-short"><span class="label">Période</span><input class="input" id="${id}-p" name="period" maxlength="7" placeholder="AAAA-MM" value="${esc(d.period || '')}"></label>
      <label class="rc-f"><span class="label">Lié à <span class="opt">(facultatif)</span></span><select class="input" id="${id}-l" name="link"><option value="">—</option>${links.map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select></label>
      <button class="btn btn-plum btn-sm" type="submit">Classer</button>
    </form>
    ${d.duplicate_of ? `<form class="inline-form" method="post" action="/documents/${d.id}/classer">${csrf}<input type="hidden" name="back" value="${esc(back)}"><input type="hidden" name="duplicate" value="1"><button class="btn btn-ghost btn-sm" type="submit">C’est un doublon : classer comme l’original</button></form>` : ''}`;
}

function docCard(s, d, links, back, { showClient = true } = {}) {
  return `<li class="rc-item" id="doc-${d.id}">
    <div class="rc-head"><div>${showClient ? `<p class="t-eyebrow"><span>${esc(d.client)}</span></p>` : ''}
      <a class="link rc-name" href="/documents/${d.id}/telecharger">${esc(d.name)}</a>
      <p class="t-meta">Reçu le ${esc(isoDateTime(d.created_at))} · ${esc(size(d.size))}${d.note ? ` · « ${esc(d.note)} »` : ''}</p></div>
      <div class="rc-sugg">${suggestionNote(d)}</div></div>
    ${d.duplicate_of ? `<div class="alert alert-watch mt-4">${icon('i-alert')}<div><p>Même fichier déjà reçu le ${esc(isoDateTime(d.duplicate_at))}.</p></div></div>` : ''}
    ${fileForm(s, d, links, back)}</li>`;
}

function inboxPage(s, { data, flash }) {
  const csrf = csrfField(s);
  const section = (title, n, inner, empty) => `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">${esc(title)}</h2><span class="badge ${n ? 'b-watch' : 'b-good'}">${n}</span></div>
    ${n ? inner : `<p class="t-meta">${esc(empty)}</p>`}</article>`;
  const docs = `<ul class="rc-list">${data.docs.map((d) => docCard(s, d, d.links, '/reception')).join('')}</ul>`;
  const replies = `<ul class="rc-list">${data.replies.map((t) => `<li class="rc-item"><div class="rc-head"><div><p class="t-eyebrow"><span>${esc(t.client)}</span></p>
      <p><b>${esc(t.title)}</b></p><p class="rc-answer">${esc(t.answer || '')}</p>
      <p class="t-meta">Répondu par ${esc(t.answered_by_name || '')} le ${esc(isoDateTime(t.answered_at))}</p></div>
      <div class="btn-row"><a class="btn btn-ghost btn-sm" href="/clients/${t.client_id}/taches">Voir le dossier</a>
      <form class="inline-form" method="post" action="/taches/${t.id}/fermer">${csrf}<input type="hidden" name="back" value="/reception"><button class="btn btn-plum btn-sm" type="submit">Traité</button></form></div></div></li>`).join('')}</ul>`;
  const unread = `<ul class="rc-rows">${data.unread.map((x) => `<li><a class="link" href="/clients/${x.clientId}/messages">${esc(x.client)}</a><span class="badge b-watch">${x.n} non lu${x.n > 1 ? 's' : ''}</span></li>`).join('')}</ul>`;
  const silent = `<ul class="rc-rows">${data.silent.map((t) => `<li><span><a class="link" href="/clients/${t.client_id}/taches">${esc(t.client)}</a> — ${esc(t.title)}<br><span class="t-meta">Demandé le ${esc(isoDay(t.created_at))} · 3 rappels, dernier le ${esc(isoDay(t.last_reminder_at))}</span></span><span class="badge b-act">Appelez le client</span></li>`).join('')}</ul>`;
  const body = `${pageHead('Réception', data.total ? `${data.total} élément${data.total > 1 ? 's' : ''} à traiter` : 'Tout est traité', 'Ce qui arrive des clients et attend une personne : documents à classer, réponses, messages et clients qui ne répondent pas.')}
    ${section('Documents à classer', data.docs.length, docs, 'Aucun document en attente : tout est classé.')}
    ${section('Réponses des clients', data.replies.length, replies, 'Aucune réponse en attente.')}
    ${section('Messages non lus', data.unread.length, unread, 'Aucun message non lu.')}
    ${section('Sans réponse malgré 3 rappels', data.silent.length, silent, 'Aucun client en retard de réponse.')}`;
  return appPage(s, { title: 'Réception', current: '/reception', body, flash });
}

function staffDocuments(s, { client, docs, filters, links, uploadForm, shell }) {
  const f = filters || {};
  const row = (d) => `<tr${d.filed ? '' : ' class="rc-todo"'}><td><a class="link" href="/documents/${d.id}/telecharger">${esc(d.name)}</a>${d.category === 'report' ? ' <span class="badge b-info">Rapport</span>' : ''}${d.note ? `<br><span class="t-meta">${esc(d.note)}</span>` : ''}${d.duplicate_of ? '<br><span class="badge b-watch">Doublon</span>' : ''}</td>
    <td>${d.filed ? esc(DOC_TYPES[d.doc_type] || '—') : `<a class="badge b-watch" href="#doc-${d.id}">À classer</a>`}</td><td>${esc(d.period || '—')}</td>
    <td>${d.linkInfo ? `<a class="link" href="${esc(d.linkInfo.href)}">${esc(d.linkInfo.label)}</a>` : '—'}</td>
    <td>${d.origin === 'bvy' ? 'BVY' : esc(d.uploaded_by_name || 'Client')}</td><td>${esc(isoDay(d.created_at))}</td><td class="num">${esc(size(d.size))}</td></tr>`;
  const todo = docs.filter((d) => !d.filed);
  const inner = `${todo.length ? `<article class="card"><div class="card-head"><h2 class="t-h3">À classer</h2><span class="badge b-watch">${todo.length}</span></div>
      <ul class="rc-list">${todo.map((d) => docCard(s, d, links, `/clients/${client.id}/documents`, { showClient: false })).join('')}</ul></article>` : ''}
    <article class="card${todo.length ? ' mt-6' : ''}"><div class="card-head"><h2 class="t-h3">Documents du client</h2><span class="t-meta">${docs.length} résultat${docs.length > 1 ? 's' : ''}</span></div>
      <form class="rc-search" method="get" action="/clients/${client.id}/documents">
        <label class="rc-f"><span class="label">Rechercher</span><input class="input" name="q" maxlength="80" placeholder="Nom du fichier ou note" value="${esc(f.q || '')}"></label>
        <label class="rc-f"><span class="label">Type</span><select class="input" name="type"><option value="">Tous</option><option value="a_classer"${f.type === 'a_classer' ? ' selected' : ''}>À classer</option>${typeOptions(f.type)}</select></label>
        <label class="rc-f rc-short"><span class="label">Période</span><input class="input" name="period" maxlength="7" placeholder="AAAA-MM" value="${esc(f.period || '')}"></label>
        <button class="btn btn-outline btn-sm" type="submit">Filtrer</button></form>
      ${docs.length ? `<div class="table-wrap mt-4"><table class="table"><thead><tr><th scope="col">Document</th><th scope="col">Type</th><th scope="col">Période</th><th scope="col">Lié à</th><th scope="col">Envoyé par</th><th scope="col">Date</th><th scope="col">Taille</th></tr></thead>
      <tbody>${docs.map(row).join('')}</tbody></table></div>` : `<div class="empty">${icon('i-folder', 'i empty-ico')}<p><b>Aucun document ne correspond.</b></p></div>`}</article>
    <div class="cols-2 mt-6"><article class="card"><div class="card-head"><h2 class="t-h3">Partager un document</h2></div>${uploadForm}</article></div>`;
  return shell(inner);
}

const EV = {
  message: ['i-message', 'Message'], document: ['i-folder', 'Document'], task: ['i-check', 'Demande'],
  answer: ['i-ok', 'Réponse'], reminder: ['i-refresh', 'Rappel'],
};
function historyTab(s, { events, shell }) {
  const inner = `<article class="card"><div class="card-head"><h2 class="t-h3">Historique des échanges</h2><span class="t-meta">Messages, documents, demandes, réponses et rappels</span></div>
    ${events.length ? `<ol class="rc-time">${events.map((e) => `<li class="${e.fromClient ? 'from-client' : ''}"><span class="rc-when">${esc(isoDateTime(e.at))}</span>
      <span class="rc-kind">${icon(EV[e.kind][0])}${esc(EV[e.kind][1])}</span>
      <span class="rc-what"><a class="link" href="${esc(e.href)}">${esc(e.text)}</a><span class="t-meta"> — ${esc(e.who || '')}</span></span></li>`).join('')}</ol>`
    : `<div class="empty">${icon('i-refresh', 'i empty-ico')}<p><b>Aucun échange pour l’instant.</b></p></div>`}</article>`;
  return shell(inner);
}

module.exports = { inboxPage, staffDocuments, historyTab, fileForm, typeOptions };
