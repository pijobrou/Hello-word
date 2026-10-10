'use strict';

/**
 * Accès minimal à Google Agenda et Google Sheets avec un compte de service (aucune dépendance).
 *
 * Réglages (.env du serveur) :
 *   GOOGLE_SA_FILE      chemin du fichier JSON de la clé du compte de service
 *   GOOGLE_CALENDAR_ID  agenda partagé avec le compte de service (ex. bvypjb@gmail.com)
 *   GOOGLE_SHEET_ID     identifiant de la feuille Google Sheets partagée avec le compte de service
 *
 * Le compte de service doit avoir reçu le partage « Apporter des modifications aux événements » sur
 * l'agenda et « Éditeur » sur la feuille. Il n'invite personne à l'événement (impossible sans Google
 * Workspace) : c'est le site qui envoie la confirmation au client par courriel.
 */

const fs = require('node:fs');
const crypto = require('node:crypto');

const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function googleConfigFromEnv(env = process.env) {
  const file = env.GOOGLE_SA_FILE || '';
  const calendarId = env.GOOGLE_CALENDAR_ID || '';
  const sheetId = env.GOOGLE_SHEET_ID || '';
  if (!file || !calendarId || !sheetId) return null;
  let key;
  try {
    key = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error('Agenda Google désactivé : clé du compte de service illisible :', err.message);
    return null;
  }
  if (!key.client_email || !key.private_key) {
    console.error('Agenda Google désactivé : le fichier JSON n’est pas une clé de compte de service.');
    return null;
  }
  return { clientEmail: key.client_email, privateKey: key.private_key, calendarId, sheetId };
}

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function createGoogle(cfg, { fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  let token = null;
  let tokenExp = 0;

  async function accessToken() {
    if (token && now() < tokenExp - 60_000) return token;
    const iat = Math.floor(now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(JSON.stringify({ iss: cfg.clientEmail, scope: SCOPES, aud: TOKEN_URL, iat, exp: iat + 3600 }));
    const signature = b64url(crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(cfg.privateKey));
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) throw new Error(`Google : jeton refusé (${res.status} ${body.error || ''})`.trim());
    token = body.access_token;
    tokenExp = now() + (Number(body.expires_in) || 3600) * 1000;
    return token;
  }

  async function call(method, url, payload) {
    const res = await fetchImpl(url, {
      method,
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google ${res.status} : ${(body.error && body.error.message) || 'erreur'}`);
    return body;
  }

  // Périodes occupées de l'agenda entre deux instants (ISO) → [{ start, end }] en millisecondes.
  async function busy(timeMin, timeMax) {
    const body = await call('POST', 'https://www.googleapis.com/calendar/v3/freeBusy', {
      timeMin, timeMax, items: [{ id: cfg.calendarId }],
    });
    const cal = body.calendars && body.calendars[cfg.calendarId];
    if (!cal || (cal.errors && cal.errors.length)) {
      throw new Error(`Google : agenda inaccessible (${cal && cal.errors ? cal.errors.map((e) => e.reason).join(', ') : 'absent'})`);
    }
    return (cal.busy || []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) }));
  }

  function insertEvent(event) {
    return call('POST', `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cfg.calendarId)}/events`, event);
  }

  // Ajoute une ligne à la première feuille du classeur.
  function appendRow(values) {
    return call('POST',
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(cfg.sheetId)}/values/A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { values: [values] });
  }

  return { busy, insertEvent, appendRow, accessToken };
}

module.exports = { googleConfigFromEnv, createGoogle };
