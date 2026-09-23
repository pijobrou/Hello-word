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

$('mic').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('listen.html') });
$('diag').onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL('diagnostics/diagnostics.html') });
$('test').onclick = async () => {
  const s = await getSettings();
  try {
    const fr = await translateText('Hello, the translator is working.');
    speakFrench(fr, s);
  } catch (e) {
    speakFrench('La traduction ne répond pas. Ouvrez les diagnostics.', s);
  }
};
