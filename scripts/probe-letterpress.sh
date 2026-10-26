#!/usr/bin/env bash
# Probe the letterpress keys (app/(site)/letterpress.css) and their press cue (components/press-sound.tsx) in
# headless Chromium, one "ok -" / "not ok -" line per check.
#
#   bash scripts/probe-letterpress.sh                                  # build + next start on :4151, probe it
#   SKIP_BUILD=1 PORT=4152 bash scripts/probe-letterpress.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/probe-letterpress.sh     # probe a deployed URL, no build or start
#
# On /, /play, /projects and /notes at 1366x768 and 390x844 (isMobile, hasTouch): every .btn and .nav-item has an
# inset shadow and the grain image. A held press on a key translates it 1px down, and 0 under reduced motion.
# A fake AudioContext, installed before any page script, counts every oscillator start with its wave and pitch.
# With sound on, a click on a button, a nav item or a cartridge title starts exactly one press cue (triangle, 140
# then 90 Hz), two clicks inside 60 ms start one and two clicks apart start two; the speaker turned on starts only
# its "open"; a key inside a control with its own sound (the pocket console's menu links) starts nothing. With
# sound off no click makes a context or starts anything. axe's color-contrast rule finds nothing on the four pages
# in light and in dark. Under forced colours every key drops its shadow and grain and keeps its borders.
# Negative control: with data-own-sound stripped from the speaker, the toggle check catches the doubled press.
# No console or page error anywhere.
#
# Env: PORT (4151, or a free port when that default is busy; a port Next reserves is bumped by 10), BASE_URL (remote mode), SKIP_BUILD=1.
# Playwright and axe-core are installed into a temp prefix at run time; package.json stays unchanged.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT_SET="${PORT:+1}"
PORT="${PORT:-4151}"
case "$PORT" in
  1719|1720|1723|2049|3659|4045|5060|5061|6000|6566|6665|6666|6667|6668|6669|6697|10080)
    echo "note: next refuses port $PORT as reserved; serving on $((PORT + 10)) instead"
    PORT=$((PORT + 10))
    ;;
esac
BASE_URL="${BASE_URL:-}"
# Under /tmp, not $TMPDIR: Chromium's socket path must stay short, and a lease's TMPDIR can be long.
WORK="$(mktemp -d /tmp/probe-letterpress.XXXXXX)"
export TMPDIR="$WORK"
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
node "$ROOT/scripts/probe-letterpress.mjs"
