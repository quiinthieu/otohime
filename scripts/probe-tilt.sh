#!/usr/bin/env bash
# Probe the pocket console's pointer tilt in headless Chromium, one "ok -" / "not ok -" line per check.
#
#   bash scripts/probe-tilt.sh                                  # build + next start on :4083, probe it
#   SKIP_BUILD=1 PORT=4084 bash scripts/probe-tilt.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/probe-tilt.sh     # probe a deployed URL, no build or start
#   SHOTS_DIR=/tmp/tilt bash scripts/probe-tilt.sh              # also keep screenshots to look at (never commit)
#
# On / at 1366x768, light and dark: at rest the console's tilt wrapper has no transform and its shadow is hidden;
# a mouse over the figure turns only that wrapper (every other element's transform is unchanged), the rotation
# read back from the computed matrix stays within 6 degrees across a sweep of edges and corners, leans toward the
# pointer and slides the shadow the other way; leaving resets the transform within 500 ms. A reduced-motion
# preference switched on mid-hover, a hidden document and a client-side hop away (Activity hides the page) each
# put it back at rest; the chips, the arrow keys and A still work, the menu boots, the screen-reader links take
# focus, and nothing scrolls sideways. At 390x844 (isMobile, hasTouch), light and dark, and under reduced motion
# at 1366x768 taps and mouse moves leave the console still while its controls work. Negative controls: with the
# preference guard bypassed (matchMedia forced to match) the reduced-motion stillness check catches the tilt, and
# with the pointerleave listener dropped the leave check catches the stuck pose. No console or page error anywhere.
#
# Env: PORT (4083; a port Next reserves is bumped by 10), BASE_URL (remote mode), SKIP_BUILD=1, SHOTS_DIR.
# Playwright is installed into a temp prefix at run time; package.json stays unchanged.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT="${PORT:-4083}"
case "$PORT" in
  1719|1720|1723|2049|3659|4045|5060|5061|6000|6566|6665|6666|6667|6668|6669|6697|10080)
    echo "note: next refuses port $PORT as reserved; serving on $((PORT + 10)) instead"
    PORT=$((PORT + 10))
    ;;
esac
BASE_URL="${BASE_URL:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-tilt.XXXXXX")"
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

  if curl -s -o /dev/null --max-time 2 "$BASE_URL/"; then
    echo "not ok - port: something already listens on port $PORT; set PORT to a free port"
    exit 1
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

export BASE_URL PW_PREFIX="$PW"
node "$ROOT/scripts/probe-tilt.mjs"
