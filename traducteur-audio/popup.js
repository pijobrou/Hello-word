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
  $('engineN8n').disabled = !s.n8nUrl;
  $('n8nBadge').textContent = !s.n8nUrl ? 'Non configurée' : s.engine === 'n8n' ? 'Activée' : 'Désactivée (voix locale)';
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

$('engineN8n').onchange = (e) => {
  chrome.storage.sync.set({ engine: e.target.checked ? 'n8n' : 'local' });
  $('n8nBadge').textContent = e.target.checked ? 'Activée' : 'Désactivée (voix locale)';
};

// Réglages dans un onglet : la popup se ferme dès que Chrome affiche une demande d'autorisation.
$('n8nConfig').onclick = () => { chrome.runtime.openOptionsPage(); window.close(); };
