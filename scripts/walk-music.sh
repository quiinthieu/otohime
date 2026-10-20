#!/usr/bin/env bash
# Walk /music: build, serve and probe it with no database, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-music.sh                                  # build + next start on :4025, walk it
#   SKIP_BUILD=1 PORT=4022 bash scripts/walk-music.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-music.sh     # walk a deployed URL, no build or start
#
# Env: PORT (4025), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely), SKIP_BUILD=1.
# Locally there is no database, so /music must still show the three starters in content/site.ts.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4025}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-music.XXXXXX")"
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
  export DATABASE_URL="${DATABASE_URL:-postgresql://otohime:otohime@127.0.0.1:9/otohime}"
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
  sha="$(grep -oE '<meta name="build-sha" content="[^"]*"' "$WORK/music.body" | head -n 1 | sed -E 's/.*content="([^"]*)"/\1/')"
  if [ -n "$EXPECT_SHA" ]; then
    [ "$sha" = "$EXPECT_SHA" ] || { echo "build-sha is '${sha:-none}', want $EXPECT_SHA"; return 1; }
  else
    printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { echo "build-sha is '${sha:-none}', want 40 hex"; return 1; }
  fi
}

# The starter titles, read from content/site.ts: the "title:" of each entry in songs: [...].
starter_titles() {
  awk '/^  songs: \[/{on=1; next} on && /^  \] satisfies/{exit} on && /^      title: "/{print}' content/site.ts |
    sed -E 's/^ *title: "(.*)",$/\1/'
}

starters_present() {
  local titles n title
  titles="$(starter_titles)"
  n="$(printf '%s\n' "$titles" | grep -c .)"
  [ "$n" -eq 3 ] || { echo "read $n starter titles from content/site.ts, want 3"; return 1; }
  while IFS= read -r title; do
    has music "$title" || return 1
  done < <(printf '%s\n' "$titles")
}

# distinct_labels <n> <eq|ge>: the page holds the listing twice (Suspense fallback, then the live
# list), so count distinct "CH nn" labels in the listing markup, not occurrences.
distinct_labels() {
  local n
  [ -f "$WORK/music.body" ] || { echo "no body"; return 1; }
  n="$(grep -oE '>CH [0-9]{2}</span>' "$WORK/music.body" | sort -u | grep -c .)"
  if [ "$2" = eq ]; then
    [ "$n" -eq "$1" ] || { echo "found $n distinct listing labels, want exactly $1"; return 1; }
  else
    [ "$n" -ge "$1" ] || { echo "found $n distinct listing labels, want at least $1"; return 1; }
  fi
}

# picker_styled <file>: the stylesheet carries @supports (appearance: base-select) and a ::picker(select) rule.
picker_styled() {
  [ -s "$1" ] || { echo "no stylesheet fetched"; return 1; }
  grep -qE -- '@supports *\(appearance: *base-select\)' "$1" || { echo "stylesheet lacks @supports (appearance: base-select)"; return 1; }
  grep -qE -- '::picker\(select\)' "$1" || { echo "stylesheet lacks ::picker(select)"; return 1; }
}

# base_select_guarded <file>: every base-select or ::picker( sits inside an @supports (appearance: base-select) block.
# A grep cannot see nesting, so walk the braces and keep the stack of preludes.
base_select_guarded() {
  [ -s "$1" ] || { echo "no stylesheet fetched"; return 1; }
  node -e '
    const css = require("fs").readFileSync(process.argv[1], "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const guard = /^@supports\s*\(\s*appearance\s*:\s*base-select\s*\)$/;
    const stack = [];
    let start = 0, bad = null;
    const check = (text) => {
      if (bad || !/base-select|::picker\(/.test(text)) return;
      if (!stack.some((p) => guard.test(p))) bad = text.trim().slice(0, 100);
    };
    for (let i = 0; i < css.length; i++) {
      const c = css[i];
      if (c === "{") { const prelude = css.slice(start, i).trim(); if (!guard.test(prelude)) check(prelude); stack.push(prelude); start = i + 1; }
      else if (c === ";") { check(css.slice(start, i)); start = i + 1; }
      else if (c === "}") { check(css.slice(start, i)); stack.pop(); start = i + 1; }
    }
    if (bad) { console.log("outside @supports (appearance: base-select): " + bad); process.exit(1); }
  ' "$1"
}

# Every stylesheet /music links (the site's own, with select.field), joined into $WORK/music.css.
music_stylesheet() {
  local hrefs href code
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/music.body" | sort -u)"
  [ -n "$hrefs" ] || { echo "/music links no stylesheet"; return 1; }
  : >"$WORK/music.css"
  while IFS= read -r href; do
    href="$(printf '%s' "$href" | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
    code="$(curl -s --max-time 30 -o "$WORK/part.css" -w '%{http_code}' "$BASE_URL$href")"
    [ "$code" = "200" ] || { echo "stylesheet $href returned HTTP $code"; return 1; }
    cat "$WORK/part.css" >>"$WORK/music.css"
    echo >>"$WORK/music.css"
  done < <(printf '%s\n' "$hrefs")
  [ -s "$WORK/music.css" ] || { echo "stylesheets are empty"; return 1; }
}

no_server_left() {
  ! curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/" || { echo "something still answers on port $PORT"; return 1; }
}

get music /music

check "/music returns 200" status_is music 200
check "/music build-sha" build_sha_matches
check "/music has CH 01" has music 'CH 01'
check "/music has CH 02" has music 'CH 02'
check "/music has CH 03" has music 'CH 03'
check "/music has the three starter titles" starters_present
check "/music has no add form for anonymous visitors" lacks music 'name="video"'
if [ "$LOCAL" -eq 1 ]; then
  check "/music lists exactly 3 channels with no database" distinct_labels 3 eq
else
  check "/music lists at least 3 channels" distinct_labels 3 ge
fi

check "/music stylesheets load" music_stylesheet
check "/music stylesheet styles the select picker" picker_styled "$WORK/music.css"
check "/music stylesheet keeps base-select inside @supports" base_select_guarded "$WORK/music.css"

if [ "$LOCAL" -eq 1 ]; then
  cleanup
  SERVER_PID=""
  check "no server left on port $PORT" no_server_left
fi

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
