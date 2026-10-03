'use strict';

/**
 * Réception (workflows 09 et 10) : classement des documents, réponses des clients, messages non lus,
 * relances automatiques des tâches ouvertes et historique d'un dossier.
 * Les courriels sont envoyés par le serveur ; ce module décide qui relancer et l'enregistre.
 */

const { visibleClients, canAccessClient, STAFF_ROLES } = require('./rbac.js');
const { PortalError } = require('./portal.js');
const { DOC_TYPES, validPeriod } = require('./doctypes.js');
const { TZ } = require('./dates.js');

const DAY = 86_400_000;
const GAPS = [3, 4, 7]; // jours avant le 1er rappel, puis entre les rappels : 3, 7 et 14 jours après la demande
const MAX_REMINDERS = GAPS.length;
const ESCALATE_DAYS = 7;
const REMIND_KINDS = ['question', 'document', 'approval'];

// Lundi à vendredi, de 9 h à 17 h, heure de Montréal.
function inSendWindow(ts) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return !['Sat', 'Sun'].includes(p.weekday) && Number(p.hour) >= 9 && Number(p.hour) < 17;
}

// Le rappel n° n (0, 1, 2) est dû quand l'écart depuis la demande ou le dernier rappel est atteint.
function reminderDue(task, ts) {
  if (task.reminders_sent >= MAX_REMINDERS) return false;
  const base = Date.parse(task.last_reminder_at || task.created_at);
  return ts - base >= GAPS[task.reminders_sent] * DAY;
}

function createInbox(db, { audit, now = () => Date.now(), portal }) {
  const iso = () => new Date(now()).toISOString();
  const isStaff = (u) => Boolean(u && STAFF_ROLES.includes(u.role));
  function requireStaff(actor, clientId) {
    if (!isStaff(actor)) throw new PortalError('Réservé à l’équipe BVY.');
    if (!canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    return Number(clientId);
  }
  const clientIds = (actor) => visibleClients(db, actor).map((c) => c.id);
  const inList = (ids) => (ids.length ? ids.map(Number).join(',') : '0');

  /* ------------------------------------------------------------- liens */
  const LINKS = {
    tax_file: { table: 'tax_files', label: (r) => `Impôts — ${r.form === 't2' ? 'T2 et CO-17' : 'T1 et TP-1'} ${r.year_label}` },
    pay_run: { table: 'pay_runs', label: (r) => `Paie du ${r.pay_date}` },
    tax_return: { table: 'tax_returns', label: (r) => `TPS/TVQ — ${r.period_start} au ${r.period_end}` },
  };
  function linkOptions(clientId) {
    const id = Number(clientId);
    return [
      ...db.prepare('SELECT * FROM tax_files WHERE client_id = ? ORDER BY period_end DESC LIMIT 4').all(id).map((r) => ({ value: `tax_file:${r.id}`, label: LINKS.tax_file.label(r) })),
      ...db.prepare('SELECT * FROM pay_runs WHERE client_id = ? ORDER BY pay_date DESC LIMIT 6').all(id).map((r) => ({ value: `pay_run:${r.id}`, label: LINKS.pay_run.label(r) })),
      ...db.prepare('SELECT * FROM tax_returns WHERE client_id = ? ORDER BY period_end DESC LIMIT 4').all(id).map((r) => ({ value: `tax_return:${r.id}`, label: LINKS.tax_return.label(r) })),
    ];
  }
  function linkInfo(link) {
    const m = String(link || '').match(/^(tax_file|pay_run|tax_return):(\d+)$/);
    if (!m) return null;
    const row = db.prepare(`SELECT * FROM ${LINKS[m[1]].table} WHERE id = ?`).get(Number(m[2]));
    if (!row) return null;
    const href = { tax_file: `/impots/${row.id}`, pay_run: `/paie/${row.id}`, tax_return: `/tps-tvq/${row.id}` }[m[1]];
    return { kind: m[1], id: row.id, clientId: row.client_id, label: LINKS[m[1]].label(row), href };
  }

  /* -------------------------------------------------------- classement */
  function fileDocument(actor, docId, input, ip) {
    const d = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(docId));
    if (!d) throw new PortalError('Document introuvable.');
    requireStaff(actor, d.client_id);
    let type; let period; let link;
    if (input.duplicate) {
      const orig = d.duplicate_of && db.prepare('SELECT * FROM documents WHERE id = ?').get(d.duplicate_of);
      if (!orig) throw new PortalError('Ce document n’est pas un doublon.');
      type = orig.doc_type || orig.suggested || 'autre'; period = orig.period; link = orig.link;
    } else {
      type = DOC_TYPES[input.type] ? input.type : null;
      if (!type) throw new PortalError('Choisissez le type de document.');
      period = String(input.period || '').trim() || null;
      if (period && !validPeriod(period)) throw new PortalError('Période invalide : AAAA-MM (ex. 2026-02) ou AAAA.');
      link = String(input.link || '').trim() || null;
      if (link) {
        const li = linkInfo(link);
        if (!li || li.clientId !== d.client_id) throw new PortalError('Ce lien ne correspond pas à un dossier de ce client.');
      }
    }
    db.prepare('UPDATE documents SET doc_type = ?, period = ?, link = ?, filed = 1, filed_by = ?, filed_at = ? WHERE id = ?')
      .run(type, period, link, actor.id, iso(), d.id);
    audit({ userId: actor.id, action: input.duplicate ? 'document.file_duplicate' : 'document.file', target: `document:${d.id}`, clientId: d.client_id, ip, details: { type, period, link } });
    return { clientId: d.client_id, type };
  }

  function searchDocuments(actor, clientId, { q = '', type = '', period = '' } = {}) {
    const id = requireStaff(actor, clientId);
    const where = ['d.client_id = ?']; const args = [id];
    const text = String(q || '').trim().slice(0, 80);
    if (text) { where.push('(d.name LIKE ? OR d.note LIKE ?)'); args.push(`%${text}%`, `%${text}%`); }
    if (type === 'a_classer') where.push('d.filed = 0');
    else if (DOC_TYPES[type]) { where.push('d.doc_type = ?'); args.push(type); }
    const per = String(period || '').trim();
    if (per && validPeriod(per)) { where.push('d.period LIKE ?'); args.push(`${per}%`); }
    return db.prepare(`SELECT d.*, u.name AS uploaded_by_name, o.created_at AS duplicate_at FROM documents d
      LEFT JOIN users u ON u.id = d.uploaded_by LEFT JOIN documents o ON o.id = d.duplicate_of
      WHERE ${where.join(' AND ')} ORDER BY d.filed, d.id DESC LIMIT 300`).all(...args)
      .map((d) => ({ ...d, linkInfo: linkInfo(d.link) }));
  }

  /* ---------------------------------------------------------- réception */
  function inbox(actor) {
    if (!isStaff(actor)) throw new PortalError('Réservé à l’équipe BVY.');
    const clients = visibleClients(db, actor);
    const ids = inList(clients.map((c) => c.id));
    const names = Object.fromEntries(clients.map((c) => [c.id, c.name]));
    const links = {};
    const docs = db.prepare(`SELECT d.*, o.created_at AS duplicate_at FROM documents d LEFT JOIN documents o ON o.id = d.duplicate_of
      WHERE d.filed = 0 AND d.client_id IN (${ids}) ORDER BY d.id LIMIT 200`).all()
      .map((d) => ({ ...d, client: names[d.client_id], links: links[d.client_id] || (links[d.client_id] = linkOptions(d.client_id)) }));
    const replies = db.prepare(`SELECT t.*, u.name AS answered_by_name FROM tasks t LEFT JOIN users u ON u.id = t.answered_by
      WHERE t.status = 'answered' AND t.client_id IN (${ids}) ORDER BY t.answered_at LIMIT 200`).all()
      .map((t) => ({ ...t, client: names[t.client_id] }));
    const unread = clients.map((c) => ({ clientId: c.id, client: c.name, n: portal.unreadCount(actor, c.id) })).filter((x) => x.n > 0);
    const cutoff = new Date(now() - ESCALATE_DAYS * DAY).toISOString();
    const silent = db.prepare(`SELECT t.* FROM tasks t WHERE t.status = 'open' AND t.reminders_sent >= ? AND t.last_reminder_at <= ?
      AND t.client_id IN (${ids}) ORDER BY t.created_at LIMIT 200`).all(MAX_REMINDERS, cutoff)
      .map((t) => ({ ...t, client: names[t.client_id] }));
    return { docs, replies, unread, silent, total: docs.length + replies.length + unread.length + silent.length };
  }

  // Pastille du menu : même calcul que la page, sans le détail.
  function count(actor) {
    if (!isStaff(actor)) return 0;
    const list = clientIds(actor);
    const ids = inList(list);
    const cutoff = new Date(now() - ESCALATE_DAYS * DAY).toISOString();
    return db.prepare(`SELECT COUNT(*) AS n FROM documents WHERE filed = 0 AND client_id IN (${ids})`).get().n
      + db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'answered' AND client_id IN (${ids})`).get().n
      + db.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE status = 'open' AND reminders_sent >= ? AND last_reminder_at <= ? AND client_id IN (${ids})`).get(MAX_REMINDERS, cutoff).n
      + list.filter((id) => portal.unreadCount(actor, id) > 0).length;
  }

  /* ----------------------------------------------------------- rappels */
  // Tâches à relancer maintenant (le client a au moins un utilisateur actif).
  function dueTasks(ts) {
    return db.prepare(`SELECT t.* FROM tasks t JOIN clients c ON c.id = t.client_id
      WHERE t.status = 'open' AND t.no_reminder = 0 AND t.reminders_sent < ? AND t.kind IN (${REMIND_KINDS.map(() => '?').join(',')})
        AND c.status = 'active' AND c.is_firm = 0
        AND EXISTS (SELECT 1 FROM users u WHERE u.client_id = t.client_id AND u.status = 'active')`).all(MAX_REMINDERS, ...REMIND_KINDS)
      .filter((t) => reminderDue(t, ts));
  }

  function record(task, { manual = false, by = null } = {}) {
    const at = iso();
    db.prepare('INSERT INTO task_reminders (task_id, client_id, manual, sent_by, sent_at) VALUES (?, ?, ?, ?, ?)').run(task.id, task.client_id, manual ? 1 : 0, by, at);
    db.prepare('UPDATE tasks SET reminders_sent = reminders_sent + 1, last_reminder_at = ? WHERE id = ?').run(at, task.id);
    audit({ userId: by, action: manual ? 'task.remind_manual' : 'task.remind', target: `task:${task.id}`, clientId: task.client_id });
  }

  // Tour de relance (appelé chaque heure) : un courriel par client, regroupant ses tâches dues.
  function runReminders() {
    const ts = now();
    if (!inSendWindow(ts)) return [];
    const byClient = new Map();
    for (const t of dueTasks(ts)) {
      record(t);
      byClient.set(t.client_id, (byClient.get(t.client_id) || 0) + 1);
    }
    // Le courriel annonce toutes les tâches ouvertes du client, pas seulement celles relancées ce tour-ci.
    return [...byClient.keys()].map((clientId) => ({
      clientId,
      count: db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE client_id = ? AND status = 'open'").get(clientId).n,
    }));
  }

  function remindNow(actor, taskId, ip) {
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(taskId));
    if (!t) throw new PortalError('Tâche introuvable.');
    requireStaff(actor, t.client_id);
    if (t.status !== 'open') throw new PortalError('Cette tâche est déjà traitée.');
    if (!REMIND_KINDS.includes(t.kind)) throw new PortalError('Cette tâche ne demande pas de réponse du client.');
    if (t.last_reminder_at && now() - Date.parse(t.last_reminder_at) < DAY) throw new PortalError('Le client a déjà été relancé pour cette tâche dans les dernières 24 heures.');
    record(t, { manual: true, by: actor.id });
    audit({ userId: actor.id, action: 'task.remind_now', target: `task:${t.id}`, clientId: t.client_id, ip });
    return { clientId: t.client_id, count: db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE client_id = ? AND status = 'open'").get(t.client_id).n };
  }

  function setNoReminder(actor, taskId, off, ip) {
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(taskId));
    if (!t) throw new PortalError('Tâche introuvable.');
    requireStaff(actor, t.client_id);
    db.prepare('UPDATE tasks SET no_reminder = ? WHERE id = ?').run(off ? 1 : 0, t.id);
    audit({ userId: actor.id, action: off ? 'task.reminders_off' : 'task.reminders_on', target: `task:${t.id}`, clientId: t.client_id, ip });
    return t.client_id;
  }

  // Prochain rappel automatique d'une tâche (pour l'affichage), ou null.
  function nextReminder(t) {
    if (t.status !== 'open' || t.no_reminder || !REMIND_KINDS.includes(t.kind) || t.reminders_sent >= MAX_REMINDERS) return null;
    return new Date(Date.parse(t.last_reminder_at || t.created_at) + GAPS[t.reminders_sent] * DAY).toISOString();
  }

  /* --------------------------------------------------------- historique */
  function timeline(actor, clientId) {
    const id = requireStaff(actor, clientId);
    const ev = [];
    for (const m of db.prepare(`SELECT m.id, m.body, m.created_at, u.name, u.role FROM messages m JOIN users u ON u.id = m.author_id
      WHERE m.client_id = ? ORDER BY m.id DESC LIMIT 100`).all(id)) {
      ev.push({ at: m.created_at, kind: 'message', who: m.role === 'client' ? m.name : `${m.name} · BVY`, fromClient: m.role === 'client', text: m.body.length > 160 ? `${m.body.slice(0, 160)}…` : m.body, href: `/clients/${id}/messages` });
    }
    for (const d of db.prepare(`SELECT d.id, d.name, d.origin, d.doc_type, d.created_at, u.name AS who FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
      WHERE d.client_id = ? ORDER BY d.id DESC LIMIT 100`).all(id)) {
      ev.push({ at: d.created_at, kind: 'document', who: d.origin === 'bvy' ? `${d.who || ''} · BVY` : d.who, fromClient: d.origin === 'client', text: `${d.origin === 'client' ? 'Document reçu' : 'Document partagé'} : ${d.name}${d.doc_type ? ` (${DOC_TYPES[d.doc_type]})` : ''}`, href: `/documents/${d.id}/telecharger` });
    }
    for (const t of db.prepare(`SELECT t.*, a.name AS answered_by_name, c.name AS created_by_name FROM tasks t
      LEFT JOIN users a ON a.id = t.answered_by LEFT JOIN users c ON c.id = t.created_by WHERE t.client_id = ? ORDER BY t.id DESC LIMIT 100`).all(id)) {
      ev.push({ at: t.created_at, kind: 'task', who: t.created_by_name ? `${t.created_by_name} · BVY` : 'BVY (automatique)', text: `Demande au client : ${t.title}`, href: `/clients/${id}/taches` });
      if (t.answered_at) ev.push({ at: t.answered_at, kind: 'answer', who: t.answered_by_name, fromClient: true, text: `Réponse : ${t.title} — ${t.answer || ''}`, href: `/clients/${id}/taches` });
    }
    for (const r of db.prepare(`SELECT r.*, t.title, u.name FROM task_reminders r JOIN tasks t ON t.id = r.task_id LEFT JOIN users u ON u.id = r.sent_by
      WHERE r.client_id = ? ORDER BY r.id DESC LIMIT 100`).all(id)) {
      ev.push({ at: r.sent_at, kind: 'reminder', who: r.manual ? `${r.name} · BVY` : 'BVY (automatique)', text: `Rappel envoyé : ${r.title}`, href: `/clients/${id}/taches` });
    }
    return ev.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 200);
  }

  return { inbox, count, fileDocument, searchDocuments, linkOptions, linkInfo, runReminders, remindNow, setNoReminder, nextReminder, timeline };
}

module.exports = { createInbox, inSendWindow, reminderDue, GAPS, MAX_REMINDERS };
