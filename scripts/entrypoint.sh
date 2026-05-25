#!/bin/sh
set -e

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Vaultix — Production Startup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 1. Wait for database to be ready ─────────────────────────
echo "→ Waiting for database..."
MAX_RETRIES=30
RETRY=0
until pg_isready \
  -h "${POSTGRES_HOST:-postgres}" \
  -p "${POSTGRES_PORT:-5432}" \
  -U "${POSTGRES_USER:-vaultix}" \
  -d "${POSTGRES_DB:-vaultix}" \
  -q 2>/dev/null; do
  RETRY=$((RETRY + 1))
  if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "✗ Database not reachable after ${MAX_RETRIES} attempts. Aborting."
    exit 1
  fi
  echo "  ↻ Attempt ${RETRY}/${MAX_RETRIES} — retrying in 2s..."
  sleep 2
done
echo "  ✓ Database is ready"
echo ""

# ── 2. Apply database schema ──────────────────────────────────
echo "→ Applying database schema..."
node node_modules/.bin/prisma db push --skip-generate
echo "  ✓ Schema applied"
echo ""

# ── 3. Seed initial admin user ────────────────────────────────
echo "→ Seeding initial data..."
node prisma/seed.js
echo ""

# ── 4. Start application ──────────────────────────────────────
echo "→ Starting Vaultix..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
exec node server.js
