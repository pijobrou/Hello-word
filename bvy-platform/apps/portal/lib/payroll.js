'use strict';

/**
 * Paie (workflow 12). Le calcul se fait dans QuickBooks Online Paie (Canada) ; le portail organise le travail :
 * calendrier, demande d'heures au client, sommaire saisi par BVY, approbation du client, états, historique.
 * Aucune donnée sensible (NAS, compte bancaire, taux de salaire) n'est conservée.
 */

const { canAccessClient } = require('./rbac.js');
const { PortalError, parseAmount } = require('./portal.js');

const STATES = Object.freeze({
  waiting: 'En attente des données',
  hours_received: 'Heures reçues',
  validation: 'Validation requise',
  preparing: 'En préparation',
  ready: 'Prête',
  done: 'Terminée',
});
const ORDER = ['waiting', 'hours_received', 'validation', 'preparing', 'ready', 'done'];
const FREQ = Object.freeze({ weekly: 'Hebdomadaire', biweekly: 'Aux deux semaines', semimonthly: 'Deux fois par mois (le 15 et le dernier jour)', monthly: 'Mensuelle' });
const PAYROLL_ROLES = ['admin', 'lead', 'payroll'];
const DEFAULT_QBO_PAYROLL = 'https://app.qbo.intuit.com/app/payroll';
const DAY = 86_400_000;

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date, n) => ymd(Date.parse(`${date}T00:00:00Z`) + n * DAY);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m de 1 à 12
function nextPayDate(date, freq) {
  const [y, m, d] = date.split('-').map(Number);
  if (freq === 'weekly') return addDays(date, 7);
  if (freq === 'biweekly') return addDays(date, 14);
  if (freq === 'semimonthly') {
    if (d < 15) return `${y}-${String(m).padStart(2, '0')}-15`;
    if (d < lastDay(y, m)) return `${y}-${String(m).padStart(2, '0')}-${lastDay(y, m)}`;
    const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
    return `${ny}-${String(nm).padStart(2, '0')}-15`;
  }
  const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, lastDay(ny, nm))).padStart(2, '0')}`;
}
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const oneLine = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);
const hoursNum = (v) => {
  const s = String(v ?? '').trim().replace(',', '.');
  if (!s) return 0;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 400) throw new PortalError('Heures invalides : entrez un nombre entre 0 et 400.');
  return Math.round(n * 100) / 100;
};

function createPayroll(db, { audit, now = () => Date.now() }) {
  const iso = () => new Date(now()).toISOString();
  const today = () => ymd(now());
  const client = (id) => db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(id));

  const canStaff = (u) => Boolean(u && u.status === 'active' && PAYROLL_ROLES.includes(u.role));
  function requireStaff(actor, clientId) {
    const c = client(clientId);
    if (!canStaff(actor) || !c || c.is_firm || !canAccessClient(db, actor, c.id)) throw new PortalError('Accès refusé.');
    return c;
  }
  function requireClientUser(actor, clientId) {
    if (!actor || actor.role !== 'client' || actor.client_id !== Number(clientId)) throw new PortalError('Accès refusé.');
    return client(clientId);
  }
  function runFor(actor, runId) {
    const r = db.prepare('SELECT * FROM pay_runs WHERE id = ?').get(Number(runId));
    if (!r) throw new PortalError('Paie introuvable.');
    if (actor && actor.role === 'client') requireClientUser(actor, r.client_id); else requireStaff(actor, r.client_id);
    return decorate(r);
  }
  function decorate(r) {
    return { ...r, hours: r.hours ? JSON.parse(r.hours) : null, label: STATES[r.status] };
  }

  function setStatus(run, to, actor, note = null) {
    db.prepare('UPDATE pay_runs SET status = ?, updated_at = ? WHERE id = ?').run(to, iso(), run.id);
    db.prepare('INSERT INTO pay_run_events (run_id, from_status, to_status, user_id, note, at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(run.id, run.status, to, actor ? actor.id : null, note, iso());
    audit({ userId: actor ? actor.id : null, action: 'payroll.status', target: `pay_run:${run.id}`, clientId: run.client_id, details: { from: run.status, to, note } });
  }
  const closeTask = (taskId, answer, actor) => {
    if (!taskId) return;
    db.prepare("UPDATE tasks SET status = 'done', answer = COALESCE(answer, ?), answered_by = COALESCE(answered_by, ?), answered_at = COALESCE(answered_at, ?) WHERE id = ? AND status IN ('open','answered')")
      .run(answer, actor ? actor.id : null, iso(), taskId);
  };
  const newTask = (r, kind, title, detail, actor) => Number(db.prepare(`INSERT INTO tasks (client_id, kind, title, detail, due_date, created_by, created_at, pay_run_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(r.client_id, kind, title, detail, r.pay_date, actor ? actor.id : null, iso(), r.id).lastInsertRowid);

  /* ------------------------------------------------- calendrier et employés */
  function saveSchedule(actor, clientId, form, ip) {
    const c = requireStaff(actor, clientId);
    if (!c.payroll) throw new PortalError('Cochez d’abord « A des employés » dans le profil fiscal du client (onglet Échéances).');
    const freq = String(form.frequency || '');
    if (!FREQ[freq]) throw new PortalError('Choisissez la fréquence de paie.');
    if (!isDay(form.nextPayDate)) throw new PortalError('Indiquez la prochaine date de paie.');
    const lead = Math.min(14, Math.max(1, Number(form.leadDays) || 3));
    const url = String(form.qboUrl || '').trim();
    if (url && !/^https:\/\/([a-z0-9-]+\.)*intuit\.com\//i.test(url)) throw new PortalError('Le lien de la paie doit être une adresse QuickBooks (intuit.com).');
    db.prepare(`INSERT INTO payroll_schedules (client_id, frequency, next_pay_date, lead_days, qbo_url, active, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(client_id) DO UPDATE SET frequency = excluded.frequency, next_pay_date = excluded.next_pay_date, lead_days = excluded.lead_days,
        qbo_url = excluded.qbo_url, active = excluded.active, updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
      .run(c.id, freq, form.nextPayDate, lead, url || null, form.active === '0' ? 0 : 1, actor.id, iso());
    audit({ userId: actor.id, action: 'payroll.schedule', target: `client:${c.id}`, clientId: c.id, ip, details: { freq, next: form.nextPayDate, lead } });
  }
  const schedule = (clientId) => db.prepare('SELECT * FROM payroll_schedules WHERE client_id = ?').get(Number(clientId)) || null;

  function addEmployee(actor, clientId, { name, payType }, ip) {
    const c = requireStaff(actor, clientId);
    const n = oneLine(name, 120);
    if (n.length < 2) throw new PortalError('Indiquez le nom de l’employé.');
    db.prepare('INSERT INTO employees (client_id, name, pay_type, created_at) VALUES (?, ?, ?, ?)').run(c.id, n, payType === 'salary' ? 'salary' : 'hourly', iso());
    audit({ userId: actor.id, action: 'payroll.employee.add', target: `client:${c.id}`, clientId: c.id, ip });
  }
  function setEmployeeActive(actor, clientId, employeeId, active, ip) {
    const c = requireStaff(actor, clientId);
    const r = db.prepare('UPDATE employees SET active = ? WHERE id = ? AND client_id = ?').run(active ? 1 : 0, Number(employeeId), c.id);
    if (!r.changes) throw new PortalError('Employé introuvable.');
    audit({ userId: actor.id, action: active ? 'payroll.employee.reactivate' : 'payroll.employee.deactivate', target: `client:${c.id}`, clientId: c.id, ip });
  }
  const employees = (clientId, { all = false } = {}) => db.prepare(`SELECT * FROM employees WHERE client_id = ?${all ? '' : ' AND active = 1'} ORDER BY name`).all(Number(clientId));

  /* --------------------------------------- création automatique des paies */
  // Crée les paies dont la demande d'heures doit partir (date de paie − délai ≤ aujourd'hui). Idempotent.
  function ensureRuns() {
    const created = [];
    const day = today();
    for (const sc of db.prepare('SELECT s.* FROM payroll_schedules s JOIN clients c ON c.id = s.client_id WHERE s.active = 1 AND c.payroll = 1 AND c.status = \'active\'').all()) {
      let next = sc.next_pay_date;
      for (let guard = 0; guard < 60 && addDays(next, -sc.lead_days) <= day; guard++) {
        const exists = db.prepare('SELECT 1 FROM pay_runs WHERE client_id = ? AND pay_date = ?').get(sc.client_id, next);
        if (!exists && next >= day) { // une paie déjà passée à la mise en place n'est pas recréée
          const id = Number(db.prepare("INSERT INTO pay_runs (client_id, pay_date, status, created_at, updated_at) VALUES (?, ?, 'waiting', ?, ?)").run(sc.client_id, next, iso(), iso()).lastInsertRowid);
          const run = { id, client_id: sc.client_id, pay_date: next, status: null };
          const taskId = newTask(run, 'document', `Heures de paie — paie du ${next}`,
            'Entrez les heures de chaque employé, ou envoyez votre feuille de temps (PDF, photo ou Excel).', null);
          db.prepare('UPDATE pay_runs SET hours_task_id = ? WHERE id = ?').run(taskId, id);
          db.prepare('INSERT INTO pay_run_events (run_id, from_status, to_status, user_id, note, at) VALUES (?, NULL, \'waiting\', NULL, ?, ?)').run(id, 'Créée selon le calendrier de paie', iso());
          audit({ action: 'payroll.run.create', target: `pay_run:${id}`, clientId: sc.client_id, details: { pay_date: next } });
          created.push({ id, clientId: sc.client_id, payDate: next });
        }
        next = nextPayDate(next, sc.frequency);
      }
      if (next !== sc.next_pay_date) db.prepare('UPDATE payroll_schedules SET next_pay_date = ? WHERE client_id = ?').run(next, sc.client_id);
    }
    return created;
  }

  /* ------------------------------------------------------------ client */
  function submitHours(actor, runId, form, docId, ip) {
    const r = runFor(actor, runId);
    if (r.status !== 'waiting') throw new PortalError('Les heures de cette paie sont déjà transmises.');
    const lines = [];
    for (const e of employees(r.client_id)) {
      const reg = hoursNum(form[`reg_${e.id}`]); const ot = hoursNum(form[`ot_${e.id}`]); const off = hoursNum(form[`off_${e.id}`]);
      const note = oneLine(form[`note_${e.id}`], 200);
      if (reg || ot || off || note) lines.push({ employeeId: e.id, name: e.name, regular: reg, overtime: ot, leave: off, note });
    }
    const general = oneLine(form.note, 1000);
    if (!lines.length && !docId) throw new PortalError('Entrez les heures d’au moins un employé, ou joignez votre feuille de temps.');
    db.prepare('UPDATE pay_runs SET hours = ?, timesheet_doc_id = COALESCE(?, timesheet_doc_id), client_comment = ? WHERE id = ?')
      .run(JSON.stringify({ lines, note: general, by: actor.name, at: iso() }), docId || null, general || null, r.id);
    setStatus(r, 'hours_received', actor, docId ? 'Feuille de temps jointe' : 'Heures saisies dans le portail');
    closeTask(r.hours_task_id, docId ? 'Feuille de temps envoyée' : 'Heures transmises', actor);
    audit({ userId: actor.id, action: 'payroll.hours', target: `pay_run:${r.id}`, clientId: r.client_id, ip, details: { employees: lines.length, timesheet: Boolean(docId) } });
    return r;
  }

  function decide(actor, runId, { decision, comment }, ip) {
    const r = runFor(actor, runId);
    if (r.status !== 'validation') throw new PortalError('Cette paie n’attend pas votre approbation.');
    if (decision === 'approve') {
      setStatus(r, 'preparing', actor, 'Approuvée par le client');
      closeTask(r.approval_task_id, 'Approuvé', actor);
    } else if (decision === 'reject') {
      const c = oneLine(comment, 1000);
      if (!c) throw new PortalError('Dites-nous en quelques mots ce qui doit être corrigé.');
      db.prepare('UPDATE pay_runs SET client_comment = ? WHERE id = ?').run(c, r.id);
      setStatus(r, 'hours_received', actor, `Refusée par le client : ${c}`);
      closeTask(r.approval_task_id, `Refusé — ${c}`, actor);
    } else throw new PortalError('Choisissez « J’approuve » ou « Je n’approuve pas ».');
    audit({ userId: actor.id, action: `payroll.${decision}`, target: `pay_run:${r.id}`, clientId: r.client_id, ip });
    return r;
  }

  /* ------------------------------------------------------------ équipe */
  function saveSummary(actor, runId, form, ip) {
    const r = runFor(actor, runId);
    if (!['hours_received', 'validation'].includes(r.status)) throw new PortalError('Le sommaire se saisit une fois les heures reçues.');
    const gross = parseAmount(form.gross); const net = parseAmount(form.net); const remit = parseAmount(form.remit);
    const n = Number(form.employeesPaid);
    if (gross === null || net === null || remit === null) throw new PortalError('Indiquez le brut, le net et les retenues à remettre.');
    if (gross < 0 || net < 0 || remit < 0) throw new PortalError('Les montants ne peuvent pas être négatifs.');
    if (net > gross) throw new PortalError('Le net ne peut pas dépasser le brut.');
    if (!Number.isInteger(n) || n < 1 || n > 999) throw new PortalError('Indiquez le nombre d’employés payés.');
    db.prepare('UPDATE pay_runs SET gross_cents = ?, net_cents = ?, remit_cents = ?, employees_paid = ? WHERE id = ?').run(gross, net, remit, n, r.id);
    if (r.status === 'hours_received') {
      setStatus(r, 'validation', actor, 'Sommaire inscrit ; approbation demandée au client');
      const t = newTask(r, 'approval', `Approuver la paie du ${r.pay_date}`, 'Vérifiez le sommaire de la paie préparée par BVY, puis approuvez-la.', actor);
      db.prepare('UPDATE pay_runs SET approval_task_id = ? WHERE id = ?').run(t, r.id);
    }
    audit({ userId: actor.id, action: 'payroll.summary', target: `pay_run:${r.id}`, clientId: r.client_id, ip });
    return r;
  }

  // Avancer (préparation → prête → terminée), heures reçues hors portail, ou revenir d'une étape avec une raison.
  function move(actor, runId, action, note, ip) {
    const r = runFor(actor, runId);
    const reason = oneLine(note, 300);
    const step = { hours: ['waiting', 'hours_received'], ready: ['preparing', 'ready'], done: ['ready', 'done'] }[action];
    if (step) {
      if (r.status !== step[0]) throw new PortalError(`Cette action n’est pas possible à l’état « ${STATES[r.status]} ».`);
      setStatus(r, step[1], actor, action === 'hours' ? (reason || 'Heures reçues hors du portail') : reason || null);
      if (action === 'hours') closeTask(r.hours_task_id, 'Reçu par BVY', actor);
    } else if (action === 'back') {
      const i = ORDER.indexOf(r.status);
      if (i <= 0 || r.status === 'done') throw new PortalError('Cette paie ne peut pas revenir en arrière.');
      if (!reason) throw new PortalError('Indiquez la raison du retour en arrière.');
      setStatus(r, ORDER[i - 1], actor, `Retour en arrière : ${reason}`);
      if (r.status === 'validation') closeTask(r.approval_task_id, 'Annulé par BVY', actor);
    } else throw new PortalError('Action inconnue.');
    audit({ userId: actor.id, action: `payroll.${action}`, target: `pay_run:${r.id}`, clientId: r.client_id, ip });
    return r;
  }

  /* ------------------------------------------------------------ lectures */
  const events = (runId) => db.prepare('SELECT e.*, u.name AS user_name FROM pay_run_events e LEFT JOIN users u ON u.id = e.user_id WHERE run_id = ? ORDER BY e.id').all(Number(runId));
  function runsForClient(actor, clientId) {
    if (actor.role === 'client') requireClientUser(actor, clientId); else requireStaff(actor, clientId);
    return db.prepare('SELECT * FROM pay_runs WHERE client_id = ? ORDER BY pay_date DESC LIMIT 60').all(Number(clientId)).map(decorate);
  }
  // Écran « Paie » de l'équipe : paies non terminées + terminées depuis 14 jours, clients accessibles seulement.
  function board(actor) {
    if (!canStaff(actor)) throw new PortalError('Accès refusé.');
    const since = addDays(today(), -14);
    const rows = db.prepare(`SELECT r.*, c.name AS client_name FROM pay_runs r JOIN clients c ON c.id = r.client_id
      WHERE (r.status != 'done' OR r.pay_date >= ?) ORDER BY r.pay_date, c.name`).all(since)
      .filter((r) => canAccessClient(db, actor, r.client_id)).map(decorate);
    const day = today();
    for (const r of rows) {
      r.late = r.status !== 'done' && r.status !== 'ready' && addDays(r.pay_date, -1) <= day;
      r.qboUrl = (schedule(r.client_id) || {}).qbo_url || DEFAULT_QBO_PAYROLL;
    }
    return { rows, groups: ORDER.map((st) => ({ status: st, label: STATES[st], rows: rows.filter((r) => r.status === st) })) };
  }
  // Pour l'accueil du client : paies en cours
  const openRunsFor = (clientId) => db.prepare("SELECT * FROM pay_runs WHERE client_id = ? AND status != 'done' ORDER BY pay_date LIMIT 4").all(Number(clientId)).map(decorate);
  const qboUrlFor = (clientId) => (schedule(clientId) || {}).qbo_url || DEFAULT_QBO_PAYROLL;

  return { STATES, FREQ, canStaff, saveSchedule, schedule, addEmployee, setEmployeeActive, employees, ensureRuns, submitHours, decide,
    saveSummary, move, runFor, events, runsForClient, board, openRunsFor, qboUrlFor };
}

module.exports = { createPayroll, nextPayDate, STATES, FREQ, PAYROLL_ROLES };
