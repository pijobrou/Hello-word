'use strict';

/**
 * Portail BVY — serveur web (phase 2 : connexion et rôles).
 * Node ≥ 22.13, aucune dépendance : node:http, node:sqlite, node:crypto.
 * Procédure : workflows/02_auth_roles.md
 */

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

try { process.loadEnvFile(path.join(__dirname, '.env')); } catch { /* .env facultatif */ }

const { openDb } = require('./lib/db.js');
const { createAccounts, AccountError } = require('./lib/accounts.js');
const { can, canAccessClient, visibleClients, STAFF_ROLES } = require('./lib/rbac.js');
const C = require('./lib/crypto.js');
const V = require('./lib/views.js');
const mailer = require('./lib/mailer.js');
const { createPortal, MAX_UPLOAD } = require('./lib/portal.js');
const { createPortalRoutes } = require('./lib/routes-portal.js');
const multipart = require('./lib/multipart.js');
const { qboConfigFromEnv, createQbo } = require('./lib/qbo.js');
const { createQboService } = require('./lib/qbo-sync.js');
const { createWorkqueue } = require('./lib/workqueue.js');
const { createPayroll } = require('./lib/payroll.js');
const { createSalesTax } = require('./lib/salestax.js');
const { createIncomeTax } = require('./lib/incometax.js');
const { createInbox } = require('./lib/inbox.js');
const { createAnomalies, findDuplicates, findUnusual } = require('./lib/anomalies.js');
const W = require('./lib/views-work.js');

const COOKIE = '__Host-bvy_session';
const MAX_BODY = 16 * 1024;

const SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; " +
    // form-action : le bouton « Connecter QuickBooks » est un formulaire qui redirige vers Intuit ; sans ces origines, le navigateur bloque l'envoi sans rien afficher.
    "script-src 'self'; connect-src 'self'; form-action 'self' https://appcenter.intuit.com https://*.intuit.com; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  // « same-origin » (et non « no-referrer ») : sinon le navigateur envoie « Origin: null » sur nos propres formulaires.
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Robots-Tag': 'noindex, nofollow, noai, noimageai',
  'Cache-Control': 'no-store',
});

const MIME = { '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.js': 'text/javascript; charset=utf-8' };

function envConfig() {
  return {
    port: Number(process.env.PORTAL_PORT || 3100),
    host: process.env.HOST || '127.0.0.1',
    publicUrl: (process.env.PORTAL_URL || 'https://portail.bvyaccountingtax.ca').replace(/\/+$/, ''),
    dataDir: path.resolve(__dirname, process.env.PORTAL_DATA_DIR || 'data'),
    trustProxy: process.env.TRUST_PROXY === '1',
    smtp: mailer.smtpConfigFromEnv(),
    production: process.env.NODE_ENV === 'production',
  };
}

/* ------------------------------------------------------------- utilitaires */

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/x-www-form-urlencoded') { req.resume(); return reject(Object.assign(new Error('type'), { status: 415 })); }
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { req.destroy(); reject(Object.assign(new Error('taille'), { status: 413 })); } else chunks.push(c);
    });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')))));
    req.on('error', reject);
  });
}

function createRateLimiter(max, windowMs) {
  const hits = new Map();
  const timer = setInterval(() => {
    const cut = Date.now() - windowMs;
    for (const [k, v] of hits) { const kept = v.filter((t) => t > cut); if (kept.length) hits.set(k, kept); else hits.delete(k); }
  }, 60_000);
  timer.unref();
  return {
    hit(key) {
      const cut = Date.now() - windowMs;
      const list = (hits.get(key) || []).filter((t) => t > cut);
      if (list.length >= max) { hits.set(key, list); return false; }
      list.push(Date.now()); hits.set(key, list); return true;
    },
    stop() { clearInterval(timer); },
  };
}

/* ------------------------------------------------------------------ serveur */

function createServer(options = {}) {
  const env = envConfig();
  const cfg = {
    ...env,
    ...options,
    dataDir: path.resolve(options.dataDir || env.dataDir),
    smtp: options.smtp !== undefined ? options.smtp : env.smtp,
  };
  const db = options.db || openDb(path.join(cfg.dataDir, 'portail.sqlite'));
  const acc = createAccounts(db, { now: options.now });
  const authLimiter = createRateLimiter(options.authRateMax || 20, 10 * 60_000);
  const publicDir = path.join(__dirname, 'public');
  const origin = new URL(cfg.publicUrl).origin;

  // Envoi de courriel : injecté en test ; sinon SMTP ; sinon (développement seulement) affiché dans la console.
  const send = options.sendMail || (async (msg) => {
    if (cfg.smtp) return mailer.sendMail(cfg.smtp, msg);
    if (cfg.production) throw new Error('SMTP non configuré');
    console.log(`\n[courriel de développement] À : ${msg.to.join(', ')}\nObjet : ${msg.subject}\n${msg.text}\n`);
  });

  async function sendOrFail(msg) {
    try { await send(msg); return true; } catch (err) { console.error('Portail : courriel non envoyé :', err.message); return false; }
  }

  const mailCode = (user, code) => sendOrFail({
    to: [user.email],
    subject: `Votre code BVY : ${code}`,
    text: `Bonjour ${user.name.split(' ')[0]},\n\nVotre code de connexion au portail BVY est :\n\n${code}\n\nIl est valable 10 minutes. Si vous n’essayez pas de vous connecter, ignorez ce courriel et changez votre mot de passe.\n\nL’équipe BVY`,
  });

  const mailInvite = (user, token, inviter) => sendOrFail({
    to: [user.email],
    subject: 'Votre accès au portail BVY',
    text: `Bonjour ${user.name.split(' ')[0]},\n\n${inviter ? `${inviter.name} vous invite` : 'Vous êtes invité'} à utiliser le portail sécurisé de BVY Accounting & Tax Services.\n\nActivez votre accès (lien valable 72 heures, à usage unique) :\n${cfg.publicUrl}/invitation?jeton=${encodeURIComponent(token)}\n\nVous choisirez votre mot de passe ; un code de vérification vous sera ensuite demandé à chaque connexion.\n\nL’équipe BVY`,
  });

  /* ------------------------------------------------------------ réponses */
  function send200(res, html, status = 200, headers = {}) {
    const body = Buffer.from(html);
    res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length, ...headers });
    res.end(res.req.method === 'HEAD' ? undefined : body);
  }
  function redirect(res, location, headers = {}) {
    res.writeHead(303, { ...SECURITY_HEADERS, Location: location, ...headers });
    res.end();
  }
  // En production (https) : témoin « __Host- » sécurisé. Aperçu local en http seulement : témoin sans « Secure ».
  const secure = cfg.publicUrl.startsWith('https://');
  const cookieName = secure ? COOKIE : 'bvy_session_local';
  const attrs = `Path=/; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax`;
  const setCookie = (token) => ({ 'Set-Cookie': `${cookieName}=${token}; ${attrs}; Max-Age=${12 * 3600}` });
  const clearCookie = { 'Set-Cookie': `${cookieName}=; ${attrs}; Max-Age=0` };

  const flashOf = (url) => ({ notice: url.searchParams.get('ok') || undefined, error: url.searchParams.get('erreur') || undefined });

  /* ------------------------------------------------- portail client (phase 3) */
  const portal = createPortal(db, { dataDir: cfg.dataDir, audit: acc.audit, now: options.now });
  const notifyTo = options.notifyTo || (cfg.smtp && cfg.smtp.to) || [];
  // Avis par courriel : jamais de détail financier, seulement une invitation à se connecter.
  function notifyClient(clientId, exceptUserId, subject) {
    for (const r of portal.clientRecipients(clientId, exceptUserId)) {
      sendOrFail({ to: [r.email], subject, text: `Bonjour ${r.name.split(' ')[0]},\n\n${subject}.\n\nConnectez-vous pour le voir : ${cfg.publicUrl}/accueil\n\nL’équipe BVY` });
    }
  }
  function notifyTeam(clientId, subject) {
    if (!notifyTo.length) return;
    const c = portal.client(clientId);
    sendOrFail({ to: notifyTo, subject: `${subject} — ${c ? c.name : `client ${clientId}`}`, text: `${subject} (${c ? c.name : ''}).\n\nDossier : ${cfg.publicUrl}/clients/${clientId}\n` });
  }
  // QuickBooks Online (workflow 04) : actif seulement si l'application Intuit est configurée (ou un faux client en test).
  const qboCfg = options.qbo !== undefined ? options.qbo : qboConfigFromEnv(process.env, cfg.publicUrl);
  const qbo = qboCfg ? (qboCfg.authorizeUrl ? qboCfg : createQbo(qboCfg, { now: options.now })) : null;
  let anomalies = null; // créé plus bas (il a besoin des échéances) ; la synchronisation QuickBooks lui passe les paiements lus
  const qboService = createQboService(db, { qbo, portal, audit: acc.audit, now: options.now,
    onFindings: (clientId, txns, day) => anomalies && anomalies.setQboFindings(clientId, [...findDuplicates(txns, day), ...findUnusual(txns, day)]) });
  const workqueue = createWorkqueue(db, { audit: acc.audit, now: options.now });
  const payroll = createPayroll(db, { audit: acc.audit, now: options.now });
  const salestax = createSalesTax(db, { audit: acc.audit, now: options.now, deadlinesFor: (c, day) => workqueue.deadlinesFor(c, day) });
  const incometax = createIncomeTax(db, { audit: acc.audit, now: options.now, deadlinesFor: (c, day) => workqueue.deadlinesFor(c, day) });
  const inbox = createInbox(db, { audit: acc.audit, now: options.now, portal });
  anomalies = createAnomalies(db, { audit: acc.audit, now: options.now, portal, deadlinesFor: (c, day) => workqueue.deadlinesFor(c, day), qbo: () => qboService });
  // Paie (workflow 12) : crée les paies dont les heures doivent être demandées et prévient le client (toutes les heures).
  function payrollTick() {
    try {
      for (const r of payroll.ensureRuns()) notifyClient(r.clientId, null, `BVY a besoin des heures de paie pour la paie du ${r.payDate}`);
      salestax.ensureReturns(); // TPS/TVQ : une déclaration par période terminée (aucun avis au client à cette étape)
      for (const f of incometax.ensureFiles()) if (f.form === 't1') notifyClient(f.clientId, null, `BVY a besoin de vos documents pour vos impôts (${f.label})`);
      // Rappels (workflow 10) : un courriel par client, sans titre ni montant, en semaine de 9 h à 17 h.
      anomalies.scanAll(); // Anomalies (workflow 06) : règles du dossier, chaque heure
      for (const r of inbox.runReminders()) notifyClient(r.clientId, null, `Rappel : ${r.count} élément${r.count > 1 ? 's' : ''} vous attend${r.count > 1 ? 'ent' : ''} dans votre portail BVY`);
    } catch (err) { console.error('Paie :', err.message); }
  }
  const payrollTimer = setInterval(payrollTick, 60 * 60_000);
  payrollTimer.unref();
  setImmediate(payrollTick);
  const portalRoutes = createPortalRoutes({ db, portal, notifyClient, notifyTeam, qboService, workqueue, payroll, payrollTick, salestax, incometax, inbox, anomalies });

  async function serveAsset(req, res, pathname) {
    const name = path.basename(pathname);
    const file = path.join(publicDir, 'assets', name);
    if (!MIME[path.extname(name)] || pathname !== `/assets/${name}`) return false;
    const st = await fsp.stat(file).catch(() => null);
    if (!st || !st.isFile()) return false;
    // Adresse avec empreinte (?v=…) : gardée un an ; sans empreinte : revalidée à chaque fois.
    const versioned = /[?&]v=[0-9a-f]{10}\b/.test(req.url || '');
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': MIME[path.extname(name)], 'Content-Length': st.size, 'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'no-cache' });
    if (req.method === 'HEAD') return res.end(), true;
    fs.createReadStream(file).pipe(res);
    return true;
  }

  /* --------------------------------------------------------------- routes */
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://portail.local');
      const p = url.pathname;
      const ip = cfg.trustProxy && req.headers['x-real-ip'] ? String(req.headers['x-real-ip']) : (req.socket.remoteAddress || '');
      const ua = String(req.headers['user-agent'] || '');

      if (p === '/sante') return send200(res, 'ok', 200, { 'Content-Type': 'text/plain; charset=utf-8' });
      // HEAD se comporte exactement comme GET (sans corps) : jamais comme une soumission de formulaire.
      const isGet = req.method === 'GET' || req.method === 'HEAD';
      if (p.startsWith('/assets/') && isGet) {
        if (await serveAsset(req, res, p)) return;
        return send200(res, V.errorPage(404, 'Cette page n’existe pas.'), 404);
      }

      const token = parseCookies(req.headers.cookie)[cookieName];
      let s = acc.getSession(token);
      let form = {};

      if (req.method === 'POST') {
        // Toute soumission doit venir du portail lui-même (contre la falsification de requête).
        const from = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : '');
        if (from !== origin) { req.resume(); return send200(res, V.errorPage(403, 'Requête refusée.'), 403); }
        const ctype = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        try {
          if (ctype === 'multipart/form-data') {
            // Téléversement : seulement pour une personne connectée, sur les routes de documents (et les heures de paie).
            if (!s || !s.mfa_done || !/^\/(documents|clients\/\d+\/documents|paie\/\d+\/heures|impots\/\d+\/document)$/.test(p)) { req.resume(); return send200(res, V.errorPage(415, 'Requête invalide.'), 415); }
            const boundary = multipart.boundaryOf(req.headers['content-type']);
            if (!boundary) throw Object.assign(new Error('multipart'), { status: 400 });
            const parsed = multipart.parseMultipart(await multipart.readBody(req, MAX_UPLOAD + 64 * 1024), boundary);
            form = { ...parsed.fields, _files: parsed.files };
          } else {
            form = await readForm(req);
          }
        } catch (err) {
          const st = err.status || 400;
          return send200(res, V.errorPage(st, st === 413 ? 'Fichier trop volumineux (20 Mo au maximum).' : 'Requête invalide.'), st);
        }
        if (s && !C.safeEqual(form._csrf || '', s.csrf) && !['/connexion', '/mot-de-passe-oublie', '/invitation', '/reinitialiser'].includes(p)) {
          return send200(res, V.errorPage(403, 'Votre session a changé. Rechargez la page et réessayez.'), 403);
        }
        if (['/connexion', '/verification', '/verification/courriel', '/mot-de-passe-oublie', '/invitation', '/reinitialiser'].includes(p) && !authLimiter.hit(ip)) {
          return send200(res, V.errorPage(429, 'Trop de tentatives. Réessayez dans quelques minutes.'), 429);
        }
      } else if (req.method !== 'GET' && req.method !== 'HEAD') {
        return send200(res, V.errorPage(405, 'Méthode non autorisée.'), 405, { Allow: 'GET, HEAD, POST' });
      }

      const csrfOf = (sess) => V.csrfField(sess);

      /* ----- pages publiques ----- */
      if (p === '/') return redirect(res, s ? (s.mfa_done ? '/accueil' : '/verification') : '/connexion');

      if (p === '/connexion') {
        if (isGet) {
          if (s && s.mfa_done) return redirect(res, '/accueil');
          return send200(res, V.loginPage({ flash: flashOf(url), csrf: '' }));
        }
        try {
          const user = acc.checkPassword(form.email, form.password, ip);
          if (s) acc.destroySession(token);
          const t = acc.createSession(user, { mfaDone: false, ip, userAgent: ua });
          if (!user.totp_enabled) {
            const code = acc.startEmailCode(user);
            if (!(await mailCode(user, code))) {
              acc.destroySession(t);
              return send200(res, V.loginPage({ email: form.email, flash: { error: 'Le code n’a pas pu être envoyé. Réessayez dans un instant.' }, csrf: '' }), 503, clearCookie);
            }
          }
          return redirect(res, '/verification', setCookie(t));
        } catch (err) {
          if (!(err instanceof AccountError)) throw err;
          return send200(res, V.loginPage({ email: form.email, flash: { error: err.message }, csrf: '' }), 401);
        }
      }

      if (p === '/verification' || p === '/verification/courriel') {
        if (!s) return redirect(res, '/connexion');
        if (s.mfa_done) return redirect(res, '/accueil');
        const method = s.user.totp_enabled && url.searchParams.get('m') !== 'courriel' ? 'app' : 'email';
        if (p === '/verification/courriel' && req.method === 'POST') {
          const code = acc.startEmailCode(s.user);
          const ok = await mailCode(s.user, code);
          return send200(res, V.verifyPage({ method: 'email', email: s.user.email, csrf: csrfOf(s), flash: ok ? { notice: 'Un nouveau code vient d’être envoyé.' } : { error: 'Le code n’a pas pu être envoyé. Réessayez.' } }));
        }
        if (isGet) return send200(res, V.verifyPage({ method, email: s.user.email, csrf: csrfOf(s) }));
        try {
          if (form.method === 'app' && s.user.totp_enabled) acc.verifyAppCode(s.user, form.code, ip);
          else acc.verifyEmailCode(s.user, form.code, ip);
          const t = acc.completeMfa(s, { ip, userAgent: ua });
          return redirect(res, '/accueil', setCookie(t));
        } catch (err) {
          if (!(err instanceof AccountError)) throw err;
          return send200(res, V.verifyPage({ method: form.method === 'app' ? 'app' : 'email', email: s.user.email, csrf: csrfOf(s), flash: { error: err.message } }), 401);
        }
      }

      if (p === '/deconnexion' && req.method === 'POST') {
        acc.destroySession(token);
        return redirect(res, '/connexion?ok=' + encodeURIComponent('Vous êtes déconnecté.'), clearCookie);
      }

      if (p === '/invitation') {
        const jeton = isGet ? url.searchParams.get('jeton') : form.jeton;
        const t = acc.tokenUser(jeton, 'invite');
        if (!t || t.user.status !== 'invited') return send200(res, V.invalidLinkPage('Ce lien d’invitation n’est plus valide. Demandez-en un nouveau à BVY.'), 410);
        if (isGet) return send200(res, V.invitePage({ token: jeton, user: t.user }));
        if (form.password !== form.password2) return send200(res, V.invitePage({ token: jeton, user: t.user, flash: { error: 'Les deux mots de passe ne sont pas identiques.' } }), 422);
        try {
          const user = acc.acceptInvite(jeton, form.password, ip);
          if (s) acc.destroySession(token);
          // Le lien reçu par courriel prouve déjà l'accès à la boîte : la session est complète.
          const st = acc.createSession(user, { mfaDone: true, ip, userAgent: ua });
          const next = STAFF_ROLES.includes(user.role) ? '/compte?ok=' + encodeURIComponent('Bienvenue ! Activez maintenant votre application d’authentification.') + '#application' : '/accueil';
          return redirect(res, next, setCookie(st));
        } catch (err) {
          if (!(err instanceof AccountError)) throw err;
          return send200(res, V.invitePage({ token: jeton, user: t.user, flash: { error: err.message } }), 422);
        }
      }

      if (p === '/mot-de-passe-oublie') {
        if (isGet) return send200(res, V.forgotPage({ csrf: '' }));
        const r = acc.requestReset(form.email, ip);
        if (r) {
          await sendOrFail({
            to: [r.user.email],
            subject: 'Réinitialiser votre mot de passe BVY',
            text: `Bonjour ${r.user.name.split(' ')[0]},\n\nPour choisir un nouveau mot de passe (lien valable 30 minutes, à usage unique) :\n${cfg.publicUrl}/reinitialiser?jeton=${encodeURIComponent(r.token)}\n\nSi vous n’avez rien demandé, ignorez ce courriel : votre mot de passe reste le même.\n\nL’équipe BVY`,
          });
        }
        return send200(res, V.forgotPage({ sent: true, csrf: '' }));
      }

      if (p === '/reinitialiser') {
        const jeton = isGet ? url.searchParams.get('jeton') : form.jeton;
        if (!acc.tokenUser(jeton, 'reset')) return send200(res, V.invalidLinkPage('Ce lien n’est plus valide. Recommencez la demande.'), 410);
        if (isGet) return send200(res, V.resetPage({ token: jeton }));
        if (form.password !== form.password2) return send200(res, V.resetPage({ token: jeton, flash: { error: 'Les deux mots de passe ne sont pas identiques.' } }), 422);
        try {
          acc.resetPassword(jeton, form.password, ip);
          return redirect(res, '/connexion?ok=' + encodeURIComponent('Mot de passe changé. Connectez-vous.'), clearCookie);
        } catch (err) {
          if (!(err instanceof AccountError)) throw err;
          return send200(res, V.resetPage({ token: jeton, flash: { error: err.message } }), 422);
        }
      }

      /* ----- pages protégées ----- */
      if (!s || !s.mfa_done) return redirect(res, s ? '/verification' : '/connexion');
      const u = s.user;
      if (STAFF_ROLES.includes(u.role)) s.nav = { inbox: inbox.count(u), urgent: anomalies.urgentCount(u) }; // pastilles « Réception » et « Anomalies »

      if (await portalRoutes.handle({ req, res, p, url, s, form, ip, send200, redirect, flashOf, audit: acc.audit, securityHeaders: SECURITY_HEADERS })) return;

      if (p === '/compte' || p.startsWith('/compte/')) {
        const page = (flash, extra = {}) => send200(res, V.accountPage(acc.getSession(token) || s, {
          sessions: acc.listSessions(u), pendingSecret: extra.secret, pendingUri: extra.secret && C.totpUri(extra.secret, u.email), flash,
        }), extra.status || 200);
        if (p === '/compte' && isGet) {
          return page(flashOf(url), { secret: s.pending_totp && !u.totp_enabled ? s.pending_totp : undefined });
        }
        if (req.method !== 'POST') return send200(res, V.errorPage(404, 'Cette page n’existe pas.'), 404);
        try {
          if (p === '/compte/mot-de-passe') {
            if (form.password !== form.password2) throw new AccountError('Les deux nouveaux mots de passe ne sont pas identiques.');
            acc.changePassword(u, form.current, form.password, ip, s.id_hash);
            return redirect(res, '/compte?ok=' + encodeURIComponent('Mot de passe changé. Vos autres appareils ont été déconnectés.'));
          }
          if (p === '/compte/application/commencer') {
            const secret = C.newTotpSecret();
            db.prepare('UPDATE sessions SET pending_totp = ? WHERE id_hash = ?').run(secret, s.id_hash);
            return redirect(res, '/compte#application');
          }
          if (p === '/compte/application/activer') {
            if (!s.pending_totp) throw new AccountError('Recommencez la configuration de l’application.');
            try {
              acc.enableApp(u, s.pending_totp, form.code, ip);
            } catch (err) {
              return page({ error: err.message }, { secret: s.pending_totp, status: 422 });
            }
            db.prepare('UPDATE sessions SET pending_totp = NULL WHERE id_hash = ?').run(s.id_hash);
            return redirect(res, '/compte?ok=' + encodeURIComponent('Application d’authentification activée.'));
          }
          if (p === '/compte/application/desactiver') {
            acc.disableApp(u, u, ip);
            return redirect(res, '/compte?ok=' + encodeURIComponent('Application désactivée : vous recevrez un code par courriel.'));
          }
          if (p === '/compte/sessions/fermer') {
            acc.revokeSession(u, form.id, ip);
            return redirect(res, '/compte?ok=' + encodeURIComponent('Appareil déconnecté.'));
          }
        } catch (err) {
          if (!(err instanceof AccountError)) throw err;
          return page({ error: err.message }, { status: 422 });
        }
        return send200(res, V.errorPage(404, 'Cette page n’existe pas.'), 404);
      }

      if (p === '/admin' || p.startsWith('/admin/')) {
        const adminAllowed = can(u, 'audit.view') || can(u, 'users.invite_client');
        if (!adminAllowed) {
          acc.audit({ userId: u.id, action: 'access.denied', target: p, ip });
          return send200(res, V.errorPage(403, 'Cette section est réservée à l’administration de BVY.'), 403);
        }
        const users = () => db.prepare('SELECT * FROM users ORDER BY status, name').all()
          .filter((x) => can(u, 'users.manage') || x.role === 'client');
        const clients = () => visibleClients(db, u);
        const firmCard = () => {
          if (u.role !== 'admin') return '';
          const f = workqueue.firmClient();
          return W.firmCard(s, { qbo: f ? qboService.status(f.id) : null, deadlines: f ? workqueue.firmDeadlines(u) : [] });
        };
        const page = (flash, status = 200) => send200(res, V.adminPage(s, { users: users(), clients: clients(), flash, extra: firmCard() }), status);

        if (p === '/admin' && isGet) return page(flashOf(url));
        if (p === '/admin/journal' && isGet) {
          if (!can(u, 'audit.view')) return send200(res, V.errorPage(403, 'Accès refusé.'), 403);
          const rows = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200').all();
          const names = Object.fromEntries(db.prepare('SELECT id, name FROM users').all().map((x) => [x.id, x.name]));
          return send200(res, V.auditPage(s, { rows, names }));
        }
        try {
          if (p === '/admin/inviter' && req.method === 'POST') {
            if (form.role === 'client' && !canAccessClient(db, u, form.clientId)) throw new AccountError('Choisissez l’entreprise de ce client.');
            const { user, token: inv } = acc.invite(u, { email: form.email, name: form.name, role: form.role, clientId: form.clientId }, ip);
            const sent = await mailInvite(user, inv, u);
            return redirect(res, '/admin?ok=' + encodeURIComponent(sent ? `Invitation envoyée à ${user.email}.` : `Invitation créée, mais le courriel n’est pas parti. Utilisez « Renvoyer l’invitation ».`));
          }
          if (p === '/admin/clients' && req.method === 'POST') {
            if (!can(u, 'clients.manage')) throw new AccountError('Accès refusé.');
            const c = acc.createClient(u, form.name, ip);
            if (form.kind) workqueue.saveProfile(u, c.id, { kind: form.kind }, ip);
            return redirect(res, '/admin?ok=' + encodeURIComponent(`Client « ${c.name} » créé.`));
          }
          const m = p.match(/^\/admin\/utilisateurs\/(\d+)(?:\/(statut|assignation|reinviter|application))?$/);
          if (m) {
            if (!can(u, 'users.manage')) return send200(res, V.errorPage(403, 'Accès refusé.'), 403);
            const target = acc.userById(Number(m[1]));
            if (!target) return send200(res, V.errorPage(404, 'Utilisateur introuvable.'), 404);
            const back = (msg) => redirect(res, `/admin/utilisateurs/${target.id}?ok=${encodeURIComponent(msg)}`);
            if (!m[2] && isGet) {
              const assigned = new Set(db.prepare('SELECT client_id FROM client_assignments WHERE user_id = ?').all(target.id).map((r) => r.client_id));
              return send200(res, V.adminUserPage(s, { target, clients: clients(), assigned, flash: flashOf(url) }));
            }
            if (req.method === 'POST' && m[2] === 'statut') {
              if (target.id === u.id) throw new AccountError('Vous ne pouvez pas désactiver votre propre accès.');
              acc.setStatus(u, target.id, form.status === 'active' ? 'active' : 'disabled', ip);
              return back(form.status === 'active' ? 'Accès réactivé.' : 'Accès désactivé : toutes ses sessions sont fermées.');
            }
            if (req.method === 'POST' && m[2] === 'assignation') {
              acc.setAssignment(u, target.id, form.clientId, form.assigned === '1', ip);
              return back(form.assigned === '1' ? 'Client assigné.' : 'Assignation retirée.');
            }
            if (req.method === 'POST' && m[2] === 'reinviter') {
              const { user, token: inv } = acc.invite(u, { email: target.email, name: target.name, role: target.role, clientId: target.client_id }, ip);
              const sent = await mailInvite(user, inv, u);
              return back(sent ? 'Nouvelle invitation envoyée.' : 'Le courriel n’est pas parti. Réessayez.');
            }
            if (req.method === 'POST' && m[2] === 'application') {
              acc.disableApp(u, target, ip);
              return back('Application réinitialisée : la personne recevra un code par courriel.');
            }
          }
        } catch (err) {
          if (!(err instanceof AccountError)) throw err;
          return page({ error: err.message }, 422);
        }
      }

      return send200(res, V.errorPage(404, 'Cette page n’existe pas.'), 404);
    } catch (err) {
      console.error('Portail : erreur :', err);
      if (!res.headersSent) send200(res, V.errorPage(500, 'Une erreur est survenue. Réessayez dans un instant.'), 500);
      else res.destroy();
    }
  });

  server.db = db;
  server.portal = portal;
  server.workqueue = workqueue;
  server.payroll = payroll;
  server.salestax = salestax;
  server.incometax = incometax;
  server.payrollTick = payrollTick;
  server.inbox = inbox;
  server.anomalies = anomalies;
  server.qboService = qboService;
  server.accounts = acc;
  server.config = cfg;
  server.on('close', () => authLimiter.stop());
  return server;
}

module.exports = { createServer, SECURITY_HEADERS, COOKIE };

if (require.main === module) {
  const server = createServer();
  const { port, host } = server.config;
  server.listen(port, host, () => console.log(`Portail BVY : http://${host}:${port}`));
  const stop = () => server.close(() => process.exit(0));
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}
