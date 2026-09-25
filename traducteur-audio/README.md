# 🎧 Traducteur Audio — doublage multilingue (extension Chrome / Edge)

Écoute une langue et la **prononce dans une autre** (53 langues et variantes, comme la liste d'un téléphone : anglais, français, espagnol, portugais, arabe, chinois, japonais, hindi, swahili…), avec trois modes :

| Mode | Source anglaise | Idéal pour |
|---|---|---|
| **🔊 Traduire le son de cet onglet** (recommandé) | l'audio de l'onglet lui-même, capté directement (Chrome/Edge 135+) | toute vidéo, live ou appel, **même sans sous-titres** |
| **Vidéos : doublage FR** | les sous-titres anglais de la vidéo (YouTube, vidéos HTML5 avec piste `<track>`) | YouTube, cours en ligne, séries avec sous-titres |
| **Mode micro** | ce que le micro entend (reconnaissance vocale de Chrome) | une personne qui parle, un podcast sur haut-parleur, une réunion |

Pendant que la voix française parle, le son de la vidéo est baissé (réglable), et le texte
français s'affiche en bas de l'écran.

## Installation (2 minutes)

1. Téléchargez **`dist/traducteur-audio-v1.6.1.zip`** (sur GitHub : ouvrez le fichier, puis le
   bouton de téléchargement ↓) et **décompressez-le** dans un dossier que vous garderez
   (par ex. `Documents/traducteur-audio`). Chrome n'installe pas un ZIP directement.
2. Ouvrez `chrome://extensions` (ou `edge://extensions`).
3. Activez le **Mode développeur** (en haut à droite).
4. Cliquez **Charger l'extension non empaquetée** et choisissez le dossier décompressé (celui qui contient `manifest.json`).
5. Épinglez l'icône 🔊 dans la barre d'outils.

### ⚠️ Mettre à jour sans créer de doublon

Décompressez toujours la nouvelle version **dans le même dossier**, par-dessus l'ancienne, puis cliquez
**↻ Recharger** dans `chrome://extensions`. Un nouveau dossier crée **une deuxième extension** : ses
réglages sont vides (plus de n8n) et les deux copies parlent en même temps, ce qui donne des voix qui
changent. La fenêtre d'écoute le détecte et l'affiche en rouge. Il faut alors garder une seule copie.

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

## 🎙️ Moteur de la voix

Réglages → **🎙️ Moteur de la voix** :

| Moteur | Voix | Ce qu'il faut |
|---|---|---|
| Voix du navigateur | voix du système, gratuite | rien |
| 💎 Premium | voix IA fournie par le serveur du vendeur, 5 h par mois | abonnement 4,99 €/mois + clé de licence |
| 🔑 Ma propre clé OpenAI | voix IA OpenAI payée par l'utilisateur | licence à vie 14,99 € + clé OpenAI |
| n8n | votre workflow n8n (usage personnel) | n8n + webhook |

Après le paiement, la page de remerciement donne une clé `TA-XXXX-XXXX-XXXX-XXXX`, à coller dans
Réglages → **Activer**. **La licence est liée à vie au premier appareil et à cette installation de
l'extension.** Un autre navigateur, un autre ordinateur ou une réinstallation sont refusés. Pour
changer d'ordinateur, il faut contacter le vendeur, qui peut libérer la licence
(voir [`serveur/`](serveur/README.md)). La popup affiche le moteur actif et les minutes Premium
utilisées. Si la voix IA ne répond pas, l'extension continue avec la voix du navigateur (ou se tait,
selon le réglage « Si la voix IA ne répond pas »).

### Voix humaine IA via n8n

Par défaut, l'extension utilise la voix du navigateur et choisit automatiquement la meilleure voix
française installée (« Natural », puis « Google »). Pour une voix vraiment humaine (ElevenLabs ou
OpenAI) et une traduction DeepL, branchez le workflow n8n fourni dans [`n8n/`](n8n/README.md) :
popup → **⚙️ Configurer la voix IA** → URL du webhook + clé secrète → **Enregistrer et tester**.
Les clés API restent dans n8n. Si n8n ne répond pas, l'extension revient à la voix locale.

## ⚡ Priorité au direct (activée par défaut)

En direct, un silence fait perdre des phrases. Avec ce mode :
- si la voix IA n'est pas prête **2 s** après son tour, ou si elle échoue, la phrase est lue tout de suite
  par la voix du navigateur (la voix verrouillée) ;
- après **2 ratés**, la voix IA est **suspendue pour la session** et la voix du navigateur prend le relais
  jusqu'au bout. Il y a donc au plus un changement de voix, annoncé, avec un bouton « Réessayer la voix IA » ;
- la voix **accélère avec le retard réel** (jusqu'à 1,5×), en plus de la file d'attente ;
- le **retard** (du moment où la phrase est reconnue au début de sa lecture) s'affiche en haut de la
  fenêtre et sous chaque phrase ;
- si la voix verrouillée échoue, la voix la plus proche (même langue, même éditeur, même genre supposé)
  lit la phrase au lieu de laisser un silence.

Désactivez-le pour le verrouillage strict : une seule voix, quitte à avoir des silences.

## 🔒 Voix verrouillée (activée par défaut)

- **Voix du navigateur** : la voix est choisie une fois par langue (celle des Réglages, sinon la plus
  naturelle), puis **mémorisée**. Toutes les pages et toutes les sessions utilisent exactement la même. Si
  elle devient indisponible, elle n'est **jamais remplacée** : la phrase est affichée sans être lue et un
  avertissement s'affiche.
- **Voix IA** : en cas d'échec, jamais de voix de secours, seulement le texte.
- **Un seul lecteur à la fois** : ouvrir une nouvelle fenêtre d'écoute arrête l'ancienne, et le mode
  « Doublage par les sous-titres » se tait dans tous les onglets tant qu'une fenêtre d'écoute tourne.
- La case **🔒 Voix verrouillée** (réglages rapides et page Réglages) permet de désactiver ce mode.

## 🎙️ Une seule voix, du début à la fin

Avec la voix IA, jamais plus de 2 phrases sont demandées en même temps (au-delà, OpenAI et ElevenLabs
refusent souvent). Un refus passager (« trop de requêtes », réseau, 5xx) est réessayé deux fois. n8n
n'est mis en pause qu'après 3 échecs d'affilée. Si une phrase échoue quand même, le réglage **Si la voix
IA échoue** décide : **Texte seulement** (par défaut : la phrase s'affiche sans être lue, pour ne jamais
entendre deux voix) ou **Voix du navigateur**. La voix du navigateur, elle, reste la même pour toute la
session. Dans le journal de la fenêtre d'écoute : 🎙️ = voix IA, 🔇 = texte seul, et sous chaque phrase
le nom exact de la voix qui l'a lue. En haut de la fenêtre, le moteur actif s'affiche (voix IA n8n ou
voix du navigateur). Pendant que la fenêtre d'écoute traite un onglet, le mode « Doublage par les
sous-titres » se tait sur cet onglet, pour éviter deux lecteurs en même temps.

## 🌍 Langues

Dans la popup, la fenêtre d'écoute ou les Réglages : **Langue parlée** → **Traduire en**, avec un
bouton **⇄** pour inverser. Changer la langue parlée pendant l'écoute relance la reconnaissance tout
de suite. La voix du navigateur dépend des voix installées sur l'ordinateur pour la langue cible
(Windows : Paramètres → Heure et langue → Voix). Les voix IA (OpenAI, ElevenLabs) parlent presque
toutes les langues. Le filtre de tics (« um », « okay so »…) ne s'applique qu'à l'anglais. Avec n8n,
l'extension envoie `source` / `target` (ex. `en` → `fr`, `en-us`, `pt-br`) et `targetLang` (ex. `ja-JP`).
Si la consigne de votre nœud OpenAI précise une langue (« français de France »), adaptez-la ou
utilisez `targetLang`.

## ⚙️ Réglages (adapter la voix à la personne qui écoute)

Popup → **⚙️ Réglages de la voix**. Tout est enregistré immédiatement, même pendant une traduction.

- **Profils en un clic** : Standard, Apprentissage (lent et clair, avec l'anglais affiché), Rapide,
  Confort d'écoute (gros texte, vidéo presque muette), Enfant.
- **Voix** : vitesse (0,5 à 2×), hauteur (grave ↔ aiguë, aussi pour la voix IA), timbre aigu ↔ doux (voix IA),
  style posé ↔ expressif et qualité Rapide/Fluide (voix IA, variante « options-voix » du workflow), volume, pause entre
  les phrases, choix de la voix, avec un bouton pour écouter le résultat.
- **Vidéo** : volume de la vidéo pendant la voix, découpage des phrases.
- **Affichage** : texte français sur la vidéo, anglais en plus, taille du texte (avec aperçu).
- **Voix IA (n8n)** : adresse, clé, test. La vitesse et le volume s'appliquent aussi à la voix IA.
- **Pendant l'écoute** : la fenêtre de traduction a ses **🎚️ Réglages rapides** (profil, vitesse,
  volume de la voix et de la vidéo, pause, découpage), appliqués dès la phrase suivante.

## Clarté de la traduction

- Les tics et hésitations (« um », « uh »), les exclamations seules (« wow », « oh my god »,
  « yeah »), les mots répétés et les étiquettes de sous-titres (`[Music]`, `[Applause]`) ne sont
  ni traduits ni lus.
- **Découpage des phrases** (popup) : *Rapide* démarre vite, avec des phrases parfois coupées.
  *Équilibré* est le réglage par défaut. *Phrases complètes* est plus clair, mais ajoute environ
  2 s de délai. Les coupes se font de préférence avant « and / but / because / what… », pour ne
  pas casser une idée.

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
options.html / options.js  moteur de la voix, licence, clé OpenAI, n8n (dans un onglet)
listen.html / listen.js  fenêtre d'écoute (son de l'onglet ou micro)
diagnostics/             page de diagnostics
common.js, style.css     code et style partagés (voix locale ou n8n, préchargement des phrases)
n8n/                     workflow n8n « voix humaine » + guide
serveur/                 serveur Premium (Cloudflare Workers) : licences, quota, voix IA
build.sh                 reconstruit le ZIP dans ../dist/
```
