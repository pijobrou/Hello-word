'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { buildReport, parseLine, family } = require('../veille.js');

const NOW = Date.UTC(2026, 9, 8, 11, 0);
const L = (ip, when, req, status, ua) => `${ip} - - [${when} -0400] "${req} HTTP/1.1" ${status} 100 "-" "${ua}"`;

test('lecture des journaux nginx (fuseau compris)', () => {
  const x = parseLine(L('203.0.113.9', '08/Oct/2026:06:30:00', 'GET /acces-reserve/', 403, 'Mozilla/5.0'));
  assert.deepStrictEqual(x, { ip: '203.0.113.9', at: Date.UTC(2026, 9, 8, 10, 30), method: 'GET', path: '/acces-reserve/', status: 403, ua: 'Mozilla/5.0' });
  assert.strictEqual(family('Mozilla/5.0 (compatible; GPTBot/1.2)'), 'GPTBot');
  assert.strictEqual(parseLine('pas une ligne'), null);
});

test('rapport : compte robots, failles, fausses demandes ; alerte seulement quand il le faut', () => {
  const site = [
    L('192.0.2.1', '08/Oct/2026:06:00:00', 'GET /', 200, 'Mozilla/5.0 Firefox'),
    L('192.0.2.2', '08/Oct/2026:06:01:00', 'GET /services/', 200, 'Mozilla/5.0 Safari'),
    L('198.51.100.7', '08/Oct/2026:06:02:00', 'GET /', 403, 'Mozilla/5.0 (compatible; GPTBot/1.2)'),
    L('198.51.100.8', '08/Oct/2026:06:03:00', 'GET /', 403, 'python-requests/2.31'),
    L('192.0.2.1', '01/Oct/2026:06:00:00', 'GET /', 403, 'GPTBot'), // plus de 24 h : ignoré
  ];
  const trap = [L('203.0.113.9', '08/Oct/2026:05:00:00', 'GET /acces-reserve/', 403, 'Mozilla/5.0'), L('203.0.113.10', '08/Oct/2026:05:10:00', 'GET /wp-login.php', 444, 'curl/8')];
  const spam = [{ reason: 'modèle de pourriel « votre prix »', receivedAt: '2026-10-08T09:00:00Z' }, { reason: 'plusieurs signes : x', receivedAt: '2026-10-08T09:30:00Z' }];
  const r = buildReport({ now: NOW, site, trap, spam, leads: 2, bans: { 'bvy-piege': 2, sshd: 1 }, health: { site: true, portal: true }, certDays: 60 });
  assert.match(r.subject, /2026-10-08 — Rien d’anormal/);
  assert.match(r.text, /Visiteurs \(adresses distinctes\) : 2 · Demandes de consultation reçues : 2/);
  assert.match(r.text, /refusés : 2\n   - GPTBot : 1\n   - python-requests : 1/);
  assert.match(r.text, /failles et piège à robots : 2 \(2 adresses/);
  assert.match(r.text, /Fausses demandes de consultation ignorées : 2/);
  assert.match(r.text, /bvy-piege 2 · sshd 1/);
  assert.deepStrictEqual(r.alerts, []);

  const bad = buildReport({ now: NOW, health: { site: false, portal: true }, certDays: 9, bans: null });
  assert.match(bad.subject, /À VÉRIFIER/);
  assert.strictEqual(bad.alerts.length, 3);
  assert.match(bad.text, /certificat HTTPS expire dans 9/i);
  assert.match(bad.text, /fail2ban ne répond pas/);
});
