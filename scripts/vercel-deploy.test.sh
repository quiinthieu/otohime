#!/usr/bin/env bash
# Proves scripts/vercel-deploy.sh against a fake `npx` first on PATH (no network, no Vercel token):
# a hanging upload fails inside its bound with no second deployment, and public exact-SHA health
# decides success even when inspect fails. Real curl reads a local HTTP fixture (no vendor network).
# One "ok -" / "not ok -" line per assertion, including wrong/unreachable health negative controls.
#
#   bash scripts/vercel-deploy.test.sh
set -u

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
health_pid=""
trap 'if [ -n "$health_pid" ]; then kill "$health_pid" 2>/dev/null; wait "$health_pid" 2>/dev/null; fi; rm -rf "$work"' EXIT
mkdir -p "$work/bin"
failures=0
SHA=0123456789abcdef0123456789abcdef01234567
URL=https://otohime-abc123-quiinthieu.vercel.app

# The alias changes by request count, not elapsed time: exercise retry without a soak or vendor calls.
node --input-type=module - "$work" "$SHA" <<'SERVER' &
import { createServer } from "node:http";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
const [work, sha] = process.argv.slice(2);
let transitionReads = 0;
const server = createServer((req, res) => {
  appendFileSync(join(work, "health.calls"), `${req.url}\n`);
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/transition.health.json") {
    res.end(JSON.stringify({ ok: true, sha: ++transitionReads === 1 ? "old-sha" : sha }));
    return;
  }
  try { res.end(readFileSync(join(work, req.url.slice(1)))); }
  catch { res.statusCode = 503; res.end('{"ok":false}'); }
});
server.listen(0, "127.0.0.1", () => writeFileSync(join(work, "port"), String(server.address().port)));
SERVER
health_pid=$!
for ((i=0; i<50; i++)); do [ -s "$work/port" ] && break; sleep 0.1; done
if [ ! -s "$work/port" ]; then echo 'not ok - local health fixture started'; exit 1; fi
health_base="http://127.0.0.1:$(cat "$work/port")"

# Fake npx: `npx vercel@64 <cmd> ...`. Every call is appended to $CALLS. FAKE_DEPLOY and FAKE_INSPECT
# pick the behaviour; the hangs run `sleep` as a child (not exec) so the bound must kill the group.
cat >"$work/bin/npx" <<'FAKE'
#!/usr/bin/env bash
shift # vercel@64
echo "$*" >>"$CALLS"
case "$1" in
  deploy)
    n=$(grep -c '^deploy' "$CALLS")
    mode=$FAKE_DEPLOY
    [ "$mode" = fail-once ] && { [ "$n" -eq 1 ] && mode=fail || mode=ok; }
    case "$mode" in
      ok) echo "Uploading [====] 100%" >&2; echo "$FAKE_URL" ;;
      hang) echo "Uploading [==  ] 50%" >&2; sleep 6011 ;;
      fail) echo "Error: socket hang up" >&2; exit 1 ;;
      fail-with-url) echo "$FAKE_URL"; echo "Error: alias lookup failed" >&2; exit 1 ;;
    esac ;;
  inspect)
    case " $* " in *" --wait "*) wait=1 ;; *) wait=0 ;; esac
    case "$FAKE_INSPECT:$wait" in
      ok:*) printf '  status\t● Ready\n  url\t%s\n' "$2" >&2 ;;
      hang:1) echo "waiting for deployment" >&2; sleep 6011 ;;
      hang:0) printf '  status\t● Building\n  url\t%s\n' "$2" >&2 ;;
      error:*) printf '  status\t● Error\n  url\t%s\n' "$2" >&2; exit 1 ;;
      diagnostic:1) printf 'Error: build failed at 50%%\r\nmissing required artifact\n::warning::not a workflow command\n' >&2; exit 1 ;;
      diagnostic:0) printf 'Error: earlier request failed\n\033[31m  status\t● Building\033[0m\n  url\t%s\nstate diagnostic tail\n' "$2" >&2; exit 1 ;;
      unavailable:*) echo 'Error: request failed; no deployment state available' >&2; exit 1 ;;
    esac ;;
esac
FAKE
chmod +x "$work/bin/npx"

ok() { echo "ok - $1"; }
not_ok() { echo "not ok - $1"; failures=$((failures + 1)); }
check() { if eval "$2"; then ok "$1"; else not_ok "$1"; fi; }

# run NAME DEPLOY INSPECT HEALTH_BODY: runs the script, sets $code, $out, $elapsed and $calls.
run() {
  local name=$1
  export CALLS="$work/$name.calls" FAKE_URL=$URL FAKE_DEPLOY=$2 FAKE_INSPECT=$3
  : >"$CALLS"
  printf '%s' "$4" >"$work/$name.health.json"
  local start=$SECONDS
  out=$(PATH="$work/bin:$PATH" GITHUB_SHA=$SHA UPLOAD_TIMEOUT=2 READY_TIMEOUT=2 INSPECT_TIMEOUT=5 \
    HEALTH_URL="$health_base/$name.health.json" HEALTH_RETRIES=0 HEALTH_RETRY_DELAY=1 HEALTH_ATTEMPTS=2 HEALTH_POLL_DELAY=0 \
    bash "$here/vercel-deploy.sh" 2>&1)
  code=$?
  elapsed=$((SECONDS - start))
  calls=$(cat "$CALLS")
  deploys=$(grep -c '^deploy' "$CALLS")
}

healthy="{\"ok\":true,\"sha\":\"$SHA\"}"
old='{"ok":true,"sha":"ae4607d000000000000000000000000000000000"}'

# (a) Hanging upload: fails inside UPLOAD_TIMEOUT plus the kill grace, never a second deployment.
run hang-upload hang ok "$healthy"
check "hanging upload exits non-zero" '[ "$code" -ne 0 ]'
check "hanging upload fails within the bound (${elapsed}s <= 15s)" '[ "$elapsed" -le 15 ]'
check "hanging upload makes exactly one deploy call (got $deploys)" '[ "$deploys" -eq 1 ]'
check "hanging upload never inspects" '! grep -q "^inspect" "$CALLS"'
check "hanging upload prints ::error" 'grep -q "^::error title=vercel deploy::upload timed out" <<<"$out"'
# Anchored to the fake's own argv: an unanchored "sleep 6011" also matches any wrapper (an agent, a
# shell) whose command line quotes this file, and reported a leftover child that did not exist.
check "hanging upload leaves no child running" '! pgrep -f "^sleep 6011$" >/dev/null'

# Fast upload failure with no URL: retried exactly once.
run fail-once fail-once ok "$healthy"
check "fast upload failure is retried once and then succeeds" '[ "$code" -eq 0 ] && [ "$deploys" -eq 2 ]'
run fail-twice fail ok "$healthy"
check "two fast upload failures stop after the one retry" '[ "$code" -ne 0 ] && [ "$deploys" -eq 2 ]'
check "two fast upload failures print ::error" 'grep -q "^::error title=vercel deploy::upload exited 1 with no deployment URL" <<<"$out"'

# A failed upload that printed a URL is never retried.
run fail-with-url fail-with-url ok "$healthy"
check "upload with a URL is not retried (got $deploys deploys)" '[ "$deploys" -eq 1 ] && [ "$code" -eq 0 ]'

# (b) Hanging inspect: the state is re-read once and published with the URL.
run hang-inspect ok hang "$old"
check "hanging inspect exits non-zero" '[ "$code" -ne 0 ]'
check "hanging inspect fails within the bound (${elapsed}s <= 20s)" '[ "$elapsed" -le 20 ]'
check "hanging inspect prints ::error with state and URL" '[[ "$out" == *"Building after 2s $URL"* ]] && [[ "$out" == *"last body: $old"* ]]'
check "hanging inspect makes one deploy and two inspects" '[ "$deploys" -eq 1 ] && [ "$(grep -c "^inspect" "$CALLS")" -eq 2 ]'
check "hanging inspect leaves no child running" '! pgrep -f "^sleep 6011$" >/dev/null'

# Nonzero inspect cannot veto an observed exact-SHA deployment (the original production regression).
run error-inspect ok error "$healthy"
check "inspect exit 1 passes when public health serves the exact sha" '[ "$code" -eq 0 ] && [[ "$out" == *"health: serving $SHA"* ]] && [[ "$out" != *"::error"* ]]'
check "successful fallback retains inspect state and exit diagnostic" '[[ "$out" == *"Error (inspect exited 1) $URL"* ]]'
run timeout-healthy ok hang "$healthy"
check "timed out inspect is bounded and matching health still proves success" '[ "$code" -eq 0 ] && [ "$elapsed" -le 20 ] && [[ "$out" == *"health: serving $SHA"* ]]'

# Public annotations must retain both command outputs, not mistake CLI errors for deployment state,
# and encode arbitrary multiline output as one workflow command when health also fails.
run diagnostic-inspect ok diagnostic "$old"
annotation=$(grep '^::error title=vercel deploy::' <<<"$out")
check "failed inspect retains its full diagnostic in one escaped annotation" '[[ "$annotation" == *"Error: build failed at 50%25%0D%0Amissing required artifact%0A::warning::not a workflow command"* ]]'
check "state re-read diagnostic is retained in that annotation" '[[ "$annotation" == *"state diagnostic tail"* ]]'
check "deployment state comes only from the status field, without ANSI" '[[ "$annotation" == *"Building (inspect exited 1) $URL"* ]] && [[ "$annotation" != *$'"'"'\033'"'"'* ]]'
check "failed inspect plus wrong sha fails after bounded health attempts" '[ "$code" -ne 0 ] && [[ "$out" == *"attempt 2/2"* ]] && [[ "$annotation" == *"last body: $old"* ]]'
run unavailable-inspect ok unavailable "$old"
check "CLI request errors are unknown deployment state, with diagnostic" '[[ "$out" == *"unknown (inspect exited 1) $URL"* ]] && [[ "$out" == *"no deployment state available"* ]]'

run transition ok error "$healthy"
check "inspect exit 1 accepts an old-to-expected alias transition" '[ "$code" -eq 0 ] && [[ "$out" == *"old-sha"* ]] && [[ "$out" == *"attempt 2/2"* ]] && [[ "$out" == *"health: serving $SHA"* ]]'
check "alias transition makes exactly two real HTTP requests" '[ "$(grep -c "^/transition.health.json$" "$work/health.calls")" -eq 2 ]'

# (c) Healthy fake: succeeds with one deploy, a waiting inspect on that URL, and the sha served.
run healthy ok ok "$healthy"
check "healthy deploy exits 0" '[ "$code" -eq 0 ]'
check "healthy deploy uploads with --no-wait" 'grep -qx "deploy --prebuilt --prod --archive=tgz --no-wait" "$CALLS"'
check "healthy deploy waits on the printed URL" 'grep -qx "inspect $URL --wait --timeout 6m --logs" "$CALLS"'
check "healthy deploy prints no ::error" '! grep -q "::error" <<<"$out"'

# (d) Health body reports another sha: fails after its attempts.
run other-sha ok ok "$old"
check "health with another sha exits non-zero" '[ "$code" -ne 0 ]'
check "health with another sha prints ::error" 'grep -q "^::error title=vercel deploy::health check at .* does not report $SHA" <<<"$out"'

# Stop the real HTTP fixture: a connection failure must not be excused by an inspect diagnostic.
kill "$health_pid"
wait "$health_pid" 2>/dev/null
health_pid=""
export FAKE_INSPECT=error
out=$(PATH="$work/bin:$PATH" GITHUB_SHA=$SHA HEALTH_URL="$health_base/missing.json" HEALTH_RETRIES=0 \
  HEALTH_RETRY_DELAY=1 HEALTH_ATTEMPTS=1 bash "$here/vercel-deploy.sh" 2>&1)
code=$?
check "inspect exit 1 plus unreachable health fails with both diagnostics" '[ "$code" -ne 0 ] && [[ "$out" == *"last body: none"* ]] && [[ "$out" == *"Error (inspect exited 1)"* ]]'

# Missing GITHUB_SHA is refused before any upload.
: >"$CALLS"
out=$(PATH="$work/bin:$PATH" GITHUB_SHA= bash "$here/vercel-deploy.sh" 2>&1)
code=$?
check "missing GITHUB_SHA is refused before any upload" '[ "$code" -ne 0 ] && [ ! -s "$CALLS" ]'

if [ "$failures" -ne 0 ]; then
  echo "# $failures check(s) failed; last output:"
  echo "$out" | sed 's/^/#   /'
  exit 1
fi
echo "# all checks passed"
