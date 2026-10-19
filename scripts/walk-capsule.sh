#!/usr/bin/env bash
# Walk Capsule and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-capsule.sh                                  # build + next start on :4021, walk it
#   SKIP_BUILD=1 PORT=4022 bash scripts/walk-capsule.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-capsule.sh     # walk a deployed URL, no build or start
#
# Env: PORT (4021), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4021}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-capsule.XXXXXX")"
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
  sha="$(grep -oE '<meta name="build-sha" content="[^"]*"' "$WORK/capsule.body" | head -n 1 | sed -E 's/.*content="([^"]*)"/\1/')"
  if [ -n "$EXPECT_SHA" ]; then
    [ "$sha" = "$EXPECT_SHA" ] || { echo "build-sha is '${sha:-none}', want $EXPECT_SHA"; return 1; }
  else
    printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { echo "build-sha is '${sha:-none}', want 40 hex"; return 1; }
  fi
}

# Capsule links exactly one /_next/static/ stylesheet; fetch it and inspect it.
capsule_stylesheet() {
  local hrefs n href code
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/capsule.body" | sort -u)"
  n="$(printf '%s' "$hrefs" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n stylesheets, want exactly 1"; return 1; }
  href="$(printf '%s' "$hrefs" | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
  code="$(curl -s --max-time 30 -o "$WORK/capsule.css" -w '%{http_code}' "$BASE_URL$href")"
  [ "$code" = "200" ] || { echo "stylesheet $href returned HTTP $code"; return 1; }
  [ -s "$WORK/capsule.css" ] || { echo "stylesheet $href is empty"; return 1; }
  for bad in --tw- tailwind --color-paper; do
    if grep -qiF -- "$bad" "$WORK/capsule.css"; then
      echo "stylesheet $href contains '$bad'"
      return 1
    fi
  done
}

manifest_lists_capsule() {
  local f=.next/app-path-routes-manifest.json
  [ -f "$f" ] || { echo "$f not found"; return 1; }
  grep -qF '"/capsule"' "$f" || { echo '"/capsule" not in manifest'; return 1; }
}

get capsule /capsule
get projects /projects
get shore /shore
get home /
get work /work
get play /play
get notes /notes
get music /music
get capsule_nope /capsule/nope
get nonexistent /nonexistent

[ "$LOCAL" -eq 1 ] && check "manifest lists /capsule" manifest_lists_capsule

check "/capsule returns 200" status_is capsule 200
check "/capsule title is Capsule" has capsule '<title>Capsule</title>'
check "/capsule has no site sidebar" lacks capsule 'aria-label="Main"'
check "/capsule build-sha" build_sha_matches
check "/capsule has exactly 12 album slots" count_eq capsule 'data-slot="' 12
check "/capsule has Insert coin" has capsule 'Insert coin'
check "/capsule has Turn" has capsule 'Turn'
check "/capsule has Open" has capsule 'Open'
check "/capsule has the rates line" has capsule 'Legend 5%'
check "/capsule has Reset album" has capsule 'Reset album'
check "/capsule has the disclaimer" has capsule 'Not affiliated'
check "/capsule links home" has capsule 'href="/"'
check "/capsule stylesheet is Capsule's own" capsule_stylesheet

check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /capsule once" count_eq projects 'href="/capsule"' 1
check "/projects links /shore" count_ge projects 'href="/shore"' 1

check "/shore returns 200" status_is shore 200

check "/ returns 200" status_is home 200
check "/work returns 200" status_is work 200
check "/play returns 200" status_is play 200
check "/notes returns 200" status_is notes 200
check "/music returns 200" status_is music 200

check "/capsule/nope returns 404" status_is capsule_nope 404
check "/capsule/nope is the parcel page" has capsule_nope 'Nothing in this parcel'
check "/nonexistent returns 404" status_is nonexistent 404
check "/nonexistent is the parcel page" has nonexistent 'Nothing in this parcel'

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
