'use strict';

/**
 * Anomalies (workflow 06) et validation par le client (workflow 08).
 * Règles déterministes, relancées chaque heure et après chaque synchronisation QuickBooks.
 * Une anomalie qui n'est plus détectée se ferme seule (« Plus détecté ») ; une anomalie ignorée n'est pas relevée de nouveau.
 */

const { visibleClients, canAccessClient, STAFF_ROLES } = require('./rbac.js');
const { PortalError, formatAmount } = require('./portal.js');
const { isoDay } = require('./dates.js');

const DAY = 86_400_000;
const SEVERITY = { urgent: 'Urgente', system: 'Système', standard: 'Standard' };
const STATUS = {
  open: 'Ouverte', in_progress: 'En cours', waiting_client: 'En attente du client', answered: 'Réponse reçue', resolved: 'Résolue', dismissed: 'Ignorée',
};
const ACTIVE = ['open', 'in_progress', 'waiting_client', 'answered'];
const TYPES = {
  duplicate: 'Transaction en double', unusual: 'Transaction inhabituelle', uncategorized: 'Catégorie incertaine', missing_document: 'Document manquant',
  qbo_disconnected: 'QuickBooks déconnecté', sync_failed: 'Synchronisation en échec', sync_stale: 'Données pas à jour', missing_data: 'Données manquantes',
  cash: 'Trésorerie dangereuse', deadline: 'Échéance fiscale', gov_request: 'Demande du gouvernement', overdue_major: 'Facture client très en retard', payroll_risk: 'Paie à risque',
};
const ASKABLE = ['duplicate', 'unusual', 'uncategorized'];
const money = (c) => formatAmount(c);
const normParty = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const daysBetween = (a, b) => Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY);

/* ------------------------------------------------- règles sur les opérations QBO */
// txns : [{ type, id, date (AAAA-MM-JJ), amount (cents), party, url }] — paiements (dépenses, chèques, factures fournisseurs)

// Doublons : même bénéficiaire, même montant, à 3 jours ou moins d'écart (opérations des 120 derniers jours).
function findDuplicates(txns, today) {
  const recent = txns.filter((t) => t.party && t.amount > 0 && t.date && daysBetween(t.date, today) <= 120);
  const groups = new Map();
  for (const t of recent) {
    const k = `${normParty(t.party)}|${t.amount}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  const out = [];
  for (const list of groups.values()) {
    list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.id).localeCompare(String(b.id))));
    for (let i = 1; i < list.length; i++) {
      const [a, b] = [list[i - 1], list[i]];
      if (daysBetween(a.date, b.date) > 3) continue;
      const ref = `dup:${[`${a.type}:${a.id}`, `${b.type}:${b.id}`].sort().join('+')}`;
      out.push({
        type: 'duplicate', severity: 'standard', ref, amount_cents: a.amount, txn_date: b.date, counterparty: a.party, qbo_url: b.url,
        title: `Deux paiements de ${money(a.amount)} à ${a.party}`,
        explanation: `Le ${isoDay(a.date)} et le ${isoDay(b.date)}, même montant, même bénéficiaire. C’est souvent une opération saisie deux fois (par exemple une facture fournisseur et le paiement bancaire importé).`,
        action: 'Vérifiez les deux opérations dans QuickBooks ; supprimez ou rapprochez le doublon. En cas de doute, demandez au client.',
        data: { pair: [a, b] },
      });
    }
  }
  return out;
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

// Inhabituel : ≥ 3 × le montant habituel (médiane d'au moins 3 paiements antérieurs) et ≥ 500 $,
// ou premier paiement de 5 000 $ ou plus à un nouveau bénéficiaire. Seulement les 60 derniers jours.
function findUnusual(txns, today) {
  const out = [];
  const byParty = new Map();
  for (const t of txns.filter((x) => x.party && x.amount > 0 && x.date)) {
    const k = normParty(t.party);
    if (!byParty.has(k)) byParty.set(k, []);
    byParty.get(k).push(t);
  }
  for (const list of byParty.values()) {
    for (const t of list) {
      if (daysBetween(t.date, today) > 60 || t.date > today) continue;
      const prior = list.filter((p) => p.date < t.date);
      let why = null;
      if (prior.length >= 3) {
        const usual = median(prior.map((p) => p.amount));
        if (t.amount >= 50_000 && t.amount >= usual * 3) why = `Habituellement environ ${money(usual)} (${prior.length} paiements depuis ${isoDay(prior.map((p) => p.date).sort()[0])}) : celui-ci est ${Math.round(t.amount / usual)} fois plus élevé.`;
      } else if (!prior.length && t.amount >= 500_000) {
        why = 'Premier paiement à ce bénéficiaire dans QuickBooks, pour un montant important.';
      }
      if (!why) continue;
      out.push({
        type: 'unusual', severity: 'standard', ref: `unusual:${t.type}:${t.id}`, amount_cents: t.amount, txn_date: t.date, counterparty: t.party, qbo_url: t.url,
        title: `Paiement inhabituel de ${money(t.amount)} à ${t.party}`, explanation: why,
        action: 'Vérifiez la catégorie (équipement à amortir ? dépense personnelle ?). Demandez au client si la pièce justificative n’explique pas l’achat.',
        data: { txn: t },
      });
    }
  }
  return out;
}

/* --------------------------------------------------------------- service */
function createAnomalies(db, { audit, now = () => Date.now(), portal, deadlinesFor, qbo = () => null, gov = null }) {
  const iso = () => new Date(now()).toISOString();
  const today = () => isoDay(now());
  const isStaff = (u) => Boolean(u && STAFF_ROLES.includes(u.role));
  function requireStaff(actor, clientId) {
    if (!isStaff(actor)) throw new PortalError('Réservé à l’équipe BVY.');
    if (!canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    return Number(clientId);
  }
  const event = (id, from, to, userId, note) => db.prepare('INSERT INTO anomaly_events (anomaly_id, from_status, to_status, user_id, note, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, from, to, userId || null, note || null, iso());

  function upsert(clientId, a, source) {
    const cur = db.prepare('SELECT * FROM anomalies WHERE client_id = ? AND ref = ?').get(clientId, a.ref);
    const vals = [a.type, a.severity, a.title, a.explanation, a.action, a.amount_cents ?? null, a.txn_date || null, a.counterparty || null, a.qbo_url || null, a.data ? JSON.stringify(a.data) : null];
    if (!cur) {
      const id = Number(db.prepare(`INSERT INTO anomalies (client_id, type, severity, title, explanation, action, amount_cents, txn_date, counterparty, qbo_url, data, source, ref, task_id, status, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(clientId, ...vals, source, a.ref, a.task_id || null, a.status || 'open', iso(), iso()).lastInsertRowid);
      event(id, null, a.status || 'open', null, 'Détectée');
      audit({ userId: null, action: 'anomaly.detect', target: `anomaly:${id}`, clientId, details: { type: a.type, severity: a.severity } });
      return id;
    }
    db.prepare(`UPDATE anomalies SET type = ?, severity = ?, title = ?, explanation = ?, action = ?, amount_cents = ?, txn_date = ?, counterparty = ?, qbo_url = ?, data = ?, last_seen = ?
      ${a.task_id && !cur.task_id ? ', task_id = ' + Number(a.task_id) : ''} WHERE id = ?`).run(...vals, iso(), cur.id);
    // Revient après une fermeture automatique : rouverte. Une fermeture par une personne (résolue, ignorée) est respectée.
    if (cur.status === 'resolved' && !cur.resolved_by) {
      db.prepare("UPDATE anomalies SET status = 'open', resolution = NULL, resolved_at = NULL WHERE id = ?").run(cur.id);
      event(cur.id, 'resolved', 'open', null, 'Détectée de nouveau');
    }
    return cur.id;
  }

  // Ferme ce qui n'est plus détecté (et la tâche du client qui y était liée).
  function autoclose(clientId, source, seen) {
    for (const a of db.prepare(`SELECT * FROM anomalies WHERE client_id = ? AND source = ? AND status IN (${ACTIVE.map(() => '?').join(',')})`).all(clientId, source, ...ACTIVE)) {
      if (seen.has(a.ref)) continue;
      db.prepare("UPDATE anomalies SET status = 'resolved', resolution = 'Plus détecté', resolved_at = ?, resolved_by = NULL WHERE id = ?").run(iso(), a.id);
      event(a.id, a.status, 'resolved', null, 'Plus détecté : fermée automatiquement');
      if (a.task_id && a.type !== 'missing_document') {
        db.prepare("UPDATE tasks SET status = 'done', answer = COALESCE(answer, 'Corrigé par BVY') WHERE id = ? AND status IN ('open','answered')").run(a.task_id);
      }
    }
  }

  // Une anomalie liée à une question suit la tâche : ouverte → en attente du client, répondue → réponse reçue.
  function followTasks(clientId) {
    for (const a of db.prepare(`SELECT a.id, a.status, t.status AS task_status FROM anomalies a JOIN tasks t ON t.id = a.task_id
      WHERE a.client_id = ? AND a.status IN ('open','in_progress','waiting_client')`).all(clientId)) {
      const to = a.task_status === 'open' ? 'waiting_client' : a.task_status === 'answered' ? 'answered' : null;
      if (to && to !== a.status) {
        db.prepare('UPDATE anomalies SET status = ? WHERE id = ?').run(to, a.id);
        event(a.id, a.status, to, null, to === 'answered' ? 'Le client a répondu' : 'Question envoyée au client');
      }
    }
  }

  /* ---------------------------------------------- règles sur le dossier */
  function rulesFor(c) {
    const out = [];
    const day = today();
    const ts = now();
    // Catégorie incertaine et facture très en retard : éléments trouvés par la synchronisation QuickBooks (workflow 04)
    for (const it of db.prepare("SELECT * FROM qbo_items WHERE client_id = ? AND status IN ('new','sent')").all(c.id)) {
      if (it.kind === 'uncategorized') {
        out.push({ type: 'uncategorized', severity: 'standard', ref: `qbo_item:${it.id}`, amount_cents: it.amount_cents, txn_date: it.txn_date, counterparty: it.counterparty, qbo_url: it.qbo_url, task_id: it.task_id,
          title: `${it.qbo_type === 'Deposit' ? 'Dépôt' : 'Paiement'} non catégorisé de ${money(it.amount_cents)}${it.counterparty ? ` — ${it.counterparty}` : ''}`,
          explanation: `Inscrit le ${isoDay(it.txn_date)} dans un compte « non catégorisé » de QuickBooks${it.detail ? ` (${it.detail})` : ''} : les états financiers et les taxes ne seront pas justes tant qu’il n’est pas classé.`,
          action: 'Demandez au client de quoi il s’agit, puis catégorisez l’opération dans QuickBooks.', data: { qboItemId: it.id } });
      } else if (it.kind === 'overdue_invoice') {
        const late = Math.floor((ts - Date.parse(`${it.txn_date}T00:00:00Z`)) / DAY);
        if (late >= 90 || (it.amount_cents || 0) >= 500_000) {
          out.push({ type: 'overdue_major', severity: 'urgent', ref: `qbo_item:${it.id}`, amount_cents: it.amount_cents, txn_date: it.txn_date, counterparty: it.counterparty, qbo_url: it.qbo_url,
            title: `Facture de ${money(it.amount_cents)} impayée depuis ${late} jours${it.counterparty ? ` — ${it.counterparty}` : ''}`,
            explanation: `${it.detail || 'Une facture'} échue le ${isoDay(it.txn_date)}. ${late >= 90 ? 'Au-delà de 90 jours, le risque de ne jamais être payé augmente beaucoup.' : 'Montant important pour la trésorerie du client.'}`,
            action: 'Prévenez le client ; proposez un rappel ou une mise en demeure. Envisagez une provision pour créance douteuse à la fin de l’exercice.', data: { qboItemId: it.id } });
        }
      }
    }
    // Document demandé, toujours manquant après 14 jours
    for (const t of db.prepare("SELECT * FROM tasks WHERE client_id = ? AND kind = 'document' AND status = 'open' AND created_at <= ?").all(c.id, new Date(ts - 14 * DAY).toISOString())) {
      out.push({ type: 'missing_document', severity: 'standard', ref: `task:${t.id}`, task_id: t.id, status: 'waiting_client', title: `Document manquant : ${t.title}`,
        explanation: `Demandé le ${isoDay(t.created_at)}, toujours pas reçu (${t.reminders_sent || 0} rappel${t.reminders_sent > 1 ? 's' : ''} envoyé${t.reminders_sent > 1 ? 's' : ''}).`,
        action: t.reminders_sent >= 3 ? 'Les 3 rappels automatiques sont partis : appelez le client.' : 'Les rappels automatiques continuent ; appelez le client si c’est urgent.' });
    }
    // Système : QuickBooks
    const q = db.prepare('SELECT * FROM qbo_connections WHERE client_id = ?').get(c.id);
    if (q && q.status !== 'connected') {
      out.push({ type: 'qbo_disconnected', severity: 'system', ref: 'qbo:disconnected', title: 'QuickBooks déconnecté',
        explanation: 'L’autorisation d’accès à QuickBooks n’est plus valide : le tableau de bord du client et les suggestions ne se mettent plus à jour.',
        action: 'Reconnectez QuickBooks depuis l’onglet QuickBooks du dossier (accès administrateur à l’entreprise requis).' });
    } else if (q && q.last_sync_status === 'failed') {
      out.push({ type: 'sync_failed', severity: 'system', ref: 'qbo:failed', title: 'Synchronisation QuickBooks en échec',
        explanation: `Dernière erreur : ${q.last_error || 'inconnue'}`, action: 'Relancez la synchronisation ; si l’erreur revient, reconnectez QuickBooks.' });
    } else if (q && q.last_sync_at && ts - Date.parse(q.last_sync_at) > 48 * 3600_000) {
      out.push({ type: 'sync_stale', severity: 'system', ref: 'qbo:stale', title: 'Données QuickBooks pas à jour',
        explanation: `Dernière synchronisation réussie le ${isoDay(q.last_sync_at)} : le client voit des chiffres anciens.`, action: 'Lancez « Synchroniser maintenant » dans l’onglet QuickBooks.' });
    }
    // Système : profil fiscal absent
    if (!c.kind) {
      out.push({ type: 'missing_data', severity: 'system', ref: 'profile:kind', title: 'Profil fiscal à compléter',
        explanation: 'Le type de client (entreprise, travailleur autonome, particulier) n’est pas indiqué : aucune échéance n’est calculée pour ce client.',
        action: 'Remplissez le profil fiscal dans l’onglet « Échéances » du dossier.' });
    }
    // Urgent : trésorerie
    const snap = db.prepare('SELECT data FROM client_snapshots WHERE client_id = ?').get(c.id);
    if (snap) {
      const d = JSON.parse(snap.data);
      const cash = d.cash && d.cash.amount; const pay = d.payable && d.payable.amount;
      if (typeof cash === 'number' && cash < 0) {
        out.push({ type: 'cash', severity: 'urgent', ref: 'cash:negative', amount_cents: cash, title: `Solde bancaire négatif : ${money(cash)}`,
          explanation: `Au ${isoDay(d.asOf)}, les comptes bancaires sont à découvert : frais, chèques refusés et paiements bloqués sont possibles.`,
          action: 'Appelez le client aujourd’hui : encaissements attendus, paiements à reporter, marge de crédit.' });
      } else if (typeof cash === 'number' && typeof pay === 'number' && pay > 0 && cash < pay) {
        out.push({ type: 'cash', severity: 'urgent', ref: 'cash:low', amount_cents: cash, title: `Argent disponible (${money(cash)}) inférieur aux factures à payer (${money(pay)})`,
          explanation: `Au ${isoDay(d.asOf)}, il manque ${money(pay - cash)} pour payer toutes les factures des fournisseurs.`,
          action: 'Revoyez avec le client l’ordre des paiements et les factures clients à encaisser en priorité.' });
      }
    }
    // Urgent : échéances fiscales et administratives (workflow 05)
    if (c.kind && deadlinesFor) {
      for (const dl of deadlinesFor(c, day).filter((x) => !x.mark && x.urgency && x.urgency.days <= 7)) {
        const late = dl.urgency.days < 0;
        out.push({ type: 'deadline', severity: 'urgent', ref: `deadline:${dl.key}:${late ? 'late' : 'soon'}`, txn_date: dl.date,
          title: `${dl.title} — ${late ? `en retard de ${-dl.urgency.days} jour${dl.urgency.days < -1 ? 's' : ''}` : dl.urgency.days === 0 ? 'aujourd’hui' : `dans ${dl.urgency.days} jour${dl.urgency.days > 1 ? 's' : ''}`}`,
          explanation: `Échéance du ${dl.date}${late ? ', dépassée : pénalités et intérêts possibles' : ''}.`,
          action: late ? 'Produisez ou payez au plus vite, puis marquez l’échéance comme faite ; informez le client des pénalités possibles.' : 'Vérifiez que la production ou le paiement est prêt, puis marquez l’échéance comme faite.' });
      }
    }
    // Urgent : réponse à une demande du gouvernement due dans 7 jours ou moins (workflow 17)
    if (gov) {
      for (const g of gov.dueSoon(c.id, day)) {
        out.push({ type: 'gov_request', severity: 'urgent', ref: `gov_request:${g.id}:${g.days < 0 ? 'late' : 'soon'}`, txn_date: g.due_date, amount_cents: g.amount_cents,
          title: `${g.title} — ${g.days < 0 ? `réponse en retard de ${-g.days} jour${g.days < -1 ? 's' : ''}` : g.days === 0 ? 'réponse due aujourd’hui' : `réponse due dans ${g.days} jour${g.days > 1 ? 's' : ''}`}`,
          explanation: `Date limite du ${g.due_date}${g.missing ? ` ; ${g.missing} document${g.missing > 1 ? 's' : ''} encore à obtenir` : ''}. Sans réponse, l’organisme peut établir une cotisation ou refuser des montants.`,
          action: g.days < 0 ? 'Appelez l’agent de l’organisme pour demander un délai, puis envoyez la réponse au plus vite.' : 'Terminez la réponse ; si elle ne peut pas être prête, demandez un délai à l’agent avant la date limite.',
          data: { govRequestId: g.id } });
      }
    }
    // Urgent : paie dans 2 jours ou moins, pas prête
    const soon = isoDay(ts + 2 * DAY);
    for (const r of db.prepare("SELECT * FROM pay_runs WHERE client_id = ? AND status IN ('waiting','hours_received','validation','preparing') AND pay_date <= ? AND pay_date >= ?")
      .all(c.id, soon, isoDay(ts - 7 * DAY))) {
      const step = { waiting: 'les heures ne sont pas reçues', hours_received: 'les heures ne sont pas validées', validation: 'le client n’a pas approuvé', preparing: 'la paie n’est pas prête dans QuickBooks' }[r.status];
      out.push({ type: 'payroll_risk', severity: 'urgent', ref: `pay_run:${r.id}`, txn_date: r.pay_date, title: `Paie du ${r.pay_date} : ${step}`,
        explanation: 'Les employés risquent d’être payés en retard.', action: 'Ouvrez la paie et débloquez l’étape en cours aujourd’hui ; appelez le client si on attend après lui.', data: { payRunId: r.id } });
    }
    return out;
  }

  function scanClient(clientId) {
    const c = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(clientId));
    if (!c || c.is_firm || c.status !== 'active') return;
    const seen = new Set();
    for (const a of rulesFor(c)) { seen.add(a.ref); upsert(c.id, a, 'rule'); }
    autoclose(c.id, 'rule', seen);
    followTasks(c.id);
  }

  function scanAll() {
    for (const c of db.prepare("SELECT id FROM clients WHERE status = 'active' AND is_firm = 0").all()) scanClient(c.id);
  }

  // Résultats de la synchronisation QuickBooks (doublons, inhabituels) : remplacent les précédents du même client.
  function setQboFindings(clientId, findings) {
    const seen = new Set();
    for (const a of findings) { seen.add(a.ref); upsert(Number(clientId), a, 'qbo'); }
    autoclose(Number(clientId), 'qbo', seen);
    scanClient(clientId);
  }

  /* ------------------------------------------------------- consultation */
  function lastDecision(clientId, party) {
    if (!party) return null;
    return db.prepare('SELECT * FROM client_decisions WHERE client_id = ? AND counterparty = ? ORDER BY id DESC LIMIT 1').get(Number(clientId), normParty(party)) || null;
  }
  const decorate = (a, names) => ({
    ...a, client: names ? names[a.client_id] : undefined, data: a.data ? JSON.parse(a.data) : null,
    decision: lastDecision(a.client_id, a.counterparty), askable: ASKABLE.includes(a.type),
  });

  function list(actor, { clientId = null, status = 'active', severity = '' } = {}) {
    if (!isStaff(actor)) throw new PortalError('Réservé à l’équipe BVY.');
    const clients = clientId ? [{ id: requireStaff(actor, clientId) }] : visibleClients(db, actor);
    const names = Object.fromEntries((clientId ? db.prepare('SELECT id, name FROM clients WHERE id = ?').all(Number(clientId)) : clients).map((c) => [c.id, c.name]));
    const ids = clients.map((c) => Number(c.id)).join(',') || '0';
    const st = status === 'closed' ? ['resolved', 'dismissed'] : ACTIVE;
    const where = [`a.client_id IN (${ids})`, `a.status IN (${st.map((x) => `'${x}'`).join(',')})`];
    if (SEVERITY[severity]) where.push(`a.severity = '${severity}'`);
    return db.prepare(`SELECT a.*, u.name AS owner_name, t.answer AS task_answer, t.status AS task_status FROM anomalies a
      LEFT JOIN users u ON u.id = a.owner_id LEFT JOIN tasks t ON t.id = a.task_id
      WHERE ${where.join(' AND ')} ORDER BY CASE a.severity WHEN 'urgent' THEN 0 WHEN 'system' THEN 1 ELSE 2 END, a.first_seen DESC LIMIT 300`).all()
      .map((a) => ({ ...decorate(a, names), events: evStmt.all(a.id) }));
  }
  const evStmt = db.prepare('SELECT e.*, u.name FROM anomaly_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.anomaly_id = ? ORDER BY e.id');

  function get(actor, id) {
    const a = db.prepare('SELECT a.*, u.name AS owner_name, t.answer AS task_answer, t.status AS task_status FROM anomalies a LEFT JOIN users u ON u.id = a.owner_id LEFT JOIN tasks t ON t.id = a.task_id WHERE a.id = ?').get(Number(id));
    if (!a) throw new PortalError('Anomalie introuvable.');
    requireStaff(actor, a.client_id);
    const events = db.prepare('SELECT e.*, u.name FROM anomaly_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.anomaly_id = ? ORDER BY e.id').all(a.id);
    return { ...decorate(a, { [a.client_id]: db.prepare('SELECT name FROM clients WHERE id = ?').get(a.client_id).name }), events };
  }

  const urgentCount = (actor) => {
    if (!isStaff(actor)) return 0;
    const ids = visibleClients(db, actor).map((c) => Number(c.id)).join(',') || '0';
    return db.prepare(`SELECT COUNT(*) AS n FROM anomalies WHERE severity = 'urgent' AND status IN ('open','in_progress','answered') AND client_id IN (${ids})`).get().n;
  };
  const openCount = (clientId) => db.prepare(`SELECT COUNT(*) AS n FROM anomalies WHERE client_id = ? AND status IN (${ACTIVE.map((x) => `'${x}'`).join(',')})`).get(Number(clientId)).n;

  /* ------------------------------------------------------------ actions */
  function setStatus(a, to, actor, note, extra = {}) {
    const sets = ['status = ?']; const args = [to];
    for (const [k, v] of Object.entries(extra)) { sets.push(`${k} = ?`); args.push(v); }
    db.prepare(`UPDATE anomalies SET ${sets.join(', ')} WHERE id = ?`).run(...args, a.id);
    event(a.id, a.status, to, actor.id, note);
  }

  function act(actor, id, action, input = {}, ip) {
    const a = get(actor, id);
    const note = String(input.note || '').trim().slice(0, 600);
    const open = ACTIVE.includes(a.status);
    if (action === 'take') {
      if (!open) throw new PortalError('Cette anomalie est fermée : rouvrez-la d’abord.');
      setStatus(a, a.status === 'open' ? 'in_progress' : a.status, actor, 'Prise en charge', { owner_id: actor.id });
    } else if (action === 'resolve' || action === 'dismiss') {
      if (!open) throw new PortalError('Cette anomalie est déjà fermée.');
      if (!note) throw new PortalError(action === 'resolve' ? 'Écrivez en une phrase comment l’anomalie a été réglée.' : 'Écrivez pourquoi cette anomalie peut être ignorée.');
      setStatus(a, action === 'resolve' ? 'resolved' : 'dismissed', actor, note, { resolution: note, resolved_by: actor.id, resolved_at: iso(), owner_id: a.owner_id || actor.id });
    } else if (action === 'previous') {
      if (!open || !a.decision) throw new PortalError('Aucune réponse précédente du client pour ce bénéficiaire.');
      const r = `Réponse précédente du client (${isoDay(a.decision.answered_at)}) : ${a.decision.answer}`;
      setStatus(a, 'resolved', actor, r, { resolution: r, resolved_by: actor.id, resolved_at: iso(), owner_id: a.owner_id || actor.id });
    } else if (action === 'reopen') {
      if (open) throw new PortalError('Cette anomalie est déjà ouverte.');
      setStatus(a, 'open', actor, note || 'Rouverte', { resolution: null, resolved_by: null, resolved_at: null });
    } else {
      throw new PortalError('Action inconnue.');
    }
    audit({ userId: actor.id, action: `anomaly.${action}`, target: `anomaly:${a.id}`, clientId: a.client_id, ip });
    return a.client_id;
  }

  // Question simple pour le client (workflow 08) : jamais de numéro de compte.
  function questionFor(a) {
    const d = a.data || {};
    if (a.type === 'duplicate') {
      const [x, y] = d.pair || [];
      return { title: `Nous voyons deux paiements de ${money(a.amount_cents)} à ${a.counterparty}, le ${isoDay(x && x.date)} et le ${isoDay(y && y.date)}. S’agit-il de deux achats différents ?`,
        choices: ['Oui, deux achats différents', 'Non, le même achat payé ou saisi deux fois', 'Je ne sais pas'] };
    }
    if (a.type === 'unusual') {
      return { title: `Un paiement de ${money(a.amount_cents)} à ${a.counterparty} le ${isoDay(a.txn_date)} est plus élevé que d’habitude. De quoi s’agit-il ?`,
        choices: ['Achat d’équipement', 'Dépense exceptionnelle de l’entreprise', 'Dépense personnelle', 'Autre'] };
    }
    return null;
  }

  function ask(actor, id, input = {}, ip) {
    const a = get(actor, id);
    if (!ACTIVE.includes(a.status)) throw new PortalError('Cette anomalie est fermée.');
    if (!a.askable) throw new PortalError('Cette anomalie ne se règle pas par une question au client.');
    if (a.task_id && a.task_status === 'open') throw new PortalError('Une question est déjà en attente chez le client.');
    let taskId;
    if (a.type === 'uncategorized' && a.data && a.data.qboItemId && qbo()) {
      taskId = qbo().sendSuggestion(actor, a.data.qboItemId, ip).taskId;
    } else {
      const q = questionFor(a);
      if (!q) throw new PortalError('Cette anomalie ne se règle pas par une question au client.');
      const title = String(input.title || '').trim() || q.title;
      taskId = portal.createTask(actor, a.client_id, { kind: 'question', title, detail: 'Répondez en un clic : BVY s’occupe de corriger la comptabilité.', choices: q.choices.join('\n'), qboUrl: a.qbo_url }, ip);
    }
    db.prepare('UPDATE tasks SET anomaly_id = ?, counterparty = ?, question_type = ? WHERE id = ?').run(a.id, a.counterparty ? normParty(a.counterparty) : null, a.type, taskId);
    setStatus(a, 'waiting_client', actor, 'Question envoyée au client', { task_id: taskId, owner_id: a.owner_id || actor.id });
    audit({ userId: actor.id, action: 'anomaly.ask', target: `anomaly:${a.id}`, clientId: a.client_id, ip });
    return { clientId: a.client_id, taskId };
  }

  // Après la réponse du client : mémoire par bénéficiaire, et l'anomalie passe à « Réponse reçue ».
  function onAnswer(task) {
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
    if (!t || !t.answer) return;
    let party = t.counterparty;
    let type = t.question_type;
    if (!party && t.qbo_item_id) {
      const it = db.prepare('SELECT counterparty, qbo_type FROM qbo_items WHERE id = ?').get(t.qbo_item_id);
      party = it && it.counterparty ? normParty(it.counterparty) : null;
      type = 'uncategorized';
    }
    if (party) {
      db.prepare('INSERT INTO client_decisions (client_id, counterparty, question, answer, task_id, answered_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(t.client_id, party, type || 'question', t.answer, t.id, t.answered_at || iso());
    }
    followTasks(t.client_id);
  }

  return { scanClient, scanAll, setQboFindings, list, get, act, ask, onAnswer, questionFor, lastDecision, urgentCount, openCount };
}

module.exports = { createAnomalies, findDuplicates, findUnusual, SEVERITY, STATUS, TYPES, ACTIVE, normParty };
