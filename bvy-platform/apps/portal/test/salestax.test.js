'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { periodFor, taxTotals } = require('../lib/salestax.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const NOW = Date.UTC(2026, 9, 2, 15, 0); // 2026-10-02

test('TPS/TVQ : périodes (mensuelle, trimestrielle, annuelle) et calcul des montants nets avec contrôles', () => {
  assert.deepStrictEqual(periodFor('taxes:2026-09', 'quarterly'), { start: '2026-07-01', end: '2026-09-30', label: 'Trimestre terminé le 2026-09-30' });
  assert.deepStrictEqual(periodFor('taxes:2026-02', 'monthly'), { start: '2026-02-01', end: '2026-02-28', label: 'Mois de 2026-02' });
  assert.strictEqual(periodFor('taxes:2026-03-31', 'annual').start, '2025-04-01');
  assert.strictEqual(periodFor('taxes:2025', 'annual').end, '2025-12-31');
  const t = taxTotals({ sales_cents: 10000000, gst_cents: 500000, itc_cents: 120000, qst_cents: 997500, itr_cents: 200000 });
  assert.deepStrictEqual([t.netGst, t.netQst, t.net, t.checks.length], [380000, 797500, 1177500, 0]);
  const refund = taxTotals({ sales_cents: 100000, gst_cents: 5000, itc_cents: 9000, qst_cents: 9975, itr_cents: 15000 });
  assert.strictEqual(refund.net, -9025, 'remboursement');
  assert.strictEqual(taxTotals({ sales_cents: 10000000, gst_cents: 200000, itc_cents: 0, qst_cents: 997500, itr_cents: 0 }).checks.length, 1, 'TPS à 2 % des ventes signalée');
});

async function setup() {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-tax-'));
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
  app.workqueue.saveProfile(admin, boreal.id, { kind: 'entreprise', yearEndMonth: '12', gstFreq: 'quarterly' });
  app.workqueue.saveProfile(admin, autre.id, { kind: 'particulier' });
  mk('marie@boreal.ca', 'Marie Tremblay', 'client', boreal.id);
  const julie = mk('julie@bvy.ca', 'Julie Livres', 'bookkeeper');
  acc.setAssignment(admin, julie.id, boreal.id, true);
  mk('lea@bvy.ca', 'Léa Lead', 'lead');
  mk('paie@bvy.ca', 'Paula Paie', 'payroll');
  return { app, db: app.db, mails, login, boreal, autre };
}

test('TPS/TVQ de bout en bout : blocage par la tenue de livres, validation, calcul, révision, approbation, production', async () => {
  const t = await setup();
  try {
    t.app.payrollTick(); t.app.payrollTick();
    const rows = t.db.prepare('SELECT * FROM tax_returns').all();
    assert.deepStrictEqual(rows.map((r) => [r.client_id, r.deadline_key, r.period_start, r.period_end, r.due_date, r.status]),
      [[t.boreal.id, 'taxes:2026-09', '2026-07-01', '2026-09-30', '2026-11-02', 'books']], 'une seule déclaration : le trimestre terminé, pas le particulier');
    const id = rows[0].id;

    // Paie : pas d'accès ; tenue de livres assignée : accès
    const paie = await t.login('paie@bvy.ca');
    assert.strictEqual((await paie.get('/tps-tvq')).status, 403);
    assert.strictEqual((await paie.get(`/tps-tvq/${id}`)).status, 403);
    const julie = await t.login('julie@bvy.ca');
    let board = await julie.get('/tps-tvq');
    assert.match(board.body, /Atelier Boréal inc\.[\s\S]*Trimestre terminé le 2026-09-30[\s\S]*Bloquée : tenue de livres pas à jour/);

    // Blocage : la tenue de livres n'est pas « À jour »
    await julie.get(`/tps-tvq/${id}`);
    let r = await julie.post(`/tps-tvq/${id}/etape`, { action: 'books' });
    assert.match(decodeURIComponent(r.headers.location), /n’est pas « À jour »/);
    assert.strictEqual(t.db.prepare('SELECT status FROM tax_returns WHERE id = ?').get(id).status, 'books');
    await julie.post(`/clients/${t.boreal.id}/tenue`, { status: 'done' });
    await julie.get(`/tps-tvq/${id}`);
    await julie.post(`/tps-tvq/${id}/etape`, { action: 'books' });
    // Validation comptable : toute la liste est exigée
    await julie.get(`/tps-tvq/${id}`);
    r = await julie.post(`/tps-tvq/${id}/etape`, { action: 'validate', chk_bank: '1', chk_uncat: '1' });
    assert.match(decodeURIComponent(r.headers.location), /Validation incomplète/);
    await julie.get(`/tps-tvq/${id}`);
    await julie.post(`/tps-tvq/${id}/etape`, { action: 'validate', chk_bank: '1', chk_uncat: '1', chk_codes: '1', chk_docs: '1' });
    assert.strictEqual(t.db.prepare('SELECT status FROM tax_returns WHERE id = ?').get(id).status, 'calc');

    // Calcul : montants du rapport de taxes de QuickBooks
    await julie.get(`/tps-tvq/${id}`);
    await julie.post(`/tps-tvq/${id}/montants`, { sales: '100 000,00', gst: '5 000,00', itc: '1 200,00', qst: '9 975,00', itr: '2 000,00' });
    let sheet = await julie.get(`/tps-tvq/${id}`);
    assert.match(sheet.body, /TPS — à payer à l’ARC<\/dt><dd>3\s800,00\s\$/);
    assert.match(sheet.body, /TVQ — à payer à Revenu Québec<\/dt><dd>7\s975,00\s\$/);
    assert.match(sheet.body, /Total à payer d’ici le 2026-11-02<\/dt><dd>11\s775,00\s\$/);
    assert.match(sheet.body, /Vous avez préparé cette déclaration/);

    // Produire avant l'approbation du client : refusé
    await julie.post(`/tps-tvq/${id}/etape`, { action: 'reviewed' });
    sheet = await julie.get(`/tps-tvq/${id}`);
    r = await julie.post(`/tps-tvq/${id}/etape`, { action: 'filed' });
    assert.match(decodeURIComponent(r.headers.location), /approuvée par le client avant/);
    assert.ok(t.mails.some((m) => m.to[0] === 'marie@boreal.ca' && /TPS\/TVQ est prête à approuver/.test(m.subject) && !/11\s?775/.test(m.text)));

    // Le client refuse, puis approuve après correction
    const marie = await t.login('marie@boreal.ca');
    const todo = await marie.get('/a-faire');
    assert.match(todo.body, /Approuver votre déclaration de TPS\/TVQ \(trimestre terminé le 2026-09-30\)[\s\S]*href="\/tps-tvq\/\d+">Voir et approuver/);
    await marie.get(`/tps-tvq/${id}`);
    r = await marie.post(`/tps-tvq/${id}/decision`, { decision: 'reject' });
    assert.match(decodeURIComponent(r.headers.location), /Dites-nous/);
    await marie.get(`/tps-tvq/${id}`);
    await marie.post(`/tps-tvq/${id}/decision`, { decision: 'reject', comment: 'La vente à l’Ontario est détaxée' });
    assert.strictEqual(t.db.prepare('SELECT status FROM tax_returns WHERE id = ?').get(id).status, 'review');
    const lea = await t.login('lea@bvy.ca');
    sheet = await lea.get(`/tps-tvq/${id}`);
    assert.match(sheet.body, /Le client a refusé les montants[\s\S]*Ontario/);
    await lea.post(`/tps-tvq/${id}/etape`, { action: 'reviewed' });
    await marie.get(`/tps-tvq/${id}`);
    await marie.post(`/tps-tvq/${id}/decision`, { decision: 'approve' });
    assert.strictEqual(t.db.prepare('SELECT client_approved FROM tax_returns WHERE id = ?').get(id).client_approved, 1);
    assert.strictEqual((await marie.post(`/tps-tvq/${id}/decision`, { decision: 'approve' })).status, 303);

    // Produite : l'échéance de TPS/TVQ du trimestre est faite au tableau de bord
    await lea.get(`/tps-tvq/${id}`);
    await lea.post(`/tps-tvq/${id}/etape`, { action: 'filed', confirmation: 'GST-2026-0042' });
    const row = t.db.prepare('SELECT status, confirmation FROM tax_returns WHERE id = ?').get(id);
    assert.deepStrictEqual([row.status, row.confirmation], ['filed', 'GST-2026-0042']);
    assert.strictEqual(t.db.prepare("SELECT status FROM deadline_marks WHERE client_id = ? AND key = 'taxes:2026-09'").get(t.boreal.id).status, 'done');
    const home = await lea.get('/accueil');
    const line = home.body.slice(home.body.indexOf('Atelier Boréal inc.'), home.body.indexOf('</tr>', home.body.indexOf('Atelier Boréal inc.')));
    assert.match(line, /TPS\/TVQ — trimestre terminé le 2026-12-31/, 'le tableau de bord passe au trimestre suivant');
    const ev = t.db.prepare('SELECT to_status FROM tax_return_events WHERE return_id = ? ORDER BY id').all(id).map((e) => e.to_status);
    assert.deepStrictEqual(ev, ['books', 'validation', 'calc', 'review', 'approval', 'review', 'approval', 'approval', 'filed']);
    // Onglet du dossier et menu
    assert.match((await lea.get(`/clients/${t.boreal.id}/tps-tvq`)).body, /GST-2026-0042/);
    assert.match(home.body, /href="\/tps-tvq"/);
  } finally { t.app.close(); }
});
