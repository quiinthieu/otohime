import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { site } from "../content/site.ts";
import {
  end,
  endBusy,
  endCue,
  endReadout,
  KONAMI,
  konamiStep,
  LCD_ROW_CAP,
  lcdLine,
  lcdRows,
  newEnd,
  TENTH_POKE,
  type End,
  type EndAction,
} from "./end.ts";
import { PUBLIC_PAGES } from "./pages.ts";

const ITEMS = site.end.lines.length;
const play = (start: End = newEnd(ITEMS), ...actions: EndAction[]): End =>
  actions.reduce(end, start);

test("idle state starts at SAVE POINT with the console resting", () => {
  const s = newEnd(ITEMS);
  assert.equal(endBusy(s), false);
  assert.equal(s.pokes, 0);
  assert.equal(s.line, 0);
  assert.equal(s.unlocked, false);
  assert.deepEqual(lcdRows(s, site.end), ["SAVE", "POINT"]);
  assert.equal(lcdLine(s, site.end), "SAVE POINT");
  assert.equal(endReadout(s, site.end), site.end.idle.readout);
});

test("each poke advances the cycle, wraps around, and changes LCD and readout", () => {
  let s = newEnd(ITEMS);
  for (let i = 1; i <= ITEMS * 2 + 2; i++) {
    const prevReadout = endReadout(s, site.end);
    const prevLcd = lcdLine(s, site.end);
    s = play(s, "poke", "settle");
    assert.equal(s.pokes, i);
    if (i === TENTH_POKE) {
      assert.equal(s.cue, "tenth");
      assert.deepEqual(lcdRows(s, site.end), site.end.tenth.lcd);
      assert.equal(endReadout(s, site.end), site.end.tenth.readout);
    } else {
      assert.equal(s.cue, "poke");
      assert.deepEqual(endCue(s, site.end), site.end.lines[s.line]);
    }
    assert.notEqual(endReadout(s, site.end), prevReadout, `poke ${i} readout did not change`);
    assert.notEqual(lcdLine(s, site.end), prevLcd, `poke ${i} lcd did not change`);
  }
});

test("the tenth poke shows the breather line and the eleventh resumes cycling", () => {
  let s = newEnd(ITEMS);
  for (let i = 0; i < TENTH_POKE - 1; i++) s = play(s, "poke", "settle");
  const ninthLine = s.line;
  const tenth = play(s, "poke");
  assert.equal(tenth.pokes, TENTH_POKE);
  assert.equal(tenth.cue, "tenth");
  assert.equal(tenth.line, ninthLine);
  assert.deepEqual(lcdRows(tenth, site.end), ["STOP", "POKING"]);

  const eleventh = play(tenth, "settle", "poke", "settle");
  assert.equal(eleventh.pokes, TENTH_POKE + 1);
  assert.equal(eleventh.cue, "poke");
  assert.equal(eleventh.line, (ninthLine + 1) % ITEMS);
  assert.deepEqual(lcdRows(eleventh, site.end), site.end.lines[eleventh.line].lcd);
});

test("a poke holds the button down for two ticks and settle releases it immediately", () => {
  const s0 = play(newEnd(ITEMS), "poke");
  assert.equal(endBusy(s0), true);
  assert.equal(s0.pressed, true);
  assert.equal(s0.hold, 2);

  const s1 = play(s0, "tick");
  assert.equal(endBusy(s1), true);
  assert.equal(s1.hold, 1);

  const s2 = play(s1, "tick");
  assert.equal(endBusy(s2), false);
  assert.equal(s2.pressed, false);
  assert.equal(s2.hold, 0);

  const settled = play(newEnd(ITEMS), "poke", "settle");
  assert.equal(endBusy(settled), false);
  assert.equal(settled.pressed, false);
  assert.equal(settled.hold, 0);
  assert.equal(settled.pokes, 1);
});

test("the Konami sequence unlocks Reached the end with lowercase or uppercase B and A", () => {
  const lower = play(
    newEnd(ITEMS),
    ...KONAMI.map((key) => ({ key })),
  );
  assert.equal(lower.unlocked, true);
  assert.equal(lower.progress, 0);
  assert.equal(lower.cue, "unlocked");
  assert.deepEqual(lcdRows(lower, site.end), ["REACHED", "THE END"]);
  assert.equal(endReadout(sOr(lower), site.end), site.end.unlocked.readout);

  // Uppercase B/A with Shift keydown events interspersed
  const upperKeys = [
    ...KONAMI.slice(0, 8),
    "Shift",
    "B",
    "Shift",
    "A",
  ];
  const upper = play(
    newEnd(ITEMS),
    ...upperKeys.map((key) => ({ key })),
  );
  assert.equal(upper.unlocked, true);
  assert.equal(upper.progress, 0);
  assert.equal(upper.cue, "unlocked");
});

function sOr(s: End): End {
  return s;
}

test("Konami prefix overlap preserves matching prefixes and wrong keys reset to zero", () => {
  // Extra ArrowUp after ArrowUp, ArrowUp keeps progress at 2
  assert.equal(konamiStep(0, "ArrowUp"), 1);
  assert.equal(konamiStep(1, "ArrowUp"), 2);
  assert.equal(konamiStep(2, "ArrowUp"), 2);

  // ArrowUp after ArrowUp, ArrowUp, ArrowDown restarts prefix at 1
  assert.equal(konamiStep(3, "ArrowUp"), 1);
  // ArrowUp after ArrowUp, ArrowUp, ArrowDown, ArrowDown, ArrowLeft, ArrowRight restarts prefix at 1
  assert.equal(konamiStep(6, "ArrowUp"), 1);
  // Unrelated key resets progress to 0
  assert.equal(konamiStep(5, "Escape"), 0);
  assert.equal(konamiStep(9, "b"), 0);

  // Full sequence with overlapping prefix (three ArrowUps at start) unlocks
  const overlapped = play(
    newEnd(ITEMS),
    { key: "ArrowUp" },
    ...KONAMI.map((key) => ({ key })),
  );
  assert.equal(overlapped.unlocked, true);
  assert.equal(overlapped.progress, 0);

  // Partial progress followed by wrong key does not unlock
  const wrong = play(
    newEnd(ITEMS),
    ...KONAMI.slice(0, 8).map((key) => ({ key })),
    { key: "x" },
    { key: "b" },
    { key: "a" },
  );
  assert.equal(wrong.unlocked, false);
  assert.equal(wrong.progress, 0);
});

test("leaving the viewport clears partial Konami progress without losing pokes or unlock", () => {
  const partial = play(
    newEnd(ITEMS),
    "poke",
    "settle",
    { key: "ArrowUp" },
    { key: "ArrowUp" },
    { key: "ArrowDown" },
  );
  assert.equal(partial.progress, 3);
  const left = play(partial, "leave");
  assert.equal(left.progress, 0);
  assert.equal(left.pokes, 1);
  assert.equal(end(left, "leave"), left);
});

test("restoration and repeated unlock preserve mascot pokes and re-display the achievement", () => {
  const restored = play(newEnd(ITEMS), "restore");
  assert.equal(restored.unlocked, true);
  assert.equal(restored.cue, "unlocked");
  assert.deepEqual(lcdRows(restored, site.end), ["REACHED", "THE END"]);

  // Poking after restoration cycles normal poke lines while staying unlocked
  const pokedAfterRestore = play(restored, "poke", "settle");
  assert.equal(pokedAfterRestore.unlocked, true);
  assert.equal(pokedAfterRestore.cue, "poke");
  assert.deepEqual(lcdRows(pokedAfterRestore, site.end), site.end.lines[1].lcd);

  // Entering Konami again re-displays the unlocked cue
  const reUnlocked = play(
    pokedAfterRestore,
    ...KONAMI.map((key) => ({ key })),
  );
  assert.equal(reUnlocked.unlocked, true);
  assert.equal(reUnlocked.cue, "unlocked");
  assert.deepEqual(lcdRows(reUnlocked, site.end), ["REACHED", "THE END"]);
});

test("site.end copy matches the required sentences, LCD bounds, and PUBLIC_PAGES count", () => {
  assert.equal(site.end.title, "You've reached the end of the internet.");
  assert.equal(site.end.sub, "Thanks for stopping by. See you on the next level.");
  const allCues = [site.end.idle, site.end.tenth, site.end.unlocked, ...site.end.lines];
  for (const cue of allCues) {
    assert.equal(cue.lcd.length, 2);
    for (const row of cue.lcd) {
      assert.ok(row.length >= 2 && row.length <= LCD_ROW_CAP, `LCD row "${row}" exceeds ${LCD_ROW_CAP} chars`);
      assert.match(row, /^[A-Z0-9 ?.!·-]+$/, `LCD row "${row}" is not uppercase ASCII`);
    }
    assert.ok(cue.readout.length > 0);
  }
  const pageLine = site.end.lines.find((l) => l.lcd[0].includes("PAGES"));
  assert.ok(pageLine, "missing public pages count line");
  assert.equal(pageLine.lcd[0], `${PUBLIC_PAGES.length} PAGES`);
});

test("lib/end.ts is pure and imports no browser or DOM APIs", () => {
  const src = readFileSync(resolve(import.meta.dirname, "end.ts"), "utf8");
  assert.doesNotMatch(src, /\b(window|document|localStorage|matchMedia|IntersectionObserver|requestAnimationFrame)\b/);
});

test("Footer walk reads the exact plain heading source, ignoring nested Riso plates", () => {
  const walk = readFileSync(resolve(import.meta.dirname, "../scripts/walk-end.sh"), "utf8");
  // Execute the actual verifier block, not a second implementation of its matcher.
  const helpers = walk.slice(walk.indexOf("const decode ="), walk.indexOf("const mainTags ="));
  const heading = walk.slice(walk.indexOf("// Heading and copy"), walk.indexOf("assert.ok(decode(footerHtml).includes(site.end.sub)"));
  assert.ok(helpers && heading, "the shell verifier must retain its heading check");
  const verify = (footerHtml: string) => runInNewContext(`${helpers}\n${heading}`, { assert, site, footerHtml });
  const title = site.end.title.replaceAll("'", "&#x27;");
  // Mirrors RisoText: one plain source, then deeply nested, aria-hidden character plates.
  const riso = (source: string, visual = title) => `<h2 id="end-title"><span class="riso-text"><span class="riso-source ">${source}</span><span class="riso-visual" aria-hidden="true"><span class="riso-word"><span class="riso-char"><span class="riso-anchor">${visual}</span></span></span></span></span></h2>`;
  verify(riso(title));
  verify(riso(title).replace('class="riso-source "', 'class="plain riso-source footer-copy"'));
  verify(riso(title, "decorative ink"));
  verify(`<h2 id="end-title">${title}</h2>`);
  assert.throws(() => verify(riso("Wrong accessible source")), { code: "ERR_ASSERTION" });
  assert.throws(() => verify(riso(`${title} extra`)), { code: "ERR_ASSERTION" });
  assert.throws(() => verify(riso(title).replace('id="end-title"', 'id="another-title"')), /missing h2#end-title/);
  assert.throws(() => verify(`<span class="riso-source">${title}</span>${riso("Wrong source")}`), { code: "ERR_ASSERTION" });
  assert.throws(() => verify(riso(title).replace('class="riso-source "', 'class="riso-source-imitation"')), { code: "ERR_ASSERTION" });
});

test("Footer walk separates decorative layers from the named basket and rejects missing or extra SVGs", () => {
  const walk = readFileSync(resolve(import.meta.dirname, "../scripts/walk-end.sh"), "utf8");
  const start = walk.indexOf("const svgs =");
  const stop = walk.indexOf('assert.match(footerHtml, /<button', start);
  assert.ok(start >= 0 && stop > start, "execute the actual shell SVG verifier block");
  const check = walk.slice(start, stop);
  const layer = (name: string) => `<svg data-layer="${name}" aria-hidden="true"></svg>`;
  const layers = ["ground", "console", "sky"].map(layer).join("");
  const basket = '<svg data-paper-basket="" role="img" aria-label="Wastepaper basket"></svg>';
  const wave = '<svg aria-hidden="true"></svg>';
  const verify = (sceneHtml = layers + basket, waterHtml = wave) => runInNewContext(check, { assert, sceneHtml, waterHtml });
  verify();
  assert.throws(() => verify(layers), { code: "ERR_ASSERTION" }, "basket is required");
  assert.throws(() => verify(layers + basket + basket), { code: "ERR_ASSERTION" }, "duplicate basket cannot replace a layer");
  assert.throws(() => verify(layer("ground") + layer("sky") + basket), { code: "ERR_ASSERTION" }, "console layer is required");
  assert.throws(() => verify(layers + basket + layer("unrelated")), { code: "ERR_ASSERTION" }, "unrelated extra SVG still fails");
  assert.throws(() => verify((layers + basket).replace('aria-hidden="true"', 'aria-hidden="false"')), { code: "ERR_ASSERTION" });
  assert.throws(() => verify(layers + basket.replace('role="img"', 'role="presentation"')), { code: "ERR_ASSERTION" });
  assert.throws(() => verify(layers + basket.replace('Wastepaper basket', 'Unnamed')), { code: "ERR_ASSERTION" });
  assert.throws(() => verify(layers + basket.replace('role="img"', 'aria-hidden="true" role="img"')), { code: "ERR_ASSERTION" });
  assert.throws(() => verify(layers + basket, ""), { code: "ERR_ASSERTION" }, "waterline wave remains required");
  assert.throws(() => verify(layers + basket, wave + wave), { code: "ERR_ASSERTION" }, "extra wave still fails");
});

test("Footer probe separates decorative SVGs from the named basket on real browser DOM", async () => {
  const { launchBrowser } = await import("../scripts/probe-browser.mjs");
  const { endSvgStructure, inPage } = await import("../scripts/probe-end-dom.mjs");
  const probe = readFileSync(resolve(import.meta.dirname, "../scripts/probe-end.mjs"), "utf8");
  assert.equal((probe.match(/inPage\(endSvgStructure,/g) ?? []).length, 2, "route and no-JS paths both use the tested helper");
  assert.match(probe, /meta\.ok && svgStructure\.ok/);
  assert.match(probe, /noJsSvg\.ok &&/);
  const layers = '<svg aria-hidden="true"></svg>'.repeat(3);
  const basket = '<svg data-paper-basket="" role="img" aria-label="Wastepaper basket"></svg>';
  const water = '<div data-end-waterline=""><svg aria-hidden="true"></svg></div>';
  const html = (scene = layers + basket, waterline = water) => `<footer class="end">${scene}${waterline}</footer>`;
  const browser = await launchBrowser({ log: () => {} });
  try {
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ javaScriptEnabled });
      try {
        const page = await context.newPage();
        const verify = async (markup: string) => {
          await page.setContent(markup);
          return page.evaluate(inPage(endSvgStructure, 'document.querySelector("footer.end")'));
        };
        assert.equal((await verify(html())).ok, true);
        assert.equal(await page.getByRole("img", { name: "Wastepaper basket", exact: true }).count(), 1);
        for (const bad of [
          html(layers), html(layers + basket + basket),
          html('<svg aria-hidden="true"></svg>'.repeat(2) + basket),
          html(layers + basket + '<svg aria-hidden="true"></svg>'),
          html((layers + basket).replace('aria-hidden="true"', 'aria-hidden="false"')),
          html(layers + basket.replace('role="img"', 'role="presentation"')),
          html(layers + basket.replace('Wastepaper basket', 'Unnamed')),
          html(layers + `<div hidden>${basket}</div>`),
          html(layers + basket, ""), html(layers + basket, water + water),
          html(layers + basket, water + "<p>After the waterline</p>"),
          "<main>No footer</main>",
        ]) assert.equal((await verify(bad)).ok, false, `negative control, JavaScript=${javaScriptEnabled}: ${bad}`);
        assert.equal((await verify(html())).ok, true, "same helper recovers after mutations");
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
});

test("Footer network ownership rechecks a blank iframe when its player src arrives and rejects a footer twin", async () => {
  const source = readFileSync(resolve(import.meta.dirname, "../scripts/probe-end.mjs"), "utf8");
  const start = source.indexOf("  const playerFrames =");
  const end = source.indexOf('  page.on("frameattached"', start);
  assert.ok(start >= 0 && end > start, "exercise the actual ownership cache");
  let checks = 0;
  // Frame fixtures isolate caching policy; the production probe also exercises
  // delayed src and its footer twin with real browser frames and routed URLs.
  const playerFrame = runInNewContext(`${source.slice(start, end)}; playerFrame`, {
    verifyPlayerFrame: async (frame: { player: boolean }) => { checks++; return frame.player; },
    recorded: () => [],
  });
  const player = { player: false };
  assert.equal(await playerFrame(player), false, "a blank iframe is unverified");
  player.player = true;
  assert.equal(await playerFrame(player), true, "a later valid src must be verified again");
  const verifiedChecks = checks;
  assert.equal(await playerFrame(player), true);
  assert.equal(checks, verifiedChecks, "only positive ownership is cached");
  assert.equal(await playerFrame({ player: false }), false, "a footer twin never borrows the player's ownership");
});

test("walk-end.sh, probe-end.sh and CI checks wire the footer verification suite and handle unset, empty and long TMPDIR", async () => {
  const root = resolve(import.meta.dirname, "..");
  const walkPath = resolve(root, "scripts/walk-end.sh");
  const probePath = resolve(root, "scripts/probe-end.sh");
  const walkSh = readFileSync(walkPath, "utf8");
  const probeSh = readFileSync(probePath, "utf8");
  const probeMjs = readFileSync(resolve(root, "scripts/probe-end.mjs"), "utf8");
  const ci = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

  assert.match(walkSh, /PORT="\$\{PORT:-4081\}"/);
  assert.match(probeSh, /PORT="\$\{PORT:-4083\}"/);
  assert.match(probeSh, /export TMPDIR="\$\{TMPDIR:-\/tmp\}"/);
  assert.ok(
    probeSh.indexOf('export TMPDIR="${TMPDIR:-/tmp}"') < probeSh.indexOf("${#TMPDIR}"),
    "TMPDIR must be normalized before expanding ${#TMPDIR} under set -u",
  );
  assert.match(probeSh, /playwright@1\.64\.0/);
  assert.match(probeMjs, /verifyCanonicalLinks/);
  assert.match(probeMjs, /negative control:/);
  assert.match(probeMjs, /local 390x844 reduced-motion 403 exit:/);
  // Network attribution compares parsed hosts and frame owners, never whole-URL substrings, and has its own controls.
  assert.match(probeMjs, /function classifyExternal\(/);
  assert.match(probeMjs, /async function verifyPlayerFrame\(/);
  assert.doesNotMatch(probeMjs, /\/youtube\\\.com\|ytimg\\\.com\|google\\\.com\|gstatic\\\.com\/\.test\(url\)/);
  assert.match(probeMjs, /network negative control: main-frame ad, path\/query and look-alike host requests/);
  // The badge is waited for by its observable state, with a held-invisible negative control.
  assert.match(probeMjs, /async function settleBadge\(/);
  assert.match(probeMjs, /const unlockSettle = await settleBadge\(page\);/);
  assert.match(probeMjs, /const restoreSettle = await settleBadge\(page\);/);
  assert.match(probeMjs, /badge negative control:/);
  // The eyes' rAF budget is measured only once the setup scroll's last event has landed (Kame takes an edge frame on
  // scroll), with a negative control that overlaps the two on purpose.
  assert.match(probeMjs, /await scrollQuiet\(page\);\n\s+await page\.waitForFunction\(\(\) => window\.__endPendingRafs === 0\);/);
  assert.match(probeMjs, /rAF negative control: a scroll during pointer work/);
  assert.match(probeMjs, />= 0\.99/);
  assert.match(ci, /bash scripts\/walk-end\.sh/);
  assert.match(ci, /bash scripts\/probe-end\.sh/);

  const rolesPage = readFileSync(resolve(root, "app/(site)/(app)/admin/roles/page.tsx"), "utf8");
  const forbiddenPage = readFileSync(resolve(root, "app/(site)/(app)/forbidden.tsx"), "utf8");
  assert.match(rolesPage, /requireUser\("\/admin\/roles"\)/);
  assert.match(rolesPage, /if \(!can\(session\.user\.role, \{ user: \["list"\] \}\)\) return <Forbidden \/>;/);
  assert.doesNotMatch(rolesPage, /\brequirePermission\b|\bforbidden\(\)/);
  assert.match(forbiddenPage, /<meta name="robots" content="noindex" \/>/);

  // Executable regression: run the real probe-end.sh and walk-end.sh under set -u with TMPDIR unset,
  // empty, short custom, and >48-char long paths against a busy explicit PORT.
  const srv = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
  });
  await new Promise<void>((resolveListen) => srv.listen(0, "127.0.0.1", resolveListen));
  const address = srv.address();
  const busyPort = typeof address === "object" && address ? String(address.port) : "4083";
  const shortTmp = mkdtempSync("/tmp/end-tmp-");

  try {
    // Force the runner condition locally so this regression is exercised even when the test host has no CI flag.
    const baseEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", CI: "true" };
    delete baseEnv.TMPDIR;
    delete baseEnv.BASE_URL;
    delete baseEnv.PORT;
    const cases: { label: string; env: NodeJS.ProcessEnv; expectedTmp: string }[] = [
      { label: "unset TMPDIR", env: { ...baseEnv, PORT: busyPort }, expectedTmp: "/tmp" },
      { label: "empty TMPDIR", env: { ...baseEnv, PORT: busyPort, TMPDIR: "" }, expectedTmp: "/tmp" },
      { label: "short custom TMPDIR", env: { ...baseEnv, PORT: busyPort, TMPDIR: shortTmp }, expectedTmp: shortTmp },
      {
        label: "long TMPDIR (>48 chars)",
        env: { ...baseEnv, PORT: busyPort, TMPDIR: `/tmp/${"long-lease-segment-".repeat(4)}` },
        expectedTmp: "/tmp",
      },
    ];

    const runScript = (script: string, env: NodeJS.ProcessEnv) =>
      new Promise<{ code: number | null; stdout: string; stderr: string }>((resolveRun) => {
        execFile("bash", [script], { cwd: root, env, timeout: 10_000 }, (err, stdout, stderr) => {
          const code = err && typeof err.code === "number" ? err.code : err ? 1 : 0;
          resolveRun({ code, stdout, stderr });
        });
      });

    for (const c of cases) {
      for (const script of [probePath, walkPath]) {
        const res = await runScript(script, c.env);
        assert.equal(res.code, 1, `${script} (${c.label}) should exit 1 on busy explicit PORT`);
        assert.doesNotMatch(res.stderr, /unbound variable/, `${script} (${c.label}) stderr: ${res.stderr}`);
        assert.match(
          res.stdout,
          new RegExp(`not ok - port: something already listens on port ${busyPort}`),
          `${script} (${c.label}) stdout: ${res.stdout}`,
        );
      }
    }

    // Also exercise probe-end.sh in BASE_URL mode (as used by CI) across unset, empty, short and long TMPDIR,
    // using a stub npm binary to observe the exported TMPDIR without installing Playwright inside unit tests.
    const binDir = mkdtempSync("/tmp/end-bin-");
    const npmStub = resolve(binDir, "npm");
    writeFileSync(npmStub, '#!/usr/bin/env bash\necho "RESOLVED_TMPDIR=$TMPDIR"\nexit 1\n');
    chmodSync(npmStub, 0o755);
    try {
      for (const c of cases) {
        const ciEnv: NodeJS.ProcessEnv = {
          ...c.env,
          BASE_URL: `http://127.0.0.1:${busyPort}`,
          PATH: `${binDir}:${process.env.PATH ?? "/usr/bin:/bin"}`,
        };
        delete ciEnv.PORT;
        // This fixture exercises the installer even when its parent is a CI runner with Chrome installed.
        // The actual CI Chrome branch has its own case below.
        ciEnv.CI = "";
        const res = await runScript(probePath, ciEnv);
        assert.equal(res.code, 1, `probe-end.sh BASE_URL (${c.label}) should stop at stubbed npm`);
        assert.doesNotMatch(res.stderr, /unbound variable/, `probe-end.sh BASE_URL (${c.label}) stderr: ${res.stderr}`);
        assert.match(
          res.stdout,
          new RegExp(`RESOLVED_TMPDIR=${c.expectedTmp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
          `probe-end.sh BASE_URL (${c.label}) stdout: ${res.stdout}`,
        );
      }

      // The runner branch, on any host: CI set and a fake google-chrome first on PATH install nothing and hand off to
      // probe-end.mjs, here a fake node that reports its arguments and exits 7.
      writeFileSync(resolve(binDir, "google-chrome"), '#!/usr/bin/env bash\necho "Google Chrome 999.0.0.0"\n');
      writeFileSync(resolve(binDir, "node"), '#!/usr/bin/env bash\necho "STUB_NODE $*"\nexit 7\n');
      chmodSync(resolve(binDir, "google-chrome"), 0o755);
      chmodSync(resolve(binDir, "node"), 0o755);
      const runnerEnv: NodeJS.ProcessEnv = {
        ...baseEnv,
        CI: "true",
        BASE_URL: `http://127.0.0.1:${busyPort}`,
        PATH: `${binDir}:${process.env.PATH ?? "/usr/bin:/bin"}`,
      };
      const runner = await runScript(probePath, runnerEnv);
      assert.equal(runner.code, 7, `probe-end.sh runner branch should exit with probe-end.mjs's code: ${runner.stdout}${runner.stderr}`);
      assert.match(runner.stdout, /^# browser: runner Google Chrome 999\.0\.0\.0 with the repo's playwright-core; nothing installed$/m);
      assert.doesNotMatch(runner.stdout, /RESOLVED_TMPDIR|npm i playwright/, `runner branch ran an installer: ${runner.stdout}`);
      assert.match(runner.stdout, /^STUB_NODE .*scripts\/probe-end\.mjs$/m);
    } finally {
      rmSync(binDir, { recursive: true, force: true });
    }

    assert.deepEqual(
      readdirSync(shortTmp),
      [],
      "cleanup trap must remove temporary work directories on exit",
    );
  } finally {
    rmSync(shortTmp, { recursive: true, force: true });
    await new Promise<void>((resolveClose) => srv.close(() => resolveClose()));
  }
});
