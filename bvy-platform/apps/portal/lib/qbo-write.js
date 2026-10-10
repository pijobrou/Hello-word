'use strict';

/**
 * Écriture dans QuickBooks à la demande d'une personne (workflow 18) — décision du propriétaire du 2026-10-05 :
 * « si je travaille sur ma plateforme, je ne refais pas le travail dans QBO : je clique et c'est fait ».
 * - Jamais automatique : chaque écriture part d'un clic d'un membre de l'équipe autorisé.
 * - Chaque écriture est relue après coup (total identique à ce qui était voulu), sinon elle est défaite aussitôt.
 * - Chaque écriture est enregistrée avec l'état d'avant et peut être annulée.
 */

const { canAccessClient } = require('./rbac.js');
const { PortalError, formatAmount } = require('./portal.js');
const { UNCATEGORIZED_RE } = require('./qbo-sync.js');

const WRITERS = ['admin', 'lead', 'bookkeeper', 'tax'];
const DETAIL = { Purchase: 'AccountBasedExpenseLineDetail', Bill: 'AccountBasedExpenseLineDetail', Deposit: 'DepositLineDetail', JournalEntry: 'JournalEntryLineDetail' };
const PATH = { Purchase: 'purchase', Bill: 'bill', Deposit: 'deposit', JournalEntry: 'journalentry' };
const URL = { Purchase: 'expense', Bill: 'bill', Deposit: 'deposit', JournalEntry: 'journal' };
const C = (v) => Math.round(Number(v || 0) * 100);
const money = (c) => formatAmount(c);

function createQboWriter(db, { audit, now = () => Date.now(), api, testMode = false }) {
  const iso = () => new Date(now()).toISOString();
  const enabled = () => { const r = db.prepare("SELECT value FROM settings WHERE key = 'qbo.write'").get(); return !r || r.value === '1'; };
  function requireWriter(actor, clientId) {
    if (!actor || !WRITERS.includes(actor.role)) throw new PortalError('Votre rôle ne permet pas de modifier QuickBooks.');
    if (!canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    if (!enabled()) throw new PortalError('L’écriture dans QuickBooks est désactivée par l’administrateur.');
    return Number(clientId);
  }
  const canWrite = (actor) => Boolean(actor && WRITERS.includes(actor.role) && enabled() && api);
  const log = (row) => Number(db.prepare(`INSERT INTO qbo_writes (client_id, action, qbo_type, qbo_id, summary, before, after, source, ref, user_id, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(row.clientId, row.action, row.type, String(row.id), row.summary, row.before ? JSON.stringify(row.before) : null, row.after ? JSON.stringify(row.after) : null, row.source, row.ref || null, row.userId, iso()).lastInsertRowid);
  const uncategorizedIds = (clientId) => new Set(db.prepare('SELECT qbo_id, name FROM qbo_accounts WHERE client_id = ?').all(clientId).filter((a) => UNCATEGORIZED_RE.test(a.name)).map((a) => a.qbo_id));
  const accountName = (clientId, id) => { const a = db.prepare('SELECT name FROM qbo_accounts WHERE client_id = ? AND qbo_id = ?').get(clientId, String(id)); return a ? a.name : null; };

  async function read(q, type, id) { const body = await q.qbo.get(q.realm, `${PATH[type]}/${encodeURIComponent(id)}`, q.token); return body[type]; }
  async function save(q, type, obj) { const body = await q.qbo.post(q.realm, PATH[type], q.token, obj); return body[type]; }
  async function remove(q, type, id) { const cur = await read(q, type, id); await q.qbo.post(q.realm, PATH[type], q.token, { Id: cur.Id, SyncToken: cur.SyncToken }, { operation: 'delete' }); }

  /* ------------------------------------------- classer une opération */
  // Les lignes imputées à un compte « non catégorisé » passent au compte choisi (et au code de taxe choisi).
  async function recategorize(actor, clientId, itemId, accountId, taxCodeId, { source = 'classement', ref = null } = {}, ip) {
    const id = requireWriter(actor, clientId);
    const it = db.prepare("SELECT * FROM qbo_items WHERE id = ? AND client_id = ? AND kind = 'uncategorized'").get(Number(itemId), id);
    if (!it) throw new PortalError('Opération introuvable.');
    if (!DETAIL[it.qbo_type]) throw new PortalError('Ce type d’opération se classe dans QuickBooks.');
    const name = accountName(id, accountId);
    if (!name) throw new PortalError('Choisissez un compte du plan comptable du client.');
    const uncat = uncategorizedIds(id);
    return api.withToken(id, async (q) => {
      const obj = await read(q, it.qbo_type, it.qbo_id);
      const total = C(obj.TotalAmt);
      const before = [];
      (obj.Line || []).forEach((l, i) => {
        const d = l[DETAIL[it.qbo_type]];
        if (!d || !d.AccountRef || !uncat.has(String(d.AccountRef.value))) return;
        before.push({ i, account: d.AccountRef, tax: d.TaxCodeRef || null });
        d.AccountRef = { value: String(accountId), name };
        if (taxCodeId && it.qbo_type !== 'JournalEntry') d.TaxCodeRef = { value: String(taxCodeId) };
      });
      if (!before.length) throw new PortalError('Cette opération n’est plus dans un compte « non catégorisé » : elle a peut-être déjà été classée dans QuickBooks.');
      const saved = await save(q, it.qbo_type, obj);
      if (it.qbo_type !== 'JournalEntry' && C(saved.TotalAmt) !== total) {
        // Le total a changé (taxes recalculées) : on remet l'opération comme elle était
        const back = await read(q, it.qbo_type, it.qbo_id);
        for (const b of before) { const d = back.Line[b.i][DETAIL[it.qbo_type]]; d.AccountRef = b.account; if (b.tax) d.TaxCodeRef = b.tax; else delete d.TaxCodeRef; }
        await save(q, it.qbo_type, back);
        throw new PortalError(`QuickBooks a recalculé le total (${money(C(saved.TotalAmt))} au lieu de ${money(total)}) : rien n’a été changé. Classez cette opération directement dans QuickBooks.`);
      }
      const wid = log({ clientId: id, action: 'recategorize', type: it.qbo_type, id: it.qbo_id, summary: `${it.counterparty || 'Opération'} ${money(it.amount_cents)} → ${name}`, before, after: { account: accountId, tax: taxCodeId || null }, source, ref, userId: actor.id });
      db.prepare("UPDATE qbo_items SET status = 'resolved' WHERE id = ?").run(it.id);
      db.prepare("UPDATE ai_suggestions SET status = 'done', chosen_account_id = ?, chosen_account_name = ?, decided_by = ?, decided_at = ? WHERE item_id = ?").run(String(accountId), name, actor.id, iso(), it.id);
      if (it.task_id) db.prepare("UPDATE tasks SET status = 'done', answer = COALESCE(answer, 'Classé dans QuickBooks par BVY') WHERE id = ? AND status IN ('open','answered')").run(it.task_id);
      audit({ userId: actor.id, action: 'qbo.write.recategorize', target: `qbo:${it.qbo_type}:${it.qbo_id}`, clientId: id, ip, details: { account: name, tax: taxCodeId || null, write: wid } });
      return { writeId: wid, url: it.qbo_url, account: name };
    });
  }

  /* ------------------------------- créer une opération du relevé */
  // amount : cents signés (− sortie du compte bancaire → dépense ; + entrée → dépôt)
  async function createFromStatement(actor, clientId, { bankAccountId, date, amount, description, accountId, taxCodeId, source = 'conciliation', ref = null }, ip) {
    const id = requireWriter(actor, clientId);
    const bank = db.prepare("SELECT * FROM qbo_accounts WHERE client_id = ? AND qbo_id = ? AND type = 'Bank'").get(id, String(bankAccountId));
    if (!bank) throw new PortalError('Compte bancaire introuvable.');
    const name = accountName(id, accountId);
    if (!name) throw new PortalError('Choisissez la catégorie (compte du plan comptable).');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !Number.isInteger(amount) || !amount) throw new PortalError('Ligne du relevé invalide.');
    const gross = Math.abs(amount) / 100;
    const tax = taxCodeId ? { TaxCodeRef: { value: String(taxCodeId) } } : {};
    const desc = String(description || '').slice(0, 4000);
    const type = amount < 0 ? 'Purchase' : 'Deposit';
    const body = type === 'Purchase'
      ? { AccountRef: { value: String(bankAccountId) }, PaymentType: 'Cash', TxnDate: date, PrivateNote: `${desc} (BVY — conciliation)`.slice(0, 4000),
        ...(taxCodeId ? { GlobalTaxCalculation: 'TaxInclusive' } : {}),
        Line: [{ Amount: gross, DetailType: 'AccountBasedExpenseLineDetail', Description: desc, AccountBasedExpenseLineDetail: { AccountRef: { value: String(accountId) }, ...tax, ...(taxCodeId ? { TaxInclusiveAmt: gross } : {}) } }] }
      : { DepositToAccountRef: { value: String(bankAccountId) }, TxnDate: date, PrivateNote: `${desc} (BVY — conciliation)`.slice(0, 4000),
        ...(taxCodeId ? { GlobalTaxCalculation: 'TaxInclusive' } : {}),
        Line: [{ Amount: gross, DetailType: 'DepositLineDetail', Description: desc, DepositLineDetail: { AccountRef: { value: String(accountId) }, ...tax } }] };
    return api.withToken(id, async (q) => {
      const saved = await save(q, type, body);
      if (C(saved.TotalAmt) !== Math.abs(amount)) {
        await remove(q, type, saved.Id); // total différent du relevé : on défait aussitôt
        throw new PortalError(`QuickBooks a calculé ${money(C(saved.TotalAmt))} au lieu de ${money(Math.abs(amount))} (taxes) : rien n’a été créé. Saisissez cette opération directement dans QuickBooks.`);
      }
      const url = `${q.appBase}/app/${URL[type]}?txnId=${encodeURIComponent(saved.Id)}`;
      const wid = log({ clientId: id, action: 'create', type, id: saved.Id, summary: `${type === 'Purchase' ? 'Dépense' : 'Dépôt'} ${money(amount)} du ${date} → ${name}`, before: null, after: { url, account: accountId, tax: taxCodeId || null }, source, ref, userId: actor.id });
      audit({ userId: actor.id, action: 'qbo.write.create', target: `qbo:${type}:${saved.Id}`, clientId: id, ip, details: { amount, account: name, write: wid } });
      return { writeId: wid, id: String(saved.Id), type, url, account: name };
    });
  }

  /* ------------------------------------------ corriger un montant */
  // Seulement une opération à une ligne, sans taxe : sinon, ouvrir dans QuickBooks.
  async function fixAmount(actor, clientId, { type, qboId, amount, source = 'conciliation', ref = null }, ip) {
    const id = requireWriter(actor, clientId);
    const T = { Chèque: 'Purchase', Dépense: 'Purchase', Dépôt: 'Deposit' }[type] || (['Purchase', 'Deposit'].includes(type) ? type : null);
    if (!T) throw new PortalError('Ce type d’opération se corrige dans QuickBooks.');
    return api.withToken(id, async (q) => {
      const obj = await read(q, T, qboId);
      const lines = (obj.Line || []).filter((l) => l.DetailType === DETAIL[T]);
      const taxed = obj.TxnTaxDetail && C(obj.TxnTaxDetail.TotalTax) !== 0;
      if (lines.length !== 1 || taxed) throw new PortalError('Opération à plusieurs lignes ou avec taxes : corrigez le montant directement dans QuickBooks.');
      const before = { amount: C(lines[0].Amount) };
      lines[0].Amount = Math.abs(amount) / 100;
      const saved = await save(q, T, obj);
      if (C(saved.TotalAmt) !== Math.abs(amount)) throw new PortalError('QuickBooks n’a pas enregistré le montant attendu : vérifiez l’opération dans QuickBooks.');
      const wid = log({ clientId: id, action: 'amount', type: T, id: qboId, summary: `Montant ${money(before.amount)} → ${money(Math.abs(amount))}`, before, after: { amount: Math.abs(amount) }, source, ref, userId: actor.id });
      audit({ userId: actor.id, action: 'qbo.write.amount', target: `qbo:${T}:${qboId}`, clientId: id, ip, details: { before: before.amount, after: Math.abs(amount), write: wid } });
      return { writeId: wid };
    });
  }

  /* ---------------------------------------------------- annuler */
  async function undo(actor, writeId, ip) {
    const w = db.prepare('SELECT * FROM qbo_writes WHERE id = ?').get(Number(writeId));
    if (!w) throw new PortalError('Écriture introuvable.');
    const id = requireWriter(actor, w.client_id);
    if (w.undone_at) throw new PortalError('Cette écriture est déjà annulée.');
    await api.withToken(id, async (q) => {
      if (w.action === 'create') await remove(q, w.qbo_type, w.qbo_id);
      else if (w.action === 'recategorize') {
        const obj = await read(q, w.qbo_type, w.qbo_id);
        for (const b of JSON.parse(w.before)) { const d = obj.Line[b.i] && obj.Line[b.i][DETAIL[w.qbo_type]]; if (!d) continue; d.AccountRef = b.account; if (b.tax) d.TaxCodeRef = b.tax; else delete d.TaxCodeRef; }
        await save(q, w.qbo_type, obj);
        db.prepare("UPDATE qbo_items SET status = 'new' WHERE client_id = ? AND qbo_type = ? AND qbo_id = ? AND kind = 'uncategorized'").run(id, w.qbo_type, w.qbo_id);
        db.prepare("UPDATE ai_suggestions SET status = 'new', decided_by = NULL, decided_at = NULL WHERE item_id IN (SELECT id FROM qbo_items WHERE client_id = ? AND qbo_type = ? AND qbo_id = ?)").run(id, w.qbo_type, w.qbo_id);
      } else if (w.action === 'amount') {
        const obj = await read(q, w.qbo_type, w.qbo_id);
        const line = (obj.Line || []).find((l) => l.DetailType === DETAIL[w.qbo_type]);
        line.Amount = JSON.parse(w.before).amount / 100;
        await save(q, w.qbo_type, obj);
      }
    });
    db.prepare('UPDATE qbo_writes SET undone_at = ?, undone_by = ? WHERE id = ?').run(iso(), actor.id, w.id);
    audit({ userId: actor.id, action: 'qbo.write.undo', target: `qbo:${w.qbo_type}:${w.qbo_id}`, clientId: id, ip, details: { write: w.id, action: w.action } });
    return w;
  }

  const recent = (clientId, source = null) => db.prepare(`SELECT w.*, u.name AS user_name FROM qbo_writes w LEFT JOIN users u ON u.id = w.user_id
    WHERE w.client_id = ? ${source ? 'AND w.source = ?' : ''} ORDER BY w.id DESC LIMIT 30`).all(...(source ? [Number(clientId), source] : [Number(clientId)]));

  return { testMode, enabled, canWrite, recategorize, createFromStatement, fixAmount, undo, recent };
}

module.exports = { createQboWriter, WRITERS };
