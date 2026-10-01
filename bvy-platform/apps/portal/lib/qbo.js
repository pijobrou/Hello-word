'use strict';

/**
 * QuickBooks Online : OAuth 2.0 (Intuit), chiffrement des jetons, appels à l'API comptable (lecture seule).
 * Aucune dépendance. Réglages (.env du serveur) :
 *   QBO_CLIENT_ID, QBO_CLIENT_SECRET   clés de l'application Intuit (developer.intuit.com)
 *   QBO_ENV                            sandbox (défaut) | production
 *   QBO_TOKEN_KEY                      32 octets aléatoires en base64 (openssl rand -base64 32)
 *   QBO_REDIRECT_URI                   défaut : <PORTAL_URL>/quickbooks/retour
 */

const crypto = require('node:crypto');

const AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke';
const SCOPE = 'com.intuit.quickbooks.accounting';
const MINOR_VERSION = '75';

class QboError extends Error {
  constructor(message, { status, code } = {}) { super(message); this.status = status; this.code = code; }
}

function qboConfigFromEnv(env = process.env, publicUrl = '') {
  const id = env.QBO_CLIENT_ID || '';
  const secret = env.QBO_CLIENT_SECRET || '';
  const keyB64 = env.QBO_TOKEN_KEY || '';
  if (!id || !secret || !keyB64) return null;
  const key = Buffer.from(keyB64, 'base64');
  if (key.length !== 32) {
    console.error('QuickBooks désactivé : QBO_TOKEN_KEY doit faire 32 octets en base64 (openssl rand -base64 32).');
    return null;
  }
  const environment = env.QBO_ENV === 'production' ? 'production' : 'sandbox';
  return {
    clientId: id,
    clientSecret: secret,
    key,
    environment,
    redirectUri: env.QBO_REDIRECT_URI || `${publicUrl.replace(/\/+$/, '')}/quickbooks/retour`,
    apiBase: environment === 'production' ? 'https://quickbooks.api.intuit.com' : 'https://sandbox-quickbooks.api.intuit.com',
    appBase: environment === 'production' ? 'https://app.qbo.intuit.com' : 'https://app.sandbox.qbo.intuit.com',
  };
}

/* ------------------------------------------------- chiffrement AES-256-GCM */
function encrypt(key, text) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return `v1.${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${data.toString('base64')}`;
}

function decrypt(key, blob) {
  const [v, iv, tag, data] = String(blob || '').split('.');
  if (v !== 'v1' || !iv || !tag || !data) throw new QboError('Jeton chiffré invalide.');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}

/* ---------------------------------------------------------------- client */
function createQbo(cfg, { fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const basic = 'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');

  function authorizeUrl(state) {
    const q = new URLSearchParams({ client_id: cfg.clientId, response_type: 'code', scope: SCOPE, redirect_uri: cfg.redirectUri, state });
    return `${AUTH_URL}?${q}`;
  }

  async function tokenRequest(params) {
    let res;
    try {
      res = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { Authorization: basic, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      throw new QboError(`Intuit injoignable : ${err.message}`, { code: 'network' });
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.access_token) {
      throw new QboError(`Intuit a refusé le jeton (${res.status} ${body.error || ''})`.trim(), { status: res.status, code: body.error || 'token_error' });
    }
    const t = now();
    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      accessExpires: t + (Number(body.expires_in) || 3600) * 1000,
      refreshExpires: t + (Number(body.x_refresh_token_expires_in) || 100 * 86400) * 1000,
    };
  }

  const exchangeCode = (code) => tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri });
  const refresh = (refreshToken) => tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken });

  async function revoke(token) {
    try {
      await fetchImpl(REVOKE_URL, {
        method: 'POST',
        headers: { Authorization: basic, Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch { /* la suppression locale suffit si Intuit est injoignable */ }
  }

  // GET sur l'API comptable (lecture seule).
  async function get(realmId, path, accessToken, params = {}) {
    const q = new URLSearchParams({ ...params, minorversion: MINOR_VERSION });
    const url = `${cfg.apiBase}/v3/company/${encodeURIComponent(realmId)}/${path}?${q}`;
    let res;
    try {
      res = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
    } catch (err) {
      throw new QboError(`QuickBooks injoignable : ${err.message}`, { code: 'network' });
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const fault = body.Fault && body.Fault.Error && body.Fault.Error[0];
      throw new QboError(`QuickBooks ${res.status} : ${fault ? fault.Message || fault.Detail : 'erreur'}`, { status: res.status, code: res.status === 401 ? 'unauthorized' : 'api_error' });
    }
    return body;
  }

  const query = async (realmId, accessToken, sql) => {
    const body = await get(realmId, 'query', accessToken, { query: sql });
    return body.QueryResponse || {};
  };

  return { cfg, authorizeUrl, exchangeCode, refresh, revoke, get, query, encrypt: (t) => encrypt(cfg.key, t), decrypt: (b) => decrypt(cfg.key, b) };
}

module.exports = { qboConfigFromEnv, createQbo, QboError, encrypt, decrypt, SCOPE, AUTH_URL, TOKEN_URL, REVOKE_URL, MINOR_VERSION };
