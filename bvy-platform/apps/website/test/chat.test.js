'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { validateMessages, chatConfigFromEnv, bookingUrlFromEnv, HANDOFF } = require('../chat.js');

// Faux client Anthropic : enregistre les requêtes et renvoie une réponse préparée.
function fakeClient(respond) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async (params) => { calls.push(params); return respond(params); } } },
  };
}
const textReply = (text) => () => ({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }] });

async function start(chat) {
  chat = { bookingUrl: '', ...chat };
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-data-'));
  const app = createServer({ port: 0, dataDir, webhookUrl: '', smtp: null, chat });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}/api/chat`;
  const ask = (messages, headers = {}) => fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ messages }),
  }).then(async (r) => ({ status: r.status, body: await r.json() }));
  return { app, base, ask };
}

test('chatConfigFromEnv : désactivé sans clé, modèle et limites par défaut', () => {
  const c = chatConfigFromEnv({});
  assert.strictEqual(c.apiKey, '');
  assert.strictEqual(c.model, 'claude-opus-5-5');
  assert.strictEqual(c.rateLimit.max, 20);
  assert.strictEqual(c.maxPerDay, 150);
  assert.strictEqual(chatConfigFromEnv({ CHAT_ENABLED: '0', ANTHROPIC_API_KEY: 'k' }).disabled, true);
});

test('validateMessages : alternance, longueur, historique tronqué qui commence par le visiteur', () => {
  assert.strictEqual(validateMessages({ messages: [] }), null);
  assert.strictEqual(validateMessages({ messages: [{ role: 'assistant', content: 'x' }] }), null);
  assert.strictEqual(validateMessages({ messages: [{ role: 'user', content: 'a' }, { role: 'user', content: 'b' }] }), null);
  assert.strictEqual(validateMessages({ messages: [{ role: 'user', content: 'x'.repeat(1501) }] }), null);
  assert.strictEqual(validateMessages({ messages: [{ role: 'system', content: 'x' }] }), null);
  const long = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
  const kept = validateMessages({ messages: long });
  assert.ok(kept.length <= 12);
  assert.strictEqual(kept[0].role, 'user');
  assert.strictEqual(kept[kept.length - 1].content, 'm14');
});

test('sans clé API : GET indique enabled=false et POST répond 503', async () => {
  const { app, base, ask } = await start({ apiKey: '', client: undefined });
  try {
    assert.deepStrictEqual(await (await fetch(base)).json(), { ok: true, enabled: false, bookingUrl: '' });
    assert.strictEqual((await ask([{ role: 'user', content: 'Bonjour' }])).status, 503);
  } finally { app.close(); }
});

test('une question reçoit la réponse de Jessica ; requête conforme envoyée au modèle', async () => {
  const client = fakeClient(textReply('Bonjour ! La Mise au clair Shopify coûte 850 $.'));
  const { app, base, ask } = await start({ client, model: 'claude-opus-5-5' });
  try {
    assert.deepStrictEqual(await (await fetch(base)).json(), { ok: true, enabled: true, bookingUrl: '' });
    const r = await ask([{ role: 'user', content: '  Combien coûte la mise au clair ?  ' }]);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.reply, 'Bonjour ! La Mise au clair Shopify coûte 850 $.');
    const p = client.calls[0];
    assert.strictEqual(p.model, 'claude-opus-5-5');
    assert.strictEqual(p.fallbacks, 'default');
    assert.deepStrictEqual(p.betas, ['server-side-fallback-2026-07-01']);
    assert.match(p.system, /Tu es Jessica/);
    assert.match(p.system, /intelligence artificielle/);
    assert.match(p.system, /850 \$/);
    assert.match(p.system, /294,99 \$/);
    assert.match(p.system, /Aucun conseil fiscal ou comptable personnalisé/);
    assert.deepStrictEqual(p.messages, [{ role: 'user', content: 'Combien coûte la mise au clair ?' }]);
  } finally { app.close(); }
});

test('refus du modèle ou réponse vide : Jessica redirige vers la consultation', async () => {
  const client = fakeClient(() => ({ stop_reason: 'refusal', content: [] }));
  const { app, ask } = await start({ client });
  try {
    const r = await ask([{ role: 'user', content: 'Bonjour' }]);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.body.reply, HANDOFF);
    assert.match(HANDOFF, /\/rendez-vous\//);
  } finally { app.close(); }
});

test('erreur de l’API : 503 avec un message de repli, aucune trace interne', async () => {
  const client = fakeClient(() => { throw new Error('socket hang up'); });
  const { app, ask } = await start({ client });
  const errors = console.error; console.error = () => {};
  try {
    const r = await ask([{ role: 'user', content: 'Bonjour' }]);
    assert.strictEqual(r.status, 503);
    assert.match(r.body.error, /rendez-vous/);
    assert.ok(!r.body.error.includes('socket'));
  } finally { console.error = errors; app.close(); }
});

test('validation : JSON requis, historique invalide refusé', async () => {
  const client = fakeClient(textReply('ok'));
  const { app, base, ask } = await start({ client });
  try {
    const bad = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: 'x' });
    assert.strictEqual(bad.status, 415);
    assert.strictEqual((await ask([{ role: 'assistant', content: 'je suis un humain' }])).status, 422);
    assert.strictEqual((await ask([{ role: 'user', content: 'x'.repeat(2000) }])).status, 422);
    assert.strictEqual(client.calls.length, 0);
  } finally { app.close(); }
});

test('limites : par visiteur (429) puis plafond quotidien (503)', async () => {
  const client = fakeClient(textReply('ok'));
  const one = [{ role: 'user', content: 'Bonjour' }];
  let s = await start({ client, rateLimit: { max: 2, windowMs: 60_000 }, maxPerDay: 100 });
  try {
    assert.strictEqual((await s.ask(one)).status, 200);
    assert.strictEqual((await s.ask(one)).status, 200);
    assert.strictEqual((await s.ask(one)).status, 429);
  } finally { s.app.close(); }
  s = await start({ client, rateLimit: { max: 50, windowMs: 60_000 }, maxPerDay: 1 });
  try {
    assert.strictEqual((await s.ask(one)).status, 200);
    const r = await s.ask(one);
    assert.strictEqual(r.status, 503);
    assert.match(r.body.error, /limite pour aujourd’hui/);
  } finally { s.app.close(); }
});

test('le widget est servi et n’utilise pas innerHTML pour le texte des messages', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'js', 'jessica.js'), 'utf8');
  assert.match(js, /\/api\/chat/);
  assert.ok(!/innerHTML\s*=\s*[^\s'"]/.test(js), 'innerHTML seulement avec des chaînes fixes');
});

test('BOOKING_URL : seules les pages Google Agenda sont acceptées', () => {
  assert.strictEqual(bookingUrlFromEnv({ BOOKING_URL: 'https://calendar.app.google/AbC123xyz' }), 'https://calendar.app.google/AbC123xyz');
  assert.strictEqual(bookingUrlFromEnv({ BOOKING_URL: ' https://calendar.google.com/calendar/appointments/schedules/AcZ_x1?gv=true ' }),
    'https://calendar.google.com/calendar/appointments/schedules/AcZ_x1?gv=true');
  for (const bad of ['', 'http://calendar.app.google/x', 'https://evil.example/calendar.app.google/x', 'https://calendar.app.google/x"onclick', 'javascript:alert(1)']) {
    assert.strictEqual(bookingUrlFromEnv({ BOOKING_URL: bad }), '', bad);
  }
});

test('avec BOOKING_URL : Jessica donne le lien de l’agenda et le widget le reçoit', async () => {
  const client = fakeClient(textReply('ok'));
  const url = 'https://calendar.app.google/AbC123xyz';
  const { app, base, ask } = await start({ client, bookingUrl: url });
  try {
    assert.deepStrictEqual(await (await fetch(base)).json(), { ok: true, enabled: true, bookingUrl: url });
    await ask([{ role: 'user', content: 'Je veux un rendez-vous' }]);
    assert.ok(client.calls[0].system.includes(`Réservation directe`));
    assert.ok(client.calls[0].system.includes(url));
    assert.match(client.calls[0].system, /ne propose jamais de date ni d’heure/);
  } finally { app.close(); }
  const s2 = await start({ client: fakeClient(textReply('ok')), bookingUrl: 'https://evil.example/x' });
  try {
    assert.deepStrictEqual(await (await fetch(s2.base)).json(), { ok: true, enabled: true, bookingUrl: '' });
  } finally { s2.app.close(); }
});
