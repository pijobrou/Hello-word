'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { createGoogle } = require('../google.js');
const { createBooking, freeSlots, zonedToUtc, isoLocal, formatFr, appointmentMessages } = require('../booking.js');

const TZ = 'America/Toronto';
const CFG = { timeZone: TZ, startHour: 8, endHour: 17, durationMin: 30, daysAhead: 14, minLeadHours: 18, maxPerDay: 15 };
// Lundi 5 octobre 2026, 8 h (heure du Québec, UTC-4)
const NOW = Date.UTC(2026, 9, 5, 12, 0);

test('fuseau du Québec : heure avancée et heure normale', () => {
  assert.strictEqual(zonedToUtc(2026, 10, 7, 10, 0, TZ), Date.UTC(2026, 9, 7, 14, 0));
  assert.strictEqual(zonedToUtc(2026, 12, 1, 10, 0, TZ), Date.UTC(2026, 11, 1, 15, 0));
  assert.strictEqual(isoLocal(Date.UTC(2026, 9, 7, 14, 0), TZ), '2026-10-07T10:00:00-04:00');
  assert.strictEqual(isoLocal(Date.UTC(2026, 11, 1, 15, 30), TZ), '2026-12-01T10:30:00-05:00');
  assert.strictEqual(formatFr(Date.UTC(2026, 9, 7, 14, 0), TZ), 'mercredi 7 octobre 2026 à 10 h 00');
});

test('créneaux : jours ouvrables, heures d’ouverture, délai minimal, périodes occupées exclues', () => {
  const busy = [{ start: Date.UTC(2026, 9, 6, 14, 0), end: Date.UTC(2026, 9, 6, 15, 0) }]; // mardi 10 h – 11 h
  const slots = freeSlots(CFG, NOW, busy).map((s) => isoLocal(s.start, TZ));
  assert.strictEqual(slots[0], '2026-10-06T08:00:00-04:00'); // rien le lundi (délai de 18 h)
  assert.ok(!slots.includes('2026-10-06T10:00:00-04:00'));
  assert.ok(!slots.includes('2026-10-06T10:30:00-04:00'));
  assert.ok(slots.includes('2026-10-06T11:00:00-04:00'));
  assert.ok(slots.includes('2026-10-06T16:30:00-04:00'));
  assert.ok(!slots.includes('2026-10-06T17:00:00-04:00'));
  assert.ok(!slots.some((s) => s.startsWith('2026-10-10') || s.startsWith('2026-10-11'))); // fin de semaine
});

function fakeGoogleApi() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const log = { token: 0, events: [], rows: [], freeBusy: 0, busy: [] };
  const fetchImpl = async (url, opts) => {
    const json = (status, body) => ({ ok: status < 300, status, json: async () => body });
    if (url === 'https://oauth2.googleapis.com/token') {
      const jwt = new URLSearchParams(opts.body).get('assertion').split('.');
      const ok = crypto.createVerify('RSA-SHA256').update(`${jwt[0]}.${jwt[1]}`).verify(publicKey, Buffer.from(jwt[2], 'base64url'));
      const claims = JSON.parse(Buffer.from(jwt[1], 'base64url').toString());
      assert.ok(ok, 'signature JWT valide');
      assert.strictEqual(claims.iss, 'jessica@bvy.iam.gserviceaccount.com');
      log.token += 1;
      return json(200, { access_token: 'tok', expires_in: 3600 });
    }
    assert.strictEqual(opts.headers.Authorization, 'Bearer tok');
    if (url.endsWith('/freeBusy')) {
      log.freeBusy += 1;
      return json(200, { calendars: { 'bvypjb@gmail.com': { busy: log.busy.map((b) => ({ start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString() })) } } });
    }
    if (url.includes('/calendars/bvypjb%40gmail.com/events')) {
      const ev = JSON.parse(opts.body); log.events.push(ev);
      log.busy.push({ start: Date.parse(ev.start.dateTime), end: Date.parse(ev.end.dateTime) });
      return json(200, { id: `ev${log.events.length}` });
    }
    if (url.includes('sheets.googleapis.com/v4/spreadsheets/SHEET/values/A1:append')) {
      log.rows.push(JSON.parse(opts.body).values[0]);
      return json(200, {});
    }
    return json(404, { error: { message: 'inconnu' } });
  };
  const google = createGoogle({ clientEmail: 'jessica@bvy.iam.gserviceaccount.com', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }), calendarId: 'bvypjb@gmail.com', sheetId: 'SHEET' },
    { fetchImpl, now: () => NOW });
  return { google, log };
}

const person = { prenom: 'Marie', nom: 'Tremblay', courriel: 'Marie@Ex.ca', telephone: '418 555-1234', sujet: '=HYPERLINK("x") boutique Shopify', consentement: true };

test('réservation : agenda, feuille Google, copie locale et courriels ; garde-fous serveur', async () => {
  const { google, log } = fakeGoogleApi();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-rdv-'));
  const mails = [];
  const b = createBooking(CFG, { google, dataDir, now: () => NOW, mail: async (r) => { mails.push(r); } });

  const list = await b.runTool('voir_disponibilites', {}, '1.1.1.1');
  assert.strictEqual(list.ok, true);
  assert.strictEqual(list.jours[0].moments[0], '2026-10-06T08:00:00-04:00');

  assert.match((await b.runTool('reserver_rendez_vous', { ...person, debut: '2026-10-06T08:00:00-04:00', consentement: false }, '1.1.1.1')).erreur, /accord/);
  assert.match((await b.runTool('reserver_rendez_vous', { ...person, debut: '2026-10-06T08:00:00-04:00', telephone: '123' }, '1.1.1.1')).erreur, /téléphone/);
  assert.match((await b.runTool('reserver_rendez_vous', { ...person, debut: '2026-10-05T09:00:00-04:00' }, '1.1.1.1')).erreur, /plus libre/);
  assert.match((await b.runTool('reserver_rendez_vous', { ...person, debut: '2026-10-10T09:00:00-04:00' }, '1.1.1.1')).erreur, /plus libre/); // samedi
  assert.strictEqual(log.events.length, 0);

  const ok = await b.runTool('reserver_rendez_vous', { ...person, debut: '2026-10-06T08:00:00-04:00' }, '1.1.1.1');
  assert.strictEqual(ok.ok, true, JSON.stringify(ok));
  assert.match(ok.confirmation, /mardi 6 octobre 2026 à 8 h 00/);
  assert.strictEqual(log.events.length, 1);
  assert.strictEqual(log.events[0].summary, 'Consultation BVY — Marie Tremblay');
  assert.match(log.events[0].description, /Téléphone : \(418\) 555-1234/);
  assert.strictEqual(log.events[0].start.dateTime, '2026-10-06T12:00:00.000Z');
  assert.strictEqual(log.rows.length, 1);
  assert.strictEqual(log.rows[0][4], 'marie@ex.ca');
  assert.strictEqual(log.rows[0][6], '\'=HYPERLINK("x") boutique Shopify'); // pas de formule
  assert.strictEqual(log.token, 1, 'jeton réutilisé');
  const local = fs.readFileSync(path.join(dataDir, 'rendez-vous.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.strictEqual(local[0].courriel, 'marie@ex.ca');
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(mails.length, 1);

  // Le même moment n'est plus libre ; même courriel le même jour refusé ; 2 réservations max par IP.
  assert.match((await b.runTool('reserver_rendez_vous', { ...person, courriel: 'autre@ex.ca', debut: '2026-10-06T08:00:00-04:00' }, '2.2.2.2')).erreur, /plus libre/);
  assert.match((await b.runTool('reserver_rendez_vous', { ...person, debut: '2026-10-06T09:00:00-04:00' }, '2.2.2.2')).erreur, /déjà été réservé/);
  assert.strictEqual((await b.runTool('reserver_rendez_vous', { ...person, courriel: 'b@ex.ca', debut: '2026-10-06T09:00:00-04:00' }, '1.1.1.1')).ok, true);
  assert.match((await b.runTool('reserver_rendez_vous', { ...person, courriel: 'c@ex.ca', debut: '2026-10-06T09:30:00-04:00' }, '1.1.1.1')).erreur, /trop de réservations/);
});

test('agenda indisponible : erreur rendue au modèle, jamais d’exception', async () => {
  const google = { busy: async () => { throw new Error('Google 403 : forbidden'); } };
  const b = createBooking(CFG, { google, dataDir: os.tmpdir(), now: () => NOW });
  const errors = console.error; console.error = () => {};
  try {
    const r = await b.runTool('voir_disponibilites', {}, 'x');
    assert.strictEqual(r.ok, false);
    assert.match(r.erreur, /formulaire/);
  } finally { console.error = errors; }
});

test('courriels du rendez-vous : client (sans recopier le besoin) et équipe', () => {
  const r = { prenom: 'Marie', nom: 'T', courriel: 'm@ex.ca', telephone: '418 555-1234', sujet: 'SECRET', rendezVous: 'mardi 6 octobre 2026 à 8 h 00' };
  const { client, team } = appointmentMessages(r, { replyTo: 'bvypjb@protonmail.com' });
  assert.deepStrictEqual(client.to, ['m@ex.ca']);
  assert.match(client.text, /mardi 6 octobre 2026 à 8 h 00 \(heure du Québec\)/);
  assert.match(client.text, /vous appellera au 418 555-1234/);
  assert.ok(!client.text.includes('SECRET'));
  assert.strictEqual(team.replyTo, 'm@ex.ca');
  assert.match(team.text, /Besoin : SECRET/);
});

test('Jessica réserve via ses outils : boucle d’outils complète à travers /api/chat', async () => {
  const { google, log } = fakeGoogleApi();
  const calls = [];
  const replies = [
    { stop_reason: 'tool_use', content: [{ type: 'thinking', thinking: '' }, { type: 'tool_use', id: 't1', name: 'voir_disponibilites', input: {} }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'reserver_rendez_vous', input: { ...person, debut: '2026-10-06T08:00:00-04:00' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'C’est réservé pour mardi 6 octobre à 8 h.' }] },
  ];
  const client = { beta: { messages: { create: async (p) => { calls.push(structuredClone(p)); return replies[calls.length - 1]; } } } };
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-rdv-'));
  const app = createServer({ port: 0, receivesMail: async () => 'yes', dataDir, smtp: null, webhookUrl: '', google, now: () => NOW,
    chat: { client, bookingUrl: '', rateLimit: { max: 50, windowMs: 60_000 }, maxPerDay: 100 } });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}/api/chat`;
  try {
    assert.deepStrictEqual(await (await fetch(base)).json(), { ok: true, enabled: true, bookingUrl: '', booking: true });
    const res = await fetch(base, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Oui, je confirme.' }] }) });
    const body = await res.json();
    assert.strictEqual(body.reply, 'C’est réservé pour mardi 6 octobre à 8 h.');
    assert.strictEqual(calls.length, 3);
    assert.deepStrictEqual(calls[0].tools.map((t) => t.name), ['voir_disponibilites', 'reserver_rendez_vous']);
    assert.match(calls[0].system, /Prise de rendez-vous dans la conversation/);
    assert.ok(!calls[0].system.includes('Tu ne peux ni réserver un rendez-vous'));
    // Le contenu de l'assistant (bloc de réflexion compris) est renvoyé tel quel, suivi des résultats d'outils.
    assert.deepStrictEqual(calls[1].messages[1], { role: 'assistant', content: replies[0].content });
    assert.strictEqual(calls[1].messages[2].content[0].tool_use_id, 't1');
    assert.strictEqual(JSON.parse(calls[2].messages[4].content[0].content).ok, true);
    assert.strictEqual(log.events.length, 1);
  } finally { app.close(); }
});
