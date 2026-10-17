#!/usr/bin/env bash
# Start local Postgres, apply migrations, and run the Next.js dev server.
#
# Mini-apps under ~/orca claim even ports 3000-3098 for Next.js (Cognito
# callbacks) and the odd port above each for DBOS admin. This script never
# binds that range. Default app port is 4000; Postgres stays on 5433.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MINIAPP_PORT_MIN=3000
MINIAPP_PORT_MAX=3098
DEFAULT_PORT=4000
DB_PORT=5433
DB_CONTAINER_MATCH="otohime"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-otohime}"

_env_get() {
  [[ -f "$2" ]] || return 0
  grep -E "^$1=" "$2" | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true
}

_fill() {
  local k="$1" v
  if [[ -z "${!k:-}" ]]; then
    v="$(_env_get "$k" .env)"
    if [[ -n "$v" ]]; then
      printf -v "$k" '%s' "$v"
    fi
  fi
}

set_env_value() {
  local key="$1" value="$2" file=".env" tmp
  tmp="$(mktemp)"
  if [[ -f "$file" ]] && grep -q "^${key}=" "$file"; then
    awk -v key="$key" -v value="$value" '
      BEGIN { prefix = key "=" }
      index($0, prefix) == 1 {
        if (!done) { print key "=\"" value "\""; done = 1 }
        next
      }
      { print }
    ' "$file" >"$tmp"
    mv "$tmp" "$file"
  else
    rm -f "$tmp"
    printf '\n%s="%s"\n' "$key" "$value" >>"$file"
  fi
}

in_miniapp_range() {
  local port="$1"
  [[ "$port" -ge "$MINIAPP_PORT_MIN" && "$port" -le "$MINIAPP_PORT_MAX" ]]
}

listeners_on() {
  lsof -PiTCP:"$1" -sTCP:LISTEN -t 2>/dev/null || true
}

own_listeners_on() {
  local pid cwd
  for pid in $(listeners_on "$1"); do
    cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
    case "$cwd" in
      "$ROOT_DIR"|"$ROOT_DIR"/*) echo "$pid" ;;
    esac
  done
}

free_own_port() {
  local port="$1" label="$2" pid
  command -v lsof >/dev/null 2>&1 || return 0
  [[ -z "$(own_listeners_on "$port")" ]] && return 0

  for pid in $(own_listeners_on "$port"); do
    echo "Reclaiming port $port ($label): stopping pid $pid from this checkout..."
    kill "$pid" 2>/dev/null || true
  done
  for _ in {1..20}; do
    [[ -z "$(own_listeners_on "$port")" ]] && return 0
    sleep 0.25
  done
  for pid in $(own_listeners_on "$port"); do
    echo "Port $port ($label) still held by $pid after SIGTERM; sending SIGKILL."
    kill -9 "$pid" 2>/dev/null || true
  done
  for _ in {1..20}; do
    [[ -z "$(own_listeners_on "$port")" ]] && return 0
    sleep 0.25
  done
  echo "Could not free port $port ($label). Stop the process holding it and retry."
  exit 1
}

# Ports named in sibling checkouts' .env files (mini-apps and anything else
# under the parent of this repo). Used so a stopped mini-app still keeps its
# preferred port.
collect_reserved_ports() {
  local parent sibling envfile line key val
  parent="$(cd "$ROOT_DIR/.." && pwd)"
  for sibling in "$parent"/*; do
    [[ -d "$sibling" ]] || continue
    [[ "$(cd "$sibling" && pwd)" == "$ROOT_DIR" ]] && continue
    envfile="$sibling/.env"
    [[ -f "$envfile" ]] || continue
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ "$line" =~ ^([A-Z0-9_]*PORT)= ]] || continue
      key="${BASH_REMATCH[1]}"
      val="${line#*=}"
      val="${val%%#*}"
      val="${val%"${val##*[![:space:]]}"}"
      val="${val#\"}"
      val="${val%\"}"
      val="${val#\'}"
      val="${val%\'}"
      [[ "$val" =~ ^[0-9]+$ ]] || continue
      echo "$val"
    done <"$envfile"
  done
}

port_is_reserved() {
  local port="$1" reserved="$2"
  in_miniapp_range "$port" && return 0
  [[ "$port" == "$DB_PORT" ]] && return 0
  [[ " $reserved " == *" $port "* ]] && return 0
  return 1
}

port_is_busy() {
  [[ -n "$(listeners_on "$1")" ]]
}

pick_app_port() {
  local preferred="$1" reserved="$2" port
  port="$preferred"
  if in_miniapp_range "$port"; then
    echo "PORT $port is in the mini-app range ${MINIAPP_PORT_MIN}-${MINIAPP_PORT_MAX}; using ${DEFAULT_PORT}+ instead." >&2
    port="$DEFAULT_PORT"
  fi
  while port_is_reserved "$port" "$reserved" || { [[ -z "$(own_listeners_on "$port")" ]] && port_is_busy "$port"; }; do
    port=$((port + 1))
    if in_miniapp_range "$port"; then
      port=$((MINIAPP_PORT_MAX + 1))
    fi
    if [[ "$port" -gt 4999 ]]; then
      echo "Could not find a free port between $preferred and 4999 outside the mini-app range."
      exit 1
    fi
  done
  echo "$port"
}

assert_db_port_is_ours() {
  local owner
  owner="$(docker ps --filter "publish=${DB_PORT}" --format '{{.Names}}' | head -1)"
  if [[ -n "$owner" && "$owner" != *"$DB_CONTAINER_MATCH"* ]]; then
    echo "Port $DB_PORT is published by container '$owner', not an otohime Postgres container."
    echo "Stop that container, or change the host port in docker-compose.yml."
    exit 1
  fi
  if [[ -z "$owner" && -n "$(listeners_on "$DB_PORT")" ]]; then
    echo "Port $DB_PORT is held by a non-Docker process. Stop it and retry."
    exit 1
  fi
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is required for the local Postgres container."
    exit 1
  fi
  if docker info >/dev/null 2>&1; then
    return 0
  fi
  if [[ "$(uname -s)" != "Darwin" ]]; then
    echo "Docker is installed but not running or not accessible."
    exit 1
  fi
  echo "Starting Docker..."
  open -a Docker 2>/dev/null || open -a "Rancher Desktop" 2>/dev/null || true
  for _ in {1..60}; do
    docker info >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "Docker did not become ready within 2 minutes."
  exit 1
}

open_url() {
  orca tab create --url "$1" --json >/dev/null 2>&1 && return 0
  open "$1" >/dev/null 2>&1 || xdg-open "$1" >/dev/null 2>&1 || echo "Open $1 manually."
}

open_when_ready() {
  local url="$1"
  for _ in {1..60}; do
    [[ -n "$(listeners_on "$PORT")" ]] && break
    sleep 1
  done
  open_url "$url"
}

ensure_env() {
  if [[ ! -f ".env" ]]; then
    cp .env.example .env
    echo "Created .env from .env.example."
  fi
  local secret
  secret="$(_env_get BETTER_AUTH_SECRET .env)"
  if [[ -z "$secret" ]]; then
    secret="$(openssl rand -base64 32)"
    set_env_value BETTER_AUTH_SECRET "$secret"
    echo "Generated BETTER_AUTH_SECRET."
  fi
}

ensure_env
_fill PORT
PREFERRED_PORT="${PORT:-$DEFAULT_PORT}"
if in_miniapp_range "$PREFERRED_PORT"; then
  echo "PORT $PREFERRED_PORT is in the mini-app range ${MINIAPP_PORT_MIN}-${MINIAPP_PORT_MAX}; preferring ${DEFAULT_PORT}."
  PREFERRED_PORT="$DEFAULT_PORT"
fi
set_env_value PORT "$PREFERRED_PORT"
set_env_value BETTER_AUTH_URL "http://localhost:${PREFERRED_PORT}"

RESERVED_PORTS="$(collect_reserved_ports | tr '\n' ' ')"
PORT="$PREFERRED_PORT"
if [[ "${BOOTSTRAP_ONLY:-}" != "1" ]]; then
  PORT="$(pick_app_port "$PREFERRED_PORT" "$RESERVED_PORTS")"
  free_own_port "$PORT" "Next.js"
fi

BETTER_AUTH_URL="http://localhost:${PORT}"
export PORT BETTER_AUTH_URL COMPOSE_PROJECT_NAME

# Localhost cookies are host-scoped. Mini-app Better Auth sessions on this
# machine routinely push the Cookie header past Node's 16KiB default, and
# Next.js then answers 431 with a blank page.
if [[ "${NODE_OPTIONS:-}" != *max-http-header-size* ]]; then
  export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-http-header-size=65536"
fi

ensure_docker
assert_db_port_is_ours

echo "Starting Postgres (localhost:${DB_PORT})..."
docker compose -p "$COMPOSE_PROJECT_NAME" up -d --wait postgres

if [[ ! -d "node_modules" || "package-lock.json" -nt "node_modules/.package-lock.json" ]]; then
  echo "Installing npm dependencies..."
  npm install
fi

echo "Applying database migrations..."
npm run db:migrate

if [[ "${BOOTSTRAP_ONLY:-}" == "1" ]]; then
  echo "Bootstrap complete: Postgres on localhost:${DB_PORT}. Run bash scripts/dev.sh to start the app."
  exit 0
fi

APP_URL="http://localhost:${PORT}"
echo "Starting Next.js on ${APP_URL} (mini-app ports ${MINIAPP_PORT_MIN}-${MINIAPP_PORT_MAX} left alone)..."
if [[ "${SKIP_BROWSER:-}" != "1" ]]; then
  open_when_ready "$APP_URL" &
fi
exec npx next dev --port "$PORT"
