// Mode « sous-titres » : lit les sous-titres anglais des vidéos (YouTube ou pistes HTML5),
// les traduit en français et les prononce, en baissant le son de la vidéo pendant ce temps.
(() => {
  if (window.__traducteurAudio) return;
  window.__traducteurAudio = true;

  const DEFAULTS = { enabled: false, rate: 1.1, duckVolume: 0.2, showOverlay: true, voiceName: '' };
  let settings = { ...DEFAULTS };
  let lastText = '';
  let queue = [];
  let speaking = false;
  let debounceTimer = null;
  let overlay = null;
  const savedVolumes = new Map();
  const hookedTracks = new WeakSet();

  // ---------- Traduction & voix ----------
  function translate(text) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'translate', text, from: 'en', to: 'fr' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.ok) return reject(res && res.error);
        resolve(res.translation);
      });
    });
  }

  function speak(text) {
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR';
      u.rate = settings.rate;
      const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('fr'));
      u.voice = voices.find((v) => v.name === settings.voiceName) || voices[0] || null;
      u.onend = u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }

  function duck(on) {
    document.querySelectorAll('video, audio').forEach((m) => {
      if (on) {
        if (!savedVolumes.has(m)) savedVolumes.set(m, m.volume);
        m.volume = Math.min(m.volume, savedVolumes.get(m) * settings.duckVolume);
      } else if (savedVolumes.has(m)) {
        m.volume = savedVolumes.get(m);
        savedVolumes.delete(m);
      }
    });
  }

  function showText(fr) {
    if (!settings.showOverlay) return;
    if (!overlay) {
      overlay = document.createElement('div');
      Object.assign(overlay.style, {
        position: 'fixed', left: '50%', bottom: '12%', transform: 'translateX(-50%)',
        maxWidth: '80vw', padding: '8px 14px', borderRadius: '8px',
        background: 'rgba(0,0,0,.8)', color: '#ffd84d', font: '600 20px/1.35 system-ui, sans-serif',
        textAlign: 'center', zIndex: 2147483647, pointerEvents: 'none'
      });
      document.documentElement.appendChild(overlay);
    }
    overlay.textContent = '🇫🇷 ' + fr;
    overlay.style.display = 'block';
  }

  function hideText() {
    if (overlay) overlay.style.display = 'none';
  }

  async function processQueue() {
    if (speaking) return;
    speaking = true;
    while (queue.length && settings.enabled) {
      // Si on prend du retard, on saute directement à la phrase la plus récente.
      if (queue.length > 2) queue = queue.slice(-1);
      const en = queue.shift();
      try {
        const fr = await translate(en);
        showText(fr);
        duck(true);
        await speak(fr);
      } catch (e) {
        console.warn('[Traducteur Audio]', e);
      }
    }
    duck(false);
    hideText();
    speaking = false;
  }

  function onEnglish(text) {
    text = text.replace(/\s+/g, ' ').trim();
    if (!settings.enabled || !text || text === lastText) return;
    // Sous-titres « roulants » (YouTube) : on n'envoie que la partie nouvelle.
    const fresh = lastText && text.startsWith(lastText) ? text.slice(lastText.length).trim() : text;
    lastText = text;
    if (!fresh) return;
    queue.push(fresh);
    processQueue();
  }

  // ---------- Sources de sous-titres ----------
  // YouTube : on observe le conteneur des sous-titres.
  function readYouTubeCaptions() {
    const segs = document.querySelectorAll('.ytp-caption-segment');
    if (!segs.length) return;
    const text = Array.from(segs).map((s) => s.textContent).join(' ');
    clearTimeout(debounceTimer);
    // On attend que la ligne se stabilise avant de traduire.
    debounceTimer = setTimeout(() => onEnglish(text), 600);
  }

  // Vidéos HTML5 génériques : pistes <track> en anglais.
  function hookTextTracks() {
    document.querySelectorAll('video').forEach((video) => {
      Array.from(video.textTracks || []).forEach((track) => {
        if (hookedTracks.has(track)) return;
        if (!['subtitles', 'captions'].includes(track.kind)) return;
        if (track.language && !track.language.toLowerCase().startsWith('en')) return;
        hookedTracks.add(track);
        if (track.mode === 'disabled') track.mode = 'hidden';
        track.addEventListener('cuechange', () => {
          const cues = Array.from(track.activeCues || []);
          const text = cues.map((c) => (c.text || '').replace(/<[^>]+>/g, '')).join(' ');
          onEnglish(text);
        });
      });
    });
  }

  const observer = new MutationObserver(() => {
    if (!settings.enabled) return;
    readYouTubeCaptions();
    hookTextTracks();
  });

  function start() {
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    hookTextTracks();
    readYouTubeCaptions();
  }

  function stop() {
    observer.disconnect();
    queue = [];
    lastText = '';
    speechSynthesis.cancel();
    duck(false);
    hideText();
  }

  function apply(next) {
    const wasEnabled = settings.enabled;
    settings = { ...settings, ...next };
    if (settings.enabled && !wasEnabled) start();
    if (!settings.enabled && wasEnabled) stop();
  }

  chrome.storage.sync.get(DEFAULTS, (s) => apply(s));
  chrome.storage.onChanged.addListener((changes) => {
    const next = {};
    for (const [k, { newValue }] of Object.entries(changes)) next[k] = newValue;
    apply(next);
  });
})();
