// Codes de langue partagés avec les pages (common.js n'est pas chargé dans le service worker).
function n8nCode(code, isTarget) {
  const [l, r] = code.split('-');
  if (isTarget && l === 'en') return r === 'GB' ? 'en-gb' : 'en-us';
  if (isTarget && l === 'pt') return r === 'PT' ? 'pt-pt' : 'pt-br';
  if (l === 'zh' || l === 'yue') return 'zh';
  if (l === 'fil') return 'tl';
  return l;
}

// Service worker : fait les appels de traduction (les content scripts sont soumis au CORS de la page).

const cache = new Map();

async function translateGoogle(text, from, to) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t'
    + `&sl=${from}&tl=${to}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google ${res.status}`);
  const data = await res.json();
  return data[0].map((part) => part[0]).join('');
}

async function translateMyMemory(text, from, to) {
  const url = `https://api.mymemory.translated.net/get?langpair=${from}|${to}&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory ${res.status}`);
  const data = await res.json();
  return data.responseData.translatedText;
}

async function translate(text, from = 'en', to = 'fr') {
  const key = `${from}|${to}|${text}`;
  if (cache.has(key)) return cache.get(key);
  let result;
  try {
    result = await translateGoogle(text, from, to);
  } catch (e) {
    result = await translateMyMemory(text, from, to);
  }
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  cache.set(key, result);
  return result;
}

const ENGINES = { google: translateGoogle, mymemory: translateMyMemory };

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'translate') return false;
  // `engine` force un moteur précis (utilisé par la page de diagnostics).
  const job = msg.engine ? ENGINES[msg.engine](msg.text, msg.from || 'en', msg.to || 'fr')
    : translate(msg.text, msg.from, msg.to);
  job
    .then((translation) => sendResponse({ ok: true, translation }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // réponse asynchrone
});

// Après un échec, n8n est mis en pause 60 s : les phrases passent tout de suite en voix locale
// au lieu d'attendre chacune la fin du délai.
// Identifiant de CET appareil (tiré au hasard à l'installation, jamais synchronisé) : une licence
// Premium ne fonctionne que sur l'appareil où elle a été activée.
async function deviceId() {
  let { deviceId } = await chrome.storage.local.get({ deviceId: '' });
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    await chrome.storage.local.set({ deviceId });
  }
  return deviceId;
}

async function premium(path, { method = 'GET', body } = {}) {
  const { premiumUrl } = await chrome.storage.sync.get({ premiumUrl: '' });
  const { licenseKey } = await chrome.storage.local.get({ licenseKey: '' });
  if (!premiumUrl) throw new Error('Adresse du serveur Premium non configurée');
  if (!licenseKey) throw new Error('Aucune clé de licence : achetez ou collez votre clé dans les Réglages');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(premiumUrl.replace(/\/+$/, '') + path, {
      method, signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-License': licenseKey, 'X-Device': await deviceId() },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error('Premium : ' + (data.error || res.status)), { status: res.status, code: data.code });
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// Statut de la licence, gardé sur l'appareil : sert aussi à autoriser « ma propre clé » hors connexion (7 jours).
async function checkLicence() {
  const status = await premium('/licence');
  await chrome.storage.local.set({ licenceStatus: { ...status, checkedAt: Date.now() } });
  return status;
}

async function licenceAllowsByok() {
  const { licenceStatus } = await chrome.storage.local.get({ licenceStatus: null });
  if (licenceStatus && licenceStatus.valid && Date.now() - licenceStatus.checkedAt < 86400000) return true;
  try {
    const st = await checkLicence();
    return st.valid;
  } catch (e) {
    if (e.status) throw e;   // refus du serveur (autre appareil, licence inconnue…) : pas de délai de grâce
    return !!(licenceStatus && licenceStatus.valid && Date.now() - licenceStatus.checkedAt < 7 * 86400000);
  }
}

// Voix IA d'un texte déjà traduit : serveur Premium, ou directement OpenAI avec la clé du client.
async function tts(text) {
  const { engine, rate, byokVoice, targetLang } = await chrome.storage.sync.get(
    { engine: 'local', rate: 1, byokVoice: 'coral', targetLang: 'fr-FR' });
  const speed = Math.max(0.7, Math.min(1.2, rate));
  if (engine === 'cloud') return premium('/dub', { method: 'POST', body: { text, targetLang, voiceSettings: { speed } } });
  if (engine !== 'byok') throw new Error('Aucun moteur de voix IA choisi');
  if (!(await licenceAllowsByok())) throw new Error('Licence non valide pour « ma propre clé »');
  const { openaiKey } = await chrome.storage.local.get({ openaiKey: '' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: 'Bearer ' + openaiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: byokVoice, input: text, speed, response_format: 'mp3',
        instructions: 'Lis ce texte comme un lecteur calme et naturel, ton neutre et régulier, articulation claire. '
          + 'Ne joue pas le texte, ignore les exclamations.' })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(new Error('OpenAI ' + res.status + ' : ' + ((err.error && err.error.message) || '')), { status: res.status });
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { translation: text, audio: btoa(bin), mime: 'audio/mpeg', speed };
  } finally {
    clearTimeout(timer);
  }
}

let n8nPausedUntil = 0;
let n8nLastError = '';
let n8nFailures = 0;          // échecs d'affilée : n8n n'est mis en pause qu'après 3
const MAX_PARALLEL = 2;       // au-delà, OpenAI/ElevenLabs refusent souvent (limite de requêtes)
let running = 0;
const waiting = [];

// Limite le nombre d'appels simultanés au workflow (les phrases préchargées attendent leur tour).
async function withSlot(fn) {
  if (running >= MAX_PARALLEL) await new Promise((r) => waiting.push(r));
  running++;
  try { return await fn(); } finally { running--; const next = waiting.shift(); if (next) next(); }
}

// Un échec passager (réseau, 429 « trop de requêtes », 5xx) est réessayé deux fois avant d'abandonner.
async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await withSlot(fn);
    } catch (err) {
      const msg = String(err.message);
      // Refus définitifs (licence, autre appareil, quota, abonnement) : inutile de réessayer.
      const final = [401, 402, 403, 409].includes(err.status) || /quota|licence|appareil/i.test(msg);
      const retryable = !final && (err.name === 'AbortError' || err instanceof TypeError
        || /\b(429|500|502|503|504)\b|too many|rate limit|trop de requêtes|timeout/i.test(msg) || err.status === 429);
      if (!retryable || attempt >= 2 || /^voix IA en pause/.test(msg)) throw err;
      await new Promise((r) => setTimeout(r, 900 * (attempt + 1)));   // 0,9 s puis 1,8 s
    }
  }
}

const dubWithRetry = (text, force) => withRetry(() => dub(text, force));

// Voix IA : envoie la phrase au webhook n8n, qui renvoie { translation, audio (MP3 base64), mime }.
async function dub(text, force) {
  if (!force && Date.now() < n8nPausedUntil) throw new Error('voix IA en pause après une erreur : ' + n8nLastError);
  const { n8nUrl } = await chrome.storage.sync.get({ n8nUrl: '' });
  const { n8nKey } = await chrome.storage.local.get({ n8nKey: '' });
  const { expressiveness, rate, aiQuality, sourceLang, targetLang } = await chrome.storage.sync.get(
    { expressiveness: 0.4, rate: 1, aiQuality: 'fast', sourceLang: 'en-US', targetLang: 'fr-FR' });
  // Vitesse appliquée directement par le fournisseur de voix (plus fluide qu'accélérer l'audio ensuite).
  const speed = Math.max(0.7, Math.min(1.2, rate));
  if (!n8nUrl) throw new Error('URL n8n non configurée');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Traducteur-Key': n8nKey },
      body: JSON.stringify({ text, source: n8nCode(sourceLang, false), target: n8nCode(targetLang, true),
        targetLang, voiceSettings: { expressiveness, speed, model: aiQuality } }),
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.text();
      let reason = '';
      try { reason = JSON.parse(body).error || ''; } catch (_) { /* pas du JSON */ }
      // Le workflow renvoie { error: "Nœud : cause" } quand une étape échoue.
      if (reason) throw new Error('Erreur dans n8n → ' + reason);
      throw new Error(`n8n ${res.status} ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const out = Array.isArray(data) ? data[0] : data;
    if (!out || !out.translation) throw new Error('réponse n8n inattendue');
    return out;
  } finally {
    clearTimeout(timer);
  }
}

// Quand l'appel échoue au niveau réseau, on cherche la cause exacte pour guider l'utilisateur.
async function diagnose(n8nUrl) {
  let url;
  try { url = new URL(n8nUrl); } catch (_) { return 'URL du webhook invalide.'; }
  const granted = await chrome.permissions.contains({ origins: [url.origin + '/*'] });
  if (!granted) {
    return `Chrome n'a pas l'autorisation d'appeler ${url.host}. Cliquez « Enregistrer et tester » `
      + 'et acceptez la demande d\'autorisation.';
  }
  try {
    const res = await fetch(url.origin + '/healthz', { cache: 'no-store' });
    if (res.status === 502 || res.status === 530 || res.status >= 520) {
      return `Le tunnel ${url.host} est ouvert, mais n8n ne répond pas derrière (erreur ${res.status}) : `
        + 'démarrez n8n sur votre ordinateur.';
    }
    return `Le serveur ${url.host} répond (healthz ${res.status}), mais l'appel du webhook a été bloqué. `
      + 'Vérifiez que l\'URL se termine par /webhook/traducteur-audio (pas /webhook-test/).';
  } catch (_) {
    if (/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) {
      return `n8n ne tourne pas sur ${url.host} : démarrez Docker Desktop puis le conteneur n8n `
        + '(« docker start n8n »), et vérifiez que http://localhost:5678 s\'ouvre dans le navigateur. '
        + 'Sans n8n, choisissez un autre moteur dans Réglages → Moteur de la voix.';
    }
    return `Le serveur ${url.host} est injoignable. Si c'est un tunnel trycloudflare : il est fermé ou son `
      + 'adresse a changé. Relancez « cloudflared tunnel --url http://localhost:5678 » et collez la nouvelle adresse.';
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'dub') return false;
  dubWithRetry(msg.text, msg.force)
    .then((out) => { n8nPausedUntil = 0; n8nFailures = 0; sendResponse({ ok: true, ...out }); })
    .catch(async (err) => {
      let error = String(err.message || err);
      if (/^voix IA en pause/.test(error)) return sendResponse({ ok: false, error });
      if (err.name === 'AbortError') error = 'n8n : pas de réponse en 15 s.';
      else if (err instanceof TypeError) {
        const { n8nUrl } = await chrome.storage.sync.get({ n8nUrl: '' });
        error = await diagnose(n8nUrl);
      } else if (/^n8n 404/.test(error)) {
        error = 'n8n 404 : le webhook n\'existe pas. Activez (publiez) le workflow dans n8n et utilisez la '
          + '« Production URL » du nœud Webhook.';
      } else if (/^n8n 500/.test(error)) {
        error = 'n8n 500 : le workflow a planté. Dans n8n, ouvrez « Executions » : le nœud en rouge donne la '
          + 'cause (souvent la clé ElevenLabs, l\'ID de voix ou le crédit épuisé).';
      } else if (/^n8n 403/.test(error)) {
        error = 'n8n 403 : clé secrète incorrecte. Elle doit être identique à la credential '
          + '« Traducteur - clé extension » (attention aux espaces).';
      }
      // Un échec isolé ne change pas de voix pour la suite : pause seulement après 3 échecs d'affilée.
      if (++n8nFailures >= 3) { n8nPausedUntil = Date.now() + 30000; n8nFailures = 0; }
      n8nLastError = error;
      sendResponse({ ok: false, error });
    });
  return true;
});

// Voix IA hors n8n (Premium ou ma clé) + licence.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'tts') {
    if (!msg.force && Date.now() < n8nPausedUntil) {
      sendResponse({ ok: false, error: 'voix IA en pause après une erreur : ' + n8nLastError });
      return false;
    }
    withRetry(() => tts(msg.text))
      .then((out) => { n8nPausedUntil = 0; n8nFailures = 0; sendResponse({ ok: true, ...out }); })
      .catch((err) => {
        let error = String(err.message || err);
        if (err.name === 'AbortError') error = 'Voix IA : pas de réponse en 15 s.';
        else if (err instanceof TypeError) error = 'Serveur de voix injoignable : vérifiez votre connexion et l\'adresse du serveur Premium.';
        else if (err.status === 401 && /OpenAI/.test(error)) error = 'OpenAI 401 : votre clé OpenAI est refusée (Réglages → Ma propre clé).';
        if (++n8nFailures >= 3) { n8nPausedUntil = Date.now() + 30000; n8nFailures = 0; }
        n8nLastError = error;
        sendResponse({ ok: false, error, code: err.code });
      });
    return true;
  }
  if (msg.type === 'licence' || msg.type === 'activate') {
    const job = msg.type === 'licence' ? checkLicence()
      : premium('/activer', { method: 'POST', body: { transfert: !!msg.transfert } }).then(async (r) => { await checkLicence(); return r; });
    job.then((out) => sendResponse({ ok: true, ...out }))
      .catch((err) => sendResponse({ ok: false, error: err instanceof TypeError ? 'Serveur Premium injoignable' : String(err.message), code: err.code }));
    return true;
  }
  return false;
});
