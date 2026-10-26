#!/usr/bin/env bash
# Walk the fold zine and the site's footer link to it: build, serve and fetch with curl, one "ok -" / "not ok -" line
# per check. No browser: this reads the HTML the server sends (scripts/probe-zine.sh drives Chromium and the PDF).
#
#   bash scripts/walk-zine.sh                                  # build + next start on :4095, walk it
#   SKIP_BUILD=1 PORT=4096 bash scripts/walk-zine.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-zine.sh     # walk a deployed URL, no build or start
#
# /zine, /zine?paper=letter and junk queries all answer 200; the sheet has 8 data-page cells, exactly one @page
# rule (210mm 297mm or 8.5in 11in, margin 0), 5 folds, 1 cut, 1 scissors mark, the 100 mm rule, an eager <img>, the
# GET form and the JavaScript-off hint, and links exactly one stylesheet, its own (no Tailwind, no @page, none of the
# site's sheets), with no site footer. Every public site page's footer links to /zine exactly once. The source keeps
# one client island in app/(zine) and leaves globals.css and lib/pages.ts alone.
#
# Env: PORT (4095, or a free port when that default is busy), BASE_URL (remote mode), EXPECT_SHA (build-sha to
# expect; defaults to GITHUB_SHA locally, any 40-hex sha remotely; with SKIP_BUILD=1 and neither set, a 40-hex sha
# or "dev" passes), SKIP_BUILD=1.
# Rendered things are counted in the HTML with its <script> blocks stripped: App Router repeats the server's
# markup in the inline RSC payload. Counts use grep -c, never wc (BSD pads it).
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2
ROOT="$(pwd)"

PORT_SET="${PORT:+1}"
PORT="${PORT:-4095}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d /tmp/walk-zine.XXXXXX)"
SERVER_PID=""
OK=0
FAILED=0

PUBLIC_KEYS=(home work play notes music projects sketches)
PUBLIC_PATHS=(/ /work /play /notes /music /projects /sketches)

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
  if [ "${SKIP_BUILD:-}" = "1" ] && [ -z "$EXPECT_SHA" ] && [ -z "${GITHUB_SHA:-}" ]; then
    ANY_SHA_OR_DEV=1
  fi
  export GITHUB_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"
  [ -n "${ANY_SHA_OR_DEV:-}" ] || EXPECT_SHA="${EXPECT_SHA:-$GITHUB_SHA}"
  READY_TRIES=60

  # A busy default port (another walk on a shared host) falls back to a free one; an explicit PORT is refused.
  if curl -s -o /dev/null --max-time 2 "$BASE_URL/"; then
    if [ -n "$PORT_SET" ]; then
      echo "not ok - port: something already listens on port $PORT; set PORT to a free port"
      exit 1
    fi
    FREE="$(node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
    echo "note: default port $PORT is busy; serving on free port $FREE instead"
    [ "$BETTER_AUTH_URL" = "$BASE_URL" ] && export BETTER_AUTH_URL="http://localhost:$FREE"
    PORT="$FREE"
    BASE_URL="http://localhost:$PORT"
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
if [ "$LOCAL" -eq 1 ] && ! kill -0 "$SERVER_PID" 2>/dev/null; then
  echo "not ok - ready: our next start on port $PORT exited; another server answered. log:"
  tail -n 20 "$WORK/server.log"
  echo "walk: 0 ok, 1 failed"
  exit 1
fi

# get <key> <path>: the body in $WORK/<key>.body, the DOM (scripts stripped) in <key>.dom, the status in <key>.status.
get() {
  local code
  code="$(curl -s --max-time 30 -o "$WORK/$1.body" -w '%{http_code}' "$BASE_URL$2")"
  printf '%s' "$code" >"$WORK/$1.status"
  node -e '
    const fs = require("fs");
    const html = fs.readFileSync(process.argv[1], "utf8");
    fs.writeFileSync(process.argv[2], html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ""));
  ' "$WORK/$1.body" "$WORK/$1.dom"
}

status_is() {
  local got
  got="$(cat "$WORK/$1.status" 2>/dev/null)"
  [ "$got" = "$2" ] || { echo "expected HTTP $2, got ${got:-none}"; return 1; }
}

# count_eq <key> <fixed string> <n>: occurrences in the DOM.
count_eq() {
  local n
  [ -f "$WORK/$1.dom" ] || { echo "no body"; return 1; }
  n="$(grep -oF -- "$2" "$WORK/$1.dom" | grep -c .)"
  [ "$n" -eq "$3" ] || { echo "found $n of '$2', want exactly $3"; return 1; }
}

has() {
  grep -qF -- "$2" "$WORK/$1.dom" || { echo "missing: $2"; return 1; }
}

lacks() {
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  ! grep -qF -- "$2" "$WORK/$1.body" || { echo "unexpected: $2"; return 1; }
}

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

# one_page_rule <key> <size>: exactly one @page rule in the DOM, for this size, margin 0.
one_page_rule() {
  local n rule
  n="$(grep -oE '@page[[:space:]]*\{[^}]*\}' "$WORK/$1.dom" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n @page rules, want 1"; return 1; }
  rule="$(grep -oE '@page[[:space:]]*\{[^}]*\}' "$WORK/$1.dom")"
  [ "$rule" = "@page{size:$2;margin:0}" ] || { echo "rule is '$rule', want @page{size:$2;margin:0}"; return 1; }
}

# get_form <key>: a <form> that GETs /zine, whatever order React writes its attributes in.
get_form() {
  grep -oE '<form\b[^>]*>' "$WORK/$1.dom" | grep -F 'action="/zine"' | grep -qF 'method="get"' || { echo "no <form method=get action=/zine>"; return 1; }
}

sheet_is() {
  has "$1" "data-sheet=\"$2\""
}

sketch_is() {
  grep -qE "<img[^>]*src=\"$2\"[^>]*loading=\"eager\"|<img[^>]*loading=\"eager\"[^>]*src=\"$2\"" "$WORK/$1.dom" || { echo "no eager <img> of $2"; return 1; }
}

stylesheets() {
  grep -oE '<link rel="stylesheet" href="[^"]*"' "$WORK/$1.dom" | sed -E 's/.*href="([^"]*)"/\1/'
}

# only_own_stylesheet: one <link rel=stylesheet>, not one of the site's, and its text is the zine's own sheet.
only_own_stylesheet() {
  local hrefs n href
  hrefs="$(stylesheets zine)"
  n="$(printf '%s\n' "$hrefs" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "found $n stylesheet links: $hrefs"; return 1; }
  href="$hrefs"
  if stylesheets home | grep -qxF -- "$href"; then
    echo "the zine links the site's stylesheet $href"
    return 1
  fi
  curl -s --max-time 15 -o "$WORK/zine.css" "$BASE_URL$href" || { echo "could not fetch $href"; return 1; }
  grep -qF ".sheet" "$WORK/zine.css" || { echo "$href is not the zine's sheet"; return 1; }
  grep -qF "@view-transition" "$WORK/zine.css" || { echo "$href has no @view-transition"; return 1; }
  ! grep -qE 'tailwindcss|--tw-' "$WORK/zine.css" || { echo "$href carries Tailwind"; return 1; }
  ! grep -qF "@page" "$WORK/zine.css" || { echo "$href holds an @page rule; the only one belongs inline, per paper"; return 1; }
}

no_site_chrome() {
  ! grep -qE '<footer\b[^>]*class="end"|aria-label="Main"|data-end-stage' "$WORK/$1.dom" || { echo "site chrome on /zine"; return 1; }
}

# footer_links_zine_once <key>: one href="/zine" on the page, inside the footer, marked data-end-zine.
footer_links_zine_once() {
  node -e '
    const fs = require("fs");
    const dom = fs.readFileSync(process.argv[1], "utf8");
    const all = (dom.match(/href="\/zine"/g) ?? []).length;
    const footer = dom.match(/<footer\b[^>]*class="end"[\s\S]*?<\/footer>/)?.[0] ?? "";
    const inside = [...footer.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].filter((m) => /href="\/zine"/.test(m[1]));
    const text = inside[0]?.[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
    if (all !== 1 || inside.length !== 1 || !/data-end-zine=""/.test(inside[0][1]) || !text.includes("Print a zine")) {
      console.log(`href="/zine" ${all} times, ${inside.length} in the footer, text "${text}"`);
      process.exit(1);
    }
  ' "$WORK/$1.dom"
}

one_client_island() {
  local n
  n="$(grep -rlE '^"use client";' "$ROOT/app/(zine)" | grep -c .)"
  [ "$n" -eq 1 ] || { echo "$n client files under app/(zine), want 1"; return 1; }
  grep -qE '^"use client";' "$ROOT/app/(zine)/_components/print-button.tsx" || { echo "the island is not print-button.tsx"; return 1; }
}

own_root_layout() {
  local layout="$ROOT/app/(zine)/layout.tsx"
  grep -qE '^import "\./zine\.css";$' "$layout" || { echo "layout does not import ./zine.css"; return 1; }
  ! grep -qE '^import .*(globals\.css|tailwind|@/components/)' "$layout" || { echo "layout imports the site's sheet or components"; return 1; }
  grep -qF '<html' "$layout" || { echo "layout is not a root layout"; return 1; }
}

non_goals_untouched() {
  ! grep -qi 'zine' "$ROOT/lib/pages.ts" || { echo "lib/pages.ts mentions the zine"; return 1; }
  ! grep -qi 'zine' "$ROOT/app/(site)/globals.css" || { echo "globals.css mentions the zine"; return 1; }
}

no_server_errors() {
  [ -f "$WORK/server.log" ] || return 0
  if grep -qE "Error occurred prerendering|UnhandledPromiseRejection|ReferenceError:|TypeError:" "$WORK/server.log"; then
    grep -E "Error occurred prerendering|UnhandledPromiseRejection|ReferenceError:|TypeError:" "$WORK/server.log" | head -n 5
    return 1
  fi
}

no_server_left() {
  ! curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/" || { echo "something still answers on port $PORT"; return 1; }
}

# 1. The sheet, A4 by default
get home /
get zine /zine
check "/zine returns 200" status_is zine 200
check "/zine build-sha" build_sha_matches zine
check "/zine has 8 data-page cells" count_eq zine 'data-page="' 8
for n in 1 2 3 4 5 6 7 8; do
  check "/zine has page $n once" count_eq zine "data-page=\"$n\"" 1
done
check "/zine is laid out for A4" sheet_is zine a4
check "/zine holds exactly one @page rule: 210mm 297mm, margin 0" one_page_rule zine "210mm 297mm"
check "/zine draws 5 fold guides" count_eq zine 'data-guide="fold"' 5
check "/zine draws 1 cut guide" count_eq zine 'data-guide="cut"' 1
check "/zine draws 1 scissors mark" count_eq zine 'data-guide="scissors"' 1
check "/zine draws the 100 mm rule once" count_eq zine 'data-rule-mm="100"' 1
check "/zine prints the default sketch as an eager <img>" sketch_is zine "/sketches/03-lake.jpg"
check "/zine links only its own stylesheet (no Tailwind, no @page, not the site's)" only_own_stylesheet
check "/zine carries no site footer, masthead nav or stage" no_site_chrome zine
check "/zine has a GET form to /zine" get_form zine
check "/zine's form offers both papers" count_eq zine 'name="paper"' 2
check "/zine's form offers the sketches" has zine '<select name="sketch"'
check "/zine has the JavaScript-off hint" has zine 'data-js-off-hint=""'
check "/zine shows the sheet when JavaScript is off" has zine 'div[hidden]:has(.zine-layout){display:block!important}'
check "/zine's server HTML has no Print button (it is the client island)" count_eq zine 'data-print=""' 0

# 2. Letter, and queries that must fall back with 200
get letter "/zine?paper=letter"
check "/zine?paper=letter returns 200" status_is letter 200
check "/zine?paper=letter is laid out for Letter" sheet_is letter letter
check "/zine?paper=letter holds exactly one @page rule: 8.5in 11in, margin 0" one_page_rule letter "8.5in 11in"
check "/zine?paper=letter has 8 data-page cells" count_eq letter 'data-page="' 8

get junk "/zine?paper=tabloid&sketch=%3Cscript%3Ealert(1)%3C%2Fscript%3E"
check "/zine?paper=tabloid&sketch=<script> returns 200" status_is junk 200
check "/zine?paper=tabloid falls back to A4" one_page_rule junk "210mm 297mm"
check "/zine?sketch=<script> falls back to the default sketch" sketch_is junk "/sketches/03-lake.jpg"
check "/zine?sketch=<script> is not echoed into the page" lacks junk '<script>alert(1)'

get empty "/zine?paper=&sketch="
check "/zine?paper=&sketch= returns 200 as A4 with the default sketch" status_is empty 200
check "/zine?paper= falls back to A4" one_page_rule empty "210mm 297mm"

get cove "/zine?paper=LETTER&sketch=cove"
check "/zine?paper=LETTER&sketch=cove returns 200" status_is cove 200
check "/zine?paper=LETTER is Letter" one_page_rule cove "8.5in 11in"
check "/zine?sketch=cove prints the Cove sketch" sketch_is cove "/sketches/01-cove.jpg"

# 3. The footer link, once on every public site page
for idx in "${!PUBLIC_KEYS[@]}"; do
  key="${PUBLIC_KEYS[$idx]}"
  path="${PUBLIC_PATHS[$idx]}"
  [ "$key" = home ] || get "$key" "$path"
  check "$path returns 200" status_is "$key" 200
  check "$path's footer links to /zine exactly once (Print a zine)" footer_links_zine_once "$key"
done

# 4. The source
check "app/(zine) is its own root layout with its own sheet" own_root_layout
check "app/(zine) has one client island: the Print button" one_client_island
check "globals.css and lib/pages.ts are untouched by the zine" non_goals_untouched

if [ "$LOCAL" -eq 1 ]; then
  check "local server logged no runtime errors" no_server_errors
  cleanup
  SERVER_PID=""
  check "no server left on port $PORT" no_server_left
fi

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
