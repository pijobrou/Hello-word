# Workflow 19 — Sécurité du site, veille quotidienne et avis des utilisateurs

STATUS: WAITING_FOR_OWNER_APPROVAL

## Demande du propriétaire (2026-10-08)

> « il faut le bloquer comme je t'ai dit au début : il faut interdire de copier le site ou le pirater de quelque
> manière que ce soit, car la Loi 25 s'applique à moi. Qu'aucune IA ne parvienne à contourner la protection. S'il le
> faut, insère une IA qui veille sur la sécurité du site et recueille les avis des clients afin d'améliorer le logiciel. »

## Ce qui existait déjà

- robots.txt et réservation TDM (`/.well-known/tdmrep.json`) : robots d'IA interdits, contenu réservé.
- nginx : 33 robots d'IA et 12 outils d'aspiration refusés (403) ; requêtes sans navigateur déclaré refusées ;
  limites de vitesse ; en-têtes de sécurité (CSP stricte, interdiction d'être affiché dans un cadre, HTTPS forcé).
- Formulaire et Jessica : vérification des coordonnées, robots et pourriel ignorés (révision 3 du workflow 00).
- Portail : connexion en deux étapes, rôles, journal d'audit, limites de connexion.

## Ajouté

1. **Piège à robots** : `/acces-reserve/` est interdit dans robots.txt et seulement atteignable par un lien invisible
   en bas de chaque page. Un humain ou un moteur de recherche honnête ne le visite jamais ; un robot qui se fait
   passer pour un navigateur et ignore les règles, oui → journal `bvy-piege.log` → **banni 24 h** (fail2ban).
2. **Recherche de failles** (`.php`, `wp-admin`, `.env`, `.git`, `phpmyadmin`…) : connexion coupée (444) et
   **bannie 24 h**. Le site n'a aucun de ces éléments ; les chercher, c'est chercher une faille.
3. **Abus** : 30 refus (403, 429, 444) en 10 minutes sur le site ou le portail → banni 24 h.
   **Récidive** : 3 bannissements en une semaine → 4 semaines, sur tous les ports.
4. **Veille de sécurité** (`apps/website/veille.js`, minuterie `bvy-veille`, chaque matin vers 7 h, heure du Québec) :
   courriel à BVY avec robots refusés, failles cherchées, adresses bannies, fausses demandes ignorées, état du site
   et du portail, jours restants du certificat HTTPS. Une ligne « À vérifier » seulement s'il y a un vrai problème.
   Supprime aussi les fausses demandes de plus de 30 jours (Loi 25 : conservation limitée).
5. **Conditions d'utilisation, section 7** : copie, aspiration, extraction automatisée, entraînement ou
   alimentation d'une IA, reproduction du site et tests de sécurité non autorisés interdits expressément.
   **Section 4 corrigée** : elle disait que BVY ne modifie rien dans QuickBooks, ce qui n'est plus vrai depuis le
   workflow 18. Politique de confidentialité mise à jour en conséquence, et pour le blocage des adresses IP
   (journaux gardés au plus 30 jours ; nginx les garde 14 jours).
6. **Avis des utilisateurs** (portail) : « Votre avis » dans le menu de chaque client et de chaque membre de
   l'équipe (facilité de 1 à 5, sujet, page, message) ; chacun voit ses avis et la réponse de BVY.
   Administration → « Avis » : facilité moyenne sur 90 jours, sujets, pages qui posent problème, état
   (Reçu, Lu, Prévu, Fait, Pas retenu) et réponse visible par la personne. 10 avis par jour et par personne au plus.

## Pourquoi des règles fixes et pas une IA pour la sécurité

Une IA qui jugerait chaque visite serait lente, coûteuse et elle-même trompable (un texte peut la manipuler).
Les règles fixes de nginx et fail2ban décident en une milliseconde et ne se laissent pas convaincre. La veille
rapporte chaque jour ; les avis et les incidents sont gardés pour le « cerveau » prévu (`docs/cerveau-ia.md`),
qui pourra plus tard résumer les tendances et proposer des améliorations au propriétaire.

## Limites honnêtes

- Une page publique affichée à un humain peut toujours être lue, copiée à la main ou photographiée : aucune
  technique ne l'empêche (bloquer le clic droit ne protège rien et nuit à l'accessibilité). Ce qui est protégé :
  la copie automatisée en masse, et le droit (conditions, droit d'auteur, réservation TDM).
- Un robot très bien déguisé (vrai navigateur, adresses IP résidentielles changeantes, rythme humain) peut lire
  des pages publiques sans être détecté. C'est le cas de tous les sites. L'essentiel est ailleurs :
- **Ce que la Loi 25 protège, ce sont les renseignements personnels** : ils ne sont pas sur les pages publiques,
  mais dans le portail (connexion en deux étapes, rôles, chiffrement, journal) et dans les demandes reçues
  (fichiers à accès restreint). Rien de personnel n'est lisible sans connexion.
- Option plus forte, au choix du propriétaire : Cloudflare (gratuit) devant le site, avec son mode « robots »,
  ou la case « Je ne suis pas un robot » (Turnstile) sur le formulaire. Clés à ajouter sur le serveur par le
  propriétaire.
- **Loi 25, à prévoir** : registre des incidents de confidentialité (obligatoire) — à ajouter au portail si le
  propriétaire le souhaite ; la veille fournit déjà la matière.

## Installation

`deploy.cmd --nginx` (une fois : la configuration nginx change), puis `deploy-portail.cmd` (migration 17 du portail).
`remote-install.sh` installe fail2ban, ses règles et la minuterie de veille. Rapport de veille à la main :
`sudo systemctl start bvy-veille` ; sans l'envoyer : `sudo node /var/www/bvy-website/current/veille.js --afficher`.

## Tests

- Site : `test/veille.test.js`, `test/verify.test.js`, `test/bots.test.js` (52 tests).
- Portail : `test/feedback.test.js` (59 tests).
- Configuration nginx vérifiée avec `nginx -t` et des requêtes réelles : piège → 403 journalisé, `wp-login.php`,
  `.env`, `xmlrpc.php` → 444 journalisés, pages normales → 200, robot d'IA → 403.
