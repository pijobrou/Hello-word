const $ = (id) => document.getElementById(id);
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let listening = false;   // l'utilisateur veut écouter
let paused = false;      // pause pendant que la voix française parle (sans casque)
let queue = [];
let speaking = false;
let rec = null;

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

async function processQueue() {
  if (speaking) return;
  speaking = true;
  const settings = await getSettings();
  while (queue.length) {
    const en = queue.shift();
    let fr;
    try {
      fr = await translateText(en);
    } catch (e) {
      setStatus('Erreur de traduction : ' + e.message, 'status-err');
      continue;
    }
    addEntry(en, fr);
    if (!$('headphones').checked) pauseRecognition();
    await speakFrench(fr, settings);
  }
  speaking = false;
  resumeRecognition();
}

function pauseRecognition() {
  if (!rec || paused) return;
  paused = true;
  rec.abort();
}

function resumeRecognition() {
  if (!paused) return;
  paused = false;
  if (listening) rec.start();
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
        if (text) { queue.push(text); processQueue(); }
      } else {
        interim += res[0].transcript;
      }
    }
    $('interim').textContent = interim ? '… ' + interim : '';
  };
  r.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      listening = false;
      setStatus('Micro refusé : autorisez le micro pour cette page (icône dans la barre d\'adresse).', 'status-err');
      $('toggle').textContent = '▶️ Démarrer l\'écoute';
    } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
      setStatus('Erreur : ' + e.error, 'status-warn');
    }
  };
  // Chrome coupe la reconnaissance régulièrement : on relance tant qu'on écoute.
  r.onend = () => {
    if (listening && !paused) {
      try { r.start(); } catch (_) { /* déjà démarrée */ }
    } else if (!listening) {
      setStatus('À l\'arrêt.');
    } else {
      setStatus('🔈 Lecture de la traduction…');
    }
  };
  return r;
}

$('toggle').onclick = () => {
  if (!Recognition) {
    setStatus('Reconnaissance vocale indisponible dans ce navigateur (utilisez Chrome ou Edge).', 'status-err');
    return;
  }
  if (!rec) rec = buildRecognition();
  listening = !listening;
  $('toggle').textContent = listening ? '⏹️ Arrêter' : '▶️ Démarrer l\'écoute';
  if (listening) {
    paused = false;
    rec.start();
  } else {
    rec.stop();
    queue = [];
    speechSynthesis.cancel();
  }
};

$('clear').onclick = () => { $('log').innerHTML = ''; };
