#!/usr/bin/env bash
# Walk Orrery and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-orrery.sh                                  # build + next start on :4027, walk it
#   SKIP_BUILD=1 PORT=4028 bash scripts/walk-orrery.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-orrery.sh     # walk a deployed URL, no build or start
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
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-orrery.XXXXXX")"
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
# body in $WORK/<key>.body, bytes in $WORK/<key>.size, redirect target in $WORK/<key>.location.
get() {
  local out
  out="$(curl -s --max-time 30 -o "$WORK/$1.body" -w '%{http_code} %{size_download} %{redirect_url}' "$BASE_URL$2")"
  printf '%s' "${out%% *}" >"$WORK/$1.status"
  out="${out#* }"
  printf '%s' "${out%% *}" >"$WORK/$1.size"
  out="${out#* }"
  printf '%s' "$out" >"$WORK/$1.location"
}

# size_le <key> <bytes>
size_le() {
  local n
  n="$(cat "$WORK/$1.size" 2>/dev/null)"
  [ -n "$n" ] || { echo "no size"; return 1; }
  [ "$n" -le "$2" ] || { echo "$n bytes, the cap is $2"; return 1; }
}

# redirects_to <key> <suffix>: the redirect target ends with the suffix
redirects_to() {
  local loc
  loc="$(cat "$WORK/$1.location" 2>/dev/null)"
  case "$loc" in
    *"$2") return 0 ;;
    *) echo "redirects to '${loc:-nothing}', want ...$2"; return 1 ;;
  esac
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

# The Sun's poster links exactly one stylesheet of Orrery's own and, beside it, at most next/font's chunk
# (@font-face rules and its generated _className / _variable classes for Caveat and Patrick Hand); fetch them,
# keep Orrery's as sun.css and inspect it.
sun_stylesheet() {
  local hrefs href code i=0 own=0 rest
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/body-sun.body" | sort -u | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
  [ -n "$hrefs" ] || { echo "found no stylesheet"; return 1; }
  rm -f "$WORK/sun.css"
  for href in $hrefs; do
    i=$((i + 1))
    code="$(curl -s --max-time 30 -o "$WORK/style-$i.css" -w '%{http_code}' "$BASE_URL$href")"
    [ "$code" = "200" ] || { echo "stylesheet $href returned HTTP $code"; return 1; }
    [ -s "$WORK/style-$i.css" ] || { echo "stylesheet $href is empty"; return 1; }
    for bad in --tw- tailwind --color-paper; do
      if grep -qiF -- "$bad" "$WORK/style-$i.css"; then
        echo "stylesheet $href contains '$bad'"
        return 1
      fi
    done
    if grep -qF -- "prefers-reduced-motion" "$WORK/style-$i.css"; then
      own=$((own + 1))
      cp "$WORK/style-$i.css" "$WORK/sun.css"
    else
      rest="$(tr -d '\n' <"$WORK/style-$i.css" | sed -E 's#/\*[^*]*\*+([^/*][^*]*\*+)*/##g; s/@font-face *\{[^}]*\}//g; s/\.[A-Za-z0-9_-]+_(className|variable) *\{[^}]*\}//g; s/[[:space:]]//g')"
      [ -z "$rest" ] || { echo "stylesheet $href is neither Orrery's nor only next/font's: ${rest:0:80}"; return 1; }
    fi
  done
  [ "$own" -eq 1 ] || { echo "found $own stylesheets with prefers-reduced-motion, want exactly 1"; rm -f "$WORK/sun.css"; return 1; }
}

# The stylesheet sun_stylesheet fetched draws the ink on (task 3's motion).
stylesheet_draws() {
  [ -s "$WORK/sun.css" ] || { echo "no stylesheet fetched"; return 1; }
  grep -qF -- "sun-draw" "$WORK/sun.css" || { echo "stylesheet has no sun-draw"; return 1; }
}

# life_strip <key>: exactly three stages inside the <ol data-life> strip.
life_strip() {
  local strip n
  strip="$(tr '\n' ' ' <"$WORK/$1.body" | grep -oE '<ol[^>]*data-life[^>]*>.*</ol>' | sed -E 's#(</ol>).*#\1#')"
  [ -n "$strip" ] || { echo "no <ol data-life>"; return 1; }
  n="$(printf '%s' "$strip" | grep -oF 'data-stage="' | grep -c .)"
  [ "$n" -eq 3 ] || { echo "found $n stages in data-life, want exactly 3"; return 1; }
}

# links_orrery <key>: a link to /orrery, in the HTML or, as on a notFound() page
# (Elements' too), only in the RSC payload the page renders from.
links_orrery() {
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  grep -qE 'href="/orrery"|\\"href\\":\\"/orrery\\"' "$WORK/$1.body" || { echo "no link to /orrery"; return 1; }
}

NODE_TS=(node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)

# The visible words on a page, counted by the same visibleWords the unit tests use.
WORDS_JS='import { readFileSync } from "node:fs";
import { visibleWords, WORD_CAP } from "./app/(orrery)/_lib/words.ts";
const html = readFileSync(process.argv[1], "utf8");
console.log(`${visibleWords(html)} ${WORD_CAP}`);'
# words_within_cap <key>
words_within_cap() {
  local words cap
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  read -r words cap <<<"$("${NODE_TS[@]}" --input-type=module -e "$WORDS_JS" "$WORK/$1.body" 2>/dev/null)"
  [ -n "${words:-}" ] && [ -n "${cap:-}" ] || { echo "the word count failed"; return 1; }
  [ "$words" -le "$cap" ] || { echo "$words visible words, the cap is $cap"; return 1; }
}

# Every body as "<slug> <layer count> <mark count>", in the one fixed order, read from bodies.ts.
BODIES_JS='import { BODIES } from "./app/(orrery)/_lib/bodies.ts";
for (const b of BODIES) console.log(`${b.slug} ${b.layers.length} ${(b.marks ?? []).length}`);'

manifest_lists() {
  local f=.next/prerender-manifest.json
  [ -f "$f" ] || { echo "$f not found"; return 1; }
  grep -qF "\"$1\"" "$f" || { echo "\"$1\" not in $f"; return 1; }
}

BODY_LIST="$("${NODE_TS[@]}" --input-type=module -e "$BODIES_JS" 2>/dev/null)"
check "bodies.ts lists 14 bodies" test "$(printf '%s\n' "$BODY_LIST" | grep -c .)" -eq 14

get orrery /orrery
while read -r slug _; do
  [ -n "$slug" ] && get "body-$slug" "/orrery/$slug"
done <<<"$BODY_LIST"
get orrery_nope /orrery/nope
get sun /sun
get sun_nope /sun/nope
get projects /projects
get shore /shore
get capsule /capsule
get elements /elements
get vinyl /vinyl
get home /
get work /work
get play /play
get notes /notes
get music /music
get nonexistent /nonexistent

if [ "$LOCAL" -eq 1 ]; then
  check "prerender manifest lists /orrery" manifest_lists /orrery
  check "prerender manifest lists /orrery/betelgeuse" manifest_lists /orrery/betelgeuse
fi

# The index
check "/orrery returns 200" status_is orrery 200
check "/orrery title is Orrery" has orrery '<title>Orrery</title>'
check "/orrery has no site sidebar" lacks orrery 'aria-label="Main"'
check "/orrery build-sha" build_sha_matches orrery
check "/orrery has exactly 14 bodies" count_eq orrery 'data-body="' 14
check "/orrery has the Sun's disc once" count_eq orrery 'data-body="sun"' 1
check "/orrery has exactly 2 size rows" count_eq orrery 'data-row="' 2
check "/orrery has the planets row" has orrery 'data-row="planets"'
check "/orrery has the stars row" has orrery 'data-row="stars"'
check "/orrery has exactly 3 edges" count_eq orrery 'data-edge="' 3
check "/orrery heads the planets row" has orrery 'The planets, to scale'
check "/orrery heads the stars row" has orrery 'The stars, to scale'
while read -r slug _; do
  [ -n "$slug" ] && check "/orrery links /orrery/$slug" count_ge orrery "href=\"/orrery/$slug\"" 1
done <<<"$BODY_LIST"
check "/orrery has at most 220 visible words" words_within_cap orrery
check "/orrery is at most 120000 bytes" size_le orrery 120000
check "/orrery has Saturn's rings" count_eq orrery 'data-mark="rings"' 1
check "/orrery has no hachure" lacks orrery 'class="hachure"'
check "/orrery has no buttons" lacks orrery '<button'
check "/orrery links home" has orrery 'href="/"'
check "/orrery links the project list" has orrery 'href="/projects"'

# Every poster
while read -r slug layers marks; do
  [ -n "$slug" ] || continue
  key="body-$slug"
  check "/orrery/$slug returns 200" status_is "$key" 200
  check "/orrery/$slug has exactly $layers inked layers" count_eq "$key" 'data-layer="' "$layers"
  check "/orrery/$slug has exactly $marks marks" count_eq "$key" 'data-mark="' "$marks"
  check "/orrery/$slug has exactly $layers callouts" count_eq "$key" 'data-callout="' "$layers"
  check "/orrery/$slug has exactly 4 badges" count_eq "$key" 'data-badge="' 4
  check "/orrery/$slug has at most 220 visible words" words_within_cap "$key"
  check "/orrery/$slug links the Orrery" has "$key" 'href="/orrery"'
  check "/orrery/$slug links the project list" has "$key" 'href="/projects"'
  check "/orrery/$slug has Previous / Next" has "$key" 'aria-label="Other bodies"'
  check "/orrery/$slug is at most 300000 bytes" size_le "$key" 300000
  check "/orrery/$slug has no site sidebar" lacks "$key" 'aria-label="Main"'
  check "/orrery/$slug has no buttons" lacks "$key" '<button'
done <<<"$BODY_LIST"

# The Sun's poster, pm-189's checks
check "/orrery/sun title is Sun" has body-sun '<title>Sun · Orrery</title>'
check "/orrery/sun build-sha" build_sha_matches body-sun
check "/orrery/sun has exactly 6 inked layers" count_eq body-sun 'data-layer="' 6
check "/orrery/sun has exactly 6 callouts" count_eq body-sun 'data-callout="' 6
check "/orrery/sun has exactly 4 badges" count_eq body-sun 'data-badge="' 4
check "/orrery/sun has a 3-stage life strip" life_strip body-sun
check "/orrery/sun has the core temperature" has body-sun '15.7 million K'
check "/orrery/sun has the photon's trip" has body-sun '170,000 years'
check "/orrery/sun has the light time" has body-sun '8 min 19 s'
check "/orrery/sun has 109 Earths" has body-sun '>109<'
check "/orrery/sun has no live region" lacks body-sun 'aria-live'
check "/orrery/sun has no tour" lacks body-sun 'data-tour'
check "/orrery/sun links NASA's Sun facts" has body-sun 'href="https://science.nasa.gov/sun/facts/"'
check "/orrery/sun links home" has body-sun 'href="/"'
check "/orrery/sun stylesheet is Orrery's own" sun_stylesheet
check "/orrery/sun has exactly 3 ink loops" count_eq body-sun 'data-loop="' 3
check "/orrery/sun stylesheet draws the ink on" stylesheet_draws
check "/orrery/sun links Next: Mercury" has body-sun 'href="/orrery/mercury"'
check "/orrery/betelgeuse has a 3-stage life strip" life_strip body-betelgeuse

# The marks that make each body itself
check "/orrery/saturn has its rings" has body-saturn 'data-mark="rings"'
check "/orrery/uranus has its rings" has body-uranus 'data-mark="rings"'
check "/orrery/uranus has its tilt" has body-uranus 'data-mark="tilt"'
check "/orrery/jupiter has its bands" has body-jupiter 'data-mark="bands"'
check "/orrery/jupiter has the Great Red Spot" has body-jupiter 'data-mark="great-red-spot"'
check "/orrery/earth has clouds" has body-earth 'data-mark="clouds"'
check "/orrery/mars has a polar cap" has body-mars 'data-mark="polar-cap"'
check "/orrery/neptune has a dark spot" has body-neptune 'data-mark="dark-spot"'
check "/orrery/sirius has its companion" has body-sirius 'data-mark="companion"'
check "/orrery/sirius names Sirius B" has body-sirius 'Sirius B, a white dwarf'
check "/orrery/vega is flattened" has body-vega 'data-mark="flattened"'
check "/orrery/betelgeuse is lumpy" has body-betelgeuse 'data-mark="lumpy"'
check "/orrery/polaris has its pulse rings" has body-polaris 'data-mark="pulse-rings"'
check "/orrery/sun has no marks" lacks body-sun 'data-mark="'
check "/orrery/earth has no life strip" lacks body-earth 'data-life'

check "/orrery/nope returns 404" status_is orrery_nope 404
check "/orrery/nope is the parcel page" has orrery_nope 'Nothing in this parcel'
check "/orrery/nope links the Orrery" links_orrery orrery_nope

check "/sun returns 308" status_is sun 308
check "/sun redirects to /orrery/sun" redirects_to sun /orrery/sun
check "/sun/nope returns 404" status_is sun_nope 404
check "/sun/nope is the parcel page" has sun_nope 'Nothing in this parcel'

check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /orrery once" count_eq projects 'href="/orrery"' 1
check "/projects never links /sun" count_eq projects 'href="/sun"' 0
check "/projects links /shore" count_ge projects 'href="/shore"' 1
check "/projects links /capsule" count_ge projects 'href="/capsule"' 1

check "/shore returns 200" status_is shore 200
check "/capsule returns 200" status_is capsule 200
check "/elements returns 200" status_is elements 200
check "/vinyl returns 200" status_is vinyl 200

check "/ returns 200" status_is home 200
check "/work returns 200" status_is work 200
check "/play returns 200" status_is play 200
check "/notes returns 200" status_is notes 200
check "/music returns 200" status_is music 200

check "/nonexistent returns 404" status_is nonexistent 404
check "/nonexistent is the parcel page" has nonexistent 'Nothing in this parcel'

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
