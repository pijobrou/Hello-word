// Captures du formulaire de consultation avec les vérifications (courriel, téléphone) → review/site-verification/
const path = require('path'); const fs = require('fs'); const os = require('os');
const SITE = path.resolve(__dirname, '../../apps/website');
const OUT = path.resolve(__dirname, '../../review/site-verification');
const { createServer } = require(path.join(SITE, 'server.js'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(SITE, 'node_modules/playwright'))); }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const app = createServer({ port: 0, dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'site-')), smtp: null, webhookUrl: '', receivesMail: async (d) => (d === 'entreprise-inexistante.ca' ? 'no' : 'yes') });
  await new Promise((r) => app.listen(0, '127.0.0.1', r));
  const B = `http://127.0.0.1:${app.address().port}`;
  const br = await chromium.launch(); const problems = [];
  for (const [vp, w, h] of [['bureau', 1440, 900], ['mobile', 390, 844]]) {
    const p = await (await br.newContext({ viewport: { width: w, height: h }, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' })).newPage();
    await p.goto(`${B}/contact/`);
    const form = p.locator('#contact-form');
    await p.fill('#f-prenom', 'Marie'); await p.fill('#f-nom', 'Tremblay');
    await p.fill('#f-courriel', 'marie@gmial.com'); await p.fill('#f-tel', '514-555-0100'); await p.click('#f-ent');
    await p.waitForTimeout(200); await form.screenshot({ path: `${OUT}/01-erreurs-${vp}.png` });
    await p.click('#f-courriel + .err button');
    await p.fill('#f-tel', '4183872001'); await p.click('#f-ent');
    await p.check('#f-consent'); await p.waitForTimeout(3100);
    await p.click('#contact-form button[type=submit]'); await p.waitForTimeout(600);
    await form.screenshot({ path: `${OUT}/02-envoye-${vp}.png` });
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${vp} débordement`);
  }
  console.log('problèmes', problems); await br.close(); app.close();
})().catch((e) => { console.error(e); process.exit(1); });
