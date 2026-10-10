'use strict';

/**
 * Primitives de sécurité (node:crypto seulement) : mots de passe (scrypt), jetons, codes, TOTP (RFC 6238).
 */

const crypto = require('node:crypto');

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 32;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password).normalize('NFKC'), salt, KEYLEN, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    // Calcul factice : même durée, que le compte existe ou non.
    crypto.scryptSync('x', 'bvy-dummy-salt', KEYLEN, SCRYPT);
    return false;
  }
  const [, N, r, p, salt, key] = parts;
  const expected = Buffer.from(key, 'base64');
  const got = crypto.scryptSync(String(password).normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return crypto.timingSafeEqual(expected, got);
}

const COMMON = new Set(['motdepasse123', 'password1234', '123456789012', 'qwertyuiop12', 'azertyuiop12', 'bienvenue123',
  'motdepasse1234', 'password123!', 'quebec123456', 'canada123456', 'bvyaccounting', 'changeme1234', 'abcdefghijkl']);

// Règles : 12 caractères minimum, 128 maximum, pas un mot de passe courant, pas le courriel.
function passwordProblem(password, email) {
  const p = String(password || '');
  if (p.length < 12) return 'Choisissez au moins 12 caractères. Une phrase de quelques mots est idéale.';
  if (p.length > 128) return '128 caractères au maximum.';
  const low = p.toLowerCase();
  if (COMMON.has(low) || /^(.)\1+$/.test(p)) return 'Ce mot de passe est trop courant. Choisissez-en un autre.';
  const local = String(email || '').toLowerCase().split('@')[0];
  if (local && local.length >= 4 && low.includes(local)) return 'Le mot de passe ne doit pas contenir votre adresse courriel.';
  return null;
}

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const randomCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

function safeEqual(a, b) {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ------------------------------------------------------------------- TOTP */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf) {
  let bits = 0; let value = 0; let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0; let value = 0; const out = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

function totpAt(secret, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

// Vérifie un code à ±1 pas de 30 s. Renvoie le compteur accepté (pour refuser sa réutilisation) ou null.
function verifyTotp(secret, code, nowMs = Date.now()) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const step = Math.floor(nowMs / 30_000);
  for (const d of [0, -1, 1]) if (safeEqual(totpAt(secret, step + d), c)) return step + d;
  return null;
}

function totpUri(secret, email) {
  const label = encodeURIComponent(`BVY:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=BVY&algorithm=SHA1&digits=6&period=30`;
}

module.exports = {
  hashPassword, verifyPassword, passwordProblem, sha256, randomToken, randomCode, safeEqual,
  newTotpSecret, totpAt, verifyTotp, totpUri, base32Encode, base32Decode,
};
