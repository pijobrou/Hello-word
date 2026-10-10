'use strict';

// Avis des utilisateurs : page « Votre avis » (tous) et page d'administration « Avis »
const { esc, appPage, pageHead, field, csrfField } = require('./views.js');
const { isoDay } = require('./dates.js');
const { TOPICS, STATUS, EASE } = require('./feedback.js');

const statusBadge = (st) => `<span class="badge ${{ new: 'b-watch', read: 'b-info', planned: 'b-info', done: 'b-good', declined: 'b-neutral' }[st]}">${esc(STATUS[st])}</span>`;

function feedbackPage(s, { mine, flash, page = '' }) {
  const csrf = csrfField(s);
  const client = s.user.role === 'client';
  const body = `${pageHead(client ? 'Portail client' : 'Espace BVY', 'Votre avis', client
    ? 'Dites-nous ce qui est simple, ce qui ne l’est pas et ce qui vous manque. Chaque avis est lu par notre équipe et sert à améliorer le portail.'
    : 'Ce qui vous ralentit, ce qui manque, ce qui ne fonctionne pas : chaque avis est lu et sert à améliorer l’outil.')}
    <div class="cols-2"><article class="card"><div class="card-head"><h2 class="t-h3">Donner mon avis</h2></div>
      <form class="form" method="post" action="/avis">${csrf}
        <fieldset class="field"><legend class="label">Le portail est-il facile à utiliser ?</legend>
          <div class="fb-ease">${Object.entries(EASE).map(([v, l]) => `<label><input type="radio" name="ease" value="${v}"> ${esc(l)}</label>`).join('')}</div></fieldset>
        ${field('topic', 'Sujet', `<select class="input" id="topic" name="topic" required><option value="">— choisir —</option>${Object.entries(TOPICS).map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>`)}
        ${field('page', 'Quelle page ? (facultatif)', `<input class="input" id="page" name="page" maxlength="120" value="${esc(page)}" placeholder="Par exemple : Documents, Accueil…">`)}
        ${field('message', 'Votre avis', '<textarea class="input" id="message" name="message" rows="5" maxlength="2000" required placeholder="Ce qui va bien, ce qui est difficile, votre idée…"></textarea>')}
        <p class="t-meta">Ne mettez pas de renseignements confidentiels ici (numéro d’assurance sociale, mots de passe) : pour votre dossier, utilisez Messages.</p>
        <div class="btn-row"><button class="btn btn-plum" type="submit">Envoyer mon avis</button></div></form></article>
    <article class="card"><div class="card-head"><h2 class="t-h3">Mes avis</h2><span class="badge b-neutral">${mine.length}</span></div>
      ${mine.length ? `<ul class="rc-rows">${mine.map((f) => `<li><span><b>${esc(TOPICS[f.topic])}</b> — ${esc(f.message.length > 140 ? `${f.message.slice(0, 140)}…` : f.message)}
        <br><span class="t-meta">${esc(isoDay(f.created_at))}${f.page ? ` · ${esc(f.page)}` : ''}</span>
        ${f.reply ? `<br><span class="fb-reply">Réponse de BVY : ${esc(f.reply)}</span>` : ''}</span>${statusBadge(f.status)}</li>`).join('')}</ul>` : '<p class="t-meta">Vous n’avez pas encore donné d’avis.</p>'}</article></div>`;
  return appPage(s, { title: 'Votre avis', current: '/avis', body, flash });
}

function feedbackAdmin(s, { items, sum, filter, flash }) {
  const csrf = csrfField(s);
  const tabs = [['', 'Tous'], ['new', 'Nouveaux'], ['planned', 'Prévus'], ['done', 'Faits']];
  const body = `${pageHead('Administration', 'Avis des utilisateurs', 'Ce que les clients et l’équipe disent du logiciel : pour décider quoi améliorer en premier.')}
    <nav class="subnav" aria-label="Administration"><a href="/admin">Personnes et clients</a><a href="/cabinet">QBO du cabinet</a><a href="/admin/suggestions">Suggestions</a><a href="/admin/avis" aria-current="page">Avis</a></nav>
    <div class="wq-kpis fb-kpis mt-6">
      <div class="cd-kpi"><small>Facilité (90 jours)</small><b>${sum.ease === null ? '—' : `${String(sum.ease).replace('.', ',')} / 5`}</b><em>${sum.easeCount} réponse${sum.easeCount > 1 ? 's' : ''}</em></div>
      <div class="cd-kpi"><small>Nouveaux avis</small><b>${sum.fresh}</b><em class="${sum.fresh ? 'down' : 'up'}">${sum.fresh ? 'à lire' : 'tout est lu'}</em></div>
      <div class="cd-kpi"><small>Sujets (90 jours)</small><em>${sum.topics.map((t) => `${esc(TOPICS[t.topic])} : ${t.n}`).join('<br>') || '—'}</em></div>
      <div class="cd-kpi"><small>Pages qui posent problème</small><em>${sum.pages.map((p) => `${esc(p.page)} : ${p.n}`).join('<br>') || '—'}</em></div></div>
    <nav class="subnav mt-6" aria-label="Filtrer">${tabs.map(([v, l]) => `<a href="/admin/avis${v ? `?etat=${v}` : ''}"${(filter || '') === v ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('')}</nav>
    <article class="card mt-4">${items.length ? `<ul class="rc-list">${items.map((f) => `<li class="rc-item"><div class="rc-head"><div>
        <p class="t-eyebrow"><span>${esc(f.client_name || 'Équipe BVY')} · ${esc(f.user_name)}</span></p>
        <p><b>${esc(TOPICS[f.topic])}</b>${f.ease ? ` · facilité : ${esc(EASE[f.ease])}` : ''}${f.page ? ` · page : ${esc(f.page)}` : ''}</p>
        <p class="rc-answer">${esc(f.message)}</p><p class="t-meta">${esc(isoDay(f.created_at))}</p></div>${statusBadge(f.status)}</div>
      <form class="rc-search mt-4" method="post" action="/admin/avis/${f.id}">${csrf}
        <label class="rc-f rc-short"><span class="label">État</span><select class="input" name="status">${Object.entries(STATUS).map(([v, l]) => `<option value="${v}"${v === (f.status === 'new' ? 'read' : f.status) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
        <label class="rc-f"><span class="label">Réponse visible par la personne (facultatif)</span><input class="input" name="reply" maxlength="1000" value="${esc(f.reply || '')}"></label>
        <button class="btn btn-outline btn-sm" type="submit">Enregistrer</button></form></li>`).join('')}</ul>` : '<p class="t-meta">Aucun avis pour l’instant.</p>'}</article>`;
  return appPage(s, { title: 'Avis des utilisateurs', current: '/admin', body, flash });
}

module.exports = { feedbackPage, feedbackAdmin };
