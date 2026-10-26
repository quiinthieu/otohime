#!/usr/bin/env bash
# Read-only: does the bundle served at BASE_URL carry the Ask console's api/ask call? (lib/ask-deploy.ts)
#
#   bash scripts/probe-ask-deploy.sh                               # http://127.0.0.1:3000
#   BASE_URL=https://otohime.dev bash scripts/probe-ask-deploy.sh  # a deployed URL
#
# Prints the chunks checked and the chunks carrying the call; exit 0 only when one chunk reachable from / has it.
set -u

cd "$(dirname "$0")/.." || exit 2
export BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
exec node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON \
  scripts/probe-ask-deploy.mjs
