#!/usr/bin/env bash
# Walk Design system and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-design-system.sh                                  # build + next start on :4075, walk it
#   SKIP_BUILD=1 PORT=4076 bash scripts/walk-design-system.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-design-system.sh     # walk a deployed URL, no build or start
#
# Env: PORT (4075), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely; with SKIP_BUILD=1 and neither set, the reused
# build's stamp is unknown, so a 40-hex sha or "dev" passes), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD's line counter pads its output, so string compares fail.
# Rendered things are counted by attribute form (data-part=", <symbol id="part-) because App Router
# repeats the server's text in the inline RSC payload; visible text is only checked for presence.
# The page is read as a JavaScript-off visitor gets it: the board must already be the finished drawing
# at the start (27 stamps, nine parts), the counter's and the rule line's start sentences, and the
# knobs greyed in one disabled fieldset.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4075}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-design-system.XXXXXX")"
SERVER_PID=""
OK=0
FAILED=0

# Sources must be https on these hosts (SOURCE_HOSTS in app/(design-system)/_lib/copy.ts).
ALLOWED='^https://(en\.wikipedia\.org|design-system\.service\.gov\.uk|m3\.material\.io|developer\.apple\.com|developer\.mozilla\.org|www\.w3\.org)(/|$)'
# The four drawings, in page order.
FIGURES=(box board follow here)
# The seven knobs and the six sister projects the board can dress as.
KNOBS=(paper spot corner gap size speed face)
DRESSES=(shore capsule orrery elements articles structures)

# kill_group <pid>: the process was started under job control, so its pid is its process group id.
kill_group() {
  [ -n "$1" ] || return 0
  kill -TERM -- "-$1" 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 -- "-$1" 2>/dev/null || break
    sleep 0.5
  done
  kill -KILL -- "-$1" 2>/dev/null
}

cleanup() {
  kill_group "$SERVER_PID"
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

ready=0
for _ in $(seq 1 "$READY_TRIES"); do
  if curl -s -o /dev/null --max-time 5 "$BASE_URL/"; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "not ok - ready: nothing answered at $BASE_URL after $READY_TRIES tries"
  [ "$LOCAL" -eq 1 ] && [ -s "$WORK/server.log" ] && tail -n 20 "$WORK/server.log"
  echo "walk: $OK ok, $((FAILED + 1)) failed"
  exit 1
fi

# get <key> <path>: fetch once, never following a redirect; status in $WORK/<key>.status,
# body in $WORK/<key>.body, bytes in $WORK/<key>.size.
get() {
  local out
  out="$(LC_ALL=C curl -s --max-time 30 -o "$WORK/$1.body" -w '%{http_code} %{size_download}' "$BASE_URL$2")"
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
  elif [ -n "${ANY_SHA_OR_DEV:-}" ]; then
    printf '%s' "$sha" | grep -qE '^([0-9a-f]{40}|dev)$' || { echo "build-sha is '${sha:-none}', want 40 hex or dev"; return 1; }
  else
    printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { echo "build-sha is '${sha:-none}', want 40 hex"; return 1; }
  fi
}

# one_h1_with <key> <text>: exactly one <h1 in the page, and its element contains the text.
one_h1_with() {
  local h1
  count_eq "$1" '<h1' 1 || return 1
  h1="$(tr '\n' ' ' <"$WORK/$1.body" | grep -oE '<h1[^>]*>[^<]*' | head -n 1)"
  printf '%s' "$h1" | grep -qF -- "$2" || { echo "the h1 is '${h1:-none}', want it to contain $2"; return 1; }
}

# sources_ok <key>: a data-sources box with at least three links, every one https on the allowlist.
sources_ok() {
  local box hrefs n bad
  box="$(tr '\n' ' ' <"$WORK/$1.body" | grep -oE '<aside[^>]*data-sources[^>]*>.*</aside>' | sed -E 's#(</aside>).*#\1#')"
  [ -n "$box" ] || { echo "no <aside data-sources>"; return 1; }
  hrefs="$(printf '%s' "$box" | grep -oE 'href="[^"]*"' | sed -E 's/^href="(.*)"$/\1/')"
  n="$(printf '%s\n' "$hrefs" | grep -cE '^https://')"
  [ "$n" -ge 3 ] || { echo "found $n https:// source links, want at least 3"; return 1; }
  bad="$(printf '%s\n' "$hrefs" | grep -vE "$ALLOWED" | grep .)"
  [ -z "$bad" ] || { echo "off the allowlist: $(printf '%s' "$bad" | tr '\n' ' ')"; return 1; }
}

NODE_TS=(node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)

# The page's visible words, counted by the same visibleWords the unit tests use.
WORDS_JS='import { readFileSync } from "node:fs";
import { visibleWords, WORD_CAP } from "./app/(design-system)/_lib/words.ts";
const html = readFileSync(process.argv[1], "utf8");
console.log(`${visibleWords(html)} ${WORD_CAP}`);'
words_within_cap() {
  local words cap
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  read -r words cap <<<"$("${NODE_TS[@]}" --input-type=module -e "$WORDS_JS" "$WORK/$1.body" 2>/dev/null)"
  [ -n "${words:-}" ] && [ -n "${cap:-}" ] || { echo "the word count failed"; return 1; }
  [ "$words" -ge 180 ] || { echo "only $words words: the page is missing"; return 1; }
  [ "$words" -le "$cap" ] || { echo "$words visible words, the cap is $cap"; return 1; }
}

# The start board's sentences, from the engine itself: the counter's SAY.start and rule(DEFAULT).
SAYS_JS='import { DEFAULT, SAY } from "./app/(design-system)/_lib/board.ts";
import { rule } from "./app/(design-system)/_lib/contrast.ts";
console.log(SAY.start);
console.log(rule(DEFAULT).say);'
"${NODE_TS[@]}" --input-type=module -e "$SAYS_JS" >"$WORK/says.txt" 2>"$WORK/says.err"

# output_says <key> <data-attr> <text>: the <output data-attr> already says the text.
output_says() {
  local said
  said="$(tr '\n' ' ' <"$WORK/$1.body" | grep -oE "<output[^>]*$2[^>]*>[^<]*" | head -n 1 | sed -E 's/^<output[^>]*>//')"
  [ "$said" = "$3" ] || { echo "the <output $2> says '${said:-nothing}', want '$3'"; return 1; }
}

# engine_says <n>: line n of what the engine says the start board reads.
engine_says() {
  sed -n "${1}p" "$WORK/says.txt"
}

# one_disabled_fieldset <key>: the knobs sit in one fieldset, disabled for a JavaScript-off visitor.
one_disabled_fieldset() {
  count_eq "$1" '<fieldset disabled' 1 || return 1
  tr '\n' ' ' <"$WORK/$1.body" | grep -qE '<fieldset disabled=""[^>]*data-knobs' || { echo "the disabled fieldset is not data-knobs"; return 1; }
}

# figures_in_order <key>: data-figure="…" once each, in page order.
figures_in_order() {
  local got
  got="$(grep -oE 'data-figure="[a-z]+"' "$WORK/$1.body" | sed -E 's/^data-figure="(.*)"$/\1/' | tr '\n' ' ' | sed -E 's/ $//')"
  [ "$got" = "${FIGURES[*]}" ] || { echo "the figures are '$got', want '${FIGURES[*]}'"; return 1; }
}

# Every stylesheet /design-system links is free of Tailwind and the site's tokens, and one is Design
# system's own (its h1 name and the reduced-motion block).
own_stylesheet() {
  local hrefs href code i=0 own=0
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/$1.body" | sort -u | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
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
    grep -qF -- "project-design-system" "$WORK/style-$i.css" && grep -qF -- "prefers-reduced-motion" "$WORK/style-$i.css" && own=1
  done
  [ "$i" -ge 1 ] || { echo "no stylesheets found"; return 1; }
  [ "$own" -eq 1 ] || { echo "no stylesheet with project-design-system and prefers-reduced-motion"; return 1; }
}

# The script chunks a page loads, one path per line.
chunks() {
  grep -oE '/_next/static/chunks/[^"'"'"' ]*\.js' "$WORK/$1.body" | sort -u
}

# rough.js's option names survive minification; the pattern must match rough.js itself.
ROUGH_RE='disableMultiStroke|curveStepCount|hachureGap'
rough_pattern_bites() {
  grep -qE "$ROUGH_RE" node_modules/roughjs/bundled/rough.cjs.js || { echo "the pattern misses rough.js"; return 1; }
}

# no_rough_in_chunks <key>: no script chunk the page loads carries rough.js; the ink stays on the server.
no_rough_in_chunks() {
  local path code i=0
  for path in $(chunks "$1"); do
    i=$((i + 1))
    code="$(curl -s --max-time 30 -o "$WORK/chunk-$i.js" -w '%{http_code}' "$BASE_URL$path")"
    [ "$code" = "200" ] || { echo "$path returned HTTP $code"; return 1; }
    if grep -qE "$ROUGH_RE" "$WORK/chunk-$i.js"; then
      echo "$path contains rough.js"
      return 1
    fi
  done
  [ "$i" -ge 1 ] || { echo "no script chunks found"; return 1; }
}

# Exactly one "use client" file under app/(design-system), the island. (Source check, local tree.)
one_client_island() {
  local files n
  files="$(grep -rlE '^[[:space:]]*["'"'"']use client["'"'"']' 'app/(design-system)')"
  n="$(printf '%s' "$files" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n \"use client\" files: $(printf '%s' "$files" | tr '\n' ' ')"; return 1; }
  [ "$files" = "app/(design-system)/_components/board-app.tsx" ] || { echo "the island is $files"; return 1; }
}

get page /design-system
get projects /projects

check "/design-system returns 200" status_is page 200
check "/design-system build-sha" build_sha_matches page
check "/design-system has no site sidebar" lacks page 'aria-label="Main"'
check "/design-system links the project list" has page 'href="/projects"'
check "/design-system has one <h1>, naming Design system" one_h1_with page 'Design system'
check "/design-system draws its four figures once each, in order" figures_in_order page
for f in "${FIGURES[@]}"; do
  check "/design-system has one $f figure" count_eq page "data-figure=\"$f\"" 1
done
check "/design-system inks 27 stamps into <symbol>s" count_eq page '<symbol id="part-' 27
check "/design-system places nine parts" count_eq page 'data-part="' 9
check "/design-system greys its knobs in one disabled fieldset" one_disabled_fieldset page
check "/design-system has seven knobs" count_eq page 'data-knob="' 7
for k in "${KNOBS[@]}"; do
  check "/design-system has the $k knob" count_eq page "data-knob=\"$k\"" 1
done
check "/design-system has six dresses" count_eq page 'data-dress="' 6
for d in "${DRESSES[@]}"; do
  check "/design-system can dress as $d" count_eq page "data-dress=\"$d\"" 1
done
check "/design-system has a No system switch" count_eq page 'role="switch"' 1
check "/design-system has a Reset" count_eq page 'data-reset=""' 1
check "/design-system's here card has eleven sheets" count_eq page 'data-sheet="' 11
check "/design-system has two outputs" count_eq page '<output' 2
check "the engine gave the start sentences" test -s "$WORK/says.txt"
check "/design-system's counter says 'Turn a knob and watch what follows.'" has page 'Turn a knob and watch what follows.'
check "/design-system's counter says the engine's start sentence" output_says page 'data-counter' "$(engine_says 1)"
check "/design-system's rule line says 'Spot on paper 6.2 to 1, passes.'" has page 'Spot on paper 6.2 to 1, passes.'
check "/design-system's rule line says the engine's rule(DEFAULT)" output_says page 'data-rule' "$(engine_says 2)"
check "/design-system lists at least three sources, all https on the allowlist" sources_ok page
check "/design-system is at most 700 visible words" words_within_cap page
check "/design-system is under 200 KB" size_le page 200000
check "/design-system streams no B: template" lacks page '<template id="B:'
check "/design-system streams no \$RC" lacks page '$RC'
check "/design-system links only its own stylesheet" own_stylesheet page
check "/design-system links Structures next door" has page 'href="/structures"'
check "/design-system links the Gazette" has page 'href="/articles"'

check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /design-system once" count_eq projects 'href="/design-system"' 1
check "/projects names Design system" has projects 'A box of decisions made once, drawn so you can turn the knobs.'

check "the rough.js pattern matches rough.js" rough_pattern_bites
check "/design-system's script chunks hold no rough.js" no_rough_in_chunks page
check "exactly one \"use client\" under app/(design-system)" one_client_island

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
