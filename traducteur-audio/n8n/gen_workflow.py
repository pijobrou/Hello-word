# Génère traducteur-audio.workflow.json (à importer dans n8n). Relancer après modification.
import json, uuid

def node(name, type_, version, pos, params, **extra):
    n = {"parameters": params, "id": str(uuid.uuid5(uuid.NAMESPACE_URL, name)), "name": name,
         "type": type_, "typeVersion": version, "position": pos}
    n.update(extra)
    return n

def header_cred(key, name):
    return {"httpHeaderAuth": {"id": key, "name": name}}

PREPARE = r"""// ⚙️ RÉGLAGES — modifiez ici (les clés API sont dans les « Credentials » n8n, pas ici).
const CONFIG = {
  translator: 'google',            // 'google' (gratuit, sans clé) ou 'deepl' (meilleure qualité)
  voice: 'elevenlabs',             // 'elevenlabs' (la plus humaine) ou 'openai'
  elevenVoiceId: 'EXAVITQu4vr4xnSDxMaL', // ID de la voix ElevenLabs (bibliothèque de voix → « Copy voice ID »)
  elevenModel: 'eleven_flash_v2_5',      // rapide (~75 ms) ; 'eleven_multilingual_v2' = qualité max, plus lent
  openaiVoice: 'coral',            // alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer, verse, marin, cedar
  openaiModel: 'gpt-4o-mini-tts',
  openaiInstructions: 'Parle en français de France, ton naturel et chaleureux, débit fluide, comme un doubleur professionnel.',
};

const body = $input.first().json.body || {};
const text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 1500);
if (!text) throw new Error('Champ "text" manquant');

// Expressivité choisie dans l'extension : 0 = posée et régulière, 1 = vivante et expressive.
const expr = Math.max(0, Math.min(1, Number(body.voiceSettings?.expressiveness ?? 0.4)));
const elevenSettings = {
  stability: Number((0.8 - 0.55 * expr).toFixed(2)),   // stable = régulier ; bas = plus vivant
  similarity_boost: 0.75,
  style: Number((0.45 * expr).toFixed(2)),             // exagération du style
  use_speaker_boost: true,
};
const tone = expr < 0.3 ? ' Ton posé, calme et régulier.' : expr > 0.65 ? ' Ton vivant, expressif et enthousiaste.' : '';

return [{ json: {
  ...CONFIG,
  openaiInstructions: CONFIG.openaiInstructions + tone,
  elevenSettings,
  text,
  source: String(body.source || 'en').toLowerCase(),
  target: String(body.target || 'fr').toLowerCase(),
} }];
"""

TRANSLATED = r"""// Uniformise la réponse du traducteur choisi.
const cfg = $('Préparer').first().json;
const r = $input.first().json;
let translation;
if (cfg.translator === 'deepl') {
  translation = r.translations[0].text;
} else {
  // Google renvoie un tableau JSON brut : [[["traduction","original",…],…],…]
  translation = JSON.parse(r.data)[0].map((part) => part[0]).join('');
}
return [{ json: { ...cfg, translation: String(translation).trim() } }];
"""

RESPONSE = r"""// Renvoie le texte traduit + l'audio MP3 en base64 à l'extension.
const cfg = $('Texte traduit').first().json;
const buffer = await this.helpers.getBinaryDataBuffer(0, 'data');
return [{ json: {
  translation: cfg.translation,
  audio: buffer.toString('base64'),
  mime: 'audio/mpeg',
  voice: cfg.voice,
} }];
"""

ERROR = r"""// Une étape a échoué : on renvoie la cause lisible à l'extension (au lieu d'un « 500 » muet).
const node = $prevNode.name;
const e = $input.first().json.error ?? $input.first().json;
let detail = typeof e === 'string' ? e : [e.message, e.description].filter(Boolean).join(' — ') || JSON.stringify(e);
const d = detail.toLowerCase();
let hint = '';
// Causes précises d'abord (ElevenLabs renvoie aussi 401 pour un quota épuisé).
if (/quota|credits|insufficient/.test(d))
  hint = 'crédits épuisés chez ce fournisseur (voir votre compte ElevenLabs/OpenAI).';
else if (/paid_plan|library voice|payment|402/.test(d))
  hint = 'voix non disponible avec l\'offre gratuite ElevenLabs : utilisez une voix « Default/Premade » ou l\'ID par défaut EXAVITQu4vr4xnSDxMaL.';
else if (/voice_not_found|voice not found/.test(d))
  hint = 'ID de voix introuvable : recopiez-le dans le nœud Préparer (entre guillemets).';
else if (/credential/.test(d))
  hint = 'aucune credential sélectionnée : ouvrez ce nœud et choisissez-la dans la liste.';
else if (/401|unauthorized|invalid_api_key|invalid api key|authorization failed|forbidden|403/.test(d))
  hint = 'clé API refusée : vérifiez la credential de ce nœud (valeur collée sans espace, bon « Name »).';
else if (/429|too many/.test(d))
  hint = 'trop de requêtes, réessayez dans une minute (ou passez à DeepL).';
else if (/404/.test(d))
  hint = 'adresse introuvable chez le fournisseur (ID de voix ou modèle incorrect ?).';
return [{ json: { error: `${node} : ${hint ? hint + ' ' : ''}(${detail.slice(0, 300)})` } }];
"""

nodes = [
  node("Webhook", "n8n-nodes-base.webhook", 2, [0, 300], {
      "httpMethod": "POST", "path": "traducteur-audio", "authentication": "headerAuth",
      "responseMode": "responseNode", "options": {}},
      webhookId="traducteur-audio", credentials=header_cred("trad-secret", "Traducteur - clé extension")),
  node("Préparer", "n8n-nodes-base.code", 2, [220, 300], {"jsCode": PREPARE}),
  node("Traducteur ?", "n8n-nodes-base.if", 2, [440, 300], {
      "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                     "conditions": [{"id": "c1", "leftValue": "={{ $json.translator }}", "rightValue": "deepl",
                                     "operator": {"type": "string", "operation": "equals"}}],
                     "combinator": "and"}, "options": {}}),
  node("DeepL", "n8n-nodes-base.httpRequest", 4.2, [660, 200], {
      "method": "POST", "url": "https://api-free.deepl.com/v2/translate",
      "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
      "sendBody": True, "specifyBody": "json",
      "jsonBody": "={{ JSON.stringify({ text: [$json.text], source_lang: $json.source.toUpperCase(), target_lang: $json.target.toUpperCase() }) }}",
      "options": {}}, credentials=header_cred("deepl", "DeepL")),
  node("Google Translate", "n8n-nodes-base.httpRequest", 4.2, [660, 400], {
      "url": "https://translate.googleapis.com/translate_a/single",
      "sendQuery": True, "queryParameters": {"parameters": [
          {"name": "client", "value": "gtx"}, {"name": "dt", "value": "t"},
          {"name": "sl", "value": "={{ $json.source }}"}, {"name": "tl", "value": "={{ $json.target }}"},
          {"name": "q", "value": "={{ $json.text }}"}]},
      "options": {"response": {"response": {"responseFormat": "text", "outputPropertyName": "data"}}}}),
  node("Texte traduit", "n8n-nodes-base.code", 2, [880, 300], {"jsCode": TRANSLATED}),
  node("Voix ?", "n8n-nodes-base.if", 2, [1100, 300], {
      "conditions": {"options": {"caseSensitive": True, "leftValue": "", "typeValidation": "strict"},
                     "conditions": [{"id": "c2", "leftValue": "={{ $json.voice }}", "rightValue": "openai",
                                     "operator": {"type": "string", "operation": "equals"}}],
                     "combinator": "and"}, "options": {}}),
  node("OpenAI voix", "n8n-nodes-base.httpRequest", 4.2, [1320, 200], {
      "method": "POST", "url": "https://api.openai.com/v1/audio/speech",
      "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
      "sendBody": True, "specifyBody": "json",
      "jsonBody": "={{ JSON.stringify({ model: $json.openaiModel, voice: $json.openaiVoice, input: $json.translation, instructions: $json.openaiInstructions, response_format: 'mp3' }) }}",
      "options": {"response": {"response": {"responseFormat": "file", "outputPropertyName": "data"}}}},
      credentials=header_cred("openai", "OpenAI")),
  node("ElevenLabs voix", "n8n-nodes-base.httpRequest", 4.2, [1320, 400], {
      "method": "POST",
      "url": "=https://api.elevenlabs.io/v1/text-to-speech/{{ $json.elevenVoiceId }}?output_format=mp3_44100_128",
      "authentication": "genericCredentialType", "genericAuthType": "httpHeaderAuth",
      "sendBody": True, "specifyBody": "json",
      "jsonBody": "={{ JSON.stringify({ text: $json.translation, model_id: $json.elevenModel, language_code: $json.target, voice_settings: $json.elevenSettings }) }}",
      "options": {"response": {"response": {"responseFormat": "file", "outputPropertyName": "data"}}}},
      credentials=header_cred("elevenlabs", "ElevenLabs")),
  node("Réponse", "n8n-nodes-base.code", 2, [1540, 300], {"jsCode": RESPONSE}),
  node("Erreur", "n8n-nodes-base.code", 2, [1540, 560], {"jsCode": ERROR}),
  node("Répondre (erreur)", "n8n-nodes-base.respondToWebhook", 1.1, [1760, 560], {
      "respondWith": "json", "responseBody": "={{ $json }}", "options": {"responseCode": 502}}),
  node("Répondre à l'extension", "n8n-nodes-base.respondToWebhook", 1.1, [1760, 300], {
      "respondWith": "json", "responseBody": "={{ $json }}", "options": {}}),
]

def link(*targets):
    return [[{"node": t, "type": "main", "index": 0}] for t in targets]

connections = {
  "Webhook": {"main": link("Préparer")},
  "Préparer": {"main": link("Traducteur ?")},
  "Traducteur ?": {"main": link("DeepL", "Google Translate")},   # sortie 0 = vrai, 1 = faux
  "DeepL": {"main": link("Texte traduit")},
  "Google Translate": {"main": link("Texte traduit")},
  "Texte traduit": {"main": link("Voix ?")},
  "Voix ?": {"main": link("OpenAI voix", "ElevenLabs voix")},
  "OpenAI voix": {"main": link("Réponse")},
  "ElevenLabs voix": {"main": link("Réponse")},
  "Réponse": {"main": link("Répondre à l'extension")},
}

# Les nœuds qui peuvent échouer envoient leur erreur vers « Erreur » (2e sortie) au lieu de planter.
CAN_FAIL = ["Préparer", "DeepL", "Google Translate", "Texte traduit", "OpenAI voix", "ElevenLabs voix", "Réponse"]
for n in nodes:
    if n["name"] in CAN_FAIL:
        n["onError"] = "continueErrorOutput"
        connections[n["name"]]["main"].append([{"node": "Erreur", "type": "main", "index": 0}])
connections["Erreur"] = {"main": link("Répondre (erreur)")}

wf = {"name": "Traducteur Audio EN → FR (voix humaine)", "nodes": nodes, "connections": connections,
      "active": False, "settings": {"executionOrder": "v1"}, "pinData": {}}
json.dump(wf, open("traducteur-audio.workflow.json", "w"), ensure_ascii=False, indent=2)

# Vérifie la syntaxe JavaScript de chaque nœud Code (nécessite Node.js ; ignoré s'il est absent).
import shutil, subprocess, tempfile
if shutil.which("node"):
    for n in nodes:
        if n["type"] == "n8n-nodes-base.code":
            with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
                f.write("async function check($input, $prevNode, $) {\n" + n["parameters"]["jsCode"] + "\n}")
            r = subprocess.run(["node", "--check", f.name], capture_output=True, text=True)
            if r.returncode:
                raise SystemExit(f"Erreur de syntaxe dans le nœud « {n['name']} » :\n{r.stderr}")
print("ok", len(nodes), "nœuds")
