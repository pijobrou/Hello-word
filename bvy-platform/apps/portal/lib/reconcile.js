'use strict';

/**
 * Conciliation assistée (workflow 07, partie B). On compare le relevé bancaire (PDF lu sur le serveur, vérifié par le
 * calcul) avec les opérations du compte dans QuickBooks, et on ne montre que les exceptions (décision du
 * propriétaire) : ce qui concorde est seulement compté, pour être coché dans l'outil de rapprochement de QuickBooks.
 * Rien n'est écrit dans QuickBooks ici : les écritures passent par qbo-write.js, sur un clic (workflow 18).
 */

const fs = require('node:fs');
const { canAccessClient, STAFF_ROLES } = require('./rbac.js');
const { PortalError } = require('./portal.js');

const DAY = 86_400_000;
const days = (a, b) => Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const STOP = new Set(['virement', 'interac', 'paiement', 'facture', 'depot', 'achat', 'retrait', 'transfer', 'payment', 'purchase', 'deposit', 'sent', 'autodeposit', 'internet', 'accesd', 'contactless', 'online', 'banking', 'dir', 'direct', 'entreprise', 'inc', 'ltee', 'the', 'des', 'pour', 'and']);
const tokens = (s) => new Set(String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w)));
const similarity = (a, b) => { const A = tokens(a); let n = 0; for (const w of tokens(b)) if (A.has(w)) n += 1; return n; };
const chequeNo = (desc) => { const m = String(desc).normalize('NFD').replace(/[̀-ͯ]/g, '').match(/\bch[e]?que\s*(?:no\.?|#|n°)?\s*(\d{2,8})\b|\bcheque\s*(?:no\.?|#)?\s*(\d{2,8})\b/i); return m ? (m[1] || m[2]) : null; };

// Combinaisons de 2 à 4 éléments dont la somme vaut la cible (petits ensembles seulement)
function subsetSum(items, target, maxSize = 4) {
  const pool = items.slice(0, 16);
  const rec = (start, left, picked) => {
    if (picked.length >= 2 && left === 0) return picked;
    if (picked.length === maxSize) return null;
    for (let i = start; i < pool.length; i++) {
      const r = rec(i + 1, left - pool[i].amount, [...picked, pool[i]]);
      if (r) return r;
    }
    return null;
  };
  return rec(0, target, []);
}

/* -------------------------------------------------------- pointage (pur) */
// stmt : [{ date, desc, amount }] ; ledger : [{ type, id, date, amount, name, memo, docNum, url }] ; period : { start, end }
function matchStatement(stmt, ledger, period) {
  const S = stmt.map((l, i) => ({ ...l, i, m: null }));
  const Q = ledger.map((q, j) => ({ ...q, j, m: null, label: [q.name, q.memo, q.docNum].filter(Boolean).join(' ') }));
  const matched = []; const exceptions = [];
  const pair = (s, q, how) => { s.m = q.j; q.m = s.i; matched.push({ stmt: s, qbo: q, how }); };
  // 1 et 2 : même montant, date proche (3 puis 10 jours), le plus proche et le plus semblable d'abord
  for (const win of [3, 10]) {
    for (const s of S.filter((x) => x.m === null)) {
      const cands = Q.filter((q) => q.m === null && q.amount === s.amount && days(q.date, s.date) <= win)
        .sort((a, b) => days(a.date, s.date) - days(b.date, s.date) || similarity(s.desc, b.label) - similarity(s.desc, a.label));
      if (cands.length) pair(s, cands[0], win === 3 ? 'exact' : 'date');
    }
  }
  // 3 : chèque par numéro (jusqu'à 60 jours), montant égal ou différent
  for (const s of S.filter((x) => x.m === null)) {
    const no = chequeNo(s.desc);
    if (!no) continue;
    const q = Q.find((x) => x.m === null && x.docNum && String(x.docNum).replace(/^0+/, '') === no.replace(/^0+/, '') && days(x.date, s.date) <= 60);
    if (!q) continue;
    if (q.amount === s.amount) pair(s, q, 'cheque');
    else { s.m = q.j; q.m = s.i; exceptions.push({ kind: 'amount', stmt: s, qbo: q, diff: s.amount - q.amount, note: `Chèque no ${no}` }); }
  }
  // 4 : regroupements — un dépôt du relevé = plusieurs opérations QuickBooks, ou l'inverse
  for (const s of S.filter((x) => x.m === null)) {
    const pool = Q.filter((q) => q.m === null && Math.sign(q.amount) === Math.sign(s.amount) && Math.abs(q.amount) < Math.abs(s.amount) && days(q.date, s.date) <= 7);
    const g = subsetSum(pool, s.amount);
    if (g) { s.m = -1; for (const q of g) q.m = s.i; matched.push({ stmt: s, qbos: g, how: 'group' }); }
  }
  for (const q of Q.filter((x) => x.m === null)) {
    const pool = S.filter((s) => s.m === null && Math.sign(s.amount) === Math.sign(q.amount) && Math.abs(s.amount) < Math.abs(q.amount) && days(q.date, s.date) <= 3);
    const g = subsetSum(pool, q.amount);
    if (g) { q.m = -1; for (const s of g) s.m = q.j; matched.push({ stmts: g, qbo: q, how: 'group' }); }
  }
  // 5 : même bénéficiaire, date proche, montant différent
  for (const s of S.filter((x) => x.m === null)) {
    const q = Q.filter((x) => x.m === null && Math.sign(x.amount) === Math.sign(s.amount) && days(x.date, s.date) <= 3 && similarity(s.desc, x.label) >= 1)
      .sort((a, b) => Math.abs(a.amount - s.amount) - Math.abs(b.amount - s.amount))[0];
    if (q && Math.abs(q.amount - s.amount) <= Math.abs(s.amount) * 0.5) { s.m = q.j; q.m = s.i; exceptions.push({ kind: 'amount', stmt: s, qbo: q, diff: s.amount - q.amount }); }
  }
  // 6 : le reste
  for (const s of S.filter((x) => x.m === null)) exceptions.push({ kind: 'missing', stmt: s });
  for (const q of Q.filter((x) => x.m === null && x.date >= period.start && x.date <= period.end)) {
    const outstanding = q.amount < 0 ? ['Chèque', 'Paiement de facture'].includes(q.type) : days(q.date, period.end) <= 3;
    exceptions.push({ kind: outstanding ? 'outstanding' : 'extra', qbo: q });
  }
  const clean = (x) => (x ? { date: x.date, desc: x.desc, amount: x.amount } : undefined);
  const cleanQ = (q) => (q ? { type: q.type, id: q.id, date: q.date, amount: q.amount, name: q.name, memo: q.memo, docNum: q.docNum, url: q.url } : undefined);
  return {
    matched: matched.map((m) => ({ how: m.how, stmt: clean(m.stmt), stmts: m.stmts && m.stmts.map(clean), qbo: cleanQ(m.qbo), qbos: m.qbos && m.qbos.map(cleanQ) })),
    exceptions: exceptions.map((e, k) => ({ key: `e${k + 1}`, kind: e.kind, diff: e.diff, note: e.note, stmt: clean(e.stmt), qbo: cleanQ(e.qbo), done: false }))
      .sort((a, b) => ['missing', 'amount', 'extra', 'outstanding'].indexOf(a.kind) - ['missing', 'amount', 'extra', 'outstanding'].indexOf(b.kind)),
  };
}

/* ---------------------------------------------------------- service */
function createReconciler(db, { audit, now = () => Date.now(), portal, parse, ledger, ai = null, aiEnabled = () => false }) {
  const iso = () => new Date(now()).toISOString();
  function requireStaff(actor, clientId) {
    if (!actor || !STAFF_ROLES.includes(actor.role)) throw new PortalError('Réservé à l’équipe BVY.');
    if (!canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    return Number(clientId);
  }

  // Comptes que la lecture « service externe » renvoie : mêmes vérifications que la lecture locale
  function fromService(data) {
    const accounts = (data.accounts || []).map((a, k) => {
      const lines = (a.lines || []).map((l) => ({ date: String(l.date).slice(0, 10), desc: String(l.description || ''), amount: Math.round(Number(l.amount) * 100), balance: null }));
      const opening = Math.round(Number(a.opening_balance) * 100); const closing = Math.round(Number(a.closing_balance) * 100);
      const credits = lines.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0); const debits = -lines.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0);
      return { code: `S${k + 1}`, label: a.label || 'Compte', opening, closing, lines, totals: { credits, debits }, check: { ok: opening + credits - debits === closing, sumOk: opening + credits - debits === closing, chainOk: null, summaryOk: null } };
    });
    return { bank: null, period: /^\d{4}-\d{2}-\d{2}$/.test(data.period_start) && /^\d{4}-\d{2}-\d{2}$/.test(data.period_end) ? { start: data.period_start, end: data.period_end } : null, accounts };
  }

  async function start(actor, clientId, input, ip) {
    const id = requireStaff(actor, clientId);
    const { doc, file } = portal.openDocument(actor, input.docId, ip);
    if (doc.client_id !== id) throw new PortalError('Ce relevé n’appartient pas à ce client.');
    if (doc.mime !== 'application/pdf') throw new PortalError('Choisissez un relevé en PDF.');
    const acc = db.prepare("SELECT * FROM qbo_accounts WHERE client_id = ? AND qbo_id = ? AND type = 'Bank'").get(id, String(input.accountId || ''));
    if (!acc) throw new PortalError('Choisissez le compte bancaire QuickBooks à concilier.');
    const buffer = fs.readFileSync(file);
    let st = null; let method = 'local'; let readError = null;
    try { st = await parse(buffer); } catch (err) { readError = err.message; }
    const usable = (x) => x && x.period && x.accounts.some((a) => a.lines.length && a.check.ok);
    if (!usable(st) && ai && aiEnabled()) {
      try {
        const out = await ai.readStatement(buffer);
        const alt = fromService(out.data);
        db.prepare('INSERT INTO ai_calls (client_id, purpose, items, model, input_tokens, output_tokens, ok, at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
          .run(id, 'statement', alt.accounts.reduce((n, a) => n + a.lines.length, 0), out.model, out.usage.input_tokens || null, out.usage.output_tokens || null, iso());
        if (usable(alt) || !usable(st)) { st = alt; method = 'service'; }
      } catch (err) {
        db.prepare("INSERT INTO ai_calls (client_id, purpose, items, ok, error, at) VALUES (?, 'statement', 0, 0, ?, ?)").run(id, String(err.message).slice(0, 300), iso());
      }
    }
    if (!st || !st.period || !st.accounts.length) throw new PortalError(`Ce relevé n’a pas pu être lu${readError ? '' : ' (mise en page non reconnue)'} : envoyez un PDF téléchargé de la banque (pas une photo ni un scan).`);
    const sec = st.accounts.find((a) => a.code === input.section) || [...st.accounts].sort((a, b) => b.lines.length - a.lines.length)[0];
    const led = await ledger(id, acc.qbo_id, addDays(st.period.start, -15), addDays(st.period.end, 15));
    const result = matchStatement(sec.lines, led, st.period);
    const rid = Number(db.prepare(`INSERT INTO reconciliations (client_id, document_id, account_id, account_name, section, bank, period_start, period_end, opening, closing, method, check_ok, statement, result, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`).run(id, doc.id, acc.qbo_id, acc.name, `${sec.code} — ${sec.label}`, st.bank, st.period.start, st.period.end, sec.opening, sec.closing, method, sec.check.ok ? 1 : 0,
      JSON.stringify({ lines: sec.lines, totals: sec.totals, check: sec.check, sections: st.accounts.map((a) => ({ code: a.code, label: a.label, lines: a.lines.length })) }), JSON.stringify(result), actor.id, iso(), iso()).lastInsertRowid);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(`reconcile.account.${id}`, acc.qbo_id);
    audit({ userId: actor.id, action: 'reconcile.start', target: `reconciliation:${rid}`, clientId: id, ip, details: { lines: sec.lines.length, matched: result.matched.length, exceptions: result.exceptions.length, method, check: sec.check.ok } });
    return rid;
  }

  function row(actor, rid) {
    const r = db.prepare('SELECT * FROM reconciliations WHERE id = ?').get(Number(rid));
    if (!r) throw new PortalError('Conciliation introuvable.');
    requireStaff(actor, r.client_id);
    return r;
  }
  function get(actor, rid) {
    const r = row(actor, rid);
    const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(r.client_id);
    const doc = db.prepare('SELECT id, name FROM documents WHERE id = ?').get(r.document_id);
    return { ...r, statement: JSON.parse(r.statement), result: JSON.parse(r.result), client, doc };
  }
  function list(actor, clientId) {
    const id = requireStaff(actor, clientId);
    return db.prepare('SELECT id, account_name, period_start, period_end, status, check_ok, method, result, created_at FROM reconciliations WHERE client_id = ? ORDER BY period_end DESC, id DESC LIMIT 50').all(id)
      .map((r) => { const res = JSON.parse(r.result); return { ...r, matched: res.matched.length, open: res.exceptions.filter((e) => !e.done && e.kind !== 'outstanding').length }; });
  }
  // L'équipe coche une exception « réglée » (saisie faite dans QuickBooks, en circulation confirmée…)
  function mark(actor, rid, key, done, ip) {
    const r = row(actor, rid);
    const res = JSON.parse(r.result);
    const e = res.exceptions.find((x) => x.key === key);
    if (!e) throw new PortalError('Ligne introuvable.');
    e.done = Boolean(done); e.doneBy = done ? actor.id : null; e.doneAt = done ? iso() : null;
    db.prepare('UPDATE reconciliations SET result = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(res), iso(), r.id);
    audit({ userId: actor.id, action: done ? 'reconcile.done_line' : 'reconcile.undo_line', target: `reconciliation:${r.id}`, clientId: r.client_id, ip, details: { key, kind: e.kind } });
    return r.client_id;
  }
  function finish(actor, rid, ip) {
    const r = row(actor, rid);
    const res = JSON.parse(r.result);
    const left = res.exceptions.filter((e) => !e.done && e.kind !== 'outstanding').length;
    if (left) throw new PortalError(`Il reste ${left} écart${left > 1 ? 's' : ''} à régler avant de terminer (les opérations en circulation peuvent rester).`);
    db.prepare("UPDATE reconciliations SET status = 'done', finished_by = ?, finished_at = ?, updated_at = ? WHERE id = ?").run(actor.id, iso(), iso(), r.id);
    audit({ userId: actor.id, action: 'reconcile.finish', target: `reconciliation:${r.id}`, clientId: r.client_id, ip });
    return r.client_id;
  }
  // Écriture faite dans QuickBooks pour une exception : réglée, avec le lien ; l'annulation la rouvre
  function exceptionOf(actor, rid, key) {
    const r = get(actor, rid);
    const e = r.result.exceptions.find((x) => x.key === key);
    if (!e) throw new PortalError('Ligne introuvable.');
    return { r, e };
  }
  function markWrite(rid, key, write) {
    const r = db.prepare('SELECT * FROM reconciliations WHERE id = ?').get(Number(rid));
    const res = JSON.parse(r.result);
    const e = res.exceptions.find((x) => x.key === key);
    if (!e) return;
    if (write) { e.done = true; e.write = write; e.doneAt = iso(); } else { e.done = false; delete e.write; }
    db.prepare('UPDATE reconciliations SET result = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(res), iso(), r.id);
  }
  // Compte bancaire retenu pour ce client (le dernier utilisé, ou le seul)
  function defaultAccount(clientId) {
    const last = db.prepare("SELECT value FROM settings WHERE key = ?").get(`reconcile.account.${Number(clientId)}`);
    if (last && db.prepare("SELECT 1 FROM qbo_accounts WHERE client_id = ? AND qbo_id = ? AND type = 'Bank'").get(Number(clientId), last.value)) return last.value;
    const banks = db.prepare("SELECT qbo_id FROM qbo_accounts WHERE client_id = ? AND type = 'Bank'").all(Number(clientId));
    return banks.length === 1 ? banks[0].qbo_id : null;
  }
  const bankAccounts = (actor, clientId) => db.prepare("SELECT qbo_id AS id, name FROM qbo_accounts WHERE client_id = ? AND type = 'Bank' ORDER BY name").all(requireStaff(actor, clientId));
  const statements = (actor, clientId) => db.prepare("SELECT id, name, period, created_at FROM documents WHERE client_id = ? AND mime = 'application/pdf' AND (doc_type IN ('releve_banque','releve_carte') OR suggested IN ('releve_banque','releve_carte') OR doc_type IS NULL) ORDER BY id DESC LIMIT 30").all(requireStaff(actor, clientId));

  return { start, get, list, mark, finish, bankAccounts, statements, exceptionOf, markWrite, defaultAccount };
}

module.exports = { createReconciler, matchStatement, chequeNo, subsetSum };
