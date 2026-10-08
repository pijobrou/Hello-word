'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');

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

const loc = (r) => decodeURIComponent(r.headers.location || '');

test('avis des utilisateurs : client et équipe donnent leur avis, seul l’administrateur les lit et répond', async () => {
  const { app, login, soc } = await setup();
  const db = app.db;
  try {
    const marie = await login('marie@fictive.ca');
    let r = await marie.get('/avis');
    assert.strictEqual(r.status, 200);
    assert.match(r.body, /Votre avis/);
    assert.match(r.body, /href="\/avis"/, 'dans le menu du client');
    r = await marie.post('/avis', { topic: 'difficile', ease: '2', page: 'Documents', message: 'Je ne trouve pas où déposer mes factures.' });
    assert.match(loc(r), /Merci ! Votre avis est bien reçu/);
    r = await marie.post('/avis', { topic: 'nimporte', message: 'x' });
    assert.match(loc(r), /Choisissez le sujet/);
    r = await marie.post('/avis', { topic: 'idee', message: '<script>alert(1)</script> idée' });
    r = await marie.get('/avis');
    assert.match(r.body, /Je ne trouve pas où déposer mes factures/);
    assert.doesNotMatch(r.body, /<script>alert/);
    assert.match(r.body, /Reçu/);
    r = await marie.get('/admin/avis');
    assert.notStrictEqual(r.status, 200, 'le client ne voit pas les avis des autres');

    const lise = await login('lise@bvy.ca');
    r = await lise.post('/avis', { topic: 'bug', message: 'La conciliation est lente.' });
    assert.match(loc(r), /Merci/);
    r = await lise.get('/admin/avis');
    assert.notStrictEqual(r.status, 200);

    const owner = await login('owner@bvy.ca');
    r = await owner.get('/admin/avis');
    assert.strictEqual(r.status, 200);
    assert.match(r.body, /Résidence Fictive inc\. · Marie Client/);
    assert.match(r.body, /Équipe BVY · Lise Comptable/);
    assert.match(r.body, /<b>2,0 \/ 5<\/b>|<b>2 \/ 5<\/b>/);
    assert.match(r.body, /Documents : 1/);
    const id = db.prepare("SELECT id FROM feedback WHERE topic = 'difficile'").get().id;
    r = await owner.post(`/admin/avis/${id}`, { status: 'planned', reply: 'Merci, un bouton « Déposer » sera ajouté sur l’accueil.' });
    assert.match(loc(r), /Avis mis à jour/);
    r = await marie.get('/avis');
    assert.match(r.body, /Réponse de BVY : Merci, un bouton/);
    assert.match(r.body, /Prévu/);
    for (let i = 0; i < 8; i++) await marie.post('/avis', { topic: 'autre', message: `avis ${i}` });
    r = await marie.post('/avis', { topic: 'autre', message: 'un de trop' });
    assert.match(loc(r), /10 avis aujourd’hui/);
    assert.ok(db.prepare("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'feedback.submit'").get().n >= 10);
  } finally { app.close(); }
});
