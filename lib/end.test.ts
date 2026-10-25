import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { test } from "node:test";
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
  assert.match(ci, /bash scripts\/walk-end\.sh/);
  assert.match(ci, /bash scripts\/probe-end\.sh/);

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
    const baseEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test" };
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
        const res = await runScript(probePath, ciEnv);
        assert.equal(res.code, 1, `probe-end.sh BASE_URL (${c.label}) should stop at stubbed npm`);
        assert.doesNotMatch(res.stderr, /unbound variable/, `probe-end.sh BASE_URL (${c.label}) stderr: ${res.stderr}`);
        assert.match(
          res.stdout,
          new RegExp(`RESOLVED_TMPDIR=${c.expectedTmp.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
          `probe-end.sh BASE_URL (${c.label}) stdout: ${res.stdout}`,
        );
      }
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
