#!/usr/bin/env bash
# =============================================================================
#  BVY Accounting & Tax — déploiement du site public (macOS / Linux / Git Bash)
#
#  Utilisation (depuis n'importe quel dossier) :
#    bash bvy-platform/tools/deployment/deploy.sh              nouvelle version
#    bash bvy-platform/tools/deployment/deploy.sh --nginx      + réinstaller nginx
#    bash bvy-platform/tools/deployment/deploy.sh --rollback   version précédente
#
#  Réglages possibles sans modifier le fichier :
#    SERVER=... SSH_USER=... SSH_KEY=~/.ssh/id_ed25519 bash deploy.sh
#  Aucun mot de passe n'est écrit ici : ssh vous le demandera.
# =============================================================================
set -euo pipefail

# ---- RÉGLAGES --------------------------------------------------------------
SERVER="${SERVER:-148.113.238.146}"
SSH_USER="${SSH_USER:-ubuntu}"
SSH_KEY="${SSH_KEY:-}"
# ----------------------------------------------------------------------------

KIT="$(cd "$(dirname "$0")" && pwd)"
PLATFORM="$(cd "$KIT/../.." && pwd)"
APP="$PLATFORM/apps/website"
TARGET="$SSH_USER@$SERVER"
SSH_OPTS=(-o ConnectTimeout=15 -o ServerAliveInterval=30)
[ -n "$SSH_KEY" ] && SSH_OPTS+=(-i "$SSH_KEY")

ok()   { printf '  \033[32m✔\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✖\033[0m %s\n' "$*" >&2; exit 1; }
step() { printf '\n\033[1m%s\033[0m\n' "$*"; }

printf '\n============================================================\n'
printf '  BVY — Déploiement du site public vers %s\n' "$SERVER"
printf '============================================================\n'

step "[1/6] Vérification des outils"
for t in ssh scp tar; do
  command -v "$t" >/dev/null 2>&1 || die "La commande « $t » est introuvable. Installez le client OpenSSH / tar."
done
ok "ssh, scp et tar sont disponibles"

if [ "${1:-}" = "--rollback" ]; then
  step "Retour à la version précédente sur le serveur"
  ssh -t "${SSH_OPTS[@]}" "$TARGET" "sudo bash /var/www/bvy-website/shared/deploy-kit/remote-install.sh --rollback" \
    || die "Le retour arrière a échoué (voir messages ci-dessus)."
  ok "Version précédente remise en ligne"
  exit 0
fi

step "[2/6] Dossier du site : $APP"
[ -f "$APP/server.js" ] && [ -f "$APP/public/index.html" ] \
  || die "server.js ou public/index.html introuvable dans $APP (projet incomplet ?)"
[ -f "$KIT/remote-install.sh" ] || die "remote-install.sh introuvable dans $KIT"
ok "server.js et public/ trouvés"

step "[3/6] Génération des pages (facultatif)"
BUILD=""
[ -f "$APP/build.js" ] && BUILD="$APP/build.js"
[ -z "$BUILD" ] && [ -f "$PLATFORM/tools/website/build.js" ] && BUILD="$PLATFORM/tools/website/build.js"
if ! command -v node >/dev/null 2>&1; then
  ok "Node.js absent de cet ordinateur : on envoie public/ tel quel"
elif [ -z "$BUILD" ]; then
  ok "Aucun build.js trouvé : on envoie public/ tel quel"
else
  (cd "$APP" && node "$BUILD") || die "La génération des pages a échoué. Rien n'a été envoyé."
  ok "Pages régénérées"
fi

step "[4/6] Préparation de l'archive (sans data, .env, node_modules, test, src)"
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/bvy-deploy.XXXXXX")"
trap 'rm -rf "$STAGE"' EXIT
ITEMS=()
while IFS= read -r name; do
  case "$name" in data|.env|node_modules|test|src|.git|.DS_Store) continue ;; esac
  ITEMS+=("$name")
done < <(cd "$APP" && ls -A)
# COPYFILE_DISABLE : évite les fichiers « ._* » de macOS dans l'archive
COPYFILE_DISABLE=1 tar -czf "$STAGE/bvy-website.tar.gz" -C "$APP" "${ITEMS[@]}"
cp "$KIT/remote-install.sh" "$STAGE/"
cp -R "$KIT/nginx" "$KIT/systemd" "$STAGE/"
ok "Archive prête ($(du -h "$STAGE/bvy-website.tar.gz" | cut -f1))"

step "[5/6] Envoi vers $TARGET:/tmp/bvy-deploy/"
echo "    (mot de passe éventuel = celui de « $SSH_USER » sur le serveur ; rien ne s'affiche pendant la saisie)"
ssh "${SSH_OPTS[@]}" "$TARGET" "rm -rf /tmp/bvy-deploy && mkdir -p /tmp/bvy-deploy" \
  || die "Connexion à $TARGET impossible. Test :  ssh $TARGET"
(cd "$STAGE" && scp "${SSH_OPTS[@]}" -r bvy-website.tar.gz remote-install.sh nginx systemd "$TARGET:/tmp/bvy-deploy/") \
  || die "Envoi des fichiers impossible."
ok "Fichiers envoyés"

step "[6/6] Installation sur le serveur"
ssh -t "${SSH_OPTS[@]}" "$TARGET" \
  "sed -i 's/\r\$//' /tmp/bvy-deploy/remote-install.sh && sudo bash /tmp/bvy-deploy/remote-install.sh /tmp/bvy-deploy/bvy-website.tar.gz $*" \
  || die "L'installation sur le serveur a signalé un problème (voir ci-dessus). Guide : DEPLOIEMENT.md, section 11."

printf '\n============================================================\n'
printf '  TERMINÉ. Ouvrez https://bvyaccountingtax.ca/\n'
printf '============================================================\n'
