#!/usr/bin/env bash
# Production deploy for the CI `production` job: upload the prebuilt output, inspect the deployment,
# then prove https://otohime.dev serves this commit. Inspect and health must both pass.
# Each wait is bounded so a hang
# fails with a public ::error annotation instead of silently running into the job timeout
# (run 40311256064: the old blocking `vercel deploy` hung 850 s and the health check never ran).
#
#   bash scripts/vercel-deploy.sh            # in CI, after `vercel pull` and `vercel build --prod`
#
# Env: GITHUB_SHA and VERCEL_ORG_ID (required), UPLOAD_TIMEOUT (300 s), READY_TIMEOUT (420 s), INSPECT_TIMEOUT (60 s, the
# diagnostic re-read), HEALTH_URL (https://otohime.dev/api/health), HEALTH_RETRIES (10) and
# HEALTH_RETRY_DELAY (6 s; curl reads 0 as exponential backoff, so tests use 1),
# HEALTH_ATTEMPTS (12 reads of the body, HEALTH_POLL_DELAY 10 s apart, for an alias that lags ready).
#
# The upload is retried once only when it failed fast with no deployment URL. A timed-out upload is
# not retried (it may already have created a deployment, and a retry doubles the bound), and nothing
# is retried once a URL exists: a second deployment could race the first for the production alias.
set -euo pipefail

: "${GITHUB_SHA:?GITHUB_SHA is required}"
: "${VERCEL_ORG_ID:?VERCEL_ORG_ID is required}"
UPLOAD_TIMEOUT=${UPLOAD_TIMEOUT:-300}
READY_TIMEOUT=${READY_TIMEOUT:-420}
INSPECT_TIMEOUT=${INSPECT_TIMEOUT:-60}
HEALTH_URL=${HEALTH_URL:-https://otohime.dev/api/health}
HEALTH_RETRIES=${HEALTH_RETRIES:-10}
HEALTH_RETRY_DELAY=${HEALTH_RETRY_DELAY:-6}
HEALTH_ATTEMPTS=${HEALTH_ATTEMPTS:-12}
HEALTH_POLL_DELAY=${HEALTH_POLL_DELAY:-10}

log() { printf '[vercel-deploy %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }
fail() {
  # One workflow command, even when a vendor diagnostic contains newlines or command-like text.
  local message=$*
  message=${message//'%'/'%25'}
  message=${message//$'\r'/'%0D'}
  message=${message//$'\n'/'%0A'}
  echo "::error title=vercel deploy::$message"
  exit 1
}

# bounded SECONDS CMD...: exit 124 on timeout, killing the command's whole process group.
# GNU timeout on the runner; a perl equivalent where coreutils is absent (macOS dev machines).
if command -v timeout >/dev/null 2>&1; then
  bounded() { timeout --kill-after=10 "$@"; }
else
  bounded() {
    perl -e '
      my $t = shift; my $pid = fork() // die "fork: $!";
      if (!$pid) { setpgrp(0, 0); exec { $ARGV[0] } @ARGV or die "exec $ARGV[0]: $!" }
      $SIG{ALRM} = sub { kill "TERM", -$pid; sleep 2; kill "KILL", -$pid; waitpid($pid, 0); exit 124 };
      alarm $t; waitpid($pid, 0);
      exit($? & 127 ? 128 + ($? & 127) : $? >> 8);
    ' "$@"
  }
fi

deploy_url() { grep -Eo 'https://[A-Za-z0-9.-]+\.vercel\.app' "$1" | tail -n 1 || true; }

work=$(mktemp -d)
upload_log=$work/upload.log
wait_log=$work/wait.log
state_log=$work/state.log
trap 'rm -rf "$work"' EXIT

# Strip CLI colouring before parsing or publishing diagnostics. A generic "Error:" in a request
# failure is not a deployment's status. Only the labelled field may name deployment state.
plain() { sed -E $'s/\033\\[[0-9;]*[[:alpha:]]//g' "$1"; }
# Public annotations have a fixed output budget; keep the actionable tail of vendor diagnostics.
diagnostic_tail() { plain "$1" | tail -c 4000; }
deployment_state() {
  plain "$1" | sed -nE 's/^[[:space:]]*status[[:space:]]+[^[:alnum:]]*(Ready|Building|Queued|Initializing|Error|Canceled|Cancelled)[[:space:]]*$/\1/p' | head -n 1
}

upload() {
  log "upload: vercel deploy --prebuilt --prod --no-wait (bound ${UPLOAD_TIMEOUT}s)"
  local status=0
  # Captured whole (URL on stdout, progress and errors on stderr), then echoed to the job log.
  bounded "$UPLOAD_TIMEOUT" npx vercel@64 deploy --prebuilt --prod --archive=tgz --no-wait \
    >"$upload_log" 2>&1 || status=$?
  cat "$upload_log" >&2
  return "$status"
}

status=0
upload || status=$?
url=$(deploy_url "$upload_log")
if [ "$status" -ne 0 ] && [ -z "$url" ]; then
  if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
    fail "upload timed out after ${UPLOAD_TIMEOUT}s with no deployment URL (not retried, exit $status): $(diagnostic_tail "$upload_log")"
  fi
  log "upload exited $status with no deployment URL; retrying once"
  : >"$upload_log"
  status=0
  upload || status=$?
  url=$(deploy_url "$upload_log")
fi
[ -n "$url" ] || fail "upload exited $status with no deployment URL: $(diagnostic_tail "$upload_log")"
[ "$status" -eq 0 ] || log "upload exited $status but printed $url; waiting on it, not retrying"
echo "deployment: $url"

# Standalone inspect cannot infer the linked project's team context like deploy can.
log "ready: vercel inspect --wait with configured team scope (bound ${READY_TIMEOUT}s)"
status=0
bounded "$READY_TIMEOUT" npx vercel@64 inspect "$url" --scope "$VERCEL_ORG_ID" --wait --timeout 6m --logs >"$wait_log" 2>&1 || status=$?
cat "$wait_log" >&2
state=$(deployment_state "$wait_log")
# Exit zero alone cannot certify a deployment. Fail closed if the CLI emits no
# recognized state or still reports a nonterminal state, even if alias health matches.
if [ "$status" -ne 0 ] || [ "$state" != Ready ]; then
  log "inspect --wait exited $status with state ${state:-unknown}; reading the deployment state once more"
  state_status=0
  bounded "$INSPECT_TIMEOUT" npx vercel@64 inspect "$url" --scope "$VERCEL_ORG_ID" >"$state_log" 2>&1 || state_status=$?
  cat "$state_log" >&2
  # A failed re-read cannot erase the terminal state reported by the waiting command.
  state=${state:-$(deployment_state "$state_log")}
  diagnostic=$(printf '\ninspect --wait output (exit %s, last 4000 bytes):\n%s\nstate re-read output (exit %s, last 4000 bytes):\n%s' \
    "$status" "$(diagnostic_tail "$wait_log")" "$state_status" "$(diagnostic_tail "$state_log")")
  if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
    inspect_failure="${state:-unknown} after ${READY_TIMEOUT}s $url$diagnostic"
  else
    inspect_failure="${state:-unknown} (inspect exited $status) $url$diagnostic"
  fi
  fail "$inspect_failure"
fi

expect="\"sha\":\"$GITHUB_SHA\""
body=""
for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
  log "health: $HEALTH_URL attempt $attempt/$HEALTH_ATTEMPTS, expecting $expect"
  body=$(curl -fsS --max-time 20 --retry "$HEALTH_RETRIES" --retry-all-errors --retry-delay "$HEALTH_RETRY_DELAY" "$HEALTH_URL") || body=""
  echo "$body"
  if printf '%s' "$body" | node -e '
    let body = "";
    process.stdin.on("data", chunk => body += chunk);
    process.stdin.on("end", () => {
      try { const h = JSON.parse(body); process.exit(h.ok === true && h.sha === process.argv[1] ? 0 : 1); }
      catch { process.exit(1); }
    });' "$GITHUB_SHA"; then
    log "health: serving $GITHUB_SHA"; exit 0
  fi
  [ "$attempt" -lt "$HEALTH_ATTEMPTS" ] && sleep "$HEALTH_POLL_DELAY"
done
fail "health check at $HEALTH_URL does not report $GITHUB_SHA (last body, first 1000 bytes: $(printf '%s' "${body:-none}" | head -c 1000)) $url"
