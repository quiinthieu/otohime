#!/usr/bin/env bash
# Walk Barometer and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-barometer.sh                                   # build + next start on :4051, walk it
#   SKIP_BUILD=1 PORT=4052 bash scripts/walk-barometer.sh            # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-barometer.sh      # walk a deployed URL, no build or start
#
# Env: PORT (4051), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# Rendered things are counted by attribute form (data-face=") because App Router repeats the
# server's text in the inline RSC payload.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4051}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-barometer.XXXXXX")"
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

# get <key> <path>: fetch once, never following a redirect; status in $WORK/<key>.status,
# body in $WORK/<key>.body, bytes in $WORK/<key>.size.
get() {
  local out
  out="$(curl -s --max-time 30 -o "$WORK/$1.body" -w '%{http_code} %{size_download}' "$BASE_URL$2")"
  printf '%s' "${out%% *}" >"$WORK/$1.status"
  printf '%s' "${out#* }" >"$WORK/$1.size"
}

# status_is <key> <code>
status_is() {
  local got
  got="$(cat "$WORK/$1.status" 2>/dev/null)"
  [ "$got" = "$2" ] || { echo "expected HTTP $2, got ${got:-none}"; return 1; }
}

# size_le <key> <bytes>
size_le() {
  local n
  n="$(cat "$WORK/$1.size" 2>/dev/null)"
  [ -n "$n" ] || { echo "no size"; return 1; }
  [ "$n" -le "$2" ] || { echo "$n bytes, the cap is $2"; return 1; }
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

# build_sha_matches <key>
build_sha_matches() {
  local sha
  sha="$(grep -oE '<meta name="build-sha" content="[^"]*"' "$WORK/$1.body" | head -n 1 | sed -E 's/.*content="([^"]*)"/\1/')"
  if [ -n "$EXPECT_SHA" ]; then
    [ "$sha" = "$EXPECT_SHA" ] || { echo "build-sha is '${sha:-none}', want $EXPECT_SHA"; return 1; }
  else
    printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { echo "build-sha is '${sha:-none}', want 40 hex"; return 1; }
  fi
}

# The feed may be down when this runs, so either face is accepted on every page and the
# face seen is printed. The sea-level dial is checked only on the reading face.
# selected <key> <slug>: that city's option is the selected one, in either attribute order.
selected() {
  grep -oE '<option[^>]*>' "$WORK/$1.body" | grep -F "value=\"$2\"" | grep -qF 'selected' || { echo "option $2 is not selected"; return 1; }
}

# form_is_get <key>: the one <form> is method="get" with action="/barometer", in either order.
form_is_get() {
  local tag
  tag="$(grep -oE '<form[^>]*>' "$WORK/$1.body" | head -n 1)"
  printf '%s' "$tag" | grep -qF 'method="get"' && printf '%s' "$tag" | grep -qF 'action="/barometer"' || { echo "the form is '${tag:-none}'"; return 1; }
}

# face_of <key>: reading or quiet, from the one data-face attribute.
face_of() {
  grep -oE 'data-face="[a-z]*"' "$WORK/$1.body" | head -n 1 | sed -E 's/data-face="([a-z]*)"/\1/'
}

# one_face <key>: exactly one data-face, reading or quiet; prints which as a detail on failure only.
one_face() {
  local n face
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  n="$(grep -oE 'data-face="' "$WORK/$1.body" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n data-face attributes, want exactly 1"; return 1; }
  face="$(face_of "$1")"
  [ "$face" = "reading" ] || [ "$face" = "quiet" ] || { echo "the face is '${face:-none}'"; return 1; }
}

# sentence <key>: the text of the data-sentence line, as served.
sentence() {
  grep -oE 'data-sentence="">[^<]*' "$WORK/$1.body" | head -n 1 | sed -E 's/^data-sentence="">//'
}

# sentence_matches_face <key>: the quiet face says so; the reading face's pressure is in 900-1100 hPa.
sentence_matches_face() {
  local face line hpa
  face="$(face_of "$1")"
  line="$(sentence "$1")"
  [ -n "$line" ] || { echo "no data-sentence line"; return 1; }
  if [ "$face" = "quiet" ]; then
    [ "$line" = "The station is quiet." ] || { echo "the quiet face says '$line'"; return 1; }
    return 0
  fi
  hpa="$(printf '%s' "$line" | grep -oE '[0-9]+\.[0-9] hPa' | head -n 1 | sed -E 's/\.[0-9] hPa//')"
  [ -n "$hpa" ] || { echo "no pressure in '$line'"; return 1; }
  [ "$hpa" -ge 900 ] && [ "$hpa" -le 1100 ] || { echo "pressure $hpa hPa is outside 900-1100 in '$line'"; return 1; }
}

# says_city <key> <name>: the reading's sentence (reading face) or the drawing's title names the city.
says_city() {
  has "$1" "Barometer: $2"
}

NODE_TS=(node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)

# The explainer's visible words, counted by the same visibleWords the unit tests use.
WORDS_JS='import { readFileSync } from "node:fs";
import { visibleWords, WORD_CAP } from "./app/(barometer)/_lib/words.ts";
const html = readFileSync(process.argv[1], "utf8");
console.log(`${visibleWords(html)} ${WORD_CAP}`);'
explainer_within_cap() {
  local words cap
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  tr '\n' ' ' <"$WORK/$1.body" | grep -oE '<section[^>]*data-explainer[^>]*>.*</section>' | sed -E 's#(</section>).*#\1#' >"$WORK/explainer.html"
  [ -s "$WORK/explainer.html" ] || { echo "no <section data-explainer>"; return 1; }
  read -r words cap <<<"$("${NODE_TS[@]}" --input-type=module -e "$WORDS_JS" "$WORK/explainer.html" 2>/dev/null)"
  [ -n "${words:-}" ] && [ -n "${cap:-}" ] || { echo "the word count failed"; return 1; }
  [ "$words" -ge 20 ] || { echo "only $words words: the explainer is missing"; return 1; }
  [ "$words" -le "$cap" ] || { echo "$words explainer words, the cap is $cap"; return 1; }
}

# Exactly one "use client" file under app/(barometer), and it names no roughjs or ink.
one_client_file() {
  local files n
  files="$(grep -rlE '^[[:space:]]*["'"'"']use client["'"'"']' 'app/(barometer)')"
  n="$(printf '%s' "$files" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n \"use client\" files: $(printf '%s' "$files" | tr '\n' ' ')"; return 1; }
  ! grep -nE 'roughjs|_lib/ink' "$files" || { echo "the island names roughjs or ink: $files"; return 1; }
}

# Every stylesheet /barometer links is free of Tailwind and the site's tokens, and one is
# Barometer's own (the dial face, the reduced-motion block).
barometer_stylesheets() {
  local hrefs href code i=0 own=0
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/barometer.body" | sort -u | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
  for href in $hrefs; do
    i=$((i + 1))
    code="$(curl -s --max-time 30 -o "$WORK/style-$i.css" -w '%{http_code}' "$BASE_URL$href")"
    [ "$code" = "200" ] || { echo "stylesheet $href returned HTTP $code"; return 1; }
    for bad in --tw- tailwind --color-paper; do
      if grep -qiF -- "$bad" "$WORK/style-$i.css"; then
        echo "stylesheet $href contains '$bad'"
        return 1
      fi
    done
    grep -qF -- "prefers-reduced-motion" "$WORK/style-$i.css" && grep -qF -- ".dial-face" "$WORK/style-$i.css" && own=1
  done
  [ "$i" -ge 1 ] || { echo "no stylesheets found"; return 1; }
  [ "$own" -eq 1 ] || { echo "no stylesheet with .dial-face and prefers-reduced-motion"; return 1; }
}

# The feed's host is server-only: it appears in no served HTML and in no script chunk the page references.
no_feed_host_in_chunks() {
  local srcs src i=0
  srcs="$(grep -oE '/_next/static/chunks/[^"]*\.js' "$WORK/barometer.body" | sort -u)"
  for src in $srcs; do
    i=$((i + 1))
    curl -s --max-time 30 -o "$WORK/chunk-$i.js" "$BASE_URL$src"
    if grep -qF -- "api.open-meteo.com" "$WORK/chunk-$i.js"; then
      echo "$src names api.open-meteo.com"
      return 1
    fi
  done
  [ "$i" -ge 1 ] || { echo "no script chunks found"; return 1; }
}

get barometer /barometer
get tokyo '/barometer?city=tokyo'
get mexico '/barometer?city=mexico-city'
get bad '/barometer?city=nope'
get projects /projects
get home /
get planisphere /planisphere
get rotor /rotor

for k in barometer tokyo mexico bad; do
  case "$k" in
    barometer) label="/barometer" ;;
    tokyo) label="Tokyo" ;;
    mexico) label="Mexico City" ;;
    bad) label="?city=nope" ;;
  esac
  check "$label returns 200" status_is "$k" 200
  check "$label build-sha" build_sha_matches "$k"
  check "$label has no site sidebar" lacks "$k" 'aria-label="Main"'
  check "$label links the project list" has "$k" 'href="/projects"'
  check "$label draws exactly one face, reading or quiet" one_face "$k"
  echo "# $label face: $(face_of "$k")"
  check "$label's sentence fits its face" sentence_matches_face "$k"
  check "$label credits Open-Meteo once" count_eq "$k" 'href="https://open-meteo.com/"' 1
  check "$label names the licence" has "$k" 'CC BY 4.0'
  check "$label links the licence" has "$k" 'href="https://creativecommons.org/licenses/by/4.0/"'
  check "$label has exactly one GET form" count_eq "$k" 'method="get"' 1
  check "$label has 24 cities" count_eq "$k" '<option value="' 24
  check "$label has the Read button" has "$k" '>Read</button>'
  check "$label streams no B: template" lacks "$k" '<template id="B:'
  check "$label streams no \$RC" lacks "$k" '$RC'
  check "$label is under 200 KB" size_le "$k" 200000
  check "$label never names the feed host" lacks "$k" 'api.open-meteo.com'
done

check "/barometer's form is a GET to /barometer" form_is_get barometer
check "/barometer selects Ho Chi Minh City by default" selected barometer hcmc
check "/barometer names Ho Chi Minh City" says_city barometer 'Ho Chi Minh City'
check "?city=nope selects Ho Chi Minh City" selected bad hcmc
check "?city=nope names Ho Chi Minh City" says_city bad 'Ho Chi Minh City'
check "?city=tokyo selects Tokyo" selected tokyo tokyo
check "?city=tokyo names Tokyo" says_city tokyo 'Tokyo'
check "?city=mexico-city selects Mexico City" selected mexico mexico-city
check "?city=mexico-city names Mexico City" says_city mexico 'Mexico City'

check "/barometer title is Barometer" has barometer '<title>Barometer</title>'
check "/barometer has the set hand drawn" has barometer 'data-set-hand'
check "/barometer explainer is at most 120 words" explainer_within_cap barometer
check "/barometer stylesheets are Barometer's own" barometer_stylesheets
check "no script chunk names the feed host" no_feed_host_in_chunks
check "one \"use client\" file under app/(barometer), without rough.js" one_client_file

check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /barometer once" count_eq projects 'href="/barometer"' 1
check "/projects has Barometer's note" has projects 'A brass weather station for your city, read every quarter hour.'
check "/projects links /planisphere" count_ge projects 'href="/planisphere"' 1
check "/projects links /rotor" count_ge projects 'href="/rotor"' 1
check "/ returns 200" status_is home 200
check "/planisphere returns 200" status_is planisphere 200
check "/rotor returns 200" status_is rotor 200

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
