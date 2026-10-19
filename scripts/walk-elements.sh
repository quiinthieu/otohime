#!/usr/bin/env bash
# Walk Elements and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-elements.sh                                  # build + next start on :4029, walk it
#   SKIP_BUILD=1 PORT=4030 bash scripts/walk-elements.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-elements.sh     # walk a deployed URL, no build or start
#
# Env: PORT (4029), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely; with SKIP_BUILD=1 and neither set, the reused
# build's stamp is unknown, so a 40-hex sha or "dev" passes), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4029}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-elements.XXXXXX")"
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
  sha="$(grep -oE '<meta name="build-sha" content="[^"]*"' "$WORK/elements.body" | head -n 1 | sed -E 's/.*content="([^"]*)"/\1/')"
  if [ -n "$EXPECT_SHA" ]; then
    [ "$sha" = "$EXPECT_SHA" ] || { echo "build-sha is '${sha:-none}', want $EXPECT_SHA"; return 1; }
  elif [ -n "${ANY_SHA_OR_DEV:-}" ]; then
    printf '%s' "$sha" | grep -qE '^([0-9a-f]{40}|dev)$' || { echo "build-sha is '${sha:-none}', want 40 hex or dev"; return 1; }
  else
    printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { echo "build-sha is '${sha:-none}', want 40 hex"; return 1; }
  fi
}

# Elements links exactly one /_next/static/ stylesheet; fetch it and inspect it.
elements_stylesheet() {
  local hrefs n href code
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/elements.body" | sort -u)"
  n="$(printf '%s' "$hrefs" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n stylesheets, want exactly 1"; return 1; }
  href="$(printf '%s' "$hrefs" | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
  code="$(curl -s --max-time 30 -o "$WORK/elements.css" -w '%{http_code}' "$BASE_URL$href")"
  [ "$code" = "200" ] || { echo "stylesheet $href returned HTTP $code"; return 1; }
  [ -s "$WORK/elements.css" ] || { echo "stylesheet $href is empty"; return 1; }
  grep -qF -- "prefers-reduced-motion" "$WORK/elements.css" || { echo "stylesheet $href has no prefers-reduced-motion"; return 1; }
  for bad in --tw- tailwind --color-paper; do
    if grep -qiF -- "$bad" "$WORK/elements.css"; then
      echo "stylesheet $href contains '$bad'"
      return 1
    fi
  done
}

# The script chunks /elements loads, one path per line.
chunks() {
  grep -oE '/_next/static/chunks/[^"'"'"' ]*\.js' "$WORK/elements.body" | sort -u
}

# No chunk the page references is named after three.
no_three_chunk() {
  local list n
  list="$(chunks)"
  n="$(printf '%s' "$list" | grep -c .)"
  [ "$n" -ge 1 ] || { echo "no script chunks found"; return 1; }
  if printf '%s\n' "$list" | grep -qi 'three'; then
    echo "chunk named after three: $(printf '%s\n' "$list" | grep -i 'three' | head -n 1)"
    return 1
  fi
}

# No chunk the page loads holds three's renderer: the table ships no 3D code.
no_three_code() {
  local path code i=0
  for path in $(chunks); do
    i=$((i + 1))
    code="$(curl -s --max-time 30 -o "$WORK/chunk-$i.js" -w '%{http_code}' "$BASE_URL$path")"
    [ "$code" = "200" ] || { echo "$path returned HTTP $code"; return 1; }
    if grep -qE 'WebGLRenderer|InstancedMesh|@react-three' "$WORK/chunk-$i.js"; then
      echo "$path contains 3D code"
      return 1
    fi
  done
  [ "$i" -ge 1 ] || { echo "no script chunks found"; return 1; }
}

# No preload or modulepreload link names a chunk after three.
no_three_preload() {
  if grep -oE '<link[^>]*rel="(modulepreload|preload)"[^>]*>' "$WORK/elements.body" | grep -qi 'three'; then
    echo "preloads a three chunk: $(grep -oE '<link[^>]*rel="(modulepreload|preload)"[^>]*>' "$WORK/elements.body" | grep -i 'three' | head -n 1)"
    return 1
  fi
}

# Local builds only: the 3D atom was built into some chunk (it holds InstancedMesh),
# and the /elements HTML names none of those chunks, so it arrives only after a click.
three_chunk_built_not_referenced() {
  local dir=.next/static/chunks files n f name
  [ -d "$dir" ] || { echo "$dir not found"; return 1; }
  files="$(grep -rlF --include='*.js' -- 'InstancedMesh' "$dir")"
  n="$(printf '%s' "$files" | grep -c .)"
  [ "$n" -ge 1 ] || { echo "no built chunk contains InstancedMesh"; return 1; }
  for f in $files; do
    name="$(basename "$f")"
    if grep -qF -- "$name" "$WORK/elements.body"; then
      echo "/elements references the 3D chunk $name"
      return 1
    fi
  done
}

# Iron's fact and its source, read from funFacts.json and escaped the way React escapes text.
FACT_JS='import { readFileSync } from "node:fs";
const facts = JSON.parse(readFileSync("app/(elements)/_lib/funFacts.json", "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'"'"'/g, "&#x27;");
const f = facts[process.argv[1]];
console.log(esc(f.fact));
console.log(esc(f.sourceUrl));'
fact_line() {
  node --input-type=module -e "$FACT_JS" "$1" 2>/dev/null | sed -n "$2p"
}
FE_FACT="$(fact_line 26 1)"
FE_SOURCE="$(fact_line 26 2)"
has_fact() {
  [ -n "$FE_FACT" ] || { echo "could not read iron's fact from funFacts.json"; return 1; }
  has fe "$FE_FACT"
}
has_source() {
  [ -n "$FE_SOURCE" ] || { echo "could not read iron's sourceUrl from funFacts.json"; return 1; }
  has fe "href=\"$FE_SOURCE\""
}

manifest_lists_elements() {
  local f=.next/app-path-routes-manifest.json
  [ -f "$f" ] || { echo "$f not found"; return 1; }
  grep -qF '"/elements"' "$f" || { echo '"/elements" not in manifest'; return 1; }
  grep -qF '"/elements/[symbol]"' "$f" || { echo '"/elements/[symbol]" not in manifest'; return 1; }
}

get elements /elements
get fe /elements/fe
get h /elements/h
get og /elements/og
get xx /elements/xx
get projects /projects
get shore /shore
get capsule /capsule
get sun /sun
get home /
get nonexistent /nonexistent

[ "$LOCAL" -eq 1 ] && check "manifest lists /elements and /elements/[symbol]" manifest_lists_elements

check "/elements returns 200" status_is elements 200
check "/elements title is Elements" has elements '<title>Elements</title>'
check "/elements has no site sidebar" lacks elements 'aria-label="Main"'
check "/elements build-sha" build_sha_matches
check "/elements has exactly 118 cells" count_eq elements 'data-element="' 118
check "/elements has exactly 10 legend items" count_eq elements 'data-legend="' 10
check "/elements labels hydrogen's cell" has elements 'aria-label="Hydrogen, atomic number 1, nonmetal"'
check "/elements links iron's page" has elements 'href="/elements/fe"'
check "/elements has the lanthanide marker" has elements '57–71'
check "/elements has the actinide marker" has elements '89–103'
check "/elements has the table region" has elements 'aria-label="Periodic table"'
check "/elements links the CC BY-SA licence" has elements 'href="https://creativecommons.org/licenses/by-sa/3.0/"'
check "/elements links the dataset" has elements 'href="https://github.com/Bowserinator/Periodic-Table-JSON"'
check "/elements has a closed dialog" has elements '<dialog'
check "/elements links home" has elements 'href="/"'
check "/elements names no three chunk" no_three_chunk
check "/elements loads no 3D code" no_three_code
check "/elements preloads no three chunk" no_three_preload
[ "$LOCAL" -eq 1 ] && check "the 3D chunk is built but /elements does not reference it" three_chunk_built_not_referenced
check "/elements stylesheet is Elements' own" elements_stylesheet

check "/elements/fe returns 200" status_is fe 200
check "/elements/fe title is Iron" has fe '<title>Iron (Fe) · Elements</title>'
check "/elements/fe has iron's fact" has_fact
check "/elements/fe links the fact's source" has_source
check "/elements/fe has the Did you know card" has fe 'Did you know?'
check "/elements/fe has the Bohr diagram" has fe 'aria-label="Bohr diagram of iron: shells of 2, 8, 14 and 2 electrons"'
check "/elements/fe attributes the summary" has fe 'Summary from'
check "/elements/fe links the Wikipedia article" has fe 'href="https://en.wikipedia.org/wiki/Iron"'
check "/elements/fe links the CC BY-SA licence" has fe 'href="https://creativecommons.org/licenses/by-sa/3.0/"'
check "/elements/fe has the category chip" has fe '>Transition metal<'
check "/elements/fe links back to the table" has fe 'href="/elements"'
check "/elements/fe has no site sidebar" lacks fe 'aria-label="Main"'
check "/elements/h returns 200" status_is h 200
check "/elements/og returns 200" status_is og 200
check "/elements/og says its nucleus is capped" has og 'showing 64 of 294 nucleons'

check "/elements/xx returns 404" status_is xx 404
check "/elements/xx is the parcel page" has xx 'Nothing in this parcel'

check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /elements once" count_eq projects 'href="/elements"' 1
check "/projects links /sun" count_ge projects 'href="/sun"' 1

check "/shore returns 200" status_is shore 200
check "/capsule returns 200" status_is capsule 200
check "/sun returns 200" status_is sun 200
check "/ returns 200" status_is home 200
check "/nonexistent returns 404" status_is nonexistent 404
check "/nonexistent is the parcel page" has nonexistent 'Nothing in this parcel'

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
