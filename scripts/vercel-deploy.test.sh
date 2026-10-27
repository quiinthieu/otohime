#!/usr/bin/env bash
# Proves scripts/vercel-deploy.sh against a fake `npx` first on PATH (no network, no Vercel token):
# a hanging upload fails inside its bound with no second deployment, and matching health cannot
# rescue a failed inspect. Real curl reads a local HTTP fixture (no vendor network).
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
assertions=0
SHA=0123456789abcdef0123456789abcdef01234567
URL=https://otohime-abc123-quiinthieu.vercel.app

# The alias changes by request count, not elapsed time: exercise retry without a soak or vendor calls.
node --input-type=module - "$work" "$SHA" <<'SERVER' &
import { createServer } from "node:http";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
const [work, sha] = process.argv.slice(2);
let transitionReads = 0;
const lateReads = new Map();
const server = createServer((req, res) => {
  appendFileSync(join(work, "health.calls"), `${req.url}\n`);
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/transition.health.json") {
    res.end(JSON.stringify({ ok: true, sha: ++transitionReads === 1 ? "old-sha" : sha }));
    return;
  }
  if (["/late-transition.health.json", "/default-transition.health.json"].includes(req.url)) {
    const reads = (lateReads.get(req.url) ?? 0) + 1;
    lateReads.set(req.url, reads);
    res.end(JSON.stringify({ ok: true, sha: reads < 5 ? "old-sha" : sha }));
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
      zero-error:*) printf '  status\t● Error\n  readyStateReason\tMissing output artifact\n' >&2 ;;
      canceled:*) printf '  status\t● Canceled\n  readyStateReason\tDeployment canceled\n' >&2; exit 7 ;;
      reread-hang:1) echo 'Error: request interrupted' >&2; exit 7 ;;
      reread-hang:0) echo 'state re-read started' >&2; sleep 6011 ;;
      large:*) printf 'Error: request failed\n'; head -c 12000 /dev/zero | tr '\0' x; printf '\nreadyStateReason: bounded diagnostic tail\n'; exit 9 ;;
      diagnostic:1) printf 'Error: build failed at 50%%\r\nmissing required artifact\n::warning::not a workflow command\n' >&2; exit 1 ;;
      diagnostic:0) printf 'Error: earlier request failed\n\033[31m  status\t● Building\033[0m\n  url\t%s\n  readyStateReason\tMissing output artifact at 50%%\nstate diagnostic tail\n' "$2" >&2; exit 7 ;;
      unavailable:*) echo 'Error: request failed; no deployment state available' >&2; exit 1 ;;
      user-not-found:*) echo 'Error: User not found' >&2; exit 1 ;;
    esac ;;
esac
FAKE
chmod +x "$work/bin/npx"

ok() { echo "ok - $1"; }
not_ok() { echo "not ok - $1"; failures=$((failures + 1)); }
check() { assertions=$((assertions + 1)); if eval "$2"; then ok "$1"; else not_ok "$1"; fi; }

# run NAME DEPLOY INSPECT HEALTH_BODY [ATTEMPTS|default]: sets $code, $out, $elapsed and $calls.
run() {
  local name=$1
  local -a attempts_env=("HEALTH_ATTEMPTS=${5:-2}")
  [ "${5:-}" = default ] && attempts_env=(-u HEALTH_ATTEMPTS)
  export CALLS="$work/$name.calls" FAKE_URL=$URL FAKE_DEPLOY=$2 FAKE_INSPECT=$3
  : >"$CALLS"
  printf '%s' "$4" >"$work/$name.health.json"
  local start=$SECONDS
  out=$(env "${attempts_env[@]}" PATH="$work/bin:$PATH" GITHUB_SHA=$SHA UPLOAD_TIMEOUT=2 READY_TIMEOUT=2 INSPECT_TIMEOUT=5 \
    HEALTH_URL="$health_base/$name.health.json" HEALTH_RETRIES=0 HEALTH_RETRY_DELAY=1 HEALTH_POLL_DELAY=0 \
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
check "hanging inspect prints ::error with state and URL" '[[ "$out" == *"::error title=vercel deploy::Building after 2s $URL"* ]]'
check "hanging inspect makes one deploy and two inspects" '[ "$deploys" -eq 1 ] && [ "$(grep -c "^inspect" "$CALLS")" -eq 2 ]'
check "hanging inspect leaves no child running" '! pgrep -f "^sleep 6011$" >/dev/null'

# Negative control: matching health must never rescue an unsuccessful inspect.
run error-inspect ok error "$healthy"
check "failed inspect cannot be rescued by matching health" '[ "$code" -ne 0 ] && [[ "$out" == *"Error (inspect exited 1) $URL"* ]] && [[ "$out" == *"::error"* ]]'
check "failed inspect never reaches matching health" '! grep -q "^/error-inspect.health.json$" "$work/health.calls"'
run zero-error ok zero-error "$healthy"
check "labelled Error fails closed even when inspect exits zero" '[ "$code" -ne 0 ] && [[ "$out" == *"Error (inspect exited 0)"* ]] && [[ "$out" == *"Missing output artifact"* ]]'
run canceled ok canceled "$healthy"
check "cancelled deployment fails with original inspect exit and reason" '[ "$code" -ne 0 ] && [[ "$out" == *"Canceled (inspect exited 7)"* ]] && [[ "$out" == *"Deployment canceled"* ]]'
run timeout-healthy ok hang "$healthy"
check "timed out inspect is bounded and matching health cannot rescue it" '[ "$code" -ne 0 ] && [ "$elapsed" -le 20 ] && [[ "$out" == *"Building after 2s"* ]]'
run reread-hang ok reread-hang "$healthy"
check "state re-read timeout retains both exits and stderr within its bound" '[ "$code" -ne 0 ] && [ "$elapsed" -le 20 ] && [[ "$out" == *"inspect --wait output (exit 7,"* ]] && [[ "$out" == *"state re-read output (exit 124,"* ]] && [[ "$out" == *"state re-read started"* ]]'
check "state re-read timeout leaves no child running" '! pgrep -f "^sleep 6011$" >/dev/null'

# Public annotations must retain both command outputs, not mistake CLI errors for deployment state,
# and encode arbitrary multiline output as one workflow command when inspect fails.
run diagnostic-inspect ok diagnostic "$old"
annotation=$(grep '^::error title=vercel deploy::' <<<"$out")
check "failed inspect retains its full diagnostic in one escaped annotation" '[[ "$annotation" == *"Error: build failed at 50%25%0D%0Amissing required artifact%0A::warning::not a workflow command"* ]]'
check "state re-read reason and distinct command exits are retained in that annotation" '[[ "$annotation" == *"state diagnostic tail"* ]] && [[ "$annotation" == *"readyStateReason"* ]] && [[ "$annotation" == *"Missing output artifact at 50%25"* ]] && [[ "$annotation" == *"inspect --wait output (exit 1,"* ]] && [[ "$annotation" == *"state re-read output (exit 7,"* ]]'
check "deployment state comes only from the status field, without ANSI" '[[ "$annotation" == *"Building (inspect exited 1) $URL"* ]] && [[ "$annotation" != *$'"'"'\033'"'"'* ]]'
check "failed inspect plus wrong sha fails before health polling" '[ "$code" -ne 0 ] && ! grep -q "^/diagnostic-inspect.health.json$" "$work/health.calls"'
run unavailable-inspect ok unavailable "$healthy"
check "CLI request errors fail with unknown deployment state, not labelled Error" '[ "$code" -ne 0 ] && [[ "$out" == *"unknown (inspect exited 1) $URL"* ]] && [[ "$out" == *"no deployment state available"* ]]'
run large-inspect ok large "$healthy"
annotation=$(grep '^::error title=vercel deploy::' <<<"$out")
check "oversized vendor output has one bounded annotation with both actionable tails" '[ "$code" -ne 0 ] && [ "${#annotation}" -lt 9000 ] && [ "$(grep -c "^::error" <<<"$out")" -eq 1 ] && [ "$(grep -o "readyStateReason: bounded diagnostic tail" <<<"$annotation" | wc -l)" -eq 2 ]'

run transition ok ok "$healthy"
check "ready inspect accepts an old-to-expected alias transition" '[ "$code" -eq 0 ] && [[ "$out" == *"old-sha"* ]] && [[ "$out" == *"attempt 2/2"* ]] && [[ "$out" == *"health: serving $SHA"* ]]'
check "alias transition makes exactly two real HTTP requests" '[ "$(grep -c "^/transition.health.json$" "$work/health.calls")" -eq 2 ]'

# A slow production alias still gets twelve reads after inspect succeeds.
run late-transition ok ok "$healthy" 12
check "ready inspect accepts the exact sha on the fifth of twelve reads" '[ "$code" -eq 0 ] && [[ "$out" == *"old-sha"* ]] && [[ "$out" == *"attempt 5/12"* ]] && [[ "$out" == *"health: serving $SHA"* ]] && [[ "$out" != *"::error"* ]]'
check "late alias transition makes one upload, one inspect and five HTTP requests" '[ "$deploys" -eq 1 ] && [ "$(grep -c "^inspect" "$CALLS")" -eq 1 ] && [ "$(grep -c "^/late-transition.health.json$" "$work/health.calls")" -eq 5 ]'
run default-transition ok ok "$healthy" default
check "production default allows the fifth-read transition without another upload" '[ "$code" -eq 0 ] && [ "$deploys" -eq 1 ] && [[ "$out" == *"attempt 5/12"* ]] && [[ "$out" == *"health: serving $SHA"* ]] && [ "$(grep -c "^/default-transition.health.json$" "$work/health.calls")" -eq 5 ]'

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
run unhealthy ok ok "{\"ok\":false,\"sha\":\"$SHA\"}"
check "matching sha in an unhealthy body cannot pass" '[ "$code" -ne 0 ]'
run nested-sha ok ok "{\"ok\":true,\"previous\":{\"sha\":\"$SHA\"}}"
check "matching nested sha cannot impersonate the served executable" '[ "$code" -ne 0 ]'
run malformed ok ok "not-json $healthy"
check "malformed health cannot pass by containing a matching sha" '[ "$code" -ne 0 ]'
run pretty ok ok "{ \"ok\": true, \"sha\": \"$SHA\" }"
check "valid formatted JSON health passes exact source identity" '[ "$code" -eq 0 ]'

# Stop the real HTTP fixture: even a successful inspect cannot excuse unreachable health.
kill "$health_pid"
wait "$health_pid" 2>/dev/null
health_pid=""
export FAKE_INSPECT=ok
out=$(PATH="$work/bin:$PATH" GITHUB_SHA=$SHA HEALTH_URL="$health_base/missing.json" HEALTH_RETRIES=0 \
  HEALTH_RETRY_DELAY=1 HEALTH_ATTEMPTS=1 bash "$here/vercel-deploy.sh" 2>&1)
code=$?
check "ready inspect plus unreachable health fails with a public diagnostic" '[ "$code" -ne 0 ] && [[ "$out" == *"::error title=vercel deploy::health check"* ]] && [[ "$out" == *"last body, first 1000 bytes: none"* ]]'

# Missing GITHUB_SHA is refused before any upload.
: >"$CALLS"
out=$(PATH="$work/bin:$PATH" GITHUB_SHA= bash "$here/vercel-deploy.sh" 2>&1)
code=$?
check "missing GITHUB_SHA is refused before any upload" '[ "$code" -ne 0 ] && [ ! -s "$CALLS" ]'

# Syntax construction has an intentional malformed-shell control, without running a deploy.
check "deployment scripts parse as Bash without executing" 'bash -n "$here/vercel-deploy.sh" "$here/vercel-deploy.test.sh" "$here/verify-deploy.sh"'
printf 'if then\n' >"$work/invalid.sh"
check "syntax negative control rejects malformed Bash" '! bash -n "$work/invalid.sh" 2>/dev/null'

if [ "$assertions" -eq 0 ] || [ "$failures" -ne 0 ]; then
  echo "# $failures check(s) failed; last output:"
  echo "$out" | sed 's/^/#   /'
  exit 1
fi
echo "# all $assertions assertions passed"
