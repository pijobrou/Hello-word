'use strict';

/**
 * Demandes du gouvernement (workflow 17) : contrôles (vérifications), demandes de documents, avis de cotisation,
 * avis de solde dû. Date limite obligatoire ; pour un avis de cotisation, 90 jours pour s'opposer.
 * Reçue → Documents à réunir → Prête à envoyer → Envoyée → Fermée.
 */

const { visibleClients, canAccessClient, STAFF_ROLES } = require('./rbac.js');
const { PortalError, parseAmount } = require('./portal.js');
const { businessDay } = require('./deadlines.js');
const { isoDay } = require('./dates.js');

const DAY = 86_400_000;
const AGENCIES = { arc: 'ARC', rq: 'Revenu Québec', cnesst: 'CNESST', req: 'Registraire des entreprises', autre: 'Autre organisme' };
const KINDS = { verification: 'Vérification (contrôle)', documents: 'Demande de renseignements ou de documents', cotisation: 'Avis de cotisation ou de nouvelle cotisation', recouvrement: 'Avis de solde dû (recouvrement)', autre: 'Autre demande' };
const PROGRAMS = { taxes: 'TPS/TVQ', t2: 'Impôt de la société', t1: 'Impôt du particulier', paie: 'Retenues à la source et paie', cnesst: 'CNESST', autre: 'Autre' };
const STATES = { received: 'Reçue', gathering: 'Documents à réunir', ready: 'Prête à envoyer', sent: 'Envoyée — en attente de la réponse', closed: 'Fermée' };
const ORDER = ['received', 'gathering', 'ready', 'sent', 'closed'];
// Ce que voit le client sur son accueil
const CLIENT_STEP = { received: 'BVY a reçu la lettre', gathering: 'documents à réunir', ready: 'réponse prête', sent: 'envoyée, en attente de la réponse' };
const SENT_HOW = ['Mon dossier (ARC)', 'Mon dossier pour les entreprises (Revenu Québec)', 'Représentation (agent autorisé)', 'Courrier', 'Télécopieur', 'Autre'];
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDay = (d) => DAY_RE.test(String(d || '')) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
// Ajoute n jours à une date AAAA-MM-JJ (calcul en UTC : jamais de décalage de fuseau).
const addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const line = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

// Avis de cotisation : 90 jours après la date de l'avis pour s'opposer (ARC et Revenu Québec), reporté au jour ouvrable.
function objectionDate(letterDate) {
  return businessDay(addDays(letterDate, 90));
}

function title(r) {
  return `${AGENCIES[r.agency]} — ${KINDS[r.kind].replace(/ \(.*\)$/, '')} (${PROGRAMS[r.program] || r.program})`;
}

function createGovRequests(db, { audit, now = () => Date.now(), portal }) {
  const iso = () => new Date(now()).toISOString();
  const today = () => isoDay(now());
  const isStaff = (u) => Boolean(u && STAFF_ROLES.includes(u.role));
  function requireStaff(actor, clientId) {
    if (!isStaff(actor)) throw new PortalError('Réservé à l’équipe BVY.');
    if (!canAccessClient(db, actor, clientId)) throw new PortalError('Accès refusé.');
    return Number(clientId);
  }
  const event = (id, from, to, userId, note) => db.prepare('INSERT INTO gov_request_events (request_id, from_status, to_status, user_id, note, at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, from, to, userId || null, note || null, iso());
  const decorate = (r) => {
    const items = JSON.parse(r.items || '[]');
    const days = Math.round((Date.parse(`${r.due_date}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / DAY);
    return { ...r, items, title: title(r), days, late: r.status !== 'closed' && r.status !== 'sent' && days < 0, missing: items.filter((i) => i.status === 'todo').length };
  };
  const itemsFrom = (text) => String(text || '').split(/\r?\n/).map((l) => line(l, 160)).filter(Boolean).slice(0, 30)
    .map((label, i) => ({ k: `i${i + 1}`, label, status: 'todo' }));

  /* ---------------------------------------------------------- création */
  function create(actor, clientId, input, ip) {
    const id = requireStaff(actor, clientId);
    const c = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    if (!c || c.is_firm) throw new PortalError('Ce dossier n’existe pas.');
    const agency = AGENCIES[input.agency] ? input.agency : null;
    const kind = KINDS[input.kind] ? input.kind : null;
    const program = PROGRAMS[input.program] ? input.program : null;
    if (!agency || !kind || !program) throw new PortalError('Choisissez l’organisme, le type de demande et le programme visé.');
    const letterDate = line(input.letterDate, 10);
    if (!validDay(letterDate)) throw new PortalError('Indiquez la date de la lettre (AAAA-MM-JJ).');
    if (letterDate > today()) throw new PortalError('La date de la lettre ne peut pas être dans le futur.');
    let due = line(input.dueDate, 10);
    if (!due && kind === 'cotisation') due = objectionDate(letterDate);
    if (!validDay(due)) throw new PortalError('Indiquez la date limite de réponse écrite dans la lettre (AAAA-MM-JJ).');
    if (due < letterDate) throw new PortalError('La date limite ne peut pas précéder la date de la lettre.');
    const summary = String(input.summary || '').trim().slice(0, 1500);
    if (summary.length < 5) throw new PortalError('Résumez la demande en une ou deux phrases.');
    const amount = input.amount ? parseAmount(input.amount) : null;
    const docId = input.letterDocId ? Number(input.letterDocId) : null;
    if (docId) {
      const d = db.prepare('SELECT client_id FROM documents WHERE id = ?').get(docId);
      if (!d || d.client_id !== id) throw new PortalError('La lettre choisie n’appartient pas à ce client.');
    }
    const items = itemsFrom(input.items);
    const r = db.prepare(`INSERT INTO gov_requests (client_id, agency, kind, program, reference, letter_date, due_date, summary, amount_cents, letter_doc_id, items, status, owner_id, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, agency, kind, program, line(input.reference, 60) || null, letterDate, due, summary, amount, docId,
      JSON.stringify(items), items.length ? 'gathering' : 'received', actor.id, actor.id, iso(), iso());
    const rid = Number(r.lastInsertRowid);
    event(rid, null, items.length ? 'gathering' : 'received', actor.id, `Lettre du ${letterDate} enregistrée`);
    if (docId) {
      db.prepare("UPDATE documents SET doc_type = 'gouvernement', link = ?, filed = 1, filed_by = ?, filed_at = COALESCE(filed_at, ?) WHERE id = ?").run(`gov_request:${rid}`, actor.id, iso(), docId);
    }
    audit({ userId: actor.id, action: 'gov_request.create', target: `gov_request:${rid}`, clientId: id, ip, details: { agency, kind, program, due } });
    return rid;
  }

  function requestFor(actor, rid) {
    const r = db.prepare('SELECT * FROM gov_requests WHERE id = ?').get(Number(rid));
    if (!r) throw new PortalError('Demande introuvable.');
    requireStaff(actor, r.client_id);
    return r;
  }

  function get(actor, rid) {
    const r = decorate(requestFor(actor, rid));
    const events = db.prepare('SELECT e.*, u.name FROM gov_request_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.request_id = ? ORDER BY e.id').all(r.id);
    const docs = db.prepare('SELECT id, name, created_at, origin FROM documents WHERE client_id = ? AND (link = ? OR id = ?) ORDER BY id').all(r.client_id, `gov_request:${r.id}`, r.letter_doc_id || 0);
    const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(r.client_id);
    const owner = r.owner_id ? db.prepare('SELECT name FROM users WHERE id = ?').get(r.owner_id) : null;
    const task = r.task_id ? db.prepare('SELECT id, status, title FROM tasks WHERE id = ?').get(r.task_id) : null;
    return { ...r, events, docs, client, ownerName: owner && owner.name, task };
  }

  function update(actor, rid, input, ip) {
    const r = requestFor(actor, rid);
    const due = line(input.dueDate, 10);
    if (!validDay(due) || due < r.letter_date) throw new PortalError('Date limite invalide.');
    const summary = String(input.summary || '').trim().slice(0, 1500);
    if (summary.length < 5) throw new PortalError('Résumez la demande en une ou deux phrases.');
    db.prepare('UPDATE gov_requests SET due_date = ?, summary = ?, reference = ?, amount_cents = ?, updated_at = ? WHERE id = ?')
      .run(due, summary, line(input.reference, 60) || null, input.amount ? parseAmount(input.amount) : null, iso(), r.id);
    if (due !== r.due_date) event(r.id, r.status, r.status, actor.id, `Date limite changée : ${r.due_date} → ${due}${input.reason ? ` (${line(input.reason, 200)})` : ''}`);
    audit({ userId: actor.id, action: 'gov_request.update', target: `gov_request:${r.id}`, clientId: r.client_id, ip });
  }

  /* ------------------------------------------------- documents à réunir */
  function setItems(r, items) {
    db.prepare('UPDATE gov_requests SET items = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(items), iso(), r.id);
  }
  function addItem(actor, rid, label, ip) {
    const r = requestFor(actor, rid);
    if (r.status === 'closed' || r.status === 'sent') throw new PortalError('La réponse est déjà envoyée.');
    const l = line(label, 160);
    if (l.length < 3) throw new PortalError('Décrivez le document demandé.');
    const items = JSON.parse(r.items);
    items.push({ k: `i${Date.now().toString(36)}${items.length}`, label: l, status: 'todo' });
    setItems(r, items);
    if (r.status === 'received' || r.status === 'ready') { db.prepare("UPDATE gov_requests SET status = 'gathering' WHERE id = ?").run(r.id); event(r.id, r.status, 'gathering', actor.id, `Document ajouté : ${l}`); }
    audit({ userId: actor.id, action: 'gov_request.item_add', target: `gov_request:${r.id}`, clientId: r.client_id, ip });
  }
  function setItem(actor, rid, key, status, ip) {
    const r = requestFor(actor, rid);
    if (!['todo', 'received', 'na'].includes(status)) throw new PortalError('État invalide.');
    const items = JSON.parse(r.items);
    const it = items.find((i) => i.k === key);
    if (!it) throw new PortalError('Document introuvable dans la liste.');
    it.status = status;
    setItems(r, items);
    audit({ userId: actor.id, action: 'gov_request.item', target: `gov_request:${r.id}`, clientId: r.client_id, ip, details: { item: key, status } });
  }

  // Une seule tâche au client avec les documents manquants (rappels automatiques du workflow 10).
  function askClient(actor, rid, ip) {
    const r = decorate(requestFor(actor, rid));
    const missing = r.items.filter((i) => i.status === 'todo');
    if (!missing.length) throw new PortalError('Aucun document à obtenir dans la liste.');
    const open = r.task_id && db.prepare("SELECT 1 FROM tasks WHERE id = ? AND status = 'open'").get(r.task_id);
    if (open) throw new PortalError('Une demande de documents est déjà en attente chez le client.');
    const due = [addDays(today(), 2), addDays(r.due_date, -7)].sort()[1]; // une semaine avant la date limite, au moins 2 jours
    const taskId = portal.createTask(actor, r.client_id, {
      kind: 'document', title: `Documents demandés par ${AGENCIES[r.agency]}`, dueDate: due,
      detail: `BVY prépare la réponse à ${AGENCIES[r.agency]} (${KINDS[r.kind].toLowerCase()}). Envoyez ici :\n${missing.map((i) => `• ${i.label}`).join('\n')}`,
    }, ip);
    db.prepare('UPDATE tasks SET gov_request_id = ? WHERE id = ?').run(r.id, taskId);
    db.prepare("UPDATE gov_requests SET task_id = ?, status = CASE WHEN status = 'received' THEN 'gathering' ELSE status END, updated_at = ? WHERE id = ?").run(taskId, iso(), r.id);
    event(r.id, r.status, r.status === 'received' ? 'gathering' : r.status, actor.id, `Documents demandés au client (${missing.length})`);
    audit({ userId: actor.id, action: 'gov_request.ask_client', target: `gov_request:${r.id}`, clientId: r.client_id, ip });
    return { clientId: r.client_id, taskId };
  }

  /* ------------------------------------------------------------ étapes */
  function advance(actor, rid, action, input = {}, ip) {
    const r = decorate(requestFor(actor, rid));
    const note = line(input.note, 600);
    let to; const sets = {};
    if (action === 'back') {
      const i = ORDER.indexOf(r.status);
      if (i <= 0) throw new PortalError('Cette demande est déjà à la première étape.');
      if (!note) throw new PortalError('Indiquez la raison du retour en arrière.');
      to = ORDER[i - 1];
    } else if (action === 'gathering') {
      if (r.status !== 'received') throw new PortalError('Étape invalide.');
      to = 'gathering';
    } else if (action === 'ready') {
      if (!['received', 'gathering'].includes(r.status)) throw new PortalError('Étape invalide.');
      if (r.missing) throw new PortalError(`Il manque encore ${r.missing} document${r.missing > 1 ? 's' : ''} : marquez-les reçus ou « ne s’applique pas ».`);
      to = 'ready';
    } else if (action === 'sent') {
      if (r.status !== 'ready') throw new PortalError('La réponse doit d’abord être prête.');
      const on = line(input.sentOn, 10);
      if (!validDay(on) || on > today()) throw new PortalError('Indiquez la date d’envoi (AAAA-MM-JJ).');
      if (!SENT_HOW.includes(input.sentHow)) throw new PortalError('Indiquez comment la réponse a été envoyée.');
      Object.assign(sets, { sent_on: on, sent_how: input.sentHow, confirmation: line(input.confirmation, 80) || null });
      to = 'sent';
    } else if (action === 'closed') {
      if (r.status !== 'sent' && !(r.status !== 'closed' && r.kind === 'cotisation')) throw new PortalError('La réponse doit d’abord être envoyée.');
      if (!note) throw new PortalError('Écrivez le résultat (ex. : aucun changement, nouvelle cotisation de 1 250,00 $, objection déposée).');
      Object.assign(sets, { outcome: note });
      to = 'closed';
    } else {
      throw new PortalError('Action inconnue.');
    }
    const cols = Object.keys(sets);
    db.prepare(`UPDATE gov_requests SET status = ?, updated_at = ?${cols.map((k) => `, ${k} = ?`).join('')} WHERE id = ?`).run(to, iso(), ...Object.values(sets), r.id);
    const msg = { sent: `Envoyée le ${sets.sent_on} (${sets.sent_how})${sets.confirmation ? ` — confirmation ${sets.confirmation}` : ''}`, closed: `Résultat : ${note}` }[action] || note || STATES[to];
    event(r.id, r.status, to, actor.id, msg);
    audit({ userId: actor.id, action: `gov_request.${action}`, target: `gov_request:${r.id}`, clientId: r.client_id, ip });
    return r.client_id;
  }

  /* ------------------------------------------------------ consultation */
  function list(actor, { closed = false, clientId = null } = {}) {
    if (!isStaff(actor)) throw new PortalError('Réservé à l’équipe BVY.');
    const clients = clientId ? [{ id: requireStaff(actor, clientId) }] : visibleClients(db, actor);
    const ids = clients.map((c) => Number(c.id)).join(',') || '0';
    return db.prepare(`SELECT g.*, c.name AS client FROM gov_requests g JOIN clients c ON c.id = g.client_id
      WHERE g.client_id IN (${ids}) AND g.status ${closed ? "= 'closed'" : "!= 'closed'"} ORDER BY ${closed ? 'g.updated_at DESC' : 'g.due_date'} LIMIT 300`).all().map(decorate);
  }
  const openForClient = (clientId) => db.prepare("SELECT * FROM gov_requests WHERE client_id = ? AND status != 'closed' ORDER BY due_date").all(Number(clientId))
    .map((r) => ({ id: r.id, title: `Lettre de ${r.agency === 'arc' ? 'l’ARC' : r.agency === 'autre' ? 'un organisme public' : AGENCIES[r.agency]} (${KINDS[r.kind].replace(/ \(.*\)$/, '').toLowerCase()}, ${PROGRAMS[r.program] || ''})`,
      due: r.due_date, step: CLIENT_STEP[r.status], progress: { received: 20, gathering: 40, ready: 60, sent: 80 }[r.status] }));
  const openCount = (clientId) => db.prepare("SELECT COUNT(*) AS n FROM gov_requests WHERE client_id = ? AND status != 'closed'").get(Number(clientId)).n;
  // Pour les anomalies urgentes (workflow 06) : réponse due dans 7 jours ou moins, pas encore envoyée.
  const dueSoon = (clientId, day) => db.prepare("SELECT * FROM gov_requests WHERE client_id = ? AND status IN ('received','gathering','ready') AND due_date <= ?")
    .all(Number(clientId), addDays(day, 7)).map(decorate);

  return { create, get, update, addItem, setItem, askClient, advance, list, openForClient, openCount, dueSoon };
}

module.exports = { createGovRequests, objectionDate, addDays, AGENCIES, KINDS, PROGRAMS, STATES, SENT_HOW, title };
