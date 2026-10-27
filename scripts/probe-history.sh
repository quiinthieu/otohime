#!/usr/bin/env bash
# Read-only production & local probe for the Ryugu-jo Tamatebako changelog history.
#
#   bash scripts/probe-history.sh https://otohime.dev [EXPECT_SHA]
#   BASE_URL=https://otohime.dev EXPECT_SHA=<40-hex sha> bash scripts/probe-history.sh
#   bash scripts/probe-history.sh --self-test
#
# Live mode:
# 1. Reads $BASE_URL/api/health before browser inspection to pin one served SHA S, and checks that S serves
#    EXPECT_SHA (when set) using the repository's ancestry rules (exact, descendant, or report-only ahead).
# 2. Ensures full git history for S is available locally (fetching from origin if needed).
# 3. Opens $BASE_URL/ryugu in headless Chrome at 1366x768 and 390x844, opens the Tamatebako, and reads the
#    displayed newest leaf (sha, datetime, subject) and replay-note total.
# 4. Reads $BASE_URL/api/health again after browser inspection; if the served SHA moved during the probe,
#    exits nonzero (inconclusive moving deployment, never a pass across two identities).
# 5. Verifies the newest leaf is a real ancestor of S within MAX_LAG=20 commits, its git committer date and
#    subject match git metadata, and the displayed total equals unfiltered `git rev-list --count S`.
set -uo pipefail

cd "$(dirname "$0")/.." || exit 2

export TMPDIR="${TMPDIR:-/tmp}"
if [ "${#TMPDIR}" -gt 48 ]; then
  export TMPDIR="/tmp"
fi

MAX_LAG=20

git_repo() { git -C "${PROBE_REPO:-.}" "$@"; }

missing_deps() {
  [ $# -eq 0 ] && return 0
  node --input-type=module -e '
for (const m of process.argv.slice(1)) {
  try { await import(m); } catch { console.log(m); }
}' "$@" 2>/dev/null || echo "node"
}

browser_launches() {
  node --input-type=module -e '
const { chromium } = await import("playwright-core");
const tries = process.env.CHROME_PATH ? [{ executablePath: process.env.CHROME_PATH }] : [{ channel: "chrome" }, {}];
for (const o of tries) {
  try { await (await chromium.launch(o)).close(); process.exit(0); } catch {}
}
process.exit(1);' >/dev/null 2>&1
}

preflight() {
  local deps="${PROBE_DEPS:-playwright-core}" missing
  # shellcheck disable=SC2086
  missing="$(missing_deps $deps | tr '\n' ' ')"
  if [ -n "${missing// /}" ]; then
    echo "# probe dependencies do not import (${missing% }); installing: ${PROBE_INSTALL_CMD:-npm ci --no-audit --no-fund}"
    bash -c "${PROBE_INSTALL_CMD:-npm ci --no-audit --no-fund}" >&2 || true
    # shellcheck disable=SC2086
    missing="$(missing_deps $deps | tr '\n' ' ')"
    if [ -n "${missing// /}" ]; then
      echo "not ok - probe dependencies still do not import after install: ${missing% }"
      return 1
    fi
    echo "ok - probe dependencies import after install"
  fi
  if ! browser_launches; then
    echo "# no browser launches (CHROME_PATH, Google Chrome, Playwright Chromium); installing Playwright's Chromium"
    node node_modules/playwright-core/cli.js install chromium >&2 || true
    if ! browser_launches; then
      echo "not ok - no browser launches for probe-history: install Google Chrome or set CHROME_PATH"
      return 1
    fi
    echo "ok - Playwright's Chromium launches"
  fi
}

read_health_sha() {
  local base="$1" body code
  body="$(curl -sS --max-time 10 -H 'Cache-Control: no-cache' -w '\n%{http_code}' "$base/api/health?probe=$(date +%s)" 2>&1)" || return 1
  code="${body##*$'\n'}"
  body="${body%$'\n'*}"
  [ "$code" = "200" ] || return 1
  printf '%s' "$body" | node -e '
    let raw = "";
    process.stdin.on("data", c => raw += c);
    process.stdin.on("end", () => {
      try {
        const h = JSON.parse(raw);
        if (h.ok === true && typeof h.sha === "string" && /^[0-9a-f]{40}$/.test(h.sha)) {
          console.log(h.sha);
          process.exit(0);
        }
      } catch {}
      process.exit(1);
    });
  '
}

ensure_commit() {
  local sha="$1"
  if [ "$(git_repo rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
    git_repo remote get-url origin >/dev/null 2>&1 &&
      GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o BatchMode=yes -o ConnectTimeout=10}" \
        git_repo fetch --quiet --unshallow origin >/dev/null 2>&1 || true
  fi
  if ! git_repo cat-file -e "$sha^{commit}" 2>/dev/null; then
    git_repo remote get-url origin >/dev/null 2>&1 &&
      GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -o BatchMode=yes -o ConnectTimeout=10}" \
        git_repo fetch --quiet --no-tags origin "$sha" >/dev/null 2>&1 || true
  fi
  git_repo cat-file -e "$sha^{commit}" 2>/dev/null
}

serves() {
  local want="$1" got="$2" files f
  HOW=""
  if [ "$got" = "$want" ]; then HOW="exact"; return 0; fi
  printf '%s' "$got" | grep -qE '^[0-9a-f]{40}$' || return 1
  ensure_commit "$want" || return 1
  ensure_commit "$got" || return 1
  if git_repo merge-base --is-ancestor "$want" "$got"; then HOW="contains"; return 0; fi
  git_repo merge-base --is-ancestor "$got" "$want" || return 1
  files="$(git_repo diff --name-only "$got" "$want")" || return 1
  while IFS= read -r f; do
    case "$f" in
      "" | projects/* | *.md) ;;
      *) return 1 ;;
    esac
  done <<<"$files"
  HOW="report-only ahead"
}

probe() {
  local base="${1:-${BASE_URL:-}}" want="${2:-${EXPECT_SHA:-}}"
  base="${base%/}"
  if [ -z "$base" ]; then
    echo "usage: bash scripts/probe-history.sh BASE_URL [EXPECT_SHA]" >&2
    return 2
  fi
  if [ -n "$want" ] && ! printf '%s' "$want" | grep -qE '^[0-9a-f]{40}$'; then
    echo "not ok - EXPECT_SHA must be a full 40-hex commit sha, got '${want}'" >&2
    return 2
  fi

  preflight || return 1

  local sha_before=""
  if [ -n "$want" ]; then
    local timeout="${PROBE_TIMEOUT:-120}" interval="${PROBE_INTERVAL:-5}"
    local deadline=$(($(date +%s) + timeout))
    while :; do
      sha_before="$(read_health_sha "$base" || true)"
      if [ -n "$sha_before" ] && serves "$want" "$sha_before"; then
        echo "ok - pre-probe /api/health sha $sha_before serves $want ($HOW)"
        break
      fi
      if [ $(($(date +%s) + interval)) -gt "$deadline" ]; then
        echo "not ok - /api/health (${sha_before:-unreachable}) does not serve EXPECT_SHA $want"
        return 1
      fi
      sleep "$interval"
    done
  else
    sha_before="$(read_health_sha "$base" || true)"
    if [ -z "$sha_before" ]; then
      echo "not ok - pre-probe /api/health did not return a valid 40-hex sha from $base"
      return 1
    fi
    echo "ok - pre-probe /api/health pinned sha $sha_before"
  fi

  if ! ensure_commit "$sha_before"; then
    echo "not ok - served sha $sha_before is not present in repository ${PROBE_REPO:-.}"
    return 1
  fi
  if [ "$(git_repo rev-parse --is-shallow-repository 2>/dev/null)" != "false" ]; then
    echo "not ok - repository ${PROBE_REPO:-.} is shallow; full ancestry is required to verify total"
    return 1
  fi

  local inspect_json
  if ! inspect_json="$(BASE_URL="$base" node --input-type=module -e '
    import { chromium } from "playwright-core";
    const base = process.env.BASE_URL;
    const args = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"];
    async function launch() {
      if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, args });
      try { return await chromium.launch({ channel: "chrome", args }); }
      catch { return await chromium.launch({ args }); }
    }
    const browser = await launch();
    const viewports = [
      { label: "1366x768", width: 1366, height: 768, isMobile: false, hasTouch: false },
      { label: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
    ];
    const results = [];
    try {
      for (const vp of viewports) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.isMobile,
          hasTouch: vp.hasTouch,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const pageErrors = [];
        page.on("pageerror", (e) => pageErrors.push(e.message));
        const res = await page.goto(`${base}/ryugu`, { waitUntil: "networkidle", timeout: 30000 });
        if (!res || res.status() !== 200) {
          throw new Error(`${vp.label}: /ryugu returned HTTP ${res ? res.status() : "none"}`);
        }
        const buildSha = await page.locator("meta[name=\"build-sha\"]").getAttribute("content").catch(() => null);
        const box = page.locator(".tamatebako .box");
        await box.waitFor({ state: "visible", timeout: 10000 });
        await box.click();
        const replay = page.locator(".tamatebako .replay");
        await replay.waitFor({ state: "visible", timeout: 10000 });
        const note = (await page.locator(".tamatebako .replay-note").innerText()).replace(/\s+/g, " ").trim();
        let shown = null;
        let total = null;
        const mNewest = /the newest (\d+) of its (\d+) commits/.exec(note);
        const mAll = /all (\d+) of its commits/.exec(note);
        if (mNewest) {
          shown = Number(mNewest[1]);
          total = Number(mNewest[2]);
        } else if (mAll) {
          shown = Number(mAll[1]);
          total = Number(mAll[1]);
        }
        const slider = page.locator(".tamatebako .scrubber");
        const max = Number(await slider.getAttribute("max"));
        const val = Number(await slider.inputValue());
        const leafSha = ((await page.locator(".tamatebako .leaf code").textContent()) ?? "").trim();
        const leafDate = await page.locator(".tamatebako .leaf time").getAttribute("datetime");
        const leafSubject = ((await page.locator(".tamatebako .leaf .leaf-subject").textContent()) ?? "").trim();
        const leafAge = Number(await page.locator(".tamatebako .leaf").getAttribute("data-age"));
        let scrubbedOlder = true;
        if (max > 0) {
          await slider.focus();
          await page.keyboard.press("ArrowLeft");
          const prevSha = ((await page.locator(".tamatebako .leaf code").textContent()) ?? "").trim();
          const prevAge = Number(await page.locator(".tamatebako .leaf").getAttribute("data-age"));
          scrubbedOlder = prevSha !== leafSha && prevAge > 0;
          await page.keyboard.press("End");
        }
        results.push({
          label: vp.label,
          buildSha,
          note,
          shown,
          total,
          max,
          val,
          leafSha,
          leafDate,
          leafSubject,
          leafAge,
          scrubbedOlder,
          pageErrors,
        });
        await context.close();
      }
    } finally {
      await browser.close();
    }
    console.log(JSON.stringify(results));
  ')"; then
    echo "not ok - browser inspection of $base/ryugu failed"
    return 1
  fi

  local sha_after
  sha_after="$(read_health_sha "$base" || true)"
  if [ -z "$sha_after" ]; then
    echo "not ok - post-probe /api/health failed on $base"
    return 1
  fi
  if [ "$sha_after" != "$sha_before" ]; then
    echo "not ok - inconclusive: /api/health moved during probe ($sha_before -> $sha_after)"
    return 1
  fi
  echo "ok - post-probe /api/health remained pinned at $sha_after"

  PROBE_REPO="${PROBE_REPO:-.}" SERVED_SHA="$sha_before" MAX_LAG="$MAX_LAG" INSPECT_JSON="$inspect_json" \
    node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e '
      import { execFileSync } from "node:child_process";
      import { cleanSubject, isoSecond, SHA_LENGTH, splitPrefix } from "./scripts/history-index.ts";

      const repo = process.env.PROBE_REPO || ".";
      const servedSha = process.env.SERVED_SHA!;
      const maxLag = Number(process.env.MAX_LAG || "20");
      const results = JSON.parse(process.env.INSPECT_JSON!);
      const git = (...args: string[]) =>
        execFileSync("git", ["-C", repo, "-c", "core.quotepath=off", "-c", "log.showSignature=false", ...args], {
          encoding: "utf8",
        }).trim();

      const expectedTotal = Number(git("rev-list", "--count", servedSha, "--"));
      if (!Number.isSafeInteger(expectedTotal) || expectedTotal <= 0) {
        console.error(`not ok - invalid git rev-list --count for ${servedSha}: ${expectedTotal}`);
        process.exit(1);
      }

      for (const r of results) {
        if (r.pageErrors.length > 0) {
          console.error(`not ok - ${r.label}: unexpected pageerrors: ${r.pageErrors.join("; ")}`);
          process.exit(1);
        }
        if (r.buildSha && r.buildSha !== "dev" && r.buildSha !== servedSha) {
          console.error(`not ok - ${r.label}: build-sha meta ${r.buildSha} != served /api/health sha ${servedSha}`);
          process.exit(1);
        }
        if (r.total !== expectedTotal) {
          console.error(`not ok - ${r.label}: displayed total ${r.total} != git rev-list --count ${servedSha} (${expectedTotal}) [note: ${r.note}]`);
          process.exit(1);
        }
        if (!r.shown || r.shown <= 0 || r.shown > 200 || r.max !== r.shown - 1 || r.val !== r.max) {
          console.error(`not ok - ${r.label}: invalid scrubber bounds shown=${r.shown} max=${r.max} val=${r.val}`);
          process.exit(1);
        }
        if (r.leafAge !== 0 || !r.scrubbedOlder) {
          console.error(`not ok - ${r.label}: newest leaf age=${r.leafAge} scrubbedOlder=${r.scrubbedOlder}`);
          process.exit(1);
        }
        if (!new RegExp(`^[0-9a-f]{${SHA_LENGTH}}$`).test(r.leafSha)) {
          console.error(`not ok - ${r.label}: invalid leaf sha ${JSON.stringify(r.leafSha)}`);
          process.exit(1);
        }
        let leafFull = "";
        try {
          leafFull = git("rev-parse", "--verify", "--quiet", `${r.leafSha}^{commit}`);
        } catch {
          console.error(`not ok - ${r.label}: leaf sha ${r.leafSha} does not resolve in git`);
          process.exit(1);
        }
        if (!leafFull.startsWith(r.leafSha)) {
          console.error(`not ok - ${r.label}: resolved commit ${leafFull} does not start with ${r.leafSha}`);
          process.exit(1);
        }
        try {
          execFileSync("git", ["-C", repo, "merge-base", "--is-ancestor", leafFull, servedSha], { stdio: "ignore" });
        } catch {
          console.error(`not ok - ${r.label}: leaf ${leafFull} is not an ancestor of served sha ${servedSha}`);
          process.exit(1);
        }
        const lag = Number(git("rev-list", "--count", `${leafFull}..${servedSha}`, "--"));
        if (!Number.isSafeInteger(lag) || lag < 0 || lag > maxLag) {
          console.error(`not ok - ${r.label}: newest leaf ${r.leafSha} lags ${servedSha.slice(0, 10)} by ${lag} commits (max ${maxLag})`);
          process.exit(1);
        }
        const rawMeta = git("show", "-s", "--format=%cI%x1f%s", leafFull);
        const [rawDate, rawSubject] = rawMeta.split("\x1f");
        const wantDate = isoSecond(rawDate);
        const wantSubject = splitPrefix(cleanSubject(rawSubject)).subject;
        if (r.leafDate !== wantDate) {
          console.error(`not ok - ${r.label}: leaf date ${r.leafDate} != git date ${wantDate}`);
          process.exit(1);
        }
        if (r.leafSubject !== wantSubject) {
          console.error(`not ok - ${r.label}: leaf subject ${JSON.stringify(r.leafSubject)} != git subject ${JSON.stringify(wantSubject)}`);
          process.exit(1);
        }
        console.log(`ok - ${r.label}: leaf ${r.leafSha} is an ancestor of ${servedSha.slice(0, 10)} (lag ${lag} <= ${maxLag}) and total ${r.total} matches git rev-list --count`);
      }
    '
}

FAKE_HISTORY_SERVER_JS='
const http = require("node:http");
const fs = require("node:fs");
const [portFile, stateFile] = process.argv.slice(1);
let lastMode = "";
let ryuguServed = false;
const server = http.createServer((req, res) => {
  const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  if (state.mode !== lastMode) {
    lastMode = state.mode;
    ryuguServed = false;
  }
  if (req.url.startsWith("/api/health")) {
    const sha = state.movingAfterFirst && ryuguServed ? state.movingSha : state.healthSha;
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true, sha }));
  }
  if (req.url.startsWith("/ryugu")) {
    ryuguServed = true;
    const leaves = state.leaves;
    const total = state.total;
    const shown = leaves.length < total ? `the newest ${leaves.length} of its ${total} commits` : `all ${leaves.length} of its commits`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="build-sha" content="${state.buildSha || state.healthSha}"></head>
    <body>
      <section class="tamatebako">
        <button type="button" class="box" aria-expanded="false">Open the Tamatebako</button>
        <div class="replay" hidden>
          <p class="replay-note"><strong>A changelog replay.</strong> Each position is a real commit to otohime.dev, ${shown}, with its own date and subject. The site itself is not rebuilt as it was: only the paper ages.</p>
          <input class="scrubber" type="range" min="0" max="${leaves.length - 1}" step="1" value="${leaves.length - 1}">
          <article class="leaf" data-age="0.000">
            <p class="leaf-date"><time datetime="${leaves[leaves.length - 1].date}">${leaves[leaves.length - 1].date}</time></p>
            <p class="leaf-subject">${leaves[leaves.length - 1].subject}</p>
            <p class="leaf-meta"><code>${leaves[leaves.length - 1].sha}</code></p>
          </article>
        </div>
      </section>
      <script>
        const leaves = ${JSON.stringify(leaves)};
        const box = document.querySelector(".box");
        const replay = document.querySelector(".replay");
        const scrubber = document.querySelector(".scrubber");
        const leaf = document.querySelector(".leaf");
        box.addEventListener("click", () => {
          replay.hidden = false;
          box.setAttribute("aria-expanded", "true");
        });
        function render(pos) {
          const l = leaves[pos];
          const age = leaves.length <= 1 ? 0 : (leaves.length - 1 - pos) / (leaves.length - 1);
          leaf.setAttribute("data-age", age.toFixed(3));
          leaf.querySelector("time").setAttribute("datetime", l.date);
          leaf.querySelector("time").textContent = l.date;
          leaf.querySelector(".leaf-subject").textContent = l.subject;
          leaf.querySelector("code").textContent = l.sha;
        }
        scrubber.addEventListener("input", () => render(Number(scrubber.value)));
        scrubber.addEventListener("change", () => render(Number(scrubber.value)));
      </script>
    </body></html>`;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(html);
  }
  res.writeHead(404);
  res.end();
});
server.listen(0, "127.0.0.1", () => fs.writeFileSync(portFile, String(server.address().port)));
'

self_test() {
  preflight || return 1
  local pass=0 fail=0 port
  WORK="$(mktemp -d "${TMPDIR:-/tmp}/probe-history.XXXXXX")"
  SERVER=""
  trap '[ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null; rm -rf "$WORK"' EXIT
  local work="$WORK"

  repo() { git -C "$work/repo" -c user.name=Fixture -c user.email=fixture@example.test -c commit.gpgsign=false "$@"; }
  git init -q --initial-branch=main "$work/repo"
  local i
  for i in $(seq 1 28); do
    echo "step $i" >"$work/repo/file-$i.txt"
    repo add "file-$i.txt"
    GIT_AUTHOR_DATE="2026-09-01T00:$(printf '%02d' "$i"):00Z" GIT_COMMITTER_DATE="2026-09-01T00:$(printf '%02d' "$i"):00Z" \
      repo commit -qm "pm-271/t-$i: Commit number $i"
  done
  local head_sha stale_sha prev_sha
  head_sha="$(repo rev-parse HEAD)"
  prev_sha="$(repo rev-parse HEAD~1)"
  stale_sha="$(repo rev-parse HEAD~25)"

  write_state() {
    local mode="$1"
    REPO_DIR="$work/repo" MODE="$mode" HEAD_SHA="$head_sha" PREV_SHA="$prev_sha" STALE_SHA="$stale_sha" STATE_FILE="$work/state.json" \
      node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e '
        import { writeFileSync } from "node:fs";
        import { gitRunner, indexAt } from "./scripts/history-index.ts";
        const git = gitRunner(process.env.REPO_DIR!);
        const mode = process.env.MODE!;
        const headSha = process.env.HEAD_SHA!;
        const prevSha = process.env.PREV_SHA!;
        const staleSha = process.env.STALE_SHA!;
        const current = indexAt(git, headSha)!;
        const stale = indexAt(git, staleSha)!;
        const toLeaves = (idx: typeof current) =>
          [...idx.entries].reverse().map((e) => ({ sha: e.sha, date: e.date, subject: e.subject }));
        let state: Record<string, unknown> = {
          mode,
          healthSha: headSha,
          buildSha: headSha,
          total: current.total,
          leaves: toLeaves(current),
        };
        if (mode === "stale-leaf") {
          state = { ...state, leaves: toLeaves(stale), total: current.total };
        } else if (mode === "wrong-total") {
          state = { ...state, total: current.total + 15 };
        } else if (mode === "wrong-build-meta") {
          state = { ...state, buildSha: staleSha };
        } else if (mode === "served-behind") {
          state = { ...state, healthSha: staleSha, buildSha: staleSha };
        } else if (mode === "moving-deploy") {
          state = { ...state, healthSha: prevSha, movingAfterFirst: true, movingSha: headSha };
        }
        writeFileSync(process.env.STATE_FILE!, JSON.stringify(state));
      '
  }

  write_state "valid"
  node -e "$FAKE_HISTORY_SERVER_JS" "$work/port" "$work/state.json" &
  SERVER=$!
  for _ in $(seq 1 50); do [ -s "$work/port" ] && break; sleep 0.1; done
  port="$(cat "$work/port")"
  local base="http://127.0.0.1:$port"

  run_case() {
    local name="$1" mode="$2" want_exit="$3" pattern="$4" extra_expect="${5:-$head_sha}" code=0
    write_state "$mode"
    PROBE_REPO="$work/repo" PROBE_TIMEOUT=2 PROBE_INTERVAL=1 BASE_URL="$base" EXPECT_SHA="$extra_expect" \
      bash scripts/probe-history.sh >"$work/out" 2>&1 || code=$?
    local ok=1 why=""
    if [ "$want_exit" = "0" ] && [ "$code" -ne 0 ]; then ok=0; why="exit $code, want 0"; fi
    if [ "$want_exit" = "nonzero" ] && [ "$code" -eq 0 ]; then ok=0; why="exit 0, want nonzero"; fi
    if [ -n "$pattern" ] && ! grep -qE "$pattern" "$work/out"; then ok=0; why="${why:+$why; }missing pattern '$pattern'"; fi
    if [ "$ok" -eq 1 ]; then
      pass=$((pass + 1))
      echo "ok - $name"
    else
      fail=$((fail + 1))
      echo "not ok - $name: $why"
      sed 's/^/#   /' "$work/out"
    fi
  }

  run_case "negative control: stale-but-real leaf (>20 commits behind served SHA) is rejected" \
    "stale-leaf" nonzero "lags .* by 25 commits"
  run_case "negative control: wrong-total-only with current head leaf is rejected" \
    "wrong-total" nonzero "displayed total 43 != git rev-list --count .* \(28\)"
  run_case "negative control: wrong build-sha metadata on /ryugu is rejected" \
    "wrong-build-meta" nonzero "build-sha meta .* != served /api/health sha"
  run_case "negative control: served SHA behind EXPECT_SHA by code is rejected" \
    "served-behind" nonzero "does not serve EXPECT_SHA" "$head_sha"
  run_case "negative control: moving deployment between pre- and post-probe health check is rejected" \
    "moving-deploy" nonzero "inconclusive: /api/health moved during probe" "$prev_sha"
  run_case "positive control: current real leaf and exact unfiltered total pass at 1366x768 and 390x844" \
    "valid" 0 "1366x768: leaf .* and total 28 matches git rev-list --count"

  echo "self-test: $pass ok, $fail failed"
  [ "$pass" -gt 0 ] && [ "$fail" -eq 0 ]
}

if [ "${1:-}" = "--self-test" ]; then
  self_test
else
  probe "$@"
fi
