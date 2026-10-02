'use strict';

/**
 * Tableau de bord de l'équipe (workflow 05) : profil fiscal des clients, échéances calculées ou ajoutées,
 * sommes dues à BVY (QuickBooks du cabinet) et regroupement par type de client.
 * Tout accès passe par canAccessClient() ; la fiche du cabinet n'est jamais un client.
 */

const { canAccessClient, visibleClients, STAFF_ROLES } = require('./rbac.js');
const { PortalError } = require('./portal.js');
const { computeDeadlines, urgency, KINDS } = require('./deadlines.js');

const FIRM_NAME = 'BVY — QuickBooks du cabinet';
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
// Comparaison de noms : sans accents, ponctuation ni forme juridique.
const normName = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(inc|incorporee|ltee|ltd|limitee|enr|senc|corp|corporation|cie)\b\.?/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function createWorkqueue(db, { audit, now = () => Date.now() }) {
  const today = () => ymd(now());
  const isStaff = (u) => Boolean(u && STAFF_ROLES.includes(u.role) && u.status === 'active');
  // allowFirm : la fiche du cabinet (obligations de BVY elle-même), administrateur seulement (canAccessClient).
  function requireStaff(actor, clientId, { allowFirm = false } = {}) {
    if (!isStaff(actor) || !canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    const c = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(clientId));
    if (!c || (c.is_firm && !allowFirm)) throw new PortalError('Accès refusé.');
    return c;
  }
  const profileOf = (c) => ({ kind: c.kind, yearEndMonth: c.year_end_month, gstFreq: c.gst_freq, payroll: Boolean(c.payroll), installments: Boolean(c.installments) });

  /* ------------------------------------------------------ profil fiscal */
  function saveProfile(actor, clientId, form, ip) {
    const c = requireStaff(actor, clientId, { allowFirm: true });
    const kind = c.is_firm ? 'entreprise' : String(form.kind || '');
    if (!KINDS[kind]) throw new PortalError('Choisissez le type de client : entreprise, travailleur autonome ou particulier.');
    const month = Number(form.yearEndMonth || 12);
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new PortalError('Mois de fin d’exercice invalide.');
    const gst = ['none', 'monthly', 'quarterly', 'annual'].includes(form.gstFreq) ? form.gstFreq : 'none';
    let billing = c.is_firm ? null : String(form.billingCustomerId || '').trim() || null;
    if (billing && !db.prepare('SELECT 1 FROM firm_customers WHERE customer_id = ?').get(billing)) throw new PortalError('Client QuickBooks du cabinet introuvable.');
    const v = {
      kind,
      year_end_month: kind === 'entreprise' ? month : 12, // particuliers et autonomes : année civile
      gst_freq: kind === 'particulier' ? 'none' : gst,
      payroll: kind !== 'particulier' && form.payroll === '1' ? 1 : 0,
      installments: form.installments === '1' ? 1 : 0,
    };
    // Les échéances antérieures au profil ne sont jamais présentées « en retard ».
    const since = !c.profile_since || c.kind !== kind ? today() : c.profile_since;
    db.prepare(`UPDATE clients SET kind = ?, year_end_month = ?, gst_freq = ?, payroll = ?, installments = ?, profile_since = ?, billing_customer_id = ? WHERE id = ?`)
      .run(v.kind, v.year_end_month, v.gst_freq, v.payroll, v.installments, since, billing, c.id);
    audit({ userId: actor.id, action: 'client.profile', target: `client:${c.id}`, clientId: c.id, ip, details: { ...v, billing } });
  }

  /* --------------------------------------------- tenue de livres (3 couleurs) */
  function setBooks(actor, clientId, status, ip) {
    const c = requireStaff(actor, clientId);
    if (!['todo', 'progress', 'done'].includes(status)) throw new PortalError('État de la tenue de livres invalide.');
    db.prepare('UPDATE clients SET books_status = ?, books_updated_at = ?, books_updated_by = ? WHERE id = ?').run(status, new Date(now()).toISOString(), actor.id, c.id);
    audit({ userId: actor.id, action: 'client.books', target: `client:${c.id}`, clientId: c.id, ip, details: { status } });
  }

  /* -------------------------------------------------------- échéances */
  function deadlinesFor(c, day = today()) {
    const marks = new Map(db.prepare('SELECT key, status FROM deadline_marks WHERE client_id = ?').all(c.id).map((r) => [r.key, r.status]));
    const computed = computeDeadlines(profileOf(c), day).map((d) => ({ ...d, custom: false }));
    const custom = db.prepare('SELECT * FROM custom_deadlines WHERE client_id = ? ORDER BY due_date').all(c.id)
      .map((d) => ({ key: `custom:${d.id}`, title: d.title, date: d.due_date, area: 'autre', custom: true, id: d.id }));
    const since = c.profile_since || day;
    return [...computed, ...custom]
      .map((d) => ({ ...d, mark: marks.get(d.key) || null, urgency: urgency(d.date, day) }))
      // Avant la mise en place du profil : rien n'est présenté comme en retard.
      .filter((d) => d.custom || d.date >= day || d.date >= since)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  const nextDeadline = (c, day = today()) => deadlinesFor(c, day).find((d) => !d.mark) || null;

  function listDeadlines(actor, clientId) {
    const c = requireStaff(actor, clientId, { allowFirm: true });
    return deadlinesFor(c);
  }

  function markDeadline(actor, clientId, key, status, ip) {
    const c = requireStaff(actor, clientId, { allowFirm: true });
    const k = String(key || '');
    if (!deadlinesFor(c).some((d) => d.key === k)) throw new PortalError('Échéance introuvable.');
    if (status === 'open') {
      db.prepare('DELETE FROM deadline_marks WHERE client_id = ? AND key = ?').run(c.id, k);
    } else {
      const st = status === 'na' ? 'na' : 'done';
      db.prepare(`INSERT INTO deadline_marks (client_id, key, status, marked_by, marked_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(client_id, key) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by, marked_at = excluded.marked_at`)
        .run(c.id, k, st, actor.id, new Date(now()).toISOString());
    }
    audit({ userId: actor.id, action: 'deadline.mark', target: `client:${c.id}`, clientId: c.id, ip, details: { key: k, status } });
  }

  function addCustomDeadline(actor, clientId, { title, date }, ip) {
    const c = requireStaff(actor, clientId, { allowFirm: true });
    const t = String(title || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    if (t.length < 3) throw new PortalError('Décrivez l’échéance.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) throw new PortalError('Date invalide.');
    db.prepare('INSERT INTO custom_deadlines (client_id, title, due_date, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(c.id, t, date, actor.id, new Date(now()).toISOString());
    audit({ userId: actor.id, action: 'deadline.add', target: `client:${c.id}`, clientId: c.id, ip, details: { title: t, date } });
  }

  function deleteCustomDeadline(actor, clientId, id, ip) {
    const c = requireStaff(actor, clientId, { allowFirm: true });
    const r = db.prepare('DELETE FROM custom_deadlines WHERE id = ? AND client_id = ?').run(Number(id), c.id);
    if (!r.changes) throw new PortalError('Échéance introuvable.');
    db.prepare('DELETE FROM deadline_marks WHERE client_id = ? AND key = ?').run(c.id, `custom:${Number(id)}`);
    audit({ userId: actor.id, action: 'deadline.delete', target: `client:${c.id}`, clientId: c.id, ip, details: { id: Number(id) } });
  }

  /* ------------------------------------------- QuickBooks du cabinet */
  // Fiche interne du cabinet : porte la connexion QuickBooks de BVY, jamais affichée comme un client.
  function firmClient(create = false) {
    let f = db.prepare('SELECT * FROM clients WHERE is_firm = 1').get();
    if (!f && create) {
      const { lastInsertRowid } = db.prepare("INSERT INTO clients (name, is_firm, created_at) VALUES (?, 1, ?)").run(FIRM_NAME, new Date(now()).toISOString());
      f = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(lastInsertRowid));
    }
    return f || null;
  }
  const firmCustomers = () => db.prepare('SELECT * FROM firm_customers ORDER BY name').all();
  const firmReceivables = () => db.prepare('SELECT * FROM firm_receivables ORDER BY balance_cents DESC').all();

  // Ce que le client doit à BVY : client QuickBooks choisi, sinon même nom.
  function owedBy(c, receivables = firmReceivables(), customers = null) {
    if (c.billing_customer_id) {
      const r = receivables.find((x) => x.customer_id === c.billing_customer_id);
      return { matched: 'chosen', customerId: c.billing_customer_id, ...(r ? { balance: r.balance_cents, overdue: r.overdue_cents, invoices: r.invoices, oldestDue: r.oldest_due } : { balance: 0, overdue: 0, invoices: 0 }) };
    }
    const n = normName(c.name);
    const r = n && receivables.find((x) => normName(x.customer_name) === n);
    if (r) return { matched: 'name', customerId: r.customer_id, balance: r.balance_cents, overdue: r.overdue_cents, invoices: r.invoices, oldestDue: r.oldest_due };
    const cust = n && (customers || firmCustomers()).find((x) => normName(x.name) === n);
    return cust ? { matched: 'name', customerId: cust.customer_id, balance: 0, overdue: 0, invoices: 0 } : null;
  }

  /* ------------------------------------------------- tableau de bord */
  function dashboard(actor, { qboStatus = () => null, suggestions = () => 0, unread = () => 0 } = {}) {
    if (!isStaff(actor)) throw new PortalError('Accès refusé.');
    const day = today();
    const receivables = firmReceivables();
    const customers = firmCustomers();
    const firm = firmClient();
    const rows = visibleClients(db, actor).map((c) => {
      const list = c.kind ? deadlinesFor(c, day).filter((d) => !d.mark) : [];
      const next = list[0] || null;
      const pick = (re) => list.find((d) => re.test(d.key)) || null;
      // Une colonne par obligation ; null = ne s'applique pas à ce client
      const cols = {
        taxes: c.kind && c.kind !== 'particulier' && c.gst_freq !== 'none' ? pick(/^taxes(pay)?:/) : null,
        das: c.payroll && c.kind !== 'particulier' ? pick(/^(das|t4):/) : null,
        t2: c.kind === 'entreprise' ? pick(/^(t2|t2pay|req):/) : null,
        t1: c.kind === 'autonome' || c.kind === 'particulier' ? pick(/^t1(pay)?:/) : null,
        cnesst: c.payroll && c.kind !== 'particulier' ? pick(/^cnesst:/) : null,
        acompte: c.installments ? pick(/^acompte:/) : null,
        other: list.find((d) => d.custom) || null,
      };
      const applies = { taxes: Boolean(c.kind && c.kind !== 'particulier' && c.gst_freq !== 'none'), das: Boolean(c.payroll && c.kind !== 'particulier'),
        cnesst: Boolean(c.payroll && c.kind !== 'particulier'), acompte: Boolean(c.installments) };
      return {
        id: c.id, name: c.name, kind: c.kind || null, next, cols, applies,
        late: list.filter((d) => d.urgency.level === 'late').length,
        books: c.books_status || 'todo', booksAt: c.books_updated_at,
        owed: firm ? owedBy(c, receivables, customers) : null,
        waiting: db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE client_id = ? AND status = 'open'").get(c.id).n,
        answered: db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE client_id = ? AND status = 'answered'").get(c.id).n,
        unread: unread(c.id), qbo: qboStatus(c.id), suggestions: suggestions(c.id),
      };
    });
    const byDate = (a, b) => (a.next ? a.next.date : '9999') .localeCompare(b.next ? b.next.date : '9999') || a.name.localeCompare(b.name, 'fr');
    const groups = ['entreprise', 'autonome', 'particulier'].map((k) => ({ kind: k, label: KINDS[k], rows: rows.filter((r) => r.kind === k).sort(byDate) }));
    const unset = rows.filter((r) => !r.kind).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const nexts = rows.map((r) => r.next).filter(Boolean);
    const summary = {
      late: rows.reduce((n, r) => n + r.late, 0),
      lateClients: rows.filter((r) => r.late).length,
      books: { done: rows.filter((r) => r.kind && r.kind !== 'particulier' && r.books === 'done').length,
        progress: rows.filter((r) => r.kind !== 'particulier' && r.books === 'progress').length,
        todo: rows.filter((r) => r.kind !== 'particulier' && r.books === 'todo').length },
      week: nexts.filter((d) => d.urgency.level === 'week').length,
      owed: rows.reduce((s, r) => s + (r.owed && r.owed.balance ? r.owed.balance : 0), 0),
      owedClients: rows.filter((r) => r.owed && r.owed.balance > 0).length,
      overdue: rows.reduce((s, r) => s + (r.owed && r.owed.overdue ? r.owed.overdue : 0), 0),
      waiting: rows.reduce((s, r) => s + r.waiting, 0),
      qboIssues: rows.filter((r) => r.qbo && (r.qbo.status !== 'connected' || r.qbo.lastSyncStatus === 'failed')).length,
    };
    const firmInfo = firm ? { id: firm.id, qbo: qboStatus(firm.id) } : null;
    return { groups, unset, summary, firm: firmInfo, total: rows.length };
  }

  /* ------------------------------------------------------- facturation */
  // Qui doit quoi à BVY (QuickBooks du cabinet) : administrateur et comptable principal.
  function billing(actor) {
    if (!isStaff(actor) || !['admin', 'lead'].includes(actor.role)) throw new PortalError('Accès refusé.');
    const firm = firmClient();
    const receivables = firmReceivables();
    const customers = firmCustomers();
    const used = new Set();
    const rows = visibleClients(db, actor).map((c) => {
      const o = firm ? owedBy(c, receivables, customers) : null;
      if (o) used.add(o.customerId);
      return { id: c.id, name: c.name, kind: c.kind, owed: o };
    });
    const unlinked = receivables.filter((r) => !used.has(r.customer_id));
    const owing = rows.filter((r) => r.owed && r.owed.balance > 0).sort((a, b) => b.owed.overdue - a.owed.overdue || b.owed.balance - a.owed.balance);
    const total = receivables.reduce((n, r) => n + r.balance_cents, 0);
    const overdue = receivables.reduce((n, r) => n + r.overdue_cents, 0);
    return { firm: firm ? { id: firm.id } : null, owing, paid: rows.filter((r) => r.owed && !r.owed.balance), notFound: rows.filter((r) => !r.owed), unlinked, total, overdue,
      syncedAt: receivables.length ? receivables[0].synced_at : null };
  }

  // Obligations de BVY (fiche du cabinet), pour l'administration
  function firmDeadlines(actor) {
    if (!actor || actor.role !== 'admin') throw new PortalError('Accès refusé.');
    const f = firmClient();
    return f && f.kind ? deadlinesFor(f) : [];
  }

  return { setBooks, billing, firmDeadlines, requireFirm: (actor) => requireStaff(actor, firmClient(true).id, { allowFirm: true }), saveProfile, listDeadlines, markDeadline, addCustomDeadline, deleteCustomDeadline, nextDeadline, deadlinesFor,
    firmClient, firmCustomers, firmReceivables, owedBy, dashboard, profileOf };
}

module.exports = { createWorkqueue, normName, FIRM_NAME };
