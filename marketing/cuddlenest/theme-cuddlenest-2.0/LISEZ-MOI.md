# Thème CuddleNest 2.0

Thème Shopify **« CuddleNest 2.0 »** (ID 158806573169), créé le 2026-09-23 comme copie non publiée
du thème en ligne (Horizon 4.2), avec les fichiers de ce dossier ajoutés par-dessus.

## Ce qui a été ajouté
- **Page d'accueil** (`templates/index.json`) : bannière, barre de confiance, offres groupées,
  composeur de pack, étapes, bénéfices, comparatif, guide des tailles, FAQ, infolettre.
- **Fiche produit** (`templates/product*.json`) : fiche Horizon, dont le bouton ajoute au panier
  sans changer de page, avec sélecteur de variantes en boutons, suivie des mêmes sections.
  Les modèles `product.amose2-ai-…` et `product.baby-training-learning-pa` reçoivent la même mise
  en page, donc la fiche change sans rien modifier sur le produit.
- **Composeur de pack** (`sections/cn-pack-builder.liquid`) : le client choisit une taille, ajoute
  plusieurs motifs, voit l'offre appliquée, l'économie et le reste à payer pour la livraison
  gratuite, puis ajoute tout au panier en un clic, sans quitter la page. Il reproduit les
  remises Shopify : 8 pour 6, 10 pour 8 et 7 pour 6 (test : `pack-builder.test.mjs`).
- **Barre de progression dans le panier** (`snippets/cn-cart-progress.liquid`, insérée dans
  `snippets/cart-drawer.liquid`) : livraison gratuite + « encore X paires pour l'offre ».
- **Textes bilingues FR/EN** : clés `cuddlenest.*` dans `locales/fr.json` et
  `locales/en.default.json`, sans allégation écologique, de faux avis ou de fausse rareté.
- **Réglages** : Personnaliser → Paramètres du thème → **CuddleNest** (seuil de livraison
  gratuite, prix minimal « premium », quantités des 3 offres). À garder identiques aux remises.
- **Style** : `assets/cuddlenest.css`, chargé dans `layout/theme.liquid`.

## Vérifications faites
- Theme Check (outil officiel Shopify) : 0 problème dans ces fichiers.
- Composeur testé avec les vrais prix : A = 72,30 $, B = 55,60 $, C = 41,70 $, comme au paiement.
- Les 21 fichiers installés dans Shopify ont la même empreinte MD5 que ce dossier.

## Avant de publier
1. Aperçu : Boutique en ligne → Thèmes → CuddleNest 2.0 → Aperçu (FR et EN).
2. Guide des tailles : vérifier les hauteurs (≈ 80–90 / 90–100 / 100–110 cm) avec le fournisseur.
3. Délai de livraison : laissé vide par défaut. Le renseigner (barre de confiance + FAQ)
   seulement avec un délai réel.
4. Commande test avec le composeur, puis Publier.
