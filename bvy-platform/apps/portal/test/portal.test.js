'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { parseAmount, formatAmount, cleanQboUrl, sniff } = require('../lib/portal.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(2000, 65), Buffer.from('\n%%EOF')]);

test('montants, lien QuickBooks et type réel des fichiers', () => {
  assert.strictEqual(parseAmount('48 215,60 $'), 4821560);
  assert.strictEqual(parseAmount('48215.6'), 4821560);
  assert.strictEqual(parseAmount('-1 200'), -120000);
  assert.strictEqual(parseAmount(''), null);
  assert.throws(() => parseAmount('beaucoup'), /Montant invalide/);
  assert.match(formatAmount(4821560), /48\s215,60\s\$/);
  assert.strictEqual(cleanQboUrl('https://qbo.intuit.com/app/homepage?cid=1'), 'https://qbo.intuit.com/app/homepage?cid=1');
  assert.throws(() => cleanQboUrl('https://evil.example/intuit.com'), /intuit\.com/);
  assert.throws(() => cleanQboUrl('javascript:alert(1)'), /QuickBooks/);
  assert.strictEqual(sniff(PDF).mime, 'application/pdf');
  assert.strictEqual(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0])).mime, 'image/jpeg');
  assert.strictEqual(sniff(Buffer.from('<html>pas un pdf</html>')), null);
});

async function setup() {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-p3-'));
  const app = createServer({ port: 0, dataDir, smtp: null, publicUrl: ORIGIN, notifyTo: ['equipe@bvy.ca'], sendMail: async (m) => { mails.push(m); } });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const port = app.address().port;
  const acc = app.accounts;
  function agent() {
    let cookie = '';
    function req(method, p, { form, multipart, headers = {} } = {}) {
      let body; const h = { ...(cookie ? { Cookie: cookie } : {}), ...headers };
      if (form) { body = Buffer.from(new URLSearchParams(form).toString()); h['Content-Type'] = 'application/x-www-form-urlencoded'; }
      if (multipart) {
        const b = '----bvytest' + Math.random().toString(16).slice(2);
        const parts = [];
        for (const [k, v] of Object.entries(multipart.fields || {})) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
        if (multipart.file) parts.push(Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="${multipart.file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`), multipart.file.data, Buffer.from('\r\n'));
        parts.push(Buffer.from(`--${b}--\r\n`));
        body = Buffer.concat(parts); h['Content-Type'] = `multipart/form-data; boundary=${b}`;
      }
      if (body) { h['Content-Length'] = body.length; h.Origin = ORIGIN; }
      return new Promise((resolve, reject) => {
        const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: h }, (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const sc = res.headers['set-cookie'];
            if (sc) { const m = String(sc[0]).match(/__Host-bvy_session=([^;]*)/); cookie = m && m[1] ? `__Host-bvy_session=${m[1]}` : ''; }
            const buf = Buffer.concat(chunks);
            resolve({ status: res.statusCode, headers: res.headers, buf, body: buf.toString('utf8') });
          });
        });
        r.on('error', reject);
        if (body) r.write(body);
        r.end();
      });
    }
    let csrf = '';
    const self = {
      req,
      async get(p) { const r = await req('GET', p); const m = r.body.match(/name="_csrf" value="([^"]+)"/); if (m) csrf = m[1]; return r; },
      post(p, form) { return req('POST', p, { form: { ...form, _csrf: csrf } }); },
      upload(p, file, fields = {}) { return req('POST', p, { multipart: { file, fields: { ...fields, _csrf: csrf } } }); },
    };
    return self;
  }
  async function login(email) {
    const a = agent();
    await a.req('POST', '/connexion', { form: { email, password: PW } });
    await a.get('/verification');
    const code = mails[mails.length - 1].subject.match(/(\d{6})/)[1];
    const r = await a.post('/verification', { method: 'email', code });
    assert.strictEqual(r.headers.location, '/accueil');
    await a.get('/accueil');
    return a;
  }
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('owner@bvy.ca', 'Pierre Owner', 'admin');
  const boreal = acc.createClient(admin, 'Atelier Boréal inc.');
  const autre = acc.createClient(admin, 'Autre inc.');
  mk('marie@boreal.ca', 'Marie Tremblay', 'client', boreal.id);
  mk('paul@autre.ca', 'Paul Autre', 'client', autre.id);
  mk('julie@bvy.ca', 'Julie Livres', 'bookkeeper');
  return { app, mails, login, boreal, autre, dataDir, db: app.db };
}

test('tableau de bord : publié par BVY, vu par le client avec explication ; jamais par un autre client', async () => {
  const t = await setup();
  try {
    const staff = await t.login('owner@bvy.ca');
    await staff.get(`/clients/${t.boreal.id}`);
    const bad = await staff.post(`/clients/${t.boreal.id}/tableau`, { asOf: '2026-09-30', cash: '48 215,60', health: 'watch', healthWhy: '' });
    assert.match(decodeURIComponent(bad.headers.location), /Expliquez toujours/);
    const r = await staff.post(`/clients/${t.boreal.id}/tableau`, {
      asOf: '2026-09-30', cash: '48 215,60', cashNote: 'Dans vos 2 comptes bancaires', receivable: '18430', payable: '9 876,45',
      health: 'watch', healthWhy: 'Vos dépenses augmentent plus vite que vos revenus ce mois-ci.',
      changes: 'Dépenses +12 % | Surtout le marketing de septembre', work: 'Tenue de livres — septembre | 85 %\nTPS/TVQ | en attente de la tenue de livres',
    });
    assert.match(decodeURIComponent(r.headers.location), /publié/);
    assert.ok(t.mails.some((m) => m.to[0] === 'marie@boreal.ca' && /tableau de bord/.test(m.subject) && !/48/.test(m.text)), 'avis sans montant');

    const marie = await t.login('marie@boreal.ca');
    const home = await marie.get('/accueil');
    assert.match(home.body, /48\s215,60\s\$/);
    assert.match(home.body, /Chiffres au 30 septembre 2026/);
    assert.match(home.body, /À surveiller/);
    assert.match(home.body, /plus vite que vos revenus/);
    assert.match(home.body, /class="p85"/);
    assert.match(home.body, /en attente de la tenue de livres/);
    assert.ok(!/style="/.test(home.body), 'aucun style en ligne');

    const paul = await t.login('paul@autre.ca');
    const other = await paul.get('/accueil');
    assert.ok(!other.body.includes('48'), 'aucun chiffre d’un autre client');
    assert.match(other.body, /tableau de bord se prépare/);
    assert.notStrictEqual((await paul.get(`/clients/${t.boreal.id}`)).status, 200);
  } finally { t.app.close(); }
});

test('À faire : question créée par BVY, réponse du client, isolation et clôture', async () => {
  const t = await setup();
  try {
    const staff = await t.login('owner@bvy.ca');
    await staff.get(`/clients/${t.boreal.id}/taches`);
    await staff.post(`/clients/${t.boreal.id}/taches`, { kind: 'question', title: 'Nous avons trouvé un paiement Costco de 842,37 $. Était-ce une dépense d’entreprise ?', qboUrl: 'https://qbo.intuit.com/app/register' });
    const task = t.db.prepare('SELECT * FROM tasks').get();
    assert.deepStrictEqual(JSON.parse(task.choices), ['Oui, dépense d’entreprise', 'Non, personnel', 'Autre']);
    assert.ok(t.mails.some((m) => m.to[0] === 'marie@boreal.ca' && /nouvelle tâche/.test(m.subject)));

    const paul = await t.login('paul@autre.ca');
    await paul.get('/a-faire');
    assert.strictEqual((await paul.post(`/a-faire/${task.id}/repondre`, { choice: 'Non, personnel' })).status, 403);

    const marie = await t.login('marie@boreal.ca');
    const page = await marie.get('/a-faire');
    assert.match(page.body, /Costco de 842,37/);
    assert.match(page.body, /Voir dans QuickBooks/);
    const noReason = await marie.post(`/a-faire/${task.id}/repondre`, { choice: 'Autre', comment: '' });
    assert.match(decodeURIComponent(noReason.headers.location), /Précisez/);
    const ok = await marie.post(`/a-faire/${task.id}/repondre`, { choice: 'Oui, dépense d’entreprise' });
    assert.match(decodeURIComponent(ok.headers.location), /réponse est envoyée/);
    assert.strictEqual(t.db.prepare('SELECT status, answer FROM tasks').get().answer, 'Oui, dépense d’entreprise');
    assert.ok(t.mails.some((m) => m.to[0] === 'equipe@bvy.ca' && /Réponse du client/.test(m.subject)));
    assert.match(decodeURIComponent((await marie.post(`/a-faire/${task.id}/repondre`, { choice: 'Non, personnel' })).headers.location), /déjà traitée/);

    const list = await staff.get(`/clients/${t.boreal.id}/taches`);
    assert.match(list.body, /Réponse :<\/b> Oui, dépense d’entreprise/);
    await staff.post(`/taches/${task.id}/fermer`, { status: 'done' });
    assert.strictEqual(t.db.prepare('SELECT status FROM tasks').get().status, 'done');
    assert.strictEqual((await marie.post(`/taches/${task.id}/fermer`, { status: 'done' })).status, 404, 'un client ne ferme pas une tâche');
  } finally { t.app.close(); }
});

test('documents : envoi d’un PDF, type vérifié, téléchargement réservé, fichier protégé', async () => {
  const t = await setup();
  try {
    const marie = await t.login('marie@boreal.ca');
    await marie.get('/documents');
    const fake = await marie.upload('/documents', { name: 'facture.pdf', data: Buffer.from('<script>alert(1)</script>') });
    assert.match(decodeURIComponent(fake.headers.location), /Format non accepté/);
    const ok = await marie.upload('/documents', { name: 'facture septembre.pdf', data: PDF }, { note: 'Facture Bell' });
    assert.match(decodeURIComponent(ok.headers.location), /Document reçu/);
    const doc = t.db.prepare('SELECT * FROM documents').get();
    assert.strictEqual(doc.origin, 'client');
    assert.strictEqual(doc.mime, 'application/pdf');
    const file = path.join(t.dataDir, 'documents', String(t.boreal.id), doc.stored);
    assert.strictEqual(fs.statSync(file).mode & 0o777, 0o600);
    assert.ok(t.mails.some((m) => m.to[0] === 'equipe@bvy.ca' && /Nouveau document/.test(m.subject)));

    const dl = await marie.req('GET', `/documents/${doc.id}/telecharger`);
    assert.strictEqual(dl.status, 200);
    assert.match(dl.headers['content-disposition'], /^attachment;/);
    assert.ok(dl.buf.equals(PDF));

    const paul = await t.login('paul@autre.ca');
    assert.strictEqual((await paul.req('GET', `/documents/${doc.id}/telecharger`)).status, 403);
    const julie = await t.login('julie@bvy.ca');
    assert.strictEqual((await julie.req('GET', `/documents/${doc.id}/telecharger`)).status, 403, 'personnel non assigné');
    assert.notStrictEqual((await julie.get(`/clients/${t.boreal.id}`)).status, 200);

    const staff = await t.login('owner@bvy.ca');
    await staff.get(`/clients/${t.boreal.id}/documents`);
    await staff.upload(`/clients/${t.boreal.id}/documents`, { name: 'Résumé de septembre.pdf', data: PDF }, { category: 'report' });
    const reports = await marie.get('/rapports');
    assert.match(reports.body, /Résumé de septembre\.pdf/);
    assert.ok(!reports.body.includes('facture septembre'));
    assert.ok(t.db.prepare("SELECT 1 FROM audit_logs WHERE action = 'document.download'").get());
  } finally { t.app.close(); }
});

test('messages : fil unique client ↔ BVY, non-lus, avis par courriel', async () => {
  const t = await setup();
  try {
    const marie = await t.login('marie@boreal.ca');
    await marie.get('/messages');
    await marie.post('/messages', { body: 'Bonjour, ma facture Hydro arrive la semaine prochaine.' });
    const staff = await t.login('owner@bvy.ca');
    const home = await staff.get('/accueil');
    assert.match(home.body, /1 non lu/);
    const thread = await staff.get(`/clients/${t.boreal.id}/messages`);
    assert.match(thread.body, /facture Hydro/);
    await staff.post(`/clients/${t.boreal.id}/messages`, { body: 'Merci Marie, nous la classerons à réception.' });
    assert.ok(!/\d non lu/.test((await staff.get('/accueil')).body));
    const back = await marie.get('/accueil');
    assert.match(back.body, /aria-label="1 nouveaux messages"/);
    const mine = await marie.get('/messages');
    assert.match(mine.body, /Pierre Owner · BVY/);
    assert.ok(t.mails.some((m) => m.to[0] === 'marie@boreal.ca' && /nouveau message/.test(m.subject) && !/Hydro|classerons/.test(m.text)));
    const paul = await t.login('paul@autre.ca');
    assert.ok(!(await paul.get('/messages')).body.includes('Hydro'));
  } finally { t.app.close(); }
});
