// Captures « Votre avis » (client) et « Avis des utilisateurs » (administrateur) → review/portal-avis/
const path = require('path'); const fs = require('fs'); const os = require('os');
const APP = path.resolve(__dirname, '../../apps/portal');
const OUT = path.resolve(__dirname, '../../review/portal-avis');
const { createServer } = require(path.join(APP, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.resolve(__dirname, '../../apps/website/node_modules/playwright'))); }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const NOW = Date.UTC(2025, 9, 6, 14, 0);
  const mails = []; const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shotsB-'));
  const probe = createServer({ port: 0, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'probe-')), smtp: null, sendMail: async () => {}, publicUrl: 'http://localhost:1' });
  await new Promise((r) => probe.listen(0, '127.0.0.1', r)); const port = probe.address().port; probe.close();
  const srv = createServer({ port, dataDir, smtp: null, sendMail: async (m) => mails.push(m), publicUrl: `http://localhost:${port}` , now: () => NOW });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  const acc = srv.accounts; const PW = 'une phrase assez longue';
  const mk = (email, name, role, clientId) => { const { token } = acc.invite(null, { email, name, role, clientId }); return acc.acceptInvite(token, PW); };
  const admin = mk('pierre@bvy.ca', 'Pierre-Joseph Brouillette', 'admin');
  const soc = acc.createClient(admin, 'Résidence Fictive inc.');
    const marie = mk('marie@fictive.ca', 'Marie Tremblay', 'client', soc.id);
  const lise = mk('lise@bvy.ca', 'Lise Comptable', 'bookkeeper');
  srv.feedback.submit(marie, { topic: 'difficile', ease: '2', page: 'Documents', message: 'Je ne trouve pas où déposer mes factures du mois.' });
  srv.feedback.submit(lise, { topic: 'idee', ease: '4', page: 'Conciliation', message: 'Pouvoir ouvrir directement le relevé PDF à côté des écarts.' });
  srv.feedback.submit(marie, { topic: 'merci', ease: '5', message: 'Le résumé du mois est très clair, merci !' });
  const fid = srv.db.prepare("SELECT id FROM feedback WHERE topic = 'difficile'").get().id;
  srv.feedback.answer(admin, fid, { status: 'planned', reply: 'Merci ! Un bouton « Déposer un document » sera ajouté sur l’accueil.' });
  const B = `http://localhost:${port}`; const br = await chromium.launch();
  const lastCode = () => mails.filter((m) => /code BVY/.test(m.subject)).pop().subject.match(/(\d{6})/)[1];
  async function login(page, email) {
    await page.goto(`${B}/connexion`); await page.fill('#email', email); await page.fill('#password', PW);
    await page.click('button[type=submit]'); await page.waitForURL(/verification/); await page.fill('#code', lastCode()); await page.click('button[type=submit]'); await page.waitForURL(/accueil/);
  }
  const problems = [];
  const shot = async (p, name, vp) => { await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}-${vp}.png`, fullPage: true });
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement ${name}`, ...(process.env.OVF ? await require(process.env.OVF)(p) : [])); };
  for (const [vp, w, h] of [['bureau', 1440, 900], ['mobile', 390, 844]]) {
    const ctx = await br.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
    await login(p, 'marie@fictive.ca');
    await p.goto(`${B}/avis`); await shot(p, '01-votre-avis-client', vp);
    const ctx2 = await br.newContext({ viewport: { width: w, height: h } }); const q = await ctx2.newPage();
    await login(q, 'pierre@bvy.ca');
    await q.goto(`${B}/admin/avis`); await shot(q, '02-avis-administration', vp);
  }
  console.log('problèmes', problems); await br.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
