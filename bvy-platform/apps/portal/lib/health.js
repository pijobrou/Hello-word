'use strict';

/**
 * Santé financière (workflow 15) : un état par indicateur (Bonne, À surveiller, Action requise), toujours expliqué
 * par une phrase et le chiffre qui la justifie ; l'état global est le pire des indicateurs.
 * Un indicateur sans données n'est pas affiché : rien n'est deviné.
 */

const { canAccessClient, STAFF_ROLES } = require('./rbac.js');
const { PortalError, formatAmount, HEALTH } = require('./portal.js');
const { isoDay } = require('./dates.js');

const RANK = { good: 0, watch: 1, action: 2 };
const LABELS = { cash: 'Argent disponible', profit: 'Rentabilité', receivable: 'Clients qui vous doivent', expenses: 'Dépenses', taxes: 'Taxes et échéances', payroll: 'Paie' };
const money = (c) => formatAmount(c);
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const monthName = (ym) => (ym ? `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : 'le dernier mois');
const months1 = (x) => new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 1 }).format(Math.floor(x * 10) / 10);
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);

/* -------------------------------------------------- règles (pures) */
// snap : instantané du tableau de bord ; dl : échéances non faites [{ title, date, urgency:{days} }] ;
// gov : demandes du gouvernement ouvertes ; pay : { enabled, atRisk: [...], dasLate: bool } (ou null)
function computeHealth({ snap = null, dl = null, gov = [], pay = null } = {}) {
  const out = [];
  const add = (key, state, why) => out.push({ key, label: LABELS[key], state, why });
  const cash = num(snap && snap.cash && snap.cash.amount);
  const payable = num(snap && snap.payable && snap.payable.amount);
  const pl = snap && snap.pl;
  const inc = pl ? (pl.income || []).map(num) : [null, null];
  const exp = pl ? (pl.expenses || []).map(num) : [null, null];
  const lastMonth = pl && pl.months ? pl.months[1] : null;

  if (cash !== null) {
    const monthly = exp[1];
    if (cash < 0) add('cash', 'action', `Les comptes sont à découvert (${money(cash)}).`);
    else if (payable !== null && payable > 0 && cash < payable) add('cash', 'action', `${money(cash)} disponibles pour ${money(payable)} de factures à payer.`);
    else if (monthly !== null && monthly > 0 && cash < monthly) add('cash', 'watch', `${money(cash)} disponibles : moins d’un mois de dépenses (${money(monthly)} en ${monthName(lastMonth)}).`);
    else if (monthly !== null && monthly > 0) add('cash', 'good', `${money(cash)} disponibles${payable ? `, plus que les factures à payer (${money(payable)})` : ''} : environ ${months1(cash / monthly)} mois de dépenses.`);
    else add('cash', 'good', `${money(cash)} disponibles${payable ? `, plus que les factures à payer (${money(payable)})` : ''}.`);
  }
  if (inc[1] !== null && exp[1] !== null) {
    const p1 = inc[1] - exp[1];
    const p0 = inc[0] !== null && exp[0] !== null ? inc[0] - exp[0] : null;
    if (p1 < 0 && p0 !== null && p0 < 0) add('profit', 'action', `Perte deux mois de suite (${money(p0)} puis ${money(p1)} en ${monthName(lastMonth)}).`);
    else if (p1 < 0) add('profit', 'watch', `Perte de ${money(-p1)} en ${monthName(lastMonth)}${p0 !== null ? ` (bénéfice de ${money(p0)} le mois d’avant)` : ''}.`);
    else add('profit', 'good', `Bénéfice de ${money(p1)} en ${monthName(lastMonth)}.`);
  }
  const recv = num(snap && snap.receivable && snap.receivable.amount);
  const late = snap && snap.late ? num(snap.late.amount) : null;
  if (recv !== null && late !== null) {
    if (recv <= 0) add('receivable', 'good', 'Aucune facture client impayée.');
    else {
      const pct = Math.round((late / recv) * 100);
      const why = late ? `${money(late)} en retard de plus de 30 jours sur ${money(recv)} à recevoir (${pct} %).` : `${money(recv)} à recevoir, rien en retard de plus de 30 jours.`;
      add('receivable', pct >= 50 ? 'action' : pct >= 20 ? 'watch' : 'good', why);
    }
  }
  if (exp[0] !== null && exp[1] !== null && exp[0] > 0) {
    const pct = Math.round(((exp[1] - exp[0]) / exp[0]) * 100);
    if (pct >= 25) add('expenses', 'watch', `Dépenses de ${monthName(lastMonth)} en hausse de ${pct} % (${money(exp[1])} contre ${money(exp[0])}).`);
    else add('expenses', 'good', `Dépenses de ${monthName(lastMonth)} : ${money(exp[1])} (${pct >= 0 ? '+' : '−'} ${Math.abs(pct)} %).`);
  }
  if (dl) {
    const lateDl = dl.filter((d) => d.urgency && d.urgency.days < 0);
    const soon = dl.filter((d) => d.urgency && d.urgency.days >= 0 && d.urgency.days <= 7);
    if (lateDl.length) add('taxes', 'action', `${lateDl.length > 1 ? `${lateDl.length} obligations en retard, dont ` : 'En retard : '}${lateDl[0].title} (${lateDl[0].date}).`);
    else if (soon.length) add('taxes', 'watch', `À faire d’ici 7 jours : ${soon[0].title} (${soon[0].date})${soon.length > 1 ? ` et ${soon.length - 1} autre${soon.length > 2 ? 's' : ''}` : ''}.`);
    else if (gov.length) add('taxes', 'watch', `${gov.length > 1 ? `${gov.length} demandes` : 'Une demande'} du gouvernement en cours ; réponse due le ${gov[0].due_date}.`);
    else {
      const next = dl.find((d) => d.urgency && d.urgency.days > 7);
      add('taxes', 'good', next ? `Rien en retard. Prochaine obligation : ${next.title} (${next.date}).` : 'Rien en retard.');
    }
  }
  if (pay && pay.enabled) {
    if (pay.atRisk.length) add('payroll', 'action', `Paie du ${pay.atRisk[0].pay_date} pas encore prête.`);
    else if (pay.dasLate) add('payroll', 'action', 'Versement des retenues à la source en retard.');
    else add('payroll', 'good', 'Paies et versements à temps.');
  }
  const overall = out.length ? out.reduce((w, i) => (RANK[i.state] > RANK[w] ? i.state : w), 'good') : null;
  return { overall, indicators: out };
}

/* ----------------------------------------------------------- service */
function createHealth(db, { audit, now = () => Date.now(), deadlinesFor, portal }) {
  const iso = () => new Date(now()).toISOString();
  const today = () => isoDay(now());

  function forClient(clientId) {
    const c = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(clientId));
    if (!c) return null;
    const row = db.prepare('SELECT data FROM client_snapshots WHERE client_id = ?').get(c.id);
    const snap = row ? JSON.parse(row.data) : null;
    const dl = c.kind && deadlinesFor ? deadlinesFor(c, today()).filter((d) => !d.mark) : null;
    const gov = db.prepare("SELECT * FROM gov_requests WHERE client_id = ? AND status IN ('received','gathering','ready') ORDER BY due_date").all(c.id);
    const soon = isoDay(now() + 2 * 86_400_000);
    const pay = c.payroll ? {
      enabled: true,
      atRisk: db.prepare("SELECT * FROM pay_runs WHERE client_id = ? AND status IN ('waiting','hours_received','validation','preparing') AND pay_date <= ? ORDER BY pay_date").all(c.id, soon),
      dasLate: Boolean(dl && dl.some((d) => /^das:/.test(d.key) && d.urgency.days < 0)),
    } : null;
    const computed = computeHealth({ snap, dl, gov, pay });
    const note = db.prepare('SELECT h.*, u.name AS by_name FROM client_health h LEFT JOIN users u ON u.id = h.updated_by WHERE h.client_id = ?').get(c.id) || null;
    const state = note && note.state ? note.state : computed.overall;
    return { ...computed, state, override: Boolean(note && note.state), why: note && note.state ? note.why : null, comment: note ? note.comment : null,
      noteBy: note ? note.by_name : null, noteAt: note ? note.updated_at : null, asOf: snap ? snap.asOf : null };
  }

  function forActor(actor, clientId) {
    if (!canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    return forClient(clientId);
  }

  // Commentaire de BVY et, au besoin, état global choisi par l'équipe (explication obligatoire).
  function saveNote(actor, clientId, input, ip) {
    if (!actor || !STAFF_ROLES.includes(actor.role)) throw new PortalError('Réservé à l’équipe BVY.');
    if (!canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    const state = HEALTH[input.state] ? input.state : null;
    const why = String(input.why || '').trim().slice(0, 600);
    const comment = String(input.comment || '').trim().slice(0, 1000);
    if (state && !why) throw new PortalError('Expliquez toujours l’état choisi, en une ou deux phrases.');
    db.prepare(`INSERT INTO client_health (client_id, state, why, comment, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET state = excluded.state, why = excluded.why, comment = excluded.comment, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
      .run(Number(clientId), state, state ? why : null, comment || null, actor.id, iso());
    audit({ userId: actor.id, action: 'health.note', target: `client:${clientId}`, clientId: Number(clientId), ip, details: { state } });
  }

  return { forClient, forActor, saveNote };
}

module.exports = { computeHealth, createHealth, LABELS, RANK, monthName };
