// Outils partagés : réglages, traduction et voix française (locale ou via n8n).

const DEFAULTS = {
  enabled: false,      // mode sous-titres actif sur les pages
  rate: 1.1,           // vitesse de la voix française (0,5 à 2)
  pitch: 1,            // hauteur de la voix du navigateur (0,5 grave … 2 aiguë) ; sans effet sur la voix IA
  voiceVolume: 1,      // volume de la voix française (0 à 1)
  gapMs: 150,          // pause entre deux phrases (ms)
  overlaySize: 20,     // taille du texte à l'écran (px)
  showEnglish: false,  // afficher aussi la phrase anglaise sous la traduction
  profile: 'standard', // dernier profil appliqué
  duckVolume: 0.2,     // volume de la vidéo pendant la lecture FR (0 = muet, 1 = inchangé)
  showOverlay: true,   // affiche le texte français sur la page
  voiceName: '',       // voix française locale choisie ('' = automatique)
  chunking: 'balanced', // découpage des phrases : 'fast', 'balanced' ou 'full'
  engine: 'local',     // 'local' (voix du navigateur) ou 'n8n' (voix IA via votre workflow)
  n8nUrl: ''           // URL du webhook n8n
};
// Le secret du webhook reste sur cet appareil (storage.local, jamais synchronisé).
const LOCAL_DEFAULTS = { n8nKey: '' };

function getSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(DEFAULTS, (sync) =>
    chrome.storage.local.get(LOCAL_DEFAULTS, (local) => resolve({ ...sync, ...local }))));
}

function sendMessage(msg) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res || !res.ok) return reject(new Error(res ? res.error : 'pas de réponse'));
      resolve(res);
    });
  });
}

async function translateText(text, from = 'en', to = 'fr') {
  return (await sendMessage({ type: 'translate', text, from, to })).translation;
}

function frenchVoices() {
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
}

// Meilleure voix locale : celle choisie, sinon les voix neuronales (« Natural », « Online »), puis Google.
function pickVoice(voiceName) {
  const voices = frenchVoices();
  const score = (v) => (/natural/i.test(v.name) ? 3 : 0) + (/online/i.test(v.name) ? 2 : 0)
    + (/google/i.test(v.name) ? 1 : 0) + (v.lang === 'fr-FR' ? 0.5 : 0);
  return voices.find((v) => v.name === voiceName)
    || voices.slice().sort((a, b) => score(b) - score(a))[0] || null;
}

// Profils prêts à l'emploi : on les applique d'un clic, puis chaque réglage reste ajustable.
const PROFILES = {
  standard: { label: 'Standard', rate: 1.1, pitch: 1, voiceVolume: 1, duckVolume: 0.2, gapMs: 150,
    chunking: 'balanced', overlaySize: 20, showEnglish: false },
  learning: { label: 'Apprentissage (lent et clair)', rate: 0.85, pitch: 1, voiceVolume: 1, duckVolume: 0.15,
    gapMs: 500, chunking: 'full', overlaySize: 22, showEnglish: true },
  fast: { label: 'Rapide', rate: 1.35, pitch: 1, voiceVolume: 1, duckVolume: 0.3, gapMs: 0,
    chunking: 'fast', overlaySize: 20, showEnglish: false },
  comfort: { label: 'Confort d\'écoute (malentendant)', rate: 0.95, pitch: 0.95, voiceVolume: 1, duckVolume: 0.05,
    gapMs: 300, chunking: 'balanced', overlaySize: 30, showEnglish: false },
  kids: { label: 'Enfant', rate: 0.9, pitch: 1.15, voiceVolume: 1, duckVolume: 0.15, gapMs: 400,
    chunking: 'full', overlaySize: 26, showEnglish: false }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function speakFrench(text, { rate = 1, pitch = 1, voiceVolume = 1, voiceName = '' } = {}) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = Math.max(0.5, Math.min(2, rate));
    u.pitch = Math.max(0.5, Math.min(2, pitch));
    u.volume = Math.max(0, Math.min(1, voiceVolume));
    u.voice = pickVoice(voiceName);
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

// Prépare une phrase : traduction + audio. Lancé dès que la phrase anglaise arrive,
// pour que la suivante soit prête pendant que la précédente est lue.
async function prepareDub(en, settings) {
  if (settings.engine === 'n8n' && settings.n8nUrl) {
    try {
      const res = await sendMessage({ type: 'dub', text: en });
      return { en, fr: res.translation, audio: `data:${res.mime || 'audio/mpeg'};base64,${res.audio}`, via: 'n8n' };
    } catch (e) {
      console.warn('[Traducteur Audio] n8n indisponible, voix locale utilisée :', e.message);
      if (typeof onN8nFallback === 'function') onN8nFallback(e.message);
    }
  }
  return { en, fr: await translateText(en), audio: null, via: 'local' };
}

let currentPlayer = null;

// Coupe immédiatement la voix en cours (IA ou locale).
function stopDub() {
  if (currentPlayer) currentPlayer.pause();
  speechSynthesis.cancel();
}

// Lit une phrase préparée : l'audio IA si disponible, sinon la voix locale.
async function playDub(dub, settings) {
  if (dub.audio) {
    try {
      const player = new Audio(dub.audio);
      currentPlayer = player;
      player.playbackRate = Math.max(0.5, Math.min(2, settings.rate));
      player.volume = Math.max(0, Math.min(1, settings.voiceVolume ?? 1));
      await new Promise((resolve, reject) => {
        player.onended = player.onpause = resolve;
        player.onerror = () => reject(new Error('lecture audio impossible'));
        player.play().catch(reject);
      });
      return;
    } catch (e) {
      console.warn('[Traducteur Audio]', e.message);
    } finally {
      currentPlayer = null;
    }
  }
  await speakFrench(dub.fr, settings);
}

// ---------- Nettoyage de l'anglais reconnu ----------
// Tics et hésitations : toujours retirés.
const FILLERS = new Set(['um', 'umm', 'uh', 'uhh', 'uhm', 'erm', 'er', 'hmm', 'hm', 'mm', 'mmm', 'ah', 'ahh', 'eh', 'huh', 'uh-huh']);
// Exclamations retirées en début de morceau (sans risque de changer le sens).
const LEADING = new Set(['oh', 'wow', 'whoa', 'yeah', 'yep', 'yup', 'okay', 'ok', 'alright', 'so', 'well', 'hey',
  'oops', 'gosh', 'haha', 'ha', 'lol', 'oh-my-god']);
// Un morceau composé uniquement de ces mots n'est pas lu (« wow », « yeah right », « oh my god », « cool »…).
const ONLY_EXCLAMATION = new Set([...LEADING, 'right', 'yes', 'no', 'cool', 'nice', 'awesome', 'great', 'damn',
  'boom', 'guys', 'man', 'dude', 'wait', 'god', 'amazing', 'perfect', 'exactly', 'sure', 'thanks', 'bye']);

function cleanEnglish(text) {
  let t = String(text)
    .replace(/\[[^\]]*\]|\([^)]*\)|♪/g, ' ')       // [Music], [Applause], (laughs), ♪
    .replace(/\boh my (god|gosh)\b/gi, 'oh-my-god');
  let words = t.split(/\s+/).filter(Boolean);
  const bare = (w) => w.toLowerCase().replace(/[^a-z'-]/g, '');
  words = words.filter((w) => !FILLERS.has(bare(w)));
  words = words.filter((w, i) => i === 0 || bare(w) !== bare(words[i - 1]) || !bare(w));   // « the the » → « the »
  if (words.every((w) => ONLY_EXCLAMATION.has(bare(w)))) return '';
  while (words.length > 1 && LEADING.has(bare(words[0]))) words.shift();
  return words.join(' ').replace(/oh-my-god/gi, 'oh my god');
}

// Réglage « découpage » : réactivité ↔ clarté.
const CHUNKING = {
  fast: { words: 8, stableMs: 700 },       // Rapide : démarre vite, phrases parfois coupées
  balanced: { words: 12, stableMs: 900 },  // Équilibré (par défaut)
  full: { words: 20, stableMs: 1200 }      // Phrases complètes : plus clair, ~2 s de plus
};
// Mots avant lesquels on coupe de préférence (début d'une nouvelle idée).
const BREAK_BEFORE = new Set(['and', 'but', 'so', 'because', 'which', 'that', 'then', 'when', 'if', 'or', 'where',
  'while', 'now', 'after', 'before', 'since', 'although', 'though', 'unless', 'until', 'whereas',
  'what', 'how', 'why', 'who']);
