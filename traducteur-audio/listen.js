// Fenêtre d'écoute : reconnaît l'anglais (micro ou son d'un onglet), traduit, lit en français.
const $ = (id) => document.getElementById(id);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const params = new URLSearchParams(location.search);
const SOURCE = params.get('source') === 'tab' ? 'tab' : 'mic';

let listening = false;   // l'utilisateur veut écouter
let paused = false;      // pause pendant la voix française (micro sans casque)
let queue = [];
let speaking = false;
let rec = null;

// Mode onglet : flux audio de l'onglet, rejoué via un GainNode (sinon l'onglet devient muet).
let tabTrack = null;
let tabGain = null;

function setStatus(text, cls = '') {
  $('status').textContent = text;
  $('status').className = 'hint ' + cls;
}

function addEntry(en, fr) {
  const card = document.createElement('div');
  card.className = 'card';
  const src = langInfo((settings && settings.sourceLang) || 'en-US'), dst = langInfo((settings && settings.targetLang) || 'fr-FR');
  const enEl = document.createElement('div'); enEl.className = 'en'; enEl.textContent = src.flag + ' ' + en;
  const frEl = document.createElement('div'); frEl.className = 'fr'; frEl.textContent = dst.flag + ' ' + fr;
  if (settings) frEl.style.fontSize = Math.max(16, settings.overlaySize - 2) + 'px';
  const voiceEl = document.createElement('div'); voiceEl.className = 'voice-used hint';
  card.append(enEl, frEl, voiceEl);
  $('log').prepend(card);
  return voiceEl;
}

function chromeVersion() {
  const m = navigator.userAgent.match(/Chrom(?:e|ium)\/(\d+)/);
  return m ? Number(m[1]) : 0;
}

// Baisse le son de l'onglet pendant la voix française.
function duck(on, settings) {
  if (!tabGain) return;
  const base = Number($('tabVolume').value);
  tabGain.gain.value = on ? base * settings.duckVolume : base;
}

let settings = null;
let fallbackShown = false;

// Appelé par common.js quand la voix IA échoue : on le dit, la traduction continue en voix locale.
function onN8nFallback(message, silent) {
  $('notice').hidden = false;
  $('notice').textContent = (silent
    ? '⚠️ La voix IA a échoué pour une phrase : elle est affichée sans être lue (pour garder une seule voix). '
    : '⚠️ La voix IA a échoué pour une phrase : voix du navigateur utilisée. ')
    + message.replace(/^voix IA en pause après une erreur : /, '');
  if (fallbackShown) return;
  fallbackShown = true;
}
getSettings().then((s) => { settings = s; });
chrome.storage.onChanged.addListener((changes) => getSettings().then((s) => {
  settings = s;
  updateDirection();
  // Nouvelle langue parlée : la reconnaissance doit repartir avec la bonne langue.
  if (changes.sourceLang && rec) {
    rec.lang = s.sourceLang;
    sentWords.clear();
    if (listening && !paused) rec.abort();   // onend la relance aussitôt
  }
}));

// Chaque phrase anglaise est préparée (traduction + audio) dès son arrivée.
function enqueue(raw) {
  // On retire tics et exclamations ; un morceau qui n'en contient que ça n'est pas lu.
  const en = cleanSpeech(raw, (settings && settings.sourceLang) || 'en-US');
  if (!en) return;
  // Voix IA suspendue pour la session (trop lente en direct) : on ne l'appelle même plus.
  const base = settings || DEFAULTS;
  const job = prepareDub(en, aiSuspended ? { ...base, engine: 'local' } : base).catch((e) => ({ en, error: e }));
  queue.push({ job, t0: performance.now(), en });   // t0 : moment où la phrase a été reconnue
  processQueue();
}

// ⚡ Voix IA en retard : on n'attend pas plus que aiDeadlineMs, la voix du navigateur lit la phrase.
async function dubWithDeadline(item) {
  const live = settings.liveMode !== false && isAi(settings);
  if (!live) return item.job;
  const late = await Promise.race([item.job, sleep(settings.aiDeadlineMs || 2000).then(() => null)]);
  if (late) return late;
  const fr = await translateText(item.en, trCode(settings.sourceLang), trCode(settings.targetLang)).catch(() => null);
  return fr ? { en: item.en, fr, audio: null, via: 'local', late: true } : item.job;
}

let lagSmoothed = 0;
// ⚡ Au plus UN changement de voix par session : après 2 ratés de la voix IA (trop lente ou en
// échec), la voix du navigateur la remplace pour toute la suite, au lieu d'alterner les deux.
let aiSuspended = false;
let aiMisses = 0;

function noteAiMiss() {
  if (aiSuspended || settings.liveMode === false || !isAi(settings)) return;
  if (++aiMisses < 2) return;
  aiSuspended = true;
  $('aiSuspended').hidden = false;
}

$('retryAi').onclick = () => { aiSuspended = false; aiMisses = 0; $('aiSuspended').hidden = true; };

async function processQueue() {
  if (speaking) return;
  speaking = true;
  while (queue.length) {
    // On ne jette plus rien : en cas de retard, la voix accélère pour rattraper.
    // (Seul un retard énorme fait sauter les plus anciennes, pour ne pas décrocher de la vidéo.)
    while (queue.length > 8) queue.shift();
    const item = queue.shift();
    let dub = await dubWithDeadline(item);
    if (!dub.error && (dub.late || (isAi(settings) && dub.via === 'local'))) noteAiMiss();
    // Déjà suspendue : même si l'audio IA d'une phrase en attente est prêt, on garde la voix du navigateur.
    if (!dub.error && aiSuspended && dub.via === 'ai') dub = { ...dub, audio: null, via: 'local' };
    if (dub.error) {
      setStatus('Erreur de traduction : ' + dub.error.message, 'status-err');
      continue;
    }
    // Retard réel = temps écoulé depuis que la phrase a été reconnue.
    const lag = (performance.now() - item.t0) / 1000;
    lagSmoothed = lagSmoothed ? lagSmoothed * 0.6 + lag * 0.4 : lag;
    $('lag').textContent = `⏱️ Retard : ${lag.toFixed(1)} s`;
    $('lag').className = 'hint lag ' + (lag > 6 ? 'status-err' : lag > 3.5 ? 'status-warn' : 'status-ok');
    // ⚡ Rattrapage : la voix accélère avec le retard (jusqu'à 1,5×) et avec la file d'attente.
    const byLag = settings.liveMode !== false ? 1 + Math.max(0, lag - 2.5) / 7 : 1;
    const boost = Math.min(settings.liveMode !== false ? 1.5 : 1.35, Math.max(byLag, 1 + 0.12 * queue.length));
    const voiceEl = addEntry(dub.en, dub.fr + ({ ai: '  🎙️', silent: '  🔇', local: '' }[dub.via] || ''));
    if (SOURCE === 'mic' && !$('headphones').checked) pauseRecognition();
    duck(true, settings);
    let used;
    try {
      used = await playDub(dub, { ...settings, rate: settings.rate * boost });
    } catch (e) {
      used = 'erreur de lecture : ' + e.message;   // une phrase ratée ne doit jamais bloquer la file
    }
    voiceEl.textContent = `🔈 ${used}${dub.late ? ' — voix IA trop lente, lue tout de suite' : ''} · retard ${lag.toFixed(1)} s`
      + (boost > 1.02 ? ` · accéléré ×${boost.toFixed(2)}` : '');
    if (lagSmoothed > 6 && isAi(settings)) {
      $('notice').hidden = false;
      $('notice').textContent = '⏱️ Le retard dépasse 6 s avec la voix IA. Pour le direct, la voix du navigateur '
        + '(Réglages → Moteur de la voix) ou le découpage « Rapide » réduisent nettement le délai.';
    }
    duck(false, settings);
    if (settings.gapMs && !queue.length) await sleep(settings.gapMs);   // pas de pause si on a du retard
  }
  speaking = false;
  resumeRecognition();
}

function startRecognition() {
  // Chrome 135+ : start(track) reconnaît la parole d'une piste audio au lieu du micro.
  if (SOURCE === 'tab') rec.start(tabTrack);
  else rec.start();
}

function pauseRecognition() {
  if (!rec || paused) return;
  paused = true;
  rec.abort();
}

function resumeRecognition() {
  if (!paused) return;
  paused = false;
  if (listening) startRecognition();
}


async function captureTab() {
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: Number(params.get('tab')) });
  return navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } }
  });
}

async function openTabStream() {
  if (tabTrack && tabTrack.readyState === 'live') return;
  let stream;
  // Chrome refuse parfois la première capture (« Error starting tab capture ») : on réessaie.
  for (let attempt = 1; ; attempt++) {
    try {
      stream = await captureTab();
      break;
    } catch (e) {
      if (attempt >= 3) throw e;
      await sleep(500 * attempt);
    }
  }
  tabTrack = stream.getAudioTracks()[0];
  const ctx = new AudioContext();
  tabGain = ctx.createGain();
  tabGain.gain.value = Number($('tabVolume').value);
  ctx.createMediaStreamSource(stream).connect(tabGain).connect(ctx.destination);
  tabTrack.onended = () => {
    tabTrack = null;
    stop();
    setStatus('La capture de l\'onglet s\'est arrêtée (onglet fermé ou changé de page). '
      + 'Relancez depuis l\'icône de l\'extension sur la vidéo.', 'status-warn');
  };
}

// Découpage en morceaux : Chrome ne « finalise » une phrase qu'à la fin d'une vraie pause,
// ce qui peut prendre 5 à 10 s dans une vidéo. On envoie donc le texte dès qu'il est stable.
const KEEP_TAIL = 2;      // garde les 2 derniers mots provisoires (encore susceptibles de changer)
const MIN_CHUNK = 5;      // jamais de morceau de moins de 5 mots quand on coupe une phrase en cours
function isEnglishSource() { return !settings || (settings.sourceLang || 'en-US').startsWith('en'); }
function chunkCfg() { return CHUNKING[(settings && settings.chunking) || 'balanced'] || CHUNKING.balanced; }
const sentWords = new Map(); // index du résultat → nombre de mots déjà envoyés
let stableTimer = null;

function splitWords(text) {
  return text.trim().split(/\s+/).filter(Boolean);
}

function emitWords(index, words, upto) {
  const done = sentWords.get(index) || 0;
  if (upto <= done) return;
  sentWords.set(index, upto);
  enqueue(words.slice(done, upto).join(' '));
}

function buildRecognition() {
  const r = new Recognition();
  r.lang = (settings && settings.sourceLang) || 'en-US';
  r.continuous = true;
  r.interimResults = true;
  r.onstart = () => { sentWords.clear(); setStatus('🔴 Écoute en cours…', 'status-ok'); };
  r.onresult = (event) => {
    clearTimeout(stableTimer);
    let pending = null;
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const w = splitWords(res[0].transcript);
      if (res.isFinal) {
        emitWords(i, w, w.length);
      } else {
        pending = { i, w };
        // Longue phrase sans pause : on envoie déjà le début, coupé de préférence avant
        // « and / but / because… » pour ne pas casser une idée en deux.
        const done = sentWords.get(i) || 0;
        if (w.length - done >= chunkCfg().words + KEEP_TAIL) {
          let cut = w.length - KEEP_TAIL;
          for (let k = cut - 1; k >= done + MIN_CHUNK; k--) {
            if (isEnglishSource() && BREAK_BEFORE.has(w[k].toLowerCase())) { cut = k; break; }
          }
          emitWords(i, w, cut);
        }
      }
    }
    if (pending) {
      // Petite pause dans la parole : on envoie ce qui reste sans attendre que Chrome « finalise ».
      stableTimer = setTimeout(() => emitWords(pending.i, pending.w, pending.w.length), chunkCfg().stableMs);
      const rest = pending.w.slice(sentWords.get(pending.i) || 0).join(' ');
      $('interim').textContent = rest ? '… ' + rest : '';
    } else {
      $('interim').textContent = '';
    }
  };
  r.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      listening = false;
      setStatus(SOURCE === 'mic'
        ? 'Micro refusé : autorisez le micro pour cette page (icône dans la barre d\'adresse).'
        : 'Reconnaissance refusée : ' + e.error, 'status-err');
      $('toggle').textContent = '▶️ Démarrer l\'écoute';
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      setStatus('Erreur : ' + e.error, 'status-warn');
    }
  };
  // Chrome coupe la reconnaissance régulièrement : on relance tant qu'on écoute.
  r.onend = () => {
    if (listening && !paused) {
      try { startRecognition(); } catch (_) { /* déjà démarrée */ }
    } else if (!listening) {
      setStatus('À l\'arrêt.');
    } else {
      setStatus('🔈 Lecture de la traduction…');
    }
  };
  return r;
}

async function start() {
  if (!Recognition) {
    setStatus('Reconnaissance vocale indisponible dans ce navigateur (utilisez Chrome ou Edge).', 'status-err');
    return;
  }
  if (SOURCE === 'tab') {
    if (chromeVersion() && chromeVersion() < 135) {
      setStatus(`Le mode onglet demande Chrome/Edge 135 ou plus (vous avez ${chromeVersion()}). `
        + 'Mettez le navigateur à jour, ou utilisez le doublage par sous-titres.', 'status-err');
      return;
    }
    try {
      setStatus('Connexion au son de l\'onglet…');
      await openTabStream();
    } catch (e) {
      setStatus('Impossible de capter l\'onglet : ' + e.message
        + '. Retournez sur la vidéo, cliquez l\'icône de l\'extension puis « Traduire le son de cet onglet ».', 'status-err');
      return;
    }
  }
  if (!rec) rec = buildRecognition();
  listening = true;
  paused = false;
  $('toggle').textContent = '⏹️ Arrêter';
  try {
    startRecognition();
  } catch (e) {
    listening = false;
    $('toggle').textContent = '▶️ Démarrer l\'écoute';
    setStatus('Erreur au démarrage : ' + e.message, 'status-err');
  }
}

function stop() {
  listening = false;
  $('toggle').textContent = '▶️ Démarrer l\'écoute';
  if (rec) rec.stop();
  queue = [];
  stopDub();
}

$('toggle').onclick = () => (listening ? stop() : start());
$('clear').onclick = () => { $('log').innerHTML = ''; };
$('tabVolume').oninput = () => {
  $('tabVolumeVal').textContent = `(${Math.round($('tabVolume').value * 100)} %)`;
  if (tabGain && !speaking) tabGain.gain.value = Number($('tabVolume').value);
};

function updateDirection() {
  if (!settings) return;
  $('engine').textContent = 'Moteur : ' + (isAi(settings) ? ENGINE_LABELS[settings.engine]
    : ENGINE_LABELS.local + (settings.engine !== 'local' ? ' — voix IA non configurée' : ''));
  const src = langInfo(settings.sourceLang), dst = langInfo(settings.targetLang);
  $('direction').textContent = `${src.flag} ${src.fr} → ${dst.flag} ${dst.fr}`;
  $('qSource').value = settings.sourceLang;
  $('qTarget').value = settings.targetLang;
}

if (SOURCE === 'tab') {
  const title = params.get('title');
  $('heading').textContent = '🔊 Son de l\'onglet → voix traduite';
  $('intro').textContent = (title ? `Onglet : « ${title} ». ` : '')
    + 'La parole de l\'onglet est reconnue, traduite puis lue dans la langue choisie ; '
    + 'le son de l\'onglet baisse pendant la voix.';
  $('headphonesRow').hidden = true;
  $('tabVolumeRow').hidden = false;
  $('tabVolume').oninput();
  start();
} else {
  $('intro').textContent = 'Le micro écoute la personne qui parle (en face de vous, un haut-parleur, une réunion…), '
    + 'puis chaque phrase est traduite et lue dans la langue choisie.';
}

// ---------- Réglages rapides (modifiables pendant l'écoute) ----------
const QUICK = [
  ['qRate', 'rate', (v) => `(${Number(v).toFixed(2)}×)`],
  ['qPitch', 'pitch', (v) => `(${v < 0.97 ? 'grave' : v > 1.03 ? 'aiguë' : 'normale'} ${Number(v).toFixed(2)})`],
  ['qExpr', 'expressiveness', (v) => `(${v < 0.3 ? 'posé' : v > 0.65 ? 'expressif' : 'naturel'})`],
  ['qTimbre', 'timbre', (v) => `(${v < 0.45 ? 'brillant' : v > 0.55 ? 'doux' : 'neutre'})`],
  ['qVoiceVolume', 'voiceVolume', (v) => `(${Math.round(v * 100)} %)`],
  ['qDuck', 'duckVolume', (v) => `(${Math.round(v * 100)} %)`],
  ['qGap', 'gapMs', (v) => `(${(v / 1000).toFixed(2)} s)`]
];

function fillQuick(s) {
  $('qProfile').value = PROFILES[s.profile] ? s.profile : 'custom';
  $('qChunking').value = s.chunking;
  $('qQuality').value = s.aiQuality;
  $('qFallback').value = s.aiFallback;
  for (const [id, key, fmt] of QUICK) {
    $(id).value = s[key];
    $(id + 'Val').textContent = fmt(s[key]);
  }
}

$('qProfile').replaceChildren(
  ...Object.entries(PROFILES).map(([key, p]) => new Option(p.label, key)),
  new Option('Personnalisé', 'custom'));

$('qProfile').onchange = async (e) => {
  const p = PROFILES[e.target.value];
  if (!p) return;
  const { label, ...values } = p;
  await chrome.storage.sync.set({ ...values, profile: e.target.value });
};
$('qChunking').onchange = (e) => chrome.storage.sync.set({ chunking: e.target.value, profile: 'custom' });
$('qQuality').onchange = (e) => chrome.storage.sync.set({ aiQuality: e.target.value });
$('qFallback').onchange = (e) => chrome.storage.sync.set({ aiFallback: e.target.value });
for (const [id, key, fmt] of QUICK) {
  $(id).oninput = (e) => {
    $(id + 'Val').textContent = fmt(e.target.value);
    chrome.storage.sync.set({ [key]: Number(e.target.value), profile: 'custom' });
  };
}
$('allSettings').onclick = () => chrome.runtime.openOptionsPage();

// On se souvient si l'utilisateur a replié les réglages rapides (préférence locale, facultative).
try { if (localStorage.getItem('quickOpen') === '0') $('quick').open = false; } catch (_) { /* stockage indisponible */ }
$('quick').ontoggle = () => { try { localStorage.setItem('quickOpen', $('quick').open ? '1' : '0'); } catch (_) { /* ignoré */ } };

getSettings().then(fillQuick);
// Réglages changés ailleurs (popup, page de réglages) : on met la fenêtre à jour.
chrome.storage.onChanged.addListener(() => getSettings().then(fillQuick));

// ---------- Langues dans la fenêtre d'écoute ----------
fillLanguageSelect($('qSource'), DEFAULTS.sourceLang);
fillLanguageSelect($('qTarget'), DEFAULTS.targetLang);
$('qSource').onchange = (e) => chrome.storage.sync.set({ sourceLang: e.target.value });
$('qTarget').onchange = (e) => chrome.storage.sync.set({ targetLang: e.target.value, voiceName: '' });
$('qSwap').onclick = () => chrome.storage.sync.set({ sourceLang: $('qTarget').value, targetLang: $('qSource').value, voiceName: '' });
getSettings().then((s) => { settings = s; updateDirection(); });

// Pendant l'écoute d'un onglet, on prévient cet onglet : son mode « sous-titres » se tait,
// sinon deux lecteurs parleraient en même temps avec deux voix différentes.
if (SOURCE === 'tab') {
  const notify = () => chrome.tabs.sendMessage(Number(params.get('tab')), { type: 'listenWindowActive' })
    .then((res) => {
      const copies = (res && res.copies) || [];
      if (copies.length > 1) {
        $('dupWarning').hidden = false;
        $('dupWarning').textContent = `⚠️ ${copies.length} copies de « Traducteur Audio » sont installées et parlent en même temps `
          + '(voix qui changent). Ouvrez chrome://extensions, gardez la plus récente et supprimez les autres.';
      }
    })
    .catch(() => {});
  notify();
  setInterval(notify, 3000);
}

// ---------- Un seul lecteur à la fois ----------
// Une nouvelle fenêtre d'écoute arrête les précédentes (sinon deux voix se chevauchent).
const readers = new BroadcastChannel('traducteur-audio-lecteur');
const myId = Math.random().toString(36).slice(2);
readers.postMessage({ type: 'takeover', id: myId });
readers.onmessage = (e) => {
  if (e.data && e.data.type === 'takeover' && e.data.id !== myId && listening) {
    stop();
    setStatus('⏸️ Arrêtée : une autre fenêtre de traduction a pris le relais (une seule voix à la fois).', 'status-warn');
  }
};
// Le mode « sous-titres » de tous les onglets se tait tant qu'une fenêtre d'écoute tourne.
setInterval(() => { if (listening) chrome.storage.local.set({ listenHeartbeat: Date.now() }); }, 3000);

function onLockedVoiceMissing(name) {
  $('notice').hidden = false;
  $('notice').textContent = name
    ? `🔒 La voix verrouillée « ${name} » est indisponible sur cet appareil : les phrases sont affichées sans être lues. `
      + 'Choisissez une autre voix dans ⚙️ Réglages → Voix.'
    : '🔒 Aucune voix installée pour cette langue : installez-en une, ou utilisez une voix IA (Premium ou ma clé).';
}

async function showLockedVoice() {
  const s = await getSettings();
  const { lockedVoices = {} } = await chrome.storage.sync.get({ lockedVoices: {} });
  $('qLock').checked = s.lockVoice !== false;
  $('qLive').checked = s.liveMode !== false;
  const name = isAi(s) ? ENGINE_LABELS[s.engine] : (s.voiceName || lockedVoices[s.targetLang] || 'choisie à la première phrase');
  $('qLockName').textContent = s.lockVoice !== false
    ? `🔒 ${name}` + (s.liveMode !== false ? ' — remplacée ponctuellement plutôt que de laisser un silence' : ' — jamais remplacée (silence si indisponible)')
    : '(la voix peut changer en cas de problème)';
}
$('qLock').onchange = (e) => chrome.storage.sync.set({ lockVoice: e.target.checked });
$('qLive').onchange = (e) => chrome.storage.sync.set({ liveMode: e.target.checked });
showLockedVoice();
chrome.storage.onChanged.addListener(() => showLockedVoice());
