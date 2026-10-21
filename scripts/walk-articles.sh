#!/usr/bin/env bash
# Walk the Gazette and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-articles.sh                                    # build + next start on :4065, walk it
#   SKIP_BUILD=1 PORT=4066 bash scripts/walk-articles.sh             # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-articles.sh       # walk a deployed URL, no build or start
#
# Env: PORT (4065), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely; with SKIP_BUILD=1 and neither set, the reused
# build's stamp is unknown, so a 40-hex sha or "dev" passes), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# Rendered things are counted by attribute form (data-article=", <time datetime=") because App
# Router repeats the server's text in the inline RSC payload; visible text is only checked for presence.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4065}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-articles.XXXXXX")"
SERVER_PID=""
OK=0
FAILED=0

# The edition, in front-page order: the lead first.
SLUGS=(why-the-sky-is-blue why-we-need-a-leap-day how-your-phone-knows-where-it-is what-a-gigabyte-holds why-ice-floats how-tides-work)
# Sources must be https on these hosts (the allowlist in app/(articles)/_lib/articles.ts).
ALLOWED='^https://(en\.wikipedia\.org|www\.gps\.gov|([a-z0-9-]+\.)*(nasa|noaa|usgs|nist)\.gov)(/|$)'

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

# count_eq_i <key> <fixed-text> <n>: as count_eq, ignoring case. React writes <time dateTime="…">, which HTML
# reads as datetime: attribute names are case-insensitive.
count_eq_i() {
  local n
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  n="$(grep -oiF -- "$2" "$WORK/$1.body" | grep -c .)"
  [ "$n" -eq "$3" ] || { echo "found $n of '$2' (any case), want exactly $3"; return 1; }
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

# sources_ok <key>: a data-sources box with at least two links, every one https on the allowlist.
sources_ok() {
  local box hrefs n bad
  box="$(tr '\n' ' ' <"$WORK/$1.body" | grep -oE '<aside[^>]*data-sources[^>]*>.*</aside>' | sed -E 's#(</aside>).*#\1#')"
  [ -n "$box" ] || { echo "no <aside data-sources>"; return 1; }
  hrefs="$(printf '%s' "$box" | grep -oE 'href="[^"]*"' | sed -E 's/^href="(.*)"$/\1/')"
  n="$(printf '%s\n' "$hrefs" | grep -cE '^https://')"
  [ "$n" -ge 2 ] || { echo "found $n https:// source links, want at least 2"; return 1; }
  bad="$(printf '%s\n' "$hrefs" | grep -vE "$ALLOWED" | grep .)"
  [ -z "$bad" ] || { echo "off the allowlist: $(printf '%s' "$bad" | tr '\n' ' ')"; return 1; }
}

NODE_TS=(node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)

# The page's visible words, counted by the same visibleWords the unit tests use.
WORDS_JS='import { readFileSync } from "node:fs";
import { visibleWords, WORD_CAP } from "./app/(articles)/_lib/words.ts";
const html = readFileSync(process.argv[1], "utf8");
console.log(`${visibleWords(html)} ${WORD_CAP}`);'
words_within_cap() {
  local words cap
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  read -r words cap <<<"$("${NODE_TS[@]}" --input-type=module -e "$WORDS_JS" "$WORK/$1.body" 2>/dev/null)"
  [ -n "${words:-}" ] && [ -n "${cap:-}" ] || { echo "the word count failed"; return 1; }
  [ "$words" -ge 180 ] || { echo "only $words words: the story is missing"; return 1; }
  [ "$words" -le "$cap" ] || { echo "$words visible words, the cap is $cap"; return 1; }
}

# Every stylesheet /articles links is free of Tailwind and the site's tokens, and one is the
# Gazette's own (its h1 name and its print block).
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
    grep -qF -- "project-articles" "$WORK/style-$i.css" && grep -qF -- "@media print" "$WORK/style-$i.css" && own=1
  done
  [ "$i" -ge 1 ] || { echo "no stylesheets found"; return 1; }
  [ "$own" -eq 1 ] || { echo "no stylesheet with project-articles and @media print"; return 1; }
}

# No "use client" file anywhere under app/(articles): the paper is server-rendered. (Source check, local tree.)
no_client_file() {
  local files n
  files="$(grep -rl '"use client"' 'app/(articles)')"
  n="$(printf '%s' "$files" | grep -c .)"
  [ "$n" -eq 0 ] || { echo "found $n \"use client\" files: $(printf '%s' "$files" | tr '\n' ' ')"; return 1; }
}
print_block() {
  grep -qF -- '@media print' 'app/(articles)/articles.css' || { echo "articles.css has no @media print"; return 1; }
}

get front /articles
get nope /articles/nope
get projects /projects
for i in "${!SLUGS[@]}"; do
  get "story$i" "/articles/${SLUGS[$i]}"
done

check "/articles returns 200" status_is front 200
check "/articles build-sha" build_sha_matches front
check "/articles has no site sidebar" lacks front 'aria-label="Main"'
check "/articles links the project list" has front 'href="/projects"'
check "/articles has one <h1>, the masthead, naming the Gazette" one_h1_with front 'Gazette'
check "/articles carries the dateline's date" has front 'Wednesday, 21 October 2026'
check "/articles carries the whole dateline" has front 'Vol. I · No. 1 · Wednesday, 21 October 2026 · otohime.dev · Free'
check "/articles has exactly six stories" count_eq front 'data-article="' 6
check "/articles leads with the sky" has front 'data-article="why-the-sky-is-blue"'
check "/articles draws the lead's figure" count_eq front 'data-figure="why-the-sky-is-blue"' 1
check "/articles has six story links" count_eq front 'href="/articles/' 6
for slug in "${SLUGS[@]}"; do
  check "/articles links /articles/$slug once" count_eq front "href=\"/articles/$slug\"" 1
done
check "/articles names its colophon" has front 'Every number links to where it came from.'
check "/articles streams no B: template" lacks front '<template id="B:'
check "/articles streams no \$RC" lacks front '$RC'
check "/articles links only its own stylesheet" own_stylesheet front

last=$((${#SLUGS[@]} - 1))
for i in "${!SLUGS[@]}"; do
  k="story$i"
  label="/articles/${SLUGS[$i]}"
  check "$label returns 200" status_is "$k" 200
  check "$label build-sha" build_sha_matches "$k"
  check "$label has no site sidebar" lacks "$k" 'aria-label="Main"'
  check "$label links the project list" has "$k" 'href="/projects"'
  check "$label links the front page" has "$k" 'href="/articles"'
  check "$label has exactly one <h1>" count_eq "$k" '<h1' 1
  check "$label has exactly one figure" count_eq "$k" 'data-figure="' 1
  check "$label's figure is its own" has "$k" "data-figure=\"${SLUGS[$i]}\""
  check "$label has exactly one role=img" count_eq "$k" 'role="img"' 1
  check "$label captions its figure" has "$k" '<figcaption'
  check "$label lists at least two sources, all https on the allowlist" sources_ok "$k"
  check "$label dates the story" count_eq_i "$k" '<time datetime="2026-10-21"' 1
  check "$label gives a reading time" has "$k" 'min read'
  if [ "$i" -eq 0 ]; then
    check "$label has no Previous" lacks "$k" 'rel="prev"'
  else
    check "$label has Previous" has "$k" 'Previous: '
    check "$label's Previous is /articles/${SLUGS[$((i - 1))]}" has "$k" "href=\"/articles/${SLUGS[$((i - 1))]}\""
  fi
  if [ "$i" -eq "$last" ]; then
    check "$label has no Next" lacks "$k" 'rel="next"'
  else
    check "$label has Next" has "$k" 'Next: '
    check "$label's Next is /articles/${SLUGS[$((i + 1))]}" has "$k" "href=\"/articles/${SLUGS[$((i + 1))]}\""
  fi
  check "$label is at most 600 visible words" words_within_cap "$k"
  check "$label is under 150 KB" size_le "$k" 150000
  check "$label streams no B: template" lacks "$k" '<template id="B:'
  check "$label streams no \$RC" lacks "$k" '$RC'
done

check "/articles/nope returns 404" status_is nope 404
# Like Orrery's /orrery/nope, a notFound() from a static [slug] page is served as Next's error shell and drawn
# from its payload, so the words are checked for presence only.
check "/articles/nope says it is not in this edition" has nope 'Not in this edition'

check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /articles once" count_eq projects 'href="/articles"' 1
check "/projects names the Gazette" has projects 'A small newspaper: six short pieces on everyday science, each with a drawn infographic.'

check "no \"use client\" file under app/(articles)" no_client_file
check "articles.css has a print stylesheet" print_block

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
