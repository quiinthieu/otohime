// Independent QA walkthrough. Browser binaries/screenshots remain outside git.
// PW_PREFIX=/tmp/pw BASE_URL=http://localhost:4091 QA_OUT=/tmp/qa node <this file>
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire(path.resolve(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");
const base = process.env.BASE_URL;
assert(base, "BASE_URL required");
const out = process.env.QA_OUT;
assert(out, "QA_OUT must be outside the repository");
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const evidence = { browser: browser.version(), base, observations: [], errors: [] };
const record = (action, result) => {
  evidence.observations.push({ action, result });
  console.log(JSON.stringify({ action, result }));
};
const sequence = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
const visibleFooter = (p) => p.locator("footer.end").filter({ visible: true });
async function enter(p) {
  await visibleFooter(p).scrollIntoViewIfNeeded();
  await p.waitForFunction(() => [...document.querySelectorAll("footer.end")].some(f => f.checkVisibility() && f.dataset.seen === "true"));
  await p.waitForTimeout(900);
}
async function snapshot(p) {
  return p.evaluate(() => {
    const f = [...document.querySelectorAll("footer.end")].find(f => f.checkVisibility());
    const main = [...document.querySelectorAll("main#main")].find(m => m.checkVisibility());
    const rect = f.getBoundingClientRect();
    return {
      sha: document.querySelector('meta[name="build-sha"]').content,
      visibleFooters: [...document.querySelectorAll("footer.end")].filter(f => f.checkVisibility()).length,
      belowMain: rect.top >= main.getBoundingClientRect().bottom,
      overflow: document.documentElement.scrollWidth > innerWidth,
      hrefs: [...f.querySelectorAll("[data-end-page]")].map(a => a.getAttribute("href")),
      readout: f.querySelector("[data-end-readout]").textContent,
      unlocked: f.querySelector("[data-end-stage]").dataset.unlocked,
      active: f.querySelector("[data-end-stage]").dataset.active ?? null,
      pupils: f.querySelector("[data-end-pupils]").style.transform,
      figure: f.querySelector("[data-end-stage]").style.getPropertyValue("--fig"),
      bg: getComputedStyle(document.body).backgroundColor,
      height: rect.height,
    };
  });
}
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => evidence.errors.push(e.message));
  await page.goto(base + "/");
  await enter(page);
  await page.screenshot({ path: path.join(out, "home-light.png"), fullPage: true });
  for (const dest of ["/work", "/projects"]) {
    const before = await snapshot(page);
    assert.equal(before.visibleFooters, 1);
    assert.deepEqual(before.hrefs, ["/work", "/play", "/notes", "/music", "/projects", "/sketches"]);
    await visibleFooter(page).locator(`[data-end-page="${dest}"]`).click();
    await page.waitForURL(base + dest);
    await enter(page);
    const after = await snapshot(page);
    assert.equal(after.visibleFooters, 1);
    assert(after.belowMain && !after.overflow);
    record(`footer link ${new URL(page.url()).pathname}`, { before, after });
    await page.screenshot({ path: path.join(out, `${dest.slice(1)}-light.png`), fullPage: true });
  }

  // A real focused textarea is the independent negative control. This is a
  // local DOM fixture, and does not change server content or application code.
  await visibleFooter(page).evaluate(f => {
    const input = document.createElement("textarea");
    input.id = "qa-editable";
    input.setAttribute("aria-label", "QA local editable fixture");
    f.prepend(input);
  });
  await page.locator("#qa-editable").focus();
  for (const key of sequence) await page.keyboard.press(key);
  const excluded = await snapshot(page);
  assert.equal(excluded.unlocked, "false");
  assert((await page.locator("#qa-editable").inputValue()).endsWith("ba"));
  record("negative control: actual keyboard sequence in focused textarea", excluded);
  await page.locator("#qa-editable").evaluate(e => e.remove());
  await enter(page);
  await visibleFooter(page).locator("[data-end-mascot]").focus();
  await page.keyboard.press("x");
  for (const key of sequence) await page.keyboard.press(key);
  await page.waitForFunction(() => [...document.querySelectorAll("[data-end-stage]")].some(e => e.checkVisibility() && e.dataset.unlocked === "true"));
  assert.equal(new URL(page.url()).pathname, "/projects");
  assert.equal(await page.evaluate(() => localStorage.getItem("end:achievement")), "1");
  record("positive control: in-view mascot focus, sequence unlocks without navigation", await snapshot(page));
  await page.reload();
  await enter(page);
  assert.equal((await snapshot(page)).unlocked, "true");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  const reduced = await snapshot(page);
  assert.equal(reduced.active, null);
  assert.equal(reduced.pupils, "translate(0px, 0px)");
  record("restored achievement and live reduced-motion preference", reduced);
  await visibleFooter(page).locator("[data-end-top]").click();
  await page.waitForFunction(() => scrollY <= 4 && document.activeElement?.id === "main");
  record("Back to top", await page.evaluate(() => ({ scrollY, focus: document.activeElement.id })));
  await ctx.close();

  // Independently check the cross product omitted by the author's separate
  // theme and swatch loops: 3 viewports x 2 themes x 5 accent selections.
  for (const [name, viewport, touch] of [
    ["desktop", { width: 1366, height: 768 }, false],
    ["tablet", { width: 768, height: 1024 }, false],
    ["mobile", { width: 390, height: 844 }, true],
  ]) {
    for (const scheme of ["light", "dark"]) {
      const ctx = await browser.newContext({ viewport, hasTouch: touch, isMobile: touch, colorScheme: scheme });
      const page = await ctx.newPage();
      page.on("pageerror", e => evidence.errors.push(e.message));
      await page.goto(base + "/music");
      await enter(page);
      const footer = visibleFooter(page);
      if (touch) {
        await footer.locator("summary").focus();
        await page.keyboard.press("Enter");
        assert(await footer.locator("details").evaluate(d => d.open));
      }
      for (const accent of ["yellow", "coral", "mint", "blue", "pink"]) {
        await footer.locator(`input[type="radio"][value="${accent}"]`).check({ force: true });
        const state = await snapshot(page);
        assert(state.belowMain && !state.overflow && state.visibleFooters === 1);
        record(`${name} ${scheme} ${accent}`, state);
      }
      if (touch) {
        await footer.locator("[data-end-mascot]").tap();
        await page.waitForTimeout(250);
        const state = await snapshot(page);
        assert.equal(state.pupils, "translate(0px, 0px)");
        assert.equal(await footer.locator('[data-lcd-line="0"]').textContent(), "HI");
        assert.equal(await footer.locator('[data-lcd-line="1"]').textContent(), "THERE");
        record("mobile tap", state);
      }
      await page.screenshot({ path: path.join(out, `${name}-${scheme}.png`), fullPage: true });
      await ctx.close();
    }
  }
  assert.deepEqual(evidence.errors, []);
} finally {
  await writeFile(path.join(out, "independent.json"), JSON.stringify(evidence, null, 2));
  await browser.close();
}
