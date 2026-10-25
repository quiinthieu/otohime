#!/usr/bin/env bash
# Probe the machines' drawing hands, re-roll and boil in headless Chromium, one "ok -" / "not ok -" line per check.
#
#   bash scripts/probe-ink-modes.sh                                  # build + next start on :4089, probe it
#   SKIP_BUILD=1 PORT=4090 bash scripts/probe-ink-modes.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/probe-ink-modes.sh     # probe a deployed URL, no build or start
#   SHOTS=/tmp/ink bash scripts/probe-ink-modes.sh                   # also keep screenshots to look at (never commit)
#
# On / and /work at 1366x768 and 390x844 (isMobile, hasTouch), light and dark: every machine and a plain server Figure
# (/notes) draw the house ink filter primitive for primitive (seeds 3 and 8, stroke 2.4); each of Ink,
# Pencil, Crayon and Watercolour puts its own primitives and line weight in the actual filter, and their rendered
# pixels differ from each other while the line work stays dark (>= 4.5:1 on the paper) and present; Re-roll moves
# every turbulence seed and nothing else; picking Ink again restores the house filter. Boil is off at rest (no
# seed change, no extra timer); pressed, the first turbulence seed changes about six times a second (counted
# from attribute mutations, never faster than ~8 Hz); pressing another machine's Boil hands it over (one boiling
# figure on the page); a hidden document and a scrolled-away figure stop it and it resumes when seen; pressing
# again stops it and its timer. Under reduced motion (from load and switched on live) Boil is disabled and stops,
# while Hand and Re-roll still work. The hand radios and Re-roll work by keyboard with a visible focus ring, and
# nothing scrolls sideways. Negative controls: a doubled figure clock fails the rate bound, two identical Ink
# renders fail the distinction check, a bypassed reduced-motion read fails the reduced-motion stop, and a
# swallowed visibilitychange fails the hidden stop. No console or page error anywhere.
#
# Env: PORT (4089, or a free port when that default is busy; a port Next reserves is bumped by 10), BASE_URL
# (remote mode), SKIP_BUILD=1, EXPECT_SHA (checked if set), SHOTS=<dir> to keep screenshots (never committed).
# Playwright is installed into a temp prefix at run time; package.json stays unchanged.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT_SET="${PORT:+1}"
PORT="${PORT:-4089}"
case "$PORT" in
  1719|1720|1723|2049|3659|4045|5060|5061|6000|6566|6665|6666|6667|6668|6669|6697|10080)
    echo "note: next refuses port $PORT as reserved; serving on $((PORT + 10)) instead"
    PORT=$((PORT + 10))
    ;;
esac
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
SHOTS="${SHOTS:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-ink-modes.XXXXXX")"
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
node "$ROOT/scripts/probe-ink-modes.mjs"
