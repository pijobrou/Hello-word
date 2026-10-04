// Traducteur Audio — serveur « Voix IA Premium » (Cloudflare Workers).
//
//   GET  /merci?session_id=cs_…   page affichée après le paiement Stripe : donne la clé de licence
//   GET  /licence                 (en-tête X-License) : offre, statut, minutes utilisées ce mois-ci
//   POST /dub                     (en-tête X-License) : { text, targetLang, voiceSettings } → voix IA MP3
//   POST /activer                 (X-License + X-Device) : active la licence sur cet appareil
//   POST /admin/liberer           (X-Admin) : { licence } — le VENDEUR détache une licence de son appareil
//
// Une licence = UN appareil, À VIE. L'extension envoie X-Device (identifiant tiré au hasard à l'installation,
// propre au navigateur). La 1re utilisation attache définitivement la licence à cet appareil ; tout autre
// appareil est refusé (409). Le client ne peut pas la transférer lui-même (TRANSFER_DAYS = "never") ; seul le
// vendeur peut la libérer (changement d'ordinateur, panne…), via /admin/liberer et son ADMIN_SECRET.
// Mettre TRANSFER_DAYS à un nombre (ex. "30") autorise un transfert par le client tous les N jours.
//
// Secrets : OPENAI_API_KEY, STRIPE_SECRET_KEY, LICENSE_SECRET. Stockage : KV « LICENSES ».
// OPENAI_API_BASE / STRIPE_API_BASE ne servent qu'aux tests (serveurs simulés).

const CHARS_PER_MINUTE = 840;   // ≈ 14 caractères lus par seconde à vitesse normale (estimation)
const MAX_TEXT = 600;           // une phrase ; au-delà la requête est refusée
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-License, X-Device',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
      if (url.pathname === '/merci' && request.method === 'GET') return await thanksPage(url, env);
      if (url.pathname === '/licence' && request.method === 'GET') return json(await licenceStatus(request, env));
      if (url.pathname === '/dub' && request.method === 'POST') return await dub(request, env);
      if (url.pathname === '/activer' && request.method === 'POST') return json(await activate(request, env));
      if (url.pathname === '/admin/liberer' && request.method === 'POST') return json(await adminRelease(request, env));
      if (url.pathname === '/') return new Response('Traducteur Audio — serveur Voix IA Premium : OK', { headers: CORS });
      return json({ error: 'Adresse inconnue' }, 404);
    } catch (e) {
      const status = e.status || 500;
      if (status >= 500) console.error(e);
      return json({ error: e.publicMessage || 'Erreur du serveur Premium', code: e.code }, status);
    }
  }
};

// ---------- Outils ----------
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
}

function fail(status, publicMessage, code) {
  return Object.assign(new Error(publicMessage), { status, publicMessage, code });
}

async function stripe(env, path) {
  const res = await fetch((env.STRIPE_API_BASE || 'https://api.stripe.com') + path, {
    headers: { Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY }
  });
  if (!res.ok) throw fail(res.status === 404 ? 404 : 502, 'Stripe : paiement introuvable');
  return res.json();
}

// Clé de licence dérivée du paiement (HMAC) : revenir sur la page de remerciement redonne la même clé.
async function licenceKeyFor(secret, id) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(id)));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sans 0/O ni 1/I pour éviter les confusions
  const chars = [...sig.slice(0, 16)].map((b) => alphabet[b % alphabet.length]).join('');
  return 'TA-' + chars.match(/.{4}/g).join('-');
}

const monthKey = () => new Date().toISOString().slice(0, 7);   // « 2026-09 »

async function getLicence(request, env, { bind = true } = {}) {
  const key = (request.headers.get('X-License') || '').trim().toUpperCase();
  if (!/^TA-[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(key)) throw fail(401, 'Clé de licence manquante ou mal formée');
  const lic = await env.LICENSES.get('lic:' + key, 'json');
  if (!lic) throw fail(401, 'Clé de licence inconnue');
  const device = (request.headers.get('X-Device') || '').trim();
  if (!/^[a-f0-9-]{36}$/.test(device)) throw fail(400, 'Identifiant d\'appareil manquant : mettez l\'extension à jour');
  if (!lic.device && bind) {
    // 1re activation : la licence est attachée à cet appareil.
    lic.device = device;
    lic.deviceLabel = deviceLabel(request);
    lic.activatedAt = Date.now();
    await env.LICENSES.put('lic:' + key, JSON.stringify(lic));
  } else if (lic.device && lic.device !== device) {
    if (transferDays(env) === null) {
      throw fail(409, `Cette licence est liée définitivement à un autre appareil (${lic.deviceLabel || 'autre navigateur'}). `
        + 'Changement d\'ordinateur : contactez le support.', 'other_device_locked');
    }
    throw fail(409, `Licence déjà active sur un autre appareil (${lic.deviceLabel || 'autre navigateur'}). `
      + 'Utilisez « Transférer sur cet appareil » dans les réglages.', 'other_device');
  }
  return { key, lic };
}

// null = transfert par le client interdit (licence bloquée à vie sur son 1er appareil).
function transferDays(env) {
  const v = String(env.TRANSFER_DAYS ?? 'never').trim().toLowerCase();
  return /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : null;
}

// Réservé au vendeur : détache la licence de son appareil (le prochain appareil qui l'utilise la récupère).
async function adminRelease(request, env) {
  const secret = request.headers.get('X-Admin') || '';
  if (!env.ADMIN_SECRET || env.ADMIN_SECRET.length < 16 || secret !== env.ADMIN_SECRET) throw fail(403, 'Accès refusé');
  const body = await request.json().catch(() => ({}));
  const key = String(body.licence || '').trim().toUpperCase();
  const lic = await env.LICENSES.get('lic:' + key, 'json');
  if (!lic) throw fail(404, 'Licence inconnue');
  const before = lic.deviceLabel || null;
  lic.device = null;
  lic.deviceLabel = null;
  lic.releases = [...(lic.releases || []), Date.now()];
  await env.LICENSES.put('lic:' + key, JSON.stringify(lic));
  return { released: true, licence: key, previousDevice: before, releases: lic.releases.length };
}

function deviceLabel(request) {
  const ua = request.headers.get('User-Agent') || '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : 'navigateur';
  const os = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /CrOS/.test(ua) ? 'Chromebook' : /Linux/.test(ua) ? 'Linux' : 'appareil';
  return `${browser} sur ${os}`;
}

// Transfert volontaire vers l'appareil qui fait la demande (l'ancien est désactivé).
async function activate(request, env) {
  const body = await request.json().catch(() => ({}));
  const key = (request.headers.get('X-License') || '').trim().toUpperCase();
  const device = (request.headers.get('X-Device') || '').trim();
  try {
    const { lic } = await getLicence(request, env);
    return { activated: true, plan: lic.plan, device: lic.deviceLabel };
  } catch (e) {
    if (e.code !== 'other_device' || !body.transfert) throw e;
  }
  const lic = await env.LICENSES.get('lic:' + key, 'json');
  const days = transferDays(env);
  if (days === null) {
    throw fail(403, 'Cette licence est liée définitivement à son premier appareil. Changement d\'ordinateur : contactez le support.', 'locked_forever');
  }
  const last = (lic.transfers || []).slice(-1)[0] || 0;
  const wait = last + days * 86400000 - Date.now();
  if (wait > 0) {
    throw fail(429, `Transfert déjà utilisé récemment : prochain transfert possible dans ${Math.ceil(wait / 86400000)} jour(s).`, 'transfer_wait');
  }
  lic.transfers = [...(lic.transfers || []), Date.now()];
  lic.device = device;
  lic.deviceLabel = deviceLabel(request);
  await env.LICENSES.put('lic:' + key, JSON.stringify(lic));
  return { activated: true, transferred: true, plan: lic.plan, device: lic.deviceLabel };
}

// Abonnement Premium toujours payé ? (résultat gardé 1 h pour ne pas interroger Stripe à chaque phrase)
async function subscriptionActive(env, subId) {
  const cacheKey = 'sub:' + subId;
  const cached = await env.LICENSES.get(cacheKey);
  if (cached) return cached === 'active';
  const sub = await stripe(env, '/v1/subscriptions/' + subId);
  const ok = ['active', 'trialing'].includes(sub.status);
  await env.LICENSES.put(cacheKey, ok ? 'active' : sub.status, { expirationTtl: 3600 });
  return ok;
}

// ---------- Page de remerciement : crée (ou retrouve) la licence ----------
async function thanksPage(url, env) {
  const sessionId = url.searchParams.get('session_id') || '';
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) throw fail(400, 'Lien de paiement invalide');
  const session = await stripe(env, `/v1/checkout/sessions/${sessionId}?expand[]=line_items`);
  if (session.status !== 'complete') throw fail(402, 'Paiement non terminé');
  const priceId = session.line_items && session.line_items.data[0] && session.line_items.data[0].price.id;
  const plan = priceId === env.PRICE_PREMIUM ? 'premium' : priceId === env.PRICE_LIFETIME ? 'lifetime_byok' : null;
  if (!plan) throw fail(400, 'Offre inconnue');
  const key = await licenceKeyFor(env.LICENSE_SECRET, session.id);
  if (!(await env.LICENSES.get('lic:' + key))) {
    await env.LICENSES.put('lic:' + key, JSON.stringify({
      plan, sessionId: session.id, subscription: session.subscription || null,
      email: (session.customer_details && session.customer_details.email) || null, created: Date.now()
    }));
  }
  const label = plan === 'premium' ? 'Premium — 5 h de voix IA par mois' : 'À vie — avec votre propre clé';
  return new Response(`<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Merci — Traducteur Audio</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px;color:#1d1d1f;background:#fff}
.key{font:700 22px ui-monospace,monospace;letter-spacing:1px;background:#f4f4f7;border:1px solid #dcdce2;border-radius:8px;padding:14px;text-align:center}
button{background:#2257e6;color:#fff;border:0;border-radius:6px;padding:10px 14px;font:inherit;cursor:pointer}
@media (prefers-color-scheme:dark){body{background:#1b1b1f;color:#ececf1}.key{background:#26262c;border-color:#3a3a42}}</style></head>
<body><h1>🎉 Merci !</h1><p>Votre offre : <strong>${label}</strong></p>
<p>Votre clé de licence :</p><p class="key" id="k">${key}</p>
<p><button onclick="navigator.clipboard.writeText('${key}');this.textContent='Copiée ✔'">📋 Copier la clé</button></p>
<ol><li>Ouvrez l'extension → <strong>⚙️ Réglages</strong> → <strong>💎 Premium</strong>.</li>
<li>Collez la clé puis cliquez <strong>Activer</strong>.</li></ol>
<p><small>Gardez cette clé : revenir sur cette page (lien du reçu) la réaffiche.</small></p></body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ---------- Statut de la licence ----------
async function licenceStatus(request, env) {
  const { key, lic } = await getLicence(request, env);
  const out = { valid: true, plan: lic.plan, device: lic.deviceLabel };
  if (lic.plan === 'premium') {
    out.valid = await subscriptionActive(env, lic.subscription);
    if (!out.valid) out.reason = 'Abonnement Premium inactif (paiement échoué ou annulé)';
    const used = Number(await env.LICENSES.get(`use:${key}:${monthKey()}`) || 0);
    out.minutesUsed = Math.round(used / CHARS_PER_MINUTE);
    out.minutesLimit = Number(env.PREMIUM_MONTHLY_MINUTES || 300);
  }
  return out;
}

// ---------- Voix IA ----------
async function dub(request, env) {
  const { key, lic } = await getLicence(request, env);
  if (lic.plan !== 'premium') throw fail(403, 'Cette licence utilise votre propre clé : la voix IA ne passe pas par ce serveur');
  if (!(await subscriptionActive(env, lic.subscription))) throw fail(402, 'Abonnement Premium inactif (paiement échoué ou annulé)');
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || '').replace(/\s+/g, ' ').trim();
  if (!text) throw fail(400, 'Texte manquant');
  if (text.length > MAX_TEXT) throw fail(413, 'Phrase trop longue');

  // Quota mensuel (compté en caractères lus, converti en minutes).
  const usageKey = `use:${key}:${monthKey()}`;
  const used = Number(await env.LICENSES.get(usageKey) || 0);
  const limit = Number(env.PREMIUM_MONTHLY_MINUTES || 300) * CHARS_PER_MINUTE;
  if (used + text.length > limit) throw fail(429, 'Quota mensuel de voix IA atteint : la voix du navigateur prend le relais jusqu\'au mois prochain');

  const speed = Math.max(0.7, Math.min(1.2, Number(body.voiceSettings && body.voiceSettings.speed) || 1));
  const tts = await fetch((env.OPENAI_API_BASE || 'https://api.openai.com') + '/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: env.OPENAI_VOICE || 'coral',
      input: text,
      instructions: 'Lis ce texte comme un lecteur calme et naturel, sur un ton neutre et régulier, articulation claire. '
        + 'Ne joue pas le texte, n\'imite pas le ton d\'origine, ignore les exclamations.',
      speed,
      response_format: 'mp3'
    })
  });
  if (!tts.ok) {
    const detail = (await tts.text()).slice(0, 200);
    console.error('OpenAI', tts.status, detail);
    throw fail(tts.status === 429 ? 429 : 502, tts.status === 429 ? 'Voix IA : trop de requêtes, réessayez' : 'Voix IA indisponible');
  }
  const audio = new Uint8Array(await tts.arrayBuffer());
  await env.LICENSES.put(usageKey, String(used + text.length), { expirationTtl: 60 * 60 * 24 * 40 });
  let bin = '';
  for (let i = 0; i < audio.length; i += 0x8000) bin += String.fromCharCode(...audio.subarray(i, i + 0x8000));
  return json({ translation: text, audio: btoa(bin), mime: 'audio/mpeg', speed, voice: 'premium' });
}
