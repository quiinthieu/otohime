#!/usr/bin/env bash
# Walk Planisphere and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-planisphere.sh                                   # build + next start on :4037, walk it
#   SKIP_BUILD=1 PORT=4038 bash scripts/walk-planisphere.sh            # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-planisphere.sh      # walk a deployed URL, no build or start
#
# Env: PORT (4037), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# Rendered things are counted by attribute form (data-star=") because App Router repeats the
# server's text in the inline RSC payload.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4037}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-planisphere.XXXXXX")"
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

# up_names <key>: the text of the data-up line, as served.
up_names() {
  grep -oE 'data-up="">[^<]*' "$WORK/$1.body" | head -n 1 | sed -E 's/^data-up="">//'
}

# up_lists <key> <name> / up_omits <key> <name>
up_lists() {
  up_names "$1" | grep -qF -- "$2" || { echo "the up line is '$(up_names "$1")', want $2"; return 1; }
}
up_omits() {
  local line
  line="$(up_names "$1")"
  [ -n "$line" ] || { echo "no data-up line"; return 1; }
  ! printf '%s' "$line" | grep -qF -- "$2" || { echo "the up line names $2: $line"; return 1; }
}

# selected <key> <slug>: that city's option is the selected one, in either attribute order.
selected() {
  grep -oE '<option[^>]*>' "$WORK/$1.body" | grep -F "value=\"$2\"" | grep -qF 'selected' || { echo "option $2 is not selected"; return 1; }
}

# form_is_get <key>: the one <form> is method="get" with action="/planisphere", in either order.
form_is_get() {
  local tag
  tag="$(grep -oE '<form[^>]*>' "$WORK/$1.body" | head -n 1)"
  printf '%s' "$tag" | grep -qF 'method="get"' && printf '%s' "$tag" | grep -qF 'action="/planisphere"' || { echo "the form is '${tag:-none}'"; return 1; }
}

NODE_TS=(node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)

# The explainer's visible words, counted by the same visibleWords the unit tests use.
WORDS_JS='import { readFileSync } from "node:fs";
import { visibleWords, WORD_CAP } from "./app/(planisphere)/_lib/words.ts";
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

# Zero "use client" files under app/(planisphere) until the island lands.
no_client_files() {
  local files n
  files="$(grep -rlE '^[[:space:]]*["'"'"']use client["'"'"']' 'app/(planisphere)')"
  n="$(printf '%s' "$files" | grep -c .)"
  [ "$n" -eq 0 ] || { echo "found $n \"use client\" files: $(printf '%s' "$files" | tr '\n' ' ')"; return 1; }
}

# Every stylesheet /planisphere links is free of Tailwind and the site's tokens, and one is
# Planisphere's own (the window fill, the reduced-motion block).
planisphere_stylesheets() {
  local hrefs href code i=0 own=0
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/planisphere.body" | sort -u | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
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
    grep -qF -- "prefers-reduced-motion" "$WORK/style-$i.css" && grep -qF -- ".window-fill" "$WORK/style-$i.css" && own=1
  done
  [ "$i" -ge 1 ] || { echo "no stylesheets found"; return 1; }
  [ "$own" -eq 1 ] || { echo "no stylesheet with .window-fill and prefers-reduced-motion"; return 1; }
}

TOKYO='/planisphere?city=tokyo&date=2026-10-20&hour=21'

get planisphere /planisphere
get tokyo "$TOKYO"
get noon '/planisphere?city=hcmc&date=2026-10-20&hour=12'
get sydney '/planisphere?city=sydney&date=2026-10-20&hour=21'
get bad '/planisphere?city=nope&date=x&hour=99'
get projects /projects
get home /
get shore /shore
get capsule /capsule
get orrery /orrery
get elements /elements
get vinyl /vinyl
get rotor /rotor

# The page
check "/planisphere returns 200" status_is planisphere 200
check "/planisphere title is Planisphere" has planisphere '<title>Planisphere</title>'
check "/planisphere build-sha" build_sha_matches planisphere
check "/planisphere has no site sidebar" lacks planisphere 'aria-label="Main"'
check "/planisphere links home" has planisphere 'href="/"'
check "/planisphere links the project list" has planisphere 'href="/projects"'
check "/planisphere has exactly one GET form" count_eq planisphere 'method="get"' 1
check "/planisphere's form is a GET to /planisphere" form_is_get planisphere
check "/planisphere has a city select" has planisphere '<select name="city"'
check "/planisphere has a date field" has planisphere 'name="date"'
check "/planisphere has an hour range" has planisphere 'name="hour"'
check "/planisphere has the Show button" has planisphere '>Show</button>'
check "/planisphere streams no B: template" lacks planisphere '<template id="B:'
check "/planisphere streams no \$RC" lacks planisphere '$RC'
check "/planisphere selects Ho Chi Minh City by default" selected planisphere hcmc
check "/planisphere has the chart's title and description" count_eq planisphere 'id="wheel-title"' 1
check "/planisphere explainer is at most 120 words" explainer_within_cap planisphere
check "/planisphere links d3-celestial" has planisphere 'href="https://github.com/ofrohn/d3-celestial"'
check "/planisphere links VizieR V/137D" has planisphere 'V/137D"'
check "/planisphere links the IAU" has planisphere 'href="https://www.iau.org/'
check "/planisphere links Orrery" has planisphere 'href="/orrery"'
check "/planisphere stylesheets are Planisphere's own" planisphere_stylesheets
check "no \"use client\" file under app/(planisphere)" no_client_files

# Tokyo, 2026-10-20 21:00: the north disc, Vega up and Sirius not
check "Tokyo returns 200" status_is tokyo 200
check "Tokyo draws at least 400 stars" count_ge tokyo 'data-star=""' 400
check "Tokyo draws at least 80 constellation lines" count_ge tokyo 'data-line=""' 80
check "Tokyo has the compass N" count_ge tokyo 'data-compass="N"' 1
check "Tokyo has the compass E" count_ge tokyo 'data-compass="E"' 1
check "Tokyo has the compass S" count_ge tokyo 'data-compass="S"' 1
check "Tokyo has the compass W" count_ge tokyo 'data-compass="W"' 1
check "Tokyo has one Moon" count_eq tokyo 'data-moon=""' 1
check "Tokyo has one Sun marker" count_eq tokyo 'data-sun=""' 1
check "Tokyo has the ecliptic" count_ge tokyo 'data-ecliptic=""' 1
check "Tokyo shows the Moon's phase" count_eq tokyo 'data-phase="' 1
check "Tokyo is the north disc" has tokyo 'data-hemisphere="north"'
check "Tokyo's option is selected" selected tokyo tokyo
check "Tokyo is not daytime at 21:00" lacks tokyo 'data-daylight'
check "Tokyo's up line names Vega" up_lists tokyo Vega
check "Tokyo's up line leaves out Sirius" up_omits tokyo Sirius
check "Tokyo keeps its date in the form" has tokyo 'value="2026-10-20"'

# Ho Chi Minh City at noon is daytime
check "Ho Chi Minh City at noon returns 200" status_is noon 200
check "Ho Chi Minh City at noon shows the daytime window" has noon 'data-daylight'
check "Ho Chi Minh City at noon says the Sun is up" has noon 'The Sun is up over Ho Chi Minh City at this hour.'

# Sydney is the south disc
check "Sydney returns 200" status_is sydney 200
check "Sydney is the south disc" has sydney 'data-hemisphere="south"'
check "Sydney draws at least 400 stars" count_ge sydney 'data-star=""' 400

# Bad values fall back
check "bad query values return 200" status_is bad 200
check "bad query values select Ho Chi Minh City" selected bad hcmc
check "bad query values still draw the north disc" has bad 'data-hemisphere="north"'

# Weight
check "/planisphere is under 400 KB" size_le planisphere 400000
check "Tokyo is under 400 KB" size_le tokyo 400000
check "Ho Chi Minh City at noon is under 400 KB" size_le noon 400000
check "Sydney is under 400 KB" size_le sydney 400000
check "bad query values are under 400 KB" size_le bad 400000

# The project list and the other pages
check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /planisphere once" count_eq projects 'href="/planisphere"' 1
check "/projects has Planisphere's note" has projects 'Tonight&#x27;s sky for your city, on a star wheel drawn in ink.'
check "/projects links /rotor" count_ge projects 'href="/rotor"' 1
check "/projects links /orrery" count_ge projects 'href="/orrery"' 1
check "/projects links /vinyl" count_ge projects 'href="/vinyl"' 1
check "/ returns 200" status_is home 200
check "/shore returns 200" status_is shore 200
check "/capsule returns 200" status_is capsule 200
check "/orrery returns 200" status_is orrery 200
check "/elements returns 200" status_is elements 200
check "/vinyl returns 200" status_is vinyl 200
check "/rotor returns 200" status_is rotor 200

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
