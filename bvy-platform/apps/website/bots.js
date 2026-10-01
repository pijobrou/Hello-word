'use strict';

/**
 * Robots refusés sur le site BVY. Liste unique utilisée par :
 *   - build.js       → robots.txt (groupe « Disallow: / » pour les robots d'IA)
 *   - server.js      → refus 403 sur /api/ (protège Jessica et le formulaire)
 *   - nginx          → refus 403 sur tout le site (tools/deployment/nginx/*.conf, vérifié par test/bots.test.js)
 *
 * Les moteurs de recherche classiques (Googlebot, Bingbot, DuckDuckBot…) restent permis.
 */

// Robots d'intelligence artificielle : entraînement, collecte et réponses générées.
const AI_CRAWLERS = Object.freeze([
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'Claude-Web', 'anthropic-ai',
  'CCBot', 'Google-Extended', 'GoogleOther', 'Applebot-Extended',
  'Bytespider', 'meta-externalagent', 'meta-externalfetcher', 'FacebookBot',
  'PerplexityBot', 'Perplexity-User', 'Amazonbot',
  'cohere-ai', 'cohere-training-data-crawler', 'Diffbot', 'ImagesiftBot',
  'Omgilibot', 'Timpibot', 'YouBot', 'AI2Bot', 'DuckAssistBot', 'MistralAI-User',
  'PanguBot', 'img2dataset', 'FirecrawlAgent', 'Crawl4AI',
]);

// Outils d'aspiration de sites (ils ignorent souvent robots.txt) : refusés par le serveur seulement.
const SCRAPER_TOOLS = Object.freeze([
  'Scrapy', 'HTTrack', 'python-requests', 'python-urllib', 'aiohttp', 'python-httpx',
  'Go-http-client', 'libwww-perl', 'Wget', 'HeadlessChrome', 'PhantomJS', 'colly',
]);

const BLOCKED_AGENTS = Object.freeze([...AI_CRAWLERS, ...SCRAPER_TOOLS]);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BLOCKED_RE = new RegExp(BLOCKED_AGENTS.map(escapeRe).join('|'), 'i');

function isBlockedAgent(userAgent) {
  return typeof userAgent === 'string' && BLOCKED_RE.test(userAgent);
}

function robotsTxt(site) {
  return [
    '# BVY Accounting & Tax Services — règles pour les robots',
    '# Moteurs de recherche : bienvenus. Robots d’intelligence artificielle : interdits.',
    '# Le contenu de ce site ne peut pas servir à entraîner ou alimenter un système d’IA',
    '# (réservation des droits de fouille de textes et de données : /.well-known/tdmrep.json).',
    '',
    'User-agent: *',
    'Content-Signal: search=yes, ai-train=no, ai-input=no',
    'Disallow: /portail-comptable/',
    'Disallow: /api/',
    '',
    ...AI_CRAWLERS.map((a) => `User-agent: ${a}`),
    'Disallow: /',
    '',
    `Sitemap: ${site}/sitemap.xml`,
    '',
  ].join('\n');
}

// Réservation des droits TDM (W3C TDMRep, directive européenne 2019/790, art. 4).
function tdmrepJson() {
  return JSON.stringify([{ location: '/*', 'tdm-reservation': 1 }], null, 2) + '\n';
}

module.exports = { AI_CRAWLERS, SCRAPER_TOOLS, BLOCKED_AGENTS, isBlockedAgent, robotsTxt, tdmrepJson };
