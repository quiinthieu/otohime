#!/usr/bin/env bash
# Walk Sun and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-sun.sh                                  # build + next start on :4027, walk it
#   SKIP_BUILD=1 PORT=4028 bash scripts/walk-sun.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-sun.sh     # walk a deployed URL, no build or start
#
# Env: PORT (4027), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4027}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-sun.XXXXXX")"
SERVER_PID=""
OK=0
FAILED=0

cleanup() {
  if [ -n "$SERVER_PID" ]; then
    # The server was started under job control, so its pid is its process group id.
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

# check <name> <command...>: the command's output is the detail when it returns non-zero.
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
  export DATABASE_URL="${DATABASE_URL:-postgresql://otohime:otohime@localhost:5432/otohime}"
  export GITHUB_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"
  EXPECT_SHA="${EXPECT_SHA:-$GITHUB_SHA}"
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
  echo "walk: 0 ok, 1 failed"
  exit 1
fi

# get <key> <path>: fetch once; status in $WORK/<key>.status, body in $WORK/<key>.body.
get() {
  local code
  code="$(curl -s --max-time 30 -o "$WORK/$1.body" -w '%{http_code}' "$BASE_URL$2")"
  printf '%s' "$code" >"$WORK/$1.status"
}

# status_is <key> <code>
status_is() {
  local got
  got="$(cat "$WORK/$1.status" 2>/dev/null)"
  [ "$got" = "$2" ] || { echo "expected HTTP $2, got ${got:-none}"; return 1; }
}

# has <key> <fixed-text> / lacks <key> <fixed-text>
has() {
  [ -f "$WORK/$1.body" ] && grep -qF -- "$2" "$WORK/$1.body" || { echo "missing: $2"; return 1; }
}
lacks() {
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  ! grep -qF -- "$2" "$WORK/$1.body" || { echo "unexpected: $2"; return 1; }
}

# count_ge <key> <fixed-text> <min>
count_ge() {
  local n
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  n="$(grep -oF -- "$2" "$WORK/$1.body" | grep -c .)"
  [ "$n" -ge "$3" ] || { echo "found $n of '$2', want at least $3"; return 1; }
}

# count_eq <key> <fixed-text> <n>
count_eq() {
  local n
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  n="$(grep -oF -- "$2" "$WORK/$1.body" | grep -c .)"
  [ "$n" -eq "$3" ] || { echo "found $n of '$2', want exactly $3"; return 1; }
}

build_sha_matches() {
  local sha
  sha="$(grep -oE '<meta name="build-sha" content="[^"]*"' "$WORK/sun.body" | head -n 1 | sed -E 's/.*content="([^"]*)"/\1/')"
  if [ -n "$EXPECT_SHA" ]; then
    [ "$sha" = "$EXPECT_SHA" ] || { echo "build-sha is '${sha:-none}', want $EXPECT_SHA"; return 1; }
  else
    printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { echo "build-sha is '${sha:-none}', want 40 hex"; return 1; }
  fi
}

# Sun links exactly one /_next/static/ stylesheet; fetch it and inspect it.
sun_stylesheet() {
  local hrefs n href code
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/sun.body" | sort -u)"
  n="$(printf '%s' "$hrefs" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n stylesheets, want exactly 1"; return 1; }
  href="$(printf '%s' "$hrefs" | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
  code="$(curl -s --max-time 30 -o "$WORK/sun.css" -w '%{http_code}' "$BASE_URL$href")"
  [ "$code" = "200" ] || { echo "stylesheet $href returned HTTP $code"; return 1; }
  [ -s "$WORK/sun.css" ] || { echo "stylesheet $href is empty"; return 1; }
  grep -qF -- "prefers-reduced-motion" "$WORK/sun.css" || { echo "stylesheet $href has no prefers-reduced-motion"; return 1; }
  for bad in --tw- tailwind --color-paper; do
    if grep -qiF -- "$bad" "$WORK/sun.css"; then
      echo "stylesheet $href contains '$bad'"
      return 1
    fi
  done
}

# The stylesheet sun_stylesheet fetched draws the ink on (task 3's motion).
stylesheet_draws() {
  [ -s "$WORK/sun.css" ] || { echo "no stylesheet fetched"; return 1; }
  grep -qF -- "sun-draw" "$WORK/sun.css" || { echo "stylesheet has no sun-draw"; return 1; }
}

# Exactly three stages inside the <ol data-life> strip.
life_strip() {
  local strip n
  strip="$(tr '\n' ' ' <"$WORK/sun.body" | grep -oE '<ol[^>]*data-life[^>]*>.*</ol>' | sed -E 's#(</ol>).*#\1#')"
  [ -n "$strip" ] || { echo "no <ol data-life>"; return 1; }
  n="$(printf '%s' "$strip" | grep -oF 'data-stage="' | grep -c .)"
  [ "$n" -eq 3 ] || { echo "found $n stages in data-life, want exactly 3"; return 1; }
}

# The visible words on /sun, counted by the same visibleWords the unit tests use.
WORDS_JS='import { readFileSync } from "node:fs";
import { visibleWords, WORD_CAP } from "./app/(sun)/_lib/words.ts";
const html = readFileSync(process.argv[1], "utf8");
console.log(`${visibleWords(html)} ${WORD_CAP}`);'
count_words() {
  node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
    --input-type=module -e "$WORDS_JS" "$WORK/sun.body" 2>/dev/null
}
words_within_cap() {
  [ -n "$WORDS" ] || { echo "the word count failed"; return 1; }
  [ "$WORDS" -le "$WORD_CAP" ] || { echo "$WORDS visible words, the cap is $WORD_CAP"; return 1; }
}

manifest_lists_sun() {
  local f=.next/app-path-routes-manifest.json
  [ -f "$f" ] || { echo "$f not found"; return 1; }
  grep -qF '"/sun"' "$f" || { echo '"/sun" not in manifest'; return 1; }
}

get sun /sun
get projects /projects
get shore /shore
get capsule /capsule
get home /
get work /work
get play /play
get notes /notes
get music /music
get sun_nope /sun/nope
get nonexistent /nonexistent

read -r WORDS WORD_CAP <<<"$(count_words)"
WORDS="${WORDS:-}"
WORD_CAP="${WORD_CAP:-220}"

[ "$LOCAL" -eq 1 ] && check "manifest lists /sun" manifest_lists_sun

check "/sun returns 200" status_is sun 200
check "/sun title is Sun" has sun '<title>Sun</title>'
check "/sun has no site sidebar" lacks sun 'aria-label="Main"'
check "/sun build-sha" build_sha_matches
check "/sun has exactly 6 inked layers" count_eq sun 'data-layer="' 6
check "/sun has exactly 6 callouts" count_eq sun 'data-callout="' 6
check "/sun has exactly 4 badges" count_eq sun 'data-badge="' 4
check "/sun has a 3-stage life strip" life_strip
check "/sun has the core temperature" has sun '15.7 million K'
check "/sun has the photon's trip" has sun '170,000 years'
check "/sun has the light time" has sun '8 min 19 s'
check "/sun has 109 Earths" has sun '>109<'
check "/sun has no buttons" lacks sun '<button'
check "/sun has no live region" lacks sun 'aria-live'
check "/sun has no tour" lacks sun 'data-tour'
check "/sun has at most $WORD_CAP visible words (counted $WORDS)" words_within_cap
check "/sun links NASA's Sun facts" has sun 'href="https://science.nasa.gov/sun/facts/"'
check "/sun links home" has sun 'href="/"'
check "/sun links the project list" has sun 'href="/projects"'
check "/sun stylesheet is Sun's own" sun_stylesheet
check "/sun has exactly 3 ink loops" count_eq sun 'data-loop="' 3
check "/sun stylesheet draws the ink on" stylesheet_draws

check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /sun once" count_eq projects 'href="/sun"' 1
check "/projects links /shore" count_ge projects 'href="/shore"' 1
check "/projects links /capsule" count_ge projects 'href="/capsule"' 1

check "/shore returns 200" status_is shore 200
check "/capsule returns 200" status_is capsule 200

check "/ returns 200" status_is home 200
check "/work returns 200" status_is work 200
check "/play returns 200" status_is play 200
check "/notes returns 200" status_is notes 200
check "/music returns 200" status_is music 200

check "/sun/nope returns 404" status_is sun_nope 404
check "/sun/nope is the parcel page" has sun_nope 'Nothing in this parcel'
check "/nonexistent returns 404" status_is nonexistent 404
check "/nonexistent is the parcel page" has nonexistent 'Nothing in this parcel'

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
