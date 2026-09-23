# Campagnes Meta + Google : pas à pas, prêtes à copier-coller

Préparé le 2026-09-23 après « go campagnes ». **C'est toi qui crées et actives les campagnes** :
je n'ai pas d'accès direct à Meta Ads ni à Google Ads. Budget de la phase test : **420 $**
(Meta 280 $ + Google 140 $), du **1er au 14 octobre 2026**.

Lien produit (EN) :
`https://www.cuddlenest.ca/products/baby-training-learning-pants-baby-gauze-diaper-pants`
Pour les annonces FR : ouvre la fiche, passe le site en français, et copie l'adresse affichée
(souvent avec `/fr/`). Si l'adresse ne change pas, garde le lien EN.

---

## 0. Vérifier avant de créer (5 min)

- [ ] Carte ajoutée sur Meta et sur Google Ads.
- [ ] Un **Purchase** est visible dans le Gestionnaire d'événements Meta, et l'action
      **Achat** existe dans Google Ads → Objectifs → Conversions.
- [ ] Mode test Shopify **désactivé** et commande test **annulée** (et pas envoyée chez CJ).
- [ ] La page Facebook qui diffuse s'appelle **CuddleNest**, pas Yapson Beauty. Sinon,
      renomme-la ou crée une page CuddleNest avant (sinon incohérence avec le site = moins de
      confiance, plus de refus).
- [ ] Tu as 6 à 10 **vraies photos du produit** (téléchargées depuis Shopify → Produits →
      la fiche → Médias). Pas d'images générées par IA qui montrent le produit ou de faux
      « clients ».

---

## 1. META (Facebook + Instagram) — 280 $

### Structure

```
Campagne  CN | Ventes | Oct26                      (objectif : Ventes)
├── Ensemble  CN | FR | Canada     10 $/jour
│   ├── Annonce  FR-1 Autonomie
│   ├── Annonce  FR-2 Probleme-solution
│   └── Annonce  FR-3 Motifs (carrousel)
└── Ensemble  CN | EN | Canada     10 $/jour
    ├── Annonce  EN-1 Autonomy
    ├── Annonce  EN-2 Problem-solution
    └── Annonce  EN-3 Prints (carousel)
```

### Étape 1 — Campagne
**adsmanager.facebook.com → + Créer**

| Champ | Valeur |
|---|---|
| Objectif | **Ventes** |
| Type de configuration | **Campagne de ventes manuelle** (pas « Advantage+ ») |
| Nom | `CN | Ventes | Oct26` |
| Catégorie de publicité spéciale | **Aucune** |
| Budget Advantage de la campagne | **Désactivé** (le budget est fixé par ensemble pour que FR et EN dépensent chacun 10 $) |
| Test A/B | Désactivé |

### Étape 2 — Ensemble de publicités FR
| Champ | Valeur |
|---|---|
| Nom | `CN | FR | Canada` |
| Emplacement de conversion | **Site web** |
| Pixel / jeu de données | Celui de Shopify (CuddleNest) |
| Événement de conversion | **Achat** (*Purchase*) |
| Budget | **Budget quotidien : 10 $** |
| Calendrier | Début **1er oct. 2026, 00 h 00** · Fin **14 oct. 2026, 23 h 59** |
| Audience | **Audience Advantage+** activée |
| Suggestions d'audience | Âge **22–45** |
| Contrôles d'audience : lieux | **Canada** |
| Langues | **Français (tous)** |
| Emplacements | **Emplacements Advantage+** |

### Étape 3 — Ensemble EN
Duplique l'ensemble FR, puis change : Nom `CN | EN | Canada` · Langues **Anglais (tous)**.
Tout le reste identique (10 $/jour, mêmes dates).

### Étape 4 — Annonces (réglages communs)
| Champ | Valeur |
|---|---|
| Identité | Page Facebook **CuddleNest** + compte Instagram (s'il est encore @yapson150 « beauté », choisis « Utiliser la Page Facebook ») |
| Format | Image ou vidéo unique (annonces 1 et 2) · **Carrousel** (annonce 3) |
| URL du site | le lien produit (FR ou EN, voir en haut) |
| Paramètres d'URL | `utm_source=meta&utm_medium=paid&utm_campaign=petits-pas-oct26&utm_content={{ad.name}}` |
| Améliorations Advantage+ | Laisse « Retouches visuelles » ; **désactive** « Musique » et « Génération de texte » (les textes sont validés, on ne veut pas que Meta les réécrive) |

### Annonce FR-1 Autonomie (photo : enfant qui porte la culotte, ou culotte portée)
- **Texte principal :**
  > Il veut remonter sa culotte tout seul. Les petits accidents font encore partie du chemin. Les culottes d'apprentissage CuddleNest sont entre les deux : douces comme une vraie culotte, avec une protection légère pour les petites fuites de jour. Lavables, réutilisables, 17 motifs. Garantie 30 jours, remboursé.
  >
  > 8 paires pour le prix de 6* · livraison gratuite
  > *Motifs sélectionnés, détails sur la fiche.
- **Titre :** Petits pas, grandes étapes
- **Description :** 8 paires pour le prix de 6* · livraison gratuite
- **Bouton :** Acheter

### Annonce FR-2 Problème / solution (photo : gros plan des couches de gaze / doublure)
- **Texte principal :**
  > Trois pantalons au lavage avant midi ? 🙃 Pendant l'apprentissage de la propreté, les petites fuites restent dans la culotte CuddleNest : couches de gaze absorbante et doublure anti-humidité. Votre enfant sent qu'il est mouillé et apprend, vous changez moins de linge. Pour le jour (pas pour la nuit).
- **Titre :** L'accident, c'est de l'apprentissage
- **Description :** Garantie 30 jours
- **Bouton :** En savoir plus

### Annonce FR-3 Motifs (carrousel, 5 à 10 cartes, 1 motif par carte)
- **Texte principal :**
  > Baleine, licorne, espace ou petit renard ? Laissez votre enfant choisir sa culotte d'apprentissage. Quand c'est « la sienne », il a envie de la porter. 17 motifs, tailles 90 à 110 cm selon le motif.
- **Titre de chaque carte :** le nom du motif (Baleine, Licorne, Espace, Renard, Panda…)
- **Lien de chaque carte :** le même lien produit
- **Bouton :** Acheter

### Annonce EN-1 Autonomy
- **Primary text:**
  > They want to pull up their own underwear. Little accidents are still part of the journey. CuddleNest training pants sit right in between: soft like real underwear, with light protection for small daytime leaks. Washable, reusable, 17 fun prints. 30-day money-back guarantee.
  >
  > 8 pairs for the price of 6* · free shipping
  > *Selected prints, details on the product page.
- **Headline:** Small steps. Big milestones.
- **Description:** 8 pairs for the price of 6* · free shipping
- **CTA:** Shop now

### Annonce EN-2 Problem / solution
- **Primary text:**
  > Three pairs of pants in the wash before noon? 🙃 During potty training, small leaks stay in the CuddleNest pants: absorbent gauze layers and a moisture-resistant lining. Your toddler feels the wetness and learns, and you do less laundry. Designed for daytime (not overnight).
- **Headline:** Accidents are learning, not failure
- **Description:** 30-day guarantee
- **CTA:** Learn more

### Annonce EN-3 Prints (carousel)
- **Primary text:**
  > Whale, unicorn, outer space or little fox? Let your toddler pick their own training pants. When it's theirs, they want to wear it. 17 prints, sizes 90–110 cm depending on the print.
- **Card headlines:** print name (Whale, Unicorn, Space, Fox, Panda…)
- **CTA:** Shop now

### Étape 5 — Publier
Clique **Publier**. Meta examine les annonces (quelques minutes à 24 h). Elles démarrent
seules le 1er octobre. Si une annonce est refusée, envoie-moi le motif exact.

### Plus tard (le 8 octobre) — reciblage
Quand l'audience « Visiteurs du site, 30 jours » dépasse ~1 000 personnes : nouvel ensemble
`CN | Reciblage` à 4 $/jour (pris sur l'ensemble le moins bon), textes « Reciblage » de
`01-creatives.md`. Je te le prépare à ce moment-là.

---

## 2. GOOGLE ADS — 140 $ (Réseau de Recherche)

Pendant les 14 jours de test, **tout le budget va au Réseau de Recherche** : 10 $/jour
partagés en deux ne suffiraient à rien. Google Shopping (via l'application Google & YouTube)
vient à partir du 10 octobre si le test marche (PLAN § 8).

### Étape 1 — Campagne
**ads.google.com → + → Nouvelle campagne**

| Champ | Valeur |
|---|---|
| Objectif | **Ventes** |
| Objectif de conversion | **Achats** (garde seulement celui-là) |
| Type | **Réseau de Recherche** |
| Moyens d'atteindre l'objectif | Visites du site : `https://www.cuddlenest.ca` |
| Nom | `CN | Search | Oct26` |
| Enchères | **Clics** → **Maximiser les clics** · coche **Définir une limite d'enchère au CPC maximale : 0,80 $** |
| Réseaux | **Décoche** « Réseau de Recherche partenaires » et **décoche** « Réseau Display » |
| Zones | **Canada** · Options : **Présence : personnes se trouvant dans vos zones ciblées** |
| Langues | **Français** et **Anglais** |
| Segments d'audience | Rien |
| Dates | Début **1er oct. 2026** · Fin **14 oct. 2026** |
| Suffixe de l'URL finale (Paramètres supplémentaires → Options d'URL de la campagne) | `utm_source=google&utm_medium=paid&utm_campaign=petits-pas-oct26&utm_content={adgroupid}` |
| Composants Advantage / IA (si proposé) | **Refuse** la génération automatique de textes et « correspondance large partout » |
| Budget | **10 $ par jour** |

Le plafond de 0,80 $ est un **repère de départ**, pas une donnée mesurée pour ta catégorie.
Si après 3 jours tu as très peu d'impressions, monte-le à 1,20 $. Quand tu auras 15 achats
en 30 jours, on passera à « Maximiser les conversions ».

### Étape 2 — Groupe d'annonces FR : `FR | Culottes apprentissage`
Mots-clés (colle-les tels quels, les guillemets et crochets comptent) :
```
[culotte d'apprentissage]
"culotte d'apprentissage lavable"
"culotte apprentissage propreté"
"culotte d'apprentissage enfant"
"culotte d'entraînement"
"culotte apprentissage réutilisable"
"culotte de propreté lavable"
```

**Annonce responsive FR** — URL finale : lien produit FR · Chemin affiché : `culottes` / `apprentissage`

Titres (15) :
```
Culottes d'apprentissage
Lavables et réutilisables
Livraison gratuite dès 39 $
Garantie 30 jours
17 motifs pour tout-petits
Petits pas, grandes étapes
Pour l'apprentissage de jour
Tailles de 90 à 110 cm
8 paires au prix de 6
10 paires au prix de 8
7 paires au prix de 6
CuddleNest Canada
Coton doux, gaze absorbante
Moins de linge à laver
Il choisit son motif
```
Descriptions (4) :
```
Coton doux, gaze absorbante et doublure anti-humidité pour les petites fuites de jour.
8 paires au prix de 6 ou 10 au prix de 8 (motifs sélectionnés). Livraison gratuite.
Garantie 30 jours : si ça ne convient pas, vous êtes remboursé. Lavable en machine.
17 motifs, tailles 90 à 110 cm selon le motif. Laissez votre enfant choisir le sien.
```

### Étape 3 — Groupe d'annonces EN : `EN | Training pants`
Keywords:
```
[potty training pants]
"reusable training pants"
"washable training pants"
"toddler training underwear"
"cloth training pants"
"potty training underwear"
"training pants canada"
```

**Responsive ad EN** — Final URL: product link (EN) · Display path: `training` / `pants`

Headlines (15):
```
Potty Training Pants
Washable & Reusable
Free Shipping Over $39
30-Day Money-Back Guarantee
17 Fun Toddler Prints
Small Steps, Big Milestones
For Daytime Potty Training
Sizes 90 to 110 cm
8 Pairs for the Price of 6
10 Pairs for the Price of 8
7 Pairs for the Price of 6
CuddleNest Canada
Soft Cotton, Absorbent Gauze
Less Laundry During Training
Let Them Pick Their Print
```
Descriptions (4):
```
Soft cotton, absorbent gauze and a moisture-resistant lining for small daytime leaks.
8 pairs for the price of 6 or 10 for the price of 8 (selected prints). Free shipping.
30-day money-back guarantee if it's not right for your family. Machine washable.
17 prints, sizes 90 to 110 cm depending on the print. Let your toddler pick theirs.
```
Toutes les longueurs sont vérifiées (titres ≤ 30, descriptions ≤ 90 caractères).

### Étape 4 — Mots-clés négatifs (niveau campagne)
**Campagne → Mots-clés → Mots-clés à exclure → +**
```
adulte
adult
incontinence
nuit
overnight
gratuit
free sample
jetable
disposable
patron
pattern
diy
```

### Étape 5 — Composants (niveau campagne)
Accroches :
```
Garantie 30 jours
Lavable en machine
17 motifs
Livraison gratuite 39 $+
30-Day Guarantee
Machine Washable
17 Prints
Free Shipping Over $39
```
Pas de liens annexes pour l'instant (ils demandent des pages différentes).

### Étape 6 — Publier
Clique **Publier la campagne**. L'examen prend en général moins d'un jour. La campagne
démarre seule le 1er octobre.

---

## 3. Pendant les 14 jours

**Chaque jour (5 min) :** dépense · achats · coût par achat (CPA), sur Meta et Google.
**Ne touche à rien du 1er au 3 octobre** : les plateformes apprennent.

| Quand | Règle |
|---|---|
| Après 3 jours et ~15 $ par annonce | Coupe toute annonce Meta **sans ajout au panier**, ou avec un CTR < 0,8 % |
| Dès qu'une annonce a 2 achats ou 30 $ dépensés | Coupe-la si le coût par achat dépasse **16 $** |
| Chaque lundi (5 et 12 oct.) | Déplace le budget vers ce qui a le meilleur coût par achat |
| Google, chaque lundi | **Mots-clés → Termes de recherche** : exclus toute recherche hors sujet |
| Toujours | Jamais plus de **+20 % de budget par jour** |
| **14 octobre** | CPA moyen **≤ 12 $** → on débloque ≈ 1 080 $ pour la suite d'octobre. Sinon on corrige avant de dépenser plus |

Ces seuils sont des repères de départ, pas des références mesurées : on les ajuste après
7 jours de vraies données. Envoie-moi tes chiffres le 5 octobre (captures d'écran des
tableaux Meta et Google) et je te dis quoi couper ou garder.

---

## 4. Variante « petit budget » (décision client, 2026-09-23)

Client : budget serré, **10 $/jour Meta + 5 $/jour Google** (15 $/jour) ; un crédit Google
Ads serait disponible (à vérifier dans Facturation → Promotions). Recommandation retenue :
passer à ce budget **dès le 1er octobre** plutôt qu'après 2 jours à 30 $/jour (une baisse de
50 % remet Meta en apprentissage, et 2 jours ne donnent aucune donnée fiable).

- **Meta 10 $/jour :** un **seul** ensemble `CN | Canada` (pas de séparation FR/EN), 3 annonces.
  Dans chaque annonce : texte FR par défaut, puis **Langues → Ajouter des langues → Anglais**
  avec le texte EN correspondant. Meta affiche la bonne langue à chaque personne.
- **Google 5 $/jour :** garder seulement les mots-clés exacts et les plus précis :
  `[culotte d'apprentissage]`, `"culotte d'apprentissage lavable"`, `[potty training pants]`,
  `"reusable training pants"`, `"washable training pants"`. Mettre les autres en pause.
- **Durée :** 28 jours, **du 24 sept. au 21 oct. 2026** (client, 2026-09-23 : on démarre dès demain au lieu du 1er oct.), pour dépenser les mêmes ≈ 420 $.
- **Premier bilan :** après ~100 $ dépensés sur Meta (≈ 3 oct.), pas avant.
- Aucun résultat n'est garanti : au CPA cible de 12 $, 15 $/jour correspond à environ
  1 commande par jour **si** la cible est atteinte ; les premiers jours coûtent souvent plus.
