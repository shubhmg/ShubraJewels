#!/usr/bin/env bash
#
# One-time server bootstrap for Shubra Jewels. Run this ON THE SERVER once.
# It clones the repo, creates the uploads dir, writes a .env template (for you to
# fill), builds, seeds, and starts the PM2 process. Safe to re-run — it never
# overwrites an existing .env or uploaded media.
#
#   curl -fsSL https://raw.githubusercontent.com/shubhmg/ShubraJewels/main/setup-server.sh -o setup-server.sh
#   bash setup-server.sh
#
# or, if you already cloned the repo, just: bash setup-server.sh
#
set -euo pipefail

# ── CONFIG ────────────────────────────────────────────────────────────
REPO_URL="https://github.com/shubhmg/ShubraJewels.git"
APP_DIR="/var/www/shubra"
BRANCH="main"
# ──────────────────────────────────────────────────────────────────────

need() { command -v "$1" >/dev/null 2>&1 || { echo "✗ missing '$1' — install it first"; exit 1; }; }
need git; need node; need npm
command -v pm2 >/dev/null 2>&1 || { echo "▶ installing pm2…"; npm i -g pm2; }

# 1. Clone or update
if [ -d "$APP_DIR/.git" ]; then
  echo "▶ repo exists — pulling latest"
  git -C "$APP_DIR" pull origin "$BRANCH"
else
  echo "▶ cloning $REPO_URL → $APP_DIR"
  git clone -b "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

mkdir -p "$APP_DIR/server/uploads"

# 2. .env — create a template on first run, then stop so you can fill it in
ENV="$APP_DIR/server/.env"
if [ ! -f "$ENV" ]; then
  JWT=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
  cat > "$ENV" <<EOF
PORT=4200
NODE_ENV=production
MONGODB_URI=mongodb+srv://ntj:PASSWORD@cluster0.um15q.mongodb.net/shubra?retryWrites=true&w=majority
JWT_SECRET=$JWT
JWT_EXPIRES_IN=30d
ADMIN_EMAIL=you@shubrajewels.in
ADMIN_PASSWORD=change-me-now
PUBLIC_URL=
EOF
  echo
  echo "⚠ Created $ENV with a random JWT_SECRET."
  echo "  Edit it now — set MONGODB_URI (real password), ADMIN_EMAIL, ADMIN_PASSWORD:"
  echo "      nano $ENV"
  echo "  Then run this script again to build, seed, and start."
  exit 0
fi

# 3. Build web + install server deps
echo "▶ installing + building web…"
cd "$APP_DIR"
npm ci
npm run build

echo "▶ installing server deps…"
cd "$APP_DIR/server"
npm ci --omit=dev

# 4. Seed once (only if the DB has no products yet — safe, non-destructive)
echo "▶ seeding starter content if empty…"
npm run seed || true

# 5. Start / restart under PM2
echo "▶ starting with PM2…"
pm2 restart shubra 2>/dev/null || pm2 start src/server.js --name shubra
pm2 save

echo
echo "✔ Shubra is running on http://127.0.0.1:4200"
echo "  Next: add the nginx vhost + HTTPS (see DEPLOY.md), then 'pm2 startup && pm2 save'."
echo "  After this, deploy updates from your laptop with:  bash deploy.sh"
