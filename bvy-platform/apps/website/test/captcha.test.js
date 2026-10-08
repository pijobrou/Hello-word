'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server.js');
const { captchaConfigFromEnv, verifyCaptcha } = require('../captcha.js');

const CFG = { provider: 'recaptcha', siteKey: 'cle-publique-test', secret: 'secret-test', hostname: 'bvyaccountingtax.ca' };
const TOKEN = 'jeton-valide-'.padEnd(40, 'x');

test('configuration : rien sans les trois variables ; jamais la clé secrète dans la page', () => {
  assert.strictEqual(captchaConfigFromEnv({}), null);
  assert.strictEqual(captchaConfigFromEnv({ CAPTCHA_PROVIDER: 'recaptcha', CAPTCHA_SITE_KEY: 'a' }), null);
  assert.strictEqual(captchaConfigFromEnv({ CAPTCHA_PROVIDER: 'autre', CAPTCHA_SITE_KEY: 'a', CAPTCHA_SECRET: 'b' }), null);
  assert.strictEqual(captchaConfigFromEnv({ CAPTCHA_PROVIDER: 'hCaptcha', CAPTCHA_SITE_KEY: 'a', CAPTCHA_SECRET: 'b' }).provider, 'hcaptcha');
});

test('vérification auprès du fournisseur : succès, refus, mauvais site, service injoignable', async () => {
  const sent = [];
  const reply = (data) => async (url, opts) => { sent.push({ url, body: opts.body }); return { json: async () => data }; };
  assert.deepStrictEqual(await verifyCaptcha(CFG, TOKEN, '1.2.3.4', { fetchImpl: reply({ success: true, hostname: 'bvyaccountingtax.ca' }) }), { ok: true, checked: true });
  assert.match(sent[0].url, /google\.com\/recaptcha\/api\/siteverify/);
  assert.match(sent[0].body, /secret=secret-test/); assert.match(sent[0].body, /remoteip=1\.2\.3\.4/);
  assert.deepStrictEqual(await verifyCaptcha(CFG, TOKEN, '', { fetchImpl: reply({ success: false }) }), { ok: false });
  assert.deepStrictEqual(await verifyCaptcha(CFG, TOKEN, '', { fetchImpl: reply({ success: true, hostname: 'site-copie.example' }) }), { ok: false }, 'jeton obtenu sur un autre site');
  assert.deepStrictEqual(await verifyCaptcha(CFG, '', '', { fetchImpl: reply({ success: true }) }), { ok: false });
  assert.deepStrictEqual(await verifyCaptcha(CFG, TOKEN, '', { fetchImpl: async () => { throw new Error('réseau'); } }), { ok: true, checked: false });
  await verifyCaptcha({ ...CFG, provider: 'hcaptcha' }, TOKEN, '', { fetchImpl: reply({ success: true }) });
  assert.match(sent.at(-1).url, /api\.hcaptcha\.com\/siteverify/); assert.match(sent.at(-1).body, /sitekey=cle-publique-test/);
});

test('formulaire : sans la case cochée, refusé ; cochée, accepté et noté dans la demande', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bvy-captcha-'));
  const app = createServer({ port: 0, dataDir, smtp: null, webhookUrl: '', receivesMail: async () => 'yes', captcha: CFG,
    captchaFetch: async (url, opts) => ({ json: async () => ({ success: new URLSearchParams(opts.body).get('response') === TOKEN, hostname: 'bvyaccountingtax.ca' }) }) });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${app.address().port}`;
  const post = (body) => fetch(`${base}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json() }));
  const lead = { prenom: 'Marie', nom: 'Tremblay', courriel: 'marie@entreprise.ca', telephone: '418 387-2001', consentement: true, _t: '20000' };
  try {
    let r = await fetch(`${base}/api/captcha`).then((x) => x.json());
    assert.deepStrictEqual(r, { provider: 'recaptcha', siteKey: 'cle-publique-test' });
    r = await post(lead);
    assert.strictEqual(r.status, 422); assert.match(r.body.errors.captcha, /Je ne suis pas un robot/);
    r = await post({ ...lead, captcha: 'faux-jeton'.padEnd(40, 'y') });
    assert.strictEqual(r.status, 422);
    r = await post({ ...lead, 'g-recaptcha-response': TOKEN });
    assert.strictEqual(r.status, 201);
    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'leads.jsonl'), 'utf8').trim());
    assert.strictEqual(saved.verification.robot, 'vérifié');
    const page = await fetch(`${base}/contact/`);
    assert.match(page.headers.get('content-security-policy'), /www\.google\.com\/recaptcha\//);
    const other = await fetch(`${base}/services/`);
    assert.doesNotMatch(other.headers.get('content-security-policy'), /recaptcha/, 'les autres pages gardent la politique stricte');
  } finally { app.close(); }
});

test('nginx : même politique que le serveur Node, élargie seulement aux pages du formulaire', () => {
  const { FORM_CSP } = require('../captcha.js');
  const { SECURITY_HEADERS } = require('../server.js');
  for (const f of ['bvyaccountingtax.ca.conf', 'bvyaccountingtax.ca.http-only.conf']) {
    const conf = fs.readFileSync(path.join(__dirname, '../../../tools/deployment/nginx', f), 'utf8');
    assert.ok(conf.includes(`"~^/(contact|rendez-vous)/(index\\.html)?$" "${FORM_CSP}";`), f);
    assert.ok(conf.includes(`default "${SECURITY_HEADERS['Content-Security-Policy']}";`), f);
    assert.match(conf, /add_header Content-Security-Policy \$bvy_csp always;/);
  }
});
