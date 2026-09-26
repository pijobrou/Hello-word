'use strict';

/**
 * BVY Accounting & Tax Services — public website server.
 * Zero dependencies: node: built-ins only (Node >= 20.12).
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // .env is optional
}

const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; form-action 'self'; " +
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
});

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
});

const MAX_BODY_BYTES = 16 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const QUICKBOOKS_VALUES = new Set(['', 'oui', 'non', 'ne-sais-pas']);
const CONSENT_VALUES = new Set([true, 'on', 'true', '1']);

const TEXT_FIELDS = {
  prenom: { max: 80, required: true },
  nom: { max: 80, required: true },
  courriel: { max: 160, required: true },
  telephone: { max: 40 },
  entreprise: { max: 120 },
  service: { max: 120 },
  quickbooks: { max: 20 },
  region: { max: 80 },
  message: { max: 4000 },
};

function envConfig() {
  return {
    port: process.env.PORT !== undefined && process.env.PORT !== '' ? Number(process.env.PORT) : 3000,
    host: process.env.HOST || '127.0.0.1',
    trustProxy: process.env.TRUST_PROXY === '1',
    webhookUrl: process.env.LEADS_WEBHOOK_URL || '',
    dataDir: path.resolve(__dirname, process.env.DATA_DIR || 'data'),
    publicDir: path.join(__dirname, 'public'),
  };
}

/* ------------------------------------------------------------------ helpers */

function send(res, status, body, headers = {}) {
  const buf = body === undefined || body === null ? null : Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const h = { ...SECURITY_HEADERS, ...headers };
  if (buf) h['Content-Length'] = buf.length;
  res.writeHead(status, h);
  if (buf && res.req.method !== 'HEAD') res.end(buf);
  else res.end();
}

function sendJson(res, status, obj, headers = {}) {
  send(res, status, JSON.stringify(obj), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
}

function clientIp(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
    const xri = req.headers['x-real-ip'];
    if (typeof xri === 'string' && xri.trim()) return xri.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function statSafe(p) {
  return fsp.stat(p).catch(() => null);
}

/* ------------------------------------------------------------------- static */

async function serveFile(req, res, filePath, status = 200) {
  const st = await statSafe(filePath);
  if (!st || !st.isFile()) return false;
  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=604800',
    'Last-Modified': st.mtime.toUTCString(),
  };
  res.writeHead(status, headers);
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  await new Promise((resolve) => {
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('Erreur de lecture du fichier', filePath, err.message);
      res.destroy(err);
      resolve();
    });
    stream.on('end', resolve);
    res.on('close', () => {
      stream.destroy();
      resolve();
    });
    stream.pipe(res);
  });
  return true;
}

async function notFound(req, res, publicDir) {
  const served = await serveFile(req, res, path.join(publicDir, '404.html'), 404);
  if (!served) {
    send(res, 404, 'Page introuvable', { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' });
  }
}

async function handleStatic(req, res, cfg) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Méthode non autorisée', { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
  }

  const rawUrl = req.url || '/';
  const qIndex = rawUrl.indexOf('?');
  const rawPath = qIndex === -1 ? rawUrl : rawUrl.slice(0, qIndex);
  const query = qIndex === -1 ? '' : rawUrl.slice(qIndex);

  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return send(res, 400, 'Requête invalide', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  if (!decoded.startsWith('/') || decoded.includes('\0') || decoded.includes('\\')) {
    return send(res, 400, 'Requête invalide', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  const segments = decoded.split('/');
  // Reject traversal and hidden files outright (except /.well-known/).
  if (segments.some((s, i) => s === '..' || (s.startsWith('.') && !(i === 1 && s === '.well-known')))) {
    return notFound(req, res, cfg.publicDir);
  }

  const root = cfg.publicDir;
  const target = path.resolve(root, '.' + decoded);
  if (target !== root && !target.startsWith(root + path.sep)) {
    return notFound(req, res, root);
  }

  if (decoded.endsWith('/')) {
    if (await serveFile(req, res, path.join(target, 'index.html'))) return;
    return notFound(req, res, root);
  }

  const st = await statSafe(target);
  if (st && st.isFile()) {
    if (await serveFile(req, res, target)) return;
  } else if (st && st.isDirectory()) {
    // Collapse leading slashes to avoid protocol-relative open redirects.
    const location = '/' + rawPath.replace(/^\/+/, '') + '/' + query;
    return send(res, 301, null, { Location: location, 'Cache-Control': 'no-cache' });
  } else if (await serveFile(req, res, target + '.html')) {
    return;
  }
  return notFound(req, res, root);
}

/* ---------------------------------------------------------------- contact */

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      const err = new Error('too large');
      err.code = 'TOO_LARGE';
      return reject(err);
    }
    const chunks = [];
    let size = 0;
    let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > limit) {
        done = true;
        const err = new Error('too large');
        err.code = 'TOO_LARGE';
        reject(err);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (err) => {
      if (done) return;
      done = true;
      reject(err);
    });
  });
}

function asText(v) {
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return '';
}

function validateContact(input) {
  const errors = {};
  const data = {};

  for (const [field, rule] of Object.entries(TEXT_FIELDS)) {
    const value = asText(input[field]);
    data[field] = value;
    if (rule.required && !value) {
      errors[field] = 'Ce champ est obligatoire.';
    } else if (value.length > rule.max) {
      errors[field] = `Ce champ ne doit pas dépasser ${rule.max} caractères.`;
    }
  }

  if (!errors.courriel && !EMAIL_RE.test(data.courriel)) {
    errors.courriel = 'Veuillez entrer une adresse courriel valide.';
  }
  if (!errors.quickbooks && !QUICKBOOKS_VALUES.has(data.quickbooks)) {
    errors.quickbooks = 'Valeur invalide.';
  }

  const consent = typeof input.consentement === 'string' ? input.consentement.trim().toLowerCase() : input.consentement;
  if (!CONSENT_VALUES.has(consent)) {
    errors.consentement = 'Votre consentement est requis pour que nous puissions vous répondre.';
  }
  data.consentement = true;

  return { ok: Object.keys(errors).length === 0, errors, data };
}

function createRateLimiter({ max, windowMs }) {
  const hits = new Map(); // ip -> array of timestamps
  const prune = () => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, times] of hits) {
      const kept = times.filter((t) => t > cutoff);
      if (kept.length) hits.set(ip, kept);
      else hits.delete(ip);
    }
  };
  const timer = setInterval(prune, Math.min(windowMs, 60_000));
  timer.unref();
  return {
    hit(ip) {
      const now = Date.now();
      const cutoff = now - windowMs;
      const times = (hits.get(ip) || []).filter((t) => t > cutoff);
      if (times.length >= max) {
        hits.set(ip, times);
        return false;
      }
      times.push(now);
      hits.set(ip, times);
      return true;
    },
    stop() {
      clearInterval(timer);
      hits.clear();
    },
  };
}

async function handleContact(req, res, cfg, limiter) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'Méthode non autorisée.' }, { Allow: 'POST' });
  }

  const ip = clientIp(req, cfg.trustProxy);
  if (!limiter.hit(ip)) {
    req.resume();
    return sendJson(res, 429, { ok: false, error: 'Trop de demandes. Réessayez plus tard.' }, { 'Retry-After': String(Math.ceil(cfg.rateLimit.windowMs / 1000)) });
  }

  const contentType = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  const isJson = contentType === 'application/json';
  const isForm = contentType === 'application/x-www-form-urlencoded';
  if (!isJson && !isForm) {
    req.resume();
    return sendJson(res, 415, { ok: false, error: 'Type de contenu non pris en charge.' });
  }

  let raw;
  try {
    raw = await readBody(req, MAX_BODY_BYTES);
  } catch (err) {
    if (err.code === 'TOO_LARGE') {
      req.resume();
      return sendJson(res, 413, { ok: false, error: 'Requête trop volumineuse.' }, { Connection: 'close' });
    }
    return sendJson(res, 400, { ok: false, error: 'Requête invalide.' });
  }

  let input;
  if (isJson) {
    try {
      input = JSON.parse(raw || '{}');
    } catch {
      return sendJson(res, 400, { ok: false, error: 'JSON invalide.' });
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return sendJson(res, 400, { ok: false, error: 'JSON invalide.' });
    }
  } else {
    input = Object.fromEntries(new URLSearchParams(raw));
  }

  const wantsJson = String(req.headers.accept || '').includes('application/json');
  const redirectAfter = isForm && !wantsJson;

  // Honeypot: pretend success, store nothing.
  if (asText(input.website) !== '') {
    return sendJson(res, 200, { ok: true });
  }

  const result = validateContact(input);
  if (!result.ok) {
    return sendJson(res, 422, { ok: false, errors: result.errors });
  }

  const userAgent = String(req.headers['user-agent'] || '').slice(0, 200);
  const record = { ...result.data, receivedAt: new Date().toISOString(), ip, userAgent };

  try {
    await fsp.mkdir(cfg.dataDir, { recursive: true });
    await fsp.appendFile(path.join(cfg.dataDir, 'leads.jsonl'), JSON.stringify(record) + '\n', { mode: 0o600 });
  } catch (err) {
    console.error('Impossible d’enregistrer la demande de contact:', err.message);
    return sendJson(res, 500, { ok: false, error: 'Erreur interne. Réessayez plus tard.' });
  }

  if (cfg.webhookUrl) {
    fetch(cfg.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
      signal: AbortSignal.timeout(5000),
    })
      .then((r) => {
        if (!r.ok) console.error(`Webhook des leads: réponse HTTP ${r.status}`);
        return r.body?.cancel();
      })
      .catch((err) => console.error('Webhook des leads en échec:', err.message));
  }

  if (redirectAfter) {
    return send(res, 303, null, { Location: '/contact/merci/', 'Cache-Control': 'no-store' });
  }
  return sendJson(res, 201, { ok: true });
}

/* ----------------------------------------------------------------- server */

function createServer(options = {}) {
  const env = envConfig();
  const cfg = {
    port: options.port ?? env.port,
    host: options.host ?? env.host,
    publicDir: path.resolve(options.publicDir ?? env.publicDir),
    dataDir: path.resolve(options.dataDir ?? env.dataDir),
    webhookUrl: options.webhookUrl ?? env.webhookUrl,
    trustProxy: options.trustProxy ?? env.trustProxy,
    rateLimit: { max: 5, windowMs: 10 * 60 * 1000, ...(options.rateLimit || {}) },
  };
  const limiter = createRateLimiter(cfg.rateLimit);

  const server = http.createServer(async (req, res) => {
    try {
      const pathname = (req.url || '/').split('?')[0];
      if (pathname === '/api/health') {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          return sendJson(res, 405, { ok: false, error: 'Méthode non autorisée.' }, { Allow: 'GET, HEAD' });
        }
        return sendJson(res, 200, { ok: true });
      }
      if (pathname === '/api/contact') return await handleContact(req, res, cfg, limiter);
      if (pathname === '/api' || pathname.startsWith('/api/')) {
        return sendJson(res, 404, { ok: false, error: 'Introuvable.' });
      }
      return await handleStatic(req, res, cfg);
    } catch (err) {
      console.error('Erreur serveur:', err);
      if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'Erreur interne.' });
      else res.destroy();
    }
  });

  server.config = cfg;
  server.on('close', () => limiter.stop());
  return server;
}

module.exports = { createServer, SECURITY_HEADERS, MIME_TYPES, validateContact };

if (require.main === module) {
  const server = createServer();
  const { port, host } = server.config;
  server.listen(port, host, () => {
    console.log(`BVY website running on http://${host}:${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} reçu, arrêt en cours...`);
    server.close(() => process.exit(0));
    server.closeIdleConnections?.();
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
