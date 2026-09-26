'use strict';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createServer, SECURITY_HEADERS } = require('../server.js');

function makePublicDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-public-'));
  fs.mkdirSync(path.join(dir, 'services'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>Accueil</title>');
  fs.writeFileSync(path.join(dir, 'services', 'index.html'), '<!doctype html><title>Services</title>');
  fs.writeFileSync(path.join(dir, '404.html'), '<!doctype html><title>Introuvable</title>PAGE-404');
  fs.writeFileSync(path.join(dir, 'assets', 'a.css'), 'body{color:#000}');
  return dir;
}

async function start(options) {
  const server = createServer({ port: 0, ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port };
}

function stop(server) {
  return new Promise((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}

// Raw http.request so paths like /../ are not normalised by the client.
function request(port, { method = 'GET', path: p = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

function postJson(port, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj);
  return request(port, {
    method: 'POST',
    path: '/api/contact',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Content-Length': Buffer.byteLength(body), ...extraHeaders },
    body,
  });
}

const validLead = {
  prenom: '  Marie ',
  nom: 'Tremblay',
  courriel: 'marie@example.com',
  telephone: '514-555-0100',
  entreprise: 'Boulangerie Tremblay',
  service: 'Tenue de livres',
  quickbooks: 'oui',
  region: 'Montréal',
  message: 'Bonjour, j’ai besoin d’aide.',
  consentement: true,
};

function readLeads(dataDir) {
  const file = path.join(dataDir, 'leads.jsonl');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

describe('BVY website server', () => {
  let publicDir;
  let dataDir;
  let server;
  let port;

  before(async () => {
    publicDir = makePublicDir();
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-data-'));
    ({ server, port } = await start({ publicDir, dataDir, webhookUrl: '', rateLimit: { max: 1000, windowMs: 60_000 } }));
  });

  after(async () => {
    await stop(server);
    fs.rmSync(publicDir, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  test('GET / serves index.html with security headers', async () => {
    const res = await request(port, { path: '/' });
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /^text\/html/);
    assert.match(res.body, /Accueil/);
    assert.strictEqual(res.headers['cache-control'], 'no-cache');
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      assert.strictEqual(res.headers[name.toLowerCase()], value, name);
    }
    assert.strictEqual(Number(res.headers['content-length']), Buffer.byteLength(res.body));
  });

  test('HEAD / returns headers only', async () => {
    const res = await request(port, { method: 'HEAD', path: '/' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body, '');
  });

  test('GET /api/health', async () => {
    const res = await request(port, { path: '/api/health' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(JSON.parse(res.body), { ok: true });
    assert.ok(res.headers['content-security-policy']);
  });

  test('/services redirects to /services/ keeping the querystring', async () => {
    const res = await request(port, { path: '/services?x=1' });
    assert.strictEqual(res.status, 301);
    assert.strictEqual(res.headers.location, '/services/?x=1');
  });

  test('/services/ serves the directory index', async () => {
    const res = await request(port, { path: '/services/' });
    assert.strictEqual(res.status, 200);
    assert.match(res.body, /Services/);
  });

  test('path traversal is rejected', async () => {
    for (const p of ['/../etc/passwd', '/%2e%2e/%2e%2e/etc/passwd', '/assets/..%2f..%2f..%2fetc%2fpasswd', '/%E0%A4%A']) {
      const res = await request(port, { path: p });
      assert.notStrictEqual(res.status, 200, p);
      assert.doesNotMatch(res.body, /root:/, p);
    }
  });

  test('unknown path returns the 404 page', async () => {
    const res = await request(port, { path: '/nexiste-pas' });
    assert.strictEqual(res.status, 404);
    assert.match(res.body, /PAGE-404/);
  });

  test('static assets get a long cache header and correct MIME', async () => {
    const res = await request(port, { path: '/assets/a.css' });
    assert.strictEqual(res.status, 200);
    assert.match(res.headers['content-type'], /^text\/css/);
    assert.strictEqual(res.headers['cache-control'], 'public, max-age=604800');
  });

  test('non-GET on static returns 405', async () => {
    const res = await request(port, { method: 'POST', path: '/' });
    assert.strictEqual(res.status, 405);
  });

  test('valid JSON lead is stored (201)', async () => {
    const res = await postJson(port, validLead, { 'User-Agent': 'test-agent' });
    assert.strictEqual(res.status, 201);
    assert.deepStrictEqual(JSON.parse(res.body), { ok: true });
    const leads = readLeads(dataDir);
    assert.strictEqual(leads.length, 1);
    assert.strictEqual(leads[0].prenom, 'Marie');
    assert.strictEqual(leads[0].courriel, 'marie@example.com');
    assert.strictEqual(leads[0].userAgent, 'test-agent');
    assert.ok(leads[0].ip);
    assert.ok(!Number.isNaN(Date.parse(leads[0].receivedAt)));
    if (process.platform !== 'win32') {
      assert.strictEqual(fs.statSync(path.join(dataDir, 'leads.jsonl')).mode & 0o777, 0o600);
    }
  });

  test('missing fields return 422 with errors', async () => {
    const before = readLeads(dataDir).length;
    const res = await postJson(port, { courriel: 'pas-un-courriel', quickbooks: 'peut-etre' });
    assert.strictEqual(res.status, 422);
    const json = JSON.parse(res.body);
    assert.strictEqual(json.ok, false);
    for (const key of ['prenom', 'nom', 'courriel', 'consentement', 'quickbooks']) {
      assert.ok(json.errors[key], key);
    }
    assert.strictEqual(readLeads(dataDir).length, before);
  });

  test('honeypot returns 200 and stores nothing', async () => {
    const before = readLeads(dataDir).length;
    const res = await postJson(port, { ...validLead, website: 'http://spam.example' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(JSON.parse(res.body), { ok: true });
    assert.strictEqual(readLeads(dataDir).length, before);
  });

  test('oversized body returns 413', async () => {
    const res = await postJson(port, { ...validLead, message: 'x'.repeat(20 * 1024) });
    assert.strictEqual(res.status, 413);
  });

  test('urlencoded form without JSON Accept redirects 303 to /contact/merci/', async () => {
    const body = new URLSearchParams({
      prenom: 'Jean', nom: 'Roy', courriel: 'jean@example.com', quickbooks: 'ne-sais-pas', consentement: 'on',
    }).toString();
    const res = await request(port, {
      method: 'POST',
      path: '/api/contact',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/html', 'Content-Length': Buffer.byteLength(body) },
      body,
    });
    assert.strictEqual(res.status, 303);
    assert.strictEqual(res.headers.location, '/contact/merci/');
    assert.ok(readLeads(dataDir).some((l) => l.courriel === 'jean@example.com'));
  });
});

test('rate limit returns 429 after max submissions', async () => {
  const publicDir = makePublicDir();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-data-'));
  const { server, port } = await start({ publicDir, dataDir, webhookUrl: '', rateLimit: { max: 2, windowMs: 60_000 } });
  try {
    assert.strictEqual((await postJson(port, validLead)).status, 201);
    assert.strictEqual((await postJson(port, {})).status, 422); // attempts count too
    const res = await postJson(port, validLead);
    assert.strictEqual(res.status, 429);
    assert.deepStrictEqual(JSON.parse(res.body), { ok: false, error: 'Trop de demandes. Réessayez plus tard.' });
    assert.strictEqual(readLeads(dataDir).length, 1);
  } finally {
    await stop(server);
    fs.rmSync(publicDir, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('lead is forwarded to the webhook', async () => {
  let resolveHook;
  const received = new Promise((r) => { resolveHook = r; });
  const hook = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      res.writeHead(204).end();
      resolveHook({ method: req.method, type: req.headers['content-type'], body: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
    });
  });
  await new Promise((r) => hook.listen(0, '127.0.0.1', r));
  const hookUrl = `http://127.0.0.1:${hook.address().port}/webhook`;

  const publicDir = makePublicDir();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-data-'));
  const { server, port } = await start({ publicDir, dataDir, webhookUrl: hookUrl });
  try {
    const res = await postJson(port, validLead);
    assert.strictEqual(res.status, 201);
    const got = await Promise.race([
      received,
      new Promise((_, rej) => setTimeout(() => rej(new Error('webhook not called')), 3000)),
    ]);
    assert.strictEqual(got.method, 'POST');
    assert.match(got.type, /application\/json/);
    assert.strictEqual(got.body.courriel, 'marie@example.com');
    assert.strictEqual(got.body.prenom, 'Marie');
    assert.ok(got.body.receivedAt);
  } finally {
    await stop(server);
    await stop(hook);
    fs.rmSync(publicDir, { recursive: true, force: true });
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
