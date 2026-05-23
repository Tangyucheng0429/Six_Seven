#!/usr/bin/env bash
# Run on server: bash ~/Six_Seven/scripts/deploy.sh
set -euo pipefail

APP="${APP_DIR:-$HOME/Six_Seven}"
SITE="${SITE_URL:-http://103.40.204.29}"

cd "$APP"
git fetch origin
git reset --hard origin/main

cd "$APP/be"
npm install --omit=dev

cd "$APP/fe"
npm install
VITE_API_URL="$SITE" npm run build

pm2 restart sixseven-api 2>/dev/null || pm2 start "$APP/be/src/app.js" --name sixseven-api
pm2 save

chmod 755 "$HOME"
sudo systemctl reload nginx

echo "Deployed $(git rev-parse --short HEAD) → $SITE"
