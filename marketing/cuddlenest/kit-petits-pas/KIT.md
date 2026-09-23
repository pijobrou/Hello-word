# Kit Petits Pas / Small Steps Kit — CuddleNest

Préparé le 2026-09-23 après « go kit ». **Rien n'est publié ni envoyé** : c'est toi qui mets
en ligne (Shopify, Meta, Google). Chaque texte ci-dessous est prêt à copier-coller.

## Contenu du kit (inclus avec toute commande de culottes)

| Élément | Fichier | Coût pour toi |
|---|---|---|
| Guide des 7 premiers jours (5 pages) | `guide-7-jours-FR.pdf` · `guide-7-days-EN.pdf` | 0 $ |
| Tableau de récompenses à imprimer | `tableau-recompenses-FR.pdf` · `reward-chart-EN.pdf` | 0 $ |
| 1 courriel de conseils par jour pendant 7 jours | Section 3 ci-dessous | 0 $ (Shopify Email) |
| Garantie 30 jours, service en français | Déjà en place | — |

⚠️ **Avant de publier :** remplace `[votre courriel]` / `[your email]` à la dernière page
du guide (ou envoie-moi ton courriel et je régénère les PDF avec `build_kit.py`).

**Règles de contenu respectées :** aucune promesse de résultat (« propre en 7 jours » n'est
écrit nulle part), conseils généraux avec renvoi vers un professionnel de la santé, « pour le
jour seulement », pas de faux témoignages.

---

## 1. Mise en place dans Shopify (≈ 30 min)

1. **Téléverser les 4 PDF** : Shopify → **Contenu → Fichiers → Téléverser des fichiers**.
   Copie le lien de chaque fichier (bouton « Copier le lien »).
2. **Lien dans la confirmation de commande** : Shopify → **Paramètres → Notifications →
   Confirmation de commande → Modifier le code**. Juste avant la ligne du récapitulatif,
   ajoute :
   ```html
   <p style="font-size:16px"><strong>Votre Kit Petits Pas est prêt 🎁</strong><br>
   <a href="[LIEN GUIDE FR]">Guide des 7 premiers jours</a> ·
   <a href="[LIEN TABLEAU FR]">Tableau de récompenses</a><br>
   <em>Your Small Steps Kit:</em> <a href="[LIEN GUIDE EN]">7-day guide</a> ·
   <a href="[LIEN TABLEAU EN]">Reward chart</a></p>
   ```
   Clique **Enregistrer**, puis **Envoyer un courriel test** pour vérifier les liens.
3. **Série de 7 courriels** : Shopify → **Marketing → Automatisations → Créer une
   automatisation** → modèle « Remercier les clients après un achat » (ou « Premier
   achat »). Ajoute une **attente de 9 jours** (délai de livraison estimé), puis les
   courriels Jour 1 à Jour 7 séparés par **une attente de 1 jour**. Textes : section 3.
4. **Guide gratuit pour les visiteurs (aimant à courriels)** : installe l'application
   gratuite **Shopify Forms**, crée un formulaire « Recevez le guide des 7 premiers jours »
   avec la case **non cochée** « J'accepte de recevoir les conseils et offres CuddleNest »
   (LCAP). Puis **Marketing → Automatisations → « Accueillir les nouveaux abonnés »** : le
   premier courriel contient le lien du guide (texte section 3, courriel « Bienvenue »).

---

## 2. Texte à ajouter sur la fiche produit

**FR**
> **🎁 Inclus avec votre commande : le Kit Petits Pas**
> - Le **guide des 7 premiers jours** (PDF, en français) : une routine simple, jour par jour.
> - Un **tableau de récompenses** à imprimer, pour célébrer chaque essai.
> - **Un courriel de conseils par jour** pendant la première semaine.
> - **Garantie 30 jours**, satisfait ou remboursé.
>
> *Des culottes d'apprentissage, on en trouve partout. Un plan pour les 7 premiers jours,
> beaucoup moins.*

**EN**
> **🎁 Included with your order: the Small Steps Kit**
> - The **first 7 days guide** (PDF): a simple, day-by-day routine.
> - A printable **reward chart** to celebrate every try.
> - **A daily tips email** during your first week.
> - **30-day money-back guarantee.**
>
> *Training pants are everywhere. A plan for the first 7 days isn't.*

Je peux l'ajouter moi-même à la description Shopify (FR + EN) sur ton « go fiche kit ».

---

## 3. Les courriels (FR puis EN)

Pied de page obligatoire (LCAP/CASL) sur chaque courriel : `CuddleNest · [adresse postale] ·
Se désabonner`. Les clients qui ont acheté peuvent recevoir ces conseils (relation d'affaires
existante) ; le lien de désabonnement doit fonctionner.

### Bienvenue (abonnés au guide gratuit, immédiat)
- **Objet :** Votre guide des 7 premiers jours est arrivé 🎁
- **Corps :** Bonjour ! Voici votre **guide des 7 premiers jours** et votre **tableau de
  récompenses** à imprimer. Commencez quand votre enfant montre qu'il est prêt (la liste est
  à la page 2) : il n'y a pas de course. Si vous voulez des culottes d'apprentissage pour vous
  accompagner, votre code **GRANDSPAS10** vous donne 10 % sur votre première commande.
  [Télécharger le guide] [Voir les culottes]

### Jour 0 (après l'achat, immédiat : déjà couvert par la confirmation de commande)

### Jour 1 — On se lance
- **Objet :** Jour 1 : on se lance, en douceur
- **Corps :** Aujourd'hui, on propose sans forcer. Laissez votre enfant choisir sa culotte,
  puis proposez le pot au réveil, après les repas, avant de sortir et avant la sieste. Chaque
  essai mérite un autocollant, même sans pipi. Astuce : imprimez le tableau et affichez-le à sa
  hauteur. [Revoir le guide]

### Jour 2 — La routine
- **Objet :** Jour 2 : la routine fait le travail
- **Corps :** Gardez les mêmes moments qu'hier. Un livre ou une chanson rendent le pot
  agréable, deux ou trois minutes suffisent. Montrez les étapes : baisser, s'asseoir,
  s'essuyer, tirer la chasse, se laver les mains.

### Jour 3 — Les accidents
- **Objet :** Jour 3 : l'accident, c'est de l'apprentissage
- **Corps :** Le 3e jour est souvent le plus difficile, et c'est normal. Restez calme : « Oups,
  c'est mouillé. Le pipi va dans le pot. On se change ensemble. » Faites-le participer au
  changement. La culotte d'apprentissage lui fait sentir qu'il est mouillé : c'est comme ça
  qu'il fait le lien.

### Jour 4 — Les signaux
- **Objet :** Jour 4 : son corps vous parle
- **Corps :** Il danse, se cache, devient soudain très calme ? Nommez-le : « Je crois que ton
  corps dit pipi. » Félicitez-le chaque fois qu'il vous le dit, même trop tard.

### Jour 5 — Sortir
- **Objet :** Jour 5 : on sort de la maison
- **Corps :** Une petite sortie aujourd'hui : pot juste avant de partir, sac de rechange
  (2 à 3 culottes, un pantalon, un sac pour le linge mouillé). En arrivant, montrez-lui où sont
  les toilettes.

### Jour 6 — Autonomie
- **Objet :** Jour 6 : « tout seul ! »
- **Corps :** Laissez-le baisser et remonter sa culotte lui-même. Proposez un peu moins
  souvent et laissez-le vous dire quand il a envie. Félicitez l'effort plus que le résultat.

### Jour 7 — Bilan
- **Objet :** Jour 7 : regardez tout ce chemin 🎉
- **Corps :** Regardez le tableau ensemble et célébrez chaque autocollant. Ça avance ?
  Continuez la routine. Il résiste beaucoup ? Une pause de quelques semaines, c'est correct.
  Votre avis honnête, même critique, aide d'autres parents : [Laisser un avis]. Et si vous
  avez une question, répondez simplement à ce courriel.

**EN (same timing)**
- **Welcome — Subject:** Your first 7 days guide is here 🎁 — Hi! Here's your **first 7 days
  guide** and a printable **reward chart**. Start when your child shows they're ready (the list
  is on page 2): there's no race. If you'd like training pants to go with it, code
  **GRANDSPAS10** gives you 10% off your first order. [Download the guide] [Shop the pants]
- **Day 1 — Gently getting started:** Today, offer without forcing. Let your child pick their
  pants, then offer the potty on waking, after meals, before going out and before nap. Every
  try earns a sticker, even with no pee. Tip: print the chart and put it at their eye level.
- **Day 2 — Routine does the work:** Keep the same times as yesterday. A book or a song makes
  potty time pleasant; two or three minutes is enough. Show the steps: down, sit, wipe, flush,
  wash hands.
- **Day 3 — Accidents are learning:** Day 3 is often the hardest, and that's normal. Stay calm:
  "Oops, it's wet. Pee goes in the potty. Let's change together." Training pants let them feel
  wet: that's how they make the connection.
- **Day 4 — Their body is talking:** Dancing, hiding, suddenly quiet? Name it: "I think your
  body is saying pee." Praise them every time they tell you, even if it's too late.
- **Day 5 — Leaving the house:** A short outing today: potty right before you leave, a change
  bag (2 to 3 pants, trousers, a wet bag). When you arrive, show them where the toilets are.
- **Day 6 — "All by myself!":** Let them pull their pants down and up. Offer a little less
  often and let them tell you. Praise effort more than results.
- **Day 7 — Look how far you've come 🎉:** Look at the chart together and celebrate every
  sticker. Going well? Keep the routine. Strong resistance? A few weeks' break is fine. Your
  honest review, even critical, helps other parents: [Leave a review].

---

## 4. Nouvelles pubs Meta (à ajouter vers le 27 septembre)

Ajoute ces annonces **dans l'ensemble existant** `CN | Canada` (texte FR par défaut +
**Langues → Ajouter des langues → Anglais**). Garde **une** ancienne annonce (la meilleure au
27 septembre) pour comparer, mets les autres en pause. Même paramètres d'URL qu'avant.

### K1 — Le déballage du kit (photo/vidéo : culottes + guide imprimé + tableau sur une table)
- **FR :** Des culottes d'apprentissage, on en trouve partout. Un plan pour les 7 premiers
  jours, beaucoup moins. 🎁 Avec CuddleNest, vous recevez les culottes **et** le Kit Petits
  Pas : le guide jour par jour, le tableau de récompenses à imprimer et un conseil par courriel
  chaque jour de la première semaine. Garantie 30 jours.
  10 paires pour le prix de 8* · livraison gratuite
  *Motifs sélectionnés, tailles 90 et 100 cm, détails sur la fiche.
  — **Titre :** Un plan, pas que des culottes · **Bouton :** Acheter
- **EN:** Training pants are everywhere. A plan for the first 7 days isn't. 🎁 With
  CuddleNest you get the pants **and** the Small Steps Kit: a day-by-day guide, a printable
  reward chart and a daily tips email during your first week. 30-day guarantee.
  10 pairs for the price of 8* · free shipping
  *Selected prints, sizes 90 and 100 cm, details on the product page.
  — **Headline:** A plan, not just pants · **CTA:** Shop now

### K2 — Le guide gratuit (image : la couverture du guide + le tableau)
Objectif : récolter des courriels à bas coût. Lien vers la page du formulaire Shopify Forms.
- **FR :** L'apprentissage de la propreté commence bientôt ? Téléchargez gratuitement notre
  **guide des 7 premiers jours** : les signes qu'il est prêt, une routine jour par jour, quoi
  dire quand il y a un accident, et un tableau de récompenses à imprimer. En français, sans
  promesse miracle. 💛
  — **Titre :** Guide gratuit : les 7 premiers jours · **Bouton :** Télécharger
- **EN:** Potty training coming up? Download our free **first 7 days guide**: signs they're
  ready, a day-by-day routine, what to say after an accident, and a printable reward chart.
  No miracle promises. 💛
  — **Headline:** Free guide: the first 7 days · **CTA:** Download

### K3 — Le vécu (texte sur fond coloré, ou vidéo « face caméra » du parent)
- **FR :** Jour 1 : 4 essais, 0 pipi, 4 autocollants. 🌟
  Jour 3 : deux accidents, un pipi dans le pot. On a dansé dans la salle de bain. 🎉
  Jour 6 : « Tout seul ! » 🙌
  L'apprentissage de la propreté, c'est rarement une ligne droite. Le Kit Petits Pas vous
  accompagne chaque jour : culottes lavables, guide, tableau de récompenses.
  *Exemple de parcours, chaque enfant avance à son rythme.*
  — **Titre :** Un petit pas à la fois · **Bouton :** En savoir plus
- **EN:** Day 1: 4 tries, 0 pee, 4 stickers. 🌟 / Day 3: two accidents, one pee in the potty.
  We danced in the bathroom. 🎉 / Day 6: "All by myself!" 🙌
  Potty training is rarely a straight line. The Small Steps Kit is with you every day:
  washable pants, a guide, a reward chart.
  *Example journey; every child learns at their own pace.*
  — **Headline:** One small step at a time · **CTA:** Learn more

### K4 — Le choix des motifs
Garde le carrousel FR-3 / EN-3 existant ; ajoute seulement à la fin du texte :
« + le Kit Petits Pas offert avec chaque commande. » / "+ the Small Steps Kit with every order."

---

## 5. Google — titres et description à ajouter aux annonces existantes

Titres FR (≤ 30) : `Kit Petits Pas inclus` · `Guide 7 jours en français` ·
`Tableau de récompenses offert` · `Un plan, pas que des culottes`
Titres EN : `Small Steps Kit Included` · `Free 7-Day Potty Guide` ·
`Free Reward Chart Included` · `A Plan, Not Just Pants`
Description FR (≤ 90) : `Culottes + guide des 7 jours + tableau de récompenses. Livraison gratuite dès 39 $.`
Description EN : `Training pants + a 7-day guide + a printable reward chart. Free shipping over $39.`

Remplace les titres les moins performants (Google Ads → Annonce → Composants → « Faible »)
pour rester à 15 titres et 4 descriptions.

---

## 6. Calendrier
| Date | Action |
|---|---|
| 23–26 sept. | Toi : téléverser les PDF, lien dans la confirmation de commande, série de courriels, Shopify Forms. Moi (sur « go fiche kit ») : texte du kit sur la fiche. |
| ≈ 27 sept. | Ajouter K1, K2, K3 dans Meta ; mettre en pause les anciennes annonces sauf la meilleure ; ajouter les titres Google. |
| ≈ 3 oct. | Premier bilan : comparer K1/K2/K3 à l'ancienne annonce (coût par achat, coût par inscription pour K2). |
