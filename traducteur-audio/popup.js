const $ = (id) => document.getElementById(id);

let currentTarget = DEFAULTS.targetLang;

function fillVoices(selected) {
  const select = $('voiceName');
  const voices = voicesFor(currentTarget);
  select.replaceChildren(new Option('Automatique', ''), ...voices.map((v) => new Option(v.name, v.name)));
  select.value = selected;
}

function labels() {
  $('rateVal').textContent = `(${Number($('rate').value).toFixed(2)}×)`;
  $('duckVal').textContent = `(${Math.round($('duckVolume').value * 100)} %)`;
}

getSettings().then((s) => {
  currentTarget = s.targetLang;
  fillLanguageSelect($('sourceLang'), s.sourceLang);
  fillLanguageSelect($('targetLang'), s.targetLang);
  $('engineLabel').textContent = ENGINE_LABELS[s.engine] + (s.engine !== 'local' && !isAi(s) ? ' (à configurer)' : '');
  const st = s.licenceStatus;
  $('planLabel').textContent = !st ? '' : !st.valid ? '❌ Licence non valide'
    : st.plan === 'premium' ? `💎 Premium : ${st.minutesUsed} / ${st.minutesLimit} min ce mois-ci` : '🔑 Licence à vie active';
  $('enabled').checked = s.enabled;
  $('rate').value = s.rate;
  $('duckVolume').value = s.duckVolume;
  $('showOverlay').checked = s.showOverlay;
  $('chunking').value = s.chunking;
  fillVoices(s.voiceName);
  speechSynthesis.onvoiceschanged = () => fillVoices($('voiceName').value || s.voiceName);
  labels();
});

$('enabled').onchange = (e) => chrome.storage.sync.set({ enabled: e.target.checked });
$('chunking').onchange = (e) => chrome.storage.sync.set({ chunking: e.target.value });
$('showOverlay').onchange = (e) => chrome.storage.sync.set({ showOverlay: e.target.checked });
$('voiceName').onchange = (e) => chrome.storage.sync.set({ voiceName: e.target.value });
$('rate').oninput = (e) => { labels(); chrome.storage.sync.set({ rate: Number(e.target.value), profile: 'custom' }); };
$('duckVolume').oninput = (e) => { labels(); chrome.storage.sync.set({ duckVolume: Number(e.target.value) }); };

function openListener(params) {
  chrome.windows.create({
    url: chrome.runtime.getURL('listen.html?' + new URLSearchParams(params)),
    type: 'popup', width: 460, height: 820
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


// Réglages dans un onglet : la popup se ferme dès que Chrome affiche une demande d'autorisation.
$('n8nConfig').onclick = () => { chrome.runtime.openOptionsPage(); window.close(); };
$('settingsBtn').onclick = () => { chrome.runtime.openOptionsPage(); window.close(); };

$('sourceLang').onchange = (e) => chrome.storage.sync.set({ sourceLang: e.target.value });
$('targetLang').onchange = (e) => {
  currentTarget = e.target.value;
  chrome.storage.sync.set({ targetLang: currentTarget, voiceName: '' });
  fillVoices('');
};
$('swap').onclick = () => {
  const src = $('sourceLang').value, dst = $('targetLang').value;
  $('sourceLang').value = dst; $('targetLang').value = src; currentTarget = src;
  chrome.storage.sync.set({ sourceLang: dst, targetLang: src, voiceName: '' });
  fillVoices('');
};
