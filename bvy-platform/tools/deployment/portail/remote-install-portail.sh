#!/usr/bin/env bash
# =============================================================================
#  BVY — installation / mise à jour du PORTAIL (portail.bvyaccountingtax.ca)
#  À lancer SUR LE SERVEUR, avec sudo. Envoyé et lancé par deploy-portail.cmd.
#
#    sudo bash remote-install-portail.sh /tmp/bvy-portail/bvy-portail.tar.gz
#    sudo bash remote-install-portail.sh --rollback      version précédente
#
#  Organisation :
#    /var/www/bvy-portail/releases/<date>   versions (5 gardées)
#    /var/www/bvy-portail/current           lien vers la version active
#    /var/www/bvy-portail/shared/data       base SQLite, documents, sauvegardes (bvy, 0750)
#    /var/www/bvy-portail/shared/portail.env  réglages propres au portail (facultatif)
#  Les réglages courriel (SMTP_*, MAIL_TO) viennent de /var/www/bvy-website/shared/.env.
# =============================================================================
set -euo pipefail

DOMAIN="portail.bvyaccountingtax.ca"
SERVICE="bvy-portail"
APP_USER="bvy"
BASE="/var/www/bvy-portail"
RELEASES="$BASE/releases"
SHARED="$BASE/shared"
DATA_DIR="$SHARED/data"
CURRENT="$BASE/current"
PORT=3100
KEEP_RELEASES=5
ACME_ROOT="/var/www/letsencrypt"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
NODE_MIN="22.13.0"
KIT_DIR="$SHARED/deploy-kit"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TS="$(date +%Y%m%d-%H%M%S)"

if [ -t 1 ]; then G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; B=$'\033[1m'; N=$'\033[0m'; else G=""; R=""; Y=""; B=""; N=""; fi
step() { printf '\n%s== %s ==%s\n' "$B" "$*" "$N"; }
ok()   { printf '  %s✔%s %s\n' "$G" "$N" "$*"; }
warn() { printf '  %s!%s %s\n' "$Y" "$N" "$*"; }
info() { printf '    %s\n' "$*"; }
die()  { printf '  %s✖%s %s\n' "$R" "$N" "$*" >&2; printf "\n%sÉCHEC — l'installation du portail s'est arrêtée à cette étape.%s\n" "$R" "$N" >&2; exit 1; }
version_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]; }

[ "$(id -u)" -eq 0 ] || die "Lancez ce script avec sudo."


previous_release() {
  local cur; cur="$(readlink -f "$CURRENT" 2>/dev/null || true)"
  find "$RELEASES" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort | grep -v -x "$cur" | tail -n1
}

health() { # attend que le portail réponde
  for _ in $(seq 1 20); do
    if curl -fsS --max-time 2 "http://127.0.0.1:$PORT/sante" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

# ---------------------------------------------------------------- --rollback
if [ "${1:-}" = "--rollback" ]; then
  step "Retour à la version précédente du portail"
  prev="$(previous_release)"
  [ -n "$prev" ] || die "Aucune version précédente."
  ln -sfn "$prev" "$CURRENT.tmp" && mv -T "$CURRENT.tmp" "$CURRENT"
  systemctl restart "$SERVICE"
  health && ok "Version $(basename "$prev") en ligne." || die "Le portail ne répond pas : sudo journalctl -u $SERVICE -n 50"
  exit 0
fi

ARCHIVE="${1:-}"
[ -n "$ARCHIVE" ] && [ -f "$ARCHIVE" ] || die "Usage : sudo bash $0 <archive.tar.gz> | --rollback"

# ------------------------------------------------------------------- Node.js
step "1. Node.js ${NODE_MIN} ou plus récent (base SQLite intégrée)"
v=""; [ -x /usr/bin/node ] && v="$(/usr/bin/node -v | sed 's/^v//')"
if [ -z "$v" ] || ! version_ge "$v" "$NODE_MIN"; then
  info "Node ${v:-absent} → installation de Node 22 à jour (NodeSource)..."
  apt-get update -qq && apt-get install -y -qq ca-certificates curl gnupg >/dev/null
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null || die "Dépôt NodeSource inaccessible."
  apt-get install -y nodejs >/dev/null || die "Installation de Node.js échouée."
  v="$(/usr/bin/node -v | sed 's/^v//')"
  version_ge "$v" "$NODE_MIN" || die "Node.js $v installé, mais $NODE_MIN minimum est requis."
  warn "Node.js mis à jour : le site public sera redémarré à la fin."
  NODE_UPDATED=1
fi
ok "Node.js $v"

# ------------------------------------------------------ utilisateur et dossiers
step "2. Dossiers"
id "$APP_USER" >/dev/null 2>&1 || useradd --system --user-group --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$RELEASES" "$DATA_DIR" "$ACME_ROOT"
chown root:root "$BASE" "$RELEASES" "$SHARED"; chmod 755 "$BASE" "$RELEASES" "$SHARED" "$ACME_ROOT"
chown "$APP_USER:$APP_USER" "$DATA_DIR"; chmod 750 "$DATA_DIR"
ok "$BASE prêt (données : $DATA_DIR, accessibles seulement par « $APP_USER »)"

# ------------------------------------------------------------ nouvelle version
step "3. Nouvelle version"
gzip -t "$ARCHIVE" 2>/dev/null || die "Archive corrompue : $ARCHIVE"
NEW="$RELEASES/$TS"; [ -e "$NEW" ] && NEW="$NEW-$$"
mkdir -p "$NEW"
tar -xzf "$ARCHIVE" -C "$NEW" --no-same-owner --no-same-permissions 2>/dev/null || { rm -rf "$NEW"; die "Décompression impossible."; }
if [ ! -f "$NEW/server.js" ]; then
  inner="$(find "$NEW" -mindepth 2 -maxdepth 3 -name server.js -printf '%h\n' | head -n1)"
  if [ -n "$inner" ]; then shopt -s dotglob; mv "$inner"/* "$NEW"/; shopt -u dotglob; fi
fi
[ -f "$NEW/server.js" ] && [ -f "$NEW/public/assets/tokens.css" ] || { rm -rf "$NEW"; die "Ce n'est pas l'archive du portail (server.js / public absents)."; }
rm -rf "$NEW/data" "$NEW/.env" "$NEW/test" "$NEW/node_modules"
chown -R root:root "$NEW"; find "$NEW" -type d -exec chmod 755 {} +; find "$NEW" -type f -exec chmod 644 {} +
ok "Extraite dans $NEW"

# ------------------------------------------------------------------ systemd
step "4. Services"
for u in bvy-portail.service bvy-portail-backup.service bvy-portail-backup.timer bvy-portail-sync.service bvy-portail-sync.timer; do
  tr -d '\r' < "$SCRIPT_DIR/systemd/$u" > "/etc/systemd/system/$u"; chmod 644 "/etc/systemd/system/$u"
done
systemctl daemon-reload
systemctl enable "$SERVICE" bvy-portail-backup.timer bvy-portail-sync.timer >/dev/null 2>&1
systemctl start bvy-portail-backup.timer bvy-portail-sync.timer
ok "Service $SERVICE, sauvegarde quotidienne (03 h 15) et synchronisation QuickBooks horaire installés"
# Réglages propres au portail (QuickBooks) : créés une fois, jamais écrasés, lisibles par « bvy » seulement.
PENV="$SHARED/portail.env"
if [ ! -f "$PENV" ]; then
  cat > "$PENV" <<'ENVEOF'
# Réglages du portail BVY — sudo nano /var/www/bvy-portail/shared/portail.env  puis  sudo systemctl restart bvy-portail
# NE JAMAIS copier ce fichier dans Git ni dans une conversation.
# --- QuickBooks Online (application Intuit, developer.intuit.com) ---
# sandbox pour les essais, production pour les vrais clients
QBO_ENV=sandbox
QBO_CLIENT_ID=
QBO_CLIENT_SECRET=
# Clé de chiffrement des jetons : générée automatiquement à l'installation, ne pas la changer.
QBO_TOKEN_KEY=
ENVEOF
  sed -i "s|^QBO_TOKEN_KEY=$|QBO_TOKEN_KEY=$(openssl rand -base64 32)|" "$PENV"
  ok "$PENV créé (clé de chiffrement QuickBooks générée)"
fi
chown root:"$APP_USER" "$PENV"; chmod 640 "$PENV"

# ------------------------------------------------------- activation + santé
step "5. Mise en ligne de la version"
PREV="$(readlink -f "$CURRENT" 2>/dev/null || true)"
ln -sfn "$NEW" "$CURRENT.tmp" && mv -T "$CURRENT.tmp" "$CURRENT"
systemctl restart "$SERVICE"
if health; then
  ok "Le portail répond (127.0.0.1:$PORT)"
else
  if [ -n "$PREV" ] && [ -d "$PREV" ]; then
    ln -sfn "$PREV" "$CURRENT.tmp" && mv -T "$CURRENT.tmp" "$CURRENT"; systemctl restart "$SERVICE" || true
    die "La nouvelle version ne démarre pas : l'ancienne est remise. Journal : sudo journalctl -u $SERVICE -n 50"
  fi
  die "Le portail ne démarre pas. Journal : sudo journalctl -u $SERVICE -n 50"
fi
[ "${NODE_UPDATED:-0}" = 1 ] && systemctl restart bvy-website 2>/dev/null && ok "Site public redémarré (nouveau Node.js)"

# -------------------------------------------------------------------- nginx
step "6. nginx et certificat HTTPS"
command -v nginx >/dev/null 2>&1 || die "nginx est absent (le site public doit être installé d'abord)."
if [ -d /etc/nginx/sites-enabled ]; then NGX="/etc/nginx/sites-available/bvy-portail.conf"; LINK="/etc/nginx/sites-enabled/bvy-portail.conf"
else NGX="/etc/nginx/conf.d/bvy-portail.conf"; LINK=""; fi

# Une autre configuration qui réclame déjà portail.bvyaccountingtax.ca prendrait le dessus (nginx l'ignore en silence).
conflicts=""
for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
  [ -e "$f" ] || continue
  case "$(readlink -f "$f")" in "$(readlink -f "$NGX" 2>/dev/null || echo "$NGX")") continue ;; esac
  if grep -v '^[[:space:]]*#' "$f" 2>/dev/null | grep -Eq "server_name[^;]*[[:space:]]$DOMAIN([[:space:]]|;)"; then conflicts="$conflicts $f"; fi
done
if [ -n "$conflicts" ]; then
  warn "Une ancienne configuration nginx réclame déjà $DOMAIN :$conflicts"
  warn "Elle passerait avant le portail (réponse 404). Rien n'est modifié automatiquement : ce fichier sert peut-être"
  warn "d'autres services. Retirez seulement ses blocs « server » de $DOMAIN (voir DEPLOIEMENT.md, section 9 bis)."
fi

render() { # adapte le modèle : http2 si nginx < 1.25.1, IPv6 absent
  local ver; ver="$(nginx -v 2>&1 | sed -nE 's|.*nginx/([0-9.]+).*|\1|p')"
  local -a ed=(-e 's/\r$//')
  if [ -n "$ver" ] && ! version_ge "$ver" "1.25.1"; then ed+=(-e '/^[[:space:]]*http2 on;/d' -e 's/listen (\[::\]:)?443 ssl;/listen \1443 ssl http2;/'); fi
  [ -e /proc/net/if_inet6 ] || ed+=(-e '/^[[:space:]]*listen[[:space:]]+\[::\]/d')
  sed -E "${ed[@]}" "$1"
}

install_conf() { # install_conf <modèle> ; remet l'ancienne configuration si « nginx -t » échoue
  local bak=""
  [ -f "$NGX" ] && { bak="$NGX.bak-$TS"; cp -a "$NGX" "$bak"; }
  render "$1" > "$NGX.tmp" && mv "$NGX.tmp" "$NGX" && chmod 644 "$NGX"
  [ -n "$LINK" ] && ln -sfn "$NGX" "$LINK"
  if ! out="$(nginx -t 2>&1)"; then
    if [ -n "$bak" ]; then mv "$bak" "$NGX"; else rm -f "$NGX"; [ -n "$LINK" ] && rm -f "$LINK"; fi
    printf '%s\n' "$out" | tail -n 5 >&2
    die "nginx -t a échoué : l'ancienne configuration est remise, le site public n'est pas touché."
  fi
  systemctl reload nginx
}

if [ -f "$CERT_DIR/fullchain.pem" ]; then
  install_conf "$SCRIPT_DIR/nginx/portail.conf"
  ok "HTTPS actif avec le certificat existant"
else
  install_conf "$SCRIPT_DIR/nginx/portail.http-only.conf"
  ok "Configuration temporaire (HTTP) installée pour obtenir le certificat"
  myips=" $(hostname -I 2>/dev/null) "
  dnsips="$(getent ahosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ')"
  match=0; for ip in $dnsips; do case "$myips" in *" $ip "*) match=1 ;; esac; done
  if [ -z "$dnsips" ]; then
    warn "Le nom $DOMAIN n'existe pas encore dans le DNS."
    info "Chez OVH : Domaines → bvyaccountingtax.ca → Zone DNS → Ajouter une entrée → A,"
    info "sous-domaine « portail », cible : l'adresse IP de ce serveur. Attendez 5 à 30 minutes,"
    info "puis relancez le déploiement : le certificat sera obtenu automatiquement."
  elif [ "$match" != 1 ]; then
    warn "$DOMAIN pointe vers $dnsips, pas vers ce serveur ($myips). Corrigez l'entrée DNS chez OVH puis relancez."
  else
    command -v certbot >/dev/null 2>&1 || { info "Installation de certbot..."; apt-get install -y -qq certbot >/dev/null; }
    if certbot certonly --webroot -w "$ACME_ROOT" -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --keep-until-expiring >/tmp/certbot-portail.log 2>&1 \
       && [ -f "$CERT_DIR/fullchain.pem" ]; then
      install_conf "$SCRIPT_DIR/nginx/portail.conf"
      ok "Certificat obtenu et HTTPS actif (renouvellement automatique par certbot)"
    else
      tail -n 8 /tmp/certbot-portail.log >&2 || true
      warn "Certificat non obtenu : le portail n'est pas encore utilisable (la connexion exige HTTPS)."
    fi
  fi
fi

# -------------------------------------------------- commande d'administration
cat > /usr/local/bin/bvy-portail <<EOF
#!/usr/bin/env bash
# Administration du portail BVY (lancée en tant que « $APP_USER », jamais en root).
exec sudo -u $APP_USER env PORTAL_DATA_DIR=$DATA_DIR PORTAL_URL=https://$DOMAIN /usr/bin/node --disable-warning=ExperimentalWarning $CURRENT/cli.js "\$@"
EOF
chmod 755 /usr/local/bin/bvy-portail
mkdir -p "$KIT_DIR" && cp -a "$SCRIPT_DIR"/. "$KIT_DIR"/ 2>/dev/null || true
ok "Commande « sudo bvy-portail » installée"

# ------------------------------------------------------------------- ménage
mapfile -t olds < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d | sort | head -n -"$KEEP_RELEASES")
for d in "${olds[@]}"; do [ "$(readlink -f "$CURRENT")" = "$d" ] || rm -rf "$d"; done

step "TERMINÉ"
if [ -f "$CERT_DIR/fullchain.pem" ]; then
  info "Portail : https://$DOMAIN"
  if ! sudo -u "$APP_USER" test -s "$DATA_DIR/portail.sqlite" || [ "$(/usr/local/bin/bvy-portail list-users 2>/dev/null | wc -l)" = 0 ]; then
    info "Première fois ? Créez votre accès administrateur :"
    info "  sudo bvy-portail create-admin votre@courriel \"Prénom Nom\""
  fi
else
  info "Il reste le DNS et le certificat (voir ci-dessus), puis relancez le déploiement."
fi
