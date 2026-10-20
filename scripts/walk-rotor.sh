#!/usr/bin/env bash
# Walk Rotor and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-rotor.sh                                   # build + next start on :4035, walk it
#   SKIP_BUILD=1 PORT=4036 bash scripts/walk-rotor.sh            # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-rotor.sh      # walk a deployed URL, no build or start
#
# Env: PORT (4035), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# Rendered things are counted by attribute form (data-lamp=") because App Router repeats the
# server's text in the inline RSC payload.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4035}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-rotor.XXXXXX")"
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

# tape_code_is <key> <letters>: the tape's code line, as served (groups of five).
tape_code_is() {
  local got
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  got="$(grep -oE 'data-tape="code">[^<]*' "$WORK/$1.body" | head -n 1 | sed -E 's/^data-tape="code">//')"
  [ "$got" = "$2" ] || { echo "the tape's code line reads '${got:-nothing}', want '$2'"; return 1; }
}

# windows_read <key> <three letters>
windows_read() {
  local got
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  got="$(grep -oE 'data-windows="[A-Z]*"' "$WORK/$1.body" | head -n 1 | sed -E 's/data-windows="([A-Z]*)"/\1/')"
  [ "$got" = "$2" ] || { echo "the windows read '${got:-nothing}', want '$2'"; return 1; }
}

# shares <key> <query>: the Share line links /rotor?<query> (with & as &amp;, as served).
shares() {
  local want
  want="class=\"share\">Share: <a href=\"/rotor?$(printf '%s' "$2" | sed 's/&/\&amp;/g')\""
  has "$1" "$want"
}

NODE_TS=(node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)

# The explainer's visible words, counted by the same visibleWords the unit tests use.
WORDS_JS='import { readFileSync } from "node:fs";
import { visibleWords, WORD_CAP } from "./app/(rotor)/_lib/words.ts";
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

# A third vector, rings and plugs: the served tape must match the engine's own encode.
VECTOR_QUERY='r=II-IV-V&ring=BUL&pos=BLA&ref=C&plug=AV-BS-CG-DL-FU-HZ&m=TURNTHEWHEELS'
VECTOR_JS='import { encode, parseSettings } from "./app/(rotor)/_lib/enigma.ts";
const p = parseSettings(Object.fromEntries(new URLSearchParams(process.argv[1])));
console.log(encode(p, p.message));'
VECTOR_CODE="$("${NODE_TS[@]}" --input-type=module -e "$VECTOR_JS" "$VECTOR_QUERY" 2>/dev/null)"
VECTOR_TAPE="$(printf '%s' "$VECTOR_CODE" | sed -E 's/(.....)/\1 /g; s/ $//')"

# exactly one "use client" file under app/(rotor), the island
one_client_island() {
  local files n
  files="$(grep -rlE '^[[:space:]]*["'"'"']use client["'"'"']' 'app/(rotor)')"
  n="$(printf '%s' "$files" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n \"use client\" files: $(printf '%s' "$files" | tr '\n' ' ')"; return 1; }
  [ "$files" = "app/(rotor)/_components/rotor-app.tsx" ] || { echo "the island is $files"; return 1; }
}

# The script chunks /rotor loads, one path per line.
chunks() {
  grep -oE '/_next/static/chunks/[^"'"'"' ]*\.js' "$WORK/rotor.body" | sort -u
}

# rough.js's option names survive minification; the pattern must match rough.js itself.
ROUGH_RE='disableMultiStroke|curveStepCount|hachureGap'
rough_pattern_bites() {
  grep -qE "$ROUGH_RE" node_modules/roughjs/bundled/rough.cjs.js || { echo "the pattern misses rough.js"; return 1; }
}

no_rough_in_chunks() {
  local path code i=0
  for path in $(chunks); do
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

# Every stylesheet /rotor links is free of Tailwind and the site's tokens, and one is Rotor's
# (the lamp glow, the reduced-motion block).
rotor_stylesheets() {
  local hrefs href code i=0 own=0
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/rotor.body" | sort -u | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
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
    grep -qF -- "prefers-reduced-motion" "$WORK/style-$i.css" && grep -qF -- ".lamp.lit" "$WORK/style-$i.css" && own=1
  done
  [ "$i" -ge 1 ] || { echo "no stylesheets found"; return 1; }
  [ "$own" -eq 1 ] || { echo "no stylesheet with .lamp.lit and prefers-reduced-motion"; return 1; }
}

# form_is_get <key>: the one <form> is method="get" with action="/rotor", in either order.
form_is_get() {
  local tag
  tag="$(grep -oE '<form[^>]*>' "$WORK/$1.body" | head -n 1)"
  printf '%s' "$tag" | grep -qF 'method="get"' && printf '%s' "$tag" | grep -qF 'action="/rotor"' || { echo "the form is '${tag:-none}'"; return 1; }
}

FORM_QUERY='r=I&r=II&r=III&ring=A&ring=A&ring=A&pos=A&pos=A&pos=A&ref=B&plug=&m=AAAAA'

get rotor /rotor
get aaaaa '/rotor?m=AAAAA'
get form "/rotor?$FORM_QUERY"
get double '/rotor?r=I-II-III&pos=ADU&m=AAAA'
get bad '/rotor?r=nope&ref=Z&plug=AA&m=hello'
get decode '/rotor?m=BDZGO'
get vector "/rotor?$VECTOR_QUERY"
get projects /projects
get home /
get shore /shore
get capsule /capsule
get orrery /orrery
get elements /elements
get vinyl /vinyl

# The page
check "/rotor returns 200" status_is rotor 200
check "/rotor title is Rotor" has rotor '<title>Rotor</title>'
check "/rotor build-sha" build_sha_matches rotor
check "/rotor has no site sidebar" lacks rotor 'aria-label="Main"'
check "/rotor links home" has rotor 'href="/"'
check "/rotor links the project list" has rotor 'href="/projects"'
check "/rotor has exactly 26 lamps" count_eq rotor 'data-lamp="' 26
check "/rotor has exactly 26 keys" count_eq rotor 'data-key="' 26
check "/rotor has exactly 3 windows" count_eq rotor 'data-window="' 3
check "/rotor has the tape" count_eq rotor 'data-tape="code"' 1
check "/rotor has exactly one form" count_eq rotor '<form' 1
check "/rotor's form is a GET to /rotor" form_is_get rotor
check "/rotor has a select per rotor slot" count_eq rotor '<select name="r"' 3
check "/rotor has the reflector radios" count_eq rotor 'name="ref"' 2
check "/rotor has the plugboard field" has rotor 'name="plug"'
check "/rotor has the message field" has rotor '<textarea name="m"'
check "/rotor has the Encode button" has rotor '<button type="submit">Encode</button>'
check "/rotor has a Clear button" has rotor '>Clear</button>'
check "/rotor has a live region" count_eq rotor 'aria-live="polite"' 1
check "/rotor's empty machine reads AAA" windows_read rotor AAA
check "/rotor shares the default settings" shares rotor 'r=I-II-III&ring=AAA&pos=AAA&ref=B'
check "/rotor explainer is at most 120 words" explainer_within_cap rotor
check "/rotor links Wikipedia's rotor wiring" has rotor 'href="https://en.wikipedia.org/wiki/Enigma_rotor_details"'
check "/rotor links the Crypto Museum's wiring" has rotor 'href="https://www.cryptomuseum.com/crypto/enigma/wiring.htm"'
check "/rotor is at most 220000 bytes" size_le rotor 220000
check "/rotor stylesheets are Rotor's own" rotor_stylesheets
check "the rough.js pattern matches rough.js" rough_pattern_bites
check "/rotor's client chunks hold no rough.js" no_rough_in_chunks
check "exactly one \"use client\" under app/(rotor)" one_client_island

# The machine, server-side
check "/rotor?m=AAAAA returns 200" status_is aaaaa 200
check "/rotor?m=AAAAA prints BDZGO on the tape" tape_code_is aaaaa BDZGO
check "/rotor?m=AAAAA windows read AAF" windows_read aaaaa AAF
check "/rotor?m=AAAAA lights lamp O" has aaaaa 'data-lamp="O" class="lamp lit"'
check "/rotor?m=AAAAA lights one lamp" count_eq aaaaa 'class="lamp lit"' 1
check "the no-JS form with AAAAA returns 200" status_is form 200
check "the no-JS form with AAAAA prints BDZGO" tape_code_is form BDZGO
check "the no-JS form shares the canonical URL" shares form 'r=I-II-III&ring=AAA&pos=AAA&ref=B&m=AAAAA'
check "ADU then AAAA: the double step shows BFY" windows_read double BFY
check "bad fields return 200" status_is bad 200
check "bad fields fall back to the defaults" shares bad 'r=I-II-III&ring=AAA&pos=AAA&ref=B&m=HELLO'
check "bad fields: hello encodes as with the defaults" tape_code_is bad ILBDA
check "the same settings decode: BDZGO prints AAAAA" tape_code_is decode AAAAA
check "the engine encodes the third vector" test -n "$VECTOR_CODE"
check "rings, plugs and reflector C: the page matches the engine" tape_code_is vector "$VECTOR_TAPE"

# The project list and the other pages
check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /rotor once" count_eq projects 'href="/rotor"' 1
check "/projects has Rotor's note" has projects 'An Enigma, drawn by hand. Type and watch the lamps.'
check "/projects links /orrery" count_ge projects 'href="/orrery"' 1
check "/projects links /vinyl" count_ge projects 'href="/vinyl"' 1
check "/ returns 200" status_is home 200
check "/shore returns 200" status_is shore 200
check "/capsule returns 200" status_is capsule 200
check "/orrery returns 200" status_is orrery 200
check "/elements returns 200" status_is elements 200
check "/vinyl returns 200" status_is vinyl 200

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
