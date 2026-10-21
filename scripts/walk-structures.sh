#!/usr/bin/env bash
# Walk Structures and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-structures.sh                                    # build + next start on :4069, walk it
#   SKIP_BUILD=1 PORT=4070 bash scripts/walk-structures.sh             # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-structures.sh       # walk a deployed URL, no build or start
#
# Env: PORT (4069), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely; with SKIP_BUILD=1 and neither set, the reused
# build's stamp is unknown, so a 40-hex sha or "dev" passes), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# Rendered things are counted by attribute form (data-page=", data-figure="machine") because App
# Router repeats the server's text in the inline RSC payload; visible text is only checked for presence.
# The pages are read as JavaScript-off visitors get them: each machine must already show its worked
# example's end state (the labels the engine says it ends on), its last sentence and its steps.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4069}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-structures.XXXXXX")"
SERVER_PID=""
OK=0
FAILED=0

# The series, in teaching order.
SLUGS=(array linked-list stack queue hash-table binary-search-tree heap graph)
# Sources must be https on these hosts (SOURCE_HOSTS in app/(structures)/_lib/copy.ts).
ALLOWED='^https://(en\.wikipedia\.org|developer\.mozilla\.org|docs\.python\.org|en\.cppreference\.com)(/|$)'

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
import { visibleWords, WORD_CAP } from "./app/(structures)/_lib/words.ts";
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

# What each machine's drawing writes at the end of its worked example, one line per slug ("slug: a b c"),
# from the engine itself: replay(structure, example) and labels(state).
LABELS_JS='import { replay } from "./app/(structures)/_lib/machine.ts";
import { STRUCTURES } from "./app/(structures)/_lib/structures/index.ts";
for (const s of STRUCTURES) console.log(`${s.slug}: ${s.labels(replay(s, s.example).state).join(" ")}`);'
"${NODE_TS[@]}" --input-type=module -e "$LABELS_JS" >"$WORK/labels.txt" 2>"$WORK/labels.err"
engine_labels() {
  grep -E "^$1: " "$WORK/labels.txt" | sed -E "s/^$1: //"
}

# The machine drawing's stamp lettering, in document order, one per line (hands' words excluded).
stamp_texts() {
  tr '\n' ' ' <"$WORK/$1.body" | grep -oE '<svg class="machine-svg"[^>]*>.*' | sed -E 's#</svg>.*##' |
    grep -oE '<text class="stamp-text"[^>]*>[^<]*</text>' | sed -E 's#^<text[^>]*>([^<]*)</text>$#\1#'
}

# end_state <key> <slug>: every label the engine ends the example on is lettered on the drawing.
end_state() {
  local want texts l missing=""
  want="$(engine_labels "$2")"
  [ -n "$want" ] || { echo "the engine gave no labels for $2: $(cut -c1-200 "$WORK/labels.err")"; return 1; }
  texts="$(stamp_texts "$1")"
  [ -n "$texts" ] || { echo "no lettered stamps in the machine's drawing"; return 1; }
  for l in $want; do
    printf '%s\n' "$texts" | grep -qxF -- "$l" || missing="$missing $l"
  done
  [ -z "$missing" ] || { echo "the drawing does not letter:$missing (it letters: $(printf '%s' "$texts" | tr '\n' ' '))"; return 1; }
}

# letters_run <key> <words...>: the drawing letters these, one after another, in this order.
letters_run() {
  local key="$1" texts
  shift
  texts=" $(stamp_texts "$key" | tr '\n' ' ')"
  case "$texts" in
    *" $* "*) return 0 ;;
  esac
  echo "the drawing letters '$(printf '%s' "$texts" | sed -E 's/^ //; s/ $//')', want the run '$*'"
  return 1
}

# trace_has <key> <n>: the no-JS trace, <ol data-trace>, has at least n steps.
trace_has() {
  local ol n
  ol="$(tr '\n' ' ' <"$WORK/$1.body" | grep -oE '<ol data-trace[^>]*>.*' | sed -E 's#</ol>.*#</ol>#')"
  [ -n "$ol" ] || { echo "no <ol data-trace>"; return 1; }
  n="$(printf '%s' "$ol" | grep -oF '<li' | grep -c .)"
  [ "$n" -ge "$2" ] || { echo "the trace has $n steps, want at least $2"; return 1; }
}

# narrated <key>: the narration <output> already says the example's last sentence.
narrated() {
  local said
  said="$(tr '\n' ' ' <"$WORK/$1.body" | grep -oE '<output[^>]*aria-live="polite"[^>]*>[^<]+' | head -n 1 | sed -E 's/^<output[^>]*>//')"
  [ -n "$said" ] || { echo "the narration is empty"; return 1; }
}

# turn_ok <key> <prev-slug|-> <next-slug|->: Previous and Next, inside the page's nav, go where the order says.
turn_ok() {
  local nav
  nav="$(tr '\n' ' ' <"$WORK/$1.body" | grep -oE '<nav class="turn"[^>]*>.*' | sed -E 's#</nav>.*#</nav>#')"
  [ -n "$nav" ] || { echo "no Previous / Next nav"; return 1; }
  if [ "$2" = "-" ]; then
    ! printf '%s' "$nav" | grep -qF 'rel="prev"' || { echo "the first page has a Previous"; return 1; }
  else
    printf '%s' "$nav" | grep -qF 'rel="prev"' || { echo "no Previous"; return 1; }
    printf '%s' "$nav" | grep -qF "href=\"/structures/$2\"" || { echo "Previous is not /structures/$2"; return 1; }
  fi
  if [ "$3" = "-" ]; then
    ! printf '%s' "$nav" | grep -qF 'rel="next"' || { echo "the last page has a Next"; return 1; }
  else
    printf '%s' "$nav" | grep -qF 'rel="next"' || { echo "no Next"; return 1; }
    printf '%s' "$nav" | grep -qF "href=\"/structures/$3\"" || { echo "Next is not /structures/$3"; return 1; }
  fi
}

# in_order <key>: the index lists data-page="…" in series order.
in_order() {
  local got
  got="$(grep -oE 'data-page="[a-z-]+"' "$WORK/$1.body" | sed -E 's/^data-page="(.*)"$/\1/' | tr '\n' ' ' | sed -E 's/ $//')"
  [ "$got" = "${SLUGS[*]}" ] || { echo "the index lists '$got', want '${SLUGS[*]}'"; return 1; }
}

# Every stylesheet /structures links is free of Tailwind and the site's tokens, and one is Structures' own
# (its h1 name and its squared paper).
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
    grep -qF -- "project-structures" "$WORK/style-$i.css" && grep -qF -- "prefers-reduced-motion" "$WORK/style-$i.css" && own=1
  done
  [ "$i" -ge 1 ] || { echo "no stylesheets found"; return 1; }
  [ "$own" -eq 1 ] || { echo "no stylesheet with project-structures and prefers-reduced-motion"; return 1; }
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

# Exactly one "use client" file under app/(structures), the island. (Source check, local tree.)
one_client_island() {
  local files n
  files="$(grep -rlE '^[[:space:]]*["'"'"']use client["'"'"']' 'app/(structures)')"
  n="$(printf '%s' "$files" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n \"use client\" files: $(printf '%s' "$files" | tr '\n' ' ')"; return 1; }
  [ "$files" = "app/(structures)/_components/machine-app.tsx" ] || { echo "the island is $files"; return 1; }
}

get index /structures
get nope /structures/nope
get projects /projects
for i in "${!SLUGS[@]}"; do
  get "page$i" "/structures/${SLUGS[$i]}"
done

check "/structures returns 200" status_is index 200
check "/structures build-sha" build_sha_matches index
check "/structures has no site sidebar" lacks index 'aria-label="Main"'
check "/structures links the project list" has index 'href="/projects"'
check "/structures has one <h1>, naming Structures" one_h1_with index 'Structures'
check "/structures lists exactly eight pages" count_eq index 'data-page="' 8
check "/structures lists them in teaching order" in_order index
check "/structures has eight page links" count_eq index 'href="/structures/' 8
for slug in "${SLUGS[@]}"; do
  check "/structures links /structures/$slug once" count_eq index "href=\"/structures/$slug\"" 1
done
check "/structures draws eight thumbnails" count_eq index 'class="thumb life"' 8
check "/structures gives each page its cost dots" count_eq index '<ul class="dots"' 8
check "/structures links the Gazette" has index 'href="/articles"'
check "/structures streams no B: template" lacks index '<template id="B:'
check "/structures streams no \$RC" lacks index '$RC'
check "/structures links only its own stylesheet" own_stylesheet index

last=$((${#SLUGS[@]} - 1))
for i in "${!SLUGS[@]}"; do
  k="page$i"
  slug="${SLUGS[$i]}"
  label="/structures/$slug"
  check "$label returns 200" status_is "$k" 200
  check "$label build-sha" build_sha_matches "$k"
  check "$label has no site sidebar" lacks "$k" 'aria-label="Main"'
  check "$label links the project list" has "$k" 'href="/projects"'
  check "$label links all pages" has "$k" 'href="/structures"'
  check "$label has exactly one <h1>" count_eq "$k" '<h1' 1
  check "$label has one In life drawing" count_eq "$k" 'data-figure="life"' 1
  check "$label has one machine" count_eq "$k" 'data-figure="machine"' 1
  check "$label has one costs card" count_eq "$k" 'data-figure="costs"' 1
  check "$label greys its controls until the island wakes" count_eq "$k" '<fieldset disabled' 1
  check "$label has a narration" count_eq "$k" '<output' 1
  check "$label narrates the example's last sentence" narrated "$k"
  check "$label lists the example's steps" trace_has "$k" 2
  check "$label draws the example's end state" end_state "$k" "$slug"
  check "$label lists at least two sources, all https on the allowlist" sources_ok "$k"
  if [ "$i" -eq 0 ]; then prev="-"; else prev="${SLUGS[$((i - 1))]}"; fi
  if [ "$i" -eq "$last" ]; then next="-"; else next="${SLUGS[$((i + 1))]}"; fi
  check "$label's Previous / Next: ${prev/-/none} / ${next/-/none}" turn_ok "$k" "$prev" "$next"
  check "$label is at most 700 visible words" words_within_cap "$k"
  check "$label is under 200 KB" size_le "$k" 200000
  check "$label streams no B: template" lacks "$k" '<template id="B:'
  check "$label streams no \$RC" lacks "$k" '$RC'
done

# The table's end states, by name.
check "the stack ends 1 7 2, bottom to top" letters_run page2 1 7 2
check "the hash table hangs act behind cat" letters_run page4 cat act
check "the heap's tree and its row both read 3 4 8 5, four labels each" letters_run page6 3 4 8 5 3 4 8 5
check "the graph letters station H" letters_run page7 H

check "/structures/nope returns 404" status_is nope 404
# A notFound() from a static [slug] page is served as Next's error shell and drawn from its payload, so the
# words are checked for presence only.
check "/structures/nope says it is not in this series" has nope 'Not in this series'

check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /structures once" count_eq projects 'href="/structures"' 1
check "/projects names Structures" has projects 'Eight ways to keep things, drawn by hand so you can poke them.'

check "the rough.js pattern matches rough.js" rough_pattern_bites
check "/structures/stack's script chunks hold no rough.js" no_rough_in_chunks page2
check "exactly one \"use client\" under app/(structures)" one_client_island

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
