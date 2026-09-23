#!/bin/sh
# Construit le ZIP installable de l'extension dans dist/ (à la racine du dépôt).
set -e
cd "$(dirname "$0")"
VERSION=$(sed -n 's/.*"version": "\(.*\)".*/\1/p' manifest.json)
OUT="../dist/traducteur-audio-v$VERSION.zip"
mkdir -p ../dist
rm -f "$OUT"
zip -qr "$OUT" manifest.json background.js common.js content.js popup.html popup.js \
  listen.html listen.js style.css diagnostics icons README.md
echo "$OUT"
