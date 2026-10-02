'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { nextPayDate } = require('../lib/payroll.js');
const { sniff } = require('../lib/portal.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const NOW = Date.UTC(2026, 9, 2, 15, 0); // 2026-10-02

test('paie : dates du calendrier (hebdo, aux 2 semaines, 15 et fin de mois, mensuelle) ; feuille de temps Excel acceptée', () => {
  assert.strictEqual(nextPayDate('2026-10-02', 'weekly'), '2026-10-09');
  assert.strictEqual(nextPayDate('2026-10-02', 'biweekly'), '2026-10-16');
  assert.strictEqual(nextPayDate('2026-10-15', 'semimonthly'), '2026-10-31');
  assert.strictEqual(nextPayDate('2026-10-31', 'semimonthly'), '2026-11-15');
  assert.strictEqual(nextPayDate('2026-12-31', 'semimonthly'), '2027-01-15');
  assert.strictEqual(nextPayDate('2026-01-31', 'monthly'), '2026-02-28');
  const xlsx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('....[Content_Types].xml....xl/workbook.xml')]);
  assert.strictEqual(sniff(xlsx).ext, 'xlsx');
  assert.strictEqual(sniff(Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('word/document.xml')])), null, 'un autre ZIP est refusé');
});

async function setup() {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-paie-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, sendMail: async (m) => { mails.push(m); }, now: () => NOW });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const port = app.address().port;
  function agent() {
    let cookie = ''; let csrf = '';
    function req(method, p, form) {
      const body = form ? Buffer.from(new URLSearchParams({ ...form, _csrf: csrf }).toString()) : null;
      const h = { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': body.length, Origin: ORIGIN } : {}) };
      return new Promise((resolve, reject) => {
        const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: h }, (res) => {
          const chunks = []; res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const sc = res.headers['set-cookie'];
            if (sc) { const m = String(sc[0]).match(/__Host-bvy_session=([^;]*)/); cookie = m && m[1] ? `__Host-bvy_session=${m[1]}` : ''; }
            const text = Buffer.concat(chunks).toString('utf8');
            const m = text.match(/name="_csrf" value="([^"]+)"/); if (m) csrf = m[1];
            resolve({ status: res.statusCode, headers: res.headers, body: text });
          });
        });
        r.on('error', reject); if (body) r.write(body); r.end();
      });
    }
    return { req, get: (p) => req('GET', p), post: (p, f = {}) => req('POST', p, f) };
  }
  async function login(email) {
    const a = agent();
    await a.get('/connexion');
    await a.req('POST', '/connexion', { email, password: PW });
    await a.get('/verification');
    const r = await a.post('/verification', { method: 'email', code: mails[mails.length - 1].subject.match(/(\d{6})/)[1] });
    assert.strictEqual(r.headers.location, '/accueil');
    await a.get('/accueil');
    return a;
  }
  const acc = app.accounts;
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('owner@bvy.ca', 'Pierre Owner', 'admin');
  const boreal = acc.createClient(admin, 'Atelier Boréal inc.');
  const autre = acc.createClient(admin, 'Autre inc.');
  app.workqueue.saveProfile(admin, boreal.id, { kind: 'entreprise', payroll: '1', gstFreq: 'quarterly' });
  app.workqueue.saveProfile(admin, autre.id, { kind: 'entreprise', payroll: '1' });
  mk('marie@boreal.ca', 'Marie Tremblay', 'client', boreal.id);
  mk('paul@autre.ca', 'Paul Autre', 'client', autre.id);
  const paie = mk('paie@bvy.ca', 'Paula Paie', 'payroll');
  acc.setAssignment(admin, paie.id, boreal.id, true);
  mk('julie@bvy.ca', 'Julie Livres', 'bookkeeper');
  mk('tax@bvy.ca', 'Théo Fiscal', 'tax');
  return { app, db: app.db, mails, login, boreal, autre };
}

test('paie de bout en bout : calendrier, heures du client, sommaire, approbation, refus, états, accès', async () => {
  const t = await setup();
  try {
    const staff = await t.login('paie@bvy.ca');
    // Calendrier : paie aux 2 semaines le 2026-10-05, heures demandées 3 jours avant ; deux employés
    await staff.get(`/clients/${t.boreal.id}/paie`);
    await staff.post(`/clients/${t.boreal.id}/paie/employes`, { name: 'Luc Gagnon', payType: 'hourly' });
    await staff.post(`/clients/${t.boreal.id}/paie/employes`, { name: 'Sara Roy', payType: 'salary' });
    const mailsBefore = t.mails.length;
    let r = await staff.post(`/clients/${t.boreal.id}/paie/calendrier`, { frequency: 'biweekly', nextPayDate: '2026-10-05', leadDays: '3' });
    assert.match(decodeURIComponent(r.headers.location), /Calendrier de paie enregistré/);
    const run = t.db.prepare('SELECT * FROM pay_runs WHERE client_id = ?').get(t.boreal.id);
    assert.strictEqual(run.pay_date, '2026-10-05');
    assert.strictEqual(run.status, 'waiting');
    assert.strictEqual(t.db.prepare('SELECT next_pay_date FROM payroll_schedules WHERE client_id = ?').get(t.boreal.id).next_pay_date, '2026-10-19');
    assert.ok(t.mails.slice(mailsBefore).some((m) => m.to[0] === 'marie@boreal.ca' && /heures de paie pour la paie du 2026-10-05/.test(m.subject)));
    t.app.payrollTick(); t.app.payrollTick();
    assert.strictEqual(t.db.prepare('SELECT COUNT(*) AS n FROM pay_runs').get().n, 1, 'aucune paie en double');

    // Tenue de livres, fiscalité et un autre client n'ont pas accès
    for (const who of ['julie@bvy.ca', 'tax@bvy.ca']) {
      const a = await t.login(who);
      assert.strictEqual((await a.get('/paie')).status, 403, who);
      assert.strictEqual((await a.get(`/paie/${run.id}`)).status, 403, who);
      assert.ok(!/href="\/paie"/.test((await a.get('/accueil')).body), `${who} : pas de menu Paie`);
    }
    const paul = await t.login('paul@autre.ca');
    assert.strictEqual((await paul.get(`/paie/${run.id}`)).status, 403);

    // Le client : tâche « Heures de paie » qui mène à la fiche, saisie des heures
    const marie = await t.login('marie@boreal.ca');
    const todo = await marie.get('/a-faire');
    assert.match(todo.body, /Heures de paie — paie du 2026-10-05[\s\S]*href="\/paie\/\d+">Entrer les heures/);
    const page = await marie.get(`/paie/${run.id}`);
    assert.match(page.body, /Luc Gagnon[\s\S]*Sara Roy/);
    r = await marie.post(`/paie/${run.id}/heures`, {});
    assert.match(decodeURIComponent(r.headers.location), /au moins un employé/);
    await marie.get(`/paie/${run.id}`);
    const luc = t.db.prepare("SELECT id FROM employees WHERE name = 'Luc Gagnon'").get().id;
    r = await marie.post(`/paie/${run.id}/heures`, { [`reg_${luc}`]: '40', [`ot_${luc}`]: '2,5', note: 'Prime de 100 $ pour Luc' });
    assert.match(decodeURIComponent(r.headers.location), /vos heures sont envoyées/);
    let row = t.db.prepare('SELECT * FROM pay_runs WHERE id = ?').get(run.id);
    assert.strictEqual(row.status, 'hours_received');
    assert.deepStrictEqual(JSON.parse(row.hours).lines.map((l) => [l.name, l.regular, l.overtime]), [['Luc Gagnon', 40, 2.5]]);
    assert.strictEqual(t.db.prepare('SELECT status FROM tasks WHERE id = ?').get(row.hours_task_id).status, 'done');

    // Transition impossible refusée
    await staff.get(`/paie/${run.id}`);
    r = await staff.post(`/paie/${run.id}/etat`, { action: 'ready' });
    assert.match(decodeURIComponent(r.headers.location), /pas possible à l’état « Heures reçues »/);

    // L'équipe inscrit le sommaire → validation, tâche d'approbation, courriel sans montant
    await staff.get(`/paie/${run.id}`);
    r = await staff.post(`/paie/${run.id}/sommaire`, { gross: '1 980,00', net: '1 512,40', remit: '702,15', employeesPaid: '2' });
    assert.match(decodeURIComponent(r.headers.location), /approuver la paie/);
    row = t.db.prepare('SELECT * FROM pay_runs WHERE id = ?').get(run.id);
    assert.strictEqual(row.status, 'validation');
    assert.strictEqual(row.gross_cents, 198000);
    const mail = t.mails.find((m) => /prête à approuver/.test(m.subject));
    assert.ok(mail && !/1\s?980|1\s?512/.test(mail.text), 'avis sans montant');

    // Le client refuse (commentaire obligatoire), l'équipe corrige, le client approuve
    await marie.get(`/paie/${run.id}`);
    r = await marie.post(`/paie/${run.id}/decision`, { decision: 'reject' });
    assert.match(decodeURIComponent(r.headers.location), /Dites-nous/);
    await marie.get(`/paie/${run.id}`);
    await marie.post(`/paie/${run.id}/decision`, { decision: 'reject', comment: 'Il manque la prime de Luc' });
    assert.strictEqual(t.db.prepare('SELECT status FROM pay_runs WHERE id = ?').get(run.id).status, 'hours_received');
    await staff.get(`/paie/${run.id}`);
    // Détail recopié de QuickBooks Paie : le portail fait les totaux (ARC, Revenu Québec, coût, date de versement)
    await staff.post(`/paie/${run.id}/sommaire`, { gross: '2 080,00', net: '1 590,00', employeesPaid: '2',
      fedTax: '180,00', qcTax: '200,00', qppEe: '70,00', eiEe: '25,00', qpipEe: '15,00',
      qppEr: '70,00', eiEr: '35,00', qpipEr: '21,00', fss: '34,00', cnt: '1,50', cnesst: '30,00', vacation: '83,20' });
    row = t.db.prepare('SELECT * FROM pay_runs WHERE id = ?').get(run.id);
    assert.strictEqual(row.remit_cents, 24000 + 44150, 'ARC 240,00 + Revenu Québec 441,50');
    const sheet = await staff.get(`/paie/${run.id}`);
    assert.match(sheet.body, /À remettre d’ici le 2026-11-16<\/dt><dd>681,50\s\$<\/dd><span>ARC 240,00\s\$ · Revenu Québec 441,50\s\$/);
    assert.match(sheet.body, /Coût total pour l’entreprise<\/dt><dd>2\s271,50\s\$/);
    assert.match(sheet.body, /Cotisation CNESST[\s\S]*?30,00\s\$/);
    assert.match(sheet.body, /Vacances versées sur cette paie[\s\S]*?83,20\s\$/);
    assert.ok(!/Écart de/.test(sheet.body), 'brut − retenues = net : pas d’écart');
    const view = await marie.get(`/paie/${run.id}`);
    assert.match(view.body, /Ce que cette paie coûte à l’entreprise<\/dt><dd>2\s271,50\s\$[\s\S]*J’approuve/);
    assert.ok(!/Écart de/.test(view.body));
    await marie.post(`/paie/${run.id}/decision`, { decision: 'approve' });
    assert.strictEqual(t.db.prepare('SELECT status FROM pay_runs WHERE id = ?').get(run.id).status, 'preparing');

    // Prête, puis retour en arrière (raison obligatoire), puis prête et terminée
    await staff.get(`/paie/${run.id}`);
    await staff.post(`/paie/${run.id}/etat`, { action: 'ready' });
    await staff.get(`/paie/${run.id}`);
    r = await staff.post(`/paie/${run.id}/etat`, { action: 'back', note: '' });
    assert.match(decodeURIComponent(r.headers.location), /raison/);
    await staff.get(`/paie/${run.id}`);
    await staff.post(`/paie/${run.id}/etat`, { action: 'back', note: 'Taux de vacances à revoir' });
    assert.strictEqual(t.db.prepare('SELECT status FROM pay_runs WHERE id = ?').get(run.id).status, 'preparing');
    await staff.get(`/paie/${run.id}`);
    await staff.post(`/paie/${run.id}/etat`, { action: 'ready' });
    await staff.get(`/paie/${run.id}`);
    await staff.post(`/paie/${run.id}/etat`, { action: 'done' });
    assert.strictEqual(t.db.prepare('SELECT status FROM pay_runs WHERE id = ?').get(run.id).status, 'done');

    // Historique complet et écran « Paie »
    const ev = t.db.prepare('SELECT to_status FROM pay_run_events WHERE run_id = ? ORDER BY id').all(run.id).map((e) => e.to_status);
    assert.deepStrictEqual(ev, ['waiting', 'hours_received', 'validation', 'hours_received', 'validation', 'preparing', 'ready', 'preparing', 'ready', 'done']);
    const board = await staff.get('/paie');
    assert.match(board.body, /Atelier Boréal inc\.[\s\S]*2026-10-05[\s\S]*Terminée/);
    assert.ok(!/Autre inc\./.test(board.body), 'paie : seulement les clients assignés');
    const detail = await staff.get(`/paie/${run.id}`);
    assert.match(detail.body, /Taux de vacances à revoir/);
    assert.match(detail.body, /app\.qbo\.intuit\.com\/app\/payroll/);

    // Cumul de l'année (base des T4/RL-1) et production de fin d'année dans l'onglet Paie
    const tab = await staff.get(`/clients/${t.boreal.id}/paie`);
    assert.match(tab.body, /Cumul 2026[\s\S]*Salaires bruts<\/dt><dd>2\s080,00\s\$[\s\S]*Remis à l’ARC<\/dt><dd>240,00\s\$/);
    assert.match(tab.body, /Feuillets T4 et RL-1 2026 et sommaires[\s\S]*CNESST — déclaration des salaires 2026/);
    // Départ d'un employé : relevé d'emploi à produire dans les 5 jours
    const sara = t.db.prepare("SELECT id FROM employees WHERE name = 'Sara Roy'").get().id;
    await staff.post(`/clients/${t.boreal.id}/paie/employes/${sara}/desactiver`);
    assert.deepStrictEqual(t.db.prepare('SELECT title, due_date FROM custom_deadlines WHERE client_id = ?').all(t.boreal.id).map((d) => [d.title, d.due_date]), [['Relevé d’emploi (RE) de Sara Roy', '2026-10-07']]);
    // Un écart entre brut − retenues et net est signalé à l'équipe
    const r2 = t.app.payroll;
    t.db.prepare("INSERT INTO pay_runs (client_id, pay_date, status, created_at, updated_at) VALUES (?, '2026-10-19', 'hours_received', '2026-10-02', '2026-10-02')").run(t.boreal.id);
    const run2 = t.db.prepare("SELECT id FROM pay_runs WHERE pay_date = '2026-10-19'").get().id;
    await staff.get(`/paie/${run2}`);
    await staff.post(`/paie/${run2}/sommaire`, { gross: '1000', net: '900', fedTax: '50', employeesPaid: '1' });
    assert.match((await staff.get(`/paie/${run2}`)).body, /Écart de 50,00\s\$/);
    void r2;

    // Calendrier refusé pour un client sans employés ; lien QuickBooks hors intuit.com refusé
    t.db.prepare('UPDATE clients SET payroll = 0 WHERE id = ?').run(t.autre.id);
    const admin = await t.login('owner@bvy.ca');
    await admin.get(`/clients/${t.autre.id}/paie`);
    r = await admin.post(`/clients/${t.autre.id}/paie/calendrier`, { frequency: 'weekly', nextPayDate: '2026-10-09' });
    assert.match(decodeURIComponent(r.headers.location), /A des employés/);
    await admin.get(`/clients/${t.boreal.id}/paie`);
    r = await admin.post(`/clients/${t.boreal.id}/paie/calendrier`, { frequency: 'weekly', nextPayDate: '2026-10-09', qboUrl: 'https://exemple.com/paie' });
    assert.match(decodeURIComponent(r.headers.location), /intuit\.com/);
  } finally { t.app.close(); }
});
