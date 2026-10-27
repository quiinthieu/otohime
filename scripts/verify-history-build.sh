#!/usr/bin/env bash
# End-to-end local production build + browser verifier for the Ryugu-jo Tamatebako changelog history.
#
#   bash scripts/verify-history-build.sh
#
# 1. Uses a short TMPDIR, backs up content/history.json, and restores it on exit.
# 2. Preflights locked dependencies (next, playwright-core, sharp) and browser availability.
# 3. Verifies strict negative controls against a stale fallback before building.
# 4. Seeds content/history.json with a stale ancestor fallback, then runs strict history generation,
#    strict pre-build history check, the real Next build (`npm run build` with GITHUB_SHA and prebuild),
#    and strict post-build history check.
# 5. Starts `next start` on a free local port, opens `/ryugu` in headless Chrome at 1366x768 and 390x844,
#    opens the real Tamatebako box, and proves the built bundle serves the newly generated newest leaf and
#    unfiltered `git rev-list --count` total (not the stale pre-build fallback), matching `<meta name="build-sha">`.
set -euo pipefail

cd "$(dirname "$0")/.." || exit 2

export TMPDIR="${TMPDIR:-/tmp}"
if [ "${#TMPDIR}" -gt 48 ]; then
  export TMPDIR="/tmp"
fi

WORK="$(mktemp -d "${TMPDIR}/verify-history-build.XXXXXX")"
SERVER_PID=""
BACKUP_FILE="$WORK/history.json.bak"
cp content/history.json "$BACKUP_FILE"

cleanup() {
  local status=$?
  if [ -n "$SERVER_PID" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  if [ -f "$BACKUP_FILE" ]; then
    cp "$BACKUP_FILE" content/history.json 2>/dev/null || true
  fi
  rm -rf "$WORK"
  exit "$status"
}
trap cleanup EXIT INT TERM

missing_deps() {
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
  local deps="${VERIFY_HISTORY_DEPS:-next playwright-core sharp}" missing
  # shellcheck disable=SC2086
  missing="$(missing_deps $deps | tr '\n' ' ')"
  if [ -n "${missing// /}" ]; then
    echo "# dependencies do not import (${missing% }); installing: ${VERIFY_INSTALL_CMD:-npm ci --no-audit --no-fund}"
    bash -c "${VERIFY_INSTALL_CMD:-npm ci --no-audit --no-fund}" >&2
    # shellcheck disable=SC2086
    missing="$(missing_deps $deps | tr '\n' ' ')"
    if [ -n "${missing// /}" ]; then
      echo "not ok - dependencies still do not import after install: ${missing% }" >&2
      return 1
    fi
  fi
  echo "ok - dependencies import (next, playwright-core, sharp)"

  if ! browser_launches; then
    echo "# no browser launches (CHROME_PATH, Google Chrome, Playwright Chromium); installing Playwright's Chromium"
    node node_modules/playwright-core/cli.js install chromium >&2
    if ! browser_launches; then
      echo "not ok - no browser launches for verify-history-build" >&2
      return 1
    fi
  fi
  echo "ok - browser launches"
}

preflight

if [ "$(git rev-parse --is-shallow-repository)" != "false" ]; then
  echo "not ok - repository is shallow; full git history is required" >&2
  exit 1
fi

BUILD_SHA="${GITHUB_SHA:-$(git rev-parse HEAD)}"
HEAD_SHA="$(git rev-parse HEAD)"
if [ "$BUILD_SHA" != "$HEAD_SHA" ]; then
  echo "not ok - GITHUB_SHA ($BUILD_SHA) does not match HEAD ($HEAD_SHA)" >&2
  exit 1
fi

# Seed content/history.json with a real ancestor >20 commits behind HEAD to prove:
# (a) strict check rejects the stale file before regeneration, and
# (b) the Next build bundles the newly generated index rather than the pre-build fallback.
STALE_SHA="$(git rev-parse HEAD~25)"
STALE_TOTAL="$(git rev-list --count "$STALE_SHA" --)"
node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e '
  import { writeFileSync } from "node:fs";
  import { gitRunner, indexAt, serializeHistory } from "./scripts/history-index.ts";
  const stale = indexAt(gitRunner("."), process.argv[1]);
  if (!stale) process.exit(1);
  writeFileSync("content/history.json", serializeHistory(stale));
' "$STALE_SHA"

if GITHUB_SHA="$BUILD_SHA" npm run history:check -- --strict --rev="$BUILD_SHA" >/dev/null 2>&1; then
  echo "not ok - negative control: strict history:check accepted a 25-commit-stale index" >&2
  exit 1
fi
echo "ok - negative control: strict history:check rejects the 25-commit-stale fallback"

GITHUB_SHA="$BUILD_SHA" npm run history:index -- --strict --rev="$BUILD_SHA"
GITHUB_SHA="$BUILD_SHA" npm run history:check -- --strict --rev="$BUILD_SHA"
echo "ok - pre-build strict history generation and check passed at $BUILD_SHA"

PORT="$(node -e '
  const net = require("node:net");
  const s = net.createServer();
  s.listen(0, "127.0.0.1", () => { console.log(s.address().port); s.close(); });
')"
BASE_URL="http://127.0.0.1:$PORT"

rm -rf .next
GITHUB_SHA="$BUILD_SHA" \
  BETTER_AUTH_URL="$BASE_URL" \
  BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-placeholder-not-a-real-secret-0123456789abcdef}" \
  npm run build

GITHUB_SHA="$BUILD_SHA" npm run history:check -- --strict --rev="$BUILD_SHA"
echo "ok - post-build strict history:check passed"

GITHUB_SHA="$BUILD_SHA" \
  PORT="$PORT" \
  NODE_ENV=production \
  BETTER_AUTH_URL="$BASE_URL" \
  BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-ci-placeholder-not-a-real-secret-0123456789abcdef}" \
  npx next start -p "$PORT" -H 127.0.0.1 >"$WORK/server.log" 2>&1 &
SERVER_PID=$!

READY=0
for _ in $(seq 1 60); do
  if curl -fsS "$BASE_URL/ryugu" >/dev/null 2>&1; then
    READY=1
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "not ok - next start did not serve /ryugu on $BASE_URL" >&2
  tail -n 40 "$WORK/server.log" >&2 || true
  exit 1
fi
echo "ok - built server is serving $BASE_URL/ryugu"

BASE_URL="$BASE_URL" BUILD_SHA="$BUILD_SHA" STALE_SHA="$STALE_SHA" STALE_TOTAL="$STALE_TOTAL" \
  node --experimental-strip-types --disable-warning=ExperimentalWarning --disable-warning=MODULE_TYPELESS_PACKAGE_JSON -e '
    import assert from "node:assert/strict";
    import { execFileSync } from "node:child_process";
    import { chromium } from "playwright-core";
    import { cleanSubject, gitRunner, indexAt, isoSecond, splitPrefix } from "./scripts/history-index.ts";

    const base = process.env.BASE_URL!;
    const buildSha = process.env.BUILD_SHA!;
    const staleSha = process.env.STALE_SHA!;
    const staleTotal = Number(process.env.STALE_TOTAL!);
    const git = (...args: string[]) =>
      execFileSync("git", ["-c", "core.quotepath=off", "-c", "log.showSignature=false", ...args], {
        encoding: "utf8",
      }).trim();

    const expectedIndex = indexAt(gitRunner("."), buildSha)!;
    const expectedTotal = Number(git("rev-list", "--count", buildSha, "--"));
    const newestEntry = expectedIndex.entries[0];
    assert.equal(expectedIndex.total, expectedTotal);
    assert.notEqual(newestEntry.sha, staleSha.slice(0, 10), "generated leaf must differ from seeded stale leaf");
    assert.notEqual(expectedTotal, staleTotal, "generated total must differ from seeded stale total");

    const args = ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"];
    async function launch() {
      if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, args });
      try { return await chromium.launch({ channel: "chrome", args }); }
      catch { return await chromium.launch({ args }); }
    }

    const browser = await launch();
    try {
      for (const vp of [
        { label: "1366x768", width: 1366, height: 768, isMobile: false, hasTouch: false },
        { label: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
      ]) {
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.isMobile,
          hasTouch: vp.hasTouch,
          reducedMotion: "reduce",
        });
        const page = await context.newPage();
        const pageErrors: string[] = [];
        page.on("pageerror", (e) => pageErrors.push(e.message));
        const res = await page.goto(`${base}/ryugu`, { waitUntil: "networkidle", timeout: 30000 });
        assert.equal(res?.status(), 200, `${vp.label}: /ryugu HTTP 200`);
        const metaSha = await page.locator("meta[name=\"build-sha\"]").getAttribute("content");
        assert.equal(metaSha, buildSha, `${vp.label}: <meta name="build-sha"> matches BUILD_SHA`);

        await page.locator(".tamatebako .box").click();
        await page.locator(".tamatebako .replay").waitFor({ state: "visible" });
        const note = (await page.locator(".tamatebako .replay-note").innerText()).replace(/\s+/g, " ").trim();
        const mNewest = /the newest (\d+) of its (\d+) commits/.exec(note);
        const mAll = /all (\d+) of its commits/.exec(note);
        const shown = mNewest ? Number(mNewest[1]) : mAll ? Number(mAll[1]) : -1;
        const total = mNewest ? Number(mNewest[2]) : mAll ? Number(mAll[1]) : -1;
        assert.equal(shown, expectedIndex.entries.length, `${vp.label}: shown count`);
        assert.equal(total, expectedTotal, `${vp.label}: total equals unfiltered git rev-list --count`);

        const leafSha = ((await page.locator(".tamatebako .leaf code").textContent()) ?? "").trim();
        const leafDate = await page.locator(".tamatebako .leaf time").getAttribute("datetime");
        const leafSubject = ((await page.locator(".tamatebako .leaf .leaf-subject").textContent()) ?? "").trim();
        assert.equal(leafSha, newestEntry.sha, `${vp.label}: newest leaf sha matches generated index`);
        assert.equal(leafDate, newestEntry.date, `${vp.label}: newest leaf date matches git`);
        assert.equal(leafSubject, newestEntry.subject, `${vp.label}: newest leaf subject matches git`);

        const rawMeta = git("show", "-s", "--format=%cI%x1f%s", expectedIndex.head!);
        const [rawDate, rawSubject] = rawMeta.split("\x1f");
        assert.equal(leafDate, isoSecond(rawDate));
        assert.equal(leafSubject, splitPrefix(cleanSubject(rawSubject)).subject);
        assert.deepEqual(pageErrors, []);
        console.log(`ok - ${vp.label}: built /ryugu serves leaf ${leafSha} and total ${total} for build ${buildSha.slice(0, 10)}`);
        await context.close();
      }
    } finally {
      await browser.close();
    }
  '
