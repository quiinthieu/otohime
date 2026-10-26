#!/usr/bin/env bash
# Probe Ask the console through its model tier, against a fake Anthropic server and a throwaway Postgres,
# one "ok -" / "not ok -" line per check.
#
#   bash scripts/probe-ask-llm-fake.sh                 # build, then probe
#   SKIP_BUILD=1 bash scripts/probe-ask-llm-fake.sh    # reuse an existing .next build
#
# Starts, each on a free port: the fake Anthropic server (scripts/probe-ask-llm-fake.mjs fake-anthropic), a
# Postgres of its own (initdb and pg_ctl when both are on PATH, else docker) with db/migrations applied, and
# next start with ASK_LLM=1, a fake ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL at the fake, BETTER_AUTH_URL at the
# app and DATABASE_URL at the throwaway database. Chromium then drives the console at 1366x768 and 390x844
# (scripts/probe-ask-llm-fake.mjs on: the checks are listed there). A second next start with ASK_LLM unset
# (the key still set) is the off control: the console sends no POST and the fake sees nothing.
# Each phase then runs the production tier probe (scripts/probe-ask-tier.sh) against the local server: on, it
# passes with the fake's lines and exactly one fake request, and fails on its POST check while the fake answers
# non-JSON (the negative control); off, it fails on its GET check, sends nothing to the fake, and its forced
# failures still print the canned answer.
# Nothing reaches Anthropic, Vercel or a shared database. Everything started is torn down on exit.
# With no Postgres to start (no initdb/pg_ctl and no docker), the probe stops and fails as "environment".
# The off switch alone is scripts/probe-ask-llm.sh.
#
# Env: SKIP_BUILD=1, PG_IMAGE (docker image, default postgres:16-alpine).
# Playwright is installed into a temp prefix at run time; package.json stays unchanged.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

# A short work dir: Chromium's socket path under a long TMPDIR is too long to bind.
WORK="$(mktemp -d /tmp/palf.XXXXXX)"
FAKE_PID=""
SERVER_PID=""
PG_KIND=""
PG_NAME=""
FAILED=0

note_fail() { FAILED=$((FAILED + 1)); echo "not ok - $1"; }

stop_group() { # pid
  [ -n "$1" ] || return 0
  kill -TERM -- "-$1" 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 -- "-$1" 2>/dev/null || break
    sleep 0.5
  done
  kill -KILL -- "-$1" 2>/dev/null
}

stop_server() { stop_group "$SERVER_PID"; SERVER_PID=""; }

cleanup() {
  stop_server
  stop_group "$FAKE_PID"
  FAKE_PID=""
  if [ "$PG_KIND" = docker ] && [ -n "$PG_NAME" ]; then
    docker rm -f "$PG_NAME" >/dev/null 2>&1
  elif [ "$PG_KIND" = native ]; then
    pg_ctl -D "$WORK/pgdata" -m immediate -w stop >/dev/null 2>&1
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

free_port() { node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }

# Postgres first: without one there is nothing to probe, and that is the environment's fault, not a pass.
if command -v initdb >/dev/null 2>&1 && command -v pg_ctl >/dev/null 2>&1; then
  PG_KIND=native
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  PG_KIND=docker
else
  echo "not ok - environment: no Postgres (neither initdb and pg_ctl nor a working docker is on PATH)"
  echo "probe: not run (cause=environment)"
  exit 1
fi
echo "# postgres: $PG_KIND"

export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-placeholder-not-a-real-secret-0123456789abcdef}"
export GITHUB_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"

if [ "${SKIP_BUILD:-}" != "1" ]; then
  if ! env -u ASK_LLM -u ANTHROPIC_API_KEY npm run build >"$WORK/build.log" 2>&1; then
    echo "not ok - build: npm run build failed; log:"
    tail -n 40 "$WORK/build.log"
    exit 1
  fi
fi

PW="$WORK/playwright"
mkdir -p "$PW"
if ! npm i --prefix "$PW" --no-audit --no-fund --silent playwright@1.64.0 >"$WORK/npm.log" 2>&1; then
  echo "not ok - playwright: npm i playwright failed; log:"
  tail -n 20 "$WORK/npm.log"
  exit 1
fi
if ! "$PW/node_modules/.bin/playwright" install chromium --only-shell >"$WORK/browser.log" 2>&1; then
  echo "not ok - playwright: install chromium --only-shell failed; log:"
  tail -n 20 "$WORK/browser.log"
  exit 1
fi

# The fake Anthropic server, in its own process group; it writes its port once it listens.
set -m
node "$ROOT/scripts/probe-ask-llm-fake.mjs" fake-anthropic "$WORK/fake.port" >"$WORK/fake.log" 2>&1 &
FAKE_PID=$!
set +m
for _ in $(seq 1 50); do
  [ -s "$WORK/fake.port" ] && break
  sleep 0.1
done
if [ ! -s "$WORK/fake.port" ]; then
  echo "not ok - fake: the fake Anthropic server did not start; log:"
  tail -n 20 "$WORK/fake.log"
  exit 1
fi
FAKE_URL="http://127.0.0.1:$(cat "$WORK/fake.port")"
echo "ok - fake: the fake Anthropic server listens at $FAKE_URL"

# The throwaway Postgres.
PG_PORT="$(free_port)"
if [ "$PG_KIND" = native ]; then
  mkdir -p "$WORK/pgsock"
  if ! initdb -D "$WORK/pgdata" -U probe -A trust --no-sync >"$WORK/pg.log" 2>&1 ||
    ! pg_ctl -D "$WORK/pgdata" -l "$WORK/pg.log" -w -t 60 \
      -o "-p $PG_PORT -c listen_addresses=127.0.0.1 -k $WORK/pgsock -c fsync=off" start >>"$WORK/pg.log" 2>&1; then
    echo "not ok - postgres: initdb/pg_ctl did not start; log:"
    tail -n 20 "$WORK/pg.log"
    exit 1
  fi
  DATABASE_URL="postgresql://probe@127.0.0.1:$PG_PORT/postgres"
else
  PG_NAME="probe-ask-llm-fake-$$-$RANDOM"
  if ! docker run -d --rm --name "$PG_NAME" -p "127.0.0.1:$PG_PORT:5432" \
    -e POSTGRES_USER=probe -e POSTGRES_PASSWORD=probe -e POSTGRES_DB=probe \
    "${PG_IMAGE:-postgres:16-alpine}" -c fsync=off >"$WORK/pg.log" 2>&1; then
    echo "not ok - postgres: docker run failed; log:"
    tail -n 20 "$WORK/pg.log"
    PG_NAME=""
    exit 1
  fi
  # Over TCP only: the image's init-time server listens on the socket alone, so this waits for the real one.
  PG_READY=0
  for _ in $(seq 1 60); do
    if docker exec "$PG_NAME" pg_isready -h 127.0.0.1 -U probe -d probe >/dev/null 2>&1; then
      PG_READY=1
      break
    fi
    sleep 1
  done
  if [ "$PG_READY" -ne 1 ]; then
    echo "not ok - postgres: the container never became ready; log:"
    docker logs "$PG_NAME" 2>&1 | tail -n 20
    exit 1
  fi
  DATABASE_URL="postgresql://probe:probe@127.0.0.1:$PG_PORT/probe"
fi
export DATABASE_URL

# db/migrations, in the journal's order, through the project's own pg.
if ! node -e '
const fs = require("fs");
const { Client } = require("pg");
(async () => {
  const journal = JSON.parse(fs.readFileSync("db/migrations/meta/_journal.json", "utf8"));
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  for (let i = 0; ; i++) {
    try { await db.connect(); break; } catch (e) { if (i >= 20) throw e; await new Promise((r) => setTimeout(r, 500)); }
  }
  for (const { tag } of [...journal.entries].sort((a, b) => a.idx - b.idx)) {
    const sql = fs.readFileSync(`db/migrations/${tag}.sql`, "utf8");
    for (const stmt of sql.split("--> statement-breakpoint")) if (stmt.trim()) await db.query(stmt);
    console.log(`applied ${tag}`);
  }
  const { rows } = await db.query("select to_regclass($1) as t", ["public.ask_usage"]);
  await db.end();
  if (!rows[0].t) throw new Error("no ask_usage table after the migrations");
})().catch((e) => { console.error(e.message); process.exit(1); });
' >"$WORK/migrate.log" 2>&1; then
  echo "not ok - postgres: applying db/migrations failed; log:"
  tail -n 20 "$WORK/migrate.log"
  exit 1
fi
echo "ok - postgres: a throwaway $PG_KIND Postgres on port $PG_PORT, $(grep -c '^applied' "$WORK/migrate.log") migrations applied"

PORT="$(free_port)"
BASE_URL="http://localhost:$PORT"
FAKE_KEY="probe-fake-key-not-real"

# start <label> [VAR=value ...]: next start in its own process group with the model env cleared unless given,
# then wait until it answers and check it is ours.
start() {
  local label="$1"
  shift
  set -m
  env -u ASK_LLM -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL BETTER_AUTH_URL="$BASE_URL" "$@" \
    ./node_modules/.bin/next start -p "$PORT" >"$WORK/server-$label.log" 2>&1 &
  SERVER_PID=$!
  set +m
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null --max-time 5 "$BASE_URL/"; then
      kill -0 "$SERVER_PID" 2>/dev/null && return 0
      break
    fi
    kill -0 "$SERVER_PID" 2>/dev/null || break
    sleep 1
  done
  echo "not ok - ready ($label): our next start on port $PORT did not answer; log:"
  tail -n 20 "$WORK/server-$label.log"
  return 1
}

run_probe() { # phase
  BASE_URL="$BASE_URL" FAKE_URL="$FAKE_URL" FAKE_KEY="$FAKE_KEY" PW_PREFIX="$PW" TMPDIR="$WORK" \
    node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
    "$ROOT/scripts/probe-ask-llm-fake.mjs" "$1"
}

fake_count() { curl -s "$FAKE_URL/__probe/requests" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>console.log(JSON.parse(s).length))'; }
fake_mode() { curl -s -o /dev/null -X POST "$FAKE_URL/__probe/mode?m=$1"; }

# tier_probe <label>: scripts/probe-ask-tier.sh at the local server, its output kept as comments.
# Sets TIER_EXIT, TIER_OUT and TIER_CALLS (requests the fake got during the run).
tier_probe() {
  local before
  before="$(fake_count)"
  TIER_OUT="$(BASE_URL="$BASE_URL" PW_PREFIX="$PW" TMPDIR="$WORK" bash "$ROOT/scripts/probe-ask-tier.sh" 2>&1)"
  TIER_EXIT=$?
  TIER_CALLS=$(($(fake_count) - before))
  printf '%s\n' "$TIER_OUT" | sed "s/^/#   tier $1| /"
}

tier_ok() { # name, condition result
  if [ "$2" -eq 0 ]; then echo "ok - $1"; else note_fail "$1"; fi
}

has() { printf '%s\n' "$TIER_OUT" | grep -q -- "$1"; }
lacks_fallback_miss() { ! printf '%s\n' "$TIER_OUT" | grep -q '^not ok - .*forced'; }

if start on ASK_LLM=1 ANTHROPIC_API_KEY="$FAKE_KEY" ANTHROPIC_BASE_URL="$FAKE_URL"; then
  run_probe on || note_fail "on: the model-tier checks failed (above)"
  fake_mode json
  tier_probe on
  [ "$TIER_EXIT" -eq 0 ] && has '^ok - GET /api/ask is 200 with enabled:true' && has '^ok - POST /api/ask .* answers with cited model lines' && has '^ok - the cited page /work answers 200'
  tier_ok "on: tier probe passes: GET enabled, one POST with the fake's lines citing /work (exit $TIER_EXIT)" $?
  [ "$TIER_CALLS" -eq 1 ]
  tier_ok "on: tier probe: its one POST reached the fake model exactly once ($TIER_CALLS)" $?
  has '^ok - 390x844 touch, forced a 429 with no reply: the receipt prints the canned answer' && lacks_fallback_miss
  tier_ok "on: tier probe: every forced failure prints the canned answer with no error" $?
  fake_mode nonjson
  tier_probe on-control
  fake_mode json
  [ "$TIER_EXIT" -eq 1 ] && has '^ok - GET /api/ask is 200 with enabled:true' && has '^not ok - POST /api/ask .*: mode "offline"' && [ "$TIER_CALLS" -eq 1 ]
  tier_ok "on: control: with the fake answering non-JSON, the tier probe's POST check fails and it exits 1 (exit $TIER_EXIT)" $?
else
  note_fail "on: server started"
fi
stop_server

# Negative control: the same build and key with the switch unset.
if start off ANTHROPIC_API_KEY="$FAKE_KEY" ANTHROPIC_BASE_URL="$FAKE_URL"; then
  run_probe off || note_fail "off: the off-switch checks failed (above)"
  tier_probe off
  [ "$TIER_EXIT" -eq 1 ] && has '^not ok - GET /api/ask is 200 with enabled:true: 404' && has '^not ok - POST /api/ask answers with cited model lines: not sent'
  tier_ok "off: tier probe fails on GET /api/ask 404 and sends no POST (exit $TIER_EXIT)" $?
  [ "$TIER_CALLS" -eq 0 ]
  tier_ok "off: tier probe: the fake model saw no request ($TIER_CALLS)" $?
  has '^ok - 1366x768, forced the tier off (GET 404): the receipt prints the canned answer' && lacks_fallback_miss
  tier_ok "off: tier probe: every forced failure prints the canned answer with no error" $?
else
  note_fail "off: server started"
fi
stop_server

if [ "$FAILED" -ne 0 ]; then
  echo "probe: failed ($FAILED part(s))"
  for f in "$WORK"/server-*.log; do
    echo "# tail of $(basename "$f"):"
    tail -n 15 "$f"
  done
  exit 1
fi
echo "probe: passed"
