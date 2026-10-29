#!/usr/bin/env bash
# Real deployment-status client, real shell/curl and local HTTP; only the upload CLI and vendor API/token are fake.
set -u
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d)
health_pid=""
trap 'if [ -n "$health_pid" ]; then kill "$health_pid" 2>/dev/null; wait "$health_pid" 2>/dev/null; fi; rm -rf "$work"' EXIT
mkdir -p "$work/bin"
failures=0
assertions=0
SHA=0123456789abcdef0123456789abcdef01234567
URL=https://otohime-fixture.vercel.app
node --input-type=module - "$work" "$SHA" <<'SERVER' &
import { createServer } from "node:http";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
const [work, sha] = process.argv.slice(2);
let healthReads = 0, statusReads = 0, previous = "";
const server = createServer((req, res) => {
  const fixture = JSON.parse(readFileSync(join(work, "fixture.json")));
  if (fixture.name !== previous) { previous = fixture.name; healthReads = statusReads = 0; }
  appendFileSync(join(work, "http.calls"), `${req.url}\n`);
  res.setHeader("Content-Type", "application/json");
  if (req.url === "/v2/user") { res.writeHead(404); res.end('{"error":"User not found"}'); return; }
  if (req.url.startsWith("/v13/deployments/")) {
    if (req.headers.authorization !== "Bearer synthetic-token" || req.url !== "/v13/deployments/otohime-fixture.vercel.app?teamId=team_fixture") { res.writeHead(403); res.end('{}'); return; }
    const mode = fixture.mode;
    if (/^\d+$/.test(mode)) { res.writeHead(Number(mode)); res.end('synthetic-token private vendor diagnostic'); return; }
    if (mode === "hang") return;
    if (mode === "redirect") { res.writeHead(302, { Location: "/credential-sink" }); res.end(); return; }
    if (mode === "malformed") { res.end('invalid JSON synthetic-token'); return; }
    const body = { id: "dpl_fixture", url: "otohime-fixture.vercel.app", ownerId: "team_fixture", projectId: "prj_fixture", target: "production", readyState: "READY" };
    if (mode === "transition") body.readyState = ++statusReads === 1 ? "BUILDING" : "READY";
    if (mode === "preview") body.target = null;
    if (mode === "public-only") { res.end(JSON.stringify({id: body.id, readyState: body.readyState})); return; }
    if (mode.startsWith("state:")) body.readyState = mode.slice(6);
    if (mode.startsWith("wrong:")) body[mode.slice(6)] = "wrong";
    if (mode.startsWith("missing:")) delete body[mode.slice(8)];
    res.end(JSON.stringify(body)); return;
  }
  if (req.url === "/health") {
    ++healthReads;
    res.end(fixture.health === "transition" ? JSON.stringify({ ok: true, sha: healthReads < 5 ? "old-sha" : sha }) : fixture.health);
    return;
  }
  res.writeHead(404); res.end('{}');
});
server.listen(0, "127.0.0.1", () => writeFileSync(join(work, "port"), String(server.address().port)));
SERVER
health_pid=$!
for ((i=0; i<50; i++)); do [ -s "$work/port" ] && break; sleep 0.1; done
[ -s "$work/port" ] || { echo 'not ok - HTTP fixture starts'; exit 1; }
base="http://127.0.0.1:$(cat "$work/port")"
cat >"$work/bin/npx" <<'FAKE'
#!/usr/bin/env bash
while [ "$#" -gt 0 ] && [ "$1" != vercel ] && [ "$1" != vercel@64 ]; do shift; done
shift
echo "$*" >>"$CALLS"
# Hosted CLI 64.7.0 transcript (jobs 122084239061, 122096077381): every non-deploy command fails its user bootstrap.
[ "$1" = deploy ] || { echo 'Error: Not able to load user because of unexpected error: User not found. (404)' >&2; exit 1; }
mode=$FAKE_DEPLOY
[ "$mode" = fail-once ] && { [ "$(wc -l < "$CALLS")" -eq 1 ] && mode=fail || mode=ok; }
case "$mode" in
  ok) echo "$FAKE_URL" ;;
  hang) sleep 6011 ;;
  fail) echo 'Error: socket hang up' >&2; exit 1 ;;
  fail-with-url) echo "$FAKE_URL"; exit 1 ;;
esac
FAKE
chmod +x "$work/bin/npx"
check() {
  assertions=$((assertions + 1))
  if eval "$2"; then echo "ok - $1"; else echo "not ok - $1"; failures=$((failures + 1)); printf '%s\n' "$out" | tail -10; fi
}
run() {
  local name=$1
  export CALLS="$work/upload.calls" FAKE_URL=$URL FAKE_DEPLOY=$2
  : >"$CALLS"; : >"$work/http.calls"
  node -e 'require("fs").writeFileSync(process.argv[1],JSON.stringify({name:process.argv[2],mode:process.argv[3],health:process.argv[4]}))' "$work/fixture.json" "$name" "$3" "$4"
  local start=$SECONDS
  out=$(env PATH="$work/bin:$PATH" GITHUB_SHA=$SHA UPLOAD_TIMEOUT=2 READY_TIMEOUT=1 INSPECT_TIMEOUT=1 STATUS_POLL_DELAY=0.01 \
    VERCEL_TOKEN="${FIXTURE_TOKEN-synthetic-token}" VERCEL_ORG_ID="${FIXTURE_TEAM-team_fixture}" VERCEL_PROJECT_ID="${FIXTURE_PROJECT-prj_fixture}" \
    VERCEL_API_URL="$base" HEALTH_URL="${FIXTURE_HEALTH_URL-$base/health}" HEALTH_RETRIES=0 HEALTH_RETRY_DELAY=1 HEALTH_ATTEMPTS=6 HEALTH_POLL_DELAY=0 \
    bash "${FIXTURE_SCRIPT-$here/vercel-deploy.sh}" 2>&1)
  code=$?; elapsed=$((SECONDS - start))
  deploys=$(wc -l <"$CALLS")
}
healthy="{\"ok\":true,\"sha\":\"$SHA\"}"
old='{"ok":true,"sha":"old-sha"}'
run ready ok ready "$healthy"
check "team-scoped bearer READY and exact-sha health succeed without user bootstrap" '[ "$code" -eq 0 ] && [[ "$out" == *"health: serving $SHA"* ]]'
check "status resource receives exact hostname and configured team" 'grep -qx "/v13/deployments/otohime-fixture.vercel.app?teamId=team_fixture" "$work/http.calls"'
check "deployment receipt binds project owner id and READY" '[[ "$out" == *"\"id\":\"dpl_fixture\""* ]] && [[ "$out" == *"\"ownerId\":\"team_fixture\""* ]] && [[ "$out" == *"\"projectId\":\"prj_fixture\""* ]] && [[ "$out" == *"\"readyState\":\"READY\""* ]]'
check "healthy upload keeps no-wait and does not invoke CLI inspect" 'grep -qx "deploy --prebuilt --prod --archive=tgz --no-wait" "$CALLS" && [ "$deploys" -eq 1 ]'
check "adapter never requests user bootstrap" '! grep -q "^/v2/user" "$work/http.calls"'
user_status=$(curl -s -o /dev/null -w '%{http_code}' "$base/v2/user")
check "user bootstrap 404 fixture exists beside successful deployment resource" '[ "$user_status" = 404 ]'
check "healthy adapter never prints token or public error" '[[ "$out" != *synthetic-token* ]] && [[ "$out" != *::error* ]]'
for field in ownerId projectId url id target; do
  for mutation in wrong missing; do
    run "$mutation-$field" ok "$mutation:$field" "$healthy"
    check "$mutation $field fails association before matching health" '[ "$code" -ne 0 ] && [[ "$out" == *"association mismatch"* ]] && ! grep -qx /health "$work/http.calls"'
  done
done
for status in 401 403 404 429 500; do
  run "http-$status" ok "$status" "$healthy"
  check "HTTP $status fails closed before matching health" '[ "$code" -ne 0 ] && [[ "$out" == *"HTTP $status"* ]] && ! grep -qx /health "$work/http.calls"'
  check "HTTP $status diagnostics redact vendor body and token" '[[ "$out" != *synthetic-token* ]] && [[ "$out" != *"private vendor"* ]]'
done
for mode in preview public-only redirect; do
  run "$mode" ok "$mode" "$healthy"
  check "API $mode cannot bypass association or matching health" '[ "$code" -ne 0 ] && ! grep -qx /health "$work/http.calls"'
done
check "API redirect never forwards its credential" '! grep -qx /credential-sink "$work/http.calls"'
FIXTURE_TOKEN=wrong-token run wrong-token ok ready "$healthy"
check "refused API token remains red and is never printed" '[ "$code" -ne 0 ] && [[ "$out" != *wrong-token* ]] && ! grep -qx /health "$work/http.calls"'
run malformed ok malformed "$healthy"
check "malformed status JSON cannot be rescued by matching health" '[ "$code" -ne 0 ] && [[ "$out" == *"malformed JSON"* ]] && ! grep -qx /health "$work/http.calls"'
for state in ERROR CANCELED UNKNOWN; do
  run "state-$state" ok "state:$state" "$healthy"
  check "$state status fails closed before matching health" '[ "$code" -ne 0 ] && ! grep -qx /health "$work/http.calls"'
done
for state in BUILDING QUEUED INITIALIZING; do
  run "state-$state" ok "state:$state" "$healthy"
  check "$state status times out within bound and never reads health" '[ "$code" -ne 0 ] && [ "$elapsed" -le 5 ] && [[ "$out" == *"timeout; last state $state"* ]] && ! grep -qx /health "$work/http.calls"'
done
run hang-status ok hang "$healthy"
check "hanging status HTTP is bounded and matching health cannot rescue it" '[ "$code" -ne 0 ] && [ "$elapsed" -le 5 ] && [[ "$out" == *timeout* ]] && ! grep -qx /health "$work/http.calls"'
for field in TEAM PROJECT TOKEN; do
  case "$field" in TEAM) FIXTURE_TEAM= run missing-team ok ready "$healthy" ;; PROJECT) FIXTURE_PROJECT= run missing-project ok ready "$healthy" ;; TOKEN) FIXTURE_TOKEN= run missing-token ok ready "$healthy" ;; esac
  check "missing $field is refused before upload" '[ "$code" -ne 0 ] && [ "$deploys" -eq 0 ]'
done
run building-ready ok transition "$healthy"
check "BUILDING to READY transition proceeds to exact-sha health" '[ "$code" -eq 0 ] && [[ "$out" == *BUILDING* ]] && [[ "$out" == *READY* ]]'
run hang-upload hang ready "$healthy"
check "hanging upload is bounded without duplicate deployment" '[ "$code" -ne 0 ] && [ "$elapsed" -le 15 ] && [ "$deploys" -eq 1 ] && [[ "$out" == *"upload timed out"* ]]'
check "hanging upload never requests deployment status" '[ ! -s "$work/http.calls" ]'
check "hanging upload leaves no child" '! pgrep -f "^sleep 6011$" >/dev/null'
run fail-once fail-once ready "$healthy"
check "fast upload failure retries exactly once" '[ "$code" -eq 0 ] && [ "$deploys" -eq 2 ]'
run fail-twice fail ready "$healthy"
check "two upload failures stop at one retry" '[ "$code" -ne 0 ] && [ "$deploys" -eq 2 ]'
run fail-with-url fail-with-url ready "$healthy"
check "failed upload with URL reuses deployment without retry" '[ "$code" -eq 0 ] && [ "$deploys" -eq 1 ]'
run wrong-sha ok ready "$old"
check "READY plus wrong public SHA remains red" '[ "$code" -ne 0 ] && [[ "$out" == *"health check"* ]]'
for body in "{\"ok\":false,\"sha\":\"$SHA\"}" "{\"ok\":true,\"previous\":{\"sha\":\"$SHA\"}}" "not-json $healthy"; do
  run "bad-health-$assertions" ok ready "$body"
  check "invalid health body $assertions cannot impersonate exact healthy SHA" '[ "$code" -ne 0 ]'
done
run transition ok ready transition
check "alias transition keeps twelve-read production budget and accepts fifth exact SHA" '[ "$code" -eq 0 ] && [[ "$out" == *"attempt 5/6"* ]] && [ "$(grep -c "^/health$" "$work/http.calls")" -eq 5 ] && [ "$deploys" -eq 1 ]'
check "production defaults preserve upload ready and health budgets" 'grep -q "HEALTH_ATTEMPTS=\${HEALTH_ATTEMPTS:-12}" "$here/vercel-deploy.sh" && grep -q "READY_TIMEOUT=\${READY_TIMEOUT:-420}" "$here/vercel-deploy.sh"'
run pretty ok ready "{ \"ok\": true, \"sha\": \"$SHA\" }"
check "formatted exact healthy SHA is accepted" '[ "$code" -eq 0 ]'
FIXTURE_HEALTH_URL=http://127.0.0.1:1/health run unreachable ok ready "$healthy"
check "READY plus unreachable health fails closed" '[ "$code" -ne 0 ] && [[ "$out" == *"health check"* ]] && [[ "$out" == *"last body, first 1000 bytes: none"* ]]'
# Negative control: a readiness step that depends on the CLI's user bootstrap fails with the real transcript.
mkdir -p "$work/inspect"
cp "$here/deployment-status.mjs" "$work/inspect/"
perl -pe 's/^(echo "deployment: \$url")$/$1\nnpx vercel\@64 inspect "\$url" --scope "\$VERCEL_ORG_ID" --wait >"\$wait_log" 2>&1 || fail "inspect: \$(diagnostic_tail "\$wait_log")"/' \
  "$here/vercel-deploy.sh" >"$work/inspect/vercel-deploy.sh"
FIXTURE_SCRIPT="$work/inspect/vercel-deploy.sh" run scoped-inspect ok ready "$healthy"
check "scoped CLI inspect reproduces hosted User not found (404) and never reaches health" '[ "$code" -ne 0 ] && grep -q "^inspect " "$CALLS" && [[ "$out" == *"User not found. (404)"* ]] && ! grep -qx /health "$work/http.calls"'
run ready ok ready "$healthy"
check "API readiness succeeds beside the hosted CLI identity refusal without any CLI inspect" '[ "$code" -eq 0 ] && ! grep -q "^inspect " "$CALLS" && [[ "$out" != *"User not found"* ]]'
check "deployment shell and adapter parse without executing" 'bash -n "$here/vercel-deploy.sh" "$here/vercel-deploy.test.sh" && node --check "$here/deployment-status.mjs"'
printf 'if then\n' >"$work/invalid.sh"
check "syntax negative control rejects malformed Bash" '! bash -n "$work/invalid.sh" 2>/dev/null'
check "missing GITHUB_SHA is refused before upload" '! GITHUB_SHA= bash "$here/vercel-deploy.sh" >/dev/null 2>&1'
if [ "$assertions" -eq 0 ] || [ "$failures" -ne 0 ]; then echo "# $failures assertions failed"; exit 1; fi
echo "# all $assertions assertions passed"
