# Workflow n8n — Démarche AVORYN en cinq étapes

Fichier : [`avoryn-demarche-5-etapes.json`](avoryn-demarche-5-etapes.json)
Vérifié : import et réexport réussis avec **n8n 2.42.6** (24 nœuds). L’exécution de bout en bout n’a pas été testée
(elle nécessite vos identifiants SMTP et, en option, une clé Anthropic).

## Ce que fait le workflow

```
Formulaire du site ──► Webhook ──► Configuration
                                     │
① COMPRENDRE   Fiche de cadrage (référence AVR-AAAAMMJJ-XXXX, questions selon le secteur)
               └─► Accusé de réception au client (FR/EN)
② ANALYSER     IA autorisée ?
               ├─ oui ► Pré-analyse Claude (JSON structuré) ─► Lecture + repli si erreur/refus
               └─ non ► Grille d’analyse manuelle
③ CONCEVOIR    Brouillon de proposition ─► Courriel interne avec liens [Approuver] / [Ne pas donner suite]
               └─► Attente de la décision (14 jours max)
④ DÉPLOYER     Approuvé ?
               ├─ oui ► Plan de déploiement ─► Courriel de lancement (client) + plan interne
               └─ non / délai expiré ► Note interne (aucun courriel automatique au client)
⑤ AMÉLIORER    Attente de 30 jours ─► Bilan demandé au client + revue interne ─► nouveau cycle
```

Principes respectés :
- **Validation humaine obligatoire** avant tout engagement envers le client (étape ③).
- **IA désactivée par défaut** (`useAI = false`). Activée, elle ne reçoit que le type, le secteur,
  l’organisation et le message — jamais le nom ni le courriel (minimisation, Loi 25).
- La pré-analyse IA est marquée « à vérifier » ; en cas d’erreur ou de refus du modèle, le workflow
  bascule sur l’analyse manuelle au lieu de s’arrêter.

## Installation

1. **Importer** : dans n8n, *Workflows → Import from File* → choisir le fichier JSON.
2. **Créer les identifiants** (*Credentials*) puis les sélectionner dans les nœuds signalés en rouge :
   | Identifiant | Type | Valeur |
   | --- | --- | --- |
   | AVORYN – Secret du webhook | Header Auth | Nom : `Authorization` · Valeur : `Bearer <secret long et aléatoire>` |
   | AVORYN – SMTP | SMTP | Serveur d’envoi de votre domaine |
   | Anthropic – x-api-key *(optionnel)* | Header Auth | Nom : `x-api-key` · Valeur : votre clé API Anthropic |
3. **Configurer** le nœud *Configuration* :
   | Champ | Rôle | Défaut |
   | --- | --- | --- |
   | `avorynEmail` | Boîte qui reçoit les validations internes | `equipe@exemple.ca` |
   | `fromEmail` | Expéditeur des courriels | `AVORYN <no-reply@exemple.ca>` |
   | `useAI` | Active la pré-analyse par Claude | `false` |
   | `claudeModel` / `claudeEffort` | Modèle et niveau d’effort | `claude-opus-5-5` / `medium` |
   | `approvalDays` | Délai maximal pour décider | `14` |
   | `followUpDays` | Délai avant le bilan d’amélioration | `30` |
4. **Activer** le workflow et copier l’URL de production du webhook (`…/webhook/avoryn-demande`).
5. **Relier le site** (variables d’environnement du site, voir `.env.example`) :
   ```
   CONTACT_DELIVERY=webhook
   CONTACT_WEBHOOK_URL=https://<votre-n8n>/webhook/avoryn-demande
   CONTACT_WEBHOOK_SECRET=<le même secret que l’identifiant Header Auth, sans « Bearer »>
   ```
   Le site envoie : `subject, locale, receivedAt, type, name, email, organization, sector, message`.

## Tester sans le site

```bash
curl -X POST "https://<votre-n8n>/webhook-test/avoryn-demande" \
  -H "Authorization: Bearer <secret>" -H "Content-Type: application/json" \
  -d '{"locale":"fr","type":"project","name":"Jeanne Test","email":"jeanne@example.com",
       "organization":"","sector":"realEstate","message":"Nous voulons automatiser le suivi de nos baux.",
       "receivedAt":"2026-10-10T12:00:00Z"}'
```
(Utiliser l’URL `webhook-test` après avoir cliqué sur *Execute workflow* dans l’éditeur.)

## Avant d’activer l’IA (`useAI = true`)

La pré-analyse envoie le contenu de la demande à l’API d’Anthropic, hors Québec.
La Loi 25 impose une **évaluation des facteurs relatifs à la vie privée** avant cette communication,
et la politique de confidentialité du site doit mentionner ce fournisseur.
Le corps de requête active les modèles de repli côté serveur (`fallbacks: "default"`) en cas de refus du modèle principal.

## Personnaliser

- Questions de cadrage par secteur : nœud *① Comprendre – Fiche de cadrage*.
- Structure de la proposition : nœud *③ Concevoir – Brouillon de proposition*.
- Phases du déploiement : nœud *④ Déployer – Plan de déploiement*.
- Pour conserver un historique des projets, ajouter après chaque étape un nœud Google Sheets, Airtable ou
  base de données (non inclus pour ne pas imposer d’outil ; appliquer une durée de conservation).
