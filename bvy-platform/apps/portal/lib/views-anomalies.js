'use strict';

/**
 * Écrans des anomalies (workflow 06) et des questions au client (workflow 08), côté équipe.
 */

const { esc, appPage, pageHead, icon, csrfField } = require('./views.js');
const { SEVERITY, STATUS, TYPES } = require('./anomalies.js');
const { isoDay, isoDateTime } = require('./dates.js');

const SEV_BADGE = { urgent: 'b-act', system: 'b-watch', standard: 'b-info' };
const ST_BADGE = { open: 'b-act', in_progress: 'b-watch', waiting_client: 'b-neutral', answered: 'b-good', resolved: 'b-good', dismissed: 'b-neutral' };
const qboLink = (url) => (url ? `<a class="qbo-link" href="${esc(url)}" target="_blank" rel="noopener">Ouvrir dans QuickBooks <span aria-hidden="true">↗</span><span class="sr-only">(nouvel onglet)</span></a>` : '');

function anomalyCard(s, a, { back, showClient = true, questionFor = () => null }) {
  const csrf = csrfField(s);
  const hidden = `${csrf}<input type="hidden" name="back" value="${esc(back)}">`;
  const open = ['open', 'in_progress', 'waiting_client', 'answered'].includes(a.status);
  const q = open && a.askable && !(a.task_id && a.task_status === 'open') ? questionFor(a) : null;
  const ask = open && a.askable && !(a.task_id && a.task_status === 'open')
    ? `<details class="an-more"><summary>Demander au client</summary>
        <form class="form mt-4" method="post" action="/anomalies/${a.id}/demander">${hidden}
          ${q ? `<label class="label" for="q-${a.id}">Question envoyée au client <span class="opt">(modifiable)</span></label>
          <textarea class="input" id="q-${a.id}" name="title" maxlength="200">${esc(q.title)}</textarea>
          <p class="t-meta mt-2">Choix proposés : ${q.choices.map(esc).join(' · ')}</p>` : '<p class="t-meta">La question habituelle de QuickBooks sera envoyée (dépense d’entreprise ? d’où vient ce dépôt ?).</p>'}
          <div class="btn-row"><button class="btn btn-plum btn-sm" type="submit">Envoyer au client</button></div></form></details>` : '';
  const closeForms = open ? `<details class="an-more"><summary>Résoudre ou ignorer</summary>
      <form class="form mt-4" method="post" action="/anomalies/${a.id}/resoudre">${hidden}
        <label class="label" for="n-${a.id}">Comment c’est réglé, ou pourquoi l’ignorer</label>
        <textarea class="input" id="n-${a.id}" name="note" maxlength="600" required></textarea>
        <div class="btn-row"><button class="btn btn-plum btn-sm" type="submit">Résolue</button>
        <button class="btn btn-ghost btn-sm" type="submit" formaction="/anomalies/${a.id}/ignorer">Ignorer</button></div></form></details>` : '';
  const answer = a.task_answer && a.status === 'answered' ? `<p class="rc-answer"><b>Réponse du client :</b> ${esc(a.task_answer)}</p>` : '';
  const memory = a.decision && open && a.status !== 'answered'
    ? `<div class="an-memory">${icon('i-info')}<div><p>Dernière réponse du client pour ${esc(a.counterparty)} : <b>${esc(a.decision.answer)}</b> (${esc(isoDay(a.decision.answered_at))}).</p>
      <form class="inline-form" method="post" action="/anomalies/${a.id}/precedente">${hidden}<button class="btn btn-outline btn-sm" type="submit">Résoudre avec cette réponse</button></form></div></div>` : '';
  const events = a.events ? `<ol class="an-history">${a.events.map((e) => `<li><span class="rc-when">${esc(isoDateTime(e.at))}</span> ${esc(STATUS[e.to_status] || e.to_status)}${e.note ? ` — ${esc(e.note)}` : ''}${e.name ? ` <span class="t-meta">(${esc(e.name)})</span>` : ''}</li>`).join('')}</ol>` : '';
  return `<li class="an-item an-${a.severity}" id="an-${a.id}">
    <div class="rc-head"><div>
      ${showClient ? `<p class="t-eyebrow"><span>${esc(a.client)}</span></p>` : ''}
      <p class="an-title">${esc(a.title)}</p>
      <p class="an-tags"><span class="badge ${SEV_BADGE[a.severity]}">${esc(SEVERITY[a.severity])}</span> <span class="badge b-neutral">${esc(TYPES[a.type] || a.type)}</span>
        <span class="badge ${ST_BADGE[a.status]}">${esc(STATUS[a.status])}</span>${a.owner_name ? ` <span class="t-meta">Responsable : ${esc(a.owner_name)}</span>` : ''}</p>
    </div>
    <div class="btn-row">${qboLink(a.qbo_url)}
      ${open && !a.owner_id ? `<form class="inline-form" method="post" action="/anomalies/${a.id}/prendre">${hidden}<button class="btn btn-outline btn-sm" type="submit">Prendre en charge</button></form>` : ''}
      ${!open ? `<form class="inline-form" method="post" action="/anomalies/${a.id}/rouvrir">${hidden}<button class="btn btn-ghost btn-sm" type="submit">Rouvrir</button></form>` : ''}</div></div>
    <p class="an-why">${esc(a.explanation)}</p>
    <p class="an-action"><b>Action recommandée :</b> ${esc(a.action)}</p>
    ${answer}${memory}
    ${a.resolution && !open ? `<p class="t-meta">${a.status === 'dismissed' ? 'Ignorée' : 'Résolue'} le ${esc(isoDay(a.resolved_at))} : ${esc(a.resolution)}</p>` : ''}
    ${ask}${closeForms}
    <details class="an-more"><summary>Historique</summary>${events || ''}<p class="t-meta">Détectée le ${esc(isoDateTime(a.first_seen))} · vue la dernière fois le ${esc(isoDateTime(a.last_seen))}</p></details>
  </li>`;
}

function filters(base, { severity = '', status = 'active' }) {
  const link = (sev, st, label, cur) => `<a class="chip" href="${base}?gravite=${sev}&etat=${st}"${cur ? ' aria-current="true"' : ''}>${esc(label)}</a>`;
  return `<nav class="chips" aria-label="Filtrer">
    ${link('', 'active', 'Toutes les ouvertes', !severity && status === 'active')}
    ${Object.entries(SEVERITY).map(([k, l]) => link(k, 'active', l === 'Système' ? 'Système' : `${l}s`, severity === k && status === 'active')).join('')}
    ${link('', 'closed', 'Fermées', status === 'closed')}</nav>`;
}

function grouped(s, items, opts) {
  if (!items.length) return `<div class="empty">${icon('i-ok', 'i empty-ico')}<p><b>Aucune anomalie.</b></p><p>Les règles tournent chaque heure et après chaque synchronisation QuickBooks.</p></div>`;
  return Object.keys(SEVERITY).map((sev) => {
    const list = items.filter((a) => a.severity === sev);
    if (!list.length) return '';
    return `<h2 class="t-h3 an-group">${esc({ urgent: 'Urgentes', system: 'Système', standard: 'Standard' }[sev])} <span class="badge ${SEV_BADGE[sev]}">${list.length}</span></h2>
      <ul class="rc-list">${list.map((a) => anomalyCard(s, a, opts)).join('')}</ul>`;
  }).join('');
}

function anomaliesPage(s, { items, filter, questionFor, flash }) {
  const n = items.length;
  const urgent = items.filter((a) => a.severity === 'urgent').length;
  const body = `${pageHead('Anomalies', filter.status === 'closed' ? 'Anomalies fermées' : n ? `${n} anomalie${n > 1 ? 's' : ''} ouverte${n > 1 ? 's' : ''}` : 'Aucune anomalie ouverte',
    `Ce que le portail a détecté dans vos dossiers : chaque anomalie dit pourquoi elle compte et quoi faire.${urgent && filter.status !== 'closed' ? ` ${urgent} urgente${urgent > 1 ? 's' : ''}.` : ''}`)}
    ${filters('/anomalies', filter)}
    <article class="card">${grouped(s, items, { back: '/anomalies', questionFor })}</article>`;
  return appPage(s, { title: 'Anomalies', current: '/anomalies', body, flash });
}

function clientAnomaliesTab(s, { client, items, filter, questionFor, shell }) {
  return shell(`${filters(`/clients/${client.id}/anomalies`, filter)}<article class="card">${grouped(s, items, { back: `/clients/${client.id}/anomalies`, showClient: false, questionFor })}</article>`);
}

module.exports = { anomaliesPage, clientAnomaliesTab };
