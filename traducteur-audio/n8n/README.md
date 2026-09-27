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

Deux fichiers sont fournis :

| Fichier | Contenu |
|---|---|
| **`traducteur-audio.workflow.json`** (référence) | Version corrigée et validée dans n8n : DeepL + voix OpenAI, avec les credentials intégrées de n8n et une consigne de lecture neutre (le ton ou les exclamations du narrateur ne sont pas imités). |
| `traducteur-audio.workflow.options-voix.json` (facultatif) | Variante générée par `gen_workflow.py`, qui prend en compte les réglages **Style** et **Qualité** de l'extension, ainsi que la vitesse appliquée par le fournisseur. |

1. n8n → **Workflows → Import from File** → `traducteur-audio.workflow.json`.
2. Créez les **Credentials** :

| Credential | Type n8n | Contenu |
|---|---|---|
| `Traducteur - clé extension` | **Header Auth** | Name `X-Traducteur-Key`, Value : un mot de passe long que vous inventez |
| OpenAI | **OpenAI API** (intégrée) | votre clé `sk-…` |
| DeepL | **DeepL API** (intégrée) | votre clé DeepL (offre Free) |
| `ElevenLabs` (si `voice: 'elevenlabs'`) | **Header Auth** | Name `xi-api-key`, Value : votre clé ElevenLabs |

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
2. Popup de l'extension → **⚙️ Configurer la voix IA** (un onglet s'ouvre) → collez l'URL et la clé
   secrète (la même que la credential `Traducteur - clé extension`) → **Enregistrer et tester**.
3. Chrome vous demande d'autoriser l'accès à votre serveur n8n : cliquez **Autoriser**.
4. Vous devez entendre : « Bonjour ! La voix humaine fonctionne maintenant. »

Le test apparaît aussi dans la page **🩺 Diagnostics**. Si n8n ne répond pas pendant une traduction,
un avertissement s'affiche, la voix du navigateur prend le relais tout de suite et n8n est
réessayé une minute plus tard.

## Style de la voix

Les réglages **Hauteur**, **Timbre**, **Vitesse**, **Volume** et **Pause** sont traités par
l'extension : ils marchent avec les deux workflows.

Le curseur **Style : posé ↔ expressif** et le choix **Qualité** ne sont pris en compte que par la
variante `options-voix`. Le workflow de référence garde sa consigne de ton fixe et les ignore.
Le curseur **Style** de l'extension est envoyé au workflow. Pour ElevenLabs, il
règle `stability` et `style` : une voix posée est régulière et calme, une voix expressive est vivante
et animée. Pour OpenAI, il ajoute une consigne de ton. 

## En cas d'erreur

Si une étape échoue, le workflow renvoie la cause à l'extension, qui l'affiche en clair. Par
exemple : « ElevenLabs voix : aucune credential sélectionnée », « clé API refusée », « voix non
disponible avec l'offre gratuite », « ID de voix introuvable » ou « crédits épuisés ».
Sur l'offre gratuite d'ElevenLabs, seules les voix **Default / Premade** sont utilisables par API.
Les voix de la *Voice Library* demandent un forfait payant.

### Mettre à jour le workflow (nouvelle version)

1. Dans n8n, ouvrez l'ancien workflow → menu **⋯** → **Archive** ou **Delete**. Deux workflows ne
   peuvent pas écouter la même adresse.
2. **Import from File** → le fichier voulu (référence ou variante `options-voix`).
3. Rouvrez **Webhook** et **ElevenLabs voix**, puis resélectionnez vos credentials dans la liste.
4. Dans **Préparer**, remettez votre `elevenVoiceId` si vous l'aviez changé.
5. **Save**, puis **Publish / Active**.

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

`gen_workflow.py` régénère uniquement la variante `traducteur-audio.workflow.options-voix.json`
(`python3 gen_workflow.py`). Il ne touche jamais au workflow de référence. Le plus simple reste de
modifier le workflow directement dans n8n.
