// Drives headless Chromium over the rubber-stamp board on /play. Run by scripts/probe-stamps.sh, which
// installs Playwright into PW_PREFIX and passes BASE_URL.
//
// Everything is read from the page as a user or an assistive technology would meet it: the h1 by role and
// name, the blocks and the board's data-state and data-marks, the chip and Tidy by role. A drag is real input:
// the mouse on the desktop, a CDP touch sequence on the phone (so touch-action on the blocks is exercised).
// requestAnimationFrame is counted by an init script that wraps it before any page script runs.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const SHOTS_DIR = process.env.SHOTS_DIR || "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const WORD = "Play";

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

const errors = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Counts every requestAnimationFrame call on the page.
function countFrames() {
  window.__rafCalls = 0;
  const real = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    window.__rafCalls++;
    return real(cb);
  };
}

async function open(browser, { viewport, reduced = false }) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console ${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  await page.addInitScript(countFrames);
  await page.goto(`${BASE_URL}/play`, { waitUntil: "load" });
  // React has hydrated the chip (its props are on the node)
  await page.waitForFunction(
    () => {
      const chip = document.querySelector(".stamp-chip");
      return chip && Object.keys(chip).some((k) => k.startsWith("__reactProps"));
    },
    null,
    { timeout: 15000 },
  );
  return { context, page };
}

const heading = (page) => page.getByRole("heading", { level: 1, name: WORD, exact: true });
const chip = (page) => page.getByRole("button", { name: "Stamp it", exact: true });
const tidyButton = (page) => page.getByRole("button", { name: "Tidy", exact: true });
const board = (page) => page.locator(".stamp-board");

const boardState = (page) =>
  page.evaluate(() => {
    const el = document.querySelector(".stamp-board");
    if (!el) return null;
    const tray = el.getBoundingClientRect();
    const blocks = [...el.querySelectorAll(".stamp-block")].map((b) => {
      const r = b.getBoundingClientRect();
      return {
        char: b.textContent,
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
        left: r.left - tray.left,
        right: r.right - tray.left,
        top: r.top - tray.top,
        bottom: r.bottom - tray.top,
        touchAction: getComputedStyle(b).touchAction,
        vt: getComputedStyle(b).viewTransitionName,
      };
    });
    return {
      state: el.dataset.state,
      marks: Number(el.dataset.marks),
      width: tray.width,
      height: tray.height,
      blocks,
      rafs: window.__rafCalls,
    };
  });

const headingInk = (page) =>
  page.evaluate(() => {
    const text = document.querySelector(".stamp-text");
    return text ? getComputedStyle(text).color : "missing";
  });

const focused = (page) => page.evaluate(() => document.activeElement?.textContent?.trim() ?? "");
const sideways = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

// Waits for the board to stop moving; the state it ended in, or null past the timeout.
async function settled(page, timeout = 6000) {
  try {
    await page.waitForFunction(() => document.querySelector(".stamp-board")?.dataset.state === "settled", null, { timeout });
    return boardState(page);
  } catch {
    return null;
  }
}

async function gone(page, timeout) {
  try {
    await page.waitForFunction(() => !document.querySelector(".stamp-board"), null, { timeout, polling: "raf" });
    return true;
  } catch {
    return false;
  }
}

async function shot(page, name) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
}

// Drag from (x0, y0) to (x1, y1): the mouse, or a real touch sequence on a touch screen.
async function dragBy(page, touch, [x0, y0], [x1, y1]) {
  const steps = 12;
  if (!touch) {
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
      await sleep(16);
    }
    await sleep(300);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const point = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(x0, y0) });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: point(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps),
    });
    await sleep(16);
  }
  await sleep(300);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

async function motion(browser, viewport) {
  const touch = viewport === PHONE;
  const label = `${viewport.width}x${viewport.height}${touch ? " touch" : ""}`;
  const { context, page } = await open(browser, { viewport });
  try {
    check(`${label}: the h1 resolves by role as "${WORD}" before stamping`, (await heading(page).count()) === 1);
    const ink = await headingInk(page);
    const before = await page.evaluate(() => window.__rafCalls);

    if (touch) await chip(page).tap();
    else await chip(page).click();
    await board(page).waitFor({ state: "attached", timeout: 10000 });
    const first = await boardState(page);
    const chars = first.blocks.map((b) => b.char).join("");
    check(`${label}: Stamp it lays one block per letter of "${WORD}"`, chars === WORD, JSON.stringify(chars));
    check(`${label}: the h1 still resolves by role as "${WORD}" while stamped`, (await heading(page).count()) === 1);
    check(`${label}: the heading's words are hidden in transparent ink`, (await headingInk(page)) === "rgba(0, 0, 0, 0)", await headingInk(page));
    check(`${label}: focus moves to Tidy`, (await focused(page)) === "Tidy", await focused(page));
    check(
      `${label}: touch-action is none on the blocks and no block carries a view-transition name`,
      first.blocks.every((b) => b.touchAction === "none" && b.vt === "none"),
      JSON.stringify(first.blocks.map((b) => [b.touchAction, b.vt])),
    );
    check(`${label}: the blocks start out falling`, first.state === "falling", first.state);

    const rest = await settled(page);
    check(`${label}: the blocks settle`, rest !== null);
    if (!rest) return;
    check(`${label}: the board's frames are counted while it falls (rAF counter control)`, rest.rafs - before > 10, `${rest.rafs - before} calls`);
    const inside = rest.blocks.every((b) => b.left >= -1 && b.top >= -1 && b.right <= rest.width + 1 && b.bottom <= rest.height + 1);
    check(`${label}: every block rests inside the tray`, inside, JSON.stringify(rest.blocks.map((b) => [b.left, b.top, b.right, b.bottom].map(Math.round))));
    const resting = rest.blocks.filter((b) => b.bottom > rest.height - 44 - 60).length;
    check(`${label}: the blocks came down to the floor`, resting === WORD.length, `${resting} near the floor`);
    await shot(page, `${label.replace(/ /g, "-")}-settled`);

    // Negative control: a press that lifts nothing leaves no new mark.
    const target = rest.blocks[1];
    if (touch) await page.touchscreen.tap(target.x, target.y);
    else await page.mouse.click(target.x, target.y);
    const still = await settled(page);
    check(`${label}: a press that lifts nothing adds no mark (negative control)`, still && still.marks === rest.marks, `${rest.marks} -> ${still?.marks}`);

    // A drag up and a release: the block falls and lands, stamping the paper.
    const base = still ?? rest;
    const b0 = base.blocks[0];
    await dragBy(page, touch, [b0.x, b0.y], [b0.x + 40, b0.y - 180]);
    const dropped = await settled(page);
    check(
      `${label}: a drag and release leaves at least one mark more (data-marks ${base.marks} -> ${dropped?.marks})`,
      dropped && dropped.marks >= 1 && dropped.marks > base.marks,
    );
    check(
      `${label}: the dragged block moved`,
      dropped && Math.hypot(dropped.blocks[0].x - b0.x, dropped.blocks[0].y - b0.y) > 8,
      dropped ? `(${Math.round(b0.x)}, ${Math.round(b0.y)}) -> (${Math.round(dropped.blocks[0].x)}, ${Math.round(dropped.blocks[0].y)})` : "",
    );
    const wide = await sideways(page);
    check(`${label}: nothing scrolls sideways`, wide <= 0, `${wide} px over`);
    await shot(page, `${label.replace(/ /g, "-")}-dropped`);

    // The keyboard: Space picks the last block up, arrows carry it, Space drops it.
    const last = page.locator(".stamp-block").last();
    await last.focus();
    await page.keyboard.press(" ");
    const picked = await last.getAttribute("aria-pressed");
    await sleep(400);
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowLeft");
    const marksBefore = Number(await board(page).getAttribute("data-marks"));
    await page.keyboard.press(" ");
    const keyed = await settled(page);
    check(
      `${label}: Space picks a block up and drops it, which stamps`,
      picked === "true" && (await last.getAttribute("aria-pressed")) === "false" && keyed && keyed.marks > marksBefore,
      `${picked}, marks ${marksBefore} -> ${keyed?.marks}`,
    );

    // Tidy: the letters go home, the board goes, the heading shows, focus returns to the chip.
    if (touch) await tidyButton(page).tap();
    else await tidyButton(page).click();
    const tidied = await gone(page, 2000);
    check(`${label}: Tidy removes the board within 2 s`, tidied);
    check(`${label}: the heading's ink is back`, (await headingInk(page)) === ink, `${await headingInk(page)} vs ${ink}`);
    check(`${label}: the h1 resolves as "${WORD}" after tidying`, (await heading(page).count()) === 1);
    check(`${label}: focus returns to the chip`, (await focused(page)) === "Stamp it", await focused(page));
    check(`${label}: the tray is gone`, !(await page.locator(".stamp-heading[data-stamped]").count()));

    // Escape restores too.
    await chip(page).focus();
    await page.keyboard.press("Enter");
    await board(page).waitFor({ state: "attached", timeout: 5000 });
    await sleep(200);
    await page.keyboard.press("Escape");
    check(`${label}: Escape tidies`, await gone(page, 2000));
    check(`${label}: after Escape focus is on the chip`, (await focused(page)) === "Stamp it", await focused(page));

    // The long-press, and a short press that is not one (negative control).
    const box = await heading(page).boundingBox();
    const [hx, hy] = [box.x + box.width - 12, box.y + box.height / 2];
    if (!touch) {
      await page.mouse.move(hx, hy);
      await page.mouse.down();
      await sleep(200);
      await page.mouse.up();
      await sleep(600);
      check(`${label}: a 200 ms press on the heading stamps nothing (negative control)`, (await board(page).count()) === 0);
      await page.mouse.down();
      await sleep(650);
      await page.mouse.up();
    } else {
      const cdp = await page.context().newCDPSession(page);
      const pt = [{ x: hx, y: hy, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
      await sleep(200);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await sleep(600);
      check(`${label}: a 200 ms press on the heading stamps nothing (negative control)`, (await board(page).count()) === 0);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt });
      await sleep(650);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await cdp.detach();
    }
    let pressed = true;
    try {
      await board(page).waitFor({ state: "attached", timeout: 3000 });
    } catch {
      pressed = false;
    }
    check(`${label}: a 500 ms long-press on the heading stamps it`, pressed);
    if (pressed) {
      await tidyButton(page).click();
      check(`${label}: and Tidy puts it back`, await gone(page, 2000));
    }
  } finally {
    await context.close();
  }
}

async function reduced(browser, viewport) {
  const touch = viewport === PHONE;
  const label = `${viewport.width}x${viewport.height} reduced motion`;
  const { context, page } = await open(browser, { viewport, reduced: true });
  try {
    if (touch) await chip(page).tap();
    else await chip(page).click();
    await board(page).waitFor({ state: "attached", timeout: 10000 });
    const first = await boardState(page);
    check(`${label}: data-state is static`, first.state === "static", first.state);
    check(`${label}: one block per letter`, first.blocks.map((b) => b.char).join("") === WORD);
    check(`${label}: the h1 still resolves by role as "${WORD}"`, (await heading(page).count()) === 1);
    check(
      `${label}: the blocks lie in the tray, already down`,
      first.blocks.every((b) => b.left >= -1 && b.right <= first.width + 1 && b.top >= -1 && b.bottom <= first.height - 44 + 1),
    );
    await sleep(1000);
    const a = await boardState(page);
    await sleep(1000);
    const b = await boardState(page);
    check(`${label}: no requestAnimationFrame after the first second`, b.rafs === a.rafs, `${a.rafs} -> ${b.rafs}`);
    check(`${label}: nothing moved meanwhile`, JSON.stringify(a.blocks) === JSON.stringify(b.blocks));

    const b0 = b.blocks[0];
    await dragBy(page, touch, [b0.x, b0.y], [b0.x + 60, b0.y - 50]);
    await sleep(100);
    const c = await boardState(page);
    check(`${label}: a drag and release stamps where it lands (data-marks ${c.marks})`, c.marks >= 1);
    check(`${label}: the block stays where it was put, no falling`, Math.abs(c.blocks[0].y - (b0.y - 50)) < 2, `${b0.y - 50} vs ${c.blocks[0].y}`);
    check(`${label}: still static`, c.state === "static", c.state);
    await sleep(1000);
    check(`${label}: still no requestAnimationFrame after the drag`, (await boardState(page)).rafs === c.rafs);
    await shot(page, `${label.replace(/ /g, "-")}`);

    if (touch) await tidyButton(page).tap();
    else await tidyButton(page).click();
    check(`${label}: Tidy snaps the board away`, await gone(page, 150));
    check(`${label}: focus returns to the chip`, (await focused(page)) === "Stamp it", await focused(page));
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  await motion(browser, DESKTOP);
  await motion(browser, PHONE);
  await reduced(browser, DESKTOP);
  await reduced(browser, PHONE);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
