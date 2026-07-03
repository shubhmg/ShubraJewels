#!/usr/bin/env bash
#
# Git-pull deploy: push your code, then the SERVER pulls, builds, and restarts.
# One command from your laptop:
#
#   bash deploy.sh
#
set -euo pipefail

# ── EDIT THESE ────────────────────────────────────────────────────────
SSH_HOST="ubuntu@146.56.55.16"       # Oracle Cloud, 'ubuntu' user
SSH_KEY="$HOME/.ssh/id_oracle"       # Oracle Cloud key pair
APP_DIR="/var/www/shubra"            # the git clone on the server
BRANCH="main"
# ──────────────────────────────────────────────────────────────────────

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new"

echo "▶ Pushing local commits…"
git push origin "$BRANCH"

echo "▶ Deploying on server (pull → build → restart)…"
$SSH "$SSH_HOST" bash -s <<EOF
  set -e
  cd "$APP_DIR"
  git pull origin "$BRANCH"

  # Build the web app (needs dev deps → plain npm ci at root)
  npm ci
  npm run build

  # Server runtime deps only
  cd server
  npm ci --omit=dev

  # (Re)start
  pm2 restart shubra 2>/dev/null || pm2 start src/server.js --name shubra
  pm2 save
EOF

echo "✔ Deployed."
