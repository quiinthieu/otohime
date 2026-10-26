#!/usr/bin/env bash
# Production deploy for the CI `production` job: upload the prebuilt output, wait for the deployment
# to become ready, then prove https://otohime.dev serves this commit. Each wait is bounded so a hang
# fails with a public ::error annotation instead of silently running into the job timeout
# (run 40311256064: the old blocking `vercel deploy` hung 850 s and the health check never ran).
#
#   bash scripts/vercel-deploy.sh            # in CI, after `vercel pull` and `vercel build --prod`
#
# Env: GITHUB_SHA (required), UPLOAD_TIMEOUT (300 s), READY_TIMEOUT (420 s), INSPECT_TIMEOUT (60 s, the
# diagnostic re-read), HEALTH_URL (https://otohime.dev/api/health), HEALTH_RETRIES (10) and
# HEALTH_RETRY_DELAY (6 s; curl reads 0 as exponential backoff, so tests use 1),
# HEALTH_ATTEMPTS (3 reads of the body, HEALTH_POLL_DELAY 10 s apart, for an alias that lags ready).
#
# The upload is retried once only when it failed fast with no deployment URL. A timed-out upload is
# not retried (it may already have created a deployment, and a retry doubles the bound), and nothing
# is retried once a URL exists: a second deployment could race the first for the production alias.
set -euo pipefail

: "${GITHUB_SHA:?GITHUB_SHA is required}"
UPLOAD_TIMEOUT=${UPLOAD_TIMEOUT:-300}
READY_TIMEOUT=${READY_TIMEOUT:-420}
INSPECT_TIMEOUT=${INSPECT_TIMEOUT:-60}
HEALTH_URL=${HEALTH_URL:-https://otohime.dev/api/health}
HEALTH_RETRIES=${HEALTH_RETRIES:-10}
HEALTH_RETRY_DELAY=${HEALTH_RETRY_DELAY:-6}
HEALTH_ATTEMPTS=${HEALTH_ATTEMPTS:-3}
HEALTH_POLL_DELAY=${HEALTH_POLL_DELAY:-10}

log() { printf '[vercel-deploy %s] %s\n' "$(date -u +%H:%M:%SZ)" "$*" >&2; }
fail() {
  echo "::error title=vercel deploy::$*"
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

upload_log=$(mktemp)
trap 'rm -f "$upload_log"' EXIT

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
    fail "upload timed out after ${UPLOAD_TIMEOUT}s with no deployment URL (not retried)"
  fi
  log "upload exited $status with no deployment URL; retrying once"
  : >"$upload_log"
  status=0
  upload || status=$?
  url=$(deploy_url "$upload_log")
fi
[ -n "$url" ] || fail "upload exited $status with no deployment URL"
[ "$status" -eq 0 ] || log "upload exited $status but printed $url; waiting on it, not retrying"
echo "deployment: $url"

log "ready: vercel inspect --wait (bound ${READY_TIMEOUT}s)"
status=0
bounded "$READY_TIMEOUT" npx vercel@64 inspect "$url" --wait --timeout 6m --logs || status=$?
if [ "$status" -ne 0 ]; then
  log "inspect --wait exited $status; reading the deployment state once more"
  state_log=$(mktemp)
  bounded "$INSPECT_TIMEOUT" npx vercel@64 inspect "$url" >"$state_log" 2>&1 || true
  cat "$state_log" >&2
  # `vercel inspect` prints a "status  ● Ready|Building|Queued|Error|Canceled" line.
  state=$(grep -Eiow '(ready|building|queued|initializing|error|canceled|cancelled)' "$state_log" | head -n 1 || true)
  rm -f "$state_log"
  if [ "$status" -eq 124 ] || [ "$status" -eq 137 ]; then
    fail "${state:-unknown} after ${READY_TIMEOUT}s $url"
  fi
  fail "${state:-unknown} (inspect exited $status) $url"
fi

expect="\"sha\":\"$GITHUB_SHA\""
body=""
for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
  log "health: $HEALTH_URL attempt $attempt/$HEALTH_ATTEMPTS, expecting $expect"
  body=$(curl -fsS --max-time 20 --retry "$HEALTH_RETRIES" --retry-all-errors --retry-delay "$HEALTH_RETRY_DELAY" "$HEALTH_URL") || body=""
  echo "$body"
  case "$body" in *"$expect"*) log "health: serving $GITHUB_SHA"; exit 0 ;; esac
  [ "$attempt" -lt "$HEALTH_ATTEMPTS" ] && sleep "$HEALTH_POLL_DELAY"
done
fail "health check at $HEALTH_URL does not report $GITHUB_SHA (last body: ${body:-none}) $url"
