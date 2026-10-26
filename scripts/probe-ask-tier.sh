#!/usr/bin/env bash
# Read-only probe of Ask the Ink's model tier at BASE_URL (scripts/probe-ask-tier.mjs has the checks):
# GET /api/ask is 200 with enabled:true; one POST with a fixed question and the site's Origin answers with model
# lines citing /work, /projects or /notes; and with /api/ask forced to fail in the page (tier off, a 429), the
# console prints the canned answer with no visible error. Prints counts; exit 1 on any miss.
#
#   bash scripts/probe-ask-tier.sh                               # http://127.0.0.1:3000
#   BASE_URL=https://otohime.dev bash scripts/probe-ask-tier.sh  # production, once set-env:ask-llm-production is done
#
# The one POST spends a model call and one of the site's daily answers; nothing else reaches the server's tier.
# scripts/probe-ask-llm-fake.sh runs this against a fake Anthropic server, tier on and off.
#
# Env: BASE_URL, ASK_ORIGIN (default: BASE_URL's origin), PW_PREFIX (a Playwright install to reuse; otherwise
# Playwright is installed into a temp prefix at run time and package.json stays unchanged).
set -u

cd "$(dirname "$0")/.." || exit 2
export BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"

WORK=""
cleanup() { [ -n "$WORK" ] && rm -rf "$WORK"; }
trap cleanup EXIT
trap 'exit 130' INT TERM

if [ -z "${PW_PREFIX:-}" ]; then
  # A short dir: Chromium's socket path under a long TMPDIR is too long to bind.
  WORK="$(mktemp -d /tmp/pat.XXXXXX)"
  PW_PREFIX="$WORK/playwright"
  mkdir -p "$PW_PREFIX"
  if ! npm i --prefix "$PW_PREFIX" --no-audit --no-fund --silent playwright@1.64.0 >"$WORK/npm.log" 2>&1; then
    echo "not ok - playwright: npm i playwright failed; log:"
    tail -n 20 "$WORK/npm.log"
    exit 1
  fi
  if ! "$PW_PREFIX/node_modules/.bin/playwright" install chromium --only-shell >"$WORK/browser.log" 2>&1; then
    echo "not ok - playwright: install chromium --only-shell failed; log:"
    tail -n 20 "$WORK/browser.log"
    exit 1
  fi
  export TMPDIR="$WORK"
fi
export PW_PREFIX

node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  scripts/probe-ask-tier.mjs
