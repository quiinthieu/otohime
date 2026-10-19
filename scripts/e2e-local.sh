#!/usr/bin/env bash
# One command: run the e2e suite against a production build and a throwaway docker Postgres.
#   APP_PORT    the server's port (default 4027)
#   SKIP_BUILD  1 reuses the existing .next build
# Exits 2 if docker is missing, otherwise with the e2e suite's status. The Postgres container
# and the server are removed on exit, however it ends.
set -u

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "scripts/e2e-local.sh needs docker (installed and running) for a throwaway Postgres." >&2
  exit 2
fi

APP_PORT="${APP_PORT:-4027}"
NAME="otohime-e2e-$$"
SERVER_PID=""
STARTED_DB=0

cleanup() {
  trap - EXIT
  if [ -n "$SERVER_PID" ]; then
    # the server leads its own process group (set -m below): kill the whole group
    kill -TERM -- "-$SERVER_PID" 2>/dev/null || kill -TERM "$SERVER_PID" 2>/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 0.3
    done
    kill -KILL -- "-$SERVER_PID" 2>/dev/null
  fi
  if [ "$STARTED_DB" = 1 ]; then
    docker rm -f "$NAME" >/dev/null 2>&1
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# A free port: ask the kernel for one, then give it to docker.
free_port() {
  node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
}

if [ -n "$(lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null)" ]; then
  echo "Port $APP_PORT is already in use; set APP_PORT to a free one." >&2
  exit 1
fi

DB_PORT="$(free_port)"
echo "Starting Postgres $NAME on 127.0.0.1:$DB_PORT"
STARTED_DB=1
if ! docker run -d --rm --name "$NAME" \
  -e POSTGRES_USER=otohime -e POSTGRES_PASSWORD=otohime -e POSTGRES_DB=otohime \
  -p "127.0.0.1:$DB_PORT:5432" postgres:17-alpine >/dev/null; then
  echo "docker run failed." >&2
  exit 1
fi

ready=0
for _ in $(seq 1 60); do
  if docker exec "$NAME" pg_isready -U otohime -d otohime >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.5
done
if [ "$ready" != 1 ]; then
  echo "Postgres did not become ready in 30 s." >&2
  exit 1
fi
# pg_isready answers during the image's init restart; wait until a real query works.
for _ in $(seq 1 60); do
  docker exec "$NAME" psql -U otohime -d otohime -tAc 'select 1' >/dev/null 2>&1 && break
  sleep 0.5
done

export DATABASE_URL="postgresql://otohime:otohime@127.0.0.1:$DB_PORT/otohime"
export BETTER_AUTH_URL="http://localhost:$APP_PORT"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-placeholder-not-a-real-secret-0123456789abcdef}"

echo "Applying migrations"
npm run db:migrate || exit 1

if [ "${SKIP_BUILD:-}" != 1 ]; then
  echo "Building"
  npm run build || exit 1
fi

echo "Starting the server on $BETTER_AUTH_URL"
# Not NODE_ENV=test, which turns Better Auth's origin checks off.
set -m
PORT="$APP_PORT" NODE_ENV=production npm start >"${TMPDIR:-/tmp}/otohime-e2e-$$.log" 2>&1 &
SERVER_PID=$!
set +m

up=0
for _ in $(seq 1 60); do
  if curl -fsS "$BETTER_AUTH_URL/api/health" >/dev/null 2>&1; then
    up=1
    break
  fi
  kill -0 "$SERVER_PID" 2>/dev/null || break
  sleep 1
done
if [ "$up" != 1 ]; then
  echo "The server did not answer /api/health. Its log:" >&2
  tail -n 40 "${TMPDIR:-/tmp}/otohime-e2e-$$.log" >&2
  exit 1
fi

BASE_URL="$BETTER_AUTH_URL" npm run test:e2e
status=$?
rm -f "${TMPDIR:-/tmp}/otohime-e2e-$$.log"
exit "$status"
