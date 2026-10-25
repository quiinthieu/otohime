#!/usr/bin/env bash
# Probe the hop into the signed-in rooms in headless Chromium, one "ok -" / "not ok -" line per check.
#
#   bash scripts/probe-motion-signed-in.sh                        # database, migrate, build, next start on :4063
#   SKIP_BUILD=1 bash scripts/probe-motion-signed-in.sh           # reuse an existing .next build
#   BASE_URL=http://localhost:3000 DATABASE_URL=… bash scripts/probe-motion-signed-in.sh   # CI: the job's server
#
# It signs up an owner and a plain user (owner-<run>@probe.test, plain-<run>@probe.test), promotes the owner
# with SQL and deletes both on exit, however the run ends. At 1366x768 and 390x844 (isMobile, hasTouch), with
# motion on and reduced, it signs in through the /sign-in form (to /dashboard, and with ?next=/account) and hops
# from /shore by location.assign into the rooms, /admin/*, /work, / and /projects: every landing carries the
# hop's view transition (motion on), and there is no page error and no console error until that transition
# and every streamed Suspense reveal have settled. Under reduced motion every animation at load lasts at most
# 1 ms or has finished. Negative check: with the root layout's pagereveal guard stripped from the /dashboard
# HTML (page.route), a sign-in must log "Transition was skipped". As the plain user, every way out of the 403
# (its Go home, the brand mark, the nav's Projects and Dashboard) fades the 403 out and the next page in.
#
# The database, in this order: DATABASE_URL if it is set and answers; else a throwaway docker Postgres; else
# embedded-postgres installed into the temp prefix. If none works it prints "not ok - database" and exits 1.
# With BASE_URL set it builds, migrates and starts nothing, and DATABASE_URL (that server's database) must answer.
#
# Env: PORT (4063; a port Next reserves is bumped by 10), BASE_URL (remote mode), DATABASE_URL, SKIP_BUILD=1.
# Playwright and embedded-postgres are installed into a temp prefix at run time; package.json stays unchanged.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT="${PORT:-4063}"
case "$PORT" in
  1719|1720|1723|2049|3659|4045|5060|5061|6000|6566|6665|6666|6667|6668|6669|6697|10080)
    echo "note: next refuses port $PORT as reserved; serving on $((PORT + 10)) instead"
    PORT=$((PORT + 10))
    ;;
esac
BASE_URL="${BASE_URL:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-motion-signed-in.XXXXXX")"
RUN="r$(date +%s)$$"
SERVER_PID=""
DB_CONTAINER=""
DB_PID=""
DB_OK=0

# A query against DATABASE_URL with the repo's own pg; exits non-zero if the database does not answer in 5 s.
pgq() {
  node -e '
    const pg = require("pg");
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    c.connect()
      .then(() => c.query(process.argv[1], process.argv.slice(2)))
      .then((r) => { console.log(r.rowCount ?? 0); return c.end(); })
      .catch(() => process.exit(1));
  ' "$@"
}

stop_group() {
  local pid="$1"
  kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 -- "-$pid" 2>/dev/null || break
    sleep 0.5
  done
  kill -KILL -- "-$pid" 2>/dev/null
}

cleanup() {
  trap - EXIT
  # The probe deletes its accounts itself; this covers a run that died before it could.
  if [ "$DB_OK" = 1 ]; then
    pgq 'DELETE FROM "user" WHERE email LIKE $1' "%-$RUN@probe.test" >/dev/null 2>&1
  fi
  [ -n "$SERVER_PID" ] && stop_group "$SERVER_PID"
  [ -n "$DB_PID" ] && stop_group "$DB_PID"
  [ -n "$DB_CONTAINER" ] && docker rm -f "$DB_CONTAINER" >/dev/null 2>&1
  rm -rf "$WORK"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

fail() {
  echo "not ok - $1"
  echo "probe: 0 ok, 1 failed"
  exit 1
}

free_port() {
  node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'
}

if [ -n "$BASE_URL" ]; then
  LOCAL=0
  BASE_URL="${BASE_URL%/}"
  case "$BASE_URL" in
    *://otohime.dev|*://otohime.dev:*|*://www.otohime.dev|*://www.otohime.dev:*)
      fail "base url: this probe signs up accounts, and never on otohime.dev" ;;
  esac
else
  LOCAL=1
  BASE_URL="http://localhost:$PORT"
fi

# The database: DATABASE_URL if it answers, else docker, else embedded-postgres.
if [ -n "${DATABASE_URL:-}" ] && pgq 'select 1' >/dev/null 2>&1; then
  DB_OK=1
  echo "# database: DATABASE_URL answers"
elif [ "$LOCAL" = 0 ]; then
  fail "database: BASE_URL is set, so DATABASE_URL must be that server's database, and it does not answer"
else
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    DB_PORT="$(free_port)"
    DB_CONTAINER="otohime-probe-$RUN"
    if docker run -d --rm --name "$DB_CONTAINER" \
      -e POSTGRES_USER=otohime -e POSTGRES_PASSWORD=otohime -e POSTGRES_DB=otohime \
      -p "127.0.0.1:$DB_PORT:5432" postgres:17-alpine >"$WORK/docker.log" 2>&1; then
      export DATABASE_URL="postgresql://otohime:otohime@127.0.0.1:$DB_PORT/otohime"
      # pg_isready answers during the image's init restart; wait until a real query works.
      for _ in $(seq 1 60); do
        if docker exec "$DB_CONTAINER" pg_isready -U otohime -d otohime >/dev/null 2>&1 && pgq 'select 1' >/dev/null 2>&1; then
          DB_OK=1
          break
        fi
        sleep 0.5
      done
      [ "$DB_OK" = 1 ] && echo "# database: docker Postgres on 127.0.0.1:$DB_PORT"
    fi
    if [ "$DB_OK" != 1 ]; then
      echo "# database: docker Postgres did not come up; trying embedded-postgres"
      [ -s "$WORK/docker.log" ] && tail -n 5 "$WORK/docker.log" | sed 's/^/#   /'
      docker rm -f "$DB_CONTAINER" >/dev/null 2>&1
      DB_CONTAINER=""
    fi
  fi
  if [ "$DB_OK" != 1 ]; then
    EPG="$WORK/embedded-postgres"
    mkdir -p "$EPG"
    if npm i --prefix "$EPG" --no-audit --no-fund --silent embedded-postgres@17.10.0-beta.17 >"$WORK/epg-npm.log" 2>&1; then
      DB_PORT="$(free_port)"
      cat >"$EPG/run.mjs" <<'EOF'
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import path from "node:path";
const require = createRequire(path.join(process.env.EPG, "package.json"));
const { default: EmbeddedPostgres } = await import(require.resolve("embedded-postgres"));
const pg = new EmbeddedPostgres({
  databaseDir: path.join(process.env.EPG, "data"),
  user: "otohime",
  password: "otohime",
  port: Number(process.env.DB_PORT),
  persistent: false,
  onLog: () => {},
});
await pg.initialise();
await pg.start();
await pg.createDatabase("otohime");
writeFileSync(path.join(process.env.EPG, "ready"), "1");
const stop = () => pg.stop().finally(() => process.exit(0));
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
setInterval(() => {}, 1 << 30);
EOF
      set -m
      EPG="$EPG" DB_PORT="$DB_PORT" node "$EPG/run.mjs" >"$WORK/epg.log" 2>&1 &
      DB_PID=$!
      set +m
      for _ in $(seq 1 120); do
        [ -f "$EPG/ready" ] && break
        kill -0 "$DB_PID" 2>/dev/null || break
        sleep 0.5
      done
      export DATABASE_URL="postgresql://otohime:otohime@127.0.0.1:$DB_PORT/otohime"
      if [ -f "$EPG/ready" ] && pgq 'select 1' >/dev/null 2>&1; then
        DB_OK=1
        echo "# database: embedded-postgres on 127.0.0.1:$DB_PORT"
      else
        tail -n 5 "$WORK/epg.log" | sed 's/^/#   /'
      fi
    else
      tail -n 5 "$WORK/epg-npm.log" | sed 's/^/#   /'
    fi
  fi
  [ "$DB_OK" = 1 ] || fail "database: DATABASE_URL does not answer, docker Postgres and embedded-postgres did not start"
fi

if [ "$LOCAL" = 1 ]; then
  export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-placeholder-not-a-real-secret-0123456789abcdef}"
  export BETTER_AUTH_URL="$BASE_URL"
  export GITHUB_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"

  if curl -s -o /dev/null --max-time 2 "$BASE_URL/"; then
    fail "port: something already listens on port $PORT; set PORT to a free port"
  fi
  if ! npm run db:migrate >"$WORK/migrate.log" 2>&1; then
    tail -n 20 "$WORK/migrate.log"
    fail "migrate: npm run db:migrate failed"
  fi
  if [ "${SKIP_BUILD:-}" != "1" ]; then
    if ! npm run build >"$WORK/build.log" 2>&1; then
      cat "$WORK/build.log"
      fail "build: npm run build failed"
    fi
  fi
  # Not NODE_ENV=test, which turns Better Auth's origin checks off.
  set -m
  NODE_ENV=production ./node_modules/.bin/next start -p "$PORT" >"$WORK/server.log" 2>&1 &
  SERVER_PID=$!
  set +m
  READY_TRIES=60
else
  READY_TRIES=30
fi

READY=0
for _ in $(seq 1 "$READY_TRIES"); do
  if curl -fs -o /dev/null --max-time 5 "$BASE_URL/api/health"; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  [ "$LOCAL" -eq 1 ] && [ -s "$WORK/server.log" ] && tail -n 20 "$WORK/server.log"
  fail "ready: $BASE_URL/api/health did not answer after $READY_TRIES tries"
fi

PW="$WORK/playwright"
mkdir -p "$PW"
if ! npm i --prefix "$PW" --no-audit --no-fund --silent playwright@1.64.0 >"$WORK/npm.log" 2>&1; then
  tail -n 20 "$WORK/npm.log"
  fail "playwright: npm i playwright failed"
fi
# A CI runner (GitHub's ubuntu image, passwordless sudo) also gets the shell's system libraries.
DEPS=""
[ -n "${CI:-}" ] && [ "$(uname)" = Linux ] && DEPS="--with-deps"
if ! "$PW/node_modules/.bin/playwright" install chromium --only-shell $DEPS >"$WORK/browser.log" 2>&1; then
  tail -n 20 "$WORK/browser.log"
  fail "playwright: install chromium --only-shell $DEPS failed"
fi

export BASE_URL DATABASE_URL PW_PREFIX="$PW" PROBE_RUN="$RUN"
node "$ROOT/scripts/probe-motion-signed-in.mjs"
STATUS=$?
if [ "$STATUS" -ne 0 ] && [ "$LOCAL" -eq 1 ] && [ -s "$WORK/server.log" ]; then
  echo "# server.log (last 20 lines):"
  tail -n 20 "$WORK/server.log"
fi
exit "$STATUS"
