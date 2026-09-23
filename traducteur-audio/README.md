# 🎧 Traducteur Audio EN → FR (extension Chrome / Edge)

Écoute de l'anglais et le **prononce en français**, avec trois modes :

| Mode | Source anglaise | Idéal pour |
|---|---|---|
| **🔊 Traduire le son de cet onglet** (recommandé) | l'audio de l'onglet lui-même, capté directement (Chrome/Edge 135+) | toute vidéo, live ou appel, **même sans sous-titres** |
| **Vidéos : doublage FR** | les sous-titres anglais de la vidéo (YouTube, vidéos HTML5 avec piste `<track>`) | YouTube, cours en ligne, séries avec sous-titres |
| **Mode micro** | ce que le micro entend (reconnaissance vocale de Chrome) | une personne qui parle, un podcast sur haut-parleur, une réunion |

Pendant que la voix française parle, le son de la vidéo est baissé (réglable), et le texte
français s'affiche en bas de l'écran.

## Installation (2 minutes)

1. Téléchargez **`dist/traducteur-audio-v1.3.5.zip`** (sur GitHub : ouvrez le fichier, puis le
   bouton de téléchargement ↓) et **décompressez-le** dans un dossier que vous garderez
   (par ex. `Documents/traducteur-audio`). Chrome n'installe pas un ZIP directement.
2. Ouvrez `chrome://extensions` (ou `edge://extensions`).
3. Activez le **Mode développeur** (en haut à droite).
4. Cliquez **Charger l'extension non empaquetée** et choisissez le dossier décompressé (celui qui contient `manifest.json`).
5. Épinglez l'icône 🔊 dans la barre d'outils.

## Utilisation

**N'importe quelle vidéo :** ouvrez la vidéo, cliquez l'icône de l'extension puis
*🔊 Traduire le son de cet onglet*. Une petite fenêtre s'ouvre : elle affiche l'anglais reconnu
et sa traduction, lit le français et baisse le son de la vidéo pendant ce temps. Gardez-la
ouverte (vous pouvez la réduire). Si vous changez de page dans l'onglet, recliquez l'icône puis
le bouton : Chrome n'autorise la capture qu'après ce clic.

**Via les sous-titres (YouTube) :** activez le bouton *Vidéos : doublage FR* dans la popup, lancez la vidéo et
activez les sous-titres anglais (touche **C**, les sous-titres auto-générés marchent aussi).

**Mode micro :** popup → *🎙️ Mode micro* → *Démarrer l'écoute* → autorisez le micro.
Sans casque, l'écoute se met en pause pendant la voix française pour ne pas se réécouter ;
avec un casque, cochez la case pour écouter en continu.

**Diagnostics :** popup → *🩺 Diagnostics* (ou
`chrome-extension://<ID-de-l-extension>/diagnostics/diagnostics.html`). La page vérifie les voix
françaises, la reconnaissance vocale, le micro et les deux services de traduction, et le bouton
*Copier le rapport* permet de copier le résultat.

## 🎙️ Voix humaine IA (via n8n)

Par défaut, l'extension utilise la voix du navigateur et choisit automatiquement la meilleure voix
française installée (« Natural », puis « Google »). Pour une voix vraiment humaine (ElevenLabs ou
OpenAI) et une traduction DeepL, branchez le workflow n8n fourni dans [`n8n/`](n8n/README.md) :
popup → **⚙️ Configurer la voix IA** → URL du webhook + clé secrète → **Enregistrer et tester**.
Les clés API restent dans n8n. Si n8n ne répond pas, l'extension revient à la voix locale.

## Bon à savoir

- Traduction : Google Translate (gratuit, sans clé), avec MyMemory en secours ; ou celle de votre workflow n8n (Google ou DeepL).
- Voix : celles du système. S'il n'y a aucune voix française, installez-en une (Windows :
  Paramètres → Heure et langue → Voix ; macOS : Accessibilité → Contenu énoncé).
- Le mode vidéo a besoin de sous-titres. Pour une vidéo sans sous-titres, utilisez le mode micro
  avec le son sur les haut-parleurs.
- La reconnaissance vocale du mode micro passe par les serveurs de Google (Chrome/Edge uniquement).

## Fichiers

```
manifest.json            configuration de l'extension (Manifest V3)
background.js            appels de traduction + cache
content.js               mode vidéo : lit les sous-titres, traduit, parle, baisse le volume
popup.html / popup.js    réglages
options.html / options.js  réglages de la voix IA (n8n), dans un onglet
listen.html / listen.js  fenêtre d'écoute (son de l'onglet ou micro)
diagnostics/             page de diagnostics
common.js, style.css     code et style partagés (voix locale ou n8n, préchargement des phrases)
n8n/                     workflow n8n « voix humaine » + guide
build.sh                 reconstruit le ZIP dans ../dist/
```
