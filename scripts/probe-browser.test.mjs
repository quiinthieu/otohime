// scripts/probe-browser.mjs against a fake module loader: which Playwright is loaded, from where, with what
// launch options. No browser and no npm install, so it runs in `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { launchBrowser } from "./probe-browser.mjs";

// A fake load(name, prefix): `modules` maps "name@prefix" (prefix "" = the repo) to a chromium whose launch
// resolves to a fake browser or rejects; anything else throws like require does for a missing module.
function fakeLoader(modules) {
  const calls = [];
  const load = (name, prefix) => {
    const key = `${name}@${prefix}`;
    const launchWith = modules[key];
    if (!launchWith) throw new Error(`Cannot find module '${name}'\nRequire stack: ${prefix || "repo"}`);
    return {
      chromium: {
        async launch(options) {
          calls.push({ key, options });
          return launchWith(options);
        },
      },
    };
  };
  return { load, calls };
}

const browser = (version) => async () => ({ version: () => version });
const absent = async () => {
  throw new Error("browserType.launch: Chromium distribution 'chrome' is not found at /opt/google/chrome/chrome\nRun \"npx playwright install chrome\"");
};

test("Chrome through the repo's playwright-core when PW_PREFIX is unset", async () => {
  const { load, calls } = fakeLoader({ "playwright-core@": browser("141.0.7390.54"), "playwright@/tmp/pw": browser("unused") });
  const logs = [];
  const b = await launchBrowser({ env: {}, load, log: (l) => logs.push(l), options: { headless: true } });
  assert.equal(b.version(), "141.0.7390.54");
  assert.deepEqual(calls, [{ key: "playwright-core@", options: { headless: true, channel: "chrome" } }]);
  assert.deepEqual(logs, ["# browser: 141.0.7390.54 via playwright-core, channel chrome"]);
});

test("PW_PREFIX's playwright when it is set, and Chrome is not tried", async () => {
  const { load, calls } = fakeLoader({ "playwright-core@": absent, "playwright@/tmp/pw": browser("142.0.0.0") });
  const logs = [];
  const b = await launchBrowser({ env: { PW_PREFIX: "/tmp/pw" }, load, log: (l) => logs.push(l) });
  assert.equal(b.version(), "142.0.0.0");
  assert.deepEqual(calls, [{ key: "playwright@/tmp/pw", options: {} }]);
  assert.deepEqual(logs, ["# browser: 142.0.0.0 via playwright from PW_PREFIX /tmp/pw"]);
});

test("a clear error when Chrome is absent and PW_PREFIX is unset", async () => {
  const { load, calls } = fakeLoader({ "playwright-core@": absent });
  await assert.rejects(launchBrowser({ env: {}, load, log: () => {} }), (err) => {
    assert.match(err.message, /^probe-browser: no browser\./);
    assert.match(err.message, /Chromium distribution 'chrome' is not found/);
    assert.match(err.message, /PW_PREFIX is not set/);
    assert.doesNotMatch(err.message, /\n/, "one line, not Playwright's whole banner");
    return true;
  });
  assert.equal(calls.length, 1);
});

test("a clear error when playwright-core itself is missing", async () => {
  const { load } = fakeLoader({});
  await assert.rejects(launchBrowser({ env: {}, load, log: () => {} }), /no browser.*Cannot find module 'playwright-core'/);
});

test("a clear error when PW_PREFIX is set but its playwright is not there", async () => {
  const { load } = fakeLoader({ "playwright-core@": browser("unused") });
  await assert.rejects(
    launchBrowser({ env: { PW_PREFIX: "/tmp/empty" }, load, log: () => {} }),
    /^Error: probe-browser: no browser\. PW_PREFIX=\/tmp\/empty is set, but its playwright did not launch Chromium \(Cannot find module 'playwright'\)\.$/,
  );
});

test("the default loader resolves the repo's locked playwright-core", async () => {
  // Real resolution, no launch: the CI path depends on this module being in node_modules.
  const { createRequire } = await import("node:module");
  const pkg = createRequire(new URL("./probe-browser.mjs", import.meta.url))("playwright-core/package.json");
  assert.match(pkg.version, /^\d+\.\d+\.\d+/);
});
