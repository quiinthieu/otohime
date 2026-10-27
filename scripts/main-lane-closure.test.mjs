// Local closure controls: the real shell with fake DB/browser commands, mutation-tested fixture wiring,
// and real child/gesture implementations. Full production E2E supplies independent browser execution.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { createServer } from "node:http";
import { launchBrowser } from "./probe-browser.mjs";
import { configResponse } from "../ghosts/config.ts";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { realRunChild } from "./check-gate-closure.mjs";
import { traceOf, formatTrace, TRACE_MAX } from "./e2e-gesture-trace.ts";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
// Node 22.12 supports the suite's --experimental-strip-types CLI but has no
// node:module stripping API. Compile extracted fixtures with our locked TS dependency.
const compileFixture = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const shell = read("scripts/probe-motion-signed-in.sh");
const normalization = 'export TMPDIR="${TMPDIR:-/tmp}"\nif [ "${#TMPDIR}" -gt 48 ]; then\n  export TMPDIR="/tmp"\nfi';

// Run the entire shell in remote/CI mode. Only dependency commands are fake; bash expansion,
// mktemp, command selection, environment inheritance and the script's exit propagation are real.
function launchWithTmpdir(value, source = shell) {
  const work = mkdtempSync("/tmp/lane-");
  try {
    mkdirSync(join(work, "scripts"));
    mkdirSync(join(work, "bin"));
    writeFileSync(join(work, "scripts/probe-motion-signed-in.sh"), source);
    const executable = (name, body) => writeFileSync(join(work, "bin", name), `#!/bin/bash\n${body}\n`, { mode: 0o755 });
    executable("curl", "exit 0");
    executable("google-chrome", 'echo "fixture Chrome"');
    executable("node", `case "$1" in
      -e) exit 0 ;;
      */probe-motion-signed-in.mjs)
        printf 'browser TMPDIR=%s\\n' "$TMPDIR"
        [ -n "$TMPDIR" ] && [ "\${#TMPDIR}" -le 48 ] || exit 73 ;;
      *) exit 74 ;;
    esac`);
    const env = { ...process.env, PATH: `${work}/bin:${process.env.PATH}`, CI: "true", BASE_URL: "http://127.0.0.1:1", DATABASE_URL: "postgresql://fixture" };
    delete env.PW_PREFIX;
    if (value === undefined) delete env.TMPDIR;
    else env.TMPDIR = value;
    return spawnSync("bash", [join(work, "scripts/probe-motion-signed-in.sh")], { env, encoding: "utf8", timeout: 10_000 });
  } finally { rmSync(work, { recursive: true, force: true }); }
}

function assertTmpdir(value, expected, source) {
  const result = launchWithTmpdir(value, source);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.ok(result.stdout.includes(`browser TMPDIR=${expected}\n`), result.stdout);
  assert.match(result.stdout, /nothing installed/);
}

test("motion shell normalizes unset, empty and long TMPDIR before browser launch; preserves custom paths through length 48", () => {
  const custom = mkdtempSync("/tmp/lane-custom-");
  const boundary = join(custom, "b".repeat(48 - custom.length - 1));
  mkdirSync(boundary, { recursive: true });
  try {
    for (const value of [undefined, "", "/tmp/" + "x".repeat(80), "/tmp/" + "x".repeat(44)]) assertTmpdir(value, "/tmp");
    for (const value of [custom, boundary]) assertTmpdir(value, value);
  } finally {
    rmSync(custom, { recursive: true, force: true });
  }
});

test("motion TMPDIR controls reject missing normalization, an off-by-one bound and clobbered custom paths", () => {
  assert.ok(shell.includes(normalization), "normalization block exists before mutation");
  const long = "/tmp/" + "x".repeat(44);
  for (const source of [shell.replace(normalization, ""), shell.replace('-gt 48', '-gt 49')]) {
    const result = launchWithTmpdir(long, source);
    assert.equal(result.status, 73, result.stderr + result.stdout);
    assert.throws(() => assertTmpdir(long, "/tmp", source));
  }
  assert.throws(() => assertTmpdir(undefined, "/tmp", shell.replace(normalization, "")));
  const custom = mkdtempSync("/tmp/lane-custom-");
  try { assert.throws(() => assertTmpdir(custom, custom, shell.replace(normalization, 'export TMPDIR="/tmp"'))); }
  finally { rmSync(custom, { recursive: true, force: true }); }
});

const suites = ["scripts/ci-probe-annotate.test.mjs", "scripts/probe-end-stream.test.mjs", "scripts/main-lane-closure.test.mjs"];
function registered(command) {
  assert.match(command, /\bnode\b.*\s--test\s/);
  const args = command.split(/\s+/).map((arg) => arg.replace(/^['"]|['"]$/g, ""));
  for (const suite of suites) assert.ok(args.includes(suite), `npm test must execute ${suite}`);
}

test("npm test executes all three main-lane suites; removing any registration fails", () => {
  const command = JSON.parse(read("package.json")).scripts.test;
  registered(command);
  for (const suite of suites) assert.throws(() => registered(command.replaceAll(suite, "missing.test.mjs")), /npm test must execute/);
  assert.throws(() => registered(`echo ${suites.join(" ")}`));
});

// These guards preserve the assertions, not just comments naming the fixtures. Every guard has
// a mutation that removes its required code. Behavior is exercised below and by serial full E2E.
const invariants = [
  ["desk hydration", "e2e/desk.test.ts", 'if (js) await hydrated(page);'],
  ["desk viewport centering", "e2e/desk.test.ts", '.scrollIntoViewIfNeeded({ timeout: 5_000 })'],
  ["desk hit target", "e2e/desk.test.ts", 'assert.ok(seen.isTape,'],
  ["desk drag start", "e2e/desk.test.ts", 'await shows("attached",'],
  ["desk drag end", "e2e/desk.test.ts", 'await shows("detached",'],
  ["desk failure trace", "e2e/desk.test.ts", 'assert.fail(`${what}\\n${await gestureTrace(page)}`)'],
  ["Kame observed clock", "e2e/kame.test.ts", 'performance.now() - started >= 50'],
  ["Kame frozen-clock negative control", "e2e/kame.test.ts", 'await assert.rejects(browserElapsed(page, started), { name: "TimeoutError" })'],
  ["ledger visible two-frame settle", "e2e/ledger.test.ts", 'prev && prev.visible && now.visible && now.ready === "complete" && same(prev, now)'],
  ["ledger overflow assertion", "e2e/ledger.test.ts", 'assert.ok(scrollWidth > clientWidth,'],
  ["gate output flush", "lib/gate-closure.test.ts", 'process.stdout.write(${out}, () => process.exit(3))'],
  ["gate under-cap assertion", "lib/gate-closure.test.ts", 'assert.equal(under.stdout.length, 200_000,'],
  ["gate over-cap assertion", "lib/gate-closure.test.ts", 'assert.equal(over.stdout.length, KEPT,'],
];
for (const [name, path, token] of invariants) {
  test(`preserve ${name}, rejecting its removal`, () => {
    const source = read(path);
    const check = (text) => assert.ok(text.includes(token), `${path}: ${name}`);
    check(source);
    assert.throws(() => check(source.replaceAll(token, "REMOVED")), { name: "AssertionError" });
  });
}

test("the actual Kame clock predicate rejects frozen browser time and observes the 50ms boundary", () => {
  const source = read("e2e/kame.test.ts");
  const helper = source.slice(source.indexOf("const browserElapsed ="), source.indexOf('\ntest("clock fixture'));
  let elapsed = 0;
  const browserElapsed = runInNewContext(compileFixture(`${helper}\nbrowserElapsed;`), { performance: { now: () => elapsed } });
  const page = { waitForFunction(predicate, started, options) {
    assert.equal(options.timeout, 2000);
    return predicate(started);
  } };
  for (const [time, expected] of [[0, false], [49, false], [50, true]]) {
    elapsed = 100 + time;
    assert.equal(browserElapsed(page, 100), expected);
  }
});

test("gesture trace stays bounded while retaining press/release and meaningful failure output", () => {
  const events = Array.from({ length: 102 }, (_, i) => ({ type: i === 0 ? "pointerdown" : i === 101 ? "pointerup" : "pointermove", t: i, x: i, y: 0, pointerId: 1, pointerType: "touch", target: "span.desk-tape", dragging: i > 0 }));
  const trace = traceOf(events);
  assert.equal(trace.records.length, TRACE_MAX);
  assert.equal(trace.dropped, 62);
  assert.equal(trace.records[0].type, "pointerdown");
  assert.equal(trace.records.at(-1).type, "pointerup");
  const check = (output) => {
    assert.match(output, /pointerdown touch#1/);
    assert.match(output, /pointerup touch#1.*dragging/);
    assert.match(output, /62 records dropped to keep 40/);
  };
  check(formatTrace(trace));
  assert.throws(() => check(formatTrace(traceOf(events.slice(1)))));
  assert.throws(() => check(formatTrace(traceOf(events.slice(0, -1)))));
});

test("gate child drains callback-flushed stdout and stderr, retaining complete under-cap output and exact over-cap tails", async () => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const run = (size, code) => realRunChild({ command: process.execPath, args: ["-e", `const out='h'.repeat(200000)+'t'.repeat(${size});process.stdout.write(out,()=>process.stderr.write(out,()=>process.exit(${code})))`], cwd: root, env, timeoutMs: 20_000 });
  const under = await run(0, 0);
  const over = await run(1_000_000, 3);
  assert.equal(under.code, 0);
  assert.equal(over.code, 3, "a red child remains red");
  for (const stream of ["stdout", "stderr"]) {
    assert.equal(under[stream], "h".repeat(200_000), `${stream} is completely drained`);
    assert.equal(over[stream], "t".repeat(1_000_000), `${stream} keeps exactly the tail cap`);
    assert.notEqual(over[stream], under[stream]);
  }
  assert.equal(under.timedOut || over.timedOut, false);
});


test("ledger's actual sampler waits for visible two-frame geometry and still rejects a sheet that fits", async () => {
  const source = read("e2e/ledger.test.ts");
  const helpers = source.slice(source.indexOf("const settledLayout ="), source.indexOf('\ntest("on a phone the sheet scrolls'));
  const { settledLayout, assertPhoneLayout } = new Function("assert", "LAYOUT_FRAMES", compileFixture(helpers) + "; return { settledLayout, assertPhoneLayout };")(assert, 40);
  const browser = await launchBrowser({ log: () => {}, options: { env: { ...process.env, TMPDIR: "/tmp" } } });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent('<style>body{margin:0}.ledger-scroll{width:100%;overflow:auto;display:none}.ledger-sheet{width:100%;min-width:46rem;height:20px}</style><div class="ledger-scroll"><svg class="ledger-sheet"></svg></div>');
    await page.evaluate(() => setTimeout(() => { document.querySelector(".ledger-scroll").style.display = "block"; }, 150));
    const shown = await settledLayout(page);
    assert.ok(shown.frames >= 2);
    assert.ok(shown.samples.some((sample) => !sample.visible));
    assertPhoneLayout(shown);
    await page.addStyleTag({ content: ".ledger-sheet{min-width:0!important}" });
    const fits = await settledLayout(page);
    assert.ok(fits.settled && fits.frames >= 2);
    assert.throws(() => assertPhoneLayout(fits), /the year scrolls inside its frame/);
  } finally { await browser.close(); }
});

test("disabled ghost probe is console-clean; direct configuration HTTP 404 remains detectable", async () => {
  // Execute the actual GET body, substituting only Next request-context construction and runtime env.
  const route = read("app/api/ghosts/route.ts");
  const body = compileFixture(route.slice(route.indexOf("export async function GET")).replace("export ", ""));
  const GET = new Function("connection", "configResponse", "process", `${body}; return GET;`)(async () => {}, configResponse, { env: {} });
  assert.match(read("ghosts/canvas.tsx"), /fetch\("\/api\/ghosts\?probe=1"/);
  const server = createServer(async (req, res) => {
    if (req.url === "/config") {
      const response = await GET(new Request("http://localhost/api/ghosts?probe=1"));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } else if (req.url === "/negative") {
      const response = await GET(new Request("http://localhost/api/ghosts"));
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text());
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end('<!doctype html><link rel="icon" href="data:,"><main>Configuration control</main>');
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await launchBrowser({ log: () => {}, options: { env: { ...process.env, TMPDIR: "/tmp" } } });
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    const response = await page.evaluate(async () => {
      const response = await fetch("/config");
      return { status: response.status, body: await response.text() };
    });
    assert.equal(response.status, 200, "disabled is a valid configuration, not a missing resource");
    assert.equal(JSON.parse(response.body), null);
    const clean = () => assert.deepEqual(errors, [], "zero console and page errors");
    clean();
    const failure = page.waitForEvent("console", { predicate: (message) => message.type() === "error", timeout: 2000 });
    await page.evaluate(() => fetch("/negative"));
    await failure;
    assert.throws(clean, /zero console and page errors/);
    assert.ok(errors.some((error) => error.includes("404")));
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
