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
    // Trop de retard : on abandonne les phrases les plus anciennes pour rester synchro.
    while (queue.length > 3) queue.shift();
    const dub = await queue.shift();
    if (dub.error) {
      setStatus('Erreur de traduction : ' + dub.error.message, 'status-err');
      continue;
    }
    addEntry(dub.en, dub.fr + (dub.via === 'n8n' ? '  🎙️' : ''));
    if (SOURCE === 'mic' && !$('headphones').checked) pauseRecognition();
    duck(true, settings);
    await playDub(dub, settings);
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

function buildRecognition() {
  const r = new Recognition();
  r.lang = 'en-US';
  r.continuous = true;
  r.interimResults = true;
  r.onstart = () => setStatus('🔴 Écoute en cours…', 'status-ok');
  r.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (res.isFinal) {
        const text = res[0].transcript.trim();
        if (text) enqueue(text);
      } else {
        interim += res[0].transcript;
      }
    }
    $('interim').textContent = interim ? '… ' + interim : '';
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
