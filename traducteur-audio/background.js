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

// Voix IA : envoie la phrase au webhook n8n, qui renvoie { translation, audio (MP3 base64), mime }.
async function dub(text) {
  const { n8nUrl } = await chrome.storage.sync.get({ n8nUrl: '' });
  const { n8nKey } = await chrome.storage.local.get({ n8nKey: '' });
  if (!n8nUrl) throw new Error('URL n8n non configurée');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Traducteur-Key': n8nKey },
      body: JSON.stringify({ text, source: 'en', target: 'fr' }),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`n8n ${res.status} ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const out = Array.isArray(data) ? data[0] : data;
    if (!out || !out.translation) throw new Error('réponse n8n inattendue');
    return out;
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'dub') return false;
  dub(msg.text)
    .then((out) => sendResponse({ ok: true, ...out }))
    .catch((err) => sendResponse({ ok: false, error: err.name === 'AbortError' ? 'n8n : délai dépassé (20 s)' : String(err.message || err) }));
  return true;
});
