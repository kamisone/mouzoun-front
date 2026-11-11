#!/usr/bin/env bash
# Zero-downtime blue/green deployment of the Mouzoun front (Nuxt) on a single VPS (no Kubernetes).
#
# Called by GitHub Actions over SSH, as root:   sudo bash ~/mouzoun/front/deploy.sh <image:tag> <app_url>
#
# The front never touches nginx (the back owns it). nginx's website upstream lists both ports
# (blue 127.0.0.1:13001, green 127.0.0.1:13002) and skips whichever is not running:
#
#   1. starts the new release on the free color's port
#   2. waits for /healthz, then renders the home page once (catches broken SSR before visitors)
#   3. both colors serve for DRAIN_SECONDS, then the previous one is stopped gracefully
#      (requests reaching it while it stops are retried by nginx on the new one)
#
# Any failure before step 3 removes the new container: the current release keeps serving.
# No secrets: runtime config is derived from APP_URL (e.g. https://mouzoun.com).

set -Eeuo pipefail

IMAGE="${1:?usage: deploy.sh <image:tag> <app_url>}"
APP_URL="${2:?usage: deploy.sh <image:tag> <app_url>}"
APP_URL="${APP_URL%/}"

PREFIX="${PREFIX:-mouzoun}"
ROOT="${ROOT:-/srv/mouzoun/front}"
# Server-side rendering → API through nginx's loopback listener (defined in back/deploy/nginx/web.conf).
API_INTERNAL_BASE="${API_INTERNAL_BASE:-http://127.0.0.1:18080}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
# Must be longer than fail_timeout (10s) of the mouzoun_front upstream in back/deploy/nginx/web.conf:
# nginx may have marked the new port as down while it was starting; it becomes eligible again
# after fail_timeout, and only then can the old color be stopped safely.
DRAIN_SECONDS="${DRAIN_SECONDS:-15}"
KEEP_IMAGES="${KEEP_IMAGES:-3}"
# Must match the mouzoun_front upstream in back/deploy/nginx/web.conf.
PORT_BLUE="${PORT_BLUE:-13001}"
PORT_GREEN="${PORT_GREEN:-13002}"
# Docker Desktop (local testing) cannot use host networking; the VPS always does.
NETWORK_MODE="${NETWORK_MODE:-host}"

STATE_FILE="$ROOT/active-color"

log() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[deploy] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
container_exists() { docker container inspect "$1" >/dev/null 2>&1; }
container_running() { [ "$(docker container inspect -f '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }

[ "$(id -u)" -eq 0 ] || [ -n "${ALLOW_NON_ROOT:-}" ] || fail "must run as root (sudo bash deploy.sh ...)"
command -v docker >/dev/null || fail "docker is not installed"
mkdir -p "$ROOT"

# 1. Start the new release next to the current one --------------------------------------------
ACTIVE="$(cat "$STATE_FILE" 2>/dev/null || echo none)"
if [ "$ACTIVE" = "blue" ]; then NEW=green NEW_PORT=$PORT_GREEN; else NEW=blue NEW_PORT=$PORT_BLUE; fi
NEW_CONTAINER="$PREFIX-front-$NEW"
OLD_CONTAINER="$PREFIX-front-$ACTIVE"

# Release tags are immutable (v<run_number>): pull only when not already on the server.
if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  log "pulling $IMAGE"
  docker pull -q "$IMAGE" >/dev/null
fi

log "starting $NEW_CONTAINER on 127.0.0.1:$NEW_PORT (active: $ACTIVE)"
docker rm -f "$NEW_CONTAINER" >/dev/null 2>&1 || true
if [ "$NETWORK_MODE" = "host" ]; then
  NET_ARGS=(--network host -e HOST=127.0.0.1 -e PORT="$NEW_PORT")
else
  NET_ARGS=(-p "127.0.0.1:$NEW_PORT:3000" -e HOST=0.0.0.0 -e PORT=3000)
fi
docker run -d --name "$NEW_CONTAINER" --restart unless-stopped --init \
  -e NODE_ENV=production \
  -e NUXT_API_INTERNAL_BASE="$API_INTERNAL_BASE" \
  -e NUXT_PUBLIC_API_BASE="$APP_URL/api" \
  -e NUXT_PUBLIC_I18N_BASE_URL="$APP_URL" \
  "${NET_ARGS[@]}" \
  --stop-timeout 30 --log-opt max-size=20m --log-opt max-file=5 \
  "$IMAGE" >/dev/null

# 2. Health gate -------------------------------------------------------------------------------
log "waiting for $NEW_CONTAINER to be ready"
ready=false
for ((i = 0; i < HEALTH_TIMEOUT; i++)); do
  if curl -fsS -m 2 "http://127.0.0.1:$NEW_PORT/healthz" >/dev/null 2>&1; then ready=true; break; fi
  container_running "$NEW_CONTAINER" || break
  sleep 1
done
if [ "$ready" = true ] && ! curl -fsS -m 15 -o /dev/null "http://127.0.0.1:$NEW_PORT/fr"; then
  ready=false
fi
if [ "$ready" != true ]; then
  docker logs --tail 80 "$NEW_CONTAINER" >&2 || true
  docker rm -f "$NEW_CONTAINER" >/dev/null 2>&1 || true
  fail "new release failed its health check; $ACTIVE release is still serving"
fi
echo "$NEW" >"$STATE_FILE"

# 3. Retire the previous release ---------------------------------------------------------------
if [ "$ACTIVE" != "none" ] && container_exists "$OLD_CONTAINER"; then
  log "both releases serving for ${DRAIN_SECONDS}s, then stopping $OLD_CONTAINER"
  sleep "$DRAIN_SECONDS"
  docker stop -t 30 "$OLD_CONTAINER" >/dev/null || true
  docker rm "$OLD_CONTAINER" >/dev/null || true
fi

REPO="${IMAGE%:*}"
docker images "$REPO" --format '{{.Repository}}:{{.Tag}}' | tail -n +"$((KEEP_IMAGES + 1))" |
  while read -r old_image; do docker rmi "$old_image" >/dev/null 2>&1 || true; done

log "done: $NEW_CONTAINER is live ($IMAGE)"
