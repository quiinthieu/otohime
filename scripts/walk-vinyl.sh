#!/usr/bin/env bash
# Walk Vinyl and the site: build, serve and probe them, one "ok -" / "not ok -" line per check.
#
#   bash scripts/walk-vinyl.sh                                  # build + next start on :4031, walk it
#   SKIP_BUILD=1 PORT=4032 bash scripts/walk-vinyl.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-vinyl.sh     # walk a deployed URL, no build or start
#
# Env: PORT (4031), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely), SKIP_BUILD=1.
# Counts use grep -c and numeric tests only: BSD wc pads its output, so string compares fail.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4031}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-vinyl.XXXXXX")"
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
  sha="$(grep -oE '<meta name="build-sha" content="[^"]*"' "$WORK/vinyl.body" | head -n 1 | sed -E 's/.*content="([^"]*)"/\1/')"
  if [ -n "$EXPECT_SHA" ]; then
    [ "$sha" = "$EXPECT_SHA" ] || { echo "build-sha is '${sha:-none}', want $EXPECT_SHA"; return 1; }
  else
    printf '%s' "$sha" | grep -qE '^[0-9a-f]{40}$' || { echo "build-sha is '${sha:-none}', want 40 hex"; return 1; }
  fi
}

# YouTube refuses to play without a Referer (error 153): no header may ask the browser to drop it.
no_referrer_header() {
  local h
  h="$(curl -s --max-time 30 -D - -o /dev/null "$BASE_URL/vinyl" | grep -i '^referrer-policy:')"
  if printf '%s' "$h" | grep -qi 'no-referrer'; then
    echo "header: $(printf '%s' "$h" | tr -d '\r')"
    return 1
  fi
}

# Vinyl links exactly one /_next/static/ stylesheet; fetch it and inspect it.
vinyl_stylesheet() {
  local hrefs n href code
  hrefs="$(grep -oE 'href="/_next/static/[^"]*\.css[^"]*"' "$WORK/vinyl.body" | sort -u)"
  n="$(printf '%s' "$hrefs" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n stylesheets, want exactly 1"; return 1; }
  href="$(printf '%s' "$hrefs" | sed -E 's/^href="(.*)"$/\1/; s/&amp;/\&/g')"
  code="$(curl -s --max-time 30 -o "$WORK/vinyl.css" -w '%{http_code}' "$BASE_URL$href")"
  [ "$code" = "200" ] || { echo "stylesheet $href returned HTTP $code"; return 1; }
  [ -s "$WORK/vinyl.css" ] || { echo "stylesheet $href is empty"; return 1; }
  for bad in --tw- tailwind; do
    if grep -qiF -- "$bad" "$WORK/vinyl.css"; then
      echo "stylesheet $href contains '$bad'"
      return 1
    fi
  done
}

# css_has <extended regex> <what>: the fetched stylesheet matches.
css_has() {
  [ -s "$WORK/vinyl.css" ] || { echo "no stylesheet fetched"; return 1; }
  grep -qE -- "$1" "$WORK/vinyl.css" || { echo "stylesheet lacks $2"; return 1; }
}

# The player is never hidden: no rule whose selector names the player host or
# the monitor sets display: none or visibility: hidden. One rule per line first.
player_never_hidden() {
  local hits
  [ -s "$WORK/vinyl.css" ] || { echo "no stylesheet fetched"; return 1; }
  hits="$(tr '\n' ' ' <"$WORK/vinyl.css" | sed 's/}/}\
/g' | grep -E '(player-host|monitor)[^{]*\{' | grep -E 'display: *none|visibility: *hidden')"
  [ -z "$hits" ] || { echo "hides the player: $(printf '%s' "$hits" | head -n 1 | cut -c1-160)"; return 1; }
}

# The turntable cell clips the tonearm, so it can never reach the monitor.
turntable_clips() {
  local hits
  [ -s "$WORK/vinyl.css" ] || { echo "no stylesheet fetched"; return 1; }
  hits="$(tr '\n' ' ' <"$WORK/vinyl.css" | sed 's/}/}\
/g' | grep -E '\.turntable-cell *\{' | grep -E 'overflow: *hidden')"
  [ -n "$hits" ] || { echo "no overflow: hidden on .turntable-cell"; return 1; }
}

# touch-action: none is on the tonearm alone: sleeves and the crate keep
# scrolling by touch. One rule per line; its selector is what precedes its {.
touch_action_only_arm() {
  local rules bad
  [ -s "$WORK/vinyl.css" ] || { echo "no stylesheet fetched"; return 1; }
  rules="$(tr '\n' ' ' <"$WORK/vinyl.css" | sed 's/}/}\
/g' | grep -E 'touch-action: *none')"
  [ -n "$rules" ] || { echo "no touch-action: none on the tonearm"; return 1; }
  bad="$(printf '%s\n' "$rules" | sed -E 's/\{[^{]*$//; s/.*[{]//' | grep -vxE ' *\.tonearm *')"
  [ -z "$bad" ] || { echo "touch-action: none on $(printf '%s' "$bad" | head -n 1 | cut -c1-120)"; return 1; }
}

# touch-action does not apply inside an <svg>, so the tonearm's touch drag
# rests on a non-passive touchstart listener that the served HTML cannot show.
arm_touch_listener() {
  local f='app/(vinyl)/_components/turntable.tsx'
  [ -f "$f" ] || { echo "$f not found"; return 1; }
  grep -qF 'addEventListener("touchstart"' "$f" || { echo "no touchstart listener on the tonearm"; return 1; }
  grep -qF 'passive: false' "$f" || { echo "the touchstart listener is not passive: false"; return 1; }
  grep -qF 'removeEventListener("touchstart"' "$f" || { echo "the touchstart listener is never removed"; return 1; }
}

# The crackle is synthesised: no audio file is shipped with Vinyl or the site.
no_audio_files() {
  local found
  found="$(find 'app/(vinyl)' public -type f \( -iname '*.mp3' -o -iname '*.wav' -o -iname '*.ogg' \) 2>/dev/null)"
  [ -z "$found" ] || { echo "audio files: $(printf '%s' "$found" | tr '\n' ' ' | cut -c1-200)"; return 1; }
}

manifest_lists_vinyl() {
  local f=.next/app-path-routes-manifest.json
  [ -f "$f" ] || { echo "$f not found"; return 1; }
  grep -qF '"/vinyl"' "$f" || { echo '"/vinyl" not in manifest'; return 1; }
}

get vinyl /vinyl
get projects /projects
get shore /shore
get capsule /capsule
get sun /sun
get elements /elements
get home /
get music /music
get vinyl_nope /vinyl/nope

[ "$LOCAL" -eq 1 ] && check "manifest lists /vinyl" manifest_lists_vinyl

check "/vinyl returns 200" status_is vinyl 200
check "/vinyl title is Vinyl" has vinyl '<title>Vinyl</title>'
check "/vinyl has no site sidebar" lacks vinyl 'aria-label="Main"'
check "/vinyl build-sha" build_sha_matches
check "/vinyl links home" has vinyl 'href="/"'
check "/vinyl links the project list" has vinyl 'href="/projects"'
check "/vinyl has exactly 12 records in the crate" count_eq vinyl 'data-record="' 12
check "/vinyl has exactly 1 monitor" count_eq vinyl 'data-monitor' 1
check "/vinyl has exactly 1 player host" count_eq vinyl 'data-player-host' 1
check "/vinyl offers Place on turntable" has vinyl 'Place on turntable'
check "/vinyl links every record on YouTube" count_ge vinyl 'youtube.com/watch?v=' 12
check "/vinyl has a polite live region" has vinyl 'aria-live="polite"'
check "/vinyl has a search box" has vinyl 'type="search"'
check "/vinyl has a speed switch" has vinyl 'type="radio"'
check "/vinyl has a tonearm slider" count_eq vinyl 'role="slider"' 1
check "/vinyl tonearm slider is labelled" has vinyl 'aria-label="Tonearm"'
check "/vinyl tonearm slider has a value text" has vinyl 'aria-valuetext="0:00 of 0:00, at rest"'
check "/vinyl has one platter drop target" count_eq vinyl 'data-drop-target="platter"' 1
check "/vinyl sleeves are drag handles" count_eq vinyl 'class="sleeve-grip"' 12
if [ "${NEXT_PUBLIC_VINYL_CRACKLE:-}" = "1" ] && [ "$LOCAL" -eq 1 ]; then
  check "/vinyl shows the crackle toggle (flag on)" has vinyl 'data-crackle'
else
  check "/vinyl has no crackle toggle (flag off by default)" lacks vinyl 'data-crackle'
fi
check "/vinyl does not load iframe_api before a record is placed" lacks vinyl 'iframe_api'
check "/vinyl has no iframe in the server HTML" lacks vinyl '<iframe'
check "/vinyl sets no referrerpolicy" lacks vinyl 'referrerpolicy='
check "/vinyl sends no no-referrer policy" no_referrer_header
check "/vinyl stylesheet is Vinyl's own" vinyl_stylesheet
check "/vinyl stylesheet honours reduced motion" css_has 'prefers-reduced-motion' 'prefers-reduced-motion'
check "/vinyl stylesheet keeps the player 16:9" css_has 'aspect-ratio: *16 */ *9' 'aspect-ratio: 16 / 9'
check "/vinyl stylesheet keeps the player 480 px wide on desktop" css_has 'min-width: *480px' 'min-width: 480px'
check "/vinyl stylesheet keeps the player 200 px tall on phones" css_has 'max\(200px' 'max(200px'
check "/vinyl stylesheet never hides the player" player_never_hidden
check "/vinyl stylesheet clips the turntable cell" turntable_clips
check "/vinyl stylesheet sets touch-action: none only on the tonearm" touch_action_only_arm
check "tonearm stops a finger's pan with a non-passive touchstart" arm_touch_listener
check "/vinyl stylesheet removes the flight under reduced motion" css_has 'prefers-reduced-motion: *reduce\)[^@]*\.flight[^{]*\{[^}]*display: *none' '.flight { display: none } under reduced motion'
check "no audio files under app/(vinyl) or public/" no_audio_files
check "/vinyl/nope returns 404" status_is vinyl_nope 404

check "/projects returns 200" status_is projects 200
check "/projects has the sidebar" has projects 'aria-label="Main"'
check "/projects links /vinyl once" count_eq projects 'href="/vinyl"' 1

check "/ returns 200" status_is home 200
check "/projects links /sun" count_ge projects 'href="/sun"' 1
check "/shore returns 200" status_is shore 200
check "/capsule returns 200" status_is capsule 200
check "/sun returns 200" status_is sun 200
check "/elements returns 200" status_is elements 200
check "/music returns 200" status_is music 200

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
