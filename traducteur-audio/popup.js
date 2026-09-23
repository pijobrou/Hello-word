const $ = (id) => document.getElementById(id);

function fillVoices(selected) {
  const select = $('voiceName');
  const voices = frenchVoices();
  select.replaceChildren(new Option('Automatique', ''), ...voices.map((v) => new Option(v.name, v.name)));
  select.value = selected;
}

function labels() {
  $('rateVal').textContent = `(${Number($('rate').value).toFixed(1)}×)`;
  $('duckVal').textContent = `(${Math.round($('duckVolume').value * 100)} %)`;
}

getSettings().then((s) => {
  $('engineN8n').checked = s.engine === 'n8n';
  $('n8nUrl').value = s.n8nUrl;
  $('n8nKey').value = s.n8nKey;
  $('n8nBadge').textContent = s.engine === 'n8n' ? '— activée' : '';
  $('enabled').checked = s.enabled;
  $('rate').value = s.rate;
  $('duckVolume').value = s.duckVolume;
  $('showOverlay').checked = s.showOverlay;
  fillVoices(s.voiceName);
  speechSynthesis.onvoiceschanged = () => fillVoices($('voiceName').value || s.voiceName);
  labels();
});

$('enabled').onchange = (e) => chrome.storage.sync.set({ enabled: e.target.checked });
$('showOverlay').onchange = (e) => chrome.storage.sync.set({ showOverlay: e.target.checked });
$('voiceName').onchange = (e) => chrome.storage.sync.set({ voiceName: e.target.value });
$('rate').oninput = (e) => { labels(); chrome.storage.sync.set({ rate: Number(e.target.value) }); };
$('duckVolume').oninput = (e) => { labels(); chrome.storage.sync.set({ duckVolume: Number(e.target.value) }); };

function openListener(params) {
  chrome.windows.create({
    url: chrome.runtime.getURL('listen.html?' + new URLSearchParams(params)),
    type: 'popup', width: 440, height: 640
  });
  window.close();
}

$('mic').onclick = () => openListener({ source: 'mic' });
$('tab').onclick = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  // Ouvrir la popup a donné l'accès « activeTab » à cet onglet : la fenêtre d'écoute
  // demande elle-même la capture (avec nouvel essai si Chrome refuse la première fois).
  openListener({ source: 'tab', tab: tab.id, title: tab.title || '' });
};
$('diag').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('diagnostics/diagnostics.html') });
$('test').onclick = async () => {
  const s = await getSettings();
  try {
    playDub(await prepareDub('Hello, the translator is working.', s), s);
  } catch (e) {
    speakFrench('La traduction ne répond pas. Ouvrez les diagnostics.', s);
  }
};

function n8nStatus(text, cls = '') {
  $('n8nStatus').textContent = text;
  $('n8nStatus').className = 'hint ' + cls;
}

$('engineN8n').onchange = (e) => {
  chrome.storage.sync.set({ engine: e.target.checked ? 'n8n' : 'local' });
  $('n8nBadge').textContent = e.target.checked ? '— activée' : '';
};

$('n8nSave').onclick = async () => {
  const url = $('n8nUrl').value.trim();
  let origin;
  try { origin = new URL(url).origin + '/*'; } catch (_) { return n8nStatus('URL invalide.', 'status-err'); }
  // L'extension ne peut appeler que les adresses autorisées : on demande l'accès à ce serveur n8n.
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) return n8nStatus('Accès au serveur n8n refusé.', 'status-err');
  await chrome.storage.sync.set({ n8nUrl: url, engine: 'n8n' });
  await chrome.storage.local.set({ n8nKey: $('n8nKey').value });
  $('engineN8n').checked = true;
  $('n8nBadge').textContent = '— activée';
  n8nStatus('Test en cours…');
  const t = performance.now();
  try {
    const s = await getSettings();
    const res = await sendMessage({ type: 'dub', text: 'Hello! The human voice is now working.' });
    const dub = { fr: res.translation, audio: `data:${res.mime || 'audio/mpeg'};base64,${res.audio}`, via: 'n8n' };
    n8nStatus(`✅ OK en ${Math.round(performance.now() - t)} ms : « ${dub.fr} »`, 'status-ok');
    playDub(dub, s);
  } catch (e) {
    n8nStatus('❌ ' + e.message, 'status-err');
  }
};
