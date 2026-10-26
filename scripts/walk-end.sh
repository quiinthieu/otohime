#!/usr/bin/env bash
# Walk the Internet Save Point footer across all public site pages, auth, 404,
# and the eleven isolated project roots.
#
#   bash scripts/walk-end.sh                                  # build + next start on :4081, walk it
#   SKIP_BUILD=1 PORT=4081 bash scripts/walk-end.sh           # reuse an existing .next build
#   BASE_URL=https://otohime.dev bash scripts/walk-end.sh     # walk a deployed URL, no build or start
#
# Env: PORT (4081), BASE_URL (remote mode), EXPECT_SHA (build-sha to expect; defaults to
# GITHUB_SHA locally, any 40-hex sha remotely; with SKIP_BUILD=1 and neither set, a 40-hex sha
# or "dev" passes), SKIP_BUILD=1.
set -u

cd "$(dirname "$0")/.." || exit 2

PORT="${PORT:-4081}"
BASE_URL="${BASE_URL:-}"
EXPECT_SHA="${EXPECT_SHA:-}"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/walk-end.XXXXXX")"
SERVER_PID=""
DB_PID=""
OK=0
FAILED=0

PUBLIC_KEYS=(home work play notes music projects sketches)
PUBLIC_PATHS=(/ /work /play /notes /music /projects /sketches)
PROJECTS=(shore capsule orrery elements vinyl rotor planisphere barometer articles structures design-system)

kill_group() {
  [ -n "$1" ] || return 0
  kill -TERM -- "-$1" 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 -- "-$1" 2>/dev/null || break
    sleep 0.5
  done
  kill -KILL -- "-$1" 2>/dev/null
}

pgq() {
  node -e '
    const pg = require("pg");
    const c = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
    c.connect()
      .then(() => c.query(process.argv[1]))
      .then(() => c.end())
      .catch(() => process.exit(1));
  ' "$@"
}

# No database answers and Docker is not there: the throwaway embedded Postgres of scripts/e2e.mjs (--serve-db), its
# files under $WORK/db. Only this run's own process and files are stopped and removed (stop_embedded_db, rm -rf $WORK).
start_embedded_db() {
  node scripts/e2e.mjs --serve-db "$WORK/db" >"$WORK/db.log" 2>&1 &
  DB_PID=$!
  local url=""
  for _ in $(seq 1 120); do
    url="$(sed -n 's/^DATABASE_URL=//p' "$WORK/db.log" | head -n 1)"
    [ -n "$url" ] && break
    kill -0 "$DB_PID" 2>/dev/null || break
    sleep 0.5
  done
  if [ -n "$url" ]; then
    export DATABASE_URL="$url"
  else
    echo "note: the embedded Postgres did not start; log:"
    tail -n 20 "$WORK/db.log"
  fi
}

stop_embedded_db() {
  [ -n "$DB_PID" ] || return 0
  kill -TERM "$DB_PID" 2>/dev/null
  for _ in $(seq 1 20); do
    kill -0 "$DB_PID" 2>/dev/null || return 0
    sleep 0.5
  done
  kill -KILL "$DB_PID" 2>/dev/null
}

cleanup() {
  kill_group "$SERVER_PID"
  stop_embedded_db
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

  if curl -s -o /dev/null --max-time 2 "$BASE_URL/"; then
    echo "not ok - port: something already listens on port $PORT; set PORT to a free port"
    exit 1
  fi

  # The site layout and /music read the session from the database: give the server one of its own when none answers.
  if ! pgq 'select 1' >/dev/null 2>&1; then
    start_embedded_db
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

get() {
  local code
  code="$(curl -s --max-time 30 -o "$WORK/$1.body" -w '%{http_code}' "$BASE_URL$2")"
  printf '%s' "$code" >"$WORK/$1.status"
}

status_is() {
  local got
  got="$(cat "$WORK/$1.status" 2>/dev/null)"
  [ "$got" = "$2" ] || { echo "expected HTTP $2, got ${got:-none}"; return 1; }
}

has() {
  [ -f "$WORK/$1.body" ] && grep -qF -- "$2" "$WORK/$1.body" || { echo "missing: $2"; return 1; }
}

lacks() {
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  ! grep -qF -- "$2" "$WORK/$1.body" || { echo "unexpected: $2"; return 1; }
}

count_eq() {
  local n
  [ -f "$WORK/$1.body" ] || { echo "no body"; return 1; }
  n="$(grep -oF -- "$2" "$WORK/$1.body" | grep -c .)"
  [ "$n" -eq "$3" ] || { echo "found $n of '$2', want exactly $3"; return 1; }
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

NODE_TS=(node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)

# Inspect actual rendered <footer class="end"> HTML structure against content/site.ts and lib/pages.ts.
FOOTER_CHECK_JS='
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { site } from "./content/site.ts";
import { CONSOLE_MENU } from "./lib/pages.ts";

const file = process.argv[1];
const isHome = process.argv[2] === "home";
const html = readFileSync(file, "utf8");

// Strip <script> blocks so RSC payload strings cannot masquerade as rendered DOM.
const dom = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
const decode = (s) =>
  s
    .replace(/&#x27;/g, "\x27")
    .replace(/&apos;/g, "\x27")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&");
const stripTags = (s) => decode(s.replace(/<[^>]+>/g, "")).trim();

const mainTags = [...dom.matchAll(/<main\b[^>]*id="main"[^>]*>/g)];
assert.equal(mainTags.length, 1, `expected 1 main#main, found ${mainTags.length}`);

const mainNavs = [...dom.matchAll(/aria-label="Main"/g)];
assert.equal(mainNavs.length, isHome ? 0 : 1, `expected ${isHome ? 0 : 1} aria-label="Main", found ${mainNavs.length}`);

const footers = [...dom.matchAll(/<footer\b[^>]*>[\s\S]*?<\/footer>/g)];
assert.equal(footers.length, 1, `expected 1 <footer>, found ${footers.length}`);

const footerHtml = footers[0][0];
const mainClose = dom.indexOf("</main>");
const footerStart = footers[0].index ?? -1;
assert.ok(mainClose !== -1 && footerStart > mainClose, "footer must appear after </main>");
assert.match(footerHtml, /^<footer\b[^>]*\bclass="end"[^>]*\baria-labelledby="end-title"/);
assert.doesNotMatch(footerHtml, /aria-label="Main"/, "footer must not add aria-label=\"Main\"");
assert.match(footerHtml, /<nav\b[^>]*\baria-label="Footer"/, "missing footer nav landmark");

// Heading and copy
const h2 = footerHtml.match(/<h2\b[^>]*\bid="end-title"[^>]*>([\s\S]*?)<\/h2>/);
assert.ok(h2, "missing h2#end-title");
// RisoText adds aria-hidden character plates after its uninterrupted plain source.
// Stay inside this h2: decorative copies or text elsewhere cannot satisfy its title.
const source = h2[1].match(/<span\b[^>]*\bclass="(?:[^"]*\s)?riso-source(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/span>/);
assert.equal(stripTags(source ? source[1] : h2[1]), site.end.title);
assert.ok(decode(footerHtml).includes(site.end.sub), "missing secondary copy");

// Six canonical page links in CONSOLE_MENU order
const pageLinks = [...footerHtml.matchAll(/<a\b([^>]*\bdata-end-page="[^"]*"[^>]*)>([\s\S]*?)<\/a>/g)];
assert.equal(pageLinks.length, CONSOLE_MENU.length, `expected ${CONSOLE_MENU.length} page links, found ${pageLinks.length}`);
for (let i = 0; i < CONSOLE_MENU.length; i++) {
  const attrs = pageLinks[i][1];
  const text = stripTags(pageLinks[i][2]);
  const href = attrs.match(/\bhref="([^"]*)"/)?.[1];
  assert.equal(href, CONSOLE_MENU[i].href, `page link ${i} href`);
  assert.ok(text.includes(CONSOLE_MENU[i].label), `page link ${i} text "${text}" missing "${CONSOLE_MENU[i].label}"`);
}

// Four canonical contact links in site.lines order with away() semantics
const lineLinks = [...footerHtml.matchAll(/<a\b([^>]*\bdata-end-line="[^"]*"[^>]*)>([\s\S]*?)<\/a>/g)];
assert.equal(lineLinks.length, site.lines.length, `expected ${site.lines.length} contact links, found ${lineLinks.length}`);
for (let i = 0; i < site.lines.length; i++) {
  const attrs = lineLinks[i][1];
  const text = stripTags(lineLinks[i][2]);
  const want = site.lines[i];
  const href = attrs.match(/\bhref="([^"]*)"/)?.[1];
  assert.equal(href, want.href, `contact link ${i} href`);
  assert.ok(text.includes(want.label), `contact link ${i} text "${text}" missing "${want.label}"`);
  if (want.href.startsWith("mailto:")) {
    assert.doesNotMatch(attrs, /\btarget=/, "mailto link must not set target");
    assert.doesNotMatch(attrs, /\brel=/, "mailto link must not set rel");
  } else {
    assert.match(attrs, /\btarget="_blank"/, `${want.label} missing target="_blank"`);
    assert.match(attrs, /\brel="me noreferrer"/, `${want.label} missing rel="me noreferrer"`);
  }
}

// Still scene, mascot button, readout, reserved badge, wobble slider, 5 swatches, credits, cached UTC year, Back to top
assert.match(footerHtml, /\bdata-end-stage=""/);
// The waterline closes the footer: one wave and the way down to Ryugu-jo, after everything else.
const waterAt = footerHtml.search(/<div\b[^>]*\bdata-end-waterline=""/);
assert.ok(waterAt !== -1, "missing the waterline");
const sceneHtml = footerHtml.slice(0, waterAt);
const waterHtml = footerHtml.slice(waterAt);
assert.match(waterHtml, /<a\b[^>]*\bhref="\/ryugu"[^>]*\bdata-end-ryugu=""/, "missing the waterline link to /ryugu");
assert.ok(decode(waterHtml).includes(site.end.below), "missing the waterline copy");
assert.equal([...waterHtml.matchAll(/<a\b/g)].length, 1, "the waterline holds one link");
assert.match(sceneHtml, /\bdata-end-top=""/, "Back to top must come before the waterline");
assert.doesNotMatch(waterHtml, /\bdata-end-(page|line|top|stage)=/, "nothing of the footer sits below the waterline");
const svgs = [...sceneHtml.matchAll(/<svg\b[^>]*>/g)];
assert.equal(svgs.length, 3, `expected 3 SVG layers (ground Inked, console Inked, sky), found ${svgs.length}`);
const waves = [...waterHtml.matchAll(/<svg\b[^>]*>/g)];
assert.equal(waves.length, 1, `expected 1 waterline wave, found ${waves.length}`);
assert.ok([...svgs, ...waves].every((m) => m[0].includes("aria-hidden=\"true\"")), "every decorative SVG must be aria-hidden");
assert.match(footerHtml, /<button\b[^>]*\btype="button"[^>]*\bdata-end-mascot=""[^>]*\baria-label="Poke the save-point console"/);
assert.match(footerHtml, /<p\b[^>]*\bdata-end-readout=""[^>]*\baria-live="polite"[^>]*>/);
assert.ok(decode(footerHtml).includes(site.end.idle.readout), "missing idle readout copy");
assert.match(footerHtml, /<span\b[^>]*\bdata-end-badge=""[^>]*\bdata-unlocked="false"/);
assert.match(footerHtml, /<summary\b[^>]*\bdata-end-disclosure=""/);
assert.match(footerHtml, /<input\b[^>]*\bdata-end-wobble=""[^>]*\btype="range"[^>]*\bmin="0"[^>]*\bmax="7"[^>]*\bstep="0\.1"[^>]*\bvalue="3\.5"/);
const radios = [...footerHtml.matchAll(/<input\b[^>]*\btype="radio"/g)];
assert.equal(radios.length, 5, `expected 5 swatch radio inputs, found ${radios.length}`);
assert.ok(decode(footerHtml).includes(site.end.signature), "missing signature");
const utcYear = String(new Date().getUTCFullYear());
const copyMatch = footerHtml.match(/<span\b[^>]*\bdata-end-copyright=""[^>]*>([\s\S]*?)<\/span>/);
assert.ok(copyMatch, "missing data-end-copyright");
assert.equal(stripTags(copyMatch[1]), `© ${utcYear} Otohime`);
assert.match(footerHtml, /<a\b[^>]*\bhref="#main"[^>]*\bdata-end-top=""/);
'

footer_structure_ok() {
  "${NODE_TS[@]}" --input-type=module -e "$FOOTER_CHECK_JS" "$WORK/$1.body" "$1"
}

no_site_footer_in_dom() {
  "${NODE_TS[@]}" --input-type=module -e '
    import assert from "node:assert/strict";
    import { readFileSync } from "node:fs";
    const html = readFileSync(process.argv[1], "utf8");
    const dom = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    assert.doesNotMatch(dom, /<footer\b[^>]*\bclass="end"/);
    assert.doesNotMatch(dom, /\bdata-end-stage\b/);
    assert.doesNotMatch(dom, /\bid="end-title"/);
  ' "$WORK/$1.body"
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

# 1. Walk all seven public site pages
for idx in "${!PUBLIC_KEYS[@]}"; do
  key="${PUBLIC_KEYS[$idx]}"
  path="${PUBLIC_PATHS[$idx]}"
  get "$key" "$path"
  check "$path returns 200" status_is "$key" 200
  check "$path build-sha" build_sha_matches "$key"
  check "$path has one semantic .end footer after main with canonical links, scene, knobs and UTC year" footer_structure_ok "$key"
done

# 2. Walk auth pages and global 404
get signin /sign-in
check "/sign-in returns 200" status_is signin 200
check "/sign-in build-sha" build_sha_matches signin
check "/sign-in has no <footer>" count_eq signin '<footer' 0
check "/sign-in has no site footer stage" no_site_footer_in_dom signin

get forgot /forgot-password
check "/forgot-password returns 200" status_is forgot 200
check "/forgot-password has no <footer>" count_eq forgot '<footer' 0
check "/forgot-password has no site footer stage" no_site_footer_in_dom forgot

get missing /does-not-exist
check "/does-not-exist returns 404" status_is missing 404
check "/does-not-exist shows the lost sheet 404" has missing 'This page got lost'
check "/does-not-exist has no <footer>" count_eq missing '<footer' 0
check "/does-not-exist has no site footer stage" no_site_footer_in_dom missing

# 3. Walk all eleven isolated project roots
for p in "${PROJECTS[@]}"; do
  get "proj-$p" "/$p"
  check "/$p returns 200" status_is "proj-$p" 200
  check "/$p build-sha" build_sha_matches "proj-$p"
  check "/$p stays isolated from the site footer" no_site_footer_in_dom "proj-$p"
done

if [ "$LOCAL" -eq 1 ]; then
  check "local server logged no runtime errors" no_server_errors
  cleanup
  SERVER_PID=""
  check "no server left on port $PORT" no_server_left
fi

echo "walk: $OK ok, $FAILED failed"
[ "$FAILED" -eq 0 ]
