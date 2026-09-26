# Mettre en ligne le site BVY — guide pas à pas

Ce guide explique comment publier le nouveau site public de **BVY Accounting & Tax Services**
sur votre serveur OVH, à l'adresse **https://bvyaccountingtax.ca**.

Vous n'avez pas besoin d'être informaticien : il suffit de copier-coller les commandes, une par une,
dans l'**Invite de commandes** de Windows (touche Windows, tapez `cmd`, Entrée).

> **Règle d'or :** aucun mot de passe, aucune clé secrète ne doit être écrit dans un fichier de ce
> projet. Le mot de passe du serveur vous est demandé à l'écran, et vous le tapez vous-même.

**Sommaire**

0. [Ce qui est mis en ligne](#0-ce-qui-est-mis-en-ligne)
1. [Préparer votre PC Windows](#1-préparer-votre-pc-windows)
2. [Premier test de connexion au serveur](#2-premier-test-de-connexion-au-serveur)
3. [Voir le site sur votre PC avant de le publier](#3-voir-le-site-sur-votre-pc-avant-de-le-publier)
4. [Méthode A — publication automatique (recommandée)](#4-méthode-a--publication-automatique-recommandée)
5. [Méthode B — publication manuelle, étape par étape](#5-méthode-b--publication-manuelle-étape-par-étape)
6. [Le certificat HTTPS (cadenas)](#6-le-certificat-https-cadenas)
7. [Vérifier le DNS du domaine](#7-vérifier-le-dns-du-domaine)
8. [Vérifier que tout fonctionne](#8-vérifier-que-tout-fonctionne)
9. [Recevoir les demandes du formulaire de contact](#9-recevoir-les-demandes-du-formulaire-de-contact)
10. [Mettre à jour, revenir en arrière, remettre l'ancien site](#10-mettre-à-jour-revenir-en-arrière-remettre-lancien-site)
11. [Dépannage](#11-dépannage)

---

## 0. Ce qui est mis en ligne

| Élément | Où, sur le serveur |
|---|---|
| Les pages du site (accueil, services, tarifs, contact…) | `/var/www/bvy-website/current/public/` |
| Le petit programme Node qui reçoit le formulaire de contact | service **`bvy-website`**, port 3000 (interne) |
| Les demandes de contact reçues (**conservées** à chaque mise à jour) | `/var/www/bvy-website/shared/data/leads.jsonl` |
| Les réglages privés (adresse du webhook…) | `/var/www/bvy-website/shared/.env` |
| Les 5 dernières versions du site | `/var/www/bvy-website/releases/<date-heure>/` |

Serveur : **OVH VPS** `vps-c10a80cd.vps.ovh.ca` — IPv4 `148.113.238.146` — IPv6 `2607:5300:205:200::3da4`
— utilisateur `ubuntu`.

### Comment ça marche

```text
   Visiteur (navigateur)
           │  https://bvyaccountingtax.ca
           ▼
  ┌─────────────────────────── Serveur OVH (Ubuntu) ───────────────────────────┐
  │                                                                            │
  │   nginx  (ports 80 et 443, certificat Let's Encrypt)                       │
  │     │                                                                      │
  │     ├── pages, images, CSS  ──►  /var/www/bvy-website/current/public/      │
  │     │                            (servies directement : rapide, et le site │
  │     │                             reste visible même si Node est arrêté)   │
  │     │                                                                      │
  │     └── /api/...  (formulaire) ──►  Node  127.0.0.1:3000  (service systemd │
  │                                        « bvy-website », utilisateur bvy)   │
  │                                          │                                 │
  │                                          ├─► shared/data/leads.jsonl       │
  │                                          └─► webhook n8n / e-mail (option) │
  └────────────────────────────────────────────────────────────────────────────┘

  « current » est un raccourci vers la version active :
      current  ──►  releases/20260926-153000/
  Publier = ajouter une version puis déplacer le raccourci (sans coupure).
  Revenir en arrière = remettre le raccourci sur la version précédente.
```

Les fichiers de ce dossier (`bvy-platform/tools/deployment/`) :

| Fichier | Rôle |
|---|---|
| `deploy.cmd` | Publication en un clic depuis Windows |
| `deploy.sh` | La même chose depuis macOS / Linux / Git Bash |
| `remote-install.sh` | Le script qui s'exécute **sur le serveur** (installation, sauvegardes, vérifications) |
| `nginx/bvyaccountingtax.ca.conf` | Configuration nginx HTTPS |
| `nginx/bvyaccountingtax.ca.http-only.conf` | Configuration nginx temporaire, tant qu'il n'y a pas de certificat |
| `systemd/bvy-website.service` | Démarrage automatique du programme Node |

---

## 1. Préparer votre PC Windows

### 1.1 Vérifier que « ssh » est installé

Ouvrez l'Invite de commandes (`cmd`) et tapez :

```bat
ssh -V
```

- Une réponse du type `OpenSSH_for_Windows_9.5p1` → c'est bon.
- Un message « n'est pas reconnu en tant que commande » → installez-le :
  1. Menu Démarrer → **Paramètres** → **Applications** → **Fonctionnalités facultatives**
  2. **Ajouter une fonctionnalité** → cochez **Client OpenSSH** → **Installer**
  3. Fermez puis rouvrez l'Invite de commandes, et retapez `ssh -V`.

La commande `tar` (pour faire l'archive) est déjà incluse dans Windows 10 et 11. Vérifiez avec `tar --version`.

### 1.2 Node.js (facultatif)

Node.js n'est **pas obligatoire** pour publier : le site est déjà prêt dans `public/`.
Il sert seulement à voir le site sur votre PC (section 3). Pour l'installer : https://nodejs.org
(version « LTS », 22 ou plus récente). Vérifiez avec `node -v` (il faut **v20.12** ou plus).

### 1.3 Récupérer le code du site

**Avec Git** (si `git --version` répond) :

```bat
cd %USERPROFILE%\Documents
git clone https://github.com/pijobrou/Hello-word.git
cd Hello-word
git checkout claude/competence-marketing-pro-hvz21k
```

Plus tard, pour récupérer les dernières modifications :

```bat
cd %USERPROFILE%\Documents\Hello-word
git pull
```

**Sans Git** : sur https://github.com/pijobrou/Hello-word, choisissez la branche
`claude/competence-marketing-pro-hvz21k`, puis **Code → Download ZIP**. Faites un clic droit sur
le ZIP → **Extraire tout**, dans `Documents`. Renommez le dossier obtenu en `Hello-word`
(il s'appelle parfois `Hello-word-claude-competence-marketing-pro-hvz21k`).

Dans la suite, on suppose que le projet est dans `%USERPROFILE%\Documents\Hello-word`.

---

## 2. Premier test de connexion au serveur

```bat
ssh ubuntu@148.113.238.146
```

1. La première fois, Windows affiche :
   `The authenticity of host '148.113.238.146' can't be established ... Are you sure you want to continue connecting (yes/no/[fingerprint])?`
   Tapez **`yes`** puis Entrée. (C'est normal : votre PC fait connaissance avec le serveur.)
2. Tapez le mot de passe de l'utilisateur `ubuntu` (celui reçu d'OVH ou que vous avez choisi).
   **Rien ne s'affiche pendant la frappe** — c'est normal. Terminez par Entrée.
3. Vous voyez une ligne du genre `ubuntu@vps-c10a80cd:~$` : vous êtes sur le serveur.
4. Tapez `exit` pour revenir sur votre PC.

### 2.1 (Recommandé) Se connecter avec une clé plutôt qu'un mot de passe

Plus sûr, et vous n'aurez plus à taper le mot de passe à chaque publication.

**a) Créer la clé sur votre PC** (une seule fois) :

```bat
ssh-keygen -t ed25519
```

Appuyez sur Entrée à chaque question (vous pouvez choisir une « passphrase », ou laisser vide).
Deux fichiers sont créés : `%USERPROFILE%\.ssh\id_ed25519` (**privé, ne jamais le partager**) et
`%USERPROFILE%\.ssh\id_ed25519.pub` (public).

**b) Copier la clé publique sur le serveur** (Windows n'a pas `ssh-copy-id`, on fait ainsi) :

```bat
type %USERPROFILE%\.ssh\id_ed25519.pub | ssh ubuntu@148.113.238.146 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

Le mot de passe est demandé une dernière fois.

**c) Tester** : `ssh ubuntu@148.113.238.146` doit maintenant se connecter sans mot de passe.

> Si vous avez donné un autre nom à votre clé, indiquez son chemin dans `deploy.cmd`, ligne
> `set "SSH_KEY="` (par exemple `set "SSH_KEY=%USERPROFILE%\.ssh\ma_cle"`).

---

## 3. Voir le site sur votre PC avant de le publier

(Nécessite Node.js, voir 1.2.)

```bat
cd %USERPROFILE%\Documents\Hello-word\bvy-platform\apps\website
node server.js
```

Ouvrez **http://localhost:3000** dans votre navigateur. Pour arrêter : `Ctrl + C` dans la fenêtre.

---

## 4. Méthode A — publication automatique (recommandée)

Depuis le dossier du projet :

```bat
cd %USERPROFILE%\Documents\Hello-word
bvy-platform\tools\deployment\deploy.cmd
```

(Un double-clic sur `deploy.cmd` dans l'Explorateur fonctionne aussi : la fenêtre attend alors
une touche à la fin pour que vous puissiez lire les messages.)

Le script fait tout seul, en affichant chaque étape :

1. vérifie que `ssh`, `scp` et `tar` sont présents ;
2. vérifie que le site est complet (`server.js`, `public\index.html`) ;
3. régénère les pages si Node.js est installé (sinon, envoie `public\` tel quel) ;
4. crée l'archive `%TEMP%\bvy-deploy\bvy-website.tar.gz` (**sans** `data`, `.env`, `node_modules`, `test`, `src`) ;
5. l'envoie sur le serveur dans `/tmp/bvy-deploy/` ;
6. lance l'installation sur le serveur (`remote-install.sh`), qui :
   - installe Node.js 22 si besoin ;
   - crée l'utilisateur système `bvy` (sans connexion possible) ;
   - installe la nouvelle version dans `releases/<date-heure>` ;
   - crée `shared/.env` la première fois (valeurs vides) ;
   - installe et redémarre le service `bvy-website`, puis vérifie `http://127.0.0.1:3000/api/health` ;
   - **si la nouvelle version ne répond pas, remet automatiquement la version précédente** ;
   - **au premier déploiement seulement** : sauvegarde tout `/etc/nginx`, trouve l'ancienne
     configuration du site, l'archive (ainsi que l'ancien dossier du site), la désactive
     (sans rien supprimer), installe la nouvelle configuration, teste avec `nginx -t`
     (et **remet tout comme avant** si le test échoue), recharge nginx, puis vérifie que la page
     d'accueil répond — sinon il **remet aussitôt l'ancienne configuration** ;
   - le certificat HTTPS existant est retrouvé même s'il n'est pas à l'emplacement habituel
     (par exemple `/etc/letsencrypt/live/bvyaccountingtax.ca-0001/`, ou le chemin indiqué dans
     l'ancienne configuration nginx) ;
   - **sécurité** : si l'ancien site est en HTTPS mais qu'aucun certificat valide n'est trouvé, ou si
     l'ancienne configuration sert aussi **d'autres sites**, le script ne touche pas à nginx
     (l'ancien site reste en ligne) et explique quoi faire ;
   - ouvre les ports 80/443 si le pare-feu `ufw` est actif ;
   - vérifie les pages via nginx et affiche un résumé.

Si vous n'avez pas de clé SSH, le mot de passe est demandé **3 fois** (connexion, envoi, installation).
C'est normal.

À la fin, vous devez voir `✔ TERMINÉ`. Notez le dossier de sauvegarde affiché
(`/home/ubuntu/bvy-backup-<date>`) : il permet de remettre l'ancien site (section 10.3).

Options :

| Commande | Effet |
|---|---|
| `deploy.cmd` | Publie la version actuelle du projet |
| `deploy.cmd --nginx` | Publie **et** réinstalle la configuration nginx |
| `deploy.cmd --rollback` | Remet la version précédente (rien n'est envoyé) |

---

## 5. Méthode B — publication manuelle, étape par étape

Même résultat que la méthode A, mais vous tapez chaque commande vous-même.
Faites-les **dans l'ordre**. Les lignes qui commencent par `#` sont des explications : ne les tapez pas.

### 5.1 Sur votre PC (Invite de commandes)

```bat
cd %USERPROFILE%\Documents\Hello-word\bvy-platform\apps\website
dir
```

Vous devez voir `server.js`, `package.json`, `public`, `.env.example`. Créez l'archive
(sans `data`, `test`, `src`) :

```bat
tar -czf "%TEMP%\bvy-website.tar.gz" server.js package.json .env.example public
```

> Si `dir` montre d'autres fichiers ou dossiers utilisés par `server.js` (par exemple `lib`),
> ajoutez-les à la fin de cette commande. Ne mettez jamais `data` ni `.env`.

Envoyez l'archive et les modèles de configuration :

```bat
cd /d %TEMP%
scp bvy-website.tar.gz ubuntu@148.113.238.146:/tmp/
cd /d %USERPROFILE%\Documents\Hello-word\bvy-platform\tools\deployment
scp -r nginx systemd ubuntu@148.113.238.146:/tmp/
```

Connectez-vous au serveur :

```bat
ssh ubuntu@148.113.238.146
```

### 5.2 Sur le serveur — Node.js

```bash
node -v
```

Si la réponse est `v20.12` ou plus (par exemple `v22.x`), passez à 5.3. Sinon (ou « command not found ») :

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

### 5.3 Sur le serveur — utilisateur et dossiers (une seule fois)

```bash
sudo useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin bvy
sudo mkdir -p /var/www/bvy-website/releases /var/www/bvy-website/shared/data /var/www/letsencrypt
sudo chown -R bvy:bvy /var/www/bvy-website/shared/data
sudo chmod 750 /var/www/bvy-website/shared/data
```

(Si `useradd` répond « user 'bvy' already exists », c'est bon.)

### 5.4 Sur le serveur — installer la nouvelle version

```bash
V=$(date +%Y%m%d-%H%M%S)
sudo mkdir /var/www/bvy-website/releases/$V
sudo tar -xzf /tmp/bvy-website.tar.gz -C /var/www/bvy-website/releases/$V --no-same-owner
sudo chmod -R a+rX /var/www/bvy-website/releases/$V
ls /var/www/bvy-website/releases/$V
```

Vous devez voir `server.js` et `public`. Puis activez cette version :

```bash
sudo ln -sfn /var/www/bvy-website/releases/$V /var/www/bvy-website/current
```

### 5.5 Sur le serveur — fichier de réglages (une seule fois)

```bash
sudo nano /var/www/bvy-website/shared/.env
```

Tapez simplement la ligne suivante (vous la compléterez à la section 9) :

```text
LEADS_WEBHOOK_URL=
```

Enregistrez : `Ctrl + O`, Entrée, puis quittez : `Ctrl + X`. Ensuite :

```bash
sudo chown root:bvy /var/www/bvy-website/shared/.env
sudo chmod 640 /var/www/bvy-website/shared/.env
```

> N'ajoutez **pas** `PORT`, `HOST` ou `DATA_DIR` dans ce fichier : ils sont déjà réglés dans le service.

### 5.6 Sur le serveur — service Node

```bash
sudo cp /tmp/systemd/bvy-website.service /etc/systemd/system/bvy-website.service
sudo systemctl daemon-reload
sudo systemctl enable bvy-website
sudo systemctl restart bvy-website
sleep 3
curl http://127.0.0.1:3000/api/health
```

La dernière commande doit répondre quelque chose comme `{"ok":true,...}`. Sinon :
`sudo journalctl -u bvy-website -n 50` (voir la section 11).

### 5.7 Sur le serveur — nginx (la première fois seulement)

**a) Sauvegarder toute la configuration actuelle :**

```bash
sudo tar -czf ~/bvy-backup-nginx.tar.gz -C / etc/nginx
```

**b) Trouver l'ancienne configuration du site :**

```bash
ls -l /etc/nginx/sites-enabled/
sudo grep -rl "bvyaccountingtax.ca" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/
```

Pour chaque fichier trouvé, regardez où était l'ancien site :

```bash
sudo grep -n "root" /etc/nginx/sites-enabled/NOM_DU_FICHIER
```

Par exemple `root /var/www/html;`. Archivez ce dossier (remplacez le chemin, **sans** le premier `/`) :

```bash
sudo tar -czf ~/ancien-site.tar.gz -C / var/www/html
```

**c) Désactiver l'ancienne configuration** (on retire seulement le raccourci de `sites-enabled`,
le vrai fichier reste dans `sites-available`) :

```bash
sudo rm /etc/nginx/sites-enabled/NOM_DU_FICHIER
```

> ⚠ Faites `ls -l` avant : le fichier doit apparaître avec une flèche `->` (c'est un raccourci).
> S'il n'y a pas de flèche, déplacez-le au lieu de le supprimer :
> `sudo mv /etc/nginx/sites-enabled/NOM_DU_FICHIER ~/`
> Si le fichier trouvé est dans `/etc/nginx/conf.d/`, renommez-le :
> `sudo mv /etc/nginx/conf.d/NOM.conf /etc/nginx/conf.d/NOM.conf.bvy-disabled`

**d) Un certificat existe-t-il déjà ?**

```bash
sudo ls /etc/letsencrypt/live/bvyaccountingtax.ca/
```

- Vous voyez `fullchain.pem` et `privkey.pem` → utilisez la version **HTTPS** :
  `MODELE=bvyaccountingtax.ca.conf`
- « No such file or directory » → regardez d'abord `sudo certbot certificates` et les lignes
  `ssl_certificate` de l'ancienne configuration (`sudo grep -n ssl_certificate /etc/nginx/sites-available/NOM_DU_FICHIER`).
  Le certificat est peut-être ailleurs (par exemple `/etc/letsencrypt/live/bvyaccountingtax.ca-0001/`) :
  prenez alors la version **HTTPS** et, après l'étape e), corrigez les deux lignes `ssl_certificate`
  et `ssl_certificate_key` avec `sudo nano`.
- Seulement s'il n'y a **vraiment aucun** certificat **et** que l'ancien site n'était pas en HTTPS →
  version **HTTP seul** : `MODELE=bvyaccountingtax.ca.http-only.conf`
  (⚠ installer la version HTTP seul à la place d'un site HTTPS rendrait le site inaccessible aux
  visiteurs qui arrivent en `https://`.)

Tapez la ligne `MODELE=...` qui vous concerne, puis :

**e) Installer la nouvelle configuration :**

Si le dossier `/etc/nginx/sites-available` existe (cas habituel sur Ubuntu) :

```bash
sudo cp /tmp/nginx/$MODELE /etc/nginx/sites-available/bvy-website.conf
sudo ln -sfn /etc/nginx/sites-available/bvy-website.conf /etc/nginx/sites-enabled/bvy-website.conf
```

Sinon (nginx installé depuis nginx.org, sans `sites-available`) :

```bash
sudo cp /tmp/nginx/$MODELE /etc/nginx/conf.d/bvy-website.conf
```

**f) Tester, puis appliquer :**

```bash
sudo nginx -t
```

- `syntax is ok` et `test is successful` → `sudo systemctl reload nginx`
- Une erreur → **n'appliquez rien**, remettez l'ancien raccourci
  (`sudo ln -s /etc/nginx/sites-available/NOM_DU_FICHIER /etc/nginx/sites-enabled/`),
  retirez le nouveau (`sudo rm /etc/nginx/sites-enabled/bvy-website.conf`) et voyez la section 11.

> Note : sur les nginx plus anciens que 1.25, la ligne `http2 on;` provoque une erreur. Le script
> automatique corrige cela tout seul ; en manuel, supprimez les lignes `http2 on;` et écrivez
> `listen 443 ssl http2;` et `listen [::]:443 ssl http2;`.

### 5.8 Sur le serveur — pare-feu (si actif)

```bash
sudo ufw status
```

Si la réponse est `Status: active` :

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
```

### 5.9 Sur le serveur — vérification et ménage

```bash
curl -I -H "Host: bvyaccountingtax.ca" http://127.0.0.1/
rm -f /tmp/bvy-website.tar.gz
exit
```

(`200 OK` en mode HTTP seul, ou `301` vers https en mode HTTPS.)

---

## 6. Le certificat HTTPS (cadenas)

Si le script a affiché « Pas encore de certificat HTTPS », le site fonctionne mais en `http://`.
**Avant** d'obtenir le certificat, le domaine doit pointer vers le serveur (section 7).

Connectez-vous (`ssh ubuntu@148.113.238.146`), puis :

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bvyaccountingtax.ca -d www.bvyaccountingtax.ca
```

Répondez aux questions (adresse e-mail pour les alertes d'expiration, accepter les conditions).
Certbot obtient le certificat **et modifie lui-même** le fichier `bvy-website.conf`.

Ensuite, relancez simplement la publication (`deploy.cmd`) : le script voit le certificat et
installe automatiquement la configuration HTTPS complète (redirections, en-têtes de sécurité).

**Variante** (certbot ne touche pas à nginx) :

```bash
sudo certbot certonly --webroot -w /var/www/letsencrypt -d bvyaccountingtax.ca -d www.bvyaccountingtax.ca
sudo bash /var/www/bvy-website/shared/deploy-kit/remote-install.sh --nginx
```

**Renouvellement** : automatique (tous les 60 à 90 jours). Pour le tester :

```bash
sudo certbot renew --dry-run
```

> Si l'ancien site avait déjà un certificat, le script vérifie comment il se renouvelle et vous
> prévient s'il faut une commande de correction (elle est alors affichée en jaune).

---

## 7. Vérifier le DNS du domaine

Le domaine doit pointer vers le serveur. Sur votre PC :

```bat
nslookup bvyaccountingtax.ca
nslookup www.bvyaccountingtax.ca
```

Vous devez voir l'adresse **148.113.238.146** (et éventuellement **2607:5300:205:200::3da4**).

Sinon, chez votre registraire de domaine (OVH ou autre), zone DNS de `bvyaccountingtax.ca` :

| Type | Nom | Valeur |
|---|---|---|
| A | `@` (vide) | `148.113.238.146` |
| AAAA | `@` (vide) | `2607:5300:205:200::3da4` |
| A | `www` | `148.113.238.146` |
| AAAA | `www` | `2607:5300:205:200::3da4` |

(Ou `www` en **CNAME** vers `bvyaccountingtax.ca`.) Supprimez les anciens enregistrements A/AAAA
qui pointeraient ailleurs. Les changements peuvent prendre de quelques minutes à quelques heures.

> Un enregistrement AAAA erroné est une cause fréquente d'erreur de certificat : s'il existe, il
> doit bien être `2607:5300:205:200::3da4`.

---

## 8. Vérifier que tout fonctionne

Ouvrez chaque adresse (au besoin `Ctrl + F5` pour forcer le rafraîchissement) :

- [ ] https://bvyaccountingtax.ca/ — accueil, avec le cadenas
- [ ] http://bvyaccountingtax.ca/ — redirige vers `https://`
- [ ] https://www.bvyaccountingtax.ca/ — redirige vers `https://bvyaccountingtax.ca/`
- [ ] https://bvyaccountingtax.ca/services/
- [ ] https://bvyaccountingtax.ca/plateforme/
- [ ] https://bvyaccountingtax.ca/fonctionnement/
- [ ] https://bvyaccountingtax.ca/tarifs/
- [ ] https://bvyaccountingtax.ca/contact/ — envoyez un message **de test** → vous arrivez sur `/contact/merci/`
- [ ] https://bvyaccountingtax.ca/connexion/ — s'affiche (c'était une **erreur 403** sur l'ancien site)
- [ ] https://bvyaccountingtax.ca/portail-comptable/
- [ ] https://bvyaccountingtax.ca/confidentialite/
- [ ] https://bvyaccountingtax.ca/page-qui-n-existe-pas — affiche la page 404 du site BVY
- [ ] https://bvyaccountingtax.ca/robots.txt et https://bvyaccountingtax.ca/sitemap.xml
- [ ] https://bvyaccountingtax.ca/api/health — petit texte technique (`{"ok":true...}`)
- [ ] Sur téléphone : l'accueil et le menu s'affichent correctement

Tests facultatifs de sécurité : https://www.ssllabs.com/ssltest/ (note A attendue) et
https://securityheaders.com (note A attendue).

---

## 9. Recevoir les demandes du formulaire de contact

### 9.1 Où sont-elles stockées ?

Chaque demande est enregistrée sur le serveur, une ligne par demande, dans :
`/var/www/bvy-website/shared/data/leads.jsonl` — ce fichier est **conservé** à chaque mise à jour.

Voir les dernières demandes (sur le serveur) :

```bash
sudo tail -n 20 /var/www/bvy-website/shared/data/leads.jsonl
```

Copier le fichier sur votre PC (depuis l'Invite de commandes Windows) :

```bat
ssh ubuntu@148.113.238.146 "sudo cat /var/www/bvy-website/shared/data/leads.jsonl" > %USERPROFILE%\Documents\leads.jsonl
```

> Ce fichier contient des données personnelles (noms, courriels, téléphones) : ne le partagez pas
> et supprimez les copies inutiles (Loi 25 du Québec).

### 9.2 Être prévenu automatiquement (n8n, e-mail…)

1. Dans n8n (ou Zapier, Make…), créez un flux qui commence par un nœud **Webhook** (méthode POST),
   puis, par exemple, un nœud **Send Email** vers votre adresse. Copiez l'**URL de production** du webhook.
2. Sur le serveur :

   ```bash
   sudo nano /var/www/bvy-website/shared/.env
   ```

   Complétez la ligne (sans espaces ni guillemets) :

   ```text
   LEADS_WEBHOOK_URL=https://votre-n8n.exemple.com/webhook/xxxxxxxx
   ```

   `Ctrl + O`, Entrée, `Ctrl + X`.
3. Redémarrez le service pour prendre en compte le changement :

   ```bash
   sudo systemctl restart bvy-website
   ```

4. Envoyez un message de test depuis https://bvyaccountingtax.ca/contact/ et vérifiez qu'il arrive
   dans n8n. En cas de souci : `sudo journalctl -u bvy-website -n 50`.

Même si le webhook ne répond pas, la demande reste enregistrée dans `leads.jsonl`.

> L'URL du webhook est un secret : elle ne doit être que dans ce fichier `.env` du serveur,
> jamais dans le code ni sur GitHub.

---

## 10. Mettre à jour, revenir en arrière, remettre l'ancien site

### 10.1 Publier une nouvelle version

```bat
cd %USERPROFILE%\Documents\Hello-word
git pull
bvy-platform\tools\deployment\deploy.cmd
```

(Sans Git : téléchargez un nouveau ZIP, puis lancez `deploy.cmd` depuis ce nouveau dossier.)

Les demandes de contact (`shared/data`) et les réglages (`shared/.env`) ne sont jamais touchés.
La configuration nginx n'est pas modifiée lors des mises à jour (sauf avec `--nginx`, ou pour
passer automatiquement en HTTPS quand un certificat vient d'apparaître).

### 10.2 Revenir à la version précédente

Depuis Windows :

```bat
bvy-platform\tools\deployment\deploy.cmd --rollback
```

Ou directement sur le serveur :

```bash
sudo bash /var/www/bvy-website/shared/deploy-kit/remote-install.sh --rollback
```

Les 5 dernières versions sont gardées ; chaque `--rollback` recule d'une version.
Pour revenir à la plus récente, republiez simplement.

### 10.3 Remettre l'ancien site (avant BVY)

Au premier déploiement, le script a créé `/home/ubuntu/bvy-backup-<date-heure>/` contenant :

| Fichier | Contenu |
|---|---|
| `nginx.tar.gz` | toute la configuration `/etc/nginx` d'avant |
| `configs-anciennes/` | copie des anciennes configurations du site |
| `ancien-site_....tar.gz` | copie de l'ancien dossier du site (s'il existait) |
| `RESTAURER-ANCIEN-SITE.sh` | remet l'ancienne configuration nginx en service |

Pour remettre l'ancien site :

```bash
ls -d /home/ubuntu/bvy-backup-*
sudo bash /home/ubuntu/bvy-backup-AAAAMMJJ-HHMMSS/RESTAURER-ANCIEN-SITE.sh
sudo systemctl disable --now bvy-website
```

(Choisissez le **plus ancien** dossier `bvy-backup-...` qui contient `RESTAURER-ANCIEN-SITE.sh`.)
L'ancien dossier du site n'a jamais été modifié ; l'archive `ancien-site_...tar.gz` n'est
qu'une sécurité supplémentaire.

---

## 11. Dépannage

Commandes de diagnostic (sur le serveur) :

```bash
sudo systemctl status bvy-website        # le programme Node tourne-t-il ?
sudo journalctl -u bvy-website -n 100    # ses derniers messages
sudo nginx -t                            # la configuration nginx est-elle valide ?
sudo tail -n 50 /var/log/nginx/bvy-website.error.log
sudo ss -ltnp | grep -E ':80 |:443 |:3000 '   # qui utilise les ports ?
```

| Symptôme | Cause probable | Solution |
|---|---|---|
| **502 Bad Gateway** quand on envoie le formulaire (ou sur `/api/health`) | Le programme Node est arrêté ou plante | `sudo systemctl status bvy-website`, puis `sudo journalctl -u bvy-website -n 100`. Redémarrer : `sudo systemctl restart bvy-website`. Si ça persiste : `deploy.cmd --rollback`. Les pages du site restent visibles pendant ce temps. |
| **403 Forbidden** sur une page | Droits de lecture ou fichier absent | `sudo chmod -R a+rX /var/www/bvy-website/releases` ; vérifier `ls /var/www/bvy-website/current/public/connexion/`. Vérifier aussi que l'ancienne configuration est bien désactivée : `sudo grep -rl bvyaccountingtax.ca /etc/nginx/sites-enabled /etc/nginx/conf.d` ne doit montrer que `bvy-website.conf`. |
| On voit encore **l'ancien site** | Ancienne configuration encore active, ou cache | Commande `grep` ci-dessus ; `sudo nginx -t` ne doit pas afficher « conflicting server name ». Puis `Ctrl + F5` dans le navigateur. |
| **Permission denied (publickey)** | Le serveur n'accepte pas votre clé | Vérifier `SSH_KEY` dans `deploy.cmd` ; recopier la clé (section 2.1 b) en vous connectant avec le mot de passe ; ou connexion via la console KVM de l'espace client OVH. |
| **Connection timed out** / **refused** | Mauvaise adresse, serveur éteint, pare-feu | Vérifier l'adresse `148.113.238.146`, redémarrer le VPS depuis l'espace client OVH, vérifier le pare-feu réseau OVH (port 22). |
| **nginx -t** : `unknown directive "http2"` | nginx plus ancien que 1.25 | Le script automatique corrige tout seul. En manuel, voir la note de 5.7 f. |
| **nginx -t** : `cannot load certificate` | Certificat absent ou chemin différent | Le script a remis l'ancienne configuration. `sudo certbot certificates` et `sudo ls /etc/letsencrypt/live/` pour trouver le bon chemin ; si aucun certificat n'existe, faire la section 6. |
| Le script dit « aucun certificat valide » et ne modifie pas nginx | L'ancien site est en HTTPS mais son certificat est introuvable, expiré depuis longtemps ou ne couvre pas `bvyaccountingtax.ca` | L'ancien site reste en ligne. `sudo certbot certificates` ; obtenir/renouveler le certificat (section 6, variante `certonly --webroot`), puis `sudo bash /var/www/bvy-website/shared/deploy-kit/remote-install.sh --nginx`. |
| Le script dit « sert aussi d'autres sites » | L'ancienne configuration contient aussi un autre domaine | L'ancien site reste en ligne. Retirer les blocs `server` de `bvyaccountingtax.ca` de ce fichier (faire une copie avant), `sudo nginx -t`, puis relancer avec `--nginx`. En cas de doute, demander de l'aide. |
| **nginx -t** : `duplicate listen options for [::]:80` ou `a duplicate default server` | Une autre configuration déclare les mêmes options | Le script a remis l'ancienne configuration. Envoyer le message complet à votre prestataire, ou retirer `ipv6only=on` / `default_server` du fichier signalé. |
| **Port 80 déjà utilisé** (`bind() to 0.0.0.0:80 failed`) | Apache ou un autre programme occupe le port | `sudo ss -ltnp \| grep ':80 '`. Si c'est Apache : `sudo systemctl disable --now apache2`, puis `sudo systemctl restart nginx`. |
| **Port 3000 déjà utilisé** (message du script) | L'ancien site utilisait peut-être Node sur ce port | `sudo ss -ltnp \| grep ':3000 '` pour trouver le programme, l'arrêter, puis relancer la publication. |
| **certbot** échoue (`Timeout during connect`, `unauthorized`, `NXDOMAIN`) | DNS pas encore à jour, AAAA erroné, port 80 fermé | Section 7 (`nslookup`) ; `sudo ufw status` ; attendre la propagation DNS ; réessayer. Vérifier `http://bvyaccountingtax.ca/.well-known/acme-challenge/test` → doit donner une 404 **de nginx** (et non une erreur de connexion). |
| **certbot** : `too many certificates already issued` | Trop d'essais (limite Let's Encrypt) | Attendre (jusqu'à une semaine) ; tester avec `--dry-run` avant. |
| Le formulaire répond, mais rien n'arrive dans n8n | `LEADS_WEBHOOK_URL` absent ou faux | Section 9.2 ; `sudo journalctl -u bvy-website -n 50` ; les demandes restent dans `leads.jsonl`. |
| `deploy.cmd` : « ssh n'est pas reconnu » | Client OpenSSH non installé | Section 1.1. |
| `deploy.cmd` : « Le site est introuvable » | Mauvaise branche git ou ZIP incomplet | `git checkout claude/competence-marketing-pro-hvz21k` puis `git pull`. |
| `sudo` demande un mot de passe | Normal sur certains serveurs | C'est le mot de passe de l'utilisateur `ubuntu`. |
