'use strict';

/**
 * Portail client (phase 3) : tableau de bord, tâches, documents, messages, lien QuickBooks.
 * Chaque fonction vérifie elle-même l'accès (canAccessClient) : aucune route ne peut l'oublier.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DOC_TYPES, suggestType, periodFrom } = require('./doctypes.js');
const { canAccessClient, STAFF_ROLES } = require('./rbac.js');
const { AccountError } = require('./accounts.js');

const MAX_UPLOAD = 20 * 1024 * 1024;
const HEALTH = Object.freeze({ good: 'Bonne', watch: 'À surveiller', action: 'Action requise' });
const KINDS = Object.freeze({
  question: 'Question',
  document: 'Document à envoyer',
  approval: 'Approbation',
  info: 'Information',
});
const DEFAULT_CHOICES = ['Oui, dépense d’entreprise', 'Non, personnel', 'Autre'];

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]+/g, ' ').trim().slice(0, max);
const oneLine = (v, max) => clean(v, max).replace(/\s+/g, ' ');
const isStaff = (u) => Boolean(u && STAFF_ROLES.includes(u.role));

class PortalError extends AccountError {}

// « 48 215,60 $ », « 48215.60 », « -1 200 » → cents (entier) ; vide → null.
function parseAmount(v) {
  const s = String(v == null ? '' : v).replace(/[\s  $]/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '');
  if (s === '') return null;
  if (!/^-?\d{1,12}(\.\d{1,2})?$/.test(s)) throw new PortalError(`Montant invalide : « ${oneLine(v, 30)} ».`);
  return Math.round(Number(s) * 100);
}

function formatAmount(cents) {
  if (cents === null || cents === undefined) return '—';
  return new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100);
}

// Lien QuickBooks Online : https seulement, domaine intuit.com.
function cleanQboUrl(v) {
  const s = oneLine(v, 500);
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { throw new PortalError('Lien QuickBooks invalide.'); }
  if (u.protocol !== 'https:' || !/(^|\.)intuit\.com$/.test(u.hostname)) {
    throw new PortalError('Le lien QuickBooks doit commencer par https:// et pointer vers intuit.com.');
  }
  return u.toString();
}

// Type réel du fichier, d'après son contenu (et non son nom).
function sniff(buf) {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', ext: 'png' };
  // Classeur Excel (.xlsx) : archive ZIP contenant [Content_Types].xml et le dossier xl/ (feuilles de temps)
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const head = buf.subarray(0, Math.min(buf.length, 65536)).toString('latin1');
    if (head.includes('[Content_Types].xml') && head.includes('xl/')) return { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' };
  }
  return null;
}

function safeName(name, ext) {
  const base = oneLine(path.basename(String(name || '')), 120).replace(/[\\/:*?"<>|]+/g, '_').replace(/^\.+/, '') || 'document';
  return /\.[a-z0-9]{2,4}$/i.test(base) ? base : `${base}.${ext}`;
}

function createPortal(db, { dataDir, audit, now = () => Date.now() }) {
  const iso = () => new Date(now()).toISOString();
  const docDir = path.join(dataDir, 'documents');

  function requireAccess(actor, clientId) {
    const id = Number(clientId);
    if (!canAccessClient(db, actor, id)) throw new PortalError('Accès refusé.');
    return id;
  }
  function requireStaff(actor, clientId) {
    if (!isStaff(actor)) throw new PortalError('Réservé à l’équipe BVY.');
    return requireAccess(actor, clientId);
  }

  const client = (id) => db.prepare('SELECT * FROM clients WHERE id = ?').get(id);

  /* ------------------------------------------------------ tableau de bord */
  function getSnapshot(actor, clientId) {
    const id = requireAccess(actor, clientId);
    const row = db.prepare(`SELECT s.*, u.name AS updated_by_name FROM client_snapshots s
      LEFT JOIN users u ON u.id = s.updated_by WHERE s.client_id = ?`).get(id);
    return row ? { ...JSON.parse(row.data), updatedAt: row.updated_at, updatedBy: row.updated_by_name, source: row.source || 'manual' } : null;
  }

  // Lignes « Libellé | explication » → [{ what, why }]
  const pairs = (text, max) => String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, max)
    .map((l) => { const [a, ...b] = l.split('|'); return { what: oneLine(a, 120), why: oneLine(b.join('|'), 300) }; })
    .filter((x) => x.what);

  function saveSnapshot(actor, clientId, input, ip) {
    const id = requireStaff(actor, clientId);
    const asOf = oneLine(input.asOf, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) throw new PortalError('Indiquez la date des chiffres (AAAA-MM-JJ).');
    const health = HEALTH[input.health] ? input.health : null;
    const why = clean(input.healthWhy, 600);
    if (health && !why) throw new PortalError('Expliquez toujours l’état de santé financière, en une ou deux phrases.');
    const work = pairs(input.work, 8).map(({ what, why: w }) => {
      const pct = /^\d{1,3}\s*%?$/.test(w) ? Math.min(100, Number(w.replace(/\D/g, ''))) : null;
      return { name: what, progress: pct, status: pct === null ? w : '' };
    });
    const data = {
      asOf,
      cash: { amount: parseAmount(input.cash), note: oneLine(input.cashNote, 200) },
      receivable: { amount: parseAmount(input.receivable), note: oneLine(input.receivableNote, 200) },
      payable: { amount: parseAmount(input.payable), note: oneLine(input.payableNote, 200) },
      health: health ? { state: health, why } : null,
      changes: pairs(input.changes, 6),
      work,
    };
    db.prepare(`INSERT INTO client_snapshots (client_id, data, updated_at, updated_by) VALUES (?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
      .run(id, JSON.stringify(data), iso(), actor.id);
    audit({ userId: actor.id, action: 'snapshot.update', target: `client:${id}`, clientId: id, ip });
    return data;
  }

  function setQboUrl(actor, clientId, url, ip) {
    const id = requireStaff(actor, clientId);
    const u = cleanQboUrl(url);
    db.prepare('UPDATE clients SET qbo_url = ? WHERE id = ?').run(u, id);
    audit({ userId: actor.id, action: 'client.qbo_url', target: `client:${id}`, clientId: id, ip });
    return u;
  }

  /* -------------------------------------------------------------- tâches */
  function listTasks(actor, clientId, { open = null } = {}) {
    const id = requireAccess(actor, clientId);
    const where = open === true ? "AND t.status = 'open'" : open === false ? "AND t.status != 'open'" : '';
    return db.prepare(`SELECT t.*, a.name AS answered_by_name FROM tasks t LEFT JOIN users a ON a.id = t.answered_by
      WHERE t.client_id = ? AND t.status != 'cancelled' ${where}
      ORDER BY CASE t.status WHEN 'open' THEN 0 ELSE 1 END, COALESCE(t.due_date, '9999') , t.id DESC LIMIT 200`).all(id)
      .map((t) => ({ ...t, choices: t.choices ? JSON.parse(t.choices) : null }));
  }

  function createTask(actor, clientId, input, ip) {
    const id = requireStaff(actor, clientId);
    const kind = KINDS[input.kind] ? input.kind : null;
    if (!kind) throw new PortalError('Choisissez le type de tâche.');
    const title = oneLine(input.title, 200);
    if (title.length < 3) throw new PortalError('Écrivez la tâche en une phrase simple.');
    const due = oneLine(input.dueDate, 10);
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new PortalError('Date d’échéance invalide (AAAA-MM-JJ).');
    let choices = null;
    if (kind === 'question') {
      const list = String(input.choices || '').split(/\r?\n/).map((c) => oneLine(c, 80)).filter(Boolean).slice(0, 5);
      choices = list.length >= 2 ? list : DEFAULT_CHOICES;
    }
    const r = db.prepare(`INSERT INTO tasks (client_id, kind, title, detail, choices, due_date, qbo_url, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, kind, title, clean(input.detail, 1500) || null,
      choices ? JSON.stringify(choices) : null, due || null, cleanQboUrl(input.qboUrl), actor.id, iso());
    const taskId = Number(r.lastInsertRowid);
    audit({ userId: actor.id, action: 'task.create', target: `task:${taskId}`, clientId: id, ip });
    return taskId;
  }

  function taskFor(actor, taskId) {
    const t = db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(taskId));
    if (!t) throw new PortalError('Tâche introuvable.');
    requireAccess(actor, t.client_id);
    return { ...t, choices: t.choices ? JSON.parse(t.choices) : null };
  }

  // Réponse du client (question, approbation) ; « info » : simple lecture confirmée.
  function answerTask(actor, taskId, input, ip) {
    const t = taskFor(actor, taskId);
    if (t.status !== 'open') throw new PortalError('Cette tâche est déjà traitée.');
    let answer;
    if (t.kind === 'question') {
      const choice = oneLine(input.choice, 80);
      if (!t.choices.includes(choice)) throw new PortalError('Choisissez une réponse.');
      const other = clean(input.comment, 1000);
      if (/^autre/i.test(choice) && !other) throw new PortalError('Précisez votre réponse en quelques mots.');
      answer = other ? `${choice} — ${other}` : choice;
    } else if (t.kind === 'approval') {
      answer = input.decision === 'approve' ? 'Approuvé' : input.decision === 'reject' ? `Refusé${input.comment ? ` — ${clean(input.comment, 1000)}` : ''}` : null;
      if (!answer) throw new PortalError('Choisissez « J’approuve » ou « Je n’approuve pas ».');
    } else if (t.kind === 'info') {
      answer = 'Lu';
    } else {
      throw new PortalError('Envoyez le document demandé pour terminer cette tâche.');
    }
    db.prepare("UPDATE tasks SET status = 'answered', answer = ?, answered_by = ?, answered_at = ? WHERE id = ?")
      .run(answer, actor.id, iso(), t.id);
    audit({ userId: actor.id, action: 'task.answer', target: `task:${t.id}`, clientId: t.client_id, ip });
    return { ...t, answer };
  }

  function closeTask(actor, taskId, status, ip) {
    const t = taskFor(actor, taskId);
    requireStaff(actor, t.client_id);
    const st = status === 'cancelled' ? 'cancelled' : 'done';
    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(st, t.id);
    audit({ userId: actor.id, action: `task.${st}`, target: `task:${t.id}`, clientId: t.client_id, ip });
  }

  /* ----------------------------------------------------------- documents */
  // docType : réponse du client à « De quoi s'agit-il ? » (ou type choisi par l'équipe) ; filed + link : contexte certain
  // (liste d'impôts, heures de paie), le document est classé tout de suite et n'attend pas en Réception.
  function saveDocument(actor, clientId, file, { category = 'document', note = '', taskId = null, docType = null, link = null, filed = false } = {}, ip) {
    const id = requireAccess(actor, clientId);
    const staff = isStaff(actor);
    if (!file || !file.data || !file.data.length) throw new PortalError('Choisissez un fichier.');
    if (file.data.length > MAX_UPLOAD) throw new PortalError('Fichier trop volumineux (20 Mo au maximum).');
    const type = sniff(file.data);
    if (!type) throw new PortalError('Format non accepté : envoyez un PDF, une photo JPG ou PNG, ou un classeur Excel (.xlsx).');
    const cat = staff && category === 'report' ? 'report' : 'document';
    let task = null;
    if (taskId) {
      task = taskFor(actor, taskId);
      if (task.client_id !== id) throw new PortalError('Accès refusé.');
    }
    const stored = `${crypto.randomUUID()}.${type.ext}`;
    const dir = path.join(docDir, String(id));
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(dir, stored), file.data, { mode: 0o600, flag: 'wx' });
    const sha = crypto.createHash('sha256').update(file.data).digest('hex');
    const name = safeName(file.name, type.ext);
    const known = DOC_TYPES[docType] ? docType : null;
    const dup = db.prepare('SELECT id FROM documents WHERE client_id = ? AND sha256 = ? ORDER BY id LIMIT 1').get(id, sha);
    const isFiled = Boolean(filed || staff);
    const suggested = isFiled ? null : known || suggestType(file.name, note);
    const r = db.prepare(`INSERT INTO documents (client_id, origin, category, name, stored, mime, size, sha256, note, task_id, uploaded_by, created_at,
      doc_type, period, suggested, suggested_by, duplicate_of, link, filed, filed_by, filed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, staff ? 'bvy' : 'client', cat, name, stored,
      type.mime, file.data.length, sha, clean(note, 500) || null, task ? task.id : null, actor.id, iso(),
      isFiled ? known : null, periodFrom(file.name, now()), suggested, suggested ? (known ? 'client' : 'name') : null, dup ? dup.id : null,
      link || null, isFiled ? 1 : 0, isFiled ? actor.id : null, isFiled ? iso() : null);
    const docId = Number(r.lastInsertRowid);
    if (task && task.kind === 'document' && task.status === 'open' && !staff) {
      db.prepare("UPDATE tasks SET status = 'answered', answer = ?, answered_by = ?, answered_at = ? WHERE id = ?")
        .run(`Document envoyé : ${name}`, actor.id, iso(), task.id);
    }
    audit({ userId: actor.id, action: 'document.upload', target: `document:${docId}`, clientId: id, ip, details: { size: file.data.length, mime: type.mime } });
    return docId;
  }

  function listDocuments(actor, clientId, { category = null } = {}) {
    const id = requireAccess(actor, clientId);
    return db.prepare(`SELECT d.id, d.origin, d.category, d.name, d.mime, d.size, d.note, d.task_id, d.created_at, u.name AS uploaded_by_name,
      d.doc_type, d.period, d.suggested, d.suggested_by, d.duplicate_of, d.link, d.filed
      FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by WHERE d.client_id = ? ${category ? 'AND d.category = ?' : ''}
      ORDER BY d.id DESC LIMIT 300`).all(...(category ? [id, category] : [id]));
  }

  function openDocument(actor, docId, ip) {
    const d = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(docId));
    if (!d) throw new PortalError('Document introuvable.');
    requireAccess(actor, d.client_id);
    audit({ userId: actor.id, action: 'document.download', target: `document:${d.id}`, clientId: d.client_id, ip });
    return { doc: d, file: path.join(docDir, String(d.client_id), d.stored) };
  }

  /* ------------------------------------------------------------ messages */
  function listMessages(actor, clientId) {
    const id = requireAccess(actor, clientId);
    const rows = db.prepare(`SELECT m.*, u.name AS author_name, u.role AS author_role FROM messages m JOIN users u ON u.id = m.author_id
      WHERE m.client_id = ? ORDER BY m.id DESC LIMIT 200`).all(id).reverse();
    if (rows.length) {
      db.prepare(`INSERT INTO message_reads (user_id, client_id, last_read_id) VALUES (?, ?, ?)
        ON CONFLICT(user_id, client_id) DO UPDATE SET last_read_id = MAX(last_read_id, excluded.last_read_id)`).run(actor.id, id, rows[rows.length - 1].id);
    }
    return rows;
  }

  function postMessage(actor, clientId, body, ip) {
    const id = requireAccess(actor, clientId);
    const text = clean(body, 4000);
    if (!text) throw new PortalError('Écrivez votre message.');
    const r = db.prepare('INSERT INTO messages (client_id, author_id, body, created_at) VALUES (?, ?, ?, ?)').run(id, actor.id, text, iso());
    audit({ userId: actor.id, action: 'message.post', target: `message:${Number(r.lastInsertRowid)}`, clientId: id, ip });
    return Number(r.lastInsertRowid);
  }

  // Messages non lus écrits par l'autre partie (client ↔ BVY).
  function unreadCount(actor, clientId) {
    if (!canAccessClient(db, actor, clientId)) return 0;
    const last = (db.prepare('SELECT last_read_id FROM message_reads WHERE user_id = ? AND client_id = ?').get(actor.id, Number(clientId)) || {}).last_read_id || 0;
    const staffSide = isStaff(actor);
    return db.prepare(`SELECT COUNT(*) AS n FROM messages m JOIN users u ON u.id = m.author_id
      WHERE m.client_id = ? AND m.id > ? AND ${staffSide ? "u.role = 'client'" : "u.role != 'client'"}`).get(Number(clientId), last).n;
  }

  function openTaskCount(actor, clientId) {
    if (!canAccessClient(db, actor, clientId)) return 0;
    return db.prepare("SELECT COUNT(*) AS n FROM tasks WHERE client_id = ? AND status = 'open'").get(Number(clientId)).n;
  }

  // Adresses à prévenir : les utilisateurs actifs du client (sauf l'auteur).
  function clientRecipients(clientId, exceptId) {
    return db.prepare("SELECT email, name FROM users WHERE client_id = ? AND status = 'active' AND id != ?").all(Number(clientId), exceptId || 0);
  }

  return {
    client, getSnapshot, saveSnapshot, setQboUrl, listTasks, createTask, answerTask, closeTask, taskFor,
    saveDocument, listDocuments, openDocument, listMessages, postMessage, unreadCount, openTaskCount, clientRecipients,
  };
}

module.exports = { createPortal, PortalError, parseAmount, formatAmount, cleanQboUrl, sniff, HEALTH, KINDS, DEFAULT_CHOICES, MAX_UPLOAD };
