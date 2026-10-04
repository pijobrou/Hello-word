'use strict';

/**
 * Dossiers d'impôt sur le revenu (workflow 14).
 *   Société : T2 et CO-17 — tenue de livres à jour → fermeture d'exercice → préparation → révision → approbation → produite.
 *   Travailleur autonome : T1, TP-1 et T2125 — documents → tenue de livres à jour → préparation → … → produite.
 *   Particulier : T1 et TP-1 — documents → préparation → … → produite.
 * Les montants viennent du logiciel d'impôt ; le portail calcule le solde, contrôle les étapes et suit les documents.
 */

const { canAccessClient } = require('./rbac.js');
const { PortalError, parseAmount } = require('./portal.js');

const STATES = Object.freeze({
  docs: 'Documents à recevoir',
  books: 'Tenue de livres à compléter',
  closing: 'Fermeture d’exercice',
  prep: 'Préparation',
  review: 'Révision',
  approval: 'Approbation du client',
  filed: 'Produite',
});
const IT_ROLES = ['admin', 'lead', 'tax'];
const CLOSING = Object.freeze([
  ['bank', 'Comptes bancaires et cartes de crédit rapprochés à la fin de l’exercice'],
  ['cca', 'Amortissement (DPA) et ajustements de fin d’exercice inscrits'],
  ['recon', 'Paie et TPS/TVQ conciliées avec les déclarations de l’année'],
  ['fs', 'États financiers produits'],
]);
const DOCS_PERSONAL = [
  ['t4', 'Feuillets T4 et RL-1 (emploi)'], ['t4a', 'Feuillets T4A et RL-1 (autres revenus)'], ['t5', 'Feuillets T5 et RL-3 (placements)'],
  ['rrsp', 'Reçus de cotisation REER'], ['t4rsp', 'Feuillets T4RSP / T4RIF (retraits)'], ['childcare', 'Reçus de frais de garde (RL-24)'],
  ['medical', 'Frais médicaux'], ['gifts', 'Reçus de dons'], ['tuition', 'Frais de scolarité (T2202 / RL-8)'],
  ['rent', 'Relevé 31 ou taxes foncières (crédit de solidarité)'], ['noa', 'Avis de cotisation de l’an dernier'],
];
const DOCS_SELF = [
  ['business', 'Revenus et dépenses d’entreprise (ou accès à QuickBooks à jour)'], ['vehicle', 'Utilisation du véhicule : kilomètres d’affaires et total'],
  ['home', 'Bureau à domicile : superficie et frais de la maison'], ['gstqst', 'Numéros d’inscription TPS/TVQ'],
];
const FIGS = Object.freeze({
  t2: [['bookIncome', 'Revenu net selon les états financiers'], ['taxable', 'Revenu imposable'], ['fedTax', 'Impôt fédéral à payer (T2)'], ['qcTax', 'Impôt du Québec à payer (CO-17)'], ['paid', 'Acomptes provisionnels versés']],
  t1: [['income', 'Revenu total'], ['fedTax', 'Impôt fédéral à payer'], ['qcTax', 'Impôt du Québec à payer'], ['paid', 'Impôt déjà payé (retenues à la source et acomptes)']],
});
const pad = (n) => String(n).padStart(2, '0');
const oneLine = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const businessDay = (d) => { const x = new Date(`${d}T00:00:00Z`); const w = x.getUTCDay(); if (w === 6) x.setUTCDate(x.getUTCDate() + 2); if (w === 0) x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

// Chemin d'un dossier selon le formulaire et le type de client
function pathFor(form, kind) {
  if (form === 't2') return ['books', 'closing', 'prep', 'review', 'approval', 'filed'];
  return kind === 'autonome' ? ['docs', 'books', 'prep', 'review', 'approval', 'filed'] : ['docs', 'prep', 'review', 'approval', 'filed'];
}
function balance(f) {
  const g = f.figures || {};
  if (g.fedTax === undefined) return null;
  return (g.fedTax || 0) + (g.qcTax || 0) - (g.paid || 0);
}

function createIncomeTax(db, { audit, now = () => Date.now(), deadlinesFor }) {
  const iso = () => new Date(now()).toISOString();
  const today = () => iso().slice(0, 10);
  const client = (id) => db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(id));
  const canStaff = (u) => Boolean(u && u.status === 'active' && IT_ROLES.includes(u.role));
  function requireStaff(actor, clientId) {
    const c = client(clientId);
    if (!canStaff(actor) || !c || c.is_firm || !canAccessClient(db, actor, c.id)) throw new PortalError('Accès refusé.');
    return c;
  }
  function decorate(f) {
    const c = client(f.client_id) || {};
    const d = { ...f, docs: f.docs ? JSON.parse(f.docs) : [], closing: f.closing ? JSON.parse(f.closing) : {}, figures: f.figures ? JSON.parse(f.figures) : {}, label: STATES[f.status], kind: c.kind };
    d.path = pathFor(f.form, c.kind);
    d.balance = balance(d);
    d.title = f.form === 't2' ? `T2 et CO-17 — ${f.year_label}` : `T1 et TP-1${c.kind === 'autonome' ? ' (avec T2125)' : ''} — ${f.year_label}`;
    return d;
  }
  function fileFor(actor, id) {
    const f = db.prepare('SELECT * FROM tax_files WHERE id = ?').get(Number(id));
    if (!f) throw new PortalError('Dossier introuvable.');
    if (actor && actor.role === 'client') { if (actor.client_id !== f.client_id) throw new PortalError('Accès refusé.'); } else requireStaff(actor, f.client_id);
    return decorate(f);
  }
  function setStatus(f, to, actor, note = null) {
    db.prepare('UPDATE tax_files SET status = ?, updated_at = ? WHERE id = ?').run(to, iso(), f.id);
    db.prepare('INSERT INTO tax_file_events (file_id, from_status, to_status, user_id, note, at) VALUES (?, ?, ?, ?, ?, ?)').run(f.id, f.status, to, actor ? actor.id : null, note, iso());
    audit({ userId: actor ? actor.id : null, action: 'incometax.status', target: `tax_file:${f.id}`, clientId: f.client_id, details: { from: f.status, to, note } });
  }
  const nextOf = (f) => f.path[f.path.indexOf(f.status) + 1];
  const closeTask = (taskId, answer, actor) => {
    if (taskId) db.prepare("UPDATE tasks SET status = 'done', answer = COALESCE(answer, ?), answered_by = COALESCE(answered_by, ?), answered_at = COALESCE(answered_at, ?) WHERE id = ? AND status IN ('open','answered')").run(answer, actor ? actor.id : null, iso(), taskId);
  };
  const saveDocs = (f, docs) => db.prepare('UPDATE tax_files SET docs = ? WHERE id = ?').run(JSON.stringify(docs), f.id);

  /* ---------------------------------------------------------- création */
  function ensureFiles() {
    const created = [];
    const day = today();
    for (const c of db.prepare("SELECT * FROM clients WHERE is_firm = 0 AND status = 'active' AND kind IS NOT NULL").all()) {
      const list = deadlinesFor(c, day);
      for (const d of list) {
        let m; let rec = null;
        if (c.kind === 'entreprise' && (m = d.key.match(/^t2:(\d{4}-\d{2}-\d{2})$/)) && m[1] < day) {
          // Solde d'impôt de la société : dernier jour du 2e mois après la fin d'exercice (3e pour une SPCC admissible)
          const [yy, mm] = m[1].split('-').map(Number);
          const payEnd = new Date(Date.UTC(yy, mm + 2, 0)).toISOString().slice(0, 10);
          rec = { form: 't2', label: `exercice terminé le ${m[1]}`, end: m[1], due: d.date, pay: businessDay(payEnd), status: 'books', docs: [] };
        } else if (c.kind !== 'entreprise' && (m = d.key.match(/^t1:(\d{4})$/)) && `${m[1]}-12-31` < day) {
          const items = [...DOCS_PERSONAL, ...(c.kind === 'autonome' ? DOCS_SELF : [])].map(([k, label]) => ({ k, label, status: 'pending', docId: null }));
          rec = { form: 't1', label: `année ${m[1]}`, end: `${m[1]}-12-31`, due: d.date, pay: businessDay(`${Number(m[1]) + 1}-04-30`), status: 'docs', docs: items };
        }
        if (!rec || db.prepare('SELECT 1 FROM tax_files WHERE client_id = ? AND deadline_key = ?').get(c.id, d.key)) continue;
        const id = Number(db.prepare(`INSERT INTO tax_files (client_id, form, deadline_key, year_label, period_end, due_date, pay_due, status, docs, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(c.id, rec.form, d.key, rec.label, rec.end, rec.due, rec.pay, rec.status, JSON.stringify(rec.docs), iso(), iso()).lastInsertRowid);
        db.prepare('INSERT INTO tax_file_events (file_id, from_status, to_status, user_id, note, at) VALUES (?, NULL, ?, NULL, ?, ?)').run(id, rec.status, rec.form === 't2' ? 'Exercice terminé' : 'Année terminée', iso());
        if (rec.form === 't1') {
          const t = Number(db.prepare(`INSERT INTO tasks (client_id, kind, title, detail, due_date, created_at, tax_file_id) VALUES (?, 'document', ?, ?, ?, ?, ?)`)
            .run(c.id, `Documents pour vos impôts ${rec.label.replace('année ', '')}`, 'Envoyez vos feuillets et reçus, ou indiquez ceux qui ne s’appliquent pas.', rec.due, iso(), id).lastInsertRowid);
          db.prepare('UPDATE tax_files SET docs_task_id = ? WHERE id = ?').run(t, id);
        }
        audit({ action: 'incometax.create', target: `tax_file:${id}`, clientId: c.id, details: { key: d.key } });
        created.push({ id, clientId: c.id, form: rec.form, label: rec.label });
      }
    }
    return created;
  }

  /* ---------------------------------------------------- documents (T1) */
  function docItem(actor, id, k, status, docId = null, ip) {
    const f = fileFor(actor, id);
    if (f.status !== 'docs') throw new PortalError('Les documents de ce dossier sont déjà reçus.');
    const it = f.docs.find((x) => x.k === k);
    if (!it) throw new PortalError('Document introuvable dans la liste.');
    if (!['pending', 'received', 'na'].includes(status)) throw new PortalError('État invalide.');
    it.status = status; if (docId) it.docId = docId;
    saveDocs(f, f.docs);
    audit({ userId: actor.id, action: 'incometax.doc', target: `tax_file:${f.id}`, clientId: f.client_id, ip, details: { k, status } });
    return f;
  }
  function addDocItem(actor, id, label, ip) {
    const f = fileFor(actor, id);
    if (actor.role === 'client') throw new PortalError('Accès refusé.');
    if (f.form !== 't1' || f.status !== 'docs') throw new PortalError('La liste ne se modifie qu’à l’étape « Documents à recevoir ».');
    const l = oneLine(label, 120);
    if (l.length < 3) throw new PortalError('Décrivez le document demandé.');
    f.docs.push({ k: `x${Date.now().toString(36)}${f.docs.length}`, label: l, status: 'pending', docId: null });
    saveDocs(f, f.docs);
    audit({ userId: actor.id, action: 'incometax.doc.add', target: `tax_file:${f.id}`, clientId: f.client_id, ip });
  }
  function docsComplete(actor, id, ip) {
    const f = fileFor(actor, id);
    if (f.status !== 'docs') throw new PortalError('Les documents de ce dossier sont déjà reçus.');
    const missing = f.docs.filter((x) => x.status === 'pending');
    if (missing.length) throw new PortalError(`Il reste ${missing.length} document${missing.length > 1 ? 's' : ''} à envoyer ou à marquer « ne s’applique pas » : ${missing[0].label}.`);
    setStatus(f, nextOf(f), actor, actor.role === 'client' ? 'Le client a tout envoyé' : 'Documents reçus');
    closeTask(f.docs_task_id, 'Documents envoyés', actor);
    audit({ userId: actor.id, action: 'incometax.docs.complete', target: `tax_file:${f.id}`, clientId: f.client_id, ip });
    return f;
  }

  /* ------------------------------------------------------------ étapes */
  function advance(actor, id, form, ip) {
    const f = fileFor(actor, id);
    if (actor.role === 'client') throw new PortalError('Accès refusé.');
    const c = client(f.client_id);
    const action = String(form.action || '');
    let notifyClient = false;
    if (action === 'back') {
      const reason = oneLine(form.note, 300);
      const i = f.path.indexOf(f.status);
      if (i <= 0 || f.status === 'filed') throw new PortalError('Ce dossier ne peut pas revenir en arrière.');
      if (!reason) throw new PortalError('Indiquez la raison du retour en arrière.');
      if (f.status === 'approval') { closeTask(f.approval_task_id, 'Annulé par BVY', actor); db.prepare('UPDATE tax_files SET client_approved = 0 WHERE id = ?').run(f.id); }
      setStatus(f, f.path[i - 1], actor, `Retour en arrière : ${reason}`);
    } else if (action === 'books') {
      if (f.status !== 'books') throw new PortalError('Action impossible à cette étape.');
      if (c.books_status !== 'done') throw new PortalError('La tenue de livres de ce client n’est pas « À jour » : le dossier ne peut pas avancer.');
      setStatus(f, nextOf(f), actor, 'Tenue de livres à jour');
    } else if (action === 'closing') {
      if (f.status !== 'closing') throw new PortalError('Action impossible à cette étape.');
      const list = Object.fromEntries(CLOSING.map(([k]) => [k, form[`chk_${k}`] === '1']));
      const missing = CLOSING.find(([k]) => !list[k]);
      if (missing) throw new PortalError(`Fermeture incomplète : ${missing[1].toLowerCase()}.`);
      db.prepare('UPDATE tax_files SET closing = ? WHERE id = ?').run(JSON.stringify({ ...list, by: actor.name, at: iso() }), f.id);
      setStatus(f, 'prep', actor, 'Fermeture d’exercice terminée');
    } else if (action === 'reviewed') {
      if (f.status !== 'review') throw new PortalError('Action impossible à cette étape.');
      db.prepare('UPDATE tax_files SET reviewed_by = ? WHERE id = ?').run(actor.id, f.id);
      setStatus(f, 'approval', actor, f.prepared_by === actor.id ? 'Révisé par la personne qui l’a préparé' : 'Révisé');
      const t = Number(db.prepare(`INSERT INTO tasks (client_id, kind, title, detail, due_date, created_by, created_at, tax_file_id) VALUES (?, 'approval', ?, ?, ?, ?, ?, ?)`)
        .run(f.client_id, `Approuver vos déclarations de revenus (${f.year_label})`, 'Vérifiez le résultat préparé par BVY, puis approuvez vos déclarations.', f.due_date, actor.id, iso(), f.id).lastInsertRowid);
      db.prepare('UPDATE tax_files SET approval_task_id = ? WHERE id = ?').run(t, f.id);
      notifyClient = true;
    } else if (action === 'filed') {
      if (f.status !== 'approval' || !f.client_approved) throw new PortalError('Les déclarations doivent être approuvées par le client avant d’être produites.');
      const fed = oneLine(form.confirmationFed, 60); const qc = oneLine(form.confirmationQc, 60);
      db.prepare('UPDATE tax_files SET confirmation_fed = ?, confirmation_qc = ?, filed_at = ? WHERE id = ?').run(fed || null, qc || null, iso(), f.id);
      setStatus(f, 'filed', actor, [fed && `fédéral ${fed}`, qc && `Québec ${qc}`].filter(Boolean).join(' · ') || 'Produites');
      const mark = db.prepare(`INSERT INTO deadline_marks (client_id, key, status, marked_by, marked_at) VALUES (?, ?, 'done', ?, ?)
        ON CONFLICT(client_id, key) DO UPDATE SET status = 'done', marked_by = excluded.marked_by, marked_at = excluded.marked_at`);
      mark.run(f.client_id, f.deadline_key, actor.id, iso());
      if (f.form === 't2') mark.run(f.client_id, f.deadline_key.replace('t2:', 'req:'), actor.id, iso());
    } else if (action === 'docs') {
      return docsComplete(actor, id, ip);
    } else throw new PortalError('Action inconnue.');
    audit({ userId: actor.id, action: `incometax.${action}`, target: `tax_file:${f.id}`, clientId: f.client_id, ip });
    return { ...f, notifyClient };
  }

  function saveFigures(actor, id, form, ip) {
    const f = fileFor(actor, id);
    if (actor.role === 'client') throw new PortalError('Accès refusé.');
    if (!['prep', 'review'].includes(f.status)) throw new PortalError('Les montants se saisissent à l’étape « Préparation ».');
    const figures = {};
    for (const [k, label] of FIGS[f.form]) {
      const v = parseAmount(form[k]);
      if (v === null) throw new PortalError(`Indiquez : ${label} (0 si aucun).`);
      if (v < 0 && !['bookIncome', 'taxable', 'income'].includes(k)) throw new PortalError(`Montant négatif : ${label}.`);
      figures[k] = v;
    }
    db.prepare('UPDATE tax_files SET figures = ?, prepared_by = ? WHERE id = ?').run(JSON.stringify(figures), actor.id, f.id);
    if (f.status === 'prep') setStatus(f, 'review', actor, 'Montants inscrits ; révision demandée');
    audit({ userId: actor.id, action: 'incometax.figures', target: `tax_file:${f.id}`, clientId: f.client_id, ip });
  }

  function decide(actor, id, { decision, comment }, ip) {
    const f = fileFor(actor, id);
    if (actor.role !== 'client' || f.status !== 'approval' || f.client_approved) throw new PortalError('Ce dossier n’attend pas votre approbation.');
    if (decision === 'approve') {
      db.prepare('UPDATE tax_files SET client_approved = 1 WHERE id = ?').run(f.id);
      db.prepare("INSERT INTO tax_file_events (file_id, from_status, to_status, user_id, note, at) VALUES (?, 'approval', 'approval', ?, 'Approuvé par le client', ?)").run(f.id, actor.id, iso());
      closeTask(f.approval_task_id, 'Approuvé', actor);
    } else if (decision === 'reject') {
      const c = oneLine(comment, 1000);
      if (!c) throw new PortalError('Dites-nous en quelques mots ce qui doit être corrigé.');
      db.prepare('UPDATE tax_files SET client_comment = ? WHERE id = ?').run(c, f.id);
      setStatus(f, 'review', actor, `Refusé par le client : ${c}`);
      closeTask(f.approval_task_id, `Refusé — ${c}`, actor);
    } else throw new PortalError('Choisissez « J’approuve » ou « Je n’approuve pas ».');
    audit({ userId: actor.id, action: `incometax.${decision}`, target: `tax_file:${f.id}`, clientId: f.client_id, ip });
  }

  /* ------------------------------------------------------------ lectures */
  const events = (id) => db.prepare('SELECT e.*, u.name AS user_name FROM tax_file_events e LEFT JOIN users u ON u.id = e.user_id WHERE file_id = ? ORDER BY e.id').all(Number(id));
  function board(actor) {
    if (!canStaff(actor)) throw new PortalError('Accès refusé.');
    const since = new Date(now() - 30 * 86_400_000).toISOString();
    const rows = db.prepare(`SELECT f.*, c.name AS client_name, c.books_status FROM tax_files f JOIN clients c ON c.id = f.client_id
      WHERE f.status != 'filed' OR f.filed_at >= ? ORDER BY f.due_date, c.name`).all(since)
      .filter((f) => canAccessClient(db, actor, f.client_id)).map((f) => ({ ...decorate(f), client_name: f.client_name, books_status: f.books_status }));
    for (const f of rows) { f.late = f.status !== 'filed' && f.due_date < today(); f.blocked = f.status === 'books' && f.books_status !== 'done'; f.docsLeft = f.docs.filter((x) => x.status === 'pending').length; }
    const order = ['docs', 'books', 'closing', 'prep', 'review', 'approval', 'filed'];
    return { rows, groups: order.map((st) => ({ status: st, label: STATES[st], rows: rows.filter((x) => x.status === st) })) };
  }
  function forClient(actor, clientId) {
    const c = requireStaff(actor, clientId);
    return db.prepare('SELECT * FROM tax_files WHERE client_id = ? ORDER BY period_end DESC LIMIT 30').all(c.id).map(decorate);
  }

  return { STATES, CLOSING, FIGS, canStaff, ensureFiles, docItem, addDocItem, docsComplete, advance, saveFigures, decide, fileFor, events, board, forClient,
    booksReady: (cid) => (client(cid) || {}).books_status === 'done' };
}

module.exports = { createIncomeTax, pathFor, balance, STATES, CLOSING, FIGS, IT_ROLES };
