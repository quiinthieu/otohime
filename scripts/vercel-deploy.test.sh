#!/usr/bin/env bash
# Proves scripts/vercel-deploy.sh against a fake `npx` first on PATH (no network, no Vercel token):
# a hanging upload fails inside its bound with no second deployment, a hanging inspect publishes the
# deployment state as ::error, a healthy deploy passes, and a health body for another sha fails.
# The health check reads real curl from file:// URLs. One "ok -" / "not ok -" line per check.
#
#   bash scripts/vercel-deploy.test.sh
set -u

here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/bin"
failures=0
SHA=0123456789abcdef0123456789abcdef01234567
URL=https://otohime-abc123-quiinthieu.vercel.app

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
    HEALTH_URL="file://$work/$name.health.json" HEALTH_RETRIES=1 HEALTH_RETRY_DELAY=1 HEALTH_ATTEMPTS=2 HEALTH_POLL_DELAY=0 \
    bash "$here/vercel-deploy.sh" 2>&1)
  code=$?
  elapsed=$((SECONDS - start))
  calls=$(cat "$CALLS")
  deploys=$(grep -c '^deploy' "$CALLS")
}

healthy="{\"ok\":true,\"sha\":\"$SHA\"}"

# (a) Hanging upload: fails inside UPLOAD_TIMEOUT plus the kill grace, never a second deployment.
run hang-upload hang ok "$healthy"
check "hanging upload exits non-zero" '[ "$code" -ne 0 ]'
check "hanging upload fails within the bound (${elapsed}s <= 15s)" '[ "$elapsed" -le 15 ]'
check "hanging upload makes exactly one deploy call (got $deploys)" '[ "$deploys" -eq 1 ]'
check "hanging upload never inspects" '! grep -q "^inspect" "$CALLS"'
check "hanging upload prints ::error" 'grep -q "^::error title=vercel deploy::upload timed out" <<<"$out"'
check "hanging upload leaves no child running" '! pgrep -f "sleep 6011" >/dev/null'

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
run hang-inspect ok hang "$healthy"
check "hanging inspect exits non-zero" '[ "$code" -ne 0 ]'
check "hanging inspect fails within the bound (${elapsed}s <= 20s)" '[ "$elapsed" -le 20 ]'
check "hanging inspect prints ::error with state and URL" 'grep -q "^::error title=vercel deploy::Building after 2s $URL%0A" <<<"$out"'
check "hanging inspect makes one deploy and two inspects" '[ "$deploys" -eq 1 ] && [ "$(grep -c "^inspect" "$CALLS")" -eq 2 ]'
check "hanging inspect leaves no child running" '! pgrep -f "sleep 6011" >/dev/null'

# A deployment that errors publishes the Error state.
run error-inspect ok error "$healthy"
check "errored deployment prints ::error with Error state" '[ "$code" -ne 0 ] && grep -q "^::error title=vercel deploy::Error (inspect exited 1) $URL%0A" <<<"$out"'

# Public annotations must retain both command outputs, not mistake CLI errors for deployment state,
# and encode arbitrary multiline output as one workflow command. Never reach health after failure.
run diagnostic-inspect ok diagnostic "$healthy"
annotation=$(grep '^::error title=vercel deploy::' <<<"$out")
check "failed inspect retains its full diagnostic in one escaped annotation" '[[ "$annotation" == *"Error: build failed at 50%25%0D%0Amissing required artifact%0A::warning::not a workflow command"* ]]'
check "state re-read diagnostic is retained in that annotation" '[[ "$annotation" == *"state diagnostic tail"* ]]'
check "deployment state comes only from the status field, without ANSI" '[[ "$annotation" == *"Building (inspect exited 1) $URL"* ]] && [[ "$annotation" != *$'"'"'\033'"'"'* ]]'
check "failed inspect stops before health even for a matching sha" '[ "$code" -ne 0 ] && ! grep -q "health:" <<<"$out"'
run unavailable-inspect ok unavailable "$healthy"
check "CLI request errors are unknown deployment state, with diagnostic" 'grep -q "^::error title=vercel deploy::unknown (inspect exited 1) $URL" <<<"$out" && [[ "$out" == *"no deployment state available"* ]]'

# (c) Healthy fake: succeeds with one deploy, a waiting inspect on that URL, and the sha served.
run healthy ok ok "$healthy"
check "healthy deploy exits 0" '[ "$code" -eq 0 ]'
check "healthy deploy uploads with --no-wait" 'grep -qx "deploy --prebuilt --prod --archive=tgz --no-wait" "$CALLS"'
check "healthy deploy waits on the printed URL" 'grep -qx "inspect $URL --wait --timeout 6m --logs" "$CALLS"'
check "healthy deploy prints no ::error" '! grep -q "::error" <<<"$out"'

# (d) Health body reports another sha: fails after its attempts.
run other-sha ok ok '{"ok":true,"sha":"ae4607d000000000000000000000000000000000"}'
check "health with another sha exits non-zero" '[ "$code" -ne 0 ]'
check "health with another sha prints ::error" 'grep -q "^::error title=vercel deploy::health check at .* does not report $SHA" <<<"$out"'

# Unreachable health endpoint also fails (curl gives up after its retries).
out=$(PATH="$work/bin:$PATH" GITHUB_SHA=$SHA HEALTH_URL="file://$work/missing.json" HEALTH_RETRIES=1 \
  HEALTH_RETRY_DELAY=1 HEALTH_ATTEMPTS=1 bash "$here/vercel-deploy.sh" 2>&1)
code=$?
check "unreachable health endpoint exits non-zero" '[ "$code" -ne 0 ] && grep -q "last body: none" <<<"$out"'

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
