#!/usr/bin/env bash
# =============================================================================
#  BVY Accounting & Tax Services — installation / mise à jour du site public
#  À lancer SUR LE SERVEUR (Ubuntu), avec sudo.
#
#  Utilisation :
#    sudo bash remote-install.sh /tmp/bvy-deploy/bvy-website.tar.gz
#        -> installe une nouvelle version du site
#    sudo bash remote-install.sh /tmp/bvy-deploy/bvy-website.tar.gz --nginx
#        -> idem + réinstalle la configuration nginx
#    sudo bash remote-install.sh --nginx
#        -> réinstalle seulement la configuration nginx
#    sudo bash remote-install.sh --rollback
#        -> revient à la version précédente du site
#
#  Le script peut être relancé autant de fois que nécessaire (idempotent).
#  Les modèles nginx/ et systemd/ doivent se trouver à côté de ce script.
#
#  Organisation sur le serveur :
#    /var/www/bvy-website/releases/<date-heure>/   une version du site
#    /var/www/bvy-website/current  ->  releases/<version active>
#    /var/www/bvy-website/shared/data/             leads.jsonl (conservé)
#    /var/www/bvy-website/shared/.env              réglages (conservé)
# =============================================================================
set -euo pipefail

# ----------------------------------------------------------------------------
# Réglages
# ----------------------------------------------------------------------------
DOMAIN="bvyaccountingtax.ca"
SERVICE="bvy-website"
APP_USER="bvy"
BASE="/var/www/bvy-website"
RELEASES="$BASE/releases"
SHARED="$BASE/shared"
DATA_DIR="$SHARED/data"
CURRENT="$BASE/current"
PORT=3000
KEEP_RELEASES=5
ACME_ROOT="/var/www/letsencrypt"
MARKER="$SHARED/.nginx-installed"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
NODE_MIN="20.12.0"
UNIT_DEST="/etc/systemd/system/$SERVICE.service"
KIT_DIR="$SHARED/deploy-kit"   # copie de ce script + modèles, pour --rollback plus tard

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TPL_HTTPS="$SCRIPT_DIR/nginx/bvyaccountingtax.ca.conf"
TPL_HTTP="$SCRIPT_DIR/nginx/bvyaccountingtax.ca.http-only.conf"
TPL_UNIT="$SCRIPT_DIR/systemd/bvy-website.service"

TS="$(date +%Y%m%d-%H%M%S)"

# ----------------------------------------------------------------------------
# Affichage
# ----------------------------------------------------------------------------
if [ -t 1 ]; then G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; B=$'\033[1m'; N=$'\033[0m'
else G=""; R=""; Y=""; B=""; N=""; fi
step() { printf '\n%s== %s ==%s\n' "$B" "$*" "$N"; }
ok()   { printf '  %s✔%s %s\n' "$G" "$N" "$*"; }
ko()   { printf '  %s✖%s %s\n' "$R" "$N" "$*" >&2; }
warn() { printf '  %s!%s %s\n' "$Y" "$N" "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { ko "$*"; printf "\n%sÉCHEC — le déploiement s'est arrêté à cette étape.%s\n" "$R" "$N" >&2; exit 1; }

usage() {
  cat <<'EOF'
Utilisation :
  sudo bash remote-install.sh <archive.tar.gz> [--nginx]   installer une nouvelle version
  sudo bash remote-install.sh --nginx                      réinstaller la config nginx seulement
  sudo bash remote-install.sh --rollback                   revenir à la version précédente
EOF
}

# ----------------------------------------------------------------------------
# Arguments
# ----------------------------------------------------------------------------
ARCHIVE=""
DO_ROLLBACK=0
FORCE_NGINX=0
for arg in "$@"; do
  case "$arg" in
    --rollback) DO_ROLLBACK=1 ;;
    --nginx)    FORCE_NGINX=1 ;;
    -h|--help)  usage; exit 0 ;;
    -*)         usage; die "Option inconnue : $arg" ;;
    *)          [ -z "$ARCHIVE" ] || die "Une seule archive à la fois, svp."; ARCHIVE="$arg" ;;
  esac
done
if [ "$DO_ROLLBACK" -eq 0 ] && [ -z "$ARCHIVE" ] && [ "$FORCE_NGINX" -eq 0 ]; then
  usage; die "Indiquez l’archive à installer, ou --rollback, ou --nginx."
fi
if [ "$DO_ROLLBACK" -eq 1 ] && [ -n "$ARCHIVE" ]; then
  die "--rollback ne prend pas d’archive."
fi

# ----------------------------------------------------------------------------
# Outils
# ----------------------------------------------------------------------------
version_ge() { # version_ge A B  -> vrai si A >= B
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

current_target() { readlink -f "$CURRENT" 2>/dev/null || true; }

list_releases() { find "$RELEASES" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort; }

previous_release() { # la version juste avant la version active
  local cur prev="" d
  cur="$(current_target)"
  while IFS= read -r d; do
    [ "$d" = "$cur" ] && { printf '%s' "$prev"; return 0; }
    prev="$d"
  done < <(list_releases)
  printf '%s' "$prev"
}

switch_current() { # bascule atomique du lien « current »
  ln -sfn "$1" "$BASE/.current-tmp"
  mv -T "$BASE/.current-tmp" "$CURRENT"
}

nginx_mode() { [ -f "$MARKER" ] && head -n1 "$MARKER" || true; }

# ----------------------------------------------------------------------------
# 1. Vérifications de base
# ----------------------------------------------------------------------------
check_system() {
  step "1. Vérification du serveur"
  [ "$(id -u)" -eq 0 ] || die "Ce script doit être lancé avec sudo :  sudo bash $0 ..."
  ok "Droits administrateur (sudo)"
  if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    case "${ID:-}" in
      ubuntu) ok "Système : ${PRETTY_NAME:-Ubuntu}" ;;
      debian) warn "Système Debian (${PRETTY_NAME:-}) — prévu pour Ubuntu, on continue." ;;
      *)      die "Système non pris en charge (${PRETTY_NAME:-inconnu}). Ubuntu est requis." ;;
    esac
  else
    die "Impossible de lire /etc/os-release (Ubuntu requis)."
  fi
  if ! command -v curl >/dev/null 2>&1; then
    info "Installation de curl..."
    apt-get update -qq && apt-get install -y -qq curl ca-certificates >/dev/null
  fi
  ok "curl disponible"
}

# ----------------------------------------------------------------------------
# 2. Node.js >= 20.12
# ----------------------------------------------------------------------------
ensure_node() {
  step "2. Node.js"
  local v=""
  if [ -x /usr/bin/node ]; then v="$(/usr/bin/node -v 2>/dev/null | sed 's/^v//')"; fi
  if [ -n "$v" ] && version_ge "$v" "$NODE_MIN"; then
    ok "Node.js $v déjà installé (/usr/bin/node)"
    return 0
  fi
  if [ -n "$v" ]; then warn "Node.js $v trop ancien (minimum $NODE_MIN) — mise à jour vers Node 22."
  else info "Node.js absent de /usr/bin/node — installation de Node 22 (NodeSource)..."; fi
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg >/dev/null
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null \
    || die "Impossible d’ajouter le dépôt NodeSource (Internet ? DNS ?)."
  apt-get install -y nodejs >/dev/null || die "apt-get install nodejs a échoué."
  [ -x /usr/bin/node ] || die "Installation de Node.js échouée."
  v="$(/usr/bin/node -v | sed 's/^v//')"
  version_ge "$v" "$NODE_MIN" || die "Node.js $v installé, mais $NODE_MIN minimum est requis."
  ok "Node.js $v installé"
}

# ----------------------------------------------------------------------------
# 3. Utilisateur système et dossiers
# ----------------------------------------------------------------------------
ensure_user_and_layout() {
  step "3. Utilisateur « $APP_USER » et dossiers"
  if id -u "$APP_USER" >/dev/null 2>&1; then
    ok "Utilisateur système « $APP_USER » existe déjà"
  else
    useradd --system --user-group --no-create-home --home-dir /nonexistent \
            --shell /usr/sbin/nologin "$APP_USER"
    ok "Utilisateur système « $APP_USER » créé (sans connexion possible)"
  fi
  mkdir -p "$RELEASES" "$DATA_DIR" "$ACME_ROOT"
  chmod 755 /var/www "$BASE" "$RELEASES" "$SHARED" "$ACME_ROOT"
  chown root:root "$BASE" "$RELEASES" "$SHARED"
  chown -R "$APP_USER:$APP_USER" "$DATA_DIR"
  chmod 750 "$DATA_DIR"
  ok "Dossiers prêts : $BASE/{releases,shared/data}"
  ok "Les contacts reçus sont conservés dans $DATA_DIR"
}

# ----------------------------------------------------------------------------
# 4. Extraction de la nouvelle version
# ----------------------------------------------------------------------------
NEW_RELEASE=""
extract_release() {
  step "4. Nouvelle version du site"
  [ -f "$ARCHIVE" ] || die "Archive introuvable : $ARCHIVE"
  gzip -t "$ARCHIVE" 2>/dev/null || die "Archive corrompue (transfert incomplet ?) : $ARCHIVE"
  NEW_RELEASE="$RELEASES/$TS"
  if [ -e "$NEW_RELEASE" ]; then NEW_RELEASE="$NEW_RELEASE-$$"; fi
  mkdir -p "$NEW_RELEASE"
  tar -xzf "$ARCHIVE" -C "$NEW_RELEASE" --no-same-owner --no-same-permissions \
      --warning=no-unknown-keyword 2>/dev/null \
    || { rm -rf "$NEW_RELEASE"; die "Impossible de décompresser l’archive."; }

  # Archive faite « avec un dossier autour » ? On remonte son contenu.
  if [ ! -f "$NEW_RELEASE/server.js" ]; then
    local inner
    inner="$(find "$NEW_RELEASE" -mindepth 2 -maxdepth 2 -name server.js -printf '%h\n' | head -n1)"
    if [ -n "$inner" ]; then
      shopt -s dotglob; mv "$inner"/* "$NEW_RELEASE"/; shopt -u dotglob
      rmdir "$inner" 2>/dev/null || true
    fi
  fi
  if [ ! -f "$NEW_RELEASE/server.js" ] || [ ! -f "$NEW_RELEASE/public/index.html" ]; then
    rm -rf "$NEW_RELEASE"
    die "L’archive ne contient pas server.js et public/index.html — ce n’est pas le bon dossier."
  fi
  # Sécurité : jamais de données ni de secrets dans une version
  rm -rf "$NEW_RELEASE/data" "$NEW_RELEASE/.env"
  chown -R root:root "$NEW_RELEASE"
  find "$NEW_RELEASE" -type d -exec chmod 755 {} +
  find "$NEW_RELEASE" -type f -exec chmod 644 {} +
  ok "Version extraite dans $NEW_RELEASE"
}

# ----------------------------------------------------------------------------
# 5. Fichier de réglages .env (créé une seule fois, jamais écrasé)
# ----------------------------------------------------------------------------
ensure_env() {
  step "5. Réglages (.env)"
  local envf="$SHARED/.env"
  if [ -f "$envf" ]; then
    ok "$envf existe déjà — conservé tel quel"
    if grep -Eq '^[[:space:]]*(PORT|HOST|DATA_DIR)[[:space:]]*=' "$envf"; then
      warn "$envf définit PORT, HOST ou DATA_DIR : cela remplace les valeurs du service."
      warn "Laissez plutôt ces lignes en commentaire (# devant)."
    fi
  else
    {
      echo "# Réglages du site BVY sur ce serveur — créé le $(date '+%Y-%m-%d %H:%M')"
      echo "# Modifier :  sudo nano $envf    puis :  sudo systemctl restart $SERVICE"
      echo "# NE JAMAIS copier ce fichier dans Git."
      echo "# NODE_ENV, PORT, HOST, TRUST_PROXY et DATA_DIR sont déjà réglés par le"
      echo "# service systemd : laissez-les en commentaire ci-dessous."
      echo
      if [ -n "$NEW_RELEASE" ] && [ -f "$NEW_RELEASE/.env.example" ]; then
        tr -d '\r' < "$NEW_RELEASE/.env.example" | while IFS= read -r line; do
          if [[ "$line" =~ ^[[:space:]]*(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*= ]]; then
            key="${BASH_REMATCH[2]}"
            case "$key" in
              NODE_ENV|PORT|HOST|TRUST_PROXY|DATA_DIR) echo "# $key=" ;;
              *) echo "$key=" ;;
            esac
          else
            echo "$line"
          fi
        done
      else
        echo "# Adresse (webhook n8n, Zapier, Make...) qui reçoit chaque demande de contact :"
        echo "LEADS_WEBHOOK_URL="
      fi
    } > "$envf"
    ok "$envf créé (valeurs vides, à compléter si besoin)"
  fi
  chown root:"$APP_USER" "$envf"
  chmod 640 "$envf"
}

# ----------------------------------------------------------------------------
# 6. Service systemd
# ----------------------------------------------------------------------------
install_unit() {
  step "6. Service systemd « $SERVICE »"
  if [ -f "$TPL_UNIT" ]; then
    tr -d '\r' < "$TPL_UNIT" > "$UNIT_DEST.tmp"
    chmod 644 "$UNIT_DEST.tmp"
    mv -f "$UNIT_DEST.tmp" "$UNIT_DEST"
    ok "Fichier installé : $UNIT_DEST"
  elif [ -f "$UNIT_DEST" ]; then
    warn "Modèle $TPL_UNIT absent — on garde le service déjà installé."
  else
    die "Modèle systemd introuvable : $TPL_UNIT"
  fi
  systemctl daemon-reload
  systemctl enable "$SERVICE" >/dev/null 2>&1
  ok "Service activé au démarrage du serveur"
}

port_is_free_or_ours() {
  local line mp
  line="$(ss -ltnpH "( sport = :$PORT )" 2>/dev/null || true)"
  [ -z "$line" ] && return 0
  mp="$(systemctl show -p MainPID --value "$SERVICE" 2>/dev/null || echo 0)"
  if [ -n "$mp" ] && [ "$mp" != "0" ] && grep -q "pid=$mp," <<<"$line"; then return 0; fi
  ko "Le port $PORT est déjà utilisé par un autre programme :"
  info "$line"
  info "Arrêtez ce programme (peut-être l’ancien site) ou libérez le port, puis relancez."
  return 1
}

restart_and_check() { # redémarre Node et attend /api/health
  systemctl restart "$SERVICE" 2>/dev/null || true
  local i
  for i in $(seq 1 20); do
    if curl --noproxy "*" -fsS --max-time 2 "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# ----------------------------------------------------------------------------
# 7. Bascule vers la nouvelle version (avec retour arrière automatique)
# ----------------------------------------------------------------------------
activate_release() {
  step "7. Mise en ligne de la nouvelle version"
  port_is_free_or_ours || die "Port $PORT occupé."
  local prev
  prev="$(current_target)"
  switch_current "$NEW_RELEASE"
  ok "« current » pointe maintenant vers $(basename "$NEW_RELEASE")"
  if restart_and_check; then
    ok "Node répond : http://127.0.0.1:$PORT/api/health"
    return 0
  fi
  ko "La nouvelle version ne répond pas sur /api/health."
  journalctl -u "$SERVICE" -n 25 --no-pager 2>/dev/null | sed 's/^/      /' || true
  if [ -n "$prev" ] && [ -d "$prev" ] && [ "$prev" != "$NEW_RELEASE" ]; then
    warn "Retour automatique à la version précédente : $(basename "$prev")"
    switch_current "$prev"
    if restart_and_check; then ok "Version précédente rétablie et fonctionnelle."
    else ko "La version précédente ne répond pas non plus."; fi
    rm -rf "$NEW_RELEASE"
    info "(La version défectueuse $(basename "$NEW_RELEASE") a été supprimée.)"
  else
    warn "Aucune version précédente pour revenir en arrière."
  fi
  die "Déploiement annulé. Journal complet :  sudo journalctl -u $SERVICE -n 100"
}

# ----------------------------------------------------------------------------
# 8. nginx
# ----------------------------------------------------------------------------
NGX_LAYOUT=""; NGX_CONF=""; NGX_LINK=""
detect_nginx_layout() {
  if [ -d /etc/nginx/sites-enabled ] && grep -Eqs '^[^#]*include[^;]*sites-enabled' /etc/nginx/nginx.conf; then
    NGX_LAYOUT="debian"
    NGX_CONF="/etc/nginx/sites-available/bvy-website.conf"
    NGX_LINK="/etc/nginx/sites-enabled/bvy-website.conf"
    mkdir -p /etc/nginx/sites-available
  else
    NGX_LAYOUT="confd"
    NGX_CONF="/etc/nginx/conf.d/bvy-website.conf"
    NGX_LINK=""
    mkdir -p /etc/nginx/conf.d
  fi
}

sed_esc() { printf '%s' "$1" | sed -e 's/[\\#&]/\\&/g'; }

render_conf() { # render_conf <modèle>  -> stdout
  # Adapte le modèle au serveur : chemin réel du certificat, dossier ACME déjà
  # utilisé par certbot, http2 si nginx < 1.25.1, IPv6 absent.
  local tpl="$1" ver
  local -a ed=()
  ver="$(nginx -v 2>&1 | sed -nE 's|.*nginx/([0-9.]+).*|\1|p')"
  if [ -n "$ver" ] && ! version_ge "$ver" "1.25.1"; then
    ed+=(-e '/^[[:space:]]*http2 on;/d' -e 's/listen (\[::\]:)?443 ssl;/listen \1443 ssl http2;/')
  fi
  if [ ! -e /proc/net/if_inet6 ]; then
    ed+=(-e '/^[[:space:]]*listen[[:space:]]+\[::\]/d')   # IPv6 désactivé : nginx -t échouerait
  fi
  if [ -n "$CERT_FULLCHAIN" ]; then
    ed+=(-e "s#$CERT_DIR/fullchain\.pem#$(sed_esc "$CERT_FULLCHAIN")#"
         -e "s#$CERT_DIR/privkey\.pem#$(sed_esc "$CERT_KEY")#")
  fi
  if [ "$ACME_WEBROOT" != "$ACME_ROOT" ]; then
    ed+=(-e "s#root $ACME_ROOT;#root $(sed_esc "$ACME_WEBROOT");#")
  fi
  if [ "${#ed[@]}" -gt 0 ]; then
    tr -d '\r' < "$tpl" | sed -E "${ed[@]}"
  else
    tr -d '\r' < "$tpl"
  fi
}

# ----------------------------------------------------------------------------
# Certificat HTTPS : recherché à l'emplacement standard, puis dans les
# lignées certbot « bvyaccountingtax.ca-0001 »..., puis dans les directives
# ssl_certificate des configurations nginx actives qui mentionnent le domaine.
# ----------------------------------------------------------------------------
CERT_FULLCHAIN=""; CERT_KEY=""; CERT_LINEAGE=""; ACME_WEBROOT="$ACME_ROOT"

domain_confs() { # configurations nginx actives (hors la nôtre) qui mentionnent le domaine
  local f
  shopt -s nullglob
  for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    case "$(basename "$f")" in bvy-website.conf) continue ;; esac
    grep -qs "bvyaccountingtax\.ca" "$f" && printf '%s\n' "$f"
  done
  shopt -u nullglob
}

conf_directive() { # conf_directive <fichier> <directive> -> 1re valeur (hors commentaires)
  grep -v '^[[:space:]]*#' "$1" 2>/dev/null \
    | sed -nE "s/^[[:space:]]*$2[[:space:]]+([^;]+);.*/\1/p" | head -n1 | tr -d "\"'" \
    | sed -E 's/[[:space:]]+$//' || true
}

cert_pair_ok() { # cert_pair_ok <fullchain> <clé> [strict] -> certificat lisible, couvre le domaine
  local c="$1" k="$2"
  [ -s "$c" ] && [ -s "$k" ] || return 1
  case "$c$k" in *'$'*) return 1 ;; esac
  command -v openssl >/dev/null 2>&1 || return 0
  openssl x509 -in "$c" -noout -text 2>/dev/null | grep -Eq "DNS:${DOMAIN//./\\.}(,|[[:space:]]|$)" || return 1
  if [ "${3:-}" = "strict" ]; then openssl x509 -in "$c" -noout -checkend 0 >/dev/null 2>&1 || return 1; fi
  return 0
}

detect_cert() { # remplit CERT_FULLCHAIN / CERT_KEY ; code 0 si un certificat utilisable existe
  local -a pairs=()
  local d f c k pass i
  CERT_FULLCHAIN=""; CERT_KEY=""; CERT_LINEAGE=""
  pairs+=("$CERT_DIR/fullchain.pem|$CERT_DIR/privkey.pem")
  # notre propre configuration déjà installée (chemin retenu lors d'un déploiement précédent)
  for f in /etc/nginx/sites-available/bvy-website.conf /etc/nginx/conf.d/bvy-website.conf; do
    [ -f "$f" ] || continue
    c="$(conf_directive "$f" ssl_certificate)"; k="$(conf_directive "$f" ssl_certificate_key)"
    [ -n "$c" ] && [ -n "$k" ] && pairs+=("$c|$k")
  done
  shopt -s nullglob
  for d in /etc/letsencrypt/live/"$DOMAIN"-[0-9]* /etc/letsencrypt/live/www."$DOMAIN"*; do
    pairs+=("$d/fullchain.pem|$d/privkey.pem")
  done
  shopt -u nullglob
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    c="$(conf_directive "$f" ssl_certificate)"; k="$(conf_directive "$f" ssl_certificate_key)"
    [ -n "$c" ] && [ -n "$k" ] && pairs+=("$c|$k")
  done < <(domain_confs)
  # 1er passage : certificat valide (non expiré) ; 2e passage : n'importe lequel
  for pass in strict any; do
    for i in "${pairs[@]}"; do
      c="${i%%|*}"; k="${i#*|}"
      if cert_pair_ok "$c" "$k" "$pass"; then
        CERT_FULLCHAIN="$c"; CERT_KEY="$k"
        case "$c" in /etc/letsencrypt/live/*/*) CERT_LINEAGE="$(basename "$(dirname "$c")")" ;; esac
        detect_acme_webroot
        return 0
      fi
    done
  done
  return 1
}

detect_acme_webroot() { # si certbot renouvelle en mode « webroot », on sert SON dossier
  ACME_WEBROOT="$ACME_ROOT"
  local rc="/etc/letsencrypt/renewal/${CERT_LINEAGE:-$DOMAIN}.conf" auth wr
  [ -f "$rc" ] || return 0
  auth="$(sed -nE 's/^[[:space:]]*authenticator[[:space:]]*=[[:space:]]*(.*)$/\1/p' "$rc" | head -n1 || true)"
  wr="$(sed -nE 's/^[[:space:]]*webroot_path[[:space:]]*=[[:space:]]*([^,]*).*/\1/p' "$rc" | head -n1 || true)"
  wr="${wr%/}"
  if [ "$auth" = "webroot" ] && [ -n "$wr" ] && [ -d "$wr" ]; then
    case "$wr" in *[[:space:]\;\'\"\$]*) return 0 ;; esac
    ACME_WEBROOT="$wr"
  fi
}

cert_ok() { detect_cert; }

old_site_uses_https() { # une config active du domaine écoute déjà en HTTPS ?
  local f
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if grep -v '^[[:space:]]*#' "$f" | grep -Eq '(listen[^;]*443|ssl_certificate[[:space:]])'; then return 0; fi
  done < <(domain_confs)
  return 1
}

print_certbot_help() {
  info "Pour obtenir le certificat HTTPS (quand le DNS pointe vers ce serveur) :"
  info "  sudo apt install -y certbot python3-certbot-nginx"
  info "  sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
  info "  (certbot modifiera lui-même le fichier $NGX_CONF)"
  info "ou, sans que certbot touche à nginx :"
  info "  sudo certbot certonly --webroot -w $ACME_ROOT -d $DOMAIN -d www.$DOMAIN"
  info "puis relancez le déploiement (ou :  sudo bash $KIT_DIR/remote-install.sh --nginx )"
  info "pour passer à la configuration HTTPS complète."
}

check_cert_details() {
  local cn=""; [ -n "$CERT_LINEAGE" ] && cn=" --cert-name $CERT_LINEAGE"
  info "Certificat utilisé : $CERT_FULLCHAIN"
  if command -v openssl >/dev/null 2>&1; then
    if ! openssl x509 -in "$CERT_FULLCHAIN" -noout -text 2>/dev/null | grep -q "DNS:www.$DOMAIN"; then
      warn "Le certificat ne couvre pas www.$DOMAIN (www affichera une alerte)."
      info "Pour l’ajouter :  sudo certbot certonly --webroot -w $ACME_WEBROOT$cn -d $DOMAIN -d www.$DOMAIN --expand"
    fi
    if ! openssl x509 -in "$CERT_FULLCHAIN" -noout -checkend 0 >/dev/null 2>&1; then
      warn "Le certificat est EXPIRÉ. Renouvelez-le :  sudo certbot renew"
    fi
  fi
  [ "$ACME_WEBROOT" != "$ACME_ROOT" ] && info "Validation Let’s Encrypt servie depuis le dossier de certbot : $ACME_WEBROOT"
  local rc="/etc/letsencrypt/renewal/${CERT_LINEAGE:-$DOMAIN}.conf"
  if [ -f "$rc" ]; then
    local auth wr
    auth="$(sed -nE 's/^[[:space:]]*authenticator[[:space:]]*=[[:space:]]*(.*)$/\1/p' "$rc" | head -n1)"
    wr="$(sed -nE 's/^[[:space:]]*webroot_path[[:space:]]*=[[:space:]]*([^,]*).*/\1/p' "$rc" | head -n1)"
    if [ "$auth" = "standalone" ]; then
      warn "Le renouvellement automatique du certificat utilise le mode « standalone »,"
      warn "qui échoue quand nginx tourne. Corrigez-le une fois avec :"
      info "  sudo certbot certonly --webroot -w $ACME_ROOT$cn -d $DOMAIN -d www.$DOMAIN --force-renewal"
    elif [ "$auth" = "webroot" ] && [ -n "$wr" ] && [ "${wr%/}" != "$ACME_WEBROOT" ]; then
      warn "Le renouvellement du certificat utilise le dossier « $wr », introuvable ou inutilisable."
      warn "Il faut le rediriger une fois vers $ACME_ROOT :"
      info "  sudo certbot certonly --webroot -w $ACME_ROOT$cn -d $DOMAIN -d www.$DOMAIN --force-renewal"
    else
      ok "Renouvellement du certificat : mode « ${auth:-inconnu} » (compatible)"
    fi
    info "Test du renouvellement (facultatif) :  sudo certbot renew --dry-run"
  fi
}

# Retour arrière de la config nginx si « nginx -t » échoue
declare -a NGX_MOVED_FROM=() NGX_MOVED_TO=()
NGX_PREV_COPY=""; NGX_LINK_EXISTED=0
nginx_undo() {
  local i
  if [ -n "$NGX_PREV_COPY" ] && [ -f "$NGX_PREV_COPY" ]; then
    cp -f "$NGX_PREV_COPY" "$NGX_CONF"
  else
    rm -f "$NGX_CONF"
  fi
  if [ -n "$NGX_LINK" ] && [ "$NGX_LINK_EXISTED" -eq 0 ]; then rm -f "$NGX_LINK"; fi
  for i in "${!NGX_MOVED_TO[@]}"; do
    mv -f "${NGX_MOVED_TO[$i]}" "${NGX_MOVED_FROM[$i]}" 2>/dev/null || true
  done
}

install_nginx() {
  local mode="$1"
  step "8. Configuration nginx (${mode^^})"
  command -v nginx >/dev/null 2>&1 || { info "nginx absent — installation..."; apt-get install -y -qq nginx >/dev/null; }
  detect_nginx_layout
  local tpl="$TPL_HTTPS"; [ "$mode" = "http" ] && tpl="$TPL_HTTP"
  [ -f "$tpl" ] || die "Modèle nginx introuvable : $tpl (lancez le script depuis le dossier envoyé)"

  # --- Sauvegarde complète de /etc/nginx ---------------------------------
  local home="/home/ubuntu"; [ -d "$home" ] || home="/root"
  local bk="$home/bvy-backup-$TS"
  mkdir -p "$bk"
  tar -czf "$bk/nginx.tar.gz" -C / etc/nginx
  ok "Sauvegarde de /etc/nginx : $bk/nginx.tar.gz"
  if [ -f "$NGX_CONF" ]; then
    NGX_PREV_COPY="$bk/bvy-website.conf.avant"
    cp -f "$NGX_CONF" "$NGX_PREV_COPY"
  fi
  if [ -n "$NGX_LINK" ] && [ -e "$NGX_LINK" ]; then NGX_LINK_EXISTED=1; fi

  # --- Ancien(s) site(s) qui répondent pour le domaine --------------------
  local f name old_roots="" r
  local -a candidates=()
  shopt -s nullglob
  for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
    case "$(basename "$f")" in bvy-website.conf) continue ;; esac
    if grep -qs "bvyaccountingtax\.ca" "$f"; then candidates+=("$f"); fi
  done
  shopt -u nullglob

  # Une ancienne configuration qui sert AUSSI d'autres sites ne doit pas être
  # désactivée d'office : ces autres sites tomberaient.
  local others
  for f in "${candidates[@]}"; do
    others="$(grep -v '^[[:space:]]*#' "$f" | sed -nE 's/^[[:space:]]*server_name[[:space:]]+([^;]+);.*/\1/p' \
              | tr -s '[:space:]' '\n' | grep -Ev "^(|_|localhost|$DOMAIN|www\.$DOMAIN|[0-9.]+|\[.*\])$" | sort -u | tr '\n' ' ' || true)"
    if [ -n "$others" ]; then
      ko "$f sert aussi d’autres sites : $others"
      info "Le désactiver couperait ces sites. Rien n’a été modifié côté nginx ;"
      info "l’ancien site reste en ligne. Retirez $DOMAIN de ce fichier (ou demandez"
      info "de l’aide), puis relancez avec l’option --nginx."
      die "Configuration nginx partagée avec d’autres sites."
    fi
  done

  if [ "${#candidates[@]}" -eq 0 ]; then
    ok "Aucune autre configuration active ne mentionne $DOMAIN"
  else
    mkdir -p "$bk/configs-anciennes" "$bk/desactives-sites-enabled"
    for f in "${candidates[@]}"; do
      name="$(basename "$f")"
      cp -fL "$f" "$bk/configs-anciennes/$name" 2>/dev/null || true
      info "Ancienne configuration trouvée : $f"
      if [ -L "$f" ]; then info "   (lien vers $(readlink -f "$f"))"; fi
      while IFS= read -r r; do
        [ -n "$r" ] || continue
        info "   dossier « root » de l’ancien site : $r"
        old_roots+="$r"$'\n'
      done < <(grep -v '^[[:space:]]*#' "$f" | grep -oE '(^|[;{[:space:]])root[[:space:]]+[^;]+;' \
                 | sed -E 's/.*root[[:space:]]+//; s/;$//' | tr -d "\"'" | sort -u || true)
      while IFS= read -r r; do
        [ -n "$r" ] && info "   l’ancien site utilisait aussi : proxy_pass $r"
      done < <(grep -v '^[[:space:]]*#' "$f" | grep -oE 'proxy_pass[[:space:]]+[^;]+;' \
                 | sed -E 's/proxy_pass[[:space:]]+//; s/;$//' | sort -u || true)
    done

    # Copie de sécurité des anciens dossiers du site
    while IFS= read -r r; do
      [ -n "$r" ] || continue
      case "$r" in /|/var|/var/www|/home|/usr|/etc|"$BASE"*|*'$'*) info "   (dossier $r non archivé)"; continue ;; esac
      if [ -d "$r" ]; then
        local arch; arch="$bk/ancien-site$(echo "$r" | tr '/' '_').tar.gz"
        if tar -czf "$arch" -C / "${r#/}" 2>/dev/null; then
          ok "Ancien site archivé : $arch"
        else
          warn "Archivage partiel de $r (voir $arch)"
        fi
      fi
    done < <(printf '%s' "$old_roots" | sort -u)

    # Désactivation (jamais de suppression dans sites-available)
    for f in "${candidates[@]}"; do
      name="$(basename "$f")"
      if [[ "$f" == /etc/nginx/sites-enabled/* ]]; then
        mv -f "$f" "$bk/desactives-sites-enabled/$name"
        NGX_MOVED_FROM+=("$f"); NGX_MOVED_TO+=("$bk/desactives-sites-enabled/$name")
        ok "Désactivé : $f (le fichier de sites-available n’est pas touché)"
      else
        mv -f "$f" "$f.bvy-disabled"
        NGX_MOVED_FROM+=("$f"); NGX_MOVED_TO+=("$f.bvy-disabled")
        ok "Désactivé : $f  ->  $f.bvy-disabled"
      fi
    done
  fi

  # --- Installation de notre configuration -------------------------------
  mkdir -p "$ACME_ROOT"; chmod 755 "$ACME_ROOT"
  render_conf "$tpl" > "$NGX_CONF.tmp"
  chmod 644 "$NGX_CONF.tmp"
  mv -f "$NGX_CONF.tmp" "$NGX_CONF"
  [ -n "$NGX_LINK" ] && ln -sfn "$NGX_CONF" "$NGX_LINK"
  ok "Configuration installée : $NGX_CONF"

  # --- Test de la configuration ---------------------------------------------
  local out
  if ! out="$(nginx -t 2>&1)"; then
    printf '%s\n' "$out" | sed 's/^/      /'
    nginx_undo
    ko "nginx -t a échoué : l’ancienne configuration a été remise en place."
    die "Rien n’a changé côté nginx. Sauvegardes dans $bk"
  fi
  ok "nginx -t : configuration valide"
  if grep -q "conflicting server name" <<<"$out"; then
    warn "nginx signale un « conflicting server name » :"
    grep "conflicting server name" <<<"$out" | sed 's/^/      /'
    warn "Une autre configuration répond encore pour $DOMAIN. Cherchez-la avec :"
    info "  sudo grep -rn \"$DOMAIN\" /etc/nginx/"
  fi

  if systemctl is-active --quiet nginx; then systemctl reload nginx; else systemctl restart nginx; fi
  ok "nginx rechargé"

  # --- Le site répond-il vraiment ? Sinon : retour immédiat à l'ancienne config
  local url code i
  if [ "$mode" = "https" ]; then url="https://$DOMAIN/"; else url="http://$DOMAIN/"; fi
  for i in 1 2 3 4 5; do
    sleep 1
    code="$(curl --noproxy "*" -sk -o /dev/null -w '%{http_code}' --max-time 5 \
             --resolve "$DOMAIN:443:127.0.0.1" --resolve "$DOMAIN:80:127.0.0.1" "$url" || true)"
    [ "$code" = "200" ] && break
  done
  if [ "$code" != "200" ]; then
    ko "$url répond « ${code:-rien} » au lieu de 200 avec la nouvelle configuration."
    nginx_undo
    if nginx -t >/dev/null 2>&1; then systemctl reload nginx || true; fi
    die "Ancienne configuration nginx remise en place (le site d’avant reste en ligne). Sauvegardes dans $bk"
  fi
  ok "$url répond (200)"

  # --- Script pour remettre l'ancien site ---------------------------------
  if [ "${#candidates[@]}" -eq 0 ]; then
    rmdir "$bk/configs-anciennes" "$bk/desactives-sites-enabled" 2>/dev/null || true
    info "Le script de retour à l’ancien site créé lors du PREMIER déploiement reste valable :"
    info "  ls /home/ubuntu/bvy-backup-*/RESTAURER-ANCIEN-SITE.sh"
  else
  {
    echo "#!/usr/bin/env bash"
    echo "# Remet en service l'ancienne configuration nginx (sauvegardée le $TS)."
    echo "# Utilisation :  sudo bash $bk/RESTAURER-ANCIEN-SITE.sh"
    echo "set -e"
    if [ "$NGX_LAYOUT" = "debian" ]; then
      echo "rm -f '$NGX_LINK'"
    else
      echo "mv -f '$NGX_CONF' '$NGX_CONF.bvy-disabled'"
    fi
    local i
    for i in "${!NGX_MOVED_TO[@]}"; do
      echo "mv -f '${NGX_MOVED_TO[$i]}' '${NGX_MOVED_FROM[$i]}'"
    done
    echo "nginx -t && systemctl reload nginx"
    echo "echo 'Ancienne configuration nginx rétablie.'"
    echo "echo 'Pour arrêter aussi le nouveau service :  sudo systemctl disable --now $SERVICE'"
  } > "$bk/RESTAURER-ANCIEN-SITE.sh"
  chmod 755 "$bk/RESTAURER-ANCIEN-SITE.sh"
  ok "Retour à l’ancien site possible avec :  sudo bash $bk/RESTAURER-ANCIEN-SITE.sh"
  fi
  if [ -n "${SUDO_USER:-}" ] && [ "$home" = "/home/ubuntu" ]; then chown -R "$SUDO_USER": "$bk" 2>/dev/null || true; fi

  printf '%s\n%s\n%s\n' "$mode" "$NGX_CONF" "$TS" > "$MARKER"

  if [ "$mode" = "https" ]; then
    check_cert_details
  else
    warn "Pas encore de certificat HTTPS : le site est servi en HTTP seulement."
    print_certbot_help
  fi
}

maybe_nginx() {
  local mode want="https"
  cert_ok || want="http"
  mode="$(nginx_mode)"
  if [ "$want" = "http" ] && { [ "$mode" = "https" ] || old_site_uses_https; }; then
    # Installer la version « HTTP seul » couperait l'HTTPS actuel des visiteurs
    # (et les navigateurs qui ont mémorisé HSTS ne pourraient plus ouvrir le site).
    step "8. Configuration nginx"
    warn "Le site est déjà servi en HTTPS, mais aucun certificat valide pour $DOMAIN"
    warn "n’a été trouvé (ni dans $CERT_DIR, ni dans les configurations nginx actives)."
    warn "La configuration nginx n’est PAS modifiée : l’ancien site reste en ligne."
    info "Vérifiez les certificats :  sudo certbot certificates"
    info "puis relancez :  sudo bash $KIT_DIR/remote-install.sh --nginx"
    return 0
  fi
  if [ "$FORCE_NGINX" -eq 1 ]; then
    install_nginx "$want"
  elif [ -z "$mode" ]; then
    info "Premier déploiement : installation de la configuration nginx."
    install_nginx "$want"
  elif [ "$mode" = "http" ] && [ "$want" = "https" ]; then
    info "Un certificat HTTPS est maintenant disponible : passage à la configuration HTTPS."
    install_nginx "https"
  else
    step "8. Configuration nginx"
    ok "Déjà installée (mode ${mode^^}) — non modifiée. (Option --nginx pour la réinstaller.)"
    if [ "$mode" = "http" ]; then detect_nginx_layout; print_certbot_help; fi
  fi
}

# ----------------------------------------------------------------------------
# 9. Pare-feu (seulement si ufw est actif)
# ----------------------------------------------------------------------------
ensure_firewall() {
  step "9. Pare-feu"
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    if ufw app list 2>/dev/null | grep -q "OpenSSH"; then ufw allow OpenSSH >/dev/null; else ufw allow 22/tcp >/dev/null; fi
    if ufw app list 2>/dev/null | grep -q "Nginx Full"; then ufw allow 'Nginx Full' >/dev/null
    else ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi
    ok "ufw actif : SSH, HTTP (80) et HTTPS (443) autorisés"
  else
    ok "ufw inactif — rien à faire"
  fi
}

# ----------------------------------------------------------------------------
# 10. Vérifications finales
# ----------------------------------------------------------------------------
smoke_test() {
  step "10. Vérification du site via nginx"
  local mode
  mode="$(nginx_mode)"
  if [ -z "$mode" ]; then
    warn "nginx n’est pas (encore) configuré par ce script — vérification sautée."
    return 0
  fi
  if [ "$mode" = "https" ]; then
    expect_code 200 "https://$DOMAIN/" -k --resolve "$DOMAIN:443:127.0.0.1"
    expect_code 200 "https://$DOMAIN/api/health" -k --resolve "$DOMAIN:443:127.0.0.1"
    expect_code 200 "https://$DOMAIN/connexion/" -k --resolve "$DOMAIN:443:127.0.0.1"
    expect_code 301 "http://$DOMAIN/" --resolve "$DOMAIN:80:127.0.0.1"
  else
    expect_code 200 "http://$DOMAIN/" --resolve "$DOMAIN:80:127.0.0.1"
    expect_code 200 "http://$DOMAIN/api/health" --resolve "$DOMAIN:80:127.0.0.1"
    expect_code 200 "http://$DOMAIN/connexion/" --resolve "$DOMAIN:80:127.0.0.1"
  fi
}

expect_code() { # expect_code <code attendu> <url> [options curl...]
  local want="$1" url="$2" code
  shift 2
  code="$(curl --noproxy "*" -s -o /dev/null -w '%{http_code}' --max-time 5 "$@" "$url" || true)"
  if [ "$code" = "$want" ]; then
    ok "$url -> $code"
  else
    ko "$url -> ${code:-aucune réponse} (attendu $want)"
  fi
}

save_kit() { # garde une copie du kit sur le serveur (pour --rollback / --nginx plus tard)
  [ "$SCRIPT_DIR" = "$KIT_DIR" ] && return 0
  [ -d "$SCRIPT_DIR/nginx" ] && [ -d "$SCRIPT_DIR/systemd" ] || return 0
  rm -rf "$KIT_DIR.tmp"; mkdir -p "$KIT_DIR.tmp"
  tr -d '\r' < "$SCRIPT_DIR/remote-install.sh" > "$KIT_DIR.tmp/remote-install.sh"
  cp -r "$SCRIPT_DIR/nginx" "$SCRIPT_DIR/systemd" "$KIT_DIR.tmp/"
  chmod -R go-w "$KIT_DIR.tmp"; chmod 755 "$KIT_DIR.tmp/remote-install.sh"
  rm -rf "$KIT_DIR"; mv "$KIT_DIR.tmp" "$KIT_DIR"
}

prune_releases() {
  local cur n i
  local -a all=()
  cur="$(current_target)"
  mapfile -t all < <(list_releases)
  n="${#all[@]}"
  if [ "$n" -gt "$KEEP_RELEASES" ]; then
    for ((i = 0; i < n - KEEP_RELEASES; i++)); do
      [ "${all[$i]}" = "$cur" ] && continue
      rm -rf "${all[$i]}"
    done
  fi
  ok "Anciennes versions nettoyées (on garde les $KEEP_RELEASES dernières)"
}

summary() {
  local mode url
  mode="$(nginx_mode)"
  url="https://$DOMAIN/"; [ "$mode" = "http" ] && url="http://$DOMAIN/"
  printf '\n%s============================================================%s\n' "$B" "$N"
  printf '%s  ✔ TERMINÉ%s — version active : %s\n' "$G" "$N" "$(basename "$(current_target)")"
  printf '%s============================================================%s\n' "$B" "$N"
  cat <<EOF
  Site :                 $url
  Versions installées :  $(list_releases | xargs -r -n1 basename | tr '\n' ' ')

  Commandes utiles (sur le serveur) :
    Journal en direct :        sudo journalctl -u $SERVICE -f
    État du service :          sudo systemctl status $SERVICE
    Redémarrer le service :    sudo systemctl restart $SERVICE
    Derniers contacts reçus :  sudo tail $DATA_DIR/leads.jsonl
    Réglages (webhook...) :    sudo nano $SHARED/.env
    Version précédente :       sudo bash $KIT_DIR/remote-install.sh --rollback
    Réinstaller nginx :        sudo bash $KIT_DIR/remote-install.sh --nginx
EOF
}

# ============================================================================
# Programme principal
# ============================================================================
printf '%sBVY Accounting & Tax — déploiement du site public (%s)%s\n' "$B" "$TS" "$N"
check_system

if [ "$DO_ROLLBACK" -eq 1 ]; then
  step "Retour à la version précédente"
  [ -L "$CURRENT" ] || die "Aucune version installée ($CURRENT n’existe pas)."
  PREV="$(previous_release)"
  CUR="$(current_target)"
  [ -n "$PREV" ] && [ "$PREV" != "$CUR" ] || die "Aucune version plus ancienne que $(basename "$CUR") n’est disponible."
  info "Version actuelle :  $(basename "$CUR")"
  info "Retour vers :       $(basename "$PREV")"
  switch_current "$PREV"
  if restart_and_check; then
    ok "Version $(basename "$PREV") en ligne et fonctionnelle"
  else
    ko "La version $(basename "$PREV") ne répond pas sur /api/health."
    warn "Retour à $(basename "$CUR")..."
    switch_current "$CUR"
    if restart_and_check; then ok "Version $(basename "$CUR") rétablie."; else ko "Le service ne répond toujours pas."; fi
    die "Retour arrière annulé. Journal :  sudo journalctl -u $SERVICE -n 100"
  fi
  info "(Pour revenir à la version la plus récente, redéployez simplement.)"
  smoke_test
  summary
  exit 0
fi

if [ -n "$ARCHIVE" ]; then
  ensure_node
  ensure_user_and_layout
  extract_release
  ensure_env
  install_unit
  activate_release
else
  # --nginx seul : il faut déjà une version installée
  [ -L "$CURRENT" ] || die "Aucune version installée : déployez d’abord une archive."
  step "Réinstallation de la configuration nginx seulement"
  mkdir -p "$ACME_ROOT"
fi

maybe_nginx
ensure_firewall
smoke_test
if [ -n "$ARCHIVE" ]; then
  step "11. Nettoyage"
  prune_releases
  save_kit && ok "Kit de déploiement conservé dans $KIT_DIR"
fi
summary
