// Node-only smoke for the 404 lost sheet model: replays a fixed stroke list
// through lib/lost.ts and asserts the crumple level after each stroke. Then, run
// by scripts/probe-lost.sh, the same 404 in headless Chromium (below).
// Run with --experimental-strip-types so the .ts import resolves.
import assert from "node:assert/strict";
import {
  applyStroke,
  createLostSheet,
  crumpleLevel,
  isSmoothed,
  SMOOTH_DISTANCE,
} from "../lib/lost.ts";

assert.equal(SMOOTH_DISTANCE, 1600, "fixture lengths assume SMOOTH_DISTANCE=1600");

// [stroke, crumple level expected after it]
const STROKES = [
  [[], 1],
  [[{ x: 20, y: 20 }], 1],
  [[{ x: 0, y: 0 }, { x: 400, y: 0 }], 0.75],
  [[{ x: 0, y: 0 }, { x: 300, y: 400 }], 0.4375],
  [[{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 0 }], 0.1875],
  [[{ x: 10, y: 10 }, { x: 10, y: 10 }], 0.1875],
  [[{ x: 0, y: 0 }, { x: 0, y: 900 }], 0],
  [[{ x: 0, y: 0 }, { x: 50, y: 0 }], 0],
];

let sheet = createLostSheet();
assert.equal(crumpleLevel(sheet), 1);
STROKES.forEach(([stroke, want], i) => {
  sheet = applyStroke(sheet, stroke);
  const got = crumpleLevel(sheet);
  assert.ok(Math.abs(got - want) < 1e-9, `stroke ${i}: crumple ${got}, want ${want}`);
  assert.equal(isSmoothed(sheet), want === 0, `stroke ${i}: isSmoothed`);
});

console.log(`probe-lost: ok ${STROKES.length} strokes, crumple ${crumpleLevel(sheet)}`);

// The browser half, run by scripts/probe-lost.sh: it installs Playwright into PW_PREFIX and passes BASE_URL (and
// EXPECT_SHA, checked if set). Without PW_PREFIX (npm test, through lib/lost.test.ts) only the smoke above runs.
// The page's state is read from the sheet's data-progress, --crumple and the filter's scale, never set.
if (process.env.PW_PREFIX) {
  const { createRequire } = await import("node:module");
  const path = await import("node:path");
  const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
  const { chromium } = require("playwright");

  const BASE_URL = process.env.BASE_URL;
  const EXPECT_SHA = process.env.EXPECT_SHA ?? "";
  const LOST = "/no-such-page-here";
  const DESKTOP = { width: 1366, height: 768 };
  const PHONE = { width: 390, height: 844 };
  const WAYS = [
    ["/", "Go home"],
    ["/work", "Work"],
    ["/projects", "Projects"],
    ["/notes", "Notes"],
    ["/play", "Play"],
  ];
  const SHEET = "#lost-sheet";
  const BUTTON = 'button:has-text("Smooth it out")';

  let ok = 0;
  let failed = 0;
  const check = (name, pass, detail = "") => {
    if (pass) {
      ok++;
      console.log(`ok - ${name}`);
    } else {
      failed++;
      console.log(`not ok - ${name}${detail ? `: ${detail}` : ""}`);
    }
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // The 404 document's own load is logged as a failed resource; anything else is an error.
  const errors = [];
  const expected = (e) => /Failed to load resource: the server responded with a status of 404/.test(e) && e.includes(LOST);

  async function open(browser, { viewport = DESKTOP, js = true, reduced = false } = {}) {
    const phone = viewport === PHONE;
    const context = await browser.newContext({
      viewport,
      isMobile: phone,
      hasTouch: phone,
      javaScriptEnabled: js,
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    const page = await context.newPage();
    page.on("console", (m) => {
      const text = `console ${page.url()}: ${m.text()} (${m.location().url})`;
      if (m.type() === "error" && !expected(text)) errors.push(text);
    });
    page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
    const response = await page.goto(BASE_URL + LOST, { waitUntil: "load" });
    return { context, page, response };
  }

  const read = (page) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const map = el?.querySelector("feDisplacementMap");
      const crumpled = el?.querySelector(".lost-crumpled");
      const crease = el?.querySelector(".lost-crease");
      return {
        sheet: !!el,
        progress: el?.dataset.progress === undefined ? null : Number(el.dataset.progress),
        crumple: el ? getComputedStyle(el).getPropertyValue("--crumple").trim() : null,
        scale: map ? Number(map.getAttribute("scale")) : null,
        smoothed: !!el?.hasAttribute("data-smoothed"),
        filter: crumpled ? getComputedStyle(crumpled).filter : null,
        crease: crease ? getComputedStyle(crease).display : null,
        touch: el ? getComputedStyle(el).touchAction : null,
        status: document.querySelector(".lost-tools [role=status]")?.textContent ?? null,
      };
    }, SHEET);

  // The five ways back: visible, server anchors, with their hrefs, and not covered by the sheet.
  const ways = (page) =>
    page.evaluate((list) => {
      const nav = document.querySelector('nav[aria-label="Ways back"]');
      return list.map(([href, label]) => {
        const a = [...(nav?.querySelectorAll("a") ?? [])].find((x) => x.getAttribute("href") === href);
        if (!a) return { href, label, found: false };
        const r = a.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { href, label, found: true, text: a.textContent.trim(), visible: r.width > 0 && r.height > 0, onTop: a === top || a.contains(top) };
      });
    }, WAYS);

  // A back-and-forth rub across the sheet with the left button held, in real pointer events.
  async function rub(page, strokes) {
    const box = await page.locator(SHEET).boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 20, y);
    await page.mouse.down();
    for (let i = 0; i < strokes; i++) {
      const [a, b] = i % 2 ? [box.x + box.width - 20, box.x + 20] : [box.x + 20, box.x + box.width - 20];
      await page.mouse.move(a, y, { steps: 1 });
      await page.mouse.move(b, y + (i % 3) * 4, { steps: 12 });
    }
    await page.mouse.up();
  }

  const browser = await chromium.launch();
  try {
    // The raw document, as a crawler or curl gets it.
    {
      const res = await fetch(BASE_URL + LOST);
      const html = await res.text();
      check("GET of an unknown path answers 404", res.status === 404, String(res.status));
      check("the server HTML draws the torn sheet with the crumple filter", /id="lost-sheet"/.test(html) && /class="lost-torn"/.test(html) && /<feTurbulence/.test(html) && /<feDisplacementMap/.test(html) && /filter="url\(#lost-crumple\)"/.test(html));
      check("the server HTML carries the hop opt-in in its head", /<head>[\s\S]*@view-transition\{navigation:auto;types:hop\}[\s\S]*<\/head>/.test(html));
      const anchors = WAYS.filter(([href, label]) => new RegExp(`<a[^>]*href="${href}"[^>]*>${label}</a>`).test(html)).length;
      check("the server HTML has plain anchors for Home, Work, Projects, Notes and Play", anchors === WAYS.length, `${anchors}/${WAYS.length}`);
      check("the server HTML has no rub button", !/Smooth it out/.test(html));
      if (EXPECT_SHA) {
        const sha = html.match(/<meta name="build-sha" content="([^"]*)"/)?.[1] ?? "none";
        check(`build-sha is ${EXPECT_SHA}`, sha === EXPECT_SHA, sha);
      }
    }

    // JavaScript off: the crumpled sheet, the links, and each one goes where it says.
    {
      const { context, page, response } = await open(browser, { js: false });
      try {
        check("no-JS: the page answers 404", response?.status() === 404, String(response?.status()));
        const s = await read(page);
        check("no-JS: the sheet is crumpled (filter on, creases shown, no progress)", s.sheet && s.filter !== "none" && s.crease !== "none" && s.progress === null && s.scale === 14, JSON.stringify(s));
        check("no-JS: no rub button", (await page.locator(BUTTON).count()) === 0);
        const w = await ways(page);
        check("no-JS: all five links are visible and on top", w.every((x) => x.found && x.visible && x.onTop && x.text === x.label), JSON.stringify(w));
        for (const [href, label] of WAYS) {
          await page.goto(BASE_URL + LOST, { waitUntil: "load" });
          try {
            const link = page.locator(`nav[aria-label="Ways back"] a[href="${href}"]`);
            await Promise.all([page.waitForURL((u) => u.pathname === href, { timeout: 10_000 }), link.click({ timeout: 5000 })]);
            check(`no-JS: ${label} navigates to ${href}`, new URL(page.url()).pathname === href, page.url());
          } catch (e) {
            check(`no-JS: ${label} navigates to ${href}`, false, e.message.split("\n")[0]);
          }
        }
      } finally {
        await context.close();
      }
    }

    // JavaScript, pointer: a hover rubs nothing, held strokes smooth it to 1, the links stay on top.
    {
      const { context, page } = await open(browser);
      try {
        await page.locator(BUTTON).waitFor({ timeout: 15000 });
        let s = await read(page);
        check("JS: the island is live on a crumpled sheet (progress 0, --crumple 1)", s.progress === 0 && s.crumple === "1" && s.scale === 14 && s.touch === "none", JSON.stringify(s));
        const anims = await page.evaluate((sel) => document.querySelector(sel).getAnimations({ subtree: true }).filter((a) => a.playState === "running").length, SHEET);
        check("positive control: with motion welcome the crumpled sheet flutters", anims > 0, String(anims));
        // negative control: moving over the sheet without a press
        const box = await page.locator(SHEET).boundingBox();
        await page.mouse.move(box.x + 10, box.y + box.height / 2);
        await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2, { steps: 20 });
        await page.mouse.move(box.x + 10, box.y + box.height / 3, { steps: 20 });
        s = await read(page);
        check("negative control: a hover without a press leaves progress at 0", s.progress === 0, JSON.stringify(s));
        await rub(page, 2);
        const mid = await read(page);
        check("JS: two strokes smooth it part way", mid.progress > 0 && mid.progress < 1 && Number(mid.crumple) > 0 && mid.scale < 14 && !mid.smoothed, JSON.stringify(mid));
        let strokes = 2;
        while ((await read(page)).progress < 1 && strokes < 40) {
          await rub(page, 2);
          strokes += 2;
        }
        s = await read(page);
        check(`JS: rubbing smooths the sheet to progress 1 (${strokes} strokes)`, s.progress === 1 && s.crumple === "0" && s.scale === 0 && s.smoothed && s.filter === "none", JSON.stringify(s));
        check("JS: the status says it is flat", s.status === "Flat again. Pick a way back.", s.status);
        await sleep(400);
        const still = await page.evaluate((sel) => document.querySelector(sel).getAnimations({ subtree: true }).filter((a) => a.playState === "running" && a.animationName === "lost-flutter").length, SHEET);
        check("JS: a smooth sheet stops fluttering", still === 0, String(still));
        const w = await ways(page);
        check("JS: all five links are visible and on top after the rub", w.every((x) => x.found && x.visible && x.onTop), JSON.stringify(w));
        // Tab from the top of the document reaches each link
        await page.evaluate(() => document.activeElement?.blur());
        const reached = new Set();
        for (let i = 0; i < 20 && reached.size < WAYS.length; i++) {
          await page.keyboard.press("Tab");
          const href = await page.evaluate(() => document.activeElement?.closest('nav[aria-label="Ways back"]') && document.activeElement.getAttribute("href"));
          if (href) reached.add(href);
        }
        check("JS: Tab reaches all five links", reached.size === WAYS.length, [...reached].join(","));
        const work = page.locator('nav[aria-label="Ways back"] a[href="/work"]');
        await work.focus();
        await Promise.all([page.waitForURL((u) => u.pathname === "/work", { timeout: 10_000 }), page.keyboard.press("Enter")]);
        check("JS: Enter on the focused Work link goes to /work", new URL(page.url()).pathname === "/work", page.url());
      } finally {
        await context.close();
      }
    }

    // JavaScript, keyboard: the button does the same step, five presses to flat, focus kept.
    {
      const { context, page } = await open(browser);
      try {
        const button = page.locator(BUTTON);
        await button.waitFor({ timeout: 15000 });
        await button.focus();
        const seen = [];
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press(i % 2 ? "Space" : "Enter");
          seen.push((await read(page)).progress);
        }
        check("keyboard: five presses of Smooth it out step 0.2 to 1", seen.every((p, i) => Math.abs(p - (i + 1) / 5) < 1e-9), seen.join(","));
        const focus = await page.evaluate(() => document.activeElement?.textContent?.trim());
        check("keyboard: focus stays on the button when the sheet is flat", focus === "Smooth it out", String(focus));
        await page.keyboard.press("Enter");
        check("keyboard: a sixth press keeps it at 1", (await read(page)).progress === 1);
      } finally {
        await context.close();
      }
    }

    // Reduced motion: no island, a flat sheet, nothing running.
    {
      const { context, page } = await open(browser, { reduced: true });
      try {
        await page.waitForFunction(() => document.readyState === "complete");
        await sleep(1200);
        const s = await read(page);
        check("reduced motion: the island is not mounted (no button, no progress, page scrolls)", (await page.locator(BUTTON).count()) === 0 && s.progress === null && s.touch !== "none", JSON.stringify(s));
        const flat = await page.evaluate((sel) => {
          const pageG = document.querySelector(`${sel} .lost-page`);
          const cs = getComputedStyle(pageG);
          return { rotate: cs.rotate, scale: cs.scale, animation: cs.animationName };
        }, SHEET);
        check("reduced motion: the sheet is flat (no filter, no creases, no tilt)", s.filter === "none" && s.crease === "none" && flat.rotate === "none" && flat.scale === "none", JSON.stringify({ ...s, ...flat }));
        check("reduced motion: animation: none on the sheet", flat.animation === "none", flat.animation);
        const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").map((a) => a.animationName ?? a.constructor.name));
        check("reduced motion: no running animation on the page", running.length === 0, running.join(","));
        const w = await ways(page);
        check("reduced motion: all five links are visible and on top", w.every((x) => x.found && x.visible && x.onTop), JSON.stringify(w));
      } finally {
        await context.close();
      }
    }

    // A phone: the sheet and the links fit.
    {
      const { context, page } = await open(browser, { viewport: PHONE });
      try {
        await page.locator(BUTTON).waitFor({ timeout: 15000 });
        const fit = await page.evaluate(() => ({
          overflow: document.documentElement.scrollWidth - innerWidth,
          links: [...document.querySelectorAll('nav[aria-label="Ways back"] a')].every((a) => {
            const r = a.getBoundingClientRect();
            return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 0.5;
          }),
        }));
        check("390x844: no horizontal overflow and every link on screen", fit.overflow <= 0 && fit.links, JSON.stringify(fit));
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
}
