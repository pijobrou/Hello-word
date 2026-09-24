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
    const profile = ['sourceLang', 'targetLang', 'voiceName', 'aiFallback', 'lockVoice', 'liveMode'].includes(el.dataset.setting) ? {} : { profile: 'custom' };
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
  const { n8nUrl, engine, premiumUrl } = await getSettings();
  await chrome.storage.sync.set({ ...DEFAULTS, n8nUrl, engine, premiumUrl });   // on garde le moteur et les adresses
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

// ---------- Moteur de la voix ----------
const ENGINE_HINTS = {
  local: 'Gratuit, instantané, idéal en direct. Sur Edge, les voix « Natural » sont très fluides.',
  cloud: 'Voix IA naturelle fournie par le service : 5 h par mois incluses. Licence liée à cet appareil.',
  byok: 'Toutes les fonctions à vie ; la voix IA utilise votre propre compte OpenAI.',
  n8n: 'Pour les utilisateurs avancés qui hébergent leur propre workflow n8n.'
};

function showEngine(engine) {
  $('engine').value = engine;
  $('engineHint').textContent = ENGINE_HINTS[engine] || '';
  $('boxLicence').hidden = !['cloud', 'byok'].includes(engine);
  $('boxByok').hidden = engine !== 'byok';
  $('boxN8n').hidden = engine !== 'n8n';
}

getSettings().then((s) => {
  showEngine(s.engine);
  $('n8nUrl').value = s.n8nUrl;
  $('n8nKey').value = s.n8nKey;
  $('licenseKey').value = s.licenseKey;
  $('premiumUrl').value = s.premiumUrl;
  $('openaiKey').value = s.openaiKey;
  showLicence(s.licenceStatus);
});
$('buyPremium').href = PURCHASE_LINKS.premium;
$('buyLifetime').href = PURCHASE_LINKS.lifetime;
$('engine').onchange = (e) => { chrome.storage.sync.set({ engine: e.target.value }); showEngine(e.target.value); };

function licenceMsg(text, cls = '') {
  $('licenceStatus').textContent = text;
  $('licenceStatus').className = 'hint ' + cls;
}

function showLicence(st) {
  if (!st) return licenceMsg('Aucune licence activée sur cet appareil.');
  if (!st.valid) return licenceMsg('❌ ' + (st.reason || 'Licence non valide'), 'status-err');
  const plan = st.plan === 'premium' ? '💎 Premium' : '🔑 À vie (ma propre clé)';
  const minutes = st.plan === 'premium' ? ` — ${st.minutesUsed} / ${st.minutesLimit} min de voix IA ce mois-ci` : '';
  licenceMsg(`✅ ${plan} actif sur ${st.device || 'cet appareil'}${minutes}`, 'status-ok');
}

async function saveLicenceFields() {
  const url = $('premiumUrl').value.trim().replace(/\/+$/, '');
  const key = $('licenseKey').value.trim().toUpperCase();
  if (!/^TA-[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/.test(key)) { licenceMsg('Clé de licence mal formée (TA-XXXX-XXXX-XXXX-XXXX).', 'status-err'); return false; }
  let origin;
  try { origin = new URL(url).origin + '/*'; } catch (_) { licenceMsg('Adresse du serveur Premium invalide.', 'status-err'); return false; }
  await chrome.storage.sync.set({ premiumUrl: url });
  await chrome.storage.local.set({ licenseKey: key });
  if (!(await chrome.permissions.request({ origins: [origin] }))) {
    licenceMsg('Accès au serveur Premium refusé : recliquez et choisissez « Autoriser ».', 'status-err');
    return false;
  }
  return true;
}

async function activate(transfert) {
  if (!(await saveLicenceFields())) return;
  licenceMsg('Vérification…');
  try {
    await sendMessage({ type: 'activate', transfert });
    const { licenceStatus } = await chrome.storage.local.get({ licenceStatus: null });
    showLicence(licenceStatus);
    $('transfer').hidden = true;
  } catch (e) {
    licenceMsg('❌ ' + e.message, 'status-err');
    // Transfert proposé seulement si le serveur l'autorise (sinon : licence bloquée à vie, contacter le support).
    $('transfer').hidden = !/Transférer sur cet appareil/.test(e.message);
  }
}
$('activate').onclick = () => activate(false);
$('transfer').onclick = () => {
  if (confirm('Transférer la licence sur cet appareil ? L\'autre appareil sera désactivé. (1 transfert par mois)')) activate(true);
};

function byokMsg(text, cls = '') { $('byokStatus').textContent = text; $('byokStatus').className = 'hint ' + cls; }
$('byokSave').onclick = async () => {
  const key = $('openaiKey').value.trim();
  if (!/^sk-/.test(key)) return byokMsg('La clé OpenAI commence par « sk- ».', 'status-err');
  await chrome.storage.local.set({ openaiKey: key });
  if (!(await chrome.permissions.request({ origins: ['https://api.openai.com/*'] }))) return byokMsg('Accès à OpenAI refusé.', 'status-err');
  byokMsg('Test en cours…');
  try {
    const s = await getSettings();
    const res = await sendMessage({ type: 'tts', force: true, text: 'Bonjour ! Votre voix OpenAI fonctionne.' });
    byokMsg('✅ Voix OpenAI OK', 'status-ok');
    playDub({ fr: res.translation, audio: `data:${res.mime};base64,${res.audio}`, via: 'ai', speed: res.speed }, s);
  } catch (e) {
    byokMsg('❌ ' + e.message, 'status-err');
  }
};

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
  showEngine('n8n');
  // L'extension ne peut appeler que les adresses autorisées : Chrome demande l'accès à ce serveur.
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) return status('Enregistré, mais l\'accès au serveur a été refusé : recliquez et choisissez « Autoriser ».', 'status-err');
  status('Test en cours…');
  const t = performance.now();
  try {
    const s = await getSettings();
    const res = await sendMessage({ type: 'dub', force: true, text: 'Hello! The human voice is now working.' });
    const dub = { fr: res.translation, audio: `data:${res.mime || 'audio/mpeg'};base64,${res.audio}`, via: 'ai' };
    status(`✅ OK en ${Math.round(performance.now() - t)} ms : « ${dub.fr} »`, 'status-ok');
    playDub(dub, s);
  } catch (e) {
    status('❌ ' + e.message, 'status-err');
  }
};
