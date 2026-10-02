'use strict';

/**
 * Déclarations de TPS/TVQ (workflow 13). Le parcours :
 * tenue de livres à jour → validation comptable → calcul → révision → approbation du client → produite.
 * Une déclaration n'avance jamais tant que la tenue de livres du client n'est pas « À jour ».
 * Les montants viennent du rapport de taxes de QuickBooks Online (pas d'API publique) ; le portail calcule et contrôle.
 */

const { canAccessClient } = require('./rbac.js');
const { PortalError, parseAmount } = require('./portal.js');

const STATES = Object.freeze({
  books: 'Tenue de livres à compléter',
  validation: 'Validation comptable',
  calc: 'Calcul',
  review: 'Révision',
  approval: 'Approbation du client',
  filed: 'Produite',
});
const ORDER = ['books', 'validation', 'calc', 'review', 'approval', 'filed'];
const TAX_ROLES = ['admin', 'lead', 'bookkeeper', 'tax'];
const CHECKLIST = Object.freeze([
  ['bank', 'Comptes bancaires et cartes de crédit rapprochés pour la période'],
  ['uncat', 'Aucune opération non catégorisée sur la période'],
  ['codes', 'Codes de taxes vérifiés sur les ventes et les achats importants'],
  ['docs', 'Factures et reçus manquants demandés ou obtenus'],
]);
const GST_RATE = 0.05;
const QST_RATE = 0.09975;
const QBO_TAXES = 'https://app.qbo.intuit.com/app/salestax';
const DAY = 86_400_000;

const pad = (n) => String(n).padStart(2, '0');
const monthEnd = (y, m) => { const d = new Date(Date.UTC(y, m, 0)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const firstOf = (y, m) => { const d = new Date(Date.UTC(y, m - 1, 1)); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-01`; };
const oneLine = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Période couverte par une échéance de TPS/TVQ (clé produite par deadlines.js)
function periodFor(key, freq) {
  let m;
  if ((m = key.match(/^taxes:(\d{4})-(\d{2})-(\d{2})$/))) { // annuelle, société : exercice terminé à cette date
    const end = `${m[1]}-${m[2]}-${m[3]}`;
    const s = new Date(Date.parse(`${end}T00:00:00Z`) + DAY); s.setUTCFullYear(s.getUTCFullYear() - 1);
    return { start: s.toISOString().slice(0, 10), end, label: `Exercice terminé le ${end}` };
  }
  if ((m = key.match(/^taxes:(\d{4})$/))) return { start: `${m[1]}-01-01`, end: `${m[1]}-12-31`, label: `Année ${m[1]}` };
  if ((m = key.match(/^taxes:(\d{4})-(\d{2})$/))) {
    const y = Number(m[1]); const mo = Number(m[2]);
    if (freq === 'quarterly') return { start: firstOf(y, mo - 2), end: monthEnd(y, mo), label: `Trimestre terminé le ${monthEnd(y, mo)}` };
    return { start: firstOf(y, mo), end: monthEnd(y, mo), label: `Mois de ${firstOf(y, mo).slice(0, 7)}` };
  }
  return null;
}

// Montants nets et contrôles de vraisemblance (non bloquants)
function taxTotals(r) {
  const has = r && r.gst_cents !== null && r.gst_cents !== undefined;
  if (!has) return null;
  const netGst = (r.gst_cents || 0) - (r.itc_cents || 0);
  const netQst = (r.qst_cents || 0) - (r.itr_cents || 0);
  const checks = [];
  if (r.sales_cents) {
    const gstRate = r.gst_cents / r.sales_cents; const qstRate = r.qst_cents / r.sales_cents;
    if (Math.abs(gstRate - GST_RATE) > 0.1 * GST_RATE) checks.push(`TPS perçue = ${(gstRate * 100).toFixed(2).replace('.', ',')} % des ventes (5 % attendu) : ventes exonérées ou détaxées, ou erreur de saisie ?`);
    if (Math.abs(qstRate - QST_RATE) > 0.1 * QST_RATE) checks.push(`TVQ perçue = ${(qstRate * 100).toFixed(2).replace('.', ',')} % des ventes (9,975 % attendu) : ventes exonérées ou détaxées, ou erreur de saisie ?`);
  }
  return { netGst, netQst, net: netGst + netQst, checks };
}

function createSalesTax(db, { audit, now = () => Date.now(), deadlinesFor }) {
  const iso = () => new Date(now()).toISOString();
  const today = () => iso().slice(0, 10);
  const client = (id) => db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(id));
  const canStaff = (u) => Boolean(u && u.status === 'active' && TAX_ROLES.includes(u.role));
  function requireStaff(actor, clientId) {
    const c = client(clientId);
    if (!canStaff(actor) || !c || c.is_firm || !canAccessClient(db, actor, c.id)) throw new PortalError('Accès refusé.');
    return c;
  }
  const decorate = (r) => ({ ...r, checklist: r.checklist ? JSON.parse(r.checklist) : {}, label: STATES[r.status], totals: taxTotals(r) });
  function returnFor(actor, id) {
    const r = db.prepare('SELECT * FROM tax_returns WHERE id = ?').get(Number(id));
    if (!r) throw new PortalError('Déclaration introuvable.');
    if (actor && actor.role === 'client') { if (actor.client_id !== r.client_id) throw new PortalError('Accès refusé.'); } else requireStaff(actor, r.client_id);
    return decorate(r);
  }
  function setStatus(r, to, actor, note = null) {
    db.prepare('UPDATE tax_returns SET status = ?, updated_at = ? WHERE id = ?').run(to, iso(), r.id);
    db.prepare('INSERT INTO tax_return_events (return_id, from_status, to_status, user_id, note, at) VALUES (?, ?, ?, ?, ?, ?)').run(r.id, r.status, to, actor ? actor.id : null, note, iso());
    audit({ userId: actor ? actor.id : null, action: 'salestax.status', target: `tax_return:${r.id}`, clientId: r.client_id, details: { from: r.status, to, note } });
  }
  const closeTask = (taskId, answer, actor) => {
    if (taskId) db.prepare("UPDATE tasks SET status = 'done', answer = COALESCE(answer, ?), answered_by = COALESCE(answered_by, ?), answered_at = COALESCE(answered_at, ?) WHERE id = ? AND status IN ('open','answered')").run(answer, actor ? actor.id : null, iso(), taskId);
  };
  const booksReady = (c) => c.books_status === 'done';

  /* --------------------------------------------- création des déclarations */
  // Une déclaration par période terminée (selon les échéances du client) ; idempotent.
  function ensureReturns() {
    const created = [];
    const day = today();
    for (const c of db.prepare("SELECT * FROM clients WHERE is_firm = 0 AND status = 'active' AND kind IN ('entreprise','autonome') AND gst_freq != 'none'").all()) {
      for (const d of deadlinesFor(c, day)) {
        if (!/^taxes:/.test(d.key)) continue;
        const p = periodFor(d.key, c.gst_freq);
        if (!p || p.end >= day) continue; // période pas encore terminée
        if (db.prepare('SELECT 1 FROM tax_returns WHERE client_id = ? AND deadline_key = ?').get(c.id, d.key)) continue;
        const id = Number(db.prepare(`INSERT INTO tax_returns (client_id, deadline_key, period_start, period_end, due_date, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(c.id, d.key, p.start, p.end, d.date, iso(), iso()).lastInsertRowid);
        db.prepare("INSERT INTO tax_return_events (return_id, from_status, to_status, user_id, note, at) VALUES (?, NULL, 'books', NULL, ?, ?)").run(id, 'Période terminée', iso());
        audit({ action: 'salestax.create', target: `tax_return:${id}`, clientId: c.id, details: { key: d.key } });
        created.push({ id, clientId: c.id });
      }
    }
    return created;
  }

  /* --------------------------------------------------------------- étapes */
  function advance(actor, id, form, ip) {
    const r = returnFor(actor, id);
    const c = client(r.client_id);
    const action = String(form.action || '');
    if (action === 'back') {
      const reason = oneLine(form.note, 300);
      const i = ORDER.indexOf(r.status);
      if (i <= 0 || r.status === 'filed') throw new PortalError('Cette déclaration ne peut pas revenir en arrière.');
      if (!reason) throw new PortalError('Indiquez la raison du retour en arrière.');
      if (r.status === 'approval') { closeTask(r.approval_task_id, 'Annulé par BVY', actor); db.prepare('UPDATE tax_returns SET client_approved = 0 WHERE id = ?').run(r.id); }
      setStatus(r, ORDER[i - 1], actor, `Retour en arrière : ${reason}`);
    } else if (action === 'books') {
      if (r.status !== 'books') throw new PortalError('Action impossible à cette étape.');
      if (!booksReady(c)) throw new PortalError('La tenue de livres de ce client n’est pas « À jour » : la déclaration ne peut pas avancer.');
      setStatus(r, 'validation', actor, 'Tenue de livres à jour');
    } else if (action === 'validate') {
      if (r.status !== 'validation') throw new PortalError('Action impossible à cette étape.');
      if (!booksReady(c)) throw new PortalError('La tenue de livres n’est plus « À jour » : terminez-la d’abord.');
      const list = Object.fromEntries(CHECKLIST.map(([k]) => [k, form[`chk_${k}`] === '1']));
      const missing = CHECKLIST.filter(([k]) => !list[k]).map(([, l]) => l);
      if (missing.length) throw new PortalError(`Validation incomplète : ${missing[0].toLowerCase()}.`);
      db.prepare('UPDATE tax_returns SET checklist = ? WHERE id = ?').run(JSON.stringify({ ...list, by: actor.name, at: iso() }), r.id);
      setStatus(r, 'calc', actor, 'Validation comptable terminée');
    } else if (action === 'reviewed') {
      if (r.status !== 'review') throw new PortalError('Action impossible à cette étape.');
      db.prepare('UPDATE tax_returns SET reviewed_by = ? WHERE id = ?').run(actor.id, r.id);
      setStatus(r, 'approval', actor, r.prepared_by === actor.id ? 'Révisée par la personne qui l’a préparée' : 'Révisée');
      const t = Number(db.prepare(`INSERT INTO tasks (client_id, kind, title, detail, due_date, created_by, created_at, tax_return_id) VALUES (?, 'approval', ?, ?, ?, ?, ?, ?)`)
        .run(r.client_id, `Approuver votre déclaration de TPS/TVQ (${periodFor(r.deadline_key, c.gst_freq).label.toLowerCase()})`, 'Vérifiez les montants préparés par BVY, puis approuvez la déclaration.', r.due_date, actor.id, iso(), r.id).lastInsertRowid);
      db.prepare('UPDATE tax_returns SET approval_task_id = ? WHERE id = ?').run(t, r.id);
      audit({ userId: actor.id, action: 'salestax.reviewed', target: `tax_return:${r.id}`, clientId: r.client_id, ip });
      return { ...r, notifyClient: true };
    } else if (action === 'filed') {
      if (r.status !== 'approval' || !r.client_approved) throw new PortalError('La déclaration doit être approuvée par le client avant d’être produite.');
      const conf = oneLine(form.confirmation, 60);
      db.prepare('UPDATE tax_returns SET confirmation = ?, filed_at = ? WHERE id = ?').run(conf || null, iso(), r.id);
      setStatus(r, 'filed', actor, conf ? `Produite — confirmation ${conf}` : 'Produite');
      // L'échéance de TPS/TVQ de la période est faite (et le paiement annuel du travailleur autonome)
      const mark = db.prepare(`INSERT INTO deadline_marks (client_id, key, status, marked_by, marked_at) VALUES (?, ?, 'done', ?, ?)
        ON CONFLICT(client_id, key) DO UPDATE SET status = 'done', marked_by = excluded.marked_by, marked_at = excluded.marked_at`);
      mark.run(r.client_id, r.deadline_key, actor.id, iso());
      if (/^taxes:\d{4}$/.test(r.deadline_key)) mark.run(r.client_id, r.deadline_key.replace('taxes:', 'taxespay:'), actor.id, iso());
    } else throw new PortalError('Action inconnue.');
    audit({ userId: actor.id, action: `salestax.${action}`, target: `tax_return:${r.id}`, clientId: r.client_id, ip });
    return r;
  }

  function saveFigures(actor, id, form, ip) {
    const r = returnFor(actor, id);
    if (!['calc', 'review'].includes(r.status)) throw new PortalError('Les montants se saisissent à l’étape « Calcul ».');
    const v = {};
    for (const [k, label] of [['sales', 'Ventes taxables'], ['gst', 'TPS perçue'], ['itc', 'Crédits de taxe sur les intrants (CTI)'], ['qst', 'TVQ perçue'], ['itr', 'Remboursements de la taxe sur les intrants (RTI)']]) {
      const c = parseAmount(form[k]);
      if (c === null) throw new PortalError(`Indiquez : ${label} (0 si aucun).`);
      if (c < 0) throw new PortalError(`Montant négatif : ${label}.`);
      v[k] = c;
    }
    db.prepare('UPDATE tax_returns SET sales_cents = ?, gst_cents = ?, itc_cents = ?, qst_cents = ?, itr_cents = ?, prepared_by = ? WHERE id = ?')
      .run(v.sales, v.gst, v.itc, v.qst, v.itr, actor.id, r.id);
    if (r.status === 'calc') setStatus(r, 'review', actor, 'Montants inscrits ; révision demandée');
    audit({ userId: actor.id, action: 'salestax.figures', target: `tax_return:${r.id}`, clientId: r.client_id, ip });
  }

  // Le client approuve ou refuse les montants
  function decide(actor, id, { decision, comment }, ip) {
    const r = returnFor(actor, id);
    if (actor.role !== 'client' || r.status !== 'approval' || r.client_approved) throw new PortalError('Cette déclaration n’attend pas votre approbation.');
    if (decision === 'approve') {
      db.prepare('UPDATE tax_returns SET client_approved = 1 WHERE id = ?').run(r.id);
      db.prepare("INSERT INTO tax_return_events (return_id, from_status, to_status, user_id, note, at) VALUES (?, 'approval', 'approval', ?, 'Approuvée par le client', ?)").run(r.id, actor.id, iso());
      closeTask(r.approval_task_id, 'Approuvé', actor);
    } else if (decision === 'reject') {
      const c = oneLine(comment, 1000);
      if (!c) throw new PortalError('Dites-nous en quelques mots ce qui doit être corrigé.');
      db.prepare('UPDATE tax_returns SET client_comment = ? WHERE id = ?').run(c, r.id);
      setStatus(r, 'review', actor, `Refusée par le client : ${c}`);
      closeTask(r.approval_task_id, `Refusé — ${c}`, actor);
    } else throw new PortalError('Choisissez « J’approuve » ou « Je n’approuve pas ».');
    audit({ userId: actor.id, action: `salestax.${decision}`, target: `tax_return:${r.id}`, clientId: r.client_id, ip });
    return r;
  }

  /* ------------------------------------------------------------ lectures */
  const events = (id) => db.prepare('SELECT e.*, u.name AS user_name FROM tax_return_events e LEFT JOIN users u ON u.id = e.user_id WHERE return_id = ? ORDER BY e.id').all(Number(id));
  function board(actor) {
    if (!canStaff(actor)) throw new PortalError('Accès refusé.');
    const since = new Date(now() - 30 * DAY).toISOString().slice(0, 10);
    const rows = db.prepare(`SELECT r.*, c.name AS client_name, c.books_status, c.gst_freq FROM tax_returns r JOIN clients c ON c.id = r.client_id
      WHERE r.status != 'filed' OR r.filed_at >= ? ORDER BY r.due_date, c.name`).all(since)
      .filter((r) => canAccessClient(db, actor, r.client_id)).map(decorate);
    for (const r of rows) { r.late = r.status !== 'filed' && r.due_date < today(); r.blocked = r.status === 'books' && r.books_status !== 'done'; r.period = periodFor(r.deadline_key, r.gst_freq); }
    return { rows, groups: ORDER.map((st) => ({ status: st, label: STATES[st], rows: rows.filter((x) => x.status === st) })) };
  }
  function forClient(actor, clientId) {
    const c = requireStaff(actor, clientId);
    return db.prepare('SELECT * FROM tax_returns WHERE client_id = ? ORDER BY period_end DESC LIMIT 40').all(c.id).map((r) => ({ ...decorate(r), period: periodFor(r.deadline_key, c.gst_freq) }));
  }
  const periodOf = (r) => periodFor(r.deadline_key, (client(r.client_id) || {}).gst_freq);

  return { STATES, CHECKLIST, canStaff, ensureReturns, advance, saveFigures, decide, returnFor, events, board, forClient, periodOf, booksReady: (cid) => booksReady(client(cid)), qboUrl: QBO_TAXES };
}

module.exports = { createSalesTax, periodFor, taxTotals, STATES, CHECKLIST, TAX_ROLES };
