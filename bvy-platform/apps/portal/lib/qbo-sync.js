'use strict';

/**
 * Connexion QuickBooks par client, synchronisation et suggestions (workflow 04).
 * Lecture seule : aucune écriture n'est jamais envoyée à QuickBooks.
 */

const crypto = require('node:crypto');
const { canAccessClient, STAFF_ROLES } = require('./rbac.js');
const { QboError } = require('./qbo.js');
const { PortalError } = require('./portal.js');

const STATE_TTL = 10 * 60_000;
const UNCATEGORIZED_RE = /uncategori[sz]ed|ask my accountant|non[\s-]?cat[ée]goris|demandez.+comptable|à classer/i;
const DAY = 86_400_000;

const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const cents = (v) => Math.round(Number(v || 0) * 100);
const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const money = (c) => new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(c / 100);
const dateFr = (iso) => new Intl.DateTimeFormat('fr-CA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
const monthFr = (y, m) => new Intl.DateTimeFormat('fr-CA', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)));
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function createQboService(db, { qbo, portal, audit, now = () => Date.now() }) {
  const iso = () => new Date(now()).toISOString();
  const isStaff = (u) => Boolean(u && STAFF_ROLES.includes(u.role));
  function requireStaff(actor, clientId) {
    if (!isStaff(actor) || !canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    return Number(clientId);
  }
  const conn = (clientId) => db.prepare('SELECT * FROM qbo_connections WHERE client_id = ?').get(Number(clientId));

  /* ------------------------------------------------------------- connexion */
  function startConnect(actor, clientId) {
    if (!qbo) throw new PortalError('QuickBooks n’est pas encore configuré sur ce serveur.');
    const id = requireStaff(actor, clientId);
    db.prepare('DELETE FROM qbo_oauth_states WHERE created_at < ?').run(now() - STATE_TTL);
    const state = crypto.randomBytes(24).toString('base64url');
    db.prepare('INSERT INTO qbo_oauth_states (state_hash, client_id, user_id, created_at) VALUES (?, ?, ?, ?)').run(sha(state), id, actor.id, now());
    return qbo.authorizeUrl(state);
  }

  async function finishConnect(actor, { code, state, realmId }, ip) {
    if (!qbo) throw new PortalError('QuickBooks n’est pas encore configuré sur ce serveur.');
    const row = db.prepare('SELECT * FROM qbo_oauth_states WHERE state_hash = ?').get(sha(state || ''));
    if (row) db.prepare('DELETE FROM qbo_oauth_states WHERE state_hash = ?').run(row.state_hash);
    if (!row || row.user_id !== actor.id || now() - row.created_at > STATE_TTL) {
      throw new PortalError('La demande de connexion a expiré ou ne vient pas de vous. Recommencez depuis le dossier du client.');
    }
    const clientId = requireStaff(actor, row.client_id);
    const realm = String(realmId || '').replace(/[^0-9]/g, '');
    if (!code || !realm) throw new PortalError('Intuit n’a pas autorisé la connexion.');
    const other = db.prepare('SELECT client_id FROM qbo_connections WHERE realm_id = ? AND client_id != ?').get(realm, clientId);
    if (other) throw new PortalError('Cette entreprise QuickBooks est déjà reliée à un autre client BVY.');
    const t = await qbo.exchangeCode(code);
    let company = null;
    try {
      const info = await qbo.get(realm, `companyinfo/${realm}`, t.accessToken);
      company = info.CompanyInfo && (info.CompanyInfo.CompanyName || info.CompanyInfo.LegalName);
    } catch { /* le nom n'est pas indispensable */ }
    db.prepare(`INSERT INTO qbo_connections (client_id, realm_id, company_name, environment, access_enc, refresh_enc, access_expires, refresh_expires, status, connected_by, connected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET realm_id = excluded.realm_id, company_name = excluded.company_name, environment = excluded.environment,
        access_enc = excluded.access_enc, refresh_enc = excluded.refresh_enc, access_expires = excluded.access_expires,
        refresh_expires = excluded.refresh_expires, status = 'connected', connected_by = excluded.connected_by, connected_at = excluded.connected_at, last_error = NULL`)
      .run(clientId, realm, company, qbo.cfg.environment, qbo.encrypt(t.accessToken), qbo.encrypt(t.refreshToken), t.accessExpires, t.refreshExpires, actor.id, iso());
    audit({ userId: actor.id, action: 'qbo.connect', target: `client:${clientId}`, clientId, ip, details: { realm, environment: qbo.cfg.environment } });
    return clientId;
  }

  async function disconnect(actor, clientId, ip) {
    const id = requireStaff(actor, clientId);
    const c = conn(id);
    if (!c) return;
    if (qbo && c.refresh_enc) { try { await qbo.revoke(qbo.decrypt(c.refresh_enc)); } catch { /* jeton déjà invalide */ } }
    db.prepare('DELETE FROM qbo_connections WHERE client_id = ?').run(id);
    audit({ userId: actor.id, action: 'qbo.disconnect', target: `client:${id}`, clientId: id, ip });
  }

  // Jeton d'accès valide ; renouvelle (et conserve le nouveau jeton de renouvellement) si besoin.
  async function accessToken(c) {
    if (c.access_expires - 5 * 60_000 > now()) return qbo.decrypt(c.access_enc);
    try {
      const t = await qbo.refresh(qbo.decrypt(c.refresh_enc));
      db.prepare('UPDATE qbo_connections SET access_enc = ?, refresh_enc = ?, access_expires = ?, refresh_expires = ?, status = \'connected\' WHERE client_id = ?')
        .run(qbo.encrypt(t.accessToken), qbo.encrypt(t.refreshToken || qbo.decrypt(c.refresh_enc)), t.accessExpires, t.refreshExpires, c.client_id);
      return t.accessToken;
    } catch (err) {
      if (err instanceof QboError && (err.code === 'invalid_grant' || err.status === 400 || err.status === 401)) {
        db.prepare("UPDATE qbo_connections SET status = 'needs_reconnect', last_error = ? WHERE client_id = ?")
          .run('Autorisation QuickBooks expirée ou retirée : reconnexion nécessaire.', c.client_id);
        audit({ action: 'qbo.needs_reconnect', target: `client:${c.client_id}`, clientId: c.client_id });
      }
      throw err;
    }
  }

  /* ---------------------------------------------------- synchronisation */
  async function sync(clientId, trigger = 'manual', actor = null) {
    if (!qbo) throw new PortalError('QuickBooks n’est pas encore configuré sur ce serveur.');
    const id = actor ? requireStaff(actor, clientId) : Number(clientId);
    const c = conn(id);
    if (!c) throw new PortalError('Ce client n’est pas relié à QuickBooks.');
    const running = db.prepare("SELECT 1 FROM sync_jobs WHERE client_id = ? AND status = 'running' AND started_at > ?").get(id, new Date(now() - 5 * 60_000).toISOString());
    if (running) throw new PortalError('Une synchronisation est déjà en cours pour ce client.');
    const job = Number(db.prepare("INSERT INTO sync_jobs (client_id, trigger, started_at, status) VALUES (?, ?, ?, 'running')").run(id, trigger, iso()).lastInsertRowid);
    try {
      const token = await accessToken(c);
      const realm = c.realm_id;
      const app = qbo.cfg.appBase;
      const today = ymd(now());

      // QuickBooks du cabinet : seulement les factures de BVY à ses clients (workflow 05).
      const isFirm = db.prepare('SELECT is_firm FROM clients WHERE id = ?').get(id);
      if (isFirm && isFirm.is_firm) {
        const stats = await billingSync(realm, token);
        db.prepare("UPDATE sync_jobs SET status = 'ok', finished_at = ?, stats = ? WHERE id = ?").run(iso(), JSON.stringify(stats), job);
        db.prepare("UPDATE qbo_connections SET last_sync_at = ?, last_sync_status = 'ok', last_error = NULL WHERE client_id = ?").run(iso(), id);
        audit({ userId: actor ? actor.id : null, action: 'qbo.sync.firm', target: `client:${id}`, details: { trigger, ...stats } });
        return stats;
      }

      const accounts = (await qbo.query(realm, token, "select * from Account where Active = true maxresults 1000")).Account || [];
      const banks = accounts.filter((a) => a.AccountType === 'Bank');
      const uncategorized = new Set(accounts.filter((a) => UNCATEGORIZED_RE.test(a.Name || '') || UNCATEGORIZED_RE.test(a.FullyQualifiedName || '')).map((a) => String(a.Id)));
      const invoices = (await qbo.query(realm, token, "select * from Invoice where Balance > '0' maxresults 1000")).Invoice || [];
      const bills = (await qbo.query(realm, token, "select * from Bill where Balance > '0' maxresults 1000")).Bill || [];
      const since = ymd(now() - 90 * DAY);
      const purchases = (await qbo.query(realm, token, `select * from Purchase where TxnDate >= '${since}' maxresults 1000`)).Purchase || [];

      // Revenus et dépenses des deux derniers mois complets (jamais le mois en cours, incomplet).
      const d = new Date(now());
      const y = d.getUTCFullYear(); const m = d.getUTCMonth();
      const start = ymd(Date.UTC(y, m - 2, 1)); const end = ymd(Date.UTC(y, m, 0));
      let pl = null;
      try { pl = await qbo.get(realm, 'reports/ProfitAndLoss', token, { start_date: start, end_date: end, summarize_column_by: 'Month' }); } catch { pl = null; }

      /* tableau de bord */
      const cash = banks.reduce((s, a) => s + cents(a.CurrentBalance), 0);
      const recv = invoices.reduce((s, i) => s + cents(i.Balance), 0);
      const late = invoices.filter((i) => i.DueDate && Date.parse(`${i.DueDate}T00:00:00Z`) < now() - 30 * DAY);
      const lateSum = late.reduce((s, i) => s + cents(i.Balance), 0);
      const pay = bills.reduce((s, b) => s + cents(b.Balance), 0);
      const soon = bills.filter((b) => b.DueDate && Date.parse(`${b.DueDate}T00:00:00Z`) <= now() + 30 * DAY);
      const changes = [];
      const totals = plTotals(pl);
      if (totals) {
        const [m1, m2] = [monthFr(y, m - 2), monthFr(y, m - 1)];
        for (const [label, a, b] of [['Revenus', totals.income[0], totals.income[1]], ['Dépenses', totals.expenses[0], totals.expenses[1]]]) {
          if (a === null || b === null) continue;
          const pct = a ? Math.round(((b - a) / Math.abs(a)) * 100) : null;
          const up = b >= a;
          changes.push({
            what: `${label} de ${m2} : ${money(b)}${pct === null ? '' : ` (${pct >= 0 ? '+' : '−'} ${Math.abs(pct)} %)`}`,
            why: `Comparé à ${m1} (${money(a)}), selon QuickBooks.`,
            // Forme courte du tableau de bord client : « Revenus   + 8 % »
            label, delta: pct === null ? money(b) : `${pct >= 0 ? '+' : '−'} ${Math.abs(pct)} %`,
            tone: label === 'Revenus' ? (up ? 'up' : 'down') : (up ? 'down' : 'up'),
          });
        }
      }
      if (late.length) changes.push({ what: `${plural(late.length, 'facture en retard', 'factures en retard')} de plus de 30 jours`, why: `${money(lateSum)} attendus : un rappel au client peut aider.`, label: 'Factures en retard', delta: String(late.length), tone: 'down' });

      const prev = db.prepare('SELECT data FROM client_snapshots WHERE client_id = ?').get(id);
      const keep = prev ? JSON.parse(prev.data) : {};
      const data = {
        asOf: today,
        // note : la phrase complète ; hint/tone : la ligne courte colorée du tableau de bord client
        cash: { amount: cash, note: `Dans ${plural(banks.length, 'compte bancaire', 'comptes bancaires')}, selon QuickBooks.`,
          hint: plural(banks.length, 'compte bancaire', 'comptes bancaires'), tone: '' },
        receivable: { amount: recv, note: invoices.length ? `${plural(invoices.length, 'facture impayée', 'factures impayées')}${late.length ? `, dont ${late.length} en retard de plus de 30 jours (${money(lateSum)})` : ''}.` : 'Aucune facture impayée.',
          hint: late.length ? plural(late.length, 'facture en retard', 'factures en retard') : invoices.length ? plural(invoices.length, 'facture impayée', 'factures impayées') : 'Aucune facture impayée',
          tone: late.length ? 'down' : 'up' },
        payable: { amount: pay, note: bills.length ? `${plural(bills.length, 'facture de fournisseur', 'factures de fournisseurs')}${soon.length ? `, dont ${soon.length} à payer d’ici 30 jours` : ''}.` : 'Aucune facture à payer.',
          hint: soon.length ? `${soon.length} à payer d’ici 30 jours` : bills.length ? plural(bills.length, 'facture de fournisseur', 'factures de fournisseurs') : 'Rien à payer', tone: '' },
        health: keep.health || null, // toujours expliquée par l'équipe
        changes,
        work: keep.work || [],
      };
      db.prepare(`INSERT INTO client_snapshots (client_id, data, updated_at, updated_by, source) VALUES (?, ?, ?, NULL, 'qbo')
        ON CONFLICT(client_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = NULL, source = 'qbo'`).run(id, JSON.stringify(data), iso());

      /* suggestions */
      const seen = new Set();
      const upsert = (it) => {
        seen.add(`${it.kind}|${it.qbo_type}|${it.qbo_id}`);
        db.prepare(`INSERT INTO qbo_items (client_id, kind, qbo_type, qbo_id, txn_date, amount_cents, counterparty, detail, qbo_url, first_seen, last_seen)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(client_id, kind, qbo_type, qbo_id) DO UPDATE SET txn_date = excluded.txn_date, amount_cents = excluded.amount_cents,
            counterparty = excluded.counterparty, detail = excluded.detail, qbo_url = excluded.qbo_url, last_seen = excluded.last_seen,
            status = CASE WHEN qbo_items.status = 'resolved' THEN 'new' ELSE qbo_items.status END`)
          .run(id, it.kind, it.qbo_type, it.qbo_id, it.txn_date, it.amount_cents, it.counterparty, it.detail, it.qbo_url, iso(), iso());
      };
      for (const p of purchases) {
        const lines = (p.Line || []).filter((l) => l.AccountBasedExpenseLineDetail && uncategorized.has(String(l.AccountBasedExpenseLineDetail.AccountRef && l.AccountBasedExpenseLineDetail.AccountRef.value)));
        if (!lines.length) continue;
        upsert({ kind: 'uncategorized', qbo_type: 'Purchase', qbo_id: String(p.Id), txn_date: p.TxnDate,
          amount_cents: lines.reduce((s, l) => s + cents(l.Amount), 0), counterparty: (p.EntityRef && p.EntityRef.name) || null,
          detail: p.PrivateNote || lines.map((l) => l.Description).filter(Boolean).join(' · ') || null,
          qbo_url: `${app}/app/${p.PaymentType === 'Check' ? 'check' : 'expense'}?txnId=${encodeURIComponent(p.Id)}` });
      }
      for (const i of late) {
        upsert({ kind: 'overdue_invoice', qbo_type: 'Invoice', qbo_id: String(i.Id), txn_date: i.DueDate, amount_cents: cents(i.Balance),
          counterparty: (i.CustomerRef && i.CustomerRef.name) || null, detail: i.DocNumber ? `Facture n° ${i.DocNumber}` : null,
          qbo_url: `${app}/app/invoice?txnId=${encodeURIComponent(i.Id)}` });
      }
      // Ce qui n'apparaît plus a été corrigé dans QuickBooks : suggestion résolue, tâche du client fermée.
      let resolved = 0;
      for (const it of db.prepare("SELECT * FROM qbo_items WHERE client_id = ? AND status IN ('new','sent')").all(id)) {
        if (seen.has(`${it.kind}|${it.qbo_type}|${it.qbo_id}`)) continue;
        if (it.kind === 'uncategorized' && it.txn_date && it.txn_date < since) continue; // hors de la fenêtre lue
        db.prepare("UPDATE qbo_items SET status = 'resolved' WHERE id = ?").run(it.id);
        if (it.task_id) {
          db.prepare("UPDATE tasks SET status = 'done', answer = COALESCE(answer, 'Corrigé dans QuickBooks') WHERE id = ? AND status IN ('open','answered')").run(it.task_id);
        }
        resolved += 1;
      }

      const stats = { banks: banks.length, invoices: invoices.length, late: late.length, bills: bills.length, purchases: purchases.length, resolved };
      db.prepare("UPDATE sync_jobs SET status = 'ok', finished_at = ?, stats = ? WHERE id = ?").run(iso(), JSON.stringify(stats), job);
      db.prepare("UPDATE qbo_connections SET last_sync_at = ?, last_sync_status = 'ok', last_error = NULL WHERE client_id = ?").run(iso(), id);
      audit({ userId: actor ? actor.id : null, action: 'qbo.sync', target: `client:${id}`, clientId: id, details: { trigger, ...stats } });
      return stats;
    } catch (err) {
      const msg = String(err && err.message || err).slice(0, 600);
      db.prepare("UPDATE sync_jobs SET status = 'failed', finished_at = ?, error = ? WHERE id = ?").run(iso(), msg, job);
      db.prepare("UPDATE qbo_connections SET last_sync_status = 'failed', last_error = ? WHERE client_id = ?").run(msg, id);
      throw err instanceof PortalError ? err : new PortalError(`Synchronisation en échec : ${msg}`);
    }
  }

  // Factures ouvertes du cabinet, regroupées par client QuickBooks (solde, partie en retard, plus vieille échéance).
  async function billingSync(realm, token) {
    const customers = (await qbo.query(realm, token, 'select * from Customer where Active = true maxresults 1000')).Customer || [];
    const invoices = (await qbo.query(realm, token, "select * from Invoice where Balance > '0' maxresults 1000")).Invoice || [];
    const today = ymd(now());
    const agg = new Map();
    for (const i of invoices) {
      const ref = i.CustomerRef || {};
      if (!ref.value) continue;
      const a = agg.get(String(ref.value)) || { name: ref.name || null, balance: 0, overdue: 0, n: 0, oldest: null };
      const bal = cents(i.Balance);
      a.balance += bal; a.n += 1;
      if (i.DueDate && i.DueDate < today) { a.overdue += bal; if (!a.oldest || i.DueDate < a.oldest) a.oldest = i.DueDate; }
      agg.set(String(ref.value), a);
    }
    tx(() => {
      db.prepare('DELETE FROM firm_customers').run();
      const ins = db.prepare('INSERT OR REPLACE INTO firm_customers (customer_id, name) VALUES (?, ?)');
      for (const cu of customers) if (cu.Id) ins.run(String(cu.Id), String(cu.DisplayName || cu.CompanyName || cu.FullyQualifiedName || `Client ${cu.Id}`).slice(0, 200));
      db.prepare('DELETE FROM firm_receivables').run();
      const ir = db.prepare('INSERT INTO firm_receivables (customer_id, customer_name, balance_cents, overdue_cents, invoices, oldest_due, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const [cid, a] of agg) ir.run(cid, a.name, a.balance, a.overdue, a.n, a.oldest, iso());
    });
    return { customers: customers.length, invoices: invoices.length, owing: agg.size };
  }
  const tx = (fn) => { db.exec('BEGIN'); try { fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } };

  async function syncAll(out = console) {
    const rows = db.prepare("SELECT client_id FROM qbo_connections WHERE status = 'connected'").all();
    let ok = 0;
    for (const r of rows) {
      try { await sync(r.client_id, 'schedule'); ok += 1; } catch (err) { out.error(`Client ${r.client_id} : ${err.message}`); }
    }
    return { total: rows.length, ok };
  }

  /* --------------------------------------------------------- suggestions */
  function suggestions(actor, clientId) {
    const id = requireStaff(actor, clientId);
    return db.prepare("SELECT * FROM qbo_items WHERE client_id = ? AND status = 'new' ORDER BY kind, txn_date DESC LIMIT 200").all(id);
  }

  function itemFor(actor, itemId) {
    const it = db.prepare('SELECT * FROM qbo_items WHERE id = ?').get(Number(itemId));
    if (!it) throw new PortalError('Suggestion introuvable.');
    requireStaff(actor, it.client_id);
    return it;
  }

  function sendSuggestion(actor, itemId, ip) {
    const it = itemFor(actor, itemId);
    if (it.status !== 'new') throw new PortalError('Cette suggestion a déjà été traitée.');
    const amt = it.amount_cents === null ? '' : money(it.amount_cents);
    const input = it.kind === 'uncategorized'
      ? { kind: 'question', title: `Nous avons trouvé un paiement de ${amt}${it.counterparty ? ` à ${it.counterparty}` : ''}${it.txn_date ? ` le ${dateFr(it.txn_date)}` : ''}. Était-ce une dépense d’entreprise ?`,
        detail: it.detail ? `Description dans QuickBooks : ${it.detail}` : '', qboUrl: it.qbo_url }
      : { kind: 'info', title: `${it.detail || 'Une facture'}${it.counterparty ? ` à ${it.counterparty}` : ''} (${amt}) est en retard de ${Math.max(31, Math.floor((now() - Date.parse(`${it.txn_date}T00:00:00Z`)) / DAY))} jours.`,
        detail: 'Un rappel à votre client peut aider. Écrivez-nous si vous souhaitez que BVY prépare le message de relance.', qboUrl: it.qbo_url };
    const taskId = portal.createTask(actor, it.client_id, input, ip);
    db.prepare('UPDATE tasks SET qbo_item_id = ? WHERE id = ?').run(it.id, taskId);
    db.prepare("UPDATE qbo_items SET status = 'sent', task_id = ? WHERE id = ?").run(taskId, it.id);
    audit({ userId: actor.id, action: 'qbo.suggestion.send', target: `qbo_item:${it.id}`, clientId: it.client_id, ip });
    return { clientId: it.client_id, taskId };
  }

  function dismissSuggestion(actor, itemId, ip) {
    const it = itemFor(actor, itemId);
    db.prepare("UPDATE qbo_items SET status = 'dismissed' WHERE id = ?").run(it.id);
    audit({ userId: actor.id, action: 'qbo.suggestion.dismiss', target: `qbo_item:${it.id}`, clientId: it.client_id, ip });
    return it.client_id;
  }

  // État pour l'affichage (client et équipe) — jamais de jeton.
  function status(clientId) {
    const c = conn(clientId);
    if (!c) return null;
    return { status: c.status, companyName: c.company_name, environment: c.environment, lastSyncAt: c.last_sync_at, lastSyncStatus: c.last_sync_status, lastError: c.last_error, connectedAt: c.connected_at };
  }

  const newSuggestionCount = (clientId) => db.prepare("SELECT COUNT(*) AS n FROM qbo_items WHERE client_id = ? AND status = 'new'").get(Number(clientId)).n;

  return { enabled: Boolean(qbo), startConnect, finishConnect, disconnect, sync, syncAll, suggestions, sendSuggestion, dismissSuggestion, status, newSuggestionCount };
}

// Rapport ProfitAndLoss par mois → { income: [m1, m2], expenses: [m1, m2] } en cents, ou null.
function plTotals(report) {
  if (!report || !report.Rows || !Array.isArray(report.Rows.Row)) return null;
  const pick = (group) => {
    const row = report.Rows.Row.find((r) => r.group === group);
    const cols = row && row.Summary && row.Summary.ColData;
    if (!cols || cols.length < 3) return [null, null];
    return [cols[1], cols[2]].map((c) => (c && c.value !== '' && !Number.isNaN(Number(c.value)) ? cents(c.value) : null));
  };
  return { income: pick('Income'), expenses: pick('Expenses') };
}

module.exports = { createQboService, plTotals, UNCATEGORIZED_RE };
