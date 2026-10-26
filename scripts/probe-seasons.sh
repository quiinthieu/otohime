#!/usr/bin/env bash
# Probe the paper almanac in node, then its ambient layer (components/season-layer.tsx) in headless Chromium,
# one "ok" / "FAIL" line per check.
#
#   bash scripts/probe-seasons.sh                                  # build + next start on :4141, probe it
#   SKIP_BUILD=1 PORT=4142 bash scripts/probe-seasons.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/probe-seasons.sh     # probe a deployed URL, no build or start
#
# Node: resolveSeason and the pre-paint script for fixed clocks and zones (scripts/probe-seasons.mjs CHECKS).
# Browser, with the season chosen through localStorage "season" as the dial will: in every season at 1366x768
# (and summer and winter at 390x844) the served HTML holds one empty aria-hidden layer ahead of the masthead;
# hydrated, it is fixed behind the page, pointer-events none, first in <body>, at most 40 elements, only that
# season's bits, each running one animation of transform and opacity only (negative control: an injected r
# animation is reported). A faked document.hidden pauses every bit and showing the tab resumes them (negative
# control: a visible visibilitychange does not pause). A data-season change redraws the layer. Under reduced
# motion, from the start or by a live switch, the layer has no bits and nothing runs; a forced bit gets
# animation none and opacity 0 (negative control: the same bit animates with motion welcome). No console errors.
# Dial (components/season-dial.tsx), with the zone and a fixed clock set on the browser context: Australia/Sydney
# is Auto summer in January and winter in July (negative control: Europe/London is winter in January); one
# radiogroup of five native radios sits between the speaker and the theme toggle; Tab reaches the pick with a
# visible ring, the arrow keys move and wrap the pick, setting data-season, localStorage "season" and the layer at
# once, the pick survives a reload, and Auto clears storage and restores the clock's season. With localStorage
# throwing, the dial is Auto, a pick holds in memory and a reload is Auto again, with no error. At 390px the dial
# folds to one button a tap turns (negative control: at 1366px a click on the pick keeps it). At 390px and 1366px
# the masthead stays 64px with nothing clashing or spilling, nothing in it moves from the first frame, and hiding the
# dial moves neither the brand mark nor the theme toggle (negative controls: a viewport-wide dial and a nudged dial
# are caught).
#
# Env: PORT (4141, or a free port when that default is busy; a port Next reserves is bumped by 10), BASE_URL (remote mode), SKIP_BUILD=1, EXPECT_SHA (checked if set).
# Playwright is installed into a temp prefix at run time; package.json stays unchanged.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT_SET="${PORT:+1}"
PORT="${PORT:-4141}"
case "$PORT" in
  1719|1720|1723|2049|3659|4045|5060|5061|6000|6566|6665|6666|6667|6668|6669|6697|10080)
    echo "note: next refuses port $PORT as reserved; serving on $((PORT + 10)) instead"
    PORT=$((PORT + 10))
    ;;
esac
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-seasons.XXXXXX")"
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

export BASE_URL EXPECT_SHA ROOT PW_PREFIX="$PW"
# --experimental-strip-types: the node checks import lib/seasons.ts itself.
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON "$ROOT/scripts/probe-seasons.mjs"
