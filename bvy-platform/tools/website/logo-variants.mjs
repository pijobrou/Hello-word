// Génère les déclinaisons du logo (favicon, 96 px, 192 px) à partir de public/assets/img/bvy-logo.png.
// Usage : node tools/website/logo-variants.mjs   (nécessite Playwright + Chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/website/public/assets/img');
const src = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, 'bvy-logo.png')).toString('base64');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
await page.setContent('<canvas id="c"></canvas>');
for (const [name, size, crop] of [['bvy-logo-192.png', 192, 0], ['bvy-logo-96.png', 96, 0], ['favicon.png', 64, 0.2]]) {
  const b64 = await page.evaluate(async ({ src, size, crop }) => {
    const img = new Image(); img.src = src; await img.decode();
    const c = document.getElementById('c'); c.width = c.height = size;
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    const s = img.width * (1 - 2 * crop), o = img.width * crop; // favicon : recadré sur « B V Y »
    ctx.drawImage(img, o, o * 0.9, s, s, 0, 0, size, size);
    return c.toDataURL('image/png').split(',')[1];
  }, { src, size, crop });
  fs.writeFileSync(path.join(dir, name), Buffer.from(b64, 'base64'));
  console.log('✔', name);
}
await browser.close();
