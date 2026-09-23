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

return [{ json: {
  ...CONFIG,
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
      "jsonBody": "={{ JSON.stringify({ text: $json.translation, model_id: $json.elevenModel, language_code: $json.target }) }}",
      "options": {"response": {"response": {"responseFormat": "file", "outputPropertyName": "data"}}}},
      credentials=header_cred("elevenlabs", "ElevenLabs")),
  node("Réponse", "n8n-nodes-base.code", 2, [1540, 300], {"jsCode": RESPONSE}),
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

wf = {"name": "Traducteur Audio EN → FR (voix humaine)", "nodes": nodes, "connections": connections,
      "active": False, "settings": {"executionOrder": "v1"}, "pinData": {}}
json.dump(wf, open("traducteur-audio.workflow.json", "w"), ensure_ascii=False, indent=2)
print("ok", len(nodes), "nœuds")
