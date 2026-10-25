#!/usr/bin/env bash
# Probe the Work page's pipeline simulation (components/pipeline.tsx) in headless Chromium, one "ok -" / "not ok -"
# line per check.
#
#   bash scripts/probe-pipeline.sh                                  # build + next start on :4095, probe it
#   SKIP_BUILD=1 PORT=4096 bash scripts/probe-pipeline.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/probe-pipeline.sh     # probe a deployed URL, no build or start
#   SHOTS=/tmp/pipeline bash scripts/probe-pipeline.sh              # also keep screenshots to look at (never commit)
#
# On /work at 1366x768 and 390x844 (isMobile, hasTouch), light and dark: the simulation sits after the intro with the
# Conveyor, Stack and Server rack kept, says it is illustrative, and starts still (zero counters, no packet, no
# figure timer, no mutation). Backfill delivers eight through all three pipes, and every sample's drawing agrees with
# its counters (packets per place = In flight / Queue / Stored, Lag = Sent - Shown = packets drawn, dashboard bars).
# Pause holds the queue while the source keeps sending, comes to rest with no timer, and Resume drains it in order. A
# hidden document and a scrolled-away figure stop the clock and the drawing; seen again, it finishes. Repeated
# backfills stay within the 32-packet cap with one timer at most, and a full paused queue drains in bounded time.
# Under reduced motion (from load and switched on live, paused or not) every press settles at once with no timer.
# The chips work by keyboard with a visible focus ring, the station labels fit, nothing scrolls sideways and no
# request leaves the site. Negative controls: an altered counter fails the agreement check, a swallowed
# visibilitychange fails the hidden stop, a bypassed reduced-motion read fails the settlement check and a disabled
# Backfill handler fails the delivery check. No console or page error anywhere.
#
# Env: PORT (4095, or a free port when that default is busy; a port Next reserves is bumped by 10), BASE_URL
# (remote mode), SKIP_BUILD=1, EXPECT_SHA (checked if set), SHOTS=<dir> to keep screenshots (never committed).
# Playwright is installed into a temp prefix at run time; package.json stays unchanged.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT_SET="${PORT:+1}"
PORT="${PORT:-4095}"
case "$PORT" in
  1719|1720|1723|2049|3659|4045|5060|5061|6000|6566|6665|6666|6667|6668|6669|6697|10080)
    echo "note: next refuses port $PORT as reserved; serving on $((PORT + 10)) instead"
    PORT=$((PORT + 10))
    ;;
esac
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
SHOTS="${SHOTS:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-pipeline.XXXXXX")"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    kill -TERM -- "-$SERVER_PID" 2>/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 -- "-$SERVER_PID" 2>/dev/null || break
      sleep 0.5
    done
    kill -KILL -- "-$SERVER_PID" 2>/dev/null
  fi
  rm -rf "$WORK"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

if [ -z "$BASE_URL" ]; then
  LOCAL=1
  BASE_URL="http://localhost:$PORT"
  export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-placeholder-not-a-real-secret-0123456789abcdef}"
  export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:$PORT}"
  export DATABASE_URL="${DATABASE_URL:-postgresql://otohime:otohime@127.0.0.1:9/otohime}"
  export GITHUB_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"
  READY_TRIES=60

  # A busy default port (another probe on a shared host) falls back to a free one; an explicit PORT is refused.
  if curl -s -o /dev/null --max-time 2 "$BASE_URL/"; then
    if [ -n "$PORT_SET" ]; then
      echo "not ok - port: something already listens on port $PORT; set PORT to a free port"
      exit 1
    fi
    FREE="$(node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
    echo "note: default port $PORT is busy; serving on free port $FREE instead"
    [ "$BETTER_AUTH_URL" = "$BASE_URL" ] && export BETTER_AUTH_URL="http://localhost:$FREE"
    PORT="$FREE"
    BASE_URL="http://localhost:$PORT"
  fi

  if [ "${SKIP_BUILD:-}" != "1" ]; then
    if ! npm run build >"$WORK/build.log" 2>&1; then
      echo "not ok - build: npm run build failed; log:"
      cat "$WORK/build.log"
      exit 1
    fi
  fi

  set -m
  ./node_modules/.bin/next start -p "$PORT" >"$WORK/server.log" 2>&1 &
  SERVER_PID=$!
  set +m
else
  LOCAL=0
  BASE_URL="${BASE_URL%/}"
  READY_TRIES=5
fi

READY=0
for _ in $(seq 1 "$READY_TRIES"); do
  if curl -s -o /dev/null --max-time 5 "$BASE_URL/"; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "not ok - ready: nothing answered at $BASE_URL after $READY_TRIES tries"
  [ "$LOCAL" -eq 1 ] && [ -s "$WORK/server.log" ] && tail -n 20 "$WORK/server.log"
  echo "probe: 0 ok, 1 failed"
  exit 1
fi
# The answer must come from our own server, not one that won the port first.
if [ "$LOCAL" -eq 1 ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "not ok - ready: our next start on port $PORT exited; another server answered. log:"
  tail -n 20 "$WORK/server.log"
  echo "probe: 0 ok, 1 failed"
  exit 1
fi

PW="$WORK/playwright"
mkdir -p "$PW"
if ! npm i --prefix "$PW" --no-audit --no-fund --silent playwright@1.64.0 >"$WORK/npm.log" 2>&1; then
  echo "not ok - playwright: npm i playwright failed; log:"
  tail -n 20 "$WORK/npm.log"
  echo "probe: 0 ok, 1 failed"
  exit 1
fi
if ! "$PW/node_modules/.bin/playwright" install chromium --only-shell >"$WORK/browser.log" 2>&1; then
  echo "not ok - playwright: install chromium --only-shell failed; log:"
  tail -n 20 "$WORK/browser.log"
  echo "probe: 0 ok, 1 failed"
  exit 1
fi

export BASE_URL EXPECT_SHA SHOTS PW_PREFIX="$PW"
node "$ROOT/scripts/probe-pipeline.mjs"
