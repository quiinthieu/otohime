#!/usr/bin/env bash
# Walk /sketches and run the headless Chromium browser probe, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-sketches.sh                                         # build + next start on :4081, walk + probe
#   SKIP_BUILD=1 EXPECT_PEOPLE=0 bash scripts/walk-sketches.sh            # reuse .next build, assert 12-study pre-activation state
#   SKIP_BUILD=1 EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh           # reuse .next build, assert 22-study activated state
#   BASE_URL=https://otohime.dev EXPECT_PEOPLE=10 bash scripts/walk-sketches.sh  # read-only remote deployment mode
#
# Env: PORT (4081), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect),
#      EXPECT_PEOPLE (0 or 10; defaults to the record count in content/portraits.json), SKIP_BUILD=1.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT="${PORT:-4081}"
case "$PORT" in
  1719|1720|1723|2049|3659|4045|5060|5061|6000|6566|6665|6666|6667|6668|6669|6697|10080)
    echo "note: next refuses port $PORT as reserved; serving on $((PORT + 10)) instead"
    PORT=$((PORT + 10))
    ;;
esac

BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
if [ -z "${EXPECT_PEOPLE:-}" ]; then
  EXPECT_PEOPLE="$(node -e 'const r=JSON.parse(require("fs").readFileSync("content/portraits.json","utf8")); console.log(Array.isArray(r)?r.length:(r.records||[]).length);')"
fi
export EXPECT_PEOPLE

WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-sketches.XXXXXX")"
SERVER_PID=""
OK=0
FAILED=0

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

check() {
  local name="$1" out
  shift
  if out="$("$@" 2>&1)"; then
    OK=$((OK + 1))
    echo "ok - $name"
  else
    FAILED=$((FAILED + 1))
    echo "not ok - $name: $(printf '%s' "$out" | tr '\n' ' ' | cut -c1-300)"
  fi
}

if [ -z "$BASE_URL" ]; then
  LOCAL=1
  BASE_URL="http://localhost:$PORT"
  export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-placeholder-not-a-real-secret-0123456789abcdef}"
  export BETTER_AUTH_URL="${BETTER_AUTH_URL:-http://localhost:$PORT}"
  export DATABASE_URL="${DATABASE_URL:-postgresql://otohime:otohime@127.0.0.1:9/otohime}"
  if [ "${SKIP_BUILD:-}" = "1" ] && [ -z "$EXPECT_SHA" ] && [ -z "${GITHUB_SHA:-}" ]; then
    ANY_SHA_OR_DEV=1
  fi
  export GITHUB_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"
  [ -n "${ANY_SHA_OR_DEV:-}" ] || EXPECT_SHA="${EXPECT_SHA:-$GITHUB_SHA}"
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
  if curl -s -o /dev/null --max-time 5 "$BASE_URL/sketches"; then
    READY=1
    break
  fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then
  echo "not ok - ready: nothing answered at $BASE_URL/sketches after $READY_TRIES tries"
  [ "$LOCAL" -eq 1 ] && [ -s "$WORK/server.log" ] && tail -n 20 "$WORK/server.log"
  echo "walk: 0 ok, 1 failed"
  exit 1
fi

get() {
  local code
  code="$(curl -s --max-time 30 -D "$WORK/$1.headers" -o "$WORK/$1.body" -w '%{http_code}' "$BASE_URL$2")"
  printf '%s' "$code" >"$WORK/$1.status"
}

status_is() {
  local got
  got="$(cat "$WORK/$1.status" 2>/dev/null)"
  [ "$got" = "$2" ] || { echo "expected HTTP $2, got ${got:-none}"; return 1; }
}

has() {
  [ -f "$WORK/$1.body" ] && grep -qF -- "$2" "$WORK/$1.body" || { echo "missing: $2"; return 1; }
}

lacks() {
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  ! grep -qF -- "$2" "$WORK/$1.body" || { echo "unexpected: $2"; return 1; }
}

count_eq() {
  local n
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  n="$(grep -oF -- "$2" "$WORK/$1.body" | grep -c .)"
  [ "$n" -eq "$3" ] || { echo "found $n of '$2', want exactly $3"; return 1; }
}

build_sha_matches() {
  local sha
  sha="$(grep -oE '<meta name="build-sha" content="[^"]*"' "$WORK/sketches.body" | head -n 1 | sed -E 's/.*content="([^"]*)"/\1/')"
  if [ -n "$EXPECT_SHA" ]; then
    [ "$sha" = "$EXPECT_SHA" ] || { echo "build-sha is '${sha:-none}', want $EXPECT_SHA"; return 1; }
  elif [ -n "${ANY_SHA_OR_DEV:-}" ]; then
    printf '%s' "$sha" | grep -qE '^([0-9a-f]{40}|dev)$' || { echo "build-sha is '${sha:-none}', want 40 hex or dev"; return 1; }
  else
    printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { echo "build-sha is '${sha:-none}', want 40 hex"; return 1; }
  fi
}

get sketches /sketches
get dl_unknown /sketches/download/99_Unknown.png
get dl_extparam '/sketches/download/01_Quiet_Reader.png?url=https://example.com/evil.png'

check "/sketches returns 200" status_is sketches 200
check "/sketches build-sha" build_sha_matches
check "/sketches retains Fig. 07" has sketches '07'
check "/sketches has Places section" has sketches 'id="places"'
check "/sketches has Small things section" has sketches 'id="objects"'
FIGURES=$((12 + ${EXPECT_PEOPLE:-0}))
check "/sketches wraps each of $FIGURES pictures in one sheet" count_eq sketches 'class="sheet"' "$FIGURES"
check "/sketches gives each sheet one paper wash" count_eq sketches 'class="sheet-wash"' "$FIGURES"
check "/sketches gives each sheet one pathLength=1 ink frame" count_eq sketches 'pathLength="1"' "$FIGURES"
check "/sketches stands the sheets still without JavaScript" has sketches '<noscript><style>.sheet-wash,.sheet-frame path{animation:none!important}</style></noscript>'
check "/sketches/download/99_Unknown.png returns 404" status_is dl_unknown 404
check "/sketches/download rejects arbitrary external URL parameters with 400" status_is dl_extparam 400

if [ "$EXPECT_PEOPLE" = "0" ]; then
  check "/sketches hint is places and small things" has sketches 'places and small things'
  check "/sketches intro is twelve studies" has sketches 'Twelve studies from one sketchbook.'
  check "/sketches has no People section before activation" lacks sketches 'id="people"'
  check "/sketches has 12 figures before activation" count_eq sketches '<figure>' 12
  get dl_reader /sketches/download/01_Quiet_Reader.png
  check "/sketches/download/01_Quiet_Reader.png returns 404 before activation" status_is dl_reader 404
elif [ "$EXPECT_PEOPLE" = "10" ]; then
  check "/sketches hint is places, small things and people" has sketches 'places, small things and people'
  check "/sketches intro is twenty-two studies" has sketches 'Twenty-two studies from one sketchbook.'
  check "/sketches has People section" has sketches 'id="people"'
  check "/sketches has 22 figures when activated" count_eq sketches '<figure>' 22
  for fn in \
    01_Quiet_Reader.png \
    02_Flower_Girl.png \
    03_Rainy_Afternoon.png \
    04_Cafe_Dreamer.png \
    05_Autumn_Wanderer.png \
    06_Violinist.png \
    07_Morning_by_the_Window.png \
    08_Painter.png \
    09_Spring_Breeze.png \
    10_Letter_Writer.png; do
    check "/sketches links /sketches/download/$fn" has sketches "/sketches/download/$fn"
  done
else
  FAILED=$((FAILED + 1))
  echo "not ok - EXPECT_PEOPLE must be 0 or 10, got '$EXPECT_PEOPLE'"
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

export BASE_URL PW_PREFIX="$PW" EXPECT_SHA="${EXPECT_SHA:-}" ANY_SHA_OR_DEV="${ANY_SHA_OR_DEV:-}"
if ! node "$ROOT/scripts/probe-sketches.mjs"; then
  FAILED=$((FAILED + 1))
fi

no_server_left() {
  ! curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/" || { echo "something still answers on port $PORT"; return 1; }
}

if [ "$LOCAL" -eq 1 ]; then
  kill -TERM -- "-$SERVER_PID" 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 -- "-$SERVER_PID" 2>/dev/null || break
    sleep 0.5
  done
  kill -KILL -- "-$SERVER_PID" 2>/dev/null
  SERVER_PID=""
  check "no server left on port $PORT" no_server_left
fi

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
