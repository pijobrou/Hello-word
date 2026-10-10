# Cerveau IA de BVY — demande du propriétaire

> **Statut :** demande notée le 2026-10-04, **pas encore construite**. À concevoir avec le propriétaire et à faire
> approuver avant tout développement (CLAUDE.md, barrières d'approbation). `CLAUDE.md` reste le cahier principal.

## La demande (propriétaire, 2026-10-04)

> « J'aimerais avoir un cerveau IA pour ce projet où il dirigera tout et améliorera ceci au fur et à mesure du
> temps. Et le cerveau hébergé localement. Note-le, et que tout soit enregistré pour le cerveau IA. »

En clair :

1. **Un cerveau** : une IA qui coordonne le travail de la plateforme (l'« orchestrateur » de l'architecture WAT de
   `CLAUDE.md` : workflows, agents, outils).
2. **Qui s'améliore avec le temps** : il apprend des décisions de l'équipe et des réponses des clients.
3. **Hébergé localement** : chez BVY (serveur de BVY), pas dans un service extérieur.
4. **Tout est enregistré pour lui** : chaque décision, correction et réponse est gardée pour qu'il puisse s'en
   servir.

## Ce qui est déjà enregistré (sa future mémoire)

Tout est dans la base du portail (`/var/www/bvy-portail/shared/data`, sur le serveur de BVY) :

| Mémoire | Où |
|---|---|
| Chaque action de l'équipe et des clients, datée, avec son auteur | `audit_logs` |
| Réponses des clients par bénéficiaire (« Costco : dépense d'entreprise ») | `client_decisions` (workflow 08) |
| Suggestions de catégorie, source, confiance, et la décision de l'équipe (acceptée, autre compte choisi) | `ai_suggestions` (workflow 07) |
| Anomalies détectées, résolues, ignorées, avec la raison | `anomalies`, `anomaly_events` (workflow 06) |
| Historique de classement dans QuickBooks par bénéficiaire | `qbo_payee_accounts` |
| Demandes du gouvernement et leur résultat | `gov_requests`, `gov_request_events` (workflow 17) |
| Paies, TPS/TVQ, impôts : chaque étape, qui, quand | `pay_run_events`, `tax_return_events`, `tax_file_events` |
| Documents classés, rappels, échanges | `documents`, `task_reminders`, `messages` |
| Résumés publiés et leurs versions | `summaries`, `summary_versions` |
| Appels à l'IA (sans le contenu) | `ai_calls` |

Règle à garder pour la suite : **toute nouvelle fonction enregistre ses décisions de la même façon** (qui, quand,
ce qui était proposé, ce qui a été choisi, pourquoi).

## Les choix à faire avec le propriétaire (avant de construire)

1. **Que veut dire « diriger tout » ?** Proposer le travail du jour à chaque employé, préparer les brouillons
   (questions, résumés, réponses), repérer ce qui bloque — avec une personne qui valide ? Ou agir seul sur
   certains points ? (`CLAUDE.md` : jamais d'action sensible sans validation humaine.)
2. **« Hébergé localement »** — deux façons possibles :
   - **Mémoire et orchestration chez BVY, raisonnement par une IA externe** (comme aujourd'hui) : les données restent
     sur le serveur de BVY ; seuls les extraits nécessaires partent le temps d'un appel. Peu coûteux, très capable.
   - **Modèle d'IA entièrement installé chez BVY** (modèle ouvert) : aucune donnée ne sort. Mais le serveur actuel
     (VPS OVH sans carte graphique) est trop petit pour un modèle utile ; il faudrait un serveur avec carte
     graphique (coût mensuel important) et la qualité serait plus faible pour la fiscalité québécoise.
   - Possible aussi : un mélange (modèle local pour le tri simple, IA externe pour le reste).
3. **Comment il « s'améliore »** : par la mémoire (règles apprises des décisions, revues par l'équipe) plutôt que
   par un réentraînement du modèle — plus sûr, explicable et réversible.
4. **Loi 25** : registre des traitements, consentement des clients, et évaluation des facteurs relatifs à la vie
   privée avant de mettre un cerveau IA sur les dossiers.

## Proposition de place dans le plan

Après le point 4 (classement et conciliation assistée), comme phase « automatisation avancée » (phase 8 de
`CLAUDE.md`), une fois les choix ci-dessus faits et approuvés.
