// Outils partagés : réglages, traduction et synthèse vocale française.

const DEFAULTS = {
  enabled: false,      // mode sous-titres actif sur les pages
  rate: 1.1,           // vitesse de la voix française
  duckVolume: 0.2,     // volume de la vidéo pendant la lecture FR (0 = muet, 1 = inchangé)
  showOverlay: true,   // affiche le texte français sur la page
  voiceName: ''        // voix française choisie ('' = automatique)
};

function getSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(DEFAULTS, resolve));
}

function translateText(text, from = 'en', to = 'fr') {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'translate', text, from, to }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res || !res.ok) return reject(new Error(res ? res.error : 'pas de réponse'));
      resolve(res.translation);
    });
  });
}

function frenchVoices() {
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
}

function speakFrench(text, { rate = 1, voiceName = '' } = {}) {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = rate;
    const voices = frenchVoices();
    u.voice = voices.find((v) => v.name === voiceName) || voices[0] || null;
    u.onend = u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}
