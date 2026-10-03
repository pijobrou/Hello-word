'use strict';

/**
 * Écrans de la santé financière (workflow 15, onglet du dossier) et des résumés (workflow 16).
 */

const { esc, appPage, pageHead, field, icon, csrfField } = require('./views.js');
const { formatAmount, HEALTH } = require('./portal.js');
const { TYPES } = require('./summaries.js');
const { isoDay, isoDateTime } = require('./dates.js');

const BADGE = { good: 'b-good', watch: 'b-watch', action: 'b-act' };
const money = (c) => (c === null || c === undefined ? 'non disponible' : formatAmount(c));
const amt = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));

/* ============================================================ santé */
function healthTab(s, { client, h, shell }) {
  const csrf = csrfField(s);
  const list = h.indicators.length
    ? `<ul class="hl-list">${h.indicators.map((i) => `<li class="hl-${i.state}"><span class="hl-dot" aria-hidden="true"></span><span><b>${esc(i.label)}</b> · ${esc(HEALTH[i.state])}<br><small>${esc(i.why)}</small></span></li>`).join('')}</ul>`
    : '<p class="t-meta">Pas assez de données : reliez QuickBooks ou publiez les chiffres du tableau de bord, et remplissez le profil fiscal.</p>';
  const missing = ['cash', 'profit', 'receivable', 'expenses', 'taxes'].filter((k) => !h.indicators.some((i) => i.key === k));
  const names = { cash: 'argent disponible', profit: 'rentabilité', receivable: 'clients qui doivent', expenses: 'dépenses', taxes: 'taxes et échéances' };
  const inner = `<div class="cols-2">
    <article class="card"><div class="card-head"><h2 class="t-h3">Santé calculée</h2>${h.overall ? `<span class="badge ${BADGE[h.overall]}">${esc(HEALTH[h.overall])}</span>` : ''}</div>
      ${list}
      ${missing.length && h.indicators.length ? `<p class="t-meta mt-4">Pas assez de données pour : ${missing.map((k) => names[k]).join(', ')}.</p>` : ''}
      <p class="t-meta mt-4">Recalculée à chaque affichage, à partir des chiffres du tableau de bord${h.asOf ? ` (au ${esc(h.asOf)})` : ''}, des échéances, des demandes du gouvernement et de la paie.</p></article>
    <article class="card"><div class="card-head"><h2 class="t-h3">Ce que voit le client</h2>${h.state ? `<span class="badge ${BADGE[h.state]}">${esc(HEALTH[h.state])}</span>` : ''}</div>
      <form class="form" method="post" action="/clients/${client.id}/sante">${csrf}
        ${field('comment', 'Le mot de BVY au client <span class="opt">(facultatif)</span>', `<textarea class="input" id="comment" name="comment" maxlength="1000" placeholder="Ex. : Septembre a été plus calme ; on regarde ensemble la marge de crédit avant l’hiver.">${esc(h.comment || '')}</textarea>`)}
        ${field('state', 'État global', `<select class="input" id="state" name="state"><option value="">Calculé (${esc(HEALTH[h.overall] || 'non évalué')})</option>${Object.entries(HEALTH).map(([k, l]) => `<option value="${k}"${h.override && h.state === k ? ' selected' : ''}>Choisi par BVY : ${esc(l)}</option>`).join('')}</select>`)}
        ${field('why', 'Pourquoi <span class="opt">(obligatoire si vous choisissez l’état)</span>', `<textarea class="input" id="why" name="why" maxlength="600">${esc(h.override ? h.why || '' : '')}</textarea>`)}
        <div class="btn-row"><button class="btn btn-plum" type="submit">Enregistrer</button></div></form>
      ${h.noteAt ? `<p class="t-meta mt-4">Dernière mise à jour par ${esc(h.noteBy || 'BVY')} le ${esc(isoDateTime(h.noteAt))}.</p>` : ''}</article></div>`;
  return shell(inner);
}

/* ========================================================== résumés */
// Le document tel que le client le voit (aperçu côté équipe, page côté client).
function summaryDoc(x) {
  const f = x.figures || {};
  const d = x.data;
  const net = f.income !== null && f.income !== undefined && f.expenses !== null && f.expenses !== undefined ? f.income - f.expenses : null;
  const prevNet = f.prevIncome !== null && f.prevIncome !== undefined && f.prevExpenses !== null && f.prevExpenses !== undefined ? f.prevIncome - f.prevExpenses : null;
  const row = (label, cur, prev) => `<tr><th scope="row">${esc(label)}</th><td class="num">${esc(money(cur))}</td><td class="num">${prev === null || prev === undefined ? '—' : esc(money(prev))}</td></tr>`;
  return `<div class="sm-doc">
    <section><h2 class="t-h3">En bref</h2><p class="sm-intro">${esc(x.intro || '')}</p></section>
    <section><h2 class="t-h3">Les chiffres</h2>
      ${f.income === null && f.expenses === null ? '<p class="t-meta">Chiffres non disponibles pour cette période.</p>' : `<div class="table-wrap"><table class="table"><thead><tr><th scope="col"></th><th scope="col">${esc(x.label)}</th><th scope="col">${esc(f.prevLabel || 'Période précédente')}</th></tr></thead><tbody>
        ${row('Revenus', f.income, f.prevIncome)}${row('Dépenses', f.expenses, f.prevExpenses)}${row(net !== null && net < 0 ? 'Perte' : 'Bénéfice', net === null ? null : Math.abs(net), prevNet === null ? null : Math.abs(prevNet))}</tbody></table></div>
        <p class="t-meta">${f.source === 'qbo' ? 'Selon QuickBooks.' : f.source === 'staff' ? 'Chiffres préparés par BVY.' : ''}</p>`}
      ${d.balances ? `<ul class="sm-bal"><li><span>Argent disponible</span><b>${esc(money(d.balances.cash))}</b></li><li><span>Vos clients vous doivent</span><b>${esc(money(d.balances.receivable))}</b></li><li><span>Factures à payer</span><b>${esc(money(d.balances.payable))}</b></li></ul><p class="t-meta">Au ${esc(d.balances.asOf)}.</p>` : ''}</section>
    ${d.changes.length ? `<section><h2 class="t-h3">Ce qui a changé</h2><ul class="sm-list">${d.changes.map((c) => `<li><b>${esc(c.what)}</b>${c.why ? `<br><small>${esc(c.why)}</small>` : ''}</li>`).join('')}</ul></section>` : ''}
    <section><h2 class="t-h3">À surveiller</h2>${d.watch.length ? `<ul class="hl-list">${d.watch.map((w) => `<li class="hl-${w.state}"><span class="hl-dot" aria-hidden="true"></span><span><b>${esc(w.label)}</b> · ${esc(HEALTH[w.state])}<br><small>${esc(w.why)}</small></span></li>`).join('')}</ul><p class="t-meta">Au ${esc(d.healthAsOf)}.</p>` : '<p>Rien de particulier à surveiller.</p>'}</section>
    <section><h2 class="t-h3">Ce que vous avez à faire</h2>${d.todo.length ? `<ul class="sm-list">${d.todo.map((t) => `<li>${esc(t.title)}${t.due_date ? ` <small>— d’ici le ${esc(t.due_date)}</small>` : ''}</li>`).join('')}</ul>` : '<p>Rien pour l’instant : tout est à jour de votre côté.</p>'}</section>
    <section><h2 class="t-h3">Ce que BVY a fait pour vous</h2>${d.bvy.length ? `<ul class="sm-bvy">${d.bvy.map((b) => `<li><b>${b.n}</b><span>${esc(b.label)}</span></li>`).join('')}</ul>` : '<p>Suivi courant de votre dossier.</p>'}</section>
  </div>`;
}

function generateForm(s, { clientId = null } = {}) {
  return `<form class="rc-search" method="post" action="/resumes/preparer">${csrfField(s)}${clientId ? `<input type="hidden" name="clientId" value="${clientId}">` : ''}
    <label class="rc-f"><span class="label">Résumé</span><select class="input" name="type">${Object.entries(TYPES).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
    <label class="rc-f rc-short"><span class="label">Fin de période <span class="opt">(vide = la dernière)</span></span><input class="input" name="endYm" type="month"></label>
    <button class="btn btn-outline btn-sm" type="submit">Préparer ${clientId ? 'le brouillon' : 'les brouillons'}</button></form>`;
}

function list(items, { showClient = true } = {}) {
  if (!items.length) return `<div class="empty">${icon('i-ok', 'i empty-ico')}<p><b>Aucun résumé ici.</b></p><p>Les brouillons mensuels se préparent seuls le 3 du mois.</p></div>`;
  return `<div class="table-wrap"><table class="table"><thead><tr>${showClient ? '<th scope="col">Client</th>' : ''}<th scope="col">Période</th><th scope="col">Type</th><th scope="col">État</th><th scope="col">Mis à jour</th></tr></thead><tbody>
    ${items.map((x) => `<tr>${showClient ? `<td>${esc(x.client)}</td>` : ''}<td><a class="link" href="/resumes/${x.id}">${esc(x.label)}</a></td><td>${esc(TYPES[x.period_type])}</td>
      <td>${x.status === 'published' ? `<span class="badge b-good">Publié${x.version > 1 ? ` (v${x.version})` : ''}</span>` : `<span class="badge b-watch">Brouillon${x.version ? ' (modifié après publication)' : ''}</span>`}</td><td>${esc(isoDay(x.updated_at))}</td></tr>`).join('')}</tbody></table></div>`;
}

function board(s, { items, status, flash }) {
  const body = `${pageHead('Résumés', status === 'published' ? 'Résumés publiés' : items.length ? `${items.length} brouillon${items.length > 1 ? 's' : ''} à relire` : 'Aucun brouillon à relire',
    'Un résumé en mots simples pour chaque client : les chiffres, ce qui a changé, ce qu’il faut surveiller, ce que BVY a fait. Rien n’est envoyé sans « Publier ».')}
    <nav class="chips" aria-label="Filtrer"><a class="chip" href="/resumes"${status === 'published' ? '' : ' aria-current="true"'}>À relire</a><a class="chip" href="/resumes?etat=published"${status === 'published' ? ' aria-current="true"' : ''}>Publiés</a></nav>
    <article class="card">${list(items)}</article>
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Préparer des résumés pour tous vos clients</h2></div>${generateForm(s)}</article>`;
  return appPage(s, { title: 'Résumés', current: '/resumes', body, flash });
}

function editor(s, { x, flash }) {
  const csrf = csrfField(s);
  const f = x.figures || {};
  const body = `${pageHead(x.client.name, `Résumé — ${x.label}`, `${esc(TYPES[x.period_type])} · du ${esc(x.period_start)} au ${esc(x.period_end)} · ${x.status === 'published' ? `publié (version ${x.version})` : x.version ? `brouillon modifié après la version ${x.version}` : 'brouillon, pas encore envoyé'}`)}
    <div class="cols-2">
      <article class="card"><div class="card-head"><h2 class="t-h3">Relire et compléter</h2></div>
        <form class="form" method="post" action="/resumes/${x.id}/modifier">${csrf}
          ${field('intro', 'En bref (lu en premier par le client)', `<textarea class="input" id="intro" name="intro" maxlength="2000" required>${esc(x.intro || '')}</textarea>`)}
          <div class="gv-grid">${field('income', `Revenus ($)${f.source === 'qbo' ? ' — QuickBooks' : ''}`, `<input class="input num" id="income" name="income" inputmode="decimal" value="${esc(amt(f.income))}">`)}
          ${field('expenses', `Dépenses ($)${f.source === 'qbo' ? ' — QuickBooks' : ''}`, `<input class="input num" id="expenses" name="expenses" inputmode="decimal" value="${esc(amt(f.expenses))}">`)}</div>
          <p class="t-meta">${f.source === 'qbo' ? 'Chiffres lus dans QuickBooks pour la période exacte.' : 'QuickBooks n’a pas fourni ces chiffres : entrez-les, ou laissez vide (« non disponible »).'}</p>
          <div class="btn-row"><button class="btn btn-outline" type="submit">Enregistrer</button></div></form>
        <div class="btn-row mt-6">
          <form method="post" action="/resumes/${x.id}/publier">${csrf}<button class="btn btn-plum" type="submit">${x.version ? 'Publier la nouvelle version' : 'Publier pour le client'}</button></form>
          <form method="post" action="/resumes/${x.id}/actualiser">${csrf}<button class="btn btn-ghost btn-sm" type="submit">Recalculer les sections</button></form></div>
        <p class="t-meta mt-4">Le client est prévenu par courriel, sans aucun montant.</p>
        ${x.versions.length ? `<p class="t-meta mt-4">Versions publiées : ${x.versions.map((v) => `v${v.version} le ${esc(isoDateTime(v.published_at))}${v.name ? ` (${esc(v.name)})` : ''}`).join(' · ')}</p>` : ''}</article>
      <article class="card sm-preview"><div class="card-head"><h2 class="t-h3">Aperçu — ce que verra le client</h2></div>${summaryDoc(x)}</article></div>`;
  return appPage(s, { title: `Résumé — ${x.label}`, current: '/resumes', body, flash });
}

function clientTab(s, { client, items, shell }) {
  return shell(`<article class="card"><div class="card-head"><h2 class="t-h3">Résumés du client</h2></div>${generateForm(s, { clientId: client.id })}<div class="mt-6">${list(items, { showClient: false })}</div></article>`);
}

// Côté client : la page d'un résumé publié.
function clientSummary(s, { x, nav }) {
  const body = `${pageHead('Rapports', `Votre résumé — ${x.label}`, `Préparé par BVY le ${esc(isoDay(x.publishedAt))}.`)}
    <article class="card">${summaryDoc(x)}</article>
    <p class="mt-6"><a class="link" href="/rapports">← Tous vos rapports</a></p>`;
  return appPage(s, { title: `Résumé — ${x.label}`, current: '/rapports', body, nav });
}

module.exports = { healthTab, summaryDoc, board, editor, clientTab, clientSummary };
