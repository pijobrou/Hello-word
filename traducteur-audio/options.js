const $ = (id) => document.getElementById(id);

// ---------- Réglages de la voix, de la vidéo et de l'affichage ----------
const FORMAT = {
  rate: (v) => `(${Number(v).toFixed(2)}×)`,
  pitch: (v) => `(${v < 0.97 ? 'plus grave' : v > 1.03 ? 'plus aiguë' : 'normale'}, ${Number(v).toFixed(2)})`,
  expressiveness: (v) => `(${v < 0.3 ? 'posée' : v > 0.65 ? 'expressive' : 'naturelle'}, ${Math.round(v * 100)} %)`,
  timbre: (v) => `(${v < 0.45 ? 'brillante' : v > 0.55 ? 'douce' : 'neutre'})`,
  voiceVolume: (v) => `(${Math.round(v * 100)} %)`,
  duckVolume: (v) => `(${Math.round(v * 100)} %)`,
  gapMs: (v) => `(${(v / 1000).toFixed(2)} s)`,
  overlaySize: (v) => `(${v} px)`
};

function showValues() {
  document.querySelectorAll('.val').forEach((el) => {
    const input = $(el.dataset.for);
    el.textContent = FORMAT[el.dataset.for] ? FORMAT[el.dataset.for](input.value) : '';
  });
  $('preview').style.fontSize = $('overlaySize').value + 'px';
  $('preview').textContent = langInfo($('targetLang').value || DEFAULTS.targetLang).flag + ' Bonjour à tous, bienvenue dans cette vidéo.';
  $('preview').dataset.en = $('showEnglish').checked ? 'Hello everyone, welcome to this video.' : '';
}

function fillVoices(selected) {
  const voices = voicesFor($('targetLang').value || DEFAULTS.targetLang);
  $('voiceName').replaceChildren(new Option('Automatique (la plus naturelle)', ''),
    ...voices.map((v) => new Option(v.name, v.name)));
  $('voiceName').value = selected;
}

function fillForm(s) {
  fillLanguageSelect($('sourceLang'), s.sourceLang);
  fillLanguageSelect($('targetLang'), s.targetLang);
  document.querySelectorAll('[data-setting]').forEach((el) => {
    const v = s[el.dataset.setting];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  });
  fillVoices(s.voiceName);
  document.querySelectorAll('.profiles button').forEach((b) => b.classList.toggle('active', b.dataset.profile === s.profile));
  showValues();
}

let savedTimer = null;
function saved(text = '✔ Enregistré') {
  $('saved').textContent = text;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { $('saved').textContent = ''; }, 1500);
}

document.querySelectorAll('[data-setting]').forEach((el) => {
  el.addEventListener(el.type === 'range' ? 'input' : 'change', () => {
    const value = el.type === 'checkbox' ? el.checked : el.type === 'range' ? Number(el.value) : el.value;
    // Un réglage modifié à la main : on n'est plus exactement sur le profil choisi.
    const extra = el.dataset.setting === 'targetLang' ? { voiceName: '' } : {};
    // Les langues ne font pas partie des profils : les changer ne « casse » pas le profil choisi.
    const profile = ['sourceLang', 'targetLang', 'voiceName', 'aiFallback', 'lockVoice'].includes(el.dataset.setting) ? {} : { profile: 'custom' };
    chrome.storage.sync.set({ [el.dataset.setting]: value, ...extra, ...profile });
    if (el.dataset.setting === 'targetLang') fillVoices('');
    // Choisir une voix précise remplace la voix mémorisée pour cette langue.
    if (el.dataset.setting === 'voiceName') chrome.storage.sync.get({ lockedVoices: {} }, ({ lockedVoices }) => {
      if (value) lockedVoices[$('targetLang').value] = value; else delete lockedVoices[$('targetLang').value];
      chrome.storage.sync.set({ lockedVoices });
    });
    document.querySelectorAll('.profiles button').forEach((b) => b.classList.remove('active'));
    showValues();
    saved();
  });
});

$('profiles').replaceChildren(...Object.entries(PROFILES).map(([key, p]) => {
  const b = document.createElement('button');
  b.className = 'secondary';
  b.dataset.profile = key;
  b.textContent = p.label;
  b.onclick = async () => {
    const { label, ...values } = p;
    await chrome.storage.sync.set({ ...values, profile: key });
    fillForm(await getSettings());
    saved(`✔ Profil « ${label} » appliqué`);
  };
  return b;
}));

$('swap').onclick = async () => {
  const src = $('sourceLang').value, dst = $('targetLang').value;
  await chrome.storage.sync.set({ sourceLang: dst, targetLang: src, voiceName: '' });
  fillForm(await getSettings());
  saved('✔ Langues inversées');
};

$('listen').onclick = async () => {
  stopDub();
  const s = await getSettings();
  // Phrase d'essai traduite depuis le français vers la langue cible choisie.
  const sample = 'Bonjour à tous, bienvenue dans cette vidéo. Aujourd\'hui, nous allons apprendre quelque chose de nouveau.';
  const dub = await prepareDub(sample, { ...s, sourceLang: 'fr-FR' })
    .catch(() => ({ fr: sample, audio: null }));
  playDub(dub, s);
};
$('stop').onclick = () => stopDub();

$('reset').onclick = async () => {
  const { n8nUrl, engine } = await getSettings();
  await chrome.storage.sync.set({ ...DEFAULTS, n8nUrl, engine });   // on garde la configuration n8n
  fillForm(await getSettings());
  saved('✔ Réglages par défaut rétablis');
};

getSettings().then((s) => {
  fillForm(s);
  speechSynthesis.onvoiceschanged = () => fillVoices($('voiceName').value || s.voiceName);
});

// ---------- Voix IA (n8n) ----------

function status(text, cls = '') {
  $('n8nStatus').textContent = text;
  $('n8nStatus').className = 'hint ' + cls;
}

getSettings().then((s) => {
  $('engineN8n').checked = s.engine === 'n8n';
  $('n8nUrl').value = s.n8nUrl;
  $('n8nKey').value = s.n8nKey;
});

$('engineN8n').onchange = (e) => chrome.storage.sync.set({ engine: e.target.checked ? 'n8n' : 'local' });

// n8n sur ce PC (Docker ou npx) : adresse fixe, autorisée d'office dans le manifeste.
$('useLocal').onclick = () => {
  $('n8nUrl').value = 'http://localhost:5678/webhook/traducteur-audio';
  status('Adresse locale remplie : vérifiez la clé secrète puis cliquez « Enregistrer et tester ».');
};

$('n8nOpen').onclick = () => {
  try { window.open(new URL($('n8nUrl').value.trim()).origin + '/healthz', '_blank'); }
  catch (_) { status('URL invalide.', 'status-err'); }
};

$('n8nSave').onclick = async () => {
  const url = $('n8nUrl').value.trim();
  let origin;
  try { origin = new URL(url).origin + '/*'; } catch (_) { return status('URL invalide.', 'status-err'); }
  // On enregistre d'abord : rien n'est perdu même si la demande d'autorisation est refusée.
  await chrome.storage.sync.set({ n8nUrl: url, engine: 'n8n' });
  await chrome.storage.local.set({ n8nKey: $('n8nKey').value.trim() });
  $('engineN8n').checked = true;
  // L'extension ne peut appeler que les adresses autorisées : Chrome demande l'accès à ce serveur.
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) return status('Enregistré, mais l\'accès au serveur a été refusé : recliquez et choisissez « Autoriser ».', 'status-err');
  status('Test en cours…');
  const t = performance.now();
  try {
    const s = await getSettings();
    const res = await sendMessage({ type: 'dub', force: true, text: 'Hello! The human voice is now working.' });
    const dub = { fr: res.translation, audio: `data:${res.mime || 'audio/mpeg'};base64,${res.audio}`, via: 'n8n' };
    status(`✅ OK en ${Math.round(performance.now() - t)} ms : « ${dub.fr} »`, 'status-ok');
    playDub(dub, s);
  } catch (e) {
    status('❌ ' + e.message, 'status-err');
  }
};
