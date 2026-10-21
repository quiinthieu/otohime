#!/usr/bin/env bash
# Probe Structures' machines in headless Chromium, one "ok -" / "not ok -" line per check.
#
#   bash scripts/probe-structures.sh                                  # build + next start on :4073, probe it
#   SKIP_BUILD=1 PORT=4074 bash scripts/probe-structures.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/probe-structures.sh     # probe a deployed URL, no build or start
#
# At 390x844 (isMobile, hasTouch) and 1366x768: on /structures/stack the controls wake up after hydration;
# Push 9 says "9 goes on top." and the drawing's aria-label ends with 9 on top; Pop lists its beats and takes 9
# away; four more pushes fill the pile to 7 and one more is refused with a sentence and an unchanged drawing. On
# /structures/binary-search-tree Find 6 says "Found 6 in 3 steps." no sooner than 1000 ms after the press with
# motion on and within 250 ms under reduced motion; in Step mode three "Next step" presses show the next three
# beats in order; "Insert 1, 2, 3, 4, 5" draws five nodes at strictly increasing heights; Reset brings back the
# worked example; by keyboard alone, Tab to the number box, 4 and Enter run the default move. Nothing scrolls
# sideways at 320 px; axe (wcag2a/aa/21aa) finds nothing serious or critical on /structures and
# /structures/heap, light and dark; no console error or page error anywhere. Every locator is scoped to the
# visible root (.notebook:visible): a soft navigation keeps the previous page hidden in the DOM.
#
# Env: PORT (4073; a port Next reserves is bumped by 10), BASE_URL (remote mode), SKIP_BUILD=1.
# Playwright and axe-core are installed into a temp prefix at run time; package.json stays unchanged.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT="${PORT:-4073}"
case "$PORT" in
  1719|1720|1723|2049|3659|4045|5060|5061|6000|6566|6665|6666|6667|6668|6669|6697|10080)
    echo "note: next refuses port $PORT as reserved; serving on $((PORT + 10)) instead"
    PORT=$((PORT + 10))
    ;;
esac
BASE_URL="${BASE_URL:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-structures.XXXXXX")"
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
if ! npm i --prefix "$PW" --no-audit --no-fund --silent playwright@1.64.0 axe-core@4.11.0 >"$WORK/npm.log" 2>&1; then
  echo "not ok - playwright: npm i (playwright, axe-core) failed; log:"
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
node "$ROOT/scripts/probe-structures.mjs"
