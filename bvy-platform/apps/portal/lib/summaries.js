'use strict';

/**
 * Résumés automatiques (workflow 16) : mensuel (brouillon créé le 3 du mois suivant), trimestriel et annuel sur
 * demande (alignés sur l'exercice du client). Rien n'est envoyé au client sans « Publier ».
 */

const { visibleClients, canAccessClient, STAFF_ROLES } = require('./rbac.js');
const { PortalError, parseAmount, formatAmount } = require('./portal.js');
const { isoDay } = require('./dates.js');
const { monthName } = require('./health.js');

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const TYPES = { month: 'Mensuel', quarter: 'Trimestriel', year: 'Annuel' };
const money = (c) => formatAmount(c);
const monthEnd = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // m : 1 à 12
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ----------------------------------------------------------- périodes */
// Dernière période terminée avant « today » (AAAA-MM-JJ). yem : mois de fin d'exercice (1 à 12).
function lastPeriod(type, today, yem = 12) {
  let y = Number(today.slice(0, 4)); let m = Number(today.slice(5, 7)) - 1; // dernier mois complet
  if (m === 0) { m = 12; y -= 1; }
  if (type === 'month') return periodOf('month', `${y}-${String(m).padStart(2, '0')}`, yem);
  const step = type === 'quarter' ? 3 : 12;
  // Fins de période : yem, yem - 3, … ; on recule jusqu'à une fin ≤ au dernier mois complet
  for (let i = 0; i < 12; i++) {
    if (((m - yem) % step + step) % step === 0) return periodOf(type, `${y}-${String(m).padStart(2, '0')}`, yem);
    m -= 1; if (m === 0) { m = 12; y -= 1; }
  }
  return null;
}

// Période désignée par son mois de fin « AAAA-MM ».
function periodOf(type, endYm, yem = 12) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(endYm || ''))) throw new PortalError('Période invalide.');
  const ey = Number(endYm.slice(0, 4)); const em = Number(endYm.slice(5, 7));
  const len = type === 'month' ? 1 : type === 'quarter' ? 3 : 12;
  if (type !== 'month' && ((em - yem) % len + len) % len !== 0) throw new PortalError('Ce mois ne termine pas un trimestre ou un exercice de ce client.');
  const startDate = new Date(Date.UTC(ey, em - len, 1)).toISOString().slice(0, 10); // Date.UTC gère les mois négatifs
  const end = monthEnd(ey, em);
  const label = type === 'month' ? cap(`${MONTHS[em - 1]} ${ey}`)
    : type === 'quarter' ? `Trimestre ${/^[aeiouéo]/.test(MONTHS[Number(startDate.slice(5, 7)) - 1]) ? 'd’' : 'de '}${MONTHS[Number(startDate.slice(5, 7)) - 1]} à ${MONTHS[em - 1]} ${ey}`
      : em === 12 ? `Année ${ey}` : `Exercice terminé le ${end}`;
  return { type, start: startDate, end, endYm, label };
}

// Période précédente de même durée (pour comparer).
function previousOf(p, yem) {
  const d = new Date(`${p.start}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1);
  return periodOf(p.type, d.toISOString().slice(0, 7), yem);
}

function createSummaries(db, { audit, now = () => Date.now(), health, periodTotals = async () => null }) {
  const iso = () => new Date(now()).toISOString();
  const today = () => isoDay(now());
  const isStaff = (u) => Boolean(u && STAFF_ROLES.includes(u.role));
  function requireStaff(actor, clientId) {
    if (!isStaff(actor)) throw new PortalError('Réservé à l’équipe BVY.');
    if (!canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    return Number(clientId);
  }
  const inPeriod = (x, p) => { const d = isoDay(x); return d >= p.start && d <= p.end; };

  /* ---------------------------------------- ce que BVY a fait (comptes) */
  function bvyActions(clientId, p) {
    // Fenêtre large en UTC, puis filtre exact sur la date de Montréal
    const lo = new Date(Date.parse(`${p.start}T00:00:00Z`) - 86_400_000).toISOString();
    const hi = new Date(Date.parse(`${p.end}T00:00:00Z`) + 2 * 86_400_000).toISOString();
    const count = (sql, ...args) => db.prepare(sql).all(...args).filter((r) => inPeriod(r.at, p)).length;
    const items = [
      ['Documents reçus et classés', count("SELECT filed_at AS at FROM documents WHERE client_id = ? AND origin = 'client' AND filed = 1 AND filed_at BETWEEN ? AND ?", clientId, lo, hi)],
      ['Questions réglées avec vous', count("SELECT answered_at AS at FROM tasks WHERE client_id = ? AND kind IN ('question','approval') AND answered_at BETWEEN ? AND ?", clientId, lo, hi)],
      ['Déclarations de TPS/TVQ produites', count("SELECT filed_at AS at FROM tax_returns WHERE client_id = ? AND status = 'filed' AND filed_at BETWEEN ? AND ?", clientId, lo, hi)],
      ['Déclarations de revenus produites', count("SELECT filed_at AS at FROM tax_files WHERE client_id = ? AND status = 'filed' AND filed_at BETWEEN ? AND ?", clientId, lo, hi)],
      ['Paies complétées', count("SELECT e.at FROM pay_run_events e JOIN pay_runs r ON r.id = e.run_id WHERE r.client_id = ? AND e.to_status = 'done' AND e.at BETWEEN ? AND ?", clientId, lo, hi)],
      ['Réponses envoyées au gouvernement', count("SELECT e.at FROM gov_request_events e JOIN gov_requests g ON g.id = e.request_id WHERE g.client_id = ? AND e.to_status = 'sent' AND e.at BETWEEN ? AND ?", clientId, lo, hi)],
      ['Anomalies réglées dans votre comptabilité', count("SELECT e.at FROM anomaly_events e JOIN anomalies a ON a.id = e.anomaly_id WHERE a.client_id = ? AND e.to_status = 'resolved' AND e.at BETWEEN ? AND ?", clientId, lo, hi)],
    ];
    return items.filter(([, n]) => n > 0).map(([label, n]) => ({ label, n }));
  }

  // Chiffres de la période : QuickBooks (rapport exact), sinon l'instantané si c'est le dernier mois synchronisé.
  async function figuresFor(c, p) {
    const q = await periodTotals(c.id, p.start, p.end);
    const prev = previousOf(p, c.year_end_month);
    const qp = q ? await periodTotals(c.id, prev.start, prev.end) : null;
    if (q) return { income: q.income, expenses: q.expenses, prevIncome: qp ? qp.income : null, prevExpenses: qp ? qp.expenses : null, prevLabel: prev.label, source: 'qbo' };
    const snap = db.prepare('SELECT data FROM client_snapshots WHERE client_id = ?').get(c.id);
    const pl = snap && JSON.parse(snap.data).pl;
    if (p.type === 'month' && pl && pl.months && pl.months[1] === p.endYm) {
      return { income: pl.income[1], expenses: pl.expenses[1], prevIncome: pl.income[0], prevExpenses: pl.expenses[0], prevLabel: cap(monthName(pl.months[0])), source: 'qbo' };
    }
    return { income: null, expenses: null, prevIncome: null, prevExpenses: null, prevLabel: prev.label, source: null };
  }

  function sections(c, p) {
    const snapRow = db.prepare('SELECT data, updated_at FROM client_snapshots WHERE client_id = ?').get(c.id);
    const snap = snapRow ? JSON.parse(snapRow.data) : null;
    // Soldes de fin de période : seulement si l'instantané date de la fin de la période (ou du mois qui suit)
    const fresh = snap && snap.asOf && snap.asOf >= p.end && snap.asOf <= new Date(Date.parse(`${p.end}T00:00:00Z`) + 35 * 86_400_000).toISOString().slice(0, 10);
    const h = health ? health.forClient(c.id) : null;
    return {
      balances: fresh ? { asOf: snap.asOf, cash: snap.cash && snap.cash.amount, receivable: snap.receivable && snap.receivable.amount, payable: snap.payable && snap.payable.amount } : null,
      changes: fresh && Array.isArray(snap.changes) ? snap.changes.map((x) => ({ what: x.what, why: x.why })).slice(0, 6) : [],
      watch: h ? h.indicators.filter((i) => i.state !== 'good').map((i) => ({ label: i.label, state: i.state, why: i.why })) : [],
      healthAsOf: today(),
      todo: db.prepare("SELECT title, due_date FROM tasks WHERE client_id = ? AND status = 'open' ORDER BY COALESCE(due_date, '9999'), id LIMIT 8").all(c.id),
      bvy: bvyActions(c.id, p),
    };
  }

  function defaultIntro(p, f) {
    if (f.income === null || f.expenses === null) return `Voici le résumé de votre dossier pour ${p.type === 'month' ? p.label.toLowerCase() : `la période du ${p.start} au ${p.end}`}.`;
    const net = f.income - f.expenses;
    return `${p.type === 'month' ? `En ${p.label.toLowerCase()}` : `Du ${p.start} au ${p.end}`}, vos revenus ont été de ${money(f.income)} et vos dépenses de ${money(f.expenses)} : ${net >= 0 ? `un bénéfice de ${money(net)}` : `une perte de ${money(-net)}`}.`;
  }

  /* ------------------------------------------------------- brouillons */
  async function generate(actor, clientId, type, endYm = null, ip) {
    const id = actor ? requireStaff(actor, clientId) : Number(clientId);
    const c = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!c || c.is_firm) throw new PortalError('Ce dossier n’existe pas.');
    if (!TYPES[type]) throw new PortalError('Type de résumé invalide.');
    const p = endYm ? periodOf(type, endYm, c.year_end_month) : lastPeriod(type, today(), c.year_end_month);
    if (p.end >= today()) throw new PortalError('Cette période n’est pas encore terminée.');
    const f = await figuresFor(c, p);
    const data = sections(c, p);
    const cur = db.prepare('SELECT * FROM summaries WHERE client_id = ? AND period_type = ? AND period_start = ?').get(id, type, p.start);
    if (cur) {
      // On garde ce que l'équipe a écrit ; les chiffres saisis à la main ne sont pas écrasés par l'absence de QuickBooks
      const old = cur.figures ? JSON.parse(cur.figures) : null;
      const figures = old && old.source === 'staff' && f.source !== 'qbo' ? old : f;
      db.prepare("UPDATE summaries SET data = ?, figures = ?, status = 'draft', updated_at = ? WHERE id = ?").run(JSON.stringify(data), JSON.stringify(figures), iso(), cur.id);
      audit({ userId: actor ? actor.id : null, action: 'summary.refresh', target: `summary:${cur.id}`, clientId: id, ip });
      return cur.id;
    }
    const sid = Number(db.prepare(`INSERT INTO summaries (client_id, period_type, period_start, period_end, label, data, intro, figures, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, type, p.start, p.end, p.label, JSON.stringify(data), defaultIntro(p, f), JSON.stringify(f), actor ? actor.id : null, iso(), iso()).lastInsertRowid);
    audit({ userId: actor ? actor.id : null, action: 'summary.draft', target: `summary:${sid}`, clientId: id, ip, details: { type, start: p.start } });
    return sid;
  }

  async function generateAll(actor, type, endYm = null, ip) {
    const out = { created: 0, skipped: 0 };
    for (const c of visibleClients(db, actor)) {
      try { await generate(actor, c.id, type, endYm, ip); out.created += 1; } catch { out.skipped += 1; }
    }
    return out;
  }

  // Le 3 du mois et après : un brouillon du mois précédent pour chaque client actif qui a un accès au portail.
  async function ensureMonthly() {
    if (Number(today().slice(8, 10)) < 3) return 0;
    let n = 0;
    for (const c of db.prepare(`SELECT c.* FROM clients c WHERE c.status = 'active' AND c.is_firm = 0
      AND EXISTS (SELECT 1 FROM users u WHERE u.client_id = c.id AND u.status = 'active')`).all()) {
      const p = lastPeriod('month', today(), c.year_end_month);
      if (db.prepare("SELECT 1 FROM summaries WHERE client_id = ? AND period_type = 'month' AND period_start = ?").get(c.id, p.start)) continue;
      try { await generate(null, c.id, 'month'); n += 1; } catch (err) { console.error('Résumé :', err.message); }
    }
    return n;
  }

  /* ---------------------------------------------------- édition, envoi */
  function row(actor, sid) {
    const s = db.prepare('SELECT * FROM summaries WHERE id = ?').get(Number(sid));
    if (!s) throw new PortalError('Résumé introuvable.');
    requireStaff(actor, s.client_id);
    return s;
  }
  const decode = (s) => ({ ...s, data: JSON.parse(s.data), figures: s.figures ? JSON.parse(s.figures) : null });

  function get(actor, sid) {
    const s = decode(row(actor, sid));
    const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(s.client_id);
    const versions = db.prepare('SELECT v.version, v.published_at, u.name FROM summary_versions v LEFT JOIN users u ON u.id = v.published_by WHERE v.summary_id = ? ORDER BY v.version DESC').all(s.id);
    return { ...s, client, versions };
  }

  function update(actor, sid, input, ip) {
    const s = row(actor, sid);
    const intro = String(input.intro || '').trim().slice(0, 2000);
    if (intro.length < 10) throw new PortalError('Écrivez le paragraphe « En bref » (au moins une phrase).');
    const old = s.figures ? JSON.parse(s.figures) : {};
    const inc = parseAmount(input.income); const exp = parseAmount(input.expenses);
    const changed = inc !== old.income || exp !== old.expenses;
    const figures = changed ? { ...old, income: inc, expenses: exp, source: inc === null && exp === null ? null : 'staff' } : old;
    db.prepare('UPDATE summaries SET intro = ?, figures = ?, updated_at = ? WHERE id = ?').run(intro, JSON.stringify(figures), iso(), s.id);
    audit({ userId: actor.id, action: 'summary.edit', target: `summary:${s.id}`, clientId: s.client_id, ip });
  }

  function publish(actor, sid, ip) {
    const s = row(actor, sid);
    if (!s.intro || s.intro.trim().length < 10) throw new PortalError('Écrivez le paragraphe « En bref » avant de publier.');
    const v = s.version + 1;
    db.prepare('INSERT INTO summary_versions (summary_id, version, data, intro, figures, published_by, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(s.id, v, s.data, s.intro, s.figures, actor.id, iso());
    db.prepare("UPDATE summaries SET status = 'published', version = ?, published_by = ?, published_at = ? WHERE id = ?").run(v, actor.id, iso(), s.id);
    audit({ userId: actor.id, action: 'summary.publish', target: `summary:${s.id}`, clientId: s.client_id, ip, details: { version: v } });
    return { clientId: s.client_id, label: s.label, version: v };
  }

  function list(actor, { status = 'draft', clientId = null } = {}) {
    if (!isStaff(actor)) throw new PortalError('Réservé à l’équipe BVY.');
    const ids = (clientId ? [requireStaff(actor, clientId)] : visibleClients(db, actor).map((c) => c.id)).map(Number).join(',') || '0';
    return db.prepare(`SELECT s.*, c.name AS client FROM summaries s JOIN clients c ON c.id = s.client_id
      WHERE s.client_id IN (${ids}) ${status === 'all' ? '' : 'AND s.status = ?'} ORDER BY s.period_end DESC, c.name LIMIT 300`).all(...(status === 'all' ? [] : [status])).map(decode);
  }

  /* ---------------------------------------------------- côté client */
  // Seulement la dernière version publiée de chaque résumé du client.
  function forClient(actor, clientId) {
    if (!canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    return db.prepare(`SELECT s.id, s.label, s.period_type, s.period_start, s.period_end, v.version, v.published_at FROM summaries s
      JOIN summary_versions v ON v.summary_id = s.id AND v.version = (SELECT MAX(version) FROM summary_versions WHERE summary_id = s.id)
      WHERE s.client_id = ? ORDER BY s.period_end DESC, s.period_type`).all(Number(clientId));
  }
  function publishedFor(actor, sid) {
    const s = db.prepare('SELECT * FROM summaries WHERE id = ?').get(Number(sid));
    if (!s || !canAccessClient(db, actor, s.client_id)) throw new PortalError('Résumé introuvable.');
    const v = db.prepare('SELECT * FROM summary_versions WHERE summary_id = ? ORDER BY version DESC LIMIT 1').get(s.id);
    if (!v) throw new PortalError('Résumé introuvable.');
    return { id: s.id, label: s.label, type: s.period_type, start: s.period_start, end: s.period_end, data: JSON.parse(v.data), intro: v.intro, figures: v.figures ? JSON.parse(v.figures) : null, publishedAt: v.published_at, version: v.version };
  }

  return { generate, generateAll, ensureMonthly, get, update, publish, list, forClient, publishedFor, lastPeriod: (type, yem) => lastPeriod(type, today(), yem) };
}

module.exports = { createSummaries, lastPeriod, periodOf, previousOf, TYPES };
