const $ = (id) => document.getElementById(id);
const ICON = { ok: '✅', warn: '⚠️', err: '❌', run: '⏳' };
let report = [];

function row(label) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${ICON.run}</td><td><strong></strong><div class="hint"></div></td>`;
  tr.querySelector('strong').textContent = label;
  $('results').appendChild(tr);
  return (state, detail) => {
    tr.cells[0].textContent = ICON[state];
    tr.querySelector('.hint').textContent = detail;
    tr.querySelector('.hint').className = 'hint status-' + state;
    report.push(`${ICON[state]} ${label} — ${detail}`);
  };
}

function waitVoices() {
  return new Promise((resolve) => {
    if (speechSynthesis.getVoices().length) return resolve();
    speechSynthesis.onvoiceschanged = () => resolve();
    setTimeout(resolve, 2000);
  });
}

async function timed(fn) {
  const t = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t) };
}

async function run() {
  $('results').innerHTML = '';
  report = [];
  const m = chrome.runtime.getManifest();
  $('meta').textContent = `Version ${m.version} · ID ${chrome.runtime.id} · ${navigator.userAgent}`;

  // 1. Synthèse vocale
  const synth = row('Synthèse vocale (voix de sortie)');
  if (!('speechSynthesis' in window)) synth('err', 'API speechSynthesis absente.');
  else {
    await waitVoices();
    const target = (await getSettings()).targetLang;
    const fr = voicesFor(target);
    const name = langInfo(target).fr;
    if (fr.length) synth('ok', `${fr.length} voix (${name}) : ${fr.map((v) => v.name).join(', ')}`);
    else synth('warn', `Aucune voix « ${name} » installée : ajoutez cette langue dans les voix du système, ou utilisez la voix IA.`);
  }

  // 2. Reconnaissance vocale
  const recog = row('Reconnaissance vocale (mode micro et onglet)');
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (Recognition) recog('ok', 'Disponible (Chrome/Edge, nécessite Internet).');
  else recog('err', 'Indisponible : utilisez Chrome ou Edge pour le mode micro.');

  // 2 bis. Mode onglet
  const tabMode = row('Traduction du son de l\'onglet (Chrome/Edge 135+)');
  const version = Number((navigator.userAgent.match(/Chrom(?:e|ium)\/(\d+)/) || [])[1] || 0);
  if (!chrome.tabCapture) tabMode('err', 'Permission tabCapture absente.');
  else if (!Recognition) tabMode('err', 'Reconnaissance vocale indisponible.');
  else if (version && version < 135) tabMode('err', `Version ${version} : mettez à jour Chrome/Edge (135+ requis).`);
  else tabMode('ok', `Disponible (navigateur ${version || 'inconnu'}).`);

  // 3. Micro
  const mic = row('Permission du micro');
  try {
    const p = await navigator.permissions.query({ name: 'microphone' });
    const map = { granted: ['ok', 'Autorisé.'], prompt: ['warn', 'Pas encore demandé : cliquez « Autoriser le micro ».'],
                  denied: ['err', 'Refusé : réautorisez-le dans les paramètres du site.'] };
    mic(...map[p.state]);
  } catch (e) {
    mic('warn', 'État inconnu : ' + e.message);
  }

  // 4 & 5. Moteurs de traduction
  for (const [engine, label] of [['google', 'Google Translate'], ['mymemory', 'MyMemory (secours)']]) {
    const tr = row(`Traduction — ${label}`);
    try {
      const { value, ms } = await timed(() => new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'translate', engine, text: 'Good morning, how are you?' }, (res) => {
          if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
          res && res.ok ? resolve(res.translation) : reject(new Error(res ? res.error : 'pas de réponse'));
        });
      }));
      tr('ok', `« ${value} » (${ms} ms)`);
    } catch (e) {
      tr(engine === 'google' ? 'err' : 'warn', e.message);
    }
  }

  const settings = await getSettings();

  // 5 bis. Voix IA via n8n
  const n8n = row('Voix humaine IA (workflow n8n)');
  if (settings.engine !== 'n8n') n8n('warn', 'Désactivée : voix locale du navigateur (popup → « Voix humaine IA »).');
  else {
    try {
      const { value, ms } = await timed(() => sendMessage({ type: 'dub', force: true, text: 'Good morning, how are you?' }));
      n8n('ok', `« ${value.translation} » + audio ${Math.round(value.audio.length * 0.75 / 1024)} Ko (${ms} ms)`);
    } catch (e) {
      n8n('err', e.message + ' — la voix locale est utilisée en secours.');
    }
  }

  // 6. Onglet actif / mode vidéo
  const vid = row('Mode vidéo (doublage des sous-titres)');
  vid(settings.enabled ? 'ok' : 'warn',
    settings.enabled ? 'Activé sur toutes les pages.' : 'Désactivé : activez-le depuis la popup.');

  // La clé n8n n'apparaît jamais dans le rapport (il peut être copié et partagé).
  const shown = { ...settings, n8nKey: settings.n8nKey ? '•••• (définie)' : '(vide)' };
  $('settings').textContent = JSON.stringify(shown, null, 2);
}

$('rerun').onclick = run;
$('mic').onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch (_) { /* résultat affiché par le test */ }
  run();
};
$('voice').onclick = async () => {
  const s = await getSettings();
  playDub(await prepareDub('Hello! The French voice works correctly.', s), s);
};
$('reset').onclick = () => chrome.storage.sync.clear(() => chrome.storage.local.clear(run));
$('copy').onclick = () => navigator.clipboard.writeText(
  `Diagnostics Traducteur Audio\n${$('meta').textContent}\n\n${report.join('\n')}\n\n${$('settings').textContent}`
).then(() => { $('copy').textContent = '📋 Copié !'; setTimeout(() => { $('copy').textContent = '📋 Copier le rapport'; }, 1500); });

run();
