#!/usr/bin/env bash
# Zero-downtime blue/green deployment of the Mouzoun front (Nuxt) on a single VPS (no Kubernetes).
#
# Called by GitHub Actions over SSH, as root:   sudo bash ~/mouzoun/front/deploy.sh <image:tag>
# front.env, uploaded next to this script by the CI, is installed into $ROOT (/srv/mouzoun/front).
#
# The container uses the host network and listens on a loopback port only, so server-side
# rendering reaches the API through nginx's internal listener (127.0.0.1:18080), whichever
# back color is live. Requires the back to have been deployed once (nginx site config).
#
#   1. starts the new release on the free color's port
#   2. waits for /healthz, then renders the home page once (warms SSR and checks it works)
#   3. points nginx to it (graceful reload), drains and stops the previous release
#
# Any failure before the switch leaves the current release serving and fails the job.

set -Eeuo pipefail

IMAGE="${1:?usage: deploy.sh <image:tag>}"
RELEASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PREFIX="${PREFIX:-mouzoun}"
ROOT="${ROOT:-/srv/mouzoun/front}"
ENV_FILE="${ENV_FILE:-$ROOT/front.env}"
NGINX_DIR="${NGINX_DIR:-/etc/nginx/mouzoun}"
NGINX_TEST="${NGINX_TEST:-nginx -t -q}"
NGINX_RELOAD="${NGINX_RELOAD:-systemctl reload nginx}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"
DRAIN_SECONDS="${DRAIN_SECONDS:-10}"
KEEP_IMAGES="${KEEP_IMAGES:-3}"
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
mkdir -p "$ROOT"
chmod 700 "$ROOT"
if [ "$RELEASE_DIR" != "$ROOT" ] && [ -f "$RELEASE_DIR/front.env" ]; then
  install -m 600 "$RELEASE_DIR/front.env" "$ENV_FILE"
  rm -f "$RELEASE_DIR/front.env"
fi
[ -f "$ENV_FILE" ] || fail "missing env file $ENV_FILE"
chmod 600 "$ENV_FILE"
[ -f "$NGINX_DIR/back-upstream.conf" ] || fail "nginx is not configured yet: deploy the back first"

ACTIVE="$(cat "$STATE_FILE" 2>/dev/null || echo none)"
if [ "$ACTIVE" = "blue" ]; then NEW=green NEW_PORT=$PORT_GREEN; else NEW=blue NEW_PORT=$PORT_BLUE; fi
NEW_CONTAINER="$PREFIX-front-$NEW"
OLD_CONTAINER="$PREFIX-front-$ACTIVE"

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
  --env-file "$ENV_FILE" "${NET_ARGS[@]}" \
  --stop-timeout 30 --log-opt max-size=20m --log-opt max-file=5 \
  "$IMAGE" >/dev/null

log "waiting for $NEW_CONTAINER to be ready"
ready=false
for ((i = 0; i < HEALTH_TIMEOUT; i++)); do
  if curl -fsS -m 2 "http://127.0.0.1:$NEW_PORT/healthz" >/dev/null 2>&1; then ready=true; break; fi
  container_running "$NEW_CONTAINER" || break
  sleep 1
done
# A real server-side render of the home page: catches broken SSR before users do.
if [ "$ready" = true ] && ! curl -fsS -m 15 -o /dev/null "http://127.0.0.1:$NEW_PORT/fr"; then
  ready=false
fi
if [ "$ready" != true ]; then
  docker logs --tail 80 "$NEW_CONTAINER" >&2 || true
  docker rm -f "$NEW_CONTAINER" >/dev/null 2>&1 || true
  fail "new release failed its health check; $ACTIVE release is still serving"
fi

UPSTREAM="$NGINX_DIR/front-upstream.conf"
cp -f "$UPSTREAM" "$UPSTREAM.bak" 2>/dev/null || true
echo "upstream mouzoun_front { server 127.0.0.1:$NEW_PORT; keepalive 64; }" >"$UPSTREAM"
if ! { $NGINX_TEST && $NGINX_RELOAD; }; then
  [ -f "$UPSTREAM.bak" ] && cp -f "$UPSTREAM.bak" "$UPSTREAM"
  docker rm -f "$NEW_CONTAINER" >/dev/null 2>&1 || true
  fail "nginx reload failed; traffic left on the $ACTIVE release"
fi
echo "$NEW" >"$STATE_FILE"
log "traffic switched to $NEW ($IMAGE)"

if [ "$ACTIVE" != "none" ] && container_exists "$OLD_CONTAINER"; then
  log "draining $OLD_CONTAINER for ${DRAIN_SECONDS}s"
  sleep "$DRAIN_SECONDS"
  docker stop -t 30 "$OLD_CONTAINER" >/dev/null || true
  docker rm "$OLD_CONTAINER" >/dev/null || true
fi

REPO="${IMAGE%:*}"
docker images "$REPO" --format '{{.Repository}}:{{.Tag}}' | tail -n +"$((KEEP_IMAGES + 1))" |
  while read -r old_image; do docker rmi "$old_image" >/dev/null 2>&1 || true; done

log "done: $NEW_CONTAINER is live"
