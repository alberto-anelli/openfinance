#!/usr/bin/env bash
set -euo pipefail

BUILD_DIR="build"
TARGET_DIR="/var/www/html/content/finance"

echo "==> Deploy frontend statico verso ${TARGET_DIR}"
[ -d "$BUILD_DIR" ] || { echo "ERRORE: build/ mancante. Esegui prima 'npm run build:app'"; exit 1; }

sudo mkdir -p "$TARGET_DIR"
sudo rsync -a --delete "$BUILD_DIR"/ "$TARGET_DIR"/          # sync atomico, rimuove obsoleti
sudo chown -R www-data:www-data "$TARGET_DIR"
sudo find "$TARGET_DIR" -type d -exec chmod 755 {} \;
sudo find "$TARGET_DIR" -type f -exec chmod 644 {} \;

echo "==> Entry point: ${TARGET_DIR}/app.html"
echo "==> Fatto."