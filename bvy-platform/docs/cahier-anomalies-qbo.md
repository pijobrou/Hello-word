# Cahier fonctionnel — Gestion des problèmes liés aux applications QBO

> **Statut :** document de référence fourni par le propriétaire le 2026-10-03. **Il ne remplace pas `CLAUDE.md`**,
> qui reste le cahier principal et l'ordre de construction. Les éléments de ce cahier sont ajoutés
> progressivement, au fil de l'avancement, chacun proposé au propriétaire et approuvé avant d'être construit.
> Les points 1, 2 et 3 déjà livrés (documents et communication, anomalies et questions au client, santé
> financière et résumés) ne sont pas repris.

## 1. Objectif du logiciel

Le logiciel doit agir comme une couche de contrôle entre QuickBooks Online (QBO), les banques et les applications
connectées.

Il ne doit pas chercher à remplacer QBO.

Son rôle est de :

1. détecter les anomalies;
2. expliquer clairement le problème;
3. identifier les transactions concernées;
4. proposer une correction;
5. demander une validation lorsque nécessaire;
6. effectuer la correction dans QBO lorsque l'utilisateur l'autorise;
7. conserver une trace de la correction.

## 2. Problèmes prioritaires à gérer

### A. Transactions en double

**Détection** — le système doit rechercher :

- même montant;
- même date ou date proche;
- même fournisseur/client;
- même numéro de transaction;
- même référence;
- même transaction provenant de deux sources différentes.

**Exemple** — Shopify crée une vente de 500 $. Le dépôt bancaire de 500 $ arrive ensuite dans QBO. Le logiciel doit
déterminer que le dépôt bancaire correspond probablement à une transaction existante plutôt que de créer un nouveau
revenu.

**Interface**

```text
⚠️ Transaction possiblement en double
500,00 $ — Shopify
500,00 $ — Banque

Correspondance probable : 98 %

[Rapprocher] [Ignorer] [Examiner]
```

## 3. Transactions non catégorisées

Le logiciel doit identifier :

- dépenses sans catégorie;
- revenus sans compte;
- transactions classées dans un compte temporaire;
- transactions classées dans une catégorie inhabituelle.

Il doit proposer une catégorie basée sur :

- historique du client;
- fournisseur;
- description;
- montant;
- transactions similaires;
- règles comptables configurées.

**Exemple**

```text
⚠️ 23 transactions non catégorisées

Fournisseur : Amazon
Total : 1 284,32 $

Catégorie proposée : Fournitures
Confiance : 91 %

[Accepter les 23] [Examiner]
```

## 4. Problèmes de synchronisation

Le logiciel doit détecter lorsqu'une application cesse de synchroniser correctement avec QBO.

Exemples :

- Shopify → QBO interrompu;
- Stripe → QBO interrompu;
- PayPal → QBO interrompu;
- application bancaire → QBO interrompue;
- token/API expiré;
- autorisation révoquée;
- erreur API;
- synchronisation partielle.

**Interface**

```text
🔴 Shopify n'est plus synchronisé
Dernière synchronisation : 28 septembre

47 transactions pourraient être absentes de QBO.

[Reconnecter] [Analyser]
```

## 5. Transactions manquantes

Comparer les données de la plateforme source avec QBO.

Exemple : Shopify : 1 248 commandes ; QBO : 1 231 transactions.

Le logiciel doit détecter :

```text
⚠️ 17 transactions Shopify ne semblent pas présentes dans QBO.
```

Il doit permettre d'identifier exactement lesquelles.

## 6. Problèmes de rapprochement bancaire

Le système doit comparer **Banque ↔ QBO ↔ application source** et identifier :

- dépôts non rapprochés;
- retraits non rapprochés;
- montants différents;
- transactions groupées;
- transactions divisées;
- dépôts correspondant à plusieurs ventes.

**Exemple** — Stripe :

- ventes : 5 000 $
- remboursements : −300 $
- frais : −125 $
- dépôt bancaire : 4 575 $

Le logiciel doit comprendre que 5 000 − 300 − 125 = 4 575 $ et proposer le rapprochement.

## 7. Frais des plateformes

Le logiciel doit identifier les frais provenant de : Shopify; Stripe; PayPal; Square; Amazon; autres plateformes.

Il doit séparer :

```text
Ventes brutes
− remboursements
− frais
= montant déposé
```

C'est essentiel pour éviter que le revenu comptable corresponde uniquement au montant bancaire reçu.

## 8. Taxes de vente

Pour le Canada et particulièrement le Québec, le système doit surveiller :

- TPS;
- TVQ;
- taxes incluses/exclues;
- taxes sur les ventes;
- taxes sur les remboursements;
- taxes sur les frais;
- transactions sans traitement fiscal cohérent.

**Exemple**

```text
⚠️ Anomalie fiscale

18 transactions Shopify contiennent de la TVQ, mais la TVQ n'est pas comptabilisée dans QBO.

Montant concerné : 1 245,60 $

[Examiner]
```

Le système ne doit pas inventer le traitement fiscal : il doit présenter l'anomalie et la règle applicable
configurée par le professionnel.

## 9. Remboursements et chargebacks

Détecter :

- remboursements Shopify;
- remboursements Stripe;
- remboursements PayPal;
- chargebacks;
- remboursements qui n'ont pas été comptabilisés dans QBO.

Le logiciel doit vérifier que le remboursement est associé à la transaction originale lorsque possible.

## 10. Mauvais mapping comptable

Chaque application possède des mappings.

Exemple : Shopify : Sales → QBO account 4000. Mais le compte devrait être : Sales → QBO account 4010.

Le logiciel doit détecter les changements ou incohérences.

**Alerte**

```text
⚠️ Mapping inhabituel

34 transactions Shopify utilisent maintenant le compte « Autres revenus ».

Historique : ces transactions étaient normalement comptabilisées dans « Ventes ».

[Examiner]
```

## 11. Changements inhabituels

Le logiciel doit apprendre le comportement historique du dossier.

Exemple — habituellement : Fournisseur X → 100 % Fournitures. Mais soudain : Fournisseur X → 12 transactions →
Frais professionnels.

Le système signale : ⚠️ Changement inhabituel de catégorisation.

## 12. Détection des anomalies par IA

L'IA peut être utilisée pour identifier des situations inhabituelles.

Elle doit analyser : description; fournisseur; montant; fréquence; historique; catégorie; taxes; source; relation
avec d'autres transactions.

Mais l'IA ne doit pas modifier automatiquement les livres pour les cas incertains.

Elle doit retourner : **Problème → Explication → Proposition → Niveau de confiance → Action**

**Exemple**

```text
🟠 Catégorisation inhabituelle

Transaction : 1 850 $
Fournisseur : Best Buy

Catégorie actuelle : Publicité

Catégorie proposée : Équipement informatique

Confiance : 94 %
```

## 13. Tableau de bord principal

Le client ou le comptable doit voir immédiatement :

```text
Santé du dossier

🟢 Synchronisations : 8/8
🟠 Transactions à examiner : 27
🔴 Erreurs critiques : 3
🟡 Transactions non catégorisées : 18
🟠 Transactions potentiellement en double : 6
🟢 Rapprochement bancaire : 96 %
```

## 14. Priorisation

Toutes les anomalies ne doivent pas être traitées de la même façon. Le logiciel doit attribuer une priorité :

- 🔴 **Critique** — peut modifier significativement les états financiers ou les taxes.
- 🟠 **Important** — nécessite une vérification comptable.
- 🟡 **À vérifier** — anomalie probable mais faible impact.
- 🟢 **Information** — aucune intervention immédiate.

## 15. Historique des corrections

Chaque intervention doit être enregistrée.

**Exemple**

```text
3 octobre 2026 — 10:42

Transaction : 450 $

Ancienne catégorie : Dépenses diverses
Nouvelle catégorie : Fournitures

Correction proposée par IA
Validée par : Comptable

Source : Shopify

ID QBO : XXXXX
```

Cela crée une piste d'audit interne.

## 16. Architecture recommandée

Le système devrait fonctionner ainsi :

```text
Applications
↓
Shopify / Stripe / Square / PayPal / banques / autres
↓
Couche d'intégration
↓
Moteur de normalisation
↓
Moteur de règles
↓
Moteur de détection d'anomalies
↓
IA
↓
BVY
↓
QuickBooks Online
```

L'IA ne doit donc pas être directement responsable de toute la comptabilité. Elle intervient comme moteur
d'analyse et de recommandation au-dessus de règles déterministes.

## 17. Principe fondamental

Le logiciel doit toujours pouvoir répondre à quatre questions :

1. **Qu'est-ce qui est arrivé ?** Une transaction de 4 575 $ est arrivée de Stripe.
2. **Pourquoi est-ce un problème ?** Elle correspond probablement à plusieurs ventes déjà enregistrées.
3. **Quelle est la solution proposée ?** Rapprocher le dépôt avec les transactions Stripe existantes.
4. **Qui doit décider ?** Le comptable ou l'utilisateur autorisé.

## 18. Première version à développer

Pour éviter de construire un système trop gros dès le départ, la V1 devrait se concentrer sur :

1. Connexion QBO
2. Connexion bancaire
3. Détection des doublons
4. Détection des transactions non catégorisées
5. Détection des transactions manquantes
6. Rapprochement des dépôts
7. Détection des erreurs de synchronisation
8. Détection des frais Shopify/Stripe
9. Détection des anomalies TPS/TVQ
10. Tableau de bord des anomalies
11. Suggestions de correction par IA
12. Validation humaine
13. Journal des corrections

La V1 ne devrait pas essayer de refaire toute la comptabilité de QBO.

Elle doit devenir le système qui répond à :

> « Est-ce que mes données dans QBO sont cohérentes, et qu'est-ce que je dois corriger ? »
