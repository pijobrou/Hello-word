'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { parseStatement, parseAmount } = require('../lib/statement.js');
const { matchStatement, chequeNo } = require('../lib/reconcile.js');
const { desjardinsPdf, rbcPdf } = require('./pdf-fixture.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const NOW = Date.UTC(2025, 9, 6, 14, 0);
const N = (x) => String(x).replace(/[  ]/g, ' ');

// Relevé FICTIF de type Desjardins (septembre 2025)
const DJ = { opening: 110085, lines: [
  { day: '1 SEP', code: 'DI', desc: 'Dépôt direct / CLIENT FICTIF', amount: 2578534 },
  { day: '1 SEP', code: 'PWW', desc: 'Paiement facture - AccèsD Internet /', more: 'HYDRO ENTREPRISE', amount: -150000 },
  { day: '2 SEP', code: 'RA', desc: 'Câble / VIDEOTRON LTEE', amount: -49294 },
  { day: '4 SEP', code: 'DCN', desc: 'Chèque no 388', amount: -582016 },
  { day: '4 SEP', code: 'DCN', desc: 'Chèque no 389', amount: -2500000 },
  { day: '12 SEP', code: 'CT', desc: 'Dépôt / VENTES DE LA SEMAINE', amount: 310000 },
  { day: '22 SEP', code: 'ACH', desc: 'Achat / RESTO LE GODEFROY', amount: -3677 },
  { day: '30 SEP', code: 'FIX', desc: "Frais fixes d'utilisation", amount: -7050 },
] };

test('relevés : lecture vérifiée par le calcul (formats Desjardins et RBC), lecture fausse signalée', async () => {
  assert.strictEqual(parseAmount('1 100.85'), 110085); assert.strictEqual(parseAmount('377.35-'), -37735);
  assert.strictEqual(parseAmount('$1,234.56'), 123456); assert.strictEqual(parseAmount('(12.00)'), -1200); assert.strictEqual(parseAmount('abc'), null);
  assert.strictEqual(chequeNo('Chèque no 388'), '388'); assert.strictEqual(chequeNo('Cheque #1042'), '1042'); assert.strictEqual(chequeNo('Achat SAQ'), null);

  const dj = await parseStatement(desjardinsPdf(DJ));
  assert.strictEqual(dj.bank, 'Desjardins');
  assert.deepStrictEqual(dj.period, { start: '2025-09-01', end: '2025-09-30' });
  const a = dj.accounts[0];
  assert.strictEqual(a.code, 'EOP'); assert.strictEqual(a.opening, 110085); assert.strictEqual(a.lines.length, 8);
  assert.strictEqual(a.closing, 110085 + DJ.lines.reduce((s, l) => s + l.amount, 0));
  assert.ok(a.check.ok); assert.strictEqual(a.check.balancesChecked, 8);
  assert.strictEqual(a.closing < 0, true, 'solde négatif « 377.35- » compris');
  assert.deepStrictEqual(a.lines[1], { date: '2025-09-01', desc: 'PWW Paiement facture - AccèsD Internet / HYDRO ENTREPRISE', amount: -150000, balance: 110085 + 2578534 - 150000 });

  const bad = await parseStatement(desjardinsPdf({ ...DJ, closingOverride: 12345 }));
  assert.strictEqual(bad.accounts[0].check.ok, false, 'un solde imprimé qui ne balance pas est signalé');

  const rbc = await parseStatement(rbcPdf({ opening: 63138, days: [
    { day: '11 Dec', lines: [{ desc: 'e-Transfer sent FOURNISSEUR', amount: -50000 }, { desc: 'e-Transfer - Autodeposit', more: 'CLIENT A', amount: 5000 }, { desc: 'DEP MC 12431722', amount: 5000 }] },
    { day: '12 Dec', lines: [{ desc: 'DEP VSA12480760', amount: 30000 }, { desc: 'Online Banking transfer - 6023', amount: -23000 }] },
  ] }));
  assert.strictEqual(rbc.bank, 'RBC');
  assert.deepStrictEqual(rbc.period, { start: '2023-12-08', end: '2024-01-08' });
  const r = rbc.accounts[0];
  assert.strictEqual(r.lines.length, 5); assert.strictEqual(r.lines[0].date, '2023-12-11'); assert.strictEqual(r.lines[1].desc, 'e-Transfer - Autodeposit CLIENT A');
  assert.ok(r.check.ok); assert.strictEqual(r.check.summaryOk, true, 'totaux et nombres du sommaire identiques');
});

test('pointage : concordances, regroupement, chèque, écarts seulement', () => {
  const period = { start: '2025-09-01', end: '2025-09-30' };
  const stmt = [
    { date: '2025-09-01', desc: 'Dépôt direct / CLIENT FICTIF', amount: 2578534 },
    { date: '2025-09-02', desc: 'Câble / VIDEOTRON LTEE', amount: -49294 },
    { date: '2025-09-04', desc: 'Chèque no 388', amount: -582016 },
    { date: '2025-09-12', desc: 'Dépôt / VENTES', amount: 310000 },
    { date: '2025-09-22', desc: 'Achat / RESTO LE GODEFROY', amount: -3677 },
  ];
  const q = (id, date, amount, type, name, docNum) => ({ type, id, date, amount, name, memo: null, docNum: docNum || null, url: `https://app.qbo.intuit.com/app/x?txnId=${id}` });
  const ledger = [
    q('1', '2025-08-30', 2578534, 'Dépôt', 'CLIENT FICTIF'),
    q('2', '2025-09-02', -49294, 'Dépense', 'Vidéotron'),
    q('3', '2025-08-28', -580016, 'Chèque', 'Fournisseur', '388'),
    q('4', '2025-09-10', 120000, 'Paiement reçu', 'Client A'), q('5', '2025-09-11', 190000, 'Paiement reçu', 'Client B'),
    q('6', '2025-09-15', -49294, 'Dépense', 'Vidéotron'),
    q('7', '2025-09-29', -100000, 'Chèque', 'Loyer', '390'),
    q('8', '2025-10-03', -5000, 'Dépense', 'Hors période'),
  ];
  const res = matchStatement(stmt, ledger, period);
  assert.strictEqual(res.matched.length, 3, 'dépôt (2 jours d’écart), Vidéotron, dépôt regroupé');
  assert.deepStrictEqual(res.matched.find((m) => m.how === 'group').qbos.map((x) => x.id).sort(), ['4', '5']);
  const kinds = res.exceptions.map((e) => `${e.kind}:${(e.qbo && e.qbo.id) || e.stmt.desc}`);
  assert.deepStrictEqual(kinds, ['missing:Achat / RESTO LE GODEFROY', 'amount:3', 'extra:6', 'outstanding:7']);
  assert.strictEqual(res.exceptions.find((e) => e.kind === 'amount').diff, -2000);
  assert.ok(!kinds.some((k) => k.endsWith(':8')), 'hors période : ignoré');
});

const ledgerCalls = [];
let LEDGER = [];
async function setup() {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-rc-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, sendMail: async (m) => { mails.push(m); }, now: () => NOW, ledger: async (...args) => { ledgerCalls.push(args); return LEDGER; } });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const port = app.address().port;
  function agent() {
    let cookie = ''; let csrf = '';
    function send(method, p, body, type) {
      const h = { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': type, 'Content-Length': body.length, Origin: ORIGIN } : {}) };
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
    const req = (method, p, form) => send(method, p, form ? Buffer.from(new URLSearchParams({ ...form, _csrf: csrf }).toString()) : null, 'application/x-www-form-urlencoded');
    function upload(p, fields, file) {
      const b = '----bvy' + Math.random().toString(16).slice(2);
      const parts = Object.entries({ ...fields, _csrf: csrf }).map(([k, v]) => Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
      parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/pdf\r\n\r\n`), file.data, Buffer.from(`\r\n--${b}--\r\n`));
      return send('POST', p, Buffer.concat(parts), `multipart/form-data; boundary=${b}`);
    }
    return { req, upload, get: (p) => req('GET', p), post: (p, f = {}) => req('POST', p, f) };
  }
  async function login(email) {
    const a = agent();
    await a.get('/connexion');
    await a.req('POST', '/connexion', { email, password: PW });
    await a.get('/verification');
    const r = await a.post('/verification', { method: 'email', code: mails.filter((m) => /code BVY/.test(m.subject)).pop().subject.match(/(\d{6})/)[1] });
    assert.strictEqual(r.headers.location, '/accueil');
    await a.get('/accueil');
    return a;
  }
  const acc = app.accounts;
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('owner@bvy.ca', 'Pierre Owner', 'admin');
  const soc = acc.createClient(admin, 'Résidence Fictive inc.');
  const other = acc.createClient(admin, 'Autre client');
  mk('marie@fictive.ca', 'Marie Client', 'client', soc.id);
  const lise = mk('lise@bvy.ca', 'Lise Comptable', 'bookkeeper');
  acc.setAssignment(admin, lise.id, soc.id, true);
  app.classifier.saveChart(soc.id, [{ Id: '35', Name: 'Desjardins EOP', AccountType: 'Bank' }, { Id: '60', Name: 'Repas', AccountType: 'Expense' }]);
  return { app, login, soc, other };
}

test('conciliation de bout en bout : envoi du PDF, comparaison, écarts, fin, rôles', async () => {
  const { app, login, soc, other } = await setup();
  const db = app.db;
  const q = (id, date, amount, type, name, docNum) => ({ type, id, date, amount, name, memo: null, docNum: docNum || null, url: `https://app.qbo.intuit.com/app/x?txnId=${id}` });
  LEDGER = [q('1', '2025-09-01', 2578534, 'Dépôt', 'CLIENT FICTIF'), q('2', '2025-09-01', -150000, 'Paiement de facture', 'Hydro'),
    q('3', '2025-09-02', -49294, 'Dépense', 'Vidéotron'), q('4', '2025-09-04', -582016, 'Chèque', 'Fournisseur', '388'),
    q('5', '2025-09-04', -2500000, 'Chèque', 'Fournisseur', '389'), q('6', '2025-09-12', 310000, 'Dépôt', 'Ventes'),
    q('7', '2025-09-29', -100000, 'Chèque', 'Loyer', '390')];
  try {
    const owner = await login('owner@bvy.ca');
    let r = await owner.get(`/clients/${soc.id}/conciliation`);
    assert.match(r.body, /Desjardins EOP/);
    r = await owner.upload(`/clients/${soc.id}/conciliation`, { accountId: '35', docId: '' }, { name: 'releve-septembre.pdf', data: desjardinsPdf(DJ) });
    assert.match(r.headers.location || '', /^\/conciliations\/\d+\?ok=/, decodeURIComponent(r.headers.location || ''));
    const rid = Number(r.headers.location.match(/\d+/)[0]);
    assert.deepStrictEqual(ledgerCalls[0].slice(1), ['35', '2025-08-17', '2025-10-15'], 'QuickBooks lu pour la période ± 15 jours');
    const rec = db.prepare('SELECT * FROM reconciliations WHERE id = ?').get(rid);
    assert.strictEqual(rec.method, 'local'); assert.strictEqual(rec.check_ok, 1);
    const res = JSON.parse(rec.result);
    assert.strictEqual(res.matched.length, 6);
    assert.deepStrictEqual(res.exceptions.map((e) => e.kind), ['missing', 'missing', 'outstanding']);
    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(rec.document_id);
    assert.strictEqual(doc.doc_type, 'releve_banque'); assert.strictEqual(doc.filed, 1);

    r = await owner.get(`/conciliations/${rid}`);
    assert.match(N(r.body), /Relevé lu et vérifié : 1 100,85 \$ \+ dépôts/);
    assert.match(r.body, /Au relevé, pas dans QuickBooks[\s\S]*RESTO LE GODEFROY/);
    assert.match(r.body, /Frais fixes d&#39;utilisation|Frais fixes d’utilisation|Frais fixes d'utilisation/);
    assert.match(r.body, /En circulation[\s\S]*Loyer/);
    assert.match(r.body, /Voir les 6 opérations qui concordent/);
    assert.doesNotMatch(r.body.replace(/<[^>]+>/g, ' '), /\bIA\b|[Cc]laude|intelligence artificielle/);

    // Terminer : refusé tant que des écarts restent ; « en circulation » peut rester
    r = await owner.post(`/conciliations/${rid}/terminer`);
    assert.match(decodeURIComponent(r.headers.location), /Il reste 2 écarts/);
    for (const e of res.exceptions.filter((x) => x.kind === 'missing')) await owner.post(`/conciliations/${rid}/ligne`, { key: e.key, done: '1' });
    r = await owner.post(`/conciliations/${rid}/terminer`);
    assert.match(decodeURIComponent(r.headers.location), /Conciliation terminée/);
    assert.strictEqual(db.prepare('SELECT status FROM reconciliations WHERE id = ?').get(rid).status, 'done');

    // Relevé illisible : refusé proprement
    r = await owner.upload(`/clients/${soc.id}/conciliation`, { accountId: '35', docId: '' }, { name: 'pas-un-releve.pdf', data: Buffer.from('%PDF-1.4\n%vide\n') });
    assert.match(decodeURIComponent(r.headers.location || ''), /n’a pas pu être lu/);

    // Rôles et isolation
    const lise = await login('lise@bvy.ca');
    r = await lise.get(`/conciliations/${rid}`);
    assert.strictEqual(r.status, 200);
    db.prepare('DELETE FROM client_assignments').run();
    r = await lise.get(`/conciliations/${rid}`);
    assert.strictEqual(r.status, 403);
    const marie = await login('marie@fictive.ca');
    r = await marie.get(`/conciliations/${rid}`);
    assert.notStrictEqual(r.status, 200);
    r = await owner.post(`/clients/${other.id}/conciliation`, { accountId: '35', docId: String(rec.document_id) });
    assert.match(decodeURIComponent(r.headers.location || ''), /n’appartient pas à ce client|compte bancaire/);
  } finally { app.close(); }
});
