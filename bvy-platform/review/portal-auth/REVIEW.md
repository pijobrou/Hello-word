# Dossier de revue — portail BVY, phase 2 : connexion et rôles

Date : 1er octobre 2026. Procédure : `workflows/02_auth_roles.md`. Code : `apps/portal/`.

**État : construit et testé sur ordinateur, pas encore en ligne.** Aucune donnée réelle de client.

## 1. Ce qui fonctionne

| Écran | Ce qu’il fait |
|---|---|
| Connexion (`01`) | Courriel + mot de passe. Même message d’erreur que le compte existe ou non. |
| Vérification (`02`) | Code à 6 chiffres par courriel (10 minutes, 5 essais), ou code de l’application d’authentification. On peut toujours demander un code par courriel. |
| Accueil équipe (`03`) | Les clients visibles selon le rôle ; rappel d’activer l’application si elle ne l’est pas. |
| Administration (`04`) | Inviter une personne (rôle + entreprise pour un client), créer un client, voir l’état des comptes, journal d’audit. |
| Mon compte (`05`) | Activer l’application d’authentification (clé à saisir dans Google ou Microsoft Authenticator), changer le mot de passe, fermer un appareil connecté. |
| Accueil client (`06`) | Le client voit seulement son entreprise. Le vrai tableau de bord arrive à la phase 3. |
| Accès refusé (`07`) | Un client qui tente d’ouvrir l’administration est refusé, et la tentative est inscrite au journal. |
| Invitation (`08`) | La personne choisit elle-même son mot de passe (lien de 72 heures, à usage unique). |

Captures : `NN-nom-bureau.png` (1440 px) et `NN-nom-mobile.png` (390 px), dans ce dossier.

## 2. Les rôles

| Rôle | Voit |
|---|---|
| Administrateur BVY | Tout : clients, personnes, journal d’audit |
| Comptable principal | Tous les clients ; invite des clients ; journal |
| Tenue de livres, Paie, Fiscalité | Seulement les clients qui leur sont assignés |
| Client | Seulement sa propre entreprise |

## 3. Sécurité (vérifiée par 17 tests automatiques)

- Mots de passe : 12 caractères minimum, chiffrés (scrypt), jamais envoyés par courriel.
- Deux étapes à chaque connexion. Après la 2ᵉ étape, le jeton de session change.
- 10 mauvais mots de passe → compte bloqué 15 minutes ; limite de tentatives par adresse IP.
- Session : 60 minutes d’inactivité, 12 heures au maximum ; témoin `__Host-` sécurisé.
- Chaque formulaire est protégé contre la falsification de requête (origine + jeton).
- Personne désactivée : toutes ses sessions sont fermées immédiatement.
- Journal d’audit qui ne peut être ni modifié ni effacé (vérifié par la base de données elle-même).
- Aucun script dans les pages ; politique de sécurité du contenu stricte ; pages non indexées par les moteurs et les robots d’IA.

Un essai dans un vrai navigateur a révélé un défaut que les tests ne voyaient pas (les formulaires étaient
refusés à cause d’un réglage d’en-tête) ; il est corrigé et couvert.

## 4. Limites connues

- Pas encore en ligne : il faut ajouter `portail` dans le DNS d’OVH, puis un certificat HTTPS (je fournirai les commandes).
- Les courriels (codes, invitations) passeront par le même compte Gmail que le site.
- Pas de code QR pour l’application d’authentification : on saisit la clé (32 caractères), ou on touche le lien sur le téléphone.
- Base de données SQLite intégrée à Node, dans `/var/www/bvy-website/shared/` au Canada : simple et suffisante
  pour démarrer ; une sauvegarde automatique sera ajoutée avec la mise en ligne.

## 5. Prochaine étape proposée

1. Mise en ligne sur `portail.bvyaccountingtax.ca` (DNS, certificat, service, sauvegarde), puis création de votre compte administrateur.
2. Phase 3 — portail client : tableau de bord, À faire, Documents, Messages, Rapports, bouton « Ouvrir QuickBooks ».
