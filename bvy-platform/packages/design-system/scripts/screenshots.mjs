// Captures de revue de gallery.html — bureau (1440 px) et mobile (390 px).
// Usage : node scripts/screenshots.mjs [dossier-sortie]
// Requiert Playwright (résolu depuis le dossier courant ou globalement) et Chromium.
// Variables : CHROMIUM_PATH (exécutable), IGNORE_HTTPS_ERRORS=1 (proxy de bac à sable pour Google Fonts).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from './tokens-lib.mjs';

const require = createRequire(path.join(process.cwd(), 'noop.js'));
const { chromium } = require('playwright');
const out = path.resolve(process.argv[2] || path.join(root, '../../review/design-system'));
fs.mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.join(root, 'gallery.html')).href;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const problems = [];
const VIEWPORTS = [['bureau-1440', { width: 1440, height: 900 }, false], ['mobile-390', { width: 390, height: 844 }, true]];
for (const [name, viewport, isMobile] of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport, isMobile, hasTouch: isMobile, deviceScaleFactor: isMobile ? 2 : 1, reducedMotion: 'reduce', ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === '1' });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${name}: console — ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${name}: JS — ${e.message}`));
  page.on('requestfailed', (r) => problems.push(`${name}: échec ${r.url()}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) problems.push(`${name}: défilement horizontal de ${overflow}px`);
  const wide = await page.evaluate(() => [...document.querySelectorAll('body *')]
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width && r.right > window.innerWidth + 1 && !el.closest('.table-wrap,.g-toc,.sr-only,svg'); })
    .slice(0, 5).map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`));
  if (wide.length) problems.push(`${name}: éléments qui dépassent : ${wide.join(', ')}`);
  const fonts = await page.evaluate(() => ['600 16px "Cormorant Garamond"', '400 16px Jost'].map((f) => `${f} ${document.fonts.check(f) ? 'chargée' : 'ABSENTE'}`).join(' '));
  console.log(`${name} — ${fonts}`);
  if (fonts.includes('ABSENTE')) problems.push(`${name}: police non chargée (${fonts})`);
  // Clavier : le premier Tab doit atteindre le lien d'évitement
  await page.keyboard.press('Tab');
  const first = await page.evaluate(() => document.activeElement?.className);
  if (!String(first).includes('skip')) problems.push(`${name}: premier Tab sur « ${first} » au lieu du lien d'évitement`);
  await page.keyboard.press('Tab'); await page.evaluate(() => document.activeElement.blur());
  await page.screenshot({ path: path.join(out, `galerie-${name}.jpg`), fullPage: true, type: 'jpeg', quality: 80 });
  // Capture du cadre complet : la barre d'onglets (collante) est remise à sa place pour l'image
  await page.addStyleTag({ content: '.g-frame .mnav{position:static!important}' });
  await page.locator('#exemple .g-frame').screenshot({ path: path.join(out, `tableau-de-bord-${name}.png`) });
  await page.evaluate(() => document.querySelectorAll('style').forEach((s) => { if (s.textContent.includes('position:static!important')) s.remove(); }));
  if (isMobile) {
    // Premier écran tel que vu sur un téléphone
    await page.locator('.g-frame .app').evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY));
    await page.screenshot({ path: path.join(out, `ecran-telephone-${name}.png`) });
    await page.locator('[data-sheet]').click();
    await page.locator('.g-frame').evaluate((el) => el.scrollIntoView({ block: 'end' }));
    await page.screenshot({ path: path.join(out, `navigation-plus-${name}.png`) });
  }
  await ctx.close();
}
await browser.close();
console.log(fs.readdirSync(out).filter((f) => /\.(png|jpg)$/.test(f)).map((f) => `✔ ${path.join(out, f)}`).join('\n'));
if (problems.length) { console.log('\n⚠ Problèmes :\n' + problems.join('\n')); process.exitCode = 1; }
else console.log('\nAucun problème détecté (console, réseau, débordement horizontal, clavier).');
