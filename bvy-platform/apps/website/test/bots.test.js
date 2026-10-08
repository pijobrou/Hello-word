'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { AI_CRAWLERS, BLOCKED_AGENTS, isBlockedAgent, robotsTxt, tdmrepJson } = require('../bots.js');

test('isBlockedAgent : robots d’IA et aspirateurs refusés, navigateurs et moteurs de recherche permis', () => {
  for (const ua of ['Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'ClaudeBot/1.0',
    'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0)', 'CCBot/2.0',
    'python-requests/2.32.3', 'Scrapy/2.11', 'Mozilla/5.0 HeadlessChrome/120.0', 'meta-externalagent/1.1']) {
    assert.ok(isBlockedAgent(ua), ua);
  }
  for (const ua of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0)', 'curl/8.5.0', '', undefined]) {
    assert.ok(!isBlockedAgent(ua), String(ua));
  }
});

test('robots.txt : moteurs permis, chaque robot d’IA interdit partout', () => {
  const txt = robotsTxt('https://bvyaccountingtax.ca');
  assert.match(txt, /User-agent: \*\nContent-Signal: search=yes, ai-train=no, ai-input=no\nDisallow: \/portail-comptable\/\nDisallow: \/api\/\n/);
  for (const a of AI_CRAWLERS) assert.ok(txt.includes(`User-agent: ${a}\n`), a);
  assert.match(txt, /User-agent: Crawl4AI\nDisallow: \/\n/);
  assert.match(txt, /Sitemap: https:\/\/bvyaccountingtax\.ca\/sitemap\.xml/);
  assert.deepStrictEqual(JSON.parse(tdmrepJson()), [{ location: '/*', 'tdm-reservation': 1 }]);
});

test('les modèles nginx refusent exactement la même liste que bots.js', () => {
  const dir = path.join(__dirname, '..', '..', '..', 'tools', 'deployment', 'nginx');
  for (const f of ['bvyaccountingtax.ca.conf', 'bvyaccountingtax.ca.http-only.conf']) {
    const conf = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = conf.match(/"~\*\(([^)]+)\)" 1;/);
    assert.ok(m, `${f} : map $bvy_robot_refuse absente`);
    assert.deepStrictEqual(m[1].split('|'), [...BLOCKED_AGENTS], f);
    assert.strictEqual((conf.match(/if \(\$bvy_robot_refuse\) \{ return 403; \}/g) || []).length, 3, f);
    assert.match(conf, /location = \/robots\.txt/);
    assert.match(conf, /add_header X-Robots-Tag "noai, noimageai" always;/);
  }
});

test('l’API refuse les robots (403) et tout le site envoie les en-têtes noai / tdm-reservation', async () => {
  const pub = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-pub-'));
  fs.writeFileSync(path.join(pub, 'index.html'), '<!doctype html><title>x</title>');
  const app = createServer({ port: 0, receivesMail: async () => 'yes', publicDir: pub, smtp: null, webhookUrl: '' });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  try {
    const bot = await fetch(`${base}/api/chat`, { headers: { 'User-Agent': 'GPTBot/1.2' } });
    assert.strictEqual(bot.status, 403);
    const form = await fetch(`${base}/api/contact`, { method: 'POST', headers: { 'User-Agent': 'python-requests/2.32', 'Content-Type': 'application/json' }, body: '{}' });
    assert.strictEqual(form.status, 403);
    const human = await fetch(`${base}/api/health`, { headers: { 'User-Agent': 'Mozilla/5.0 Chrome/130' } });
    assert.strictEqual(human.status, 200);
    const page = await fetch(`${base}/`);
    assert.strictEqual(page.headers.get('x-robots-tag'), 'noai, noimageai');
    assert.strictEqual(page.headers.get('tdm-reservation'), '1');
  } finally { app.close(); }
});

test('le site construit contient robots.txt, tdmrep.json et les balises noai', () => {
  const pub = path.join(__dirname, '..', 'public');
  assert.ok(fs.readFileSync(path.join(pub, 'robots.txt'), 'utf8').includes('User-agent: GPTBot\n'));
  assert.ok(fs.existsSync(path.join(pub, '.well-known', 'tdmrep.json')));
  const html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  assert.match(html, /<meta name="robots" content="noai, noimageai">/);
  assert.match(html, /<meta name="tdm-reservation" content="1">/);
});
