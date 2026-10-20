#!/usr/bin/env bash
# Walk Shore and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-shore.sh                                  # build + next start on :4019, walk it
#   SKIP_BUILD=1 PORT=4020 bash scripts/walk-shore.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-shore.sh     # walk a deployed URL, no build or start
#
# Env: PORT (4019), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely; with SKIP_BUILD=1 and neither set, the reused
# build's stamp is unknown, so a 40-hex sha or "dev" passes), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4019}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-shore.XXXXXX")"
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
  sha="$(grep -oE '<meta name="build-sha" content="[^"]*"' "$WORK/shore.body" | head -n 1 | sed -E 's/.*content="([^"]*)"/\1/')"
  if [ -n "$EXPECT_SHA" ]; then
    [ "$sha" = "$EXPECT_SHA" ] || { echo "build-sha is '${sha:-none}', want $EXPECT_SHA"; return 1; }
  elif [ -n "${ANY_SHA_OR_DEV:-}" ]; then
    printf '%s' "$sha" | grep -qE '^([0-9a-f]{40}|dev)$' || { echo "build-sha is '${sha:-none}', want 40 hex or dev"; return 1; }
  else
    printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { echo "build-sha is '${sha:-none}', want 40 hex"; return 1; }
  fi
}

# Shore links exactly one /_next/static/ stylesheet; fetch it and inspect it.
shore_stylesheet() {
  local hrefs n href code
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/shore.body" | sort -u)"
  n="$(printf '%s' "$hrefs" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n stylesheets, want exactly 1"; return 1; }
  href="$(printf '%s' "$hrefs" | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
  code="$(curl -s --max-time 30 -o "$WORK/shore.css" -w '%{http_code}' "$BASE_URL$href")"
  [ "$code" = "200" ] || { echo "stylesheet $href returned HTTP $code"; return 1; }
  [ -s "$WORK/shore.css" ] || { echo "stylesheet $href is empty"; return 1; }
  for bad in --tw- tailwind --color-paper; do
    if grep -qiF -- "$bad" "$WORK/shore.css"; then
      echo "stylesheet $href contains '$bad'"
      return 1
    fi
  done
}

manifest_lists_shore() {
  local f=.next/app-path-routes-manifest.json
  [ -f "$f" ] || { echo "$f not found"; return 1; }
  grep -qF '"/shore"' "$f" || { echo '"/shore" not in manifest'; return 1; }
}

get shore /shore
get projects /projects
get home /
get work /work
get play /play
get notes /notes
get music /music
get shore_nope /shore/nope
get nonexistent /nonexistent

[ "$LOCAL" -eq 1 ] && check "manifest lists /shore" manifest_lists_shore

check "/shore returns 200" status_is shore 200
check "/shore title is Shore" has shore '<title>Shore</title>'
check "/shore has >= 3 glass elements" count_ge shore 'class="glass' 3
check "/shore has no site sidebar" lacks shore 'aria-label="Main"'
check "/shore build-sha" build_sha_matches
check "/shore has the Dark scene toggle" has shore 'aria-label="Dark scene"'
check "/shore has Finish now" has shore 'Finish now'
check "/shore links home" has shore 'href="/"'
check "/shore links the project list" has shore 'href="/projects"'
check "/shore stylesheet is Shore's own" shore_stylesheet

check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /shore once" count_eq projects 'href="/shore"' 1

check "/ returns 200" status_is home 200
check "/work returns 200" status_is work 200
check "/play returns 200" status_is play 200
check "/notes returns 200" status_is notes 200
check "/music returns 200" status_is music 200

check "/shore/nope returns 404" status_is shore_nope 404
check "/shore/nope is the parcel page" has shore_nope 'Nothing in this parcel'
check "/nonexistent returns 404" status_is nonexistent 404
check "/nonexistent is the parcel page" has nonexistent 'Nothing in this parcel'

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
