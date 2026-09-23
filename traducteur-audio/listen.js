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
  const enEl = document.createElement('div'); enEl.className = 'en'; enEl.textContent = '🇬🇧 ' + en;
  const frEl = document.createElement('div'); frEl.className = 'fr'; frEl.textContent = '🇫🇷 ' + fr;
  card.append(enEl, frEl);
  $('log').prepend(card);
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

// Appelé par common.js quand n8n échoue : on le dit une fois, la traduction continue en voix locale.
function onN8nFallback(message) {
  if (fallbackShown) return;
  fallbackShown = true;
  $('notice').hidden = false;
  $('notice').textContent = '⚠️ Voix IA indisponible, voix du navigateur utilisée à la place. '
    + message.replace(/^n8n en pause après une erreur : /, '');
}
getSettings().then((s) => { settings = s; });
chrome.storage.onChanged.addListener(() => getSettings().then((s) => { settings = s; }));

// Chaque phrase anglaise est préparée (traduction + audio) dès son arrivée.
function enqueue(en) {
  const job = prepareDub(en, settings || DEFAULTS).catch((e) => ({ en, error: e }));
  queue.push(job);
  processQueue();
}

async function processQueue() {
  if (speaking) return;
  speaking = true;
  while (queue.length) {
    // On ne jette plus rien : en cas de retard, la voix accélère un peu pour rattraper.
    // (Seul un retard énorme fait sauter les plus anciennes, pour ne pas décrocher de la vidéo.)
    while (queue.length > 8) queue.shift();
    const dub = await queue.shift();
    const boost = Math.min(1.35, 1 + 0.12 * queue.length);
    if (dub.error) {
      setStatus('Erreur de traduction : ' + dub.error.message, 'status-err');
      continue;
    }
    addEntry(dub.en, dub.fr + (dub.via === 'n8n' ? '  🎙️' : ''));
    if (SOURCE === 'mic' && !$('headphones').checked) pauseRecognition();
    duck(true, settings);
    await playDub(dub, { ...settings, rate: settings.rate * boost });
    duck(false, settings);
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
const CHUNK_WORDS = 8;    // envoie dès 8 nouveaux mots
const KEEP_TAIL = 2;      // garde les 2 derniers mots provisoires (encore susceptibles de changer)
const STABLE_MS = 800;    // ou après 0,8 s sans nouveau mot
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
  r.lang = 'en-US';
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
        // Longue phrase sans pause : on envoie déjà le début (les derniers mots peuvent encore changer).
        if (w.length - (sentWords.get(i) || 0) >= CHUNK_WORDS + KEEP_TAIL) emitWords(i, w, w.length - KEEP_TAIL);
      }
    }
    if (pending) {
      // Petite pause dans la parole : on envoie ce qui reste sans attendre que Chrome « finalise ».
      stableTimer = setTimeout(() => emitWords(pending.i, pending.w, pending.w.length), STABLE_MS);
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

if (SOURCE === 'tab') {
  const title = params.get('title');
  $('heading').textContent = '🔊 Son de l\'onglet → voix française';
  $('intro').textContent = (title ? `Onglet : « ${title} ». ` : '')
    + 'La parole anglaise de l\'onglet est reconnue, traduite puis lue en français ; '
    + 'le son de l\'onglet baisse pendant la voix.';
  $('headphonesRow').hidden = true;
  $('tabVolumeRow').hidden = false;
  $('tabVolume').oninput();
  start();
} else {
  $('intro').textContent = 'Le micro écoute l\'anglais (une personne, un haut-parleur, une réunion…), '
    + 'puis chaque phrase est traduite et lue en français.';
}
