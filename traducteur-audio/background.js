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
let n8nPausedUntil = 0;
let n8nLastError = '';

// Voix IA : envoie la phrase au webhook n8n, qui renvoie { translation, audio (MP3 base64), mime }.
async function dub(text, force) {
  if (!force && Date.now() < n8nPausedUntil) throw new Error('n8n en pause après une erreur : ' + n8nLastError);
  const { n8nUrl } = await chrome.storage.sync.get({ n8nUrl: '' });
  const { n8nKey } = await chrome.storage.local.get({ n8nKey: '' });
  if (!n8nUrl) throw new Error('URL n8n non configurée');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Traducteur-Key': n8nKey },
      body: JSON.stringify({ text, source: 'en', target: 'fr' }),
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
    return `Le serveur ${url.host} est injoignable. Si c'est un tunnel trycloudflare : il est fermé ou son `
      + 'adresse a changé. Relancez « cloudflared tunnel --url http://localhost:5678 » et collez la nouvelle adresse.';
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'dub') return false;
  dub(msg.text, msg.force)
    .then((out) => { n8nPausedUntil = 0; sendResponse({ ok: true, ...out }); })
    .catch(async (err) => {
      let error = String(err.message || err);
      if (/^n8n en pause/.test(error)) return sendResponse({ ok: false, error });
      if (err.name === 'AbortError') error = 'n8n : pas de réponse en 8 s.';
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
      n8nPausedUntil = Date.now() + 60000;
      n8nLastError = error;
      sendResponse({ ok: false, error });
    });
  return true;
});
