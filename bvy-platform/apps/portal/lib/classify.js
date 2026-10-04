'use strict';

/**
 * Classement des opérations non catégorisées (workflow 07) — seulement ce que QuickBooks n'a pas pris en compte.
 * 1. Historique du dossier : le même bénéficiaire, déjà classé dans QuickBooks (≥ 80 % d'au moins 3 paiements).
 * 2. IA, si l'administrateur l'a activée et que la clé est installée : pour le reste, compte choisi dans le plan
 *    comptable du client, avec une confiance et une raison. Une réponse hors du plan comptable est rejetée.
 * BVY n'écrit pas dans QuickBooks : une suggestion acceptée devient « À faire dans QuickBooks ».
 */

const { canAccessClient, STAFF_ROLES } = require('./rbac.js');
const { PortalError, formatAmount } = require('./portal.js');
const { normParty } = require('./anomalies.js');

const DEFAULTS = { 'ai.enabled': '0', 'ai.threshold_strong': '95', 'ai.threshold_suggest': '75' };
const BATCH = 40;

// Suggestion par l'historique : [{ account_id, n, total_cents }] du même bénéficiaire.
function historySuggest(rows) {
  const n = rows.reduce((s, r) => s + r.n, 0);
  if (n < 3) return null;
  const top = [...rows].sort((a, b) => b.n - a.n || b.total_cents - a.total_cents)[0];
  const share = top.n / n;
  if (share < 0.8) return null;
  return { accountId: top.account_id, confidence: Math.max(0, Math.min(99, Math.round(share * 100) - (n < 5 ? 5 : 0))), n, count: top.n };
}

function createClassifier(db, { audit, now = () => Date.now(), ai = null }) {
  const iso = () => new Date(now()).toISOString();
  const isStaff = (u) => Boolean(u && STAFF_ROLES.includes(u.role));
  function requireStaff(actor, clientId) {
    if (!isStaff(actor)) throw new PortalError('Réservé à l’équipe BVY.');
    if (!canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    return Number(clientId);
  }

  /* ---------------------------------------------------------- réglages */
  const setting = (k) => { const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(k); return r ? r.value : DEFAULTS[k]; };
  function settings() {
    return { aiEnabled: setting('ai.enabled') === '1', aiAvailable: Boolean(ai), model: ai ? ai.model : null,
      strong: Number(setting('ai.threshold_strong')), suggest: Number(setting('ai.threshold_suggest')) };
  }
  function saveSettings(actor, input, ip) {
    if (!actor || actor.role !== 'admin') throw new PortalError('Réservé à l’administrateur.');
    const strong = Number(input.strong); const suggest = Number(input.suggest);
    if (!Number.isInteger(strong) || !Number.isInteger(suggest) || suggest < 50 || strong > 100 || suggest >= strong) throw new PortalError('Seuils invalides : « suggestion » entre 50 et le seuil « forte », « forte » au plus 100.');
    const put = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    put.run('ai.enabled', input.aiEnabled === '1' ? '1' : '0');
    put.run('ai.threshold_strong', String(strong));
    put.run('ai.threshold_suggest', String(suggest));
    audit({ userId: actor.id, action: 'ai.settings', target: 'settings:ai', ip, details: { enabled: input.aiEnabled === '1', strong, suggest } });
  }
  const level = (conf, s = settings()) => (conf === null || conf === undefined ? 'validate' : conf >= s.strong ? 'strong' : conf >= s.suggest ? 'suggest' : 'validate');

  /* -------------------------------- données lues pendant la synchronisation */
  // Plan comptable et historique par bénéficiaire, remplacés à chaque synchronisation QuickBooks.
  function saveChart(clientId, accounts) {
    db.prepare('DELETE FROM qbo_accounts WHERE client_id = ?').run(clientId);
    const ins = db.prepare('INSERT INTO qbo_accounts (client_id, qbo_id, name, type) VALUES (?, ?, ?, ?)');
    for (const a of accounts) ins.run(clientId, String(a.Id), String(a.FullyQualifiedName || a.Name || ''), a.AccountType || null);
  }
  // lines : [{ party, accountId, amount, date }] — lignes déjà classées (hors comptes « non catégorisés »)
  function saveHistory(clientId, lines) {
    const map = new Map();
    for (const l of lines) {
      if (!l.party || !l.accountId) continue;
      const k = `${normParty(l.party)}|${l.accountId}`;
      const cur = map.get(k) || { party: normParty(l.party), account_id: String(l.accountId), n: 0, total_cents: 0, last_date: null };
      cur.n += 1; cur.total_cents += Math.abs(l.amount || 0);
      if (!cur.last_date || (l.date && l.date > cur.last_date)) cur.last_date = l.date || cur.last_date;
      map.set(k, cur);
    }
    db.prepare('DELETE FROM qbo_payee_accounts WHERE client_id = ?').run(clientId);
    const ins = db.prepare('INSERT INTO qbo_payee_accounts (client_id, party, account_id, n, total_cents, last_date) VALUES (?, ?, ?, ?, ?, ?)');
    for (const r of map.values()) ins.run(clientId, r.party, r.account_id, r.n, r.total_cents, r.last_date);
  }
  const accountName = (clientId, id) => { const a = db.prepare('SELECT name FROM qbo_accounts WHERE client_id = ? AND qbo_id = ?').get(clientId, String(id)); return a ? a.name : null; };

  /* --------------------------------------------------------- suggestions */
  // retry : redemander à l'IA ce qu'elle n'a pas su classer (bouton « Relancer ») ; sinon une seule fois par opération
  async function classifyClient(clientId, { retry = false } = {}) {
    const id = Number(clientId);
    // Les opérations résolues dans QuickBooks : la suggestion acceptée est faite
    db.prepare(`UPDATE ai_suggestions SET status = 'done' WHERE client_id = ? AND status IN ('new','accepted','chosen')
      AND item_id IN (SELECT id FROM qbo_items WHERE client_id = ? AND status IN ('resolved','dismissed'))`).run(id, id);
    const items = db.prepare(`SELECT i.* FROM qbo_items i LEFT JOIN ai_suggestions s ON s.item_id = i.id
      WHERE i.client_id = ? AND i.kind = 'uncategorized' AND i.status IN ('new','sent') AND (s.id IS NULL OR (s.source = 'none' AND s.status = 'new' AND (s.ai_tried = 0 OR ?)))`).all(id, retry ? 1 : 0);
    if (!items.length) return { history: 0, ai: 0 };
    const ins = db.prepare(`INSERT INTO ai_suggestions (item_id, client_id, account_id, account_name, confidence, source, reason, created_at, ai_tried) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id) DO UPDATE SET account_id = excluded.account_id, account_name = excluded.account_name, confidence = excluded.confidence, source = excluded.source, reason = excluded.reason, created_at = excluded.created_at, ai_tried = MAX(ai_suggestions.ai_tried, excluded.ai_tried)`);
    const rest = []; let hist = 0;
    for (const it of items) {
      const party = it.counterparty ? normParty(it.counterparty) : null;
      const h = party ? historySuggest(db.prepare('SELECT * FROM qbo_payee_accounts WHERE client_id = ? AND party = ?').all(id, party)) : null;
      const name = h && accountName(id, h.accountId);
      if (h && name) {
        ins.run(it.id, id, h.accountId, name, h.confidence, 'history', `${h.count} paiement${h.count > 1 ? 's' : ''} sur ${h.n} à ${it.counterparty} classé${h.count > 1 ? 's' : ''} en « ${name} » dans QuickBooks.`, iso(), 0);
        hist += 1;
      } else rest.push(it);
    }
    let aiCount = 0;
    const s = settings();
    const chart = db.prepare("SELECT qbo_id AS id, name, type FROM qbo_accounts WHERE client_id = ? AND type IN ('Expense','Other Expense','Cost of Goods Sold','Income','Other Income','Fixed Asset','Other Current Asset','Equity','Other Current Liability','Credit Card','Long Term Liability') ORDER BY name").all(id);
    if (ai && s.aiEnabled && rest.length && chart.length) {
      for (let i = 0; i < rest.length; i += BATCH) {
        const batch = rest.slice(i, i + BATCH);
        try {
          const out = await ai.classify(batch.map((it) => ({ ref: String(it.id), party: it.counterparty, description: it.detail, amount: it.amount_cents, date: it.txn_date, kind: it.qbo_type })), chart);
          const valid = new Set(chart.map((a) => String(a.id)));
          for (const r of out.results) {
            const it = batch.find((x) => String(x.id) === String(r.ref));
            if (!it) continue;
            const ok = valid.has(String(r.account_id));
            const conf = Math.max(0, Math.min(100, Math.round(Number(r.confidence) || 0)));
            ins.run(it.id, id, ok ? String(r.account_id) : null, ok ? accountName(id, r.account_id) : null, ok ? conf : null, ok ? 'ai' : 'none',
              ok ? String(r.reason || '').slice(0, 300) : 'Aucun compte du plan comptable ne convient : à choisir ou à demander au client.', iso(), 1);
            if (ok) aiCount += 1;
          }
          db.prepare('INSERT INTO ai_calls (client_id, purpose, items, model, input_tokens, output_tokens, ok, at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
            .run(id, 'classify', batch.length, out.model, out.usage.input_tokens || null, out.usage.output_tokens || null, iso());
        } catch (err) {
          db.prepare('INSERT INTO ai_calls (client_id, purpose, items, model, ok, error, at) VALUES (?, ?, ?, ?, 0, ?, ?)').run(id, 'classify', batch.length, ai.model, String(err.message).slice(0, 300), iso());
        }
      }
    }
    // Ce qui reste sans proposition : à choisir par l'équipe
    for (const it of rest) {
      if (!db.prepare('SELECT 1 FROM ai_suggestions WHERE item_id = ?').get(it.id)) {
        ins.run(it.id, id, null, null, null, 'none', s.aiEnabled && ai ? 'Pas de proposition : à choisir ou à demander au client.' : 'Pas d’historique pour ce bénéficiaire : à choisir ou à demander au client.', iso(), 0);
      }
    }
    audit({ userId: null, action: 'ai.classify', target: `client:${id}`, clientId: id, details: { history: hist, ai: aiCount } });
    return { history: hist, ai: aiCount };
  }

  /* ---------------------------------------------------- regroupement */
  // Par bénéficiaire : opérations, total, suggestion la plus fréquente, confiance la plus basse.
  function groups(actor, clientId) {
    const id = requireStaff(actor, clientId);
    const s = settings();
    const rows = db.prepare(`SELECT i.*, s.id AS sid, s.account_id, s.account_name, s.confidence, s.source, s.reason, s.status AS s_status, s.chosen_account_name
      FROM qbo_items i JOIN ai_suggestions s ON s.item_id = i.id
      WHERE i.client_id = ? AND i.kind = 'uncategorized' AND i.status IN ('new','sent') AND s.status IN ('new','accepted','chosen') ORDER BY i.txn_date DESC`).all(id);
    const map = new Map();
    for (const r of rows) {
      const key = `${r.counterparty ? normParty(r.counterparty) : `#${r.id}`}|${r.s_status === 'new' ? 'new' : 'todo'}`;
      if (!map.has(key)) map.set(key, { key: encodeURIComponent(key), party: r.counterparty || 'Bénéficiaire inconnu', items: [], todo: r.s_status !== 'new' });
      map.get(key).items.push(r);
    }
    const decision = (party) => (party ? db.prepare('SELECT answer, answered_at FROM client_decisions WHERE client_id = ? AND counterparty = ? ORDER BY id DESC LIMIT 1').get(id, normParty(party)) || null : null);
    return [...map.values()].map((g) => {
      const counts = {};
      for (const r of g.items) if (r.account_id) counts[r.account_id] = (counts[r.account_id] || 0) + 1;
      const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      const lead = best ? g.items.find((r) => r.account_id === best[0]) : null;
      const confs = g.items.filter((r) => r.account_id && best && r.account_id === best[0]).map((r) => r.confidence);
      const conf = confs.length ? Math.min(...confs) : null;
      return { ...g, total: g.items.reduce((t, r) => t + (r.amount_cents || 0), 0), count: g.items.length,
        accountId: best ? best[0] : null, accountName: lead ? lead.account_name : null, confidence: conf, source: lead ? lead.source : 'none',
        reason: lead ? lead.reason : g.items[0].reason, level: level(conf, s), agree: best ? best[1] : 0,
        chosen: g.todo ? g.items[0].chosen_account_name || g.items[0].account_name : null, decision: decision(g.items[0].counterparty) };
    }).sort((a, b) => Number(a.todo) - Number(b.todo) || b.total - a.total);
  }

  const chartFor = (actor, clientId) => db.prepare('SELECT qbo_id AS id, name, type FROM qbo_accounts WHERE client_id = ? ORDER BY name').all(requireStaff(actor, clientId));

  // Décision sur un groupe : accepter la suggestion, choisir un autre compte, ou rejeter (revient à « à choisir »).
  function decide(actor, clientId, groupKey, input, ip) {
    const id = requireStaff(actor, clientId);
    const g = groups(actor, id).find((x) => x.key === groupKey || decodeURIComponent(x.key) === decodeURIComponent(groupKey));
    if (!g) throw new PortalError('Ce groupe n’existe plus : la page a peut-être déjà été mise à jour.');
    const action = input.action;
    let status; let accId = null; let accName = null;
    if (action === 'accept') {
      if (!g.accountId) throw new PortalError('Aucune catégorie proposée : choisissez-en une.');
      status = 'accepted'; accId = g.accountId; accName = g.accountName;
    } else if (action === 'choose') {
      accName = accountName(id, input.accountId);
      if (!accName) throw new PortalError('Choisissez un compte du plan comptable du client.');
      status = 'chosen'; accId = String(input.accountId);
    } else if (action === 'undo') {
      status = 'new';
    } else {
      throw new PortalError('Action inconnue.');
    }
    const upd = db.prepare('UPDATE ai_suggestions SET status = ?, chosen_account_id = ?, chosen_account_name = ?, decided_by = ?, decided_at = ? WHERE id = ?');
    for (const r of g.items) upd.run(status, accId, accName, status === 'new' ? null : actor.id, status === 'new' ? null : iso(), r.sid);
    audit({ userId: actor.id, action: `ai.${action}`, target: `client:${id}`, clientId: id, ip,
      details: { party: g.party, items: g.count, suggested: g.accountName, confidence: g.confidence, source: g.source, chosen: accName } });
    return { count: g.count, party: g.party, account: accName };
  }

  // Résumé pour l'onglet et la carte d'anomalie
  function suggestionFor(itemId) {
    return db.prepare('SELECT * FROM ai_suggestions WHERE item_id = ?').get(Number(itemId)) || null;
  }

  return { settings, saveSettings, level, saveChart, saveHistory, classifyClient, groups, chartFor, decide, suggestionFor, money: formatAmount };
}

module.exports = { createClassifier, historySuggest };
