#!/usr/bin/env bash
# Probe that Ask the console's model tier is off by default, one "ok -" / "not ok -" line per check.
#
#   bash scripts/probe-ask-llm.sh                    # build, then next start on a free port, probe it
#   SKIP_BUILD=1 PORT=4093 bash scripts/probe-ask-llm.sh
#
# The build being probed holds the /api/ask handler. With ASK_LLM and ANTHROPIC_API_KEY unset, GET /api/ask
# and a well-formed same-origin POST /api/ask both answer 404. Negative control: a second start with ASK_LLM=1
# and a fake key answers GET 200 with "enabled":true (so the 404s come from the switch, not a missing route),
# and a cross-origin POST is 403. The probe passes only if all 6 checks pass.
# That start points ANTHROPIC_BASE_URL at a closed local port and sends no POST that passes the origin check,
# so nothing ever reaches Anthropic. No database is needed: the disabled route never touches one.
# The tier switched on, from the console through the route to a fake model, is scripts/probe-ask-llm-fake.sh.
#
# Env: PORT (default: a free port; an explicit PORT that is busy is refused), SKIP_BUILD=1.
# No `set -e`: every check runs, and the summary names the ones that failed.
set -u

cd "$(dirname "$0")/.." || exit 2

WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-ask-llm.XXXXXX")"
SERVER_PID=""
OK=0
FAILED=0
FAILURES=()

check() { # name, pass(0/1), detail
  if [ "$2" -eq 1 ]; then
    OK=$((OK + 1))
    echo "ok - $1"
  else
    FAILED=$((FAILED + 1))
    FAILURES+=("$1")
    echo "not ok - $1${3:+: $3}"
  fi
}

stop_server() {
  if [ -n "$SERVER_PID" ]; then
    kill -TERM -- "-$SERVER_PID" 2>/dev/null
    for _ in 1 2 3 4 5 6 7 8 9 10; do
      kill -0 -- "-$SERVER_PID" 2>/dev/null || break
      sleep 0.5
    done
    kill -KILL -- "-$SERVER_PID" 2>/dev/null
    SERVER_PID=""
  fi
}

cleanup() {
  stop_server
  rm -rf "$WORK"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

free_port() { node -e 'const s=require("net").createServer().listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }

if [ -n "${PORT:-}" ]; then
  if curl -s -o /dev/null --max-time 2 "http://localhost:$PORT/"; then
    echo "not ok - port: something already listens on port $PORT; set PORT to a free port"
    exit 1
  fi
else
  PORT="$(free_port)"
fi
BASE_URL="http://localhost:$PORT"

export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-placeholder-not-a-real-secret-0123456789abcdef}"
export BETTER_AUTH_URL="$BASE_URL"
export DATABASE_URL="${DATABASE_URL:-postgresql://otohime:otohime@127.0.0.1:9/otohime}"
export GITHUB_SHA="${GITHUB_SHA:-0123456789abcdef0123456789abcdef01234567}"

if [ "${SKIP_BUILD:-}" != "1" ]; then
  if ! env -u ASK_LLM -u ANTHROPIC_API_KEY npm run build >"$WORK/build.log" 2>&1; then
    echo "not ok - build: npm run build failed; log:"
    tail -n 40 "$WORK/build.log"
    exit 1
  fi
fi

# start <label> [VAR=value ...]: next start in its own process group, with ASK_LLM and the key unset
# unless given, then wait until it answers and check it is ours.
start() {
  local label="$1"
  shift
  set -m
  env -u ASK_LLM -u ANTHROPIC_API_KEY -u ANTHROPIC_BASE_URL "$@" ./node_modules/.bin/next start -p "$PORT" >"$WORK/server-$label.log" 2>&1 &
  SERVER_PID=$!
  set +m
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null --max-time 5 "$BASE_URL/"; then
      if kill -0 "$SERVER_PID" 2>/dev/null; then
        return 0
      fi
      break
    fi
    kill -0 "$SERVER_PID" 2>/dev/null || break
    sleep 1
  done
  echo "not ok - ready ($label): our next start on port $PORT did not answer; log:"
  tail -n 20 "$WORK/server-$label.log"
  return 1
}

status() { # method, path, [origin], [body] -> prints "<code> <body>"
  local args=(-s -o "$WORK/body" -w '%{http_code}' --max-time 15 -X "$1")
  [ -n "${3:-}" ] && args+=(-H "Origin: $3")
  [ -n "${4:-}" ] && args+=(-H 'Content-Type: application/json' --data "$4")
  local code
  code="$(curl "${args[@]}" "$BASE_URL$2")"
  echo "$code $(head -c 300 "$WORK/body" | tr -d '\n')"
}

# The build being probed has the route: the 404s below come from the switch, not a missing handler.
route_built=0
[ -f .next/server/app/api/ask/route.js ] && grep -q '"/api/ask"' .next/app-path-routes-manifest.json 2>/dev/null && route_built=1
check "build: the output holds the /api/ask route handler" "$route_built" "no .next/server/app/api/ask/route.js in the manifest"

QUESTION='{"question":"what is shore"}'

if start disabled; then
  read -r code body < <(status GET /api/ask)
  check "disabled: GET /api/ask is 404" "$([ "$code" = 404 ] && echo 1 || echo 0)" "got $code $body"
  read -r code body < <(status POST /api/ask "$BASE_URL" "$QUESTION")
  check "disabled: same-origin POST /api/ask is 404" "$([ "$code" = 404 ] && echo 1 || echo 0)" "got $code $body"
  check "disabled: the answers came from our server" "$(kill -0 "$SERVER_PID" 2>/dev/null && echo 1 || echo 0)"
else
  check "disabled: server started" 0
fi
stop_server

# Negative control: the same build with the switch on.
if start enabled ASK_LLM=1 ANTHROPIC_API_KEY=probe-fake-key-not-real ANTHROPIC_BASE_URL=http://127.0.0.1:9; then
  read -r code body < <(status GET /api/ask)
  enabled=0
  [ "$code" = 200 ] && printf '%s' "$body" | grep -q '"enabled":true' && enabled=1
  check "control: with ASK_LLM=1 and a key, GET /api/ask is 200 enabled:true" "$enabled" "got $code $body"
  read -r code body < <(status POST /api/ask "https://evil.example" "$QUESTION")
  check "control: a cross-origin POST is 403" "$([ "$code" = 403 ] && echo 1 || echo 0)" "got $code $body"
else
  check "control: server started" 0
fi
stop_server

# Passing means every check ran and passed, not merely that none failed.
EXPECTED=6
echo "probe: $OK ok, $FAILED failed${FAILURES[*]:+ (${FAILURES[*]})}"
if [ "$OK" -ne "$EXPECTED" ]; then
  echo "not ok - probe: expected $EXPECTED passing checks, got $OK"
  exit 1
fi
[ "$FAILED" -eq 0 ]
