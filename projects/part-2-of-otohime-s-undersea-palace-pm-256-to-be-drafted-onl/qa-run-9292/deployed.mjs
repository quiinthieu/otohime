// Read-only production dark-state walkthrough. Never configures or opens a ghost socket.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const base = "https://otohime.dev";
const delivery = "308b36202ef8774294596ac9d689016fd64d8d5b";
const health = await (await fetch(base + "/api/health")).json();
assert.equal(health.ok, true);
execFileSync("git", ["merge-base", "--is-ancestor", delivery, health.sha]);
const disabled = await fetch(base + "/api/ghosts");
assert.equal(disabled.status, 404);
assert.match(disabled.headers.get("cache-control"), /no-store/);
assert.equal(await disabled.text(), "");
assert.equal(await (await fetch(base + "/api/ghosts?probe=1")).json(), null);
const html = await (await fetch(base)).text();
assert.ok(html.includes('name="build-sha" content="' + health.sha + '"'));
const nextBuildId = html.match(/\\"b\\":\\"([^"\\]+)/)?.[1] ?? null;
assert.ok(nextBuildId, "served RSC payload identifies its Next build separately");
const browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
const errors = [], sockets = [], rows = [];
try {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 }, reducedMotion: "no-preference" });
  let home;
  for (const room of ["/", "/ryugu"]) {
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("websocket", socket => sockets.push(new URL(socket.url()).pathname));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    assert.equal((await page.goto(base + room)).status(), 200);
    const layer = page.locator("[data-ghosts-state]");
    await layer.waitFor();
    await page.locator('[data-ghosts-state="off"]').waitFor({ timeout: 10000 });
    await page.evaluate(() => new Promise(resolve => requestIdleCallback(() => requestAnimationFrame(resolve))));
    assert.equal(await layer.getAttribute("data-ghosts-state"), "off");
    assert.equal(await layer.getAttribute("data-ghosts"), "0");
    if (room === "/") home = page;
    // Pocket is Home's control; the separate palace root consumes its stored choice.
    const button = home.locator("[data-pocket-ghosts]");
    await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "false");
    await page.reload();
    await button.waitFor();
    assert.equal(await button.getAttribute("aria-pressed"), "false", "hide survives reload");
    assert.equal(await page.evaluate(() => localStorage.getItem("ghosts")), "hidden");
    if (room === "/ryugu") assert.equal(await layer.count(), 0, "hidden palace reload never mounts the canvas");
    await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "true");
    await layer.waitFor();
    await page.locator('[data-ghosts-state="off"]').waitFor({ timeout: 10000 });
    assert.equal(await layer.getAttribute("data-ghosts-state"), "off");
    rows.push({ room, status: 200, state: "off", hideReload: true, reenabledStillDark: true });
    if (room !== "/") await page.close();
  }
  await home.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(sockets, [], "dark production performs no upgrades");
  console.log(JSON.stringify({ deliverySha: delivery, deployedSha: health.sha, nextBuildId,
    buildIdSource: "independent served RSC payload", chrome: browser.version(), rows, errors, sockets,
    boundary: "read-only real production; no config override/fake; hosted active fan-out deliberately unproven" }, null, 2));
} finally { await browser.close(); }
