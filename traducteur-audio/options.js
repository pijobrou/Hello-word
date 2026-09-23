const $ = (id) => document.getElementById(id);

function status(text, cls = '') {
  $('n8nStatus').textContent = text;
  $('n8nStatus').className = 'hint ' + cls;
}

getSettings().then((s) => {
  $('engineN8n').checked = s.engine === 'n8n';
  $('n8nUrl').value = s.n8nUrl;
  $('n8nKey').value = s.n8nKey;
});

$('engineN8n').onchange = (e) => chrome.storage.sync.set({ engine: e.target.checked ? 'n8n' : 'local' });

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
  $('engineN8n').checked = true;
  // L'extension ne peut appeler que les adresses autorisées : Chrome demande l'accès à ce serveur.
  const granted = await chrome.permissions.request({ origins: [origin] });
  if (!granted) return status('Enregistré, mais l\'accès au serveur a été refusé : recliquez et choisissez « Autoriser ».', 'status-err');
  status('Test en cours…');
  const t = performance.now();
  try {
    const s = await getSettings();
    const res = await sendMessage({ type: 'dub', force: true, text: 'Hello! The human voice is now working.' });
    const dub = { fr: res.translation, audio: `data:${res.mime || 'audio/mpeg'};base64,${res.audio}`, via: 'n8n' };
    status(`✅ OK en ${Math.round(performance.now() - t)} ms : « ${dub.fr} »`, 'status-ok');
    playDub(dub, s);
  } catch (e) {
    status('❌ ' + e.message, 'status-err');
  }
};
