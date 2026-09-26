// Captures d'écran de revue (bureau + mobile) du site public BVY.
// Usage : node tools/website/screenshots.mjs [dossier-sortie]   (Playwright + Chromium requis)
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { createServer } = require('../../apps/website/server.js');
const out = path.resolve(process.argv[2] || path.join(here, '../../review/screenshots'));
fs.mkdirSync(out, { recursive: true });

const PAGES = [
  ['accueil', '/'], ['services', '/services/'], ['plateforme', '/plateforme/'],
  ['fonctionnement', '/fonctionnement/'], ['tarifs', '/tarifs/'], ['contact', '/contact/'],
  ['connexion', '/connexion/'],
];
const VIEWPORTS = [['bureau', { width: 1440, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]];

const server = createServer({ port: 0, host: '127.0.0.1', dataDir: fs.mkdtempSync('/tmp/bvy-shots-') });
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];
for (const [vpName, viewport, isMobile] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1, reducedMotion: 'reduce', ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === '1' });
  for (const [name, url] of PAGES) {
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${vpName} ${url}: ${m.text()}`); });
    page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) problems.push(`${vpName} ${url}: échec ${r.url()}`); });
    const res = await page.goto(base + url, { waitUntil: 'networkidle' }).catch((e) => ({ status: () => e.message }));
    if (res.status() !== 200) problems.push(`${vpName} ${url}: HTTP ${res.status()}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) problems.push(`${vpName} ${url}: défilement horizontal de ${overflow}px`);
    const file = path.join(out, `${vpName}-${name}.jpg`);
    await page.screenshot({ path: file, fullPage: true, type: 'jpeg', quality: 72 });
    console.log('✔', path.relative(process.cwd(), file));
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.close();
if (problems.length) { console.log('\n⚠ Problèmes :\n' + problems.join('\n')); process.exitCode = 1; }
else console.log('\nAucun problème détecté (HTTP, console, débordement horizontal).');
