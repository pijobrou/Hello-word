# Correction : « Add to cart » sans quitter la fiche produit

## Cause
La fiche utilise la section Amose `sections/amose-product-information-2.liquid`. Son bouton
« Add to cart » est un simple `<button type="submit">` dans `{% form 'product' %}` : le
navigateur envoie le formulaire à `/cart/add`, puis Shopify redirige vers `/cart`.

Le thème Horizon, lui, ajoute en AJAX. Mais la section Amose ne passe pas par son code
(`assets/product-form.js`).

## Correction
Un script intercepte l'envoi du formulaire Amose et ajoute l'article avec `/cart/add.js`,
sans changer de page. Il envoie ensuite l'événement standard `CartLinesUpdateEvent`
(`@shopify/events`), celui qu'écoute le thème : la pastille du panier se met à jour et le
tiroir s'ouvre si le réglage « ouvrir automatiquement » est activé. Le bouton affiche
« ✓ Ajouté au panier » pendant 2 secondes. En cas d'erreur, un message s'affiche et la
page ne change pas.

## Installation (option simple : coller le bloc)
1. Shopify → Boutique en ligne → Thèmes → « … » → **Modifier le code**.
2. Ouvrir `sections/amose-product-information-2.liquid`.
3. Ctrl+F : `var atcPriceTargets = root.querySelectorAll('[data-amose-atc-price]');`
4. Placer le curseur **au début de cette ligne**, coller le contenu de `BLOC-A-COLLER.js`,
   puis **Enregistrer**.

Option complète : remplacer tout le contenu du fichier par
`amose-product-information-2.CORRIGE.liquid`.

## Test
Choisir Whale / 90 → Add to cart → Panda / 100 → Add to cart. On doit rester sur la page,
et le panier doit contenir 2 lignes avec les bons motifs et les bonnes tailles.

## À savoir
- Si l'application Amose met à jour ou régénère la section, la correction peut disparaître :
  il faudra recoller le bloc.
- Le thème Horizon n'a pas de `snippets/product-form.liquid`, `sections/main-product.liquid`,
  `assets/theme.js` ni `assets/global.js`. Les fichiers équivalents sont dans
  `fichiers-bouton-panier-ORIGINAUX.zip`.
