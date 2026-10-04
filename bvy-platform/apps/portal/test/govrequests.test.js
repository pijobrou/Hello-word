'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { objectionDate } = require('../lib/govrequests.js');

const ORIGIN = 'https://portail.bvyaccountingtax.ca';
const PW = 'une phrase assez longue';
const T0 = Date.UTC(2026, 9, 5, 14, 0); // lundi 2026-10-05
let NOW = T0;

test('gouvernement : 90 jours pour s’opposer, reportés au jour ouvrable', () => {
  assert.strictEqual(objectionDate('2026-09-15'), '2026-12-14');
  assert.strictEqual(objectionDate('2026-09-14'), '2026-12-14', 'dimanche 2026-12-13 → lundi');
  assert.strictEqual(objectionDate('2026-08-07'), '2026-11-05');
});

async function setup() {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-rc-'));
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
  const soc = acc.createClient(admin, 'Atelier Boréal inc.');
  const jean = acc.createClient(admin, 'Jean Tremblay');
  mk('marie@boreal.ca', 'Marie Bouchard', 'client', soc.id);
  const lise = mk('lise@bvy.ca', 'Lise Comptable', 'bookkeeper');
  acc.setAssignment(admin, lise.id, soc.id, true);
  return { app, mails, login, admin, soc, jean };
}

const PDF = (t) => Buffer.from(`%PDF-1.4\n% ${t}\n`);
const loc = (r) => decodeURIComponent(r.headers.location || '');

test('gouvernement : lettre, date limite, documents, client, étapes et rôles', async () => {
  NOW = T0;
  const { app, mails, login, admin, soc, jean } = await setup();
  const db = app.db;
  try {
    // La lettre arrive par le client ; la Réception propose d'enregistrer la demande
    const marie = await login('marie@boreal.ca');
    await marie.get('/documents');
    await marie.upload('/documents', {}, { name: 'Lettre Revenu Quebec verification.pdf', data: PDF('lettre') });
    const letter = db.prepare('SELECT * FROM documents WHERE client_id = ?').get(soc.id);
    assert.strictEqual(letter.suggested, 'gouvernement');
    const owner = await login('owner@bvy.ca');
    let r = await owner.get('/reception');
    assert.match(r.body, new RegExp(`/gouvernement/nouvelle\\?client=${soc.id}&amp;doc=${letter.id}`));
    r = await owner.get(`/gouvernement/nouvelle?client=${soc.id}&doc=${letter.id}`);
    assert.match(r.body, /Lettre Revenu Quebec verification\.pdf/);

    // Champs obligatoires
    const base = { clientId: soc.id, agency: 'rq', kind: 'verification', program: 'taxes', reference: 'VR-2026-118', letterDate: '2026-10-01', dueDate: '2026-10-10',
      summary: 'Vérification de la TPS/TVQ du 2026-01-01 au 2026-06-30 : fournir les pièces justificatives.', amount: '', letterDocId: letter.id,
      items: 'Relevés bancaires de janvier à juin 2026\nFactures d’achat de plus de 500 $\nContrats de vente' };
    r = await owner.post('/gouvernement', { ...base, summary: '' });
    assert.match(loc(r), /Résumez la demande/);
    r = await owner.post('/gouvernement', { ...base, dueDate: '2026-09-01' });
    assert.match(loc(r), /ne peut pas précéder la date de la lettre/);
    r = await owner.post('/gouvernement', { ...base, letterDate: '2026-11-01' });
    assert.match(loc(r), /ne peut pas être dans le futur/);
    r = await owner.post('/gouvernement', base);
    const id = Number(r.headers.location.match(/^\/gouvernement\/(\d+)\?ok=/)[1]);
    const g = () => db.prepare('SELECT * FROM gov_requests WHERE id = ?').get(id);
    assert.strictEqual(g().status, 'gathering');
    assert.strictEqual(g().owner_id, admin.id);
    const filed = db.prepare('SELECT * FROM documents WHERE id = ?').get(letter.id);
    assert.strictEqual(filed.doc_type, 'gouvernement'); assert.strictEqual(filed.link, `gov_request:${id}`); assert.strictEqual(filed.filed, 1);

    // Anomalie urgente : réponse due dans 5 jours
    const an = db.prepare("SELECT * FROM anomalies WHERE client_id = ? AND type = 'gov_request'").get(soc.id);
    assert.ok(an); assert.strictEqual(an.severity, 'urgent');
    assert.match(an.title, /Revenu Québec — Vérification \(TPS\/TVQ\) — réponse due dans 5 jours/);
    assert.match(an.explanation, /3 documents encore à obtenir/);

    // Le client voit que BVY s'en occupe, sans montant ni contenu de la lettre
    r = await marie.get('/accueil');
    assert.match(r.body, /Lettre de Revenu Québec \(vérification, TPS\/TVQ\)/);
    assert.match(r.body, /réponse due le 2026-10-10/);
    assert.match(r.body, /documents à réunir/);

    // Prête refusée tant qu'il manque des documents ; demande au client
    r = await owner.post(`/gouvernement/${id}/etape`, { action: 'ready' });
    assert.match(loc(r), /Il manque encore 3 documents/);
    const before = mails.length;
    r = await owner.post(`/gouvernement/${id}/demander`);
    assert.match(loc(r), /Documents demandés au client/);
    const task = db.prepare('SELECT * FROM tasks WHERE gov_request_id = ?').get(id);
    assert.strictEqual(task.kind, 'document');
    assert.strictEqual(task.due_date, '2026-10-07', 'au moins 2 jours, une semaine avant la date limite sinon');
    assert.match(task.detail, /• Relevés bancaires de janvier à juin 2026\n• Factures d’achat de plus de 500 \$\n• Contrats de vente/);
    const notice = mails.slice(before).find((m) => m.to[0] === 'marie@boreal.ca');
    assert.match(notice.subject, /BVY a besoin de documents de votre part/);
    assert.doesNotMatch(`${notice.subject} ${notice.text}`, /Revenu Québec|vérification|\$/i, 'aucun détail par courriel');
    r = await owner.post(`/gouvernement/${id}/demander`);
    assert.match(loc(r), /déjà en attente/);

    // La pièce envoyée par le client est liée à la demande
    await marie.get('/a-faire');
    await marie.upload('/documents', { taskId: String(task.id) }, { name: 'releves-banque.pdf', data: PDF('releves') });
    const piece = db.prepare("SELECT * FROM documents WHERE name = 'releves-banque.pdf'").get();
    assert.strictEqual(piece.link, `gov_request:${id}`);
    r = await owner.get(`/gouvernement/${id}`);
    assert.match(r.body, /releves-banque\.pdf[\s\S]*Envoyé par le client/);

    // Liste cochée, prête, envoyée, fermée
    const items = JSON.parse(g().items);
    await owner.post(`/gouvernement/${id}/element`, { item: items[0].k, status: 'received' });
    await owner.post(`/gouvernement/${id}/element`, { item: items[1].k, status: 'received' });
    await owner.post(`/gouvernement/${id}/element`, { item: items[2].k, status: 'na' });
    r = await owner.post(`/gouvernement/${id}/etape`, { action: 'ready' });
    assert.strictEqual(g().status, 'ready');
    r = await owner.post(`/gouvernement/${id}/etape`, { action: 'sent', sentOn: '2026-10-05', sentHow: 'Pigeon voyageur' });
    assert.match(loc(r), /comment la réponse a été envoyée/);
    r = await owner.post(`/gouvernement/${id}/etape`, { action: 'sent', sentOn: '2026-10-05', sentHow: 'Mon dossier pour les entreprises (Revenu Québec)', confirmation: 'RQ-778812' });
    assert.strictEqual(g().status, 'sent');
    assert.strictEqual(db.prepare('SELECT status, resolution FROM anomalies WHERE id = ?').get(an.id).status, 'resolved', 'plus urgente une fois envoyée');
    r = await owner.post(`/gouvernement/${id}/etape`, { action: 'back', note: '' });
    assert.match(loc(r), /raison du retour/);
    r = await owner.post(`/gouvernement/${id}/etape`, { action: 'closed', note: '' });
    assert.match(loc(r), /Écrivez le résultat/);
    r = await owner.post(`/gouvernement/${id}/etape`, { action: 'closed', note: 'Aucun changement : vérification terminée le 2026-10-05.' });
    assert.strictEqual(g().status, 'closed');
    r = await owner.get(`/gouvernement/${id}`);
    assert.match(r.body, /Envoyée le 2026-10-05 \(Mon dossier pour les entreprises \(Revenu Québec\)\) — confirmation RQ-778812/);
    assert.match(r.body, /Résultat :<\/b> Aucun changement/);
    r = await marie.get('/accueil');
    assert.doesNotMatch(r.body, /Lettre de Revenu Québec/, 'fermée : plus sur l’accueil du client');

    // Avis de cotisation sans date limite : 90 jours pour s'opposer ; date limite modifiée avec la raison
    r = await owner.post('/gouvernement', { clientId: jean.id, agency: 'arc', kind: 'cotisation', program: 't1', letterDate: '2026-09-15', dueDate: '',
      summary: 'Nouvelle cotisation 2024 : frais de garde refusés.', amount: '1 250,00', items: '' });
    const id2 = Number(r.headers.location.match(/^\/gouvernement\/(\d+)/)[1]);
    assert.strictEqual(db.prepare('SELECT due_date, amount_cents, status FROM gov_requests WHERE id = ?').get(id2).due_date, '2026-12-14');
    r = await owner.post(`/gouvernement/${id2}/modifier`, { dueDate: '2027-01-15', reason: 'Délai accordé par l’agent', summary: 'Nouvelle cotisation 2024 : frais de garde refusés.', reference: '', amount: '1250' });
    r = await owner.get(`/gouvernement/${id2}`);
    assert.match(r.body, /Date limite changée : 2026-12-14 → 2027-01-15 \(Délai accordé par l’agent\)/);

    // Rôles et isolation
    const lise = await login('lise@bvy.ca');
    r = await lise.get('/gouvernement?etat=closed');
    assert.match(r.body, /Revenu Québec/);
    r = await lise.get('/gouvernement');
    assert.doesNotMatch(r.body, /Jean Tremblay/, "ni la demande ni le client hors de son périmètre");
    r = await lise.get(`/gouvernement/${id2}`);
    assert.strictEqual(r.status, 403);
    r = await lise.post(`/gouvernement/${id2}/etape`, { action: 'closed', note: 'x' });
    assert.strictEqual(r.status, 403);
    r = await marie.get('/gouvernement');
    assert.notStrictEqual(r.status, 200);
    r = await owner.get(`/clients/${soc.id}/gouvernement`);
    assert.match(r.body, /Fermée/);
  } finally { app.close(); }
});
