#!/usr/bin/env node
// Assemble les pages de src/pages/ dans le gabarit src/layout.html et écrit public/.
// Sans dépendance : `node build.js`. Les fichiers générés dans public/ sont versionnés,
// le serveur n'a donc pas besoin de lancer la compilation.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const SITE = 'https://bvyaccountingtax.ca';
const SRC = path.join(__dirname, 'src');
const PUBLIC = path.join(__dirname, 'public');

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`${file}: en-tête --- manquant`);
  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const key of ['title', 'description', 'path']) {
    if (!meta[key]) throw new Error(`${file}: champ « ${key} » manquant`);
  }
  return { meta, body: raw.slice(m[0].length) };
}

function outFile(p) {
  if (p.endsWith('.html')) return path.join(PUBLIC, p);
  return path.join(PUBLIC, p, 'index.html');
}

const esc = (s) => s.replace(/&(?!amp;)/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function build() {
  const layout = fs.readFileSync(path.join(SRC, 'layout.html'), 'utf8');
  const version = crypto.createHash('sha1')
    .update(fs.readFileSync(path.join(PUBLIC, 'assets/css/bvy.css')))
    .update(fs.readFileSync(path.join(PUBLIC, 'assets/js/bvy.js')))
    .digest('hex').slice(0, 8);
  const year = String(new Date().getFullYear());
  const pages = fs.readdirSync(path.join(SRC, 'pages')).filter((f) => f.endsWith('.html')).sort();
  const sitemap = [];

  for (const name of pages) {
    const { meta, body } = parse(path.join(SRC, 'pages', name));
    const robots = meta.robots || 'index,follow';
    let html = layout
      .replace('{{content}}', () => body.trim())
      .replace('{{head}}', () => (meta.head ? meta.head : ''))
      .replaceAll('{{title}}', esc(meta.title))
      .replaceAll('{{description}}', esc(meta.description))
      .replaceAll('{{path}}', meta.path)
      .replaceAll('{{robots}}', robots)
      .replaceAll('{{version}}', version)
      .replaceAll('{{year}}', year);
    if (meta.nav) {
      html = html.replaceAll(`data-nav="${meta.nav}"`, `data-nav="${meta.nav}" aria-current="page"`);
    }
    const leftover = html.match(/\{\{\w+\}\}/);
    if (leftover) throw new Error(`${name}: variable non remplacée ${leftover[0]}`);
    const out = outFile(meta.path);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    if (robots.startsWith('index')) sitemap.push(meta.path);
    console.log(`✔ ${meta.path.padEnd(22)} ← src/pages/${name}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    sitemap.map((p) => `  <url><loc>${SITE}${p}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    '\n</urlset>\n');
  fs.writeFileSync(path.join(PUBLIC, 'robots.txt'),
    `User-agent: *\nDisallow: /portail-comptable/\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
  console.log(`✔ sitemap.xml (${sitemap.length} pages), robots.txt — version ${version}`);
}

build();
