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
