// Mode « sous-titres » : lit les sous-titres anglais des vidéos (YouTube ou pistes HTML5),
// les traduit en français et les prononce, en baissant le son de la vidéo pendant ce temps.
(() => {
  if (window.__traducteurAudio) return;
  window.__traducteurAudio = true;

  let settings = { ...DEFAULTS, ...LOCAL_DEFAULTS };
  let lastText = '';
  let queue = [];
  let speaking = false;
  let debounceTimer = null;
  let overlay = null;
  const savedVolumes = new Map();
  const hookedTracks = new WeakSet();

  // Traduction et voix : prepareDub / playDub / stopDub viennent de common.js.

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

  function showText(fr, en) {
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
    overlay.style.fontSize = settings.overlaySize + 'px';
    overlay.textContent = langInfo(settings.targetLang).flag + ' ' + fr;
    if (settings.showEnglish && en) {
      const small = document.createElement('div');
      Object.assign(small.style, { fontSize: '0.7em', color: '#ddd', fontWeight: 400, marginTop: '4px' });
      small.textContent = en;
      overlay.appendChild(small);
    }
    overlay.style.display = 'block';
  }

  function hideText() {
    if (overlay) overlay.style.display = 'none';
  }

  async function processQueue() {
    if (speaking) return;
    speaking = true;
    while (queue.length && settings.enabled) {
      // En cas de retard, la voix accélère un peu au lieu de sauter des phrases.
      while (queue.length > 6) queue.shift();
      const dub = await queue.shift();
      const boost = Math.min(1.35, 1 + 0.12 * queue.length);
      if (dub.error) { console.warn('[Traducteur Audio]', dub.error); continue; }
      showText(dub.fr, dub.en);
      duck(true);
      await playDub(dub, { ...settings, rate: settings.rate * boost });
      if (settings.gapMs && !queue.length) await sleep(settings.gapMs);
    }
    duck(false);
    hideText();
    speaking = false;
  }

  // Chaque copie installée de l'extension laisse son identifiant sur la page : si on en voit deux,
  // deux extensions « Traducteur Audio » tournent en même temps (deux voix qui se relaient).
  const root = document.documentElement;
  const ids = new Set((root.getAttribute('data-traducteur-audio') || '').split(',').filter(Boolean));
  ids.add(chrome.runtime.id);
  root.setAttribute('data-traducteur-audio', [...ids].join(','));

  // La fenêtre « Traduire le son de cet onglet » est ouverte sur cet onglet : elle s'occupe de la voix.
  let listenWindowUntil = 0;
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === 'listenWindowActive') {
      if (Date.now() >= listenWindowUntil && speaking) { queue = []; stopDub(); }
      listenWindowUntil = Date.now() + 8000;
      reply({ copies: (root.getAttribute('data-traducteur-audio') || '').split(',').filter(Boolean) });
    }
  });

  function onEnglish(text) {
    if (Date.now() < listenWindowUntil) return;
    text = text.replace(/\s+/g, ' ').trim();
    if (!settings.enabled || !text || text === lastText) return;
    // Sous-titres « roulants » (YouTube) : on n'envoie que la partie nouvelle.
    const fresh = lastText && text.startsWith(lastText) ? text.slice(lastText.length).trim() : text;
    lastText = text;
    const cleaned = cleanSpeech(fresh, settings.sourceLang);   // retire [Music], tics, exclamations seules
    if (!cleaned) return;
    // Préparée tout de suite (traduction + audio) pendant que la phrase précédente est lue.
    queue.push(prepareDub(cleaned, settings).catch((error) => ({ error })));
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
        const base = (settings.sourceLang || 'en-US').split('-')[0];
        if (track.language && !track.language.toLowerCase().startsWith(base)) return;
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
    stopDub();
    duck(false);
    hideText();
  }

  function apply(next) {
    const wasEnabled = settings.enabled;
    settings = { ...settings, ...next };
    if (settings.enabled && !wasEnabled) start();
    if (!settings.enabled && wasEnabled) stop();
  }

  getSettings().then((s) => apply(s));
  chrome.storage.onChanged.addListener(() => getSettings().then((s) => apply(s)));
})();
