# 🎙️ Voix humaine via n8n

Ce workflow n8n donne à l'extension une **voix IA naturelle** et une meilleure traduction.
Vos clés API restent **dans n8n** : l'extension n'en contient aucune.

```
Extension ──(phrase anglaise)──▶ Webhook n8n ──▶ Traduction (Google ou DeepL)
                                               ──▶ Voix (ElevenLabs ou OpenAI)
Extension ◀──(texte FR + audio MP3)──────────── Réponse
```

Si n8n ne répond pas, l'extension repasse d'elle-même à la voix du navigateur : la traduction
continue.

## 1. Ce qu'il vous faut

| Quoi | Obligatoire ? | Où |
|---|---|---|
| **n8n** accessible en HTTPS (n8n Cloud, ou n8n auto-hébergé) | oui | n8n.io |
| Clé **ElevenLabs** (voix la plus humaine) | oui, sauf si OpenAI | elevenlabs.io → Profil → API Keys |
| Clé **OpenAI** (voix alternative) | non | platform.openai.com → API keys |
| Clé **DeepL** (meilleure traduction, offre gratuite) | non | deepl.com/pro-api |

Pour un test sur votre ordinateur avec n8n en local (`npx n8n`), l'adresse du webhook est
`http://localhost:5678/webhook/traducteur-audio`.

## 2. Importer le workflow

1. n8n → **Workflows → Import from File** → choisissez `traducteur-audio.workflow.json`.
2. Créez les **Credentials** de type **Header Auth** (Credentials → Add → « Header Auth ») :

| Nom de la credential (exactement) | Name | Value |
|---|---|---|
| `Traducteur - clé extension` | `X-Traducteur-Key` | un mot de passe long que vous inventez |
| `ElevenLabs` | `xi-api-key` | votre clé ElevenLabs |
| `OpenAI` (facultatif) | `Authorization` | `Bearer sk-…` |
| `DeepL` (facultatif) | `Authorization` | `DeepL-Auth-Key votre-clé` |

3. Ouvrez chaque nœud qui a une credential (Webhook, ElevenLabs voix, OpenAI voix, DeepL) et
   sélectionnez la credential correspondante si n8n ne l'a pas reliée tout seul.
4. Ouvrez le nœud **Préparer** et réglez la partie `CONFIG` :
   - `voice: 'elevenlabs'` ou `'openai'` ;
   - `elevenVoiceId` : sur elevenlabs.io → **Voices** → choisissez une voix française → **Copy
     voice ID**. La voix par défaut (Sarah) parle français, mais une voix native sonne mieux ;
   - `translator: 'deepl'` si vous avez une clé DeepL.
5. **Enregistrez**, puis activez le workflow (interrupteur **Active** / **Publish**).

## 3. Brancher l'extension

1. Dans le nœud **Webhook**, copiez la **Production URL**.
2. Popup de l'extension → **🎙️ Voix humaine IA (n8n)** → collez l'URL et la clé secrète
   (la même que la credential `Traducteur - clé extension`) → **Enregistrer et tester**.
3. Chrome vous demande d'autoriser l'accès à votre serveur n8n : acceptez.
4. Vous devez entendre : « Bonjour ! La voix humaine fonctionne maintenant. »

Le test apparaît aussi dans la page **🩺 Diagnostics**.

## Ce que l'extension envoie et reçoit

```http
POST /webhook/traducteur-audio
X-Traducteur-Key: <votre secret>
Content-Type: application/json

{ "text": "Hello everyone", "source": "en", "target": "fr" }
```

```json
{ "translation": "Bonjour à tous", "audio": "<MP3 en base64>", "mime": "audio/mpeg", "voice": "elevenlabs" }
```

## Coûts et rapidité

- Chaque phrase est traduite puis transformée en voix : environ **1 à 2 s** de délai. Pendant
  que la phrase N est lue, la phrase N+1 est déjà préparée, donc la voix s'enchaîne.
- ElevenLabs et OpenAI facturent au nombre de caractères : une heure de vidéo parlée représente
  environ 50 000 caractères. Vérifiez les tarifs actuels sur leurs sites.

## Modifier le workflow

`gen_workflow.py` régénère `traducteur-audio.workflow.json` (`python3 gen_workflow.py`). Vous
pouvez aussi modifier directement le workflow dans n8n.
