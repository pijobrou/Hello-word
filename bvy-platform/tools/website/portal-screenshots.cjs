const path = require('path');
const fs = require('fs'); const os = require('os');
// Captures du portail (phase 2) : node --disable-warning=ExperimentalWarning tools/website/portal-screenshots.cjs
// Playwright requis (npm i -g playwright, ou le node_modules du site). Écrit dans review/portal-auth/.
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-auth');
const { createServer } = require(path.join(APP, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
const C = require(path.join(APP, 'lib/crypto.js'));
(async () => {
  const mails = [];
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shots-'));
  let srv = createServer({ port: 0, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: 'http://localhost:1' });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port; srv.close();
  srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}` });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const PW = 'une phrase assez longue';
  const { token } = acc.invite(null, { email: 'pierre@bvy.ca', name: 'Pierre-Jean Brouillette', role: 'admin' });
  const admin = acc.acceptInvite(token, PW);
  const a = acc.createClient(admin, 'Atelier Boréal inc.'); acc.createClient(admin, 'Boutique Laurentides inc.'); acc.createClient(admin, 'Agence Cap-Rouge inc.');
  const inv = acc.invite(admin, { email: 'marie@atelierboreal.ca', name: 'Marie-Ève Bouchard', role: 'client', clientId: a.id });
  acc.acceptInvite(inv.token, PW);
  acc.invite(admin, { email: 'julie@bvy.ca', name: 'Julie Gagnon', role: 'bookkeeper' });
  const pending = acc.invite(admin, { email: 'luc@atelierboreal.ca', name: 'Luc Bouchard', role: 'client', clientId: a.id });
  const B = `http://localhost:${port}`;
  const b = await chromium.launch();
  const shot = async (page, name) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true }); console.log('✔', name); };
  const lastCode = () => mails[mails.length - 1].subject.match(/(\d{6})/)[1];
  async function login(page, email) {
    await page.goto(`${B}/connexion`); await page.fill('#email', email); await page.fill('#password', PW);
    await page.click('button[type=submit]'); await page.waitForURL(/verification/);
  }
  for (const [vp, w, h] of [['bureau', 1440, 900], ['mobile', 390, 844]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true });
    const page = await ctx.newPage();
    const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    await page.goto(`${B}/connexion`); await shot(page, `01-connexion-${vp}`);
    await login(page, 'pierre@bvy.ca'); await shot(page, `02-verification-${vp}`);
    await page.fill('#code', lastCode()); await page.click('button[type=submit]'); await page.waitForURL(/accueil/);
    await shot(page, `03-accueil-equipe-${vp}`);
    await page.goto(`${B}/admin`); await shot(page, `04-administration-${vp}`);
    await page.goto(`${B}/compte`);
    if (vp === 'bureau') { await page.click('text=Configurer l’application'); await page.waitForURL(/compte/); await page.goto(`${B}/compte`); }
    await shot(page, `05-mon-compte-${vp}`);
    console.log(vp, 'débordement compte', await page.evaluate(() => document.documentElement.scrollWidth > innerWidth));
    const c2 = await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true }); const p2 = await c2.newPage();
    await login(p2, 'marie@atelierboreal.ca'); await p2.fill('#code', lastCode()); await p2.click('button[type=submit]'); await p2.waitForURL(/accueil/);
    await shot(p2, `06-accueil-client-${vp}`);
    await p2.goto(`${B}/admin`); await shot(p2, `07-acces-refuse-client-${vp}`);
    const p3 = await (await b.newContext({ viewport: { width: w, height: h }, ignoreHTTPSErrors: true })).newPage();
    await p3.goto(`${B}/invitation?jeton=${encodeURIComponent(pending.token)}`); await shot(p3, `08-invitation-${vp}`);
    const overflow = await p2.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log(vp, 'débordement', overflow, 'erreurs', errs.filter((e) => !/fonts|ERR_/.test(e)));
    await ctx.close(); await c2.close();
  }
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
