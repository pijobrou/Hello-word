'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkEmail, checkPhone, spamReason, createDomainChecker } = require('../verify.js');
const { createServer } = require('../server.js');

test('courriel : syntaxe, faute de frappe, adresse jetable, domaine sans courriel', async () => {
  const dns = async (d) => (d === 'inexistant-bvy.ca' ? 'no' : 'yes');
  assert.deepStrictEqual(await checkEmail(' Marie@Videotron.CA ', dns), { ok: true, email: 'marie@videotron.ca', check: 'verified' });
  assert.strictEqual((await checkEmail('marie@gmial.com', dns)).suggestion, 'marie@gmail.com');
  assert.match((await checkEmail('a@yopmail.com', dns)).error, /temporaires/);
  assert.match((await checkEmail('a@inexistant-bvy.ca', dns)).error, /ne reçoit pas de courriel/);
  assert.match((await checkEmail('a@@b', dns)).error, /pas valide/);
  assert.match((await checkEmail('a@b.c', dns)).error, /pas valide/);
});

test('DNS : MX, MX nul, domaine absent ; panne du DNS du serveur → on laisse passer', async () => {
  const nx = () => Promise.reject(Object.assign(new Error('x'), { code: 'ENOTFOUND' }));
  const mk = (table) => createDomainChecker({ resolveMx: (d) => (table[d] ? Promise.resolve(table[d]) : nx()), resolve4: nx });
  const ok = mk({ 'gmail.com': [{ exchange: 'mx.google.com' }], 'bvy.ca': [{ exchange: 'mx.bvy.ca' }], 'nul.ca': [{ exchange: '' }] });
  assert.strictEqual(await ok('bvy.ca'), 'yes');
  assert.strictEqual(await ok('nul.ca'), 'no');
  assert.strictEqual(await ok('rien-du-tout.ca'), 'no');
  const down = mk({});
  assert.strictEqual(await down('bvy.ca'), 'unknown', 'même gmail.com ne répond pas : DNS en panne');
  const slow = createDomainChecker({ resolveMx: () => new Promise(() => {}), resolve4: nx, timeoutMs: 20 });
  assert.strictEqual(await slow('lent.ca'), 'unknown');
});

test('téléphone : numéros nord-américains réels, fictifs refusés, international avec +', () => {
  assert.deepStrictEqual(checkPhone('418 387-2001'), { ok: true, e164: '+14183872001', display: '(418) 387-2001', region: 'Canada' });
  assert.strictEqual(checkPhone('1 (212) 387-2001').region, 'États-Unis');
  assert.strictEqual(checkPhone('418-387-2001 poste 12').display, '(418) 387-2001 poste 12');
  for (const bad of ['514-555-0100', '123-456-7890', '418-111-1111', '000-000-0000', '911-387-2001', '418-387', 'appelez-moi']) assert.strictEqual(checkPhone(bad).ok, false, bad);
  assert.strictEqual(checkPhone('+33 1 23 45 67 89').ok, true);
  assert.strictEqual(checkPhone('').ok, false);
});

test('robots et pourriel', () => {
  assert.match(spamReason({ prenom: 'A' }, { elapsedMs: 800 }), /3 secondes/);
  assert.strictEqual(spamReason({ prenom: 'A' }, { elapsedMs: 12000 }), null);
  assert.strictEqual(spamReason({ prenom: 'Marie', message: 'Voir https://monsite.ca' }, {}), null);
  assert.match(spamReason({ prenom: 'http://spam.ru' }, {}), /lien/);
  assert.match(spamReason({ message: 'http://a http://b http://c' }, {}), /liens/);
  assert.match(spamReason({ message: 'Лучшие предложения для вашего бизнеса сегодня' }, {}), /étrangère/);
  assert.match(spamReason({ message: 'Best SEO services for you' }, {}), /pourriel/);
});

test('la demande frauduleuse reçue le 2026-10-07 est bloquée, de vraies demandes passent', async () => {
  const fraud = { prenom: 'JasonCheltGM', nom: 'RobertChelt', courriel: 'joshuaguerrero2v7t40d@gmail.com', telephone: '85389153862',
    entreprise: 'Google', service: 'tps-tvq', region: 'Cote d\'Ivoire', message: 'Xin chào, tôi muốn biết giá của bạn.' };
  assert.ok(spamReason(fraud, {}));
  assert.strictEqual(checkPhone(fraud.telephone).ok, false, 'le téléphone seul le bloquait déjà');
  // Deuxième fausse demande reçue (2026-10-04) : même robot, message en lituanien
  const fraud2 = { prenom: 'WayneCheltGM', nom: 'RobertChelt', courriel: 'joshuaguerrero2v7t40d@gmail.com', telephone: '88334388836',
    entreprise: 'Apple', service: 'domiciliation', region: 'Senegal', message: 'Sveiki, aš norėjau sužinoti jūsų kainą.' };
  assert.ok(spamReason(fraud2, {}));
  assert.strictEqual(checkPhone(fraud2.telephone).ok, false);
  assert.match(spamReason({ message: fraud2.message }, {}), /votre prix/, 'le message seul suffit');
  assert.match(spamReason({ region: 'Senegal' }, {}), /région/);
  // Chaque signe fort, seul
  assert.match(spamReason({ ...fraud, prenom: 'Jean', nom: 'Roy', region: 'Côte d’Ivoire', message: 'Bonjour' }, {}), /plusieurs signes|courriel/);
  assert.match(spamReason({ region: 'Cote d\'Ivoire' }, {}), /région/);
  assert.match(spamReason({ service: 'seo' }, {}), /service/);
  assert.match(spamReason({ message: 'Hi, I wanted to know your price.' }, {}), /votre prix/);
  assert.match(spamReason({ prenom: 'JasonCheltGM', nom: 'Roy' }, {}), /nom généré/);
  assert.match(spamReason({ prenom: 'Jason', nom: 'RobertChelt', courriel: 'jason@x.ca' }, {}) || '', /^$|nom/);
  assert.match(spamReason({ message: 'Xin chào, tôi cần dịch vụ kế toán cho công ty' }, {}), /vietnamien/);
  // Vraies demandes : noms composés, accents, courriel avec chiffres, région de la liste
  for (const ok of [
    { prenom: 'Marie-Ève', nom: 'Côté', courriel: 'marie.cote84@videotron.ca', entreprise: 'Boutique Côté', service: 'tps-tvq', region: 'Québec, Canada', message: 'Bonjour, je veux un prix pour la TPS/TVQ.' },
    { prenom: 'Jean-François', nom: 'McDonald', courriel: 'jf@mcdonald-plomberie.ca', entreprise: 'Plomberie McDonald', service: '', region: 'Côte d’Ivoire', message: '' },
    { prenom: 'Aïssatou', nom: 'Diallo', courriel: 'adiallo2021@gmail.com', entreprise: '', service: 'paie', region: 'Sénégal', message: 'Merci' },
    { prenom: 'Nguyen', nom: 'Tran', courriel: 'nguyen.tran@gmail.com', entreprise: 'Pho Québec', service: 'tenue-de-livres', region: 'Québec, Canada', message: 'Bonjour, restaurant à Lévis.' },
  ]) assert.strictEqual(spamReason(ok, { elapsedMs: 20000 }), null, JSON.stringify(ok));
});

test('les listes de choix du serveur correspondent aux formulaires', () => {
  const { SERVICES, REGIONS } = require('../verify.js');
  for (const page of ['contact', 'rendez-vous']) {
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', `${page}.html`), 'utf8');
    const svc = html.slice(html.indexOf('name="service"'), html.indexOf('</select>', html.indexOf('name="service"')));
    assert.deepStrictEqual([...svc.matchAll(/option value="([^"]*)"/g)].map((m) => m[1]), SERVICES, page);
    const reg = html.slice(html.indexOf('name="region"'), html.indexOf('</select>', html.indexOf('name="region"')));
    assert.deepStrictEqual([...reg.matchAll(/<option>([^<]*)<\/option>/g)].map((m) => m[1]), REGIONS.slice(1), page);
  }
});

test('formulaire : erreurs claires, robot ignoré en silence, autre site refusé, doublon sans nouvel avis', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-verif-'));
  const app = createServer({ port: 0, dataDir, smtp: null, webhookUrl: '', receivesMail: async (d) => (d === 'faux-domaine.ca' ? 'no' : 'yes') });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${app.address().port}/api/contact`;
  const post = (body, headers = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers }, body: JSON.stringify(body) })
    .then(async (r) => ({ status: r.status, body: await r.json() }));
  const lead = { prenom: 'Marie', nom: 'Tremblay', courriel: 'marie@entreprise.ca', telephone: '418 387-2001', consentement: true, message: 'Bonjour', _t: '15000' };
  const leads = () => { try { return fs.readFileSync(path.join(dataDir, 'leads.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); } catch { return []; } };
  try {
    let r = await post({ ...lead, courriel: 'marie@hotmial.com', telephone: '514-555-0100' });
    assert.strictEqual(r.status, 422);
    assert.match(r.body.errors.courriel, /marie@hotmail.com/);
    assert.strictEqual(r.body.suggestion, 'marie@hotmail.com');
    assert.match(r.body.errors.telephone, /n’existe pas/);
    r = await post({ ...lead, courriel: 'marie@faux-domaine.ca', telephone: '' });
    assert.match(r.body.errors.courriel, /ne reçoit pas/); assert.match(r.body.errors.telephone, /obligatoire/);
    assert.strictEqual(leads().length, 0);

    r = await post({ ...lead, _t: '900' });
    assert.strictEqual(r.status, 201, 'le robot croit que c’est envoyé');
    assert.strictEqual(leads().length, 0);
    assert.match(fs.readFileSync(path.join(dataDir, 'spam.jsonl'), 'utf8'), /3 secondes/);

    r = await post(lead, { Origin: 'https://site-malveillant.example' });
    assert.strictEqual(r.status, 403);

    r = await post(lead);
    assert.strictEqual(r.status, 201);
    const saved = leads()[0];
    assert.strictEqual(saved.telephone, '(418) 387-2001');
    assert.deepStrictEqual(saved.verification, { courriel: 'verified', telephone: 'Canada' });
    assert.ok(!('_t' in saved));
    r = await post(lead);
    assert.strictEqual(r.status, 201);
    assert.strictEqual(leads()[1].doublon, true);
  } finally { app.close(); }
});
