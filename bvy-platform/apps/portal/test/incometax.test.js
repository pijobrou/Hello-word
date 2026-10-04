'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { pathFor, balance } = require('../lib/incometax.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const NOW = Date.UTC(2027, 1, 10, 15, 0); // 2027-02-10, saison des impôts
const PDF = Buffer.from('%PDF-1.4\n% feuillet T4\n');

test('impôts : chemins par type de client et calcul du solde', () => {
  assert.deepStrictEqual(pathFor('t2', 'entreprise'), ['books', 'closing', 'prep', 'review', 'approval', 'filed']);
  assert.deepStrictEqual(pathFor('t1', 'autonome'), ['docs', 'books', 'prep', 'review', 'approval', 'filed']);
  assert.deepStrictEqual(pathFor('t1', 'particulier'), ['docs', 'prep', 'review', 'approval', 'filed']);
  assert.strictEqual(balance({ figures: { fedTax: 620000, qcTax: 710000, paid: 1400000 } }), -70000);
  assert.strictEqual(balance({ figures: {} }), null);
});

async function setup() {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-it-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, sendMail: async (m) => { mails.push(m); }, now: () => NOW });
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
      const b = '----bvy' + Date.now();
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
    const r = await a.post('/verification', { method: 'email', code: mails[mails.length - 1].subject.match(/(\d{6})/)[1] });
    assert.strictEqual(r.headers.location, '/accueil');
    await a.get('/accueil');
    return a;
  }
  const acc = app.accounts;
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('owner@bvy.ca', 'Pierre Owner', 'admin');
  const soc = acc.createClient(admin, 'Atelier Boréal inc.');
  const jean = acc.createClient(admin, 'Jean Tremblay');
  app.workqueue.saveProfile(admin, soc.id, { kind: 'entreprise', yearEndMonth: '6' });
  app.workqueue.saveProfile(admin, jean.id, { kind: 'particulier' });
  app.db.prepare("UPDATE clients SET profile_since = '2026-06-01'").run();
  mk('marie@boreal.ca', 'Marie Bouchard', 'client', soc.id);
  mk('jean@tremblay.ca', 'Jean Tremblay', 'client', jean.id);
  mk('theo@bvy.ca', 'Théo Fiscal', 'tax');
  const julie = mk('julie@bvy.ca', 'Julie Livres', 'bookkeeper');
  acc.setAssignment(admin, julie.id, soc.id, true);
  const theo = acc.userByEmail('theo@bvy.ca');
  acc.setAssignment(admin, theo.id, soc.id, true); acc.setAssignment(admin, theo.id, jean.id, true);
  return { app, db: app.db, mails, login, soc, jean };
}

test('impôts de bout en bout : T1 d’un particulier (documents) et T2/CO-17 d’une société (fermeture), approbation, production', async () => {
  const t = await setup();
  try {
    t.app.payrollTick(); t.app.payrollTick();
    const files = t.db.prepare('SELECT * FROM tax_files ORDER BY id').all();
    assert.deepStrictEqual(files.map((f) => [f.client_id, f.form, f.deadline_key, f.status, f.due_date]),
      [[t.soc.id, 't2', 't2:2026-06-30', 'books', '2026-12-31'], [t.jean.id, 't1', 't1:2026', 'docs', '2027-04-30']]);
    const t2 = files[0].id; const t1 = files[1].id;
    assert.ok(t.mails.some((m) => m.to[0] === 'jean@tremblay.ca' && /documents pour vos impôts \(année 2026\)/.test(m.subject)));

    // Rôles : tenue de livres n'a pas accès aux impôts
    const julie = await t.login('julie@bvy.ca');
    assert.strictEqual((await julie.get('/impots')).status, 403);
    assert.strictEqual((await julie.get(`/impots/${t2}`)).status, 403);

    /* ---- T1 du particulier : documents */
    const jean = await t.login('jean@tremblay.ca');
    assert.match((await jean.get('/a-faire')).body, /Documents pour vos impôts 2026[\s\S]*href="\/impots\/\d+">Envoyer mes documents/);
    let page = await jean.get(`/impots/${t1}`);
    assert.match(page.body, /Feuillets T4 et RL-1 \(emploi\)/);
    assert.match(page.body, /J’ai tout envoyé<\/button>/);
    let r = await jean.upload(`/impots/${t1}/document`, { item: 't4' }, { name: 'T4-2025.pdf', data: PDF });
    assert.match(decodeURIComponent(r.headers.location), /Document reçu/);
    await jean.get(`/impots/${t1}`);
    r = await jean.post(`/impots/${t1}/envoye`);
    assert.match(decodeURIComponent(r.headers.location), /Il reste 10 documents/);
    const keys = JSON.parse(t.db.prepare('SELECT docs FROM tax_files WHERE id = ?').get(t1).docs).filter((d) => d.status === 'pending').map((d) => d.k);
    for (const k of keys) { await jean.get(`/impots/${t1}`); await jean.post(`/impots/${t1}/document`, { item: k, status: 'na' }); }
    await jean.get(`/impots/${t1}`);
    await jean.post(`/impots/${t1}/envoye`);
    let row = t.db.prepare('SELECT * FROM tax_files WHERE id = ?').get(t1);
    assert.strictEqual(row.status, 'prep', 'particulier : pas d’étape de tenue de livres');
    assert.strictEqual(JSON.parse(row.docs).find((d) => d.k === 't4').status, 'received');
    assert.strictEqual(t.db.prepare('SELECT status FROM tasks WHERE id = ?').get(row.docs_task_id).status, 'done');

    // Préparation, révision, approbation, production
    const theo = await t.login('theo@bvy.ca');
    await theo.get(`/impots/${t1}`);
    await theo.post(`/impots/${t1}/montants`, { income: '52 000', fedTax: '6 200', qcTax: '7 100', paid: '14 000' });
    page = await theo.get(`/impots/${t1}`);
    assert.match(page.body, /Remboursement prévu<\/dt><dd>700,00\s\$/);
    await theo.post(`/impots/${t1}/etape`, { action: 'reviewed' });
    await jean.get(`/impots/${t1}`);
    r = await jean.post(`/impots/${t1}/decision`, { decision: 'approve' });
    assert.match(decodeURIComponent(r.headers.location), /approuvées/);
    await theo.get(`/impots/${t1}`);
    await theo.post(`/impots/${t1}/etape`, { action: 'filed', confirmationFed: 'T1-778899', confirmationQc: 'TP1-445566' });
    assert.strictEqual(t.db.prepare("SELECT status FROM deadline_marks WHERE client_id = ? AND key = 't1:2026'").get(t.jean.id).status, 'done');

    /* ---- T2/CO-17 de la société : blocage, fermeture, approbation */
    await theo.get(`/impots/${t2}`);
    r = await theo.post(`/impots/${t2}/etape`, { action: 'books' });
    assert.match(decodeURIComponent(r.headers.location), /n’est pas « À jour »/);
    await julie.get('/accueil');
    await julie.post(`/clients/${t.soc.id}/tenue`, { status: 'done' });
    await theo.get(`/impots/${t2}`);
    await theo.post(`/impots/${t2}/etape`, { action: 'books' });
    await theo.get(`/impots/${t2}`);
    r = await theo.post(`/impots/${t2}/etape`, { action: 'closing', chk_bank: '1', chk_cca: '1' });
    assert.match(decodeURIComponent(r.headers.location), /Fermeture incomplète/);
    await theo.get(`/impots/${t2}`);
    await theo.post(`/impots/${t2}/etape`, { action: 'closing', chk_bank: '1', chk_cca: '1', chk_recon: '1', chk_fs: '1' });
    await theo.get(`/impots/${t2}`);
    await theo.post(`/impots/${t2}/montants`, { bookIncome: '84 300', taxable: '80 100', fedTax: '7 209', qcTax: '2 563,20', paid: '6 000' });
    page = await theo.get(`/impots/${t2}`);
    assert.match(page.body, /Solde à payer d’ici le 2026-08-31<\/dt><dd>3\s772,20\s\$/);
    r = await theo.post(`/impots/${t2}/etape`, { action: 'filed' });
    assert.match(decodeURIComponent(r.headers.location), /approuvées par le client avant/);
    await theo.get(`/impots/${t2}`);
    await theo.post(`/impots/${t2}/etape`, { action: 'reviewed' });
    const marie = await t.login('marie@boreal.ca');
    await marie.get(`/impots/${t2}`);
    await marie.post(`/impots/${t2}/decision`, { decision: 'reject', comment: 'Il manque le véhicule' });
    assert.strictEqual(t.db.prepare('SELECT status FROM tax_files WHERE id = ?').get(t2).status, 'review');
    await theo.get(`/impots/${t2}`);
    await theo.post(`/impots/${t2}/etape`, { action: 'reviewed' });
    await marie.get(`/impots/${t2}`);
    await marie.post(`/impots/${t2}/decision`, { decision: 'approve' });
    await theo.get(`/impots/${t2}`);
    await theo.post(`/impots/${t2}/etape`, { action: 'filed', confirmationFed: 'T2-1', confirmationQc: 'CO17-1' });
    const marks = t.db.prepare("SELECT key FROM deadline_marks WHERE client_id = ? AND status = 'done' ORDER BY key").all(t.soc.id).map((m) => m.key);
    assert.deepStrictEqual(marks, ['req:2026-06-30', 't2:2026-06-30']);
    const ev = t.db.prepare('SELECT to_status FROM tax_file_events WHERE file_id = ? ORDER BY id').all(t2).map((e) => e.to_status);
    assert.deepStrictEqual(ev, ['books', 'closing', 'prep', 'review', 'approval', 'review', 'approval', 'approval', 'filed']);
    // Isolation : un client ne voit pas le dossier d'un autre
    assert.strictEqual((await marie.get(`/impots/${t1}`)).status, 403);
    assert.match((await theo.get('/impots')).body, /T2 et CO-17 — exercice terminé le 2026-06-30/);
    assert.match((await theo.get(`/clients/${t.jean.id}/impots`)).body, /T1-778899 · TP1-445566/);
  } finally { t.app.close(); }
});
