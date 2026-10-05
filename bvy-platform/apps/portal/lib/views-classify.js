'use strict';

/**
 * Écrans du classement (workflow 07) : onglet « Classement » du dossier et réglages de l'IA (Administration).
 */

const { esc, appPage, pageHead, field, icon, csrfField } = require('./views.js');
const { formatAmount } = require('./portal.js');
const { isoDay } = require('./dates.js');

const LEVEL = { strong: ['b-good', 'Suggestion forte'], suggest: ['b-info', 'Suggestion'], validate: ['b-watch', 'Validation requise'] };
const SOURCE = { history: 'd’après l’historique du dossier', ai: 'suggestion automatique', none: '' };

function groupCard(s, client, g, chart, w = {}) {
  const csrf = csrfField(s);
  const hidden = `${csrf}<input type="hidden" name="group" value="${esc(g.key)}">`;
  const items = `<details class="an-more"><summary>${g.count > 1 ? `Voir les ${g.count} opérations` : "Voir l’opération"}</summary><div class="table-wrap mt-4"><table class="table"><thead><tr><th scope="col">Date</th><th scope="col">Description</th><th scope="col">Montant</th><th scope="col">QuickBooks</th></tr></thead><tbody>
    ${g.items.map((r) => `<tr><td>${esc(isoDay(r.txn_date))}</td><td>${esc(r.detail || '—')}</td><td class="num">${esc(formatAmount(r.amount_cents))}</td><td>${r.qbo_url ? `<a class="qbo-link" href="${esc(r.qbo_url)}" target="_blank" rel="noopener">Ouvrir ↗</a>` : ''}</td></tr>`).join('')}</tbody></table></div></details>`;
  if (g.todo) {
    return `<li class="an-item cl-todo"><div class="rc-head"><div><p class="an-title">${esc(g.party)} — ${g.count} opération${g.count > 1 ? 's' : ''} — ${esc(formatAmount(g.total))}</p>
      <p class="an-tags"><span class="badge b-good">À faire dans QuickBooks</span> classer en <b>${esc(g.chosen || '')}</b></p></div>
      <form class="inline-form" method="post" action="/clients/${client.id}/classement">${hidden}<input type="hidden" name="action" value="undo"><button class="btn btn-ghost btn-sm" type="submit">Annuler</button></form></div>
      <p class="t-meta">BVY ne modifie pas QuickBooks : ouvrez chaque opération et classez-la ; la prochaine synchronisation la retire de cette liste.</p>${items}</li>`;
  }
  const [cls, label] = LEVEL[g.level];
  return `<li class="an-item cl-${g.level}"><div class="rc-head"><div>
      <p class="an-title">${esc(g.party)} — ${g.count} opération${g.count > 1 ? 's' : ''} non classée${g.count > 1 ? 's' : ''} — ${esc(formatAmount(g.total))}</p>
      ${g.accountName ? `<p class="cl-sugg">Catégorie proposée : <b>${esc(g.accountName)}</b>${g.confidence !== null ? ` · confiance ${g.confidence} %` : ''} <span class="badge ${cls}">${label}</span></p>
        <p class="t-meta">${esc(SOURCE[g.source])}${g.reason ? ` — ${esc(g.reason)}` : ''}${g.agree < g.count ? ` (${g.agree} sur ${g.count})` : ''}</p>`
    : `<p class="cl-sugg"><span class="badge b-watch">Validation requise</span> ${esc(g.reason || 'Pas de proposition.')}</p>`}
      ${g.decision ? `<p class="t-meta">Dernière réponse du client pour ce bénéficiaire : « ${esc(g.decision.answer)} » (${esc(isoDay(g.decision.answered_at))}).</p>` : ''}
    </div></div>
    ${w.canWrite ? `<form class="rc-search cl-write mt-4" method="post" action="/clients/${client.id}/classement">${hidden}<input type="hidden" name="action" value="write">
        <label class="rc-f"><span class="label">Catégorie</span><select class="input" name="accountId" required><option value="">— choisir —</option>${chart.map((a) => `<option value="${esc(a.id)}"${a.id === g.accountId ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
        ${w.taxCodes.length ? `<label class="rc-f rc-short"><span class="label">Taxes</span><select class="input" name="taxCodeId"><option value="">— aucune —</option>${w.taxCodes.map((t) => `<option value="${esc(t.id)}"${t.id === (w.taxFor(g) || '') ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
        <button class="btn btn-plum btn-sm" type="submit">Classer dans QuickBooks${g.count > 1 ? ` (${g.count})` : ''}</button></form>` : ''}
    <div class="btn-row mt-4">
      ${!w.canWrite && g.accountName ? `<form class="inline-form" method="post" action="/clients/${client.id}/classement">${hidden}<input type="hidden" name="action" value="accept"><button class="btn btn-plum btn-sm" type="submit">Accepter pour ${g.count > 1 ? `les ${g.count}` : 'cette opération'}</button></form>` : ''}
      ${w.canWrite ? '' : `<form class="rc-search cl-choose" method="post" action="/clients/${client.id}/classement">${hidden}<input type="hidden" name="action" value="choose">
        <label class="rc-f"><span class="sr-only">Autre catégorie</span><select class="input" name="accountId" required><option value="">${g.accountName ? 'Choisir une autre catégorie' : 'Choisir la catégorie'}</option>${chart.map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></label>
        <button class="btn btn-outline btn-sm" type="submit">Choisir</button></form>`}
      <a class="btn btn-ghost btn-sm" href="/clients/${client.id}/anomalies">Demander au client</a></div>
    ${items}</li>`;
}

function classifyTab(s, { client, groups, chart, settings, shell, w = {} }) {
  const todo = groups.filter((g) => !g.todo);
  const done = groups.filter((g) => g.todo);
  const banner = !settings.aiAvailable || !settings.aiEnabled ? 'Suggestions tirées de l’historique du dossier.' : 'Suggestions tirées de l’historique du dossier, puis suggestions automatiques pour le reste.';
  const inner = `<article class="card"><div class="card-head"><h2 class="t-h3">À classer</h2><span class="badge ${todo.length ? 'b-watch' : 'b-good'}">${todo.reduce((n, g) => n + g.count, 0)}</span></div>
      <p class="t-meta">Seulement ce que QuickBooks n’a pas classé lui-même (comptes « non catégorisés »), regroupé par bénéficiaire. ${banner}</p>
      <form class="mt-4" method="post" action="/clients/${client.id}/classement/relancer">${csrfField(s)}<button class="btn btn-ghost btn-sm" type="submit">Relancer les suggestions</button></form>
      ${todo.length ? `<ul class="rc-list mt-4">${todo.map((g) => groupCard(s, client, g, chart, w)).join('')}</ul>` : `<div class="empty">${icon('i-ok', 'i empty-ico')}<p><b>Rien à classer.</b></p><p>Tout ce que QuickBooks a reçu est catégorisé.</p></div>`}</article>
    ${done.length ? `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">À faire dans QuickBooks</h2><span class="badge b-info">${done.reduce((n, g) => n + g.count, 0)}</span></div><ul class="rc-list">${done.map((g) => groupCard(s, client, g, chart, w)).join('')}</ul></article>` : ''}
    ${writesCard(s, w.writes || [], `/clients/${client.id}/classement`)}`;
  return shell(inner);
}

// « Fait dans QuickBooks par BVY » : chaque écriture, qui, quand, et le bouton Annuler
function writesCard(s, writes, back) {
  if (!writes.length) return '';
  const csrf = csrfField(s);
  return `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Fait dans QuickBooks par BVY</h2></div><ul class="rc-rows">
    ${writes.map((x) => `<li><span>${esc(x.summary)}<br><span class="t-meta">${esc(isoDay(x.at))} · ${esc(x.user_name || '')}${x.undone_at ? ' · annulé' : ''}</span></span>
      ${x.undone_at ? '<span class="badge b-neutral">Annulé</span>' : `<form class="inline-form" method="post" action="/quickbooks/ecritures/${x.id}/annuler">${csrf}<input type="hidden" name="back" value="${esc(back)}"><button class="btn btn-ghost btn-sm" type="submit">Annuler</button></form>`}</li>`).join('')}</ul></article>`;
}

function aiSettingsPage(s, { settings, calls, flash, writeEnabled = true }) {
  const csrf = csrfField(s);
  const body = `${pageHead('Administration', 'Suggestions automatiques', 'Réglages du classement des opérations que QuickBooks n’a pas catégorisées.')}
    <nav class="subnav" aria-label="Administration"><a href="/admin">Personnes et clients</a><a href="/cabinet">QBO du cabinet</a><a href="/admin/suggestions" aria-current="page">Suggestions</a></nav>
    <div class="cols-2"><article class="card"><div class="card-head"><h2 class="t-h3">Réglages</h2><span class="badge ${settings.aiEnabled && settings.aiAvailable ? 'b-good' : 'b-neutral'}">${settings.aiEnabled && settings.aiAvailable ? 'Actives' : 'Inactives'}</span></div>
      ${settings.aiAvailable ? '' : `<div class="alert alert-watch">${icon('i-alert')}<div><p>Le service de suggestions automatiques n’est pas installé sur le serveur du portail (clé dans portail.env, voir DEPLOIEMENT.md). Le classement par l’historique fonctionne quand même.</p></div></div>`}
      <form class="form mt-4" method="post" action="/admin/suggestions">${csrf}
        <div class="field"><label class="check"><input type="checkbox" name="aiEnabled" value="1"${settings.aiEnabled ? ' checked' : ''}> Proposer automatiquement une catégorie quand l’historique du dossier ne suffit pas</label></div>
        <p class="t-meta">Envoyé au service externe de suggestions, pour chaque opération : bénéficiaire, description, montant, date, et le plan comptable du client. Jamais le nom du client. Activez-les seulement quand votre politique de confidentialité et le consentement de vos clients le mentionnent (Loi 25).</p>
        <div class="gv-grid">${field('strong', 'Seuil « suggestion forte » (%)', `<input class="input num" id="strong" name="strong" inputmode="numeric" value="${settings.strong}">`)}
        ${field('suggest', 'Seuil « suggestion » (%) — en dessous : validation requise', `<input class="input num" id="suggest" name="suggest" inputmode="numeric" value="${settings.suggest}">`)}</div>
        <p class="t-meta">BVY ne modifie jamais QuickBooks automatiquement, même au-dessus du seuil fort.</p>
        <div class="btn-row"><button class="btn btn-plum" type="submit">Enregistrer</button></div></form></article>
      <article class="card"><div class="card-head"><h2 class="t-h3">Écriture dans QuickBooks</h2><span class="badge ${writeEnabled ? 'b-good' : 'b-neutral'}">${writeEnabled ? 'Active' : 'Inactive'}</span></div>
        <p>Quand elle est active, « Classer dans QuickBooks », « Créer dans QuickBooks » et « Corriger dans QuickBooks » font le travail directement dans le QuickBooks du client, sur le clic d’un membre de l’équipe (administrateur, comptable principal, tenue de livres, fiscalité). Chaque écriture est vérifiée, enregistrée et peut être annulée.</p>
        <form class="mt-4" method="post" action="/admin/suggestions/ecriture">${csrf}<input type="hidden" name="on" value="${writeEnabled ? '0' : '1'}"><button class="btn ${writeEnabled ? 'btn-outline' : 'btn-plum'} btn-sm" type="submit">${writeEnabled ? 'Désactiver l’écriture' : 'Activer l’écriture'}</button></form></article>
      <article class="card"><div class="card-head"><h2 class="t-h3">Dernières demandes de suggestions</h2></div>
        ${calls.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Date</th><th scope="col">Client</th><th scope="col">Opérations</th><th scope="col">Résultat</th></tr></thead><tbody>
        ${calls.map((c) => `<tr><td>${esc(isoDay(c.at))}</td><td>${esc(c.client || '—')}</td><td class="num">${c.items}</td><td>${c.ok ? 'OK' : `<span class="badge b-act">Échec</span> ${esc(c.error || '')}`}</td></tr>`).join('')}</tbody></table></div>` : '<p class="t-meta">Aucune demande pour l’instant.</p>'}
        <p class="t-meta mt-4">Le journal ne garde jamais le contenu envoyé : seulement la date, le client, le nombre d’opérations et le résultat.</p></article></div>`;
  return appPage(s, { title: 'Suggestions automatiques', current: '/admin', body, flash });
}

module.exports = { classifyTab, aiSettingsPage, writesCard };
