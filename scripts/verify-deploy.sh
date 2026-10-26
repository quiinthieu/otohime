#!/usr/bin/env bash
# Prove a deployment serves the expected commit and still has the Pocket Terminal and the Ink Poster Press.
#
#   bash scripts/verify-deploy.sh https://otohime.dev "$(git rev-parse HEAD)"
#   BASE_URL=https://otohime.dev EXPECT_SHA=<40-hex sha> bash scripts/verify-deploy.sh
#   bash scripts/verify-deploy.sh --self-test     # negative and positive controls against a local fake server
#
# 1. Polls $BASE_URL/api/health until its `sha` equals EXPECT_SHA exactly, for at most VERIFY_TIMEOUT seconds
#    (default 300, capped at 590 so the bound stays under 10 minutes), every VERIFY_INTERVAL seconds (default 10).
#    A sha that never matches, a non-200 answer or nothing listening exits 1 and names what it last saw.
# 2. Runs e2e/pocket-terminal.test.ts and e2e/ink-press.test.ts against BASE_URL (scripts/e2e.mjs runs the suite
#    as it is when BASE_URL is set). Both are read-only: no form posts, no sign-in. They need Google Chrome or
#    CHROME_PATH, like npm run test:e2e.
# Exit 0 only when both hold; 1 on a failed check; 2 on bad arguments.
# VERIFY_E2E_CMD replaces step 2 with a shell command (the self-test uses it; never set it in CI).
set -u

cd "$(dirname "$0")/.." || exit 2

NODE_TS=(node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON)
MAX_TIMEOUT=590

verify() {
  local base="${1:-${BASE_URL:-}}" want="${2:-${EXPECT_SHA:-}}"
  local timeout="${VERIFY_TIMEOUT:-300}" interval="${VERIFY_INTERVAL:-10}"
  base="${base%/}"

  if [ -z "$base" ]; then
    echo "usage: bash scripts/verify-deploy.sh BASE_URL EXPECT_SHA (or set BASE_URL and EXPECT_SHA)" >&2
    return 2
  fi
  if ! printf '%s' "$want" | grep -qE '^[0-9a-f]{40}$'; then
    echo "not ok - EXPECT_SHA must be a full 40-hex commit sha, got '${want}'" >&2
    return 2
  fi
  if ! printf '%s' "$timeout" | grep -qE '^[0-9]+$' || ! printf '%s' "$interval" | grep -qE '^[1-9][0-9]*$'; then
    echo "not ok - VERIFY_TIMEOUT and VERIFY_INTERVAL must be whole seconds" >&2
    return 2
  fi
  [ "$timeout" -le "$MAX_TIMEOUT" ] || timeout="$MAX_TIMEOUT"

  echo "# polling $base/api/health for sha $want, at most ${timeout}s"
  local deadline=$(($(date +%s) + timeout)) tries=0 code body got seen
  while :; do
    tries=$((tries + 1))
    body="$(curl -sS --max-time 10 -H 'Cache-Control: no-cache' -w '\n%{http_code}' "$base/api/health?verify=$(date +%s)" 2>&1)"
    code="${body##*$'\n'}"
    body="${body%$'\n'*}"
    got="$(printf '%s' "$body" | grep -oE '"sha"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n 1 | sed -E 's/.*"([^"]*)"$/\1/')"
    if [ "$code" = "200" ] && [ "$got" = "$want" ]; then
      echo "ok - /api/health serves $want (try $tries)"
      break
    fi
    if [ "$code" = "200" ]; then
      seen="sha '${got:-none}'"
    else
      seen="HTTP ${code:-none}: $(printf '%s' "$body" | tr '\n' ' ' | cut -c1-160)"
    fi
    if [ $(($(date +%s) + interval)) -gt "$deadline" ]; then
      echo "not ok - /api/health never served $want within ${timeout}s ($tries tries); last got $seen"
      return 1
    fi
    echo "# try $tries: $seen, want $want; again in ${interval}s"
    sleep "$interval"
  done

  echo "# running the Pocket Terminal and Ink Poster Press e2e against $base"
  local status=0
  if [ -n "${VERIFY_E2E_CMD:-}" ]; then
    BASE_URL="$base" bash -c "$VERIFY_E2E_CMD" || status=$?
  else
    BASE_URL="$base" "${NODE_TS[@]}" scripts/e2e.mjs --test e2e/pocket-terminal.test.ts e2e/ink-press.test.ts || status=$?
  fi
  if [ "$status" -ne 0 ]; then
    echo "not ok - terminal/press e2e failed against $base (exit $status)"
    return 1
  fi
  echo "ok - $base serves $want with the Pocket Terminal and the Ink Poster Press"
}

# A local /api/health that answers `<old sha>` for its first <n> requests, then `<sha>`; or HTTP 500 with "500".
FAKE_HEALTH_JS='
const http = require("node:http");
const fs = require("node:fs");
const [portFile, sha, old, n] = process.argv.slice(1);
let count = 0;
const server = http.createServer((req, res) => {
  if (!req.url.startsWith("/api/health")) { res.writeHead(404); return res.end(); }
  count++;
  if (sha === "500") { res.writeHead(500, { "content-type": "text/plain" }); return res.end("boom"); }
  const now = old && count <= Number(n) ? old : sha;
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: true, sha: now }));
});
server.listen(0, "127.0.0.1", () => fs.writeFileSync(portFile, String(server.address().port)));
'

self_test() {
  local pass=0 fail=0 port
  # Globals, so the EXIT trap still sees them once this function has returned.
  WORK="$(mktemp -d "${TMPDIR:-/tmp}/verify-deploy.XXXXXX")"
  SERVER=""
  trap '[ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null; rm -rf "$WORK"' EXIT
  local work="$WORK"
  local A=1111111111111111111111111111111111111111 B=2222222222222222222222222222222222222222

  serve() {
    [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null && wait "$SERVER" 2>/dev/null
    rm -f "$work/port"
    node -e "$FAKE_HEALTH_JS" "$work/port" "$@" &
    SERVER=$!
    for _ in $(seq 1 50); do [ -s "$work/port" ] && break; sleep 0.1; done
    port="$(cat "$work/port")"
  }
  # expect <name> <want exit: 0 | nonzero | N> <e2e: ran | skipped> [VAR=value...] [-- args...]
  # Runs this script against the fake with a short bound; the e2e stand-in touches $MARK when it is reached.
  expect() {
    local name="$1" want="$2" marker="$3" code=0 start=$SECONDS envs=() args=()
    shift 3
    while [ $# -gt 0 ] && [ "$1" != "--" ]; do envs+=("$1"); shift; done
    [ $# -gt 0 ] && shift
    args=("$@")
    rm -f "$work/e2e-ran"
    env VERIFY_TIMEOUT=4 VERIFY_INTERVAL=1 MARK="$work/e2e-ran" ${envs[@]+"${envs[@]}"} \
      bash scripts/verify-deploy.sh ${args[@]+"${args[@]}"} >"$work/out" 2>&1 || code=$?
    local ok=1 why=""
    case "$want" in
      0) [ "$code" -eq 0 ] || { ok=0; why="exit $code, want 0"; } ;;
      nonzero) [ "$code" -ne 0 ] || { ok=0; why="exit 0, want nonzero"; } ;;
      *) [ "$code" -eq "$want" ] || { ok=0; why="exit $code, want $want"; } ;;
    esac
    if [ "$marker" = ran ] && [ ! -f "$work/e2e-ran" ]; then ok=0; why="$why; e2e did not run"; fi
    if [ "$marker" = skipped ] && [ -f "$work/e2e-ran" ]; then ok=0; why="$why; e2e ran"; fi
    if [ $((SECONDS - start)) -gt 30 ]; then ok=0; why="$why; took $((SECONDS - start))s, the poll is not bounded"; fi
    if [ "$ok" -eq 1 ]; then
      pass=$((pass + 1))
      echo "ok - $name"
    else
      fail=$((fail + 1))
      echo "not ok - $name: $why"
      sed 's/^/#   /' "$work/out"
    fi
  }
  # The e2e stand-in proves it was reached, and with the base it was given.
  local reached='[ "$BASE_URL" = "$EXPECT_BASE" ] && touch "$MARK"' base

  serve "$A"
  base="http://127.0.0.1:$port"
  expect "negative control: health sha $A, EXPECT_SHA $B exits nonzero and skips e2e" nonzero skipped \
    BASE_URL="$base" EXPECT_SHA="$B" VERIFY_E2E_CMD='touch "$MARK"'
  if grep -qF "last got sha '$A'" "$work/out"; then
    pass=$((pass + 1))
    echo "ok - the mismatch names the sha it saw"
  else
    fail=$((fail + 1))
    echo "not ok - the mismatch output does not name sha $A"
    sed 's/^/#   /' "$work/out"
  fi
  expect "matching sha runs the e2e with BASE_URL (trailing slash trimmed) and exits 0" 0 ran \
    BASE_URL="$base/" EXPECT_SHA="$A" EXPECT_BASE="$base" VERIFY_E2E_CMD="$reached"
  expect "positional BASE_URL EXPECT_SHA work too" 0 ran \
    BASE_URL= EXPECT_SHA= EXPECT_BASE="$base" VERIFY_E2E_CMD="$reached" -- "$base" "$A"
  expect "matching sha with a failing e2e exits nonzero" nonzero skipped \
    BASE_URL="$base" EXPECT_SHA="$A" VERIFY_E2E_CMD="exit 1"

  serve "$B" "$A" 2
  base="http://127.0.0.1:$port"
  expect "a stale sha that turns into EXPECT_SHA mid-poll passes (the poll retries)" 0 ran \
    BASE_URL="$base" EXPECT_SHA="$B" EXPECT_BASE="$base" VERIFY_E2E_CMD="$reached"

  serve 500
  base="http://127.0.0.1:$port"
  expect "HTTP 500 from health exits nonzero" nonzero skipped \
    BASE_URL="$base" EXPECT_SHA="$A" VERIFY_E2E_CMD='touch "$MARK"'

  kill "$SERVER" 2>/dev/null && wait "$SERVER" 2>/dev/null
  SERVER=""
  expect "nothing listening exits nonzero" nonzero skipped \
    BASE_URL="$base" EXPECT_SHA="$A" VERIFY_E2E_CMD='touch "$MARK"'

  expect "EXPECT_SHA=dev is refused with exit 2" 2 skipped BASE_URL="$base" EXPECT_SHA=dev
  expect "a missing BASE_URL is refused with exit 2" 2 skipped BASE_URL= EXPECT_SHA="$A"

  echo "self-test: $pass ok, $fail failed"
  [ "$fail" -eq 0 ]
}

if [ "${1:-}" = "--self-test" ]; then
  self_test
else
  verify "$@"
fi
