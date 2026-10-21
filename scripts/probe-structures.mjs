// Drives headless Chromium over Structures' machines. Run by scripts/probe-structures.sh, which installs
// Playwright and axe-core into PW_PREFIX and passes BASE_URL.
//
// Every locator is scoped to the visible root: on a soft navigation Next keeps the previous page's root in the
// DOM, hidden, so an unscoped count would see both. A move is "done" once no move button is aria-disabled.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");
const AXE_PATH = require.resolve("axe-core/axe.min.js");

const BASE_URL = process.env.BASE_URL;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const NARROW = { width: 320, height: 640 };

let ok = 0;
let failed = 0;
function check(name, pass, detail = "") {
  if (pass) {
    ok++;
    console.log(`ok - ${name}`);
  } else {
    failed++;
    console.log(`not ok - ${name}${detail ? `: ${detail}` : ""}`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errors = [];

async function open(browser, { viewport, reduced = false, scheme = "light", url }) {
  const phone = viewport.width < 800;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: reduced ? "reduce" : "no-preference",
    colorScheme: scheme,
  });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: "load" });
  return { context, page };
}

const root = (page) => page.locator(".notebook:visible");
const narration = (page) => root(page).locator("output.narration");
const drawingLabel = (page) => root(page).locator("svg.machine-svg").getAttribute("aria-label");
const traceItems = (page) => root(page).locator("ol[data-trace] li").allInnerTexts();
const moveButton = (page, id) => root(page).locator(`button[data-move="${id}"]`);
const numberBox = (page) => root(page).locator('input[name="number"]');

/** Waits for the island to wake the controls up. */
async function hydrated(page) {
  await root(page).locator("fieldset[data-controls]:not([disabled])").waitFor({ timeout: 15000 });
}

/** Waits until no move is playing, then a frame more for the glide. */
async function settled(page, timeout = 15000) {
  await page.waitForFunction(() => !document.querySelector(".notebook button[data-move][aria-disabled]"), null, { timeout });
  await sleep(250);
}

/** Types a number into the box and presses a move, then waits for it to play out. */
async function move(page, id, value) {
  if (value !== undefined) await numberBox(page).fill(String(value));
  await moveButton(page, id).click();
  await settled(page);
}

/** Watches the narration from the next click: the ms from the press until it says `text`. */
async function armTimer(page, text) {
  await page.evaluate((want) => {
    window.__said = null;
    window.__pressed = null;
    document.addEventListener("click", () => (window.__pressed ??= performance.now()), { capture: true, once: true });
    const out = [...document.querySelectorAll("output.narration")].find((o) => o.offsetParent !== null);
    new MutationObserver((_, obs) => {
      if (out.textContent === want && window.__pressed !== null) {
        window.__said = performance.now();
        obs.disconnect();
      }
    }).observe(out, { childList: true, characterData: true, subtree: true });
  }, text);
}
const elapsed = (page) => page.evaluate(() => (window.__said !== null && window.__pressed !== null ? window.__said - window.__pressed : null));

async function runAxe(page, label) {
  await page.addScriptTag({ path: AXE_PATH });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target }));
  });
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  check(`axe ${label}: no serious or critical violation`, bad.length === 0, JSON.stringify(bad));
}

async function stack(browser, viewport, size) {
  const { context, page } = await open(browser, { viewport, url: `${BASE_URL}/structures/stack` });
  try {
    check(`${size} /structures/stack: the page has one fieldset of controls`, await root(page).locator("fieldset[data-controls]").count() === 1);
    await hydrated(page);
    check(`${size} /structures/stack: the controls wake up after hydration`, true);
    const start = await drawingLabel(page);
    check(`${size} /structures/stack: the drawing starts at the example's end, 1 7 2`, /1, 7 and 2, with 2 on top\.$/.test(start ?? ""), start ?? "none");

    await move(page, "push", 9);
    const said = await narration(page).innerText();
    check(`${size} Push 9: the narration says "9 goes on top."`, said === "9 goes on top.", said);
    const pushed = (await drawingLabel(page)) ?? "";
    check(`${size} Push 9: the drawing's label ends with 9 on top`, /with 9 on top\.$/.test(pushed), pushed);
    check(`${size} Push 9: the count says 1 step`, (await root(page).locator(".count").innerText()).includes("1 step"));

    await move(page, "pop");
    const beats = await traceItems(page);
    check(`${size} Pop: the trace lists its two beats`, beats.length === 2 && beats[0] === "Take 9 off the top." && /^9 comes off/.test(beats[1]), JSON.stringify(beats));
    const popped = (await drawingLabel(page)) ?? "";
    check(`${size} Pop: the drawing no longer has 9`, !/\b9\b/.test(popped), popped);

    for (const v of [3, 4, 5, 6]) await move(page, "push", v);
    const full = (await drawingLabel(page)) ?? "";
    check(`${size} four pushes fill the pile to 7 plates`, full.startsWith("A pile of 7 plates"), full);
    await move(page, "push", 8);
    const refused = await narration(page).innerText();
    check(`${size} one more push is refused: the pile is full`, /is full/.test(refused), refused);
    check(`${size} the refusal leaves the drawing as it was`, (await drawingLabel(page)) === full, (await drawingLabel(page)) ?? "none");
    check(`${size} the refusal is one beat`, (await traceItems(page)).length === 1);
  } finally {
    await context.close();
  }
}

async function tree(browser, viewport, size) {
  const url = `${BASE_URL}/structures/binary-search-tree`;
  {
    const { context, page } = await open(browser, { viewport, url });
    try {
      await hydrated(page);
      const example = await root(page).locator("svg.machine-svg text.stamp-text").evaluateAll((els) => els.map((e) => e.textContent));
      await numberBox(page).fill("6");
      await armTimer(page, "Found 6 in 3 steps.");
      await moveButton(page, "find").click();
      await settled(page);
      const ms = await elapsed(page);
      check(`${size} Find 6 says "Found 6 in 3 steps."`, (await narration(page).innerText()) === "Found 6 in 3 steps.", await narration(page).innerText());
      check(`${size} with motion, it plays in beats: the last sentence comes >= 1000 ms after the press`, ms !== null && ms >= 1000, `${ms === null ? "never" : Math.round(ms)} ms`);
      check(`${size} Find 6 lists its four beats`, (await traceItems(page)).length === 4);

      // Step mode: each Next step shows one more beat.
      await root(page).locator('button[data-mode="step"]').click();
      await moveButton(page, "find").click();
      const first = await narration(page).innerText();
      const seen = [];
      for (let i = 0; i < 3; i++) {
        await root(page).locator("button[data-next]").click();
        await sleep(80);
        seen.push({ said: await narration(page).innerText(), items: (await traceItems(page)).length });
      }
      const all = await traceItems(page);
      check(`${size} Step mode: the move waits on its first beat`, first === "6 is less than 8, so go left.", first);
      check(
        `${size} Step mode: three Next step presses show the next three beats in order`,
        seen.map((s) => s.said).join(" | ") === all.slice(1).join(" | ") && seen.map((s) => s.items).join(",") === "2,3,4",
        JSON.stringify(seen),
      );
      await root(page).locator('button[data-mode="play"]').click();

      await moveButton(page, "line").click();
      await settled(page);
      const nodes = await root(page)
        .locator("svg.machine-svg use[data-stamp]")
        .evaluateAll((els) => els.map((e) => ({ id: e.dataset.stamp, y: e.getBoundingClientRect().y })));
      const byValue = [...nodes].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
      check(
        `${size} "Insert 1, 2, 3, 4, 5" draws five nodes at strictly increasing depth`,
        nodes.length === 5 && byValue.every((n, i) => i === 0 || n.y > byValue[i - 1].y),
        JSON.stringify(byValue),
      );

      await root(page).locator("button[data-reset]").click();
      await sleep(300);
      const back = await root(page).locator("svg.machine-svg text.stamp-text").evaluateAll((els) => els.map((e) => e.textContent));
      check(`${size} Reset brings back the worked example's tree`, back.join(" ") === example.join(" ") && back.join(" ") === "1 3 6 8 10 14", back.join(" "));
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await open(browser, { viewport, reduced: true, url });
    try {
      await hydrated(page);
      await numberBox(page).fill("6");
      await armTimer(page, "Found 6 in 3 steps.");
      await moveButton(page, "find").click();
      await page.waitForFunction(() => window.__said !== null, null, { timeout: 5000 }).catch(() => {});
      const ms = await elapsed(page);
      check(`${size} under reduced motion Find 6 lands at once: within 250 ms`, ms !== null && ms <= 250, `${ms === null ? "never" : Math.round(ms)} ms`);
      const glides = await page.evaluate(() => getComputedStyle(document.querySelector(".notebook svg.machine-svg use")).transitionDuration);
      check(`${size} under reduced motion the stamps do not glide`, glides.split(",").every((d) => parseFloat(d) === 0), glides);
    } finally {
      await context.close();
    }
  }
}

async function keyboard(browser, viewport, size) {
  const { context, page } = await open(browser, { viewport, url: `${BASE_URL}/structures/stack` });
  try {
    await hydrated(page);
    let reached = false;
    for (let i = 0; i < 60 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => document.activeElement?.matches('.notebook input[name="number"]') ?? false);
    }
    check(`${size} keyboard: Tab reaches the number box`, reached);
    await page.keyboard.type("4");
    await page.keyboard.press("Enter");
    await settled(page);
    const said = await narration(page).innerText();
    check(`${size} keyboard: 4 and Enter run the default move, Push`, said === "4 goes on top.", said);
    const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
    check(`${size} keyboard: the focused box shows a focus ring`, ring !== "none", ring);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  for (const [viewport, size] of [
    [PHONE, "390x844"],
    [DESKTOP, "1366x768"],
  ]) {
    await stack(browser, viewport, size);
    await tree(browser, viewport, size);
    await keyboard(browser, viewport, size);
    for (const scheme of ["light", "dark"]) {
      for (const p of ["/structures", "/structures/heap"]) {
        const { context, page } = await open(browser, { viewport, scheme, url: `${BASE_URL}${p}` });
        try {
          if (p !== "/structures") await hydrated(page);
          await runAxe(page, `${size} ${scheme} ${p}`);
        } finally {
          await context.close();
        }
      }
    }
  }

  for (const p of ["/structures", "/structures/array", "/structures/hash-table", "/structures/heap", "/structures/graph"]) {
    const { context, page } = await open(browser, { viewport: NARROW, url: `${BASE_URL}${p}` });
    try {
      const wide = await page.evaluate(() => document.documentElement.scrollWidth);
      check(`320x640 ${p} does not scroll sideways`, wide <= 320, `${wide} px wide`);
    } finally {
      await context.close();
    }
  }

  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
