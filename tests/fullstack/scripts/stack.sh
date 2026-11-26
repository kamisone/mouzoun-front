#!/bin/sh
# Full-stack test stack: a throwaway database in the dev Postgres container, its own Redis index,
# and the real API on :18090 with test-only settings. Never touches the development database.
#
#   tests/fullstack/scripts/stack.sh prepare   # (re)create the database, seed it, create the staff account
#   tests/fullstack/scripts/stack.sh api       # run the API in the foreground (Ctrl-C to stop)
#   tests/fullstack/scripts/stack.sh drop      # drop the database
#
# Build the binaries first: (cd back && cargo build --bin mouzoun-api --bin seed_dev).
# Variables: E2E_DB (default mouzoun_e2e), E2E_REDIS_DB (default 11), E2E_STAFF_EMAIL,
# E2E_STAFF_PASSWORD, PG_CONTAINER (default mouzoun-postgres-1), REDIS_CONTAINER (default
# mouzoun-redis-1). `prepare` also empties the test's Redis index (never another one), so no
# cached setting of an earlier run survives.
set -eu
HERE="$(cd "$(dirname "$0")" && pwd)"
BACK="$(cd "$HERE/../../../../back" && pwd)"
E2E_DB="${E2E_DB:-mouzoun_e2e}"
E2E_REDIS_DB="${E2E_REDIS_DB:-11}"
PG_CONTAINER="${PG_CONTAINER:-mouzoun-postgres-1}"
REDIS_CONTAINER="${REDIS_CONTAINER:-mouzoun-redis-1}"
case "$E2E_REDIS_DB" in [0-9]|1[0-5]) ;; *) echo "E2E_REDIS_DB must be 0-15 (Redis has 16 databases)" >&2; exit 2 ;; esac

# back/.env first (database host, Redis password, JWT secret...), never printed.
set -a
. "$BACK/.env"
set +a
# Then the test overrides. They are exported, so the API's own dotenv load never replaces them.
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed -E "s#/[^/?]+(\?|$)#/${E2E_DB}\1#")"
REDIS_URL="$(printf '%s' "$REDIS_URL" | sed -E "s#(/[0-9]+)?\$#/${E2E_REDIS_DB}#")"
export DATABASE_URL REDIS_URL
export APP_ENV=development APP_HOST=127.0.0.1 APP_PORT=18090 DATABASE_RUN_MIGRATIONS=true OUTBOX_WORKER_ENABLED=true
export CORS_ORIGINS=http://127.0.0.1:3210 COOKIE_SECURE=false
export PUBLIC_SITE_URL=http://127.0.0.1:3210 API_PUBLIC_URL=http://127.0.0.1:18090
export WEBAUTHN_ORIGIN=http://127.0.0.1:3210 WEBAUTHN_RP_ID=127.0.0.1
# Simulated card provider; no real Stripe keys.
export PAYMENTS_FAKE=true STRIPE_SECRET_KEY= STRIPE_PUBLISHABLE_KEY= STRIPE_WEBHOOK_SECRET=
# Emails go to Mailpit, which refuses SMTP authentication: the .env SMTP credentials are blanked
# on purpose (empty = unset), otherwise every email fails with "No compatible authentication mechanism".
export EMAIL_PROVIDER=smtp SMTP_HOST=127.0.0.1 SMTP_PORT=1025 SMTP_TLS=none SMTP_USER= SMTP_PASSWORD=
export TURNSTILE_SECRET_KEY= TURNSTILE_SITE_KEY= HIBP_ENABLED=false TRANSLATE_ENABLED=false

psql_c() { docker exec "$PG_CONTAINER" sh -c "$1"; }

case "${1:-}" in
  prepare)
    psql_c "dropdb -U \"\$POSTGRES_USER\" --if-exists $E2E_DB && createdb -U \"\$POSTGRES_USER\" $E2E_DB"
    # Same credentials, seen from inside the Redis container (password not printed).
    INNER="$(printf '%s' "$REDIS_URL" | sed -E 's#@[^/]+/#@127.0.0.1:6379/#')"
    docker exec "$REDIS_CONTAINER" redis-cli -u "$INNER" FLUSHDB > /dev/null
    cd "$BACK"
    ./target/debug/seed_dev
    ./target/debug/seed_dev staff "${E2E_STAFF_EMAIL:?set E2E_STAFF_EMAIL}" "${E2E_STAFF_PASSWORD:?set E2E_STAFF_PASSWORD}" manager
    ;;
  api)
    cd "$BACK"
    exec ./target/debug/mouzoun-api
    ;;
  drop)
    psql_c "dropdb -U \"\$POSTGRES_USER\" --if-exists $E2E_DB"
    ;;
  *)
    echo "usage: $0 prepare | api | drop" >&2
    exit 2
    ;;
esac
