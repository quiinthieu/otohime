#!/usr/bin/env bash
# Probe the /projects cartridges in headless Chromium, one "ok -" / "not ok -" line per check.
#
#   bash scripts/probe-cartridges.sh                                  # build + next start on :4091, probe it
#   SKIP_BUILD=1 PORT=4092 bash scripts/probe-cartridges.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/probe-cartridges.sh     # probe a deployed URL, no build or start
#   SHOTS_DIR=/tmp/carts bash scripts/probe-cartridges.sh             # also keep screenshots to look at (never commit)
#
# The expected rows come from content/site.ts in this checkout (title, href, status, note, in order). At 1366x768
# and at 390x844 (isMobile, hasTouch), light and dark, and with JavaScript off: one li.rise per project with its
# --i, one link per row named by the title alone, its href and project-* --vt, the label text, the cartridge shell
# (shadow, body, corner, connector, stamp) hidden from assistive tech, no filter anywhere on the shelf, nothing
# wider than the viewport, every label's text inside its label, dark text on the swatch at >= 4.5:1, and two
# columns of at least 150px on the phone. On the desktop a hover and a keyboard focus lift the cartridge 6px, a
# press pushes it 2px in without navigating, and a click on the cartridge's body follows the link; on the phone a
# tap on the body does. Reduced motion (from the start, and switched on mid-hover) keeps every cartridge still.
# Clicking a cartridge to two projects carries the typed hop, and the title's group starts at the title's own
# size, not the stretched card's. Negative controls: a wrong href, a lift knocked out, a label forced to overflow
# and a filter on one card each fail the same checks. No console or page error anywhere.
#
# Env: PORT (4091, or a free port when that default is busy; a port Next reserves is bumped by 10), BASE_URL (remote mode), SKIP_BUILD=1, SHOTS_DIR.
# Playwright is installed into a temp prefix at run time; package.json stays unchanged.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT_SET="${PORT:+1}"
PORT="${PORT:-4091}"
case "$PORT" in
  1719|1720|1723|2049|3659|4045|5060|5061|6000|6566|6665|6666|6667|6668|6669|6697|10080)
    echo "note: next refuses port $PORT as reserved; serving on $((PORT + 10)) instead"
    PORT=$((PORT + 10))
    ;;
esac
BASE_URL="${BASE_URL:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-cartridges.XXXXXX")"
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

# The rows this checkout defines, in order: the probe compares the page against them.
if ! node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  --input-type=module -e 'const { site } = await import(process.argv[1]); console.log(JSON.stringify(site.projectList));' \
  "$ROOT/content/site.ts" >"$WORK/expected.json" 2>"$WORK/expected.log"; then
  echo "not ok - content: reading content/site.ts failed; log:"
  tail -n 20 "$WORK/expected.log"
  echo "probe: 0 ok, 1 failed"
  exit 1
fi

export BASE_URL PW_PREFIX="$PW" EXPECTED="$WORK/expected.json"
node "$ROOT/scripts/probe-cartridges.mjs"
