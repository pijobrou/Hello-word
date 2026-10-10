'use strict';

/**
 * Écrans de la paie (workflow 12). Le calcul se fait dans QuickBooks Paie ; ces écrans organisent le travail.
 */

const { esc, appPage, pageHead, field, icon, csrfField } = require('./views.js');
const { formatAmount } = require('./portal.js');
const { isoDateTime } = require('./dates.js');
const { STATES, FREQ, COMPONENTS } = require('./payroll.js');

const BADGE = { waiting: 'b-watch', hours_received: 'b-info', validation: 'b-watch', preparing: 'b-info', ready: 'b-good', done: 'b-neutral' };
const NEXT = { waiting: 'Le client doit transmettre les heures', hours_received: 'Calculer dans QuickBooks Paie, puis inscrire le sommaire',
  validation: 'Le client doit approuver le sommaire', preparing: 'Finaliser dans QuickBooks Paie', ready: 'Verser la paie à la date prévue', done: '—' };
const badge = (st) => `<span class="badge ${BADGE[st]}">${esc(STATES[st])}</span>`;
const qboLink = (url, label = 'Ouvrir la paie dans QuickBooks') => `<a class="qbo-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span><span class="sr-only">(nouvel onglet)</span></a>`;
const fmtH = (n) => (n ? String(n).replace('.', ',') : '—');

/* ------------------------------------------------- équipe : menu « Paie » */
function payrollBoard(s, { board, flash }) {
  const open = board.rows.filter((r) => r.status !== 'done');
  const late = open.filter((r) => r.late);
  const tile = (label, value, line, tone = '') => `<div class="cd-kpi"><small>${esc(label)}</small><b>${value}</b><em class="${tone}">${line}</em></div>`;
  const kpis = `<div class="wq-kpis wq-kpis-3">
    ${tile('Paies en cours', String(open.length), open.length ? 'à suivre jusqu’au versement' : 'aucune paie en cours')}
    ${tile('En retard', String(late.length), late.length ? 'date de paie proche, pas encore prêtes' : 'tout est dans les temps', late.length ? 'down' : 'up')}
    ${tile('Chez le client', String(open.filter((r) => ['waiting', 'validation'].includes(r.status)).length), 'heures ou approbation attendues')}
  </div>`;
  const table = (rows) => `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Client</th><th scope="col">Date de paie</th><th scope="col">État</th><th scope="col">Prochaine étape</th><th scope="col">Brut</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><a class="link" href="/clients/${r.client_id}/paie"><b>${esc(r.client_name)}</b></a></td>
      <td class="nowrap">${r.late ? `<span class="wq-due late"><b>${esc(r.pay_date)}</b><span>en retard</span></span>` : esc(r.pay_date)}</td>
      <td>${badge(r.status)}</td><td>${esc(NEXT[r.status])}</td><td class="num">${r.gross_cents === null ? '<span class="t-meta">—</span>' : esc(formatAmount(r.gross_cents))}</td>
      <td class="nowrap"><a class="btn btn-outline btn-sm" href="/paie/${r.id}">Ouvrir</a> ${qboLink(r.qboUrl, 'QuickBooks')}</td></tr>`).join('')}
    </tbody></table></div>`;
  const sections = board.groups.filter((g) => g.rows.length).map((g) => `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">${esc(g.label)}</h2><span class="t-meta">${g.rows.length}</span></div>${table(g.rows)}</article>`).join('');
  const body = `${pageHead('Paie', 'Les paies de vos clients', 'Chaque paie, de la demande d’heures au versement. Le calcul se fait dans QuickBooks Paie ; ici, on suit qui doit faire quoi.')}
    ${kpis}${sections || `<article class="card mt-6"><div class="empty">${icon('i-users', 'i empty-ico')}<p><b>Aucune paie pour l’instant.</b></p><p>Dans le dossier d’un client avec employés, onglet « Paie », choisissez sa fréquence de paie et la prochaine date : les paies se créeront toutes seules.</p></div></article>`}`;
  return appPage(s, { title: 'Paie', current: '/paie', body, flash });
}

/* ------------------------------------- équipe : onglet « Paie » d'un client */
function clientPayrollTab(s, { client, schedule, employees, runs, qboUrl, shell, ytd = null, yearEnd = [] }) {
  const csrf = csrfField(s);
  if (!client.payroll) {
    return shell(`<article class="card"><p>Ce client n’a pas d’employés selon son profil fiscal. Cochez « A des employés » dans l’onglet <a class="link" href="/clients/${client.id}/echeances">Échéances</a> pour gérer sa paie.</p></article>`);
  }
  const opt = (v, l, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(l)}</option>`;
  const sc = schedule || {};
  const cal = `<article class="card"><div class="card-head"><h2 class="t-h3">Calendrier de paie</h2></div>
    <form class="form" method="post" action="/clients/${client.id}/paie/calendrier">${csrf}
      ${field('frequency', 'Fréquence', `<select class="input" id="frequency" name="frequency" required><option value="">— Choisir —</option>${Object.entries(FREQ).map(([v, l]) => opt(v, l, sc.frequency || '')).join('')}</select>`)}
      ${field('nextPayDate', 'Prochaine date de paie', `<input class="input" id="nextPayDate" name="nextPayDate" type="date" required value="${esc(sc.next_pay_date || '')}">`)}
      ${field('leadDays', 'Demander les heures combien de jours avant', `<input class="input num" id="leadDays" name="leadDays" inputmode="numeric" value="${esc(sc.lead_days || 3)}">`)}
      ${field('qboUrl', 'Lien vers la paie dans QuickBooks <span class="opt">(facultatif)</span>', `<input class="input" id="qboUrl" name="qboUrl" placeholder="https://app.qbo.intuit.com/app/payroll" value="${esc(sc.qbo_url || '')}">`)}
      <div class="field"><label class="check"><input type="checkbox" name="active" value="0"${schedule && !schedule.active ? ' checked' : ''}> Suspendre les demandes d’heures</label></div>
      <div class="btn-row"><button class="btn btn-plum" type="submit">Enregistrer le calendrier</button></div></form>
    <p class="t-meta mt-4">La paie est créée et les heures demandées au client automatiquement, ce nombre de jours avant chaque date de paie.</p></article>`;
  const emp = `<article class="card"><div class="card-head"><h2 class="t-h3">Employés</h2><span class="t-meta">noms seulement</span></div>
    ${employees.length ? `<ul class="emp-list">${employees.map((e) => `<li${e.active ? '' : ' class="task-done"'}><span><b>${esc(e.name)}</b> <span class="t-meta">${e.pay_type === 'salary' ? 'salarié' : 'à l’heure'}${e.active ? '' : ' · inactif'}</span></span>
      <form class="inline-form" method="post" action="/clients/${client.id}/paie/employes/${e.id}/${e.active ? 'desactiver' : 'reactiver'}">${csrf}<button class="btn btn-ghost btn-sm" type="submit">${e.active ? 'Retirer' : 'Rétablir'}</button></form></li>`).join('')}</ul>` : '<p class="t-meta">Aucun employé inscrit.</p>'}
    <form class="form mt-4" method="post" action="/clients/${client.id}/paie/employes">${csrf}
      ${field('e-name', 'Nom de l’employé', '<input class="input" id="e-name" name="name" required maxlength="120">')}
      ${field('e-type', 'Type', '<select class="input" id="e-type" name="payType"><option value="hourly">À l’heure</option><option value="salary">Salarié</option></select>')}
      <div class="btn-row"><button class="btn btn-outline" type="submit">Ajouter l’employé</button></div></form>
    <p class="t-meta mt-4">Le NAS, l’adresse, le compte bancaire et le taux de salaire restent dans QuickBooks Paie, jamais ici.</p></article>`;
  const hist = `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Paies</h2>${qboLink(qboUrl)}</div>
    ${runs.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Date de paie</th><th scope="col">État</th><th scope="col">Brut</th><th scope="col">Net</th><th scope="col">À remettre</th><th scope="col">Versement d’ici le</th><th scope="col">Coût total</th><th scope="col"><span class="sr-only">Ouvrir</span></th></tr></thead><tbody>
      ${runs.map((r) => `<tr><td>${esc(r.pay_date)}</td><td>${badge(r.status)}</td><td class="num">${esc(formatAmount(r.gross_cents))}</td><td class="num">${esc(formatAmount(r.net_cents))}</td>
        <td class="num">${r.gross_cents === null ? '—' : esc(formatAmount(r.totals.remit))}</td><td>${r.gross_cents === null ? '—' : esc(r.remitDue)}</td><td class="num">${r.gross_cents === null ? '—' : esc(formatAmount(r.totals.cost))}</td><td><a class="link" href="/paie/${r.id}">Ouvrir</a></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="t-meta">Aucune paie encore. Elles se créent selon le calendrier.</p>'}</article>`;
  const m = (c) => esc(formatAmount(c || 0));
  const ytdCard = ytd ? `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Cumul ${ytd.year} — base des T4, RL-1 et de la déclaration CNESST</h2><span class="t-meta">${ytd.runs} paie${ytd.runs > 1 ? 's' : ''} terminée${ytd.runs > 1 ? 's' : ''}</span></div>
    ${ytd.runs ? `<dl class="pay-sum pay-sum-4"><div><dt>Salaires bruts</dt><dd>${m(ytd.gross)}</dd></div><div><dt>Remis à l’ARC</dt><dd>${m(ytd.arc)}</dd></div><div><dt>Remis à Revenu Québec</dt><dd>${m(ytd.rq)}</dd></div><div><dt>Coût total</dt><dd>${m(ytd.cost)}</dd></div></dl>
      <div class="table-wrap mt-4"><table class="table pay-detail"><tbody>${COMPONENTS.filter(([k]) => ytd.by[k]).map(([k, label]) => `<tr><td>${esc(label)}</td><td class="num">${m(ytd.by[k])}</td></tr>`).join('')}</tbody></table></div>
      <p class="t-meta mt-4">Cumul des paies terminées dont la date de paie est en ${ytd.year}. À rapprocher du sommaire annuel de QuickBooks Paie avant de produire les feuillets.</p>` : '<p class="t-meta">Aucune paie terminée cette année.</p>'}</article>` : '';
  const yearCard = `<article class="card mt-6"><div class="card-head"><h2 class="t-h3">Production de fin d’année et relevés</h2><a class="link" href="/clients/${client.id}/echeances">Toutes les échéances</a></div>
    ${yearEnd.length ? `<ul class="wq-list">${yearEnd.map((d) => `<li><span class="wq-due ${d.mark ? 'later' : d.urgency.level}"><b>${esc(d.date)}</b><span>${d.mark === 'done' ? 'fait' : d.mark === 'na' ? 'ne s’applique pas' : esc(d.urgency.level === 'late' ? `en retard ${-d.urgency.days} j` : `dans ${d.urgency.days} j`)}</span></span><span>${esc(d.title)}</span></li>`).join('')}</ul>`
    : '<p class="t-meta">Aucune échéance de fin d’année d’ici un an.</p>'}
    <p class="t-meta mt-4">T4 et Sommaire T4 (ARC), RL-1 et Sommaire RL-1 (Revenu Québec) : au plus tard le dernier jour de février. Déclaration des salaires CNESST : 15 mars. Relevé d’emploi : ajouté automatiquement quand un employé est retiré (5 jours). Marquez-les « Fait » dans l’onglet Échéances.</p></article>`;
  return shell(`<div class="cols-2">${cal}${emp}</div>${hist}${ytdCard}${yearCard}`);
}

/* ----------------------------------------------- fiche d'une paie (équipe) */
function hoursTable(run) {
  const h = run.hours;
  if (!h || !h.lines || !h.lines.length) return '';
  return `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">Employé</th><th scope="col">Heures</th><th scope="col">Supplémentaires</th><th scope="col">Congés / maladie</th><th scope="col">Note</th></tr></thead><tbody>
    ${h.lines.map((l) => `<tr><td>${esc(l.name)}</td><td class="num">${fmtH(l.regular)}</td><td class="num">${fmtH(l.overtime)}</td><td class="num">${fmtH(l.leave)}</td><td>${esc(l.note || '')}</td></tr>`).join('')}
    </tbody></table></div>`;
}

const money = (c) => esc(formatAmount(c || 0));
const GROUP_TITLE = { employee: 'Retenues sur la paie des employés', employer: 'Cotisations de l’employeur', vacation: 'Vacances' };

// Sommaire détaillé : tout ce que la paie coûte et tout ce qu'il faut remettre, avec les totaux calculés.
function summaryBlock(run, { forClient = false } = {}) {
  if (run.gross_cents === null) return '';
  const t = run.totals; const b = run.breakdown || {};
  const lines = (g) => COMPONENTS.filter(([k, , gr]) => gr === g && b[k]).map(([k, label, , to]) => `<tr><td>${esc(label)}${to ? ` <span class="t-meta">${to === 'arc' ? 'ARC' : 'Revenu Québec'}</span>` : ''}</td><td class="num">${money(b[k])}</td></tr>`).join('');
  const group = (g, total) => { const l = lines(g); return l ? `<tr class="pay-group"><th scope="rowgroup" colspan="2">${esc(GROUP_TITLE[g])}</th></tr>${l}${total === undefined ? '' : `<tr class="pay-subtotal"><td>Total</td><td class="num">${money(total)}</td></tr>`}` : ''; };
  return `<dl class="pay-sum">
      <div><dt>Brut</dt><dd>${money(run.gross_cents)}</dd></div>
      <div><dt>Net versé aux employés</dt><dd>${money(run.net_cents)}</dd></div>
      <div class="pay-remit"><dt>À remettre d’ici le ${esc(run.remitDue)}</dt><dd>${money(t.remit)}</dd><span>ARC ${money(t.arc)} · Revenu Québec ${money(t.rq)}</span></div>
      <div class="pay-cost"><dt>${forClient ? 'Ce que cette paie coûte à l’entreprise' : 'Coût total pour l’entreprise'}</dt><dd>${money(t.cost)}</dd><span>brut + cotisations de l’employeur${b.vacationAccrued ? ' + vacances accumulées' : ''}</span></div>
    </dl>
    <div class="table-wrap mt-4"><table class="table pay-detail"><caption class="sr-only">Détail de la paie</caption><tbody>
      ${group('employee', t.employee)}${group('employer', t.employer)}${group('vacation')}
    </tbody></table></div>
    ${!forClient && t.gap ? `<p class="wq-late mt-4">Écart de ${money(Math.abs(t.gap))} entre brut − retenues des employés et le net : vérifiez la saisie (autres retenues ?).</p>` : ''}
    <p class="t-meta mt-4">${run.employees_paid ? `${run.employees_paid} employé${run.employees_paid > 1 ? 's' : ''} payé${run.employees_paid > 1 ? 's' : ''} · ` : ''}Retenues et cotisations versées à l’ARC et à Revenu Québec au plus tard le ${esc(run.remitDue)} (remettant régulier). La cotisation CNESST est versée à Revenu Québec avec les retenues.</p>`;
}

function payRunStaff(s, { run, client, events, qboUrl, flash }) {
  const csrf = csrfField(s);
  const amt = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));
  const act = (action, label, cls = 'btn-plum', withNote = false) => `<form class="form" method="post" action="/paie/${run.id}/etat">${csrf}<input type="hidden" name="action" value="${action}">
    ${withNote ? field(`n-${action}`, withNote, `<input class="input" id="n-${action}" name="note" maxlength="300"${action === 'back' ? ' required' : ''}>`) : ''}
    <div class="btn-row"><button class="btn ${cls} btn-sm" type="submit">${esc(label)}</button></div></form>`;
  const num = (k, label, val) => field(k, label, `<input class="input num" id="${k}" name="${k}" inputmode="decimal" value="${esc(amt(val))}">`);
  const b = run.breakdown || {};
  const summaryForm = ['hours_received', 'validation'].includes(run.status) ? `<form class="form mt-4" method="post" action="/paie/${run.id}/sommaire">${csrf}
      <p class="t-meta">Recopiez les montants du sommaire de paie de QuickBooks Paie. Le portail calcule ce qu’il faut remettre à l’ARC et à Revenu Québec, et le coût total.</p>
      <fieldset class="pay-fs"><legend>Paie</legend><div class="pay-grid">
        ${num('gross', 'Brut ($)', run.gross_cents)}${num('net', 'Net versé ($)', run.net_cents)}
        ${field('employeesPaid', 'Employés payés', `<input class="input num" id="employeesPaid" name="employeesPaid" inputmode="numeric" required value="${esc(run.employees_paid || '')}">`)}</div></fieldset>
      ${['employee', 'employer', 'vacation'].map((g) => `<fieldset class="pay-fs"><legend>${esc(GROUP_TITLE[g])}</legend><div class="pay-grid">
        ${COMPONENTS.filter(([, , gr]) => gr === g).map(([k, label]) => num(k, `${label} ($)`, b[k])).join('')}</div></fieldset>`).join('')}
      <div class="btn-row"><button class="btn btn-plum" type="submit">${run.status === 'validation' ? 'Corriger le sommaire' : 'Envoyer le sommaire au client pour approbation'}</button></div></form>` : '';
  const actions = [
    run.status === 'waiting' ? act('hours', 'Heures reçues hors du portail', 'btn-outline', 'Comment les avez-vous reçues ? (facultatif)') : '',
    run.status === 'preparing' ? act('ready', 'Marquer « Prête »') : '',
    run.status === 'ready' ? act('done', 'Marquer « Terminée » (paie versée)') : '',
    !['waiting', 'done'].includes(run.status) ? `<details class="disclose mt-4"><summary>Revenir à l’étape précédente</summary><div>${act('back', 'Revenir en arrière', 'btn-ghost', 'Raison (obligatoire)')}</div></details>` : '',
  ].join('');
  const body = `${pageHead(client.name, `Paie du ${run.pay_date}`, NEXT[run.status])}
    <p>${badge(run.status)} ${qboLink(qboUrl)}</p>
    <div class="cols-2 mt-6">
      <article class="card"><div class="card-head"><h2 class="t-h3">Heures transmises</h2></div>
        ${run.hours ? `<p class="t-meta">Par ${esc(run.hours.by || 'le client')} le ${esc(isoDateTime(run.hours.at))}</p>${hoursTable(run)}${run.hours.note ? `<p class="mt-4"><b>Note :</b> ${esc(run.hours.note)}</p>` : ''}` : '<p class="t-meta">Pas encore reçues.</p>'}
        ${run.timesheet_doc_id ? `<p class="mt-4"><a class="link" href="/documents/${run.timesheet_doc_id}/telecharger">Télécharger la feuille de temps</a></p>` : ''}
        ${run.client_comment && run.status === 'hours_received' && run.gross_cents !== null ? `<div class="alert alert-watch mt-4">${icon('i-alert')}<div><p class="alert-title">Le client a refusé le sommaire</p><p>${esc(run.client_comment)}</p></div></div>` : ''}</article>
      <article class="card"><div class="card-head"><h2 class="t-h3">Étapes</h2></div>
        <p>${esc(NEXT[run.status])}.</p>${actions || '<p class="t-meta">Aucune action à cette étape.</p>'}</article>
    </div>
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Sommaire de la paie</h2></div>
      ${summaryBlock(run) || '<p class="t-meta">Calculez la paie dans QuickBooks Paie, puis inscrivez ici le détail du sommaire.</p>'}
      ${summaryForm}</article>
    <article class="card mt-6"><div class="card-head"><h2 class="t-h3">Historique</h2></div>
      <ul class="pay-events">${events.map((e) => `<li><span class="t-meta">${esc(isoDateTime(e.at))}</span> ${e.from_status ? `${esc(STATES[e.from_status])} → ` : ''}<b>${esc(STATES[e.to_status])}</b>${e.user_name ? ` · ${esc(e.user_name)}` : ''}${e.note ? ` — ${esc(e.note)}` : ''}</li>`).join('')}</ul></article>`;
  return appPage(s, { title: `Paie du ${run.pay_date}`, current: '/paie', body, flash });
}

/* ----------------------------------------------- fiche d'une paie (client) */
function payRunClient(s, { run, employees, nav, flash }) {
  const csrf = csrfField(s);
  let main;
  if (run.status === 'waiting') {
    main = `<article class="card"><div class="card-head"><h2 class="t-h3">Heures de la paie du ${esc(run.pay_date)}</h2></div>
      <p>Entrez les heures de chaque employé <b>ou</b> joignez votre feuille de temps. Laissez vide un employé qui n’a pas travaillé.</p>
      <form class="form mt-4" method="post" action="/paie/${run.id}/heures" enctype="multipart/form-data">${csrf}
        ${employees.length ? `<div class="table-wrap"><table class="table hours-table"><thead><tr><th scope="col">Employé</th><th scope="col">Heures</th><th scope="col">Supplémentaires</th><th scope="col">Congés / maladie</th><th scope="col">Note</th></tr></thead><tbody>
          ${employees.map((e) => `<tr><th scope="row">${esc(e.name)}</th>
            <td><label class="sr-only" for="reg_${e.id}">Heures de ${esc(e.name)}</label><input class="input num" id="reg_${e.id}" name="reg_${e.id}" inputmode="decimal"></td>
            <td><label class="sr-only" for="ot_${e.id}">Heures supplémentaires de ${esc(e.name)}</label><input class="input num" id="ot_${e.id}" name="ot_${e.id}" inputmode="decimal"></td>
            <td><label class="sr-only" for="off_${e.id}">Congés ou maladie de ${esc(e.name)}</label><input class="input num" id="off_${e.id}" name="off_${e.id}" inputmode="decimal"></td>
            <td><label class="sr-only" for="note_${e.id}">Note pour ${esc(e.name)}</label><input class="input" id="note_${e.id}" name="note_${e.id}" maxlength="200"></td></tr>`).join('')}
          </tbody></table></div>` : '<p class="t-meta">Joignez votre feuille de temps ci-dessous.</p>'}
        <label class="dropzone" for="timesheet">${icon('i-upload')}<b data-file>Ou joignez votre feuille de temps</b><span>PDF, photo JPG ou PNG, ou Excel (.xlsx) · 20 Mo maximum</span>
          <input class="sr-only" id="timesheet" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.xlsx,application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
        ${field('h-note', 'Note pour BVY <span class="opt">(facultatif — nouvel employé, départ, prime…)</span>', '<textarea class="input" id="h-note" name="note" maxlength="1000"></textarea>')}
        <div class="btn-row"><button class="btn btn-plum" type="submit">Envoyer les heures à BVY</button></div></form></article>`;
  } else if (run.status === 'validation') {
    main = `<article class="card"><div class="card-head"><h2 class="t-h3">Approuver la paie du ${esc(run.pay_date)}</h2></div>
      <p>BVY a préparé votre paie. Vérifiez le sommaire, puis approuvez-la. Rien n’est versé sans votre accord.</p>
      ${summaryBlock(run, { forClient: true })}
      <form class="form mt-4" method="post" action="/paie/${run.id}/decision">${csrf}
        ${field('d-comment', 'Commentaire <span class="opt">(obligatoire si vous n’approuvez pas)</span>', '<textarea class="input" id="d-comment" name="comment" maxlength="1000"></textarea>')}
        <div class="btn-row"><button class="btn btn-plum" type="submit" name="decision" value="approve">J’approuve</button>
        <button class="btn btn-outline" type="submit" name="decision" value="reject">Je n’approuve pas</button></div></form></article>`;
  } else {
    main = `<article class="card"><div class="card-head"><h2 class="t-h3">Paie du ${esc(run.pay_date)}</h2></div>
      <p>${badge(run.status)}</p><p class="mt-4">${{ hours_received: 'Merci, BVY a reçu vos heures et prépare la paie.', preparing: 'Vous avez approuvé la paie ; BVY la finalise.', ready: 'La paie est prête pour la date prévue.', done: 'La paie est versée.' }[run.status]}</p>
      ${summaryBlock(run, { forClient: true })}</article>`;
  }
  const body = `${pageHead('Paie', `Paie du ${run.pay_date}`, 'Vos heures et votre approbation, sans courriel ni appel.')}${main}`;
  return appPage(s, { title: `Paie du ${run.pay_date}`, current: '/a-faire', body, flash, nav });
}

module.exports = { payrollBoard, clientPayrollTab, payRunStaff, payRunClient };
