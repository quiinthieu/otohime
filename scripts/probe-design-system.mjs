// Drives headless Chromium over Design system's board. Run by scripts/probe-design-system.sh, which installs
// Playwright and axe-core into PW_PREFIX and passes BASE_URL.
//
// Every locator is scoped to the visible root (.notebook:visible). Colours are read as the browser computes
// them, after a turn has had time to land (the 500 ms hot mark and the 150 ms glide), so a check sees the
// resting board, never a frame mid-transition. Timing is proved by the computed transition-duration, not by
// sampling frames: deterministic on a shared runner.
import { createRequire } from "node:module";
import path from "node:path";
import zlib from "node:zlib";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");
const AXE_PATH = require.resolve("axe-core/axe.min.js");

function decodePng(buf) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idats = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    const data = buf.subarray(offset + 8, offset + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") {
      idats.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idats));
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
  const out = Buffer.alloc(width * height * 4);
  let srcOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = decompressed[srcOffset++];
    const prevRow = y > 0 ? (y - 1) * width * 4 : null;
    const curRow = y * width * 4;
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < bpp; c++) {
        let val = decompressed[srcOffset++];
        const left = x > 0 ? out[curRow + (x - 1) * 4 + (c < 3 ? c : 3)] : 0;
        const up = prevRow !== null ? out[prevRow + x * 4 + (c < 3 ? c : 3)] : 0;
        const upLeft = x > 0 && prevRow !== null ? out[prevRow + (x - 1) * 4 + (c < 3 ? c : 3)] : 0;
        if (filter === 1) val = (val + left) & 0xff;
        else if (filter === 2) val = (val + up) & 0xff;
        else if (filter === 3) val = (val + Math.floor((left + up) / 2)) & 0xff;
        else if (filter === 4) {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          const pr = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
          val = (val + pr) & 0xff;
        }
        out[curRow + x * 4 + (c < 3 ? c : 3)] = val;
      }
      if (bpp === 3) out[curRow + x * 4 + 3] = 255;
    }
  }
  return { width, height, data: out };
}

function getPixel(img, x, y) {
  const idx = (y * img.width + x) * 4;
  return [img.data[idx], img.data[idx + 1], img.data[idx + 2]];
}

function pixelMatches(rgb, target, tol = 20) {
  return Math.abs(rgb[0] - target[0]) <= tol && Math.abs(rgb[1] - target[1]) <= tol && Math.abs(rgb[2] - target[2]) <= tol;
}

function fractionMatching(img, target, tol = 20) {
  let matched = 0;
  const total = img.width * img.height;
  for (let i = 0; i < img.data.length; i += 4) {
    if (Math.abs(img.data[i] - target[0]) <= tol && Math.abs(img.data[i + 1] - target[1]) <= tol && Math.abs(img.data[i + 2] - target[2]) <= tol) {
      matched++;
    }
  }
  return total > 0 ? matched / total : 0;
}

const BASE_URL = process.env.BASE_URL;
const URL = `${BASE_URL}/design-system`;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const NARROW = { width: 320, height: 640 };
// The hot mark lasts 500 ms and a glide 150 ms; a turn has landed well inside this.
const LAND_MS = 800;

const START = "Turn a knob and watch what follows.";
const FOLLOWED = "1 knob turned. 9 parts followed.";
const CORAL = "rgb(239, 106, 76)";
const GAZETTE_PAPER = "rgb(243, 238, 227)";

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

async function open(browser, { viewport, reduced = false, scheme = "light", js = true }) {
  const phone = viewport.width < 800;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    reducedMotion: reduced ? "reduce" : "no-preference",
    colorScheme: scheme,
    javaScriptEnabled: js,
  });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto(URL, { waitUntil: "load" });
  return { context, page };
}

const root = (page) => page.locator(".notebook:visible");
const counter = (page) => root(page).locator("output[data-counter]").innerText();
const ruleLine = (page) => root(page).locator("output[data-rule]").innerText();
const label = (page) => root(page).locator("svg.board-svg").getAttribute("aria-label");
const radio = (page, knob, name) => root(page).locator(`input[name="knob-${knob}"][value="${name}"]`);
const noSystem = (page) => root(page).locator('input[role="switch"]');

/** The knobs' fieldset is enabled, read from the page itself; waits up to 15 s for hydration. */
async function hydrated(page) {
  return page
    .waitForFunction(() => document.querySelector(".notebook fieldset[data-knobs]")?.disabled === false, null, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
}

/** The computed style of the svg element matching sel (inside the board), as the browser resolves it. */
const computed = (page, sel, prop) =>
  page.evaluate(([s, p]) => getComputedStyle(document.querySelector(`.notebook svg.board-svg ${s}`))[p], [sel, prop]);
const hrefs = (page) => root(page).locator("svg.board-svg use[data-part]").evaluateAll((els) => els.map((e) => e.getAttribute("href")));

/** Counts the most parts marked data-hot at once from now on. */
async function watchHot(page) {
  await page.evaluate(() => {
    window.__hot = 0;
    const svg = document.querySelector(".notebook svg.board-svg");
    const count = () => (window.__hot = Math.max(window.__hot, svg.querySelectorAll("use[data-hot]").length));
    new MutationObserver(count).observe(svg, { attributes: true, subtree: true, attributeFilter: ["data-hot"] });
  });
}
const hotMax = (page) => page.evaluate(() => window.__hot);

/** Turns a knob (or the switch) and waits for the turn to land. */
async function turn(locator, on = true) {
  if (on) await locator.check();
  else await locator.uncheck();
  await sleep(LAND_MS);
}

async function runAxe(page, name) {
  await page.addScriptTag({ path: AXE_PATH });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target }));
  });
  const bad = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  check(`axe ${name}: no serious or critical violation`, bad.length === 0, JSON.stringify(bad));
}

async function board(browser, viewport, size) {
  const { context, page } = await open(browser, { viewport });
  try {
    check(`${size} the page has one fieldset of knobs`, (await root(page).locator("fieldset[data-knobs]").count()) === 1);
    check(`${size} the knobs wake up after hydration (fieldset.disabled is false)`, await hydrated(page));
    const start = (await label(page)) ?? "";
    check(`${size} the counter starts at "${START}"`, (await counter(page)) === START, await counter(page));
    check(`${size} the board draws nine parts`, (await hrefs(page)).length === 9);

    // Spot coral: one knob, nine parts.
    await watchHot(page);
    await turn(radio(page, "spot", "coral"));
    check(`${size} Spot coral: the counter says "${FOLLOWED}"`, (await counter(page)) === FOLLOWED, await counter(page));
    check(`${size} Spot coral: all nine parts were marked hot`, (await hotMax(page)) === 9, String(await hotMax(page)));
    check(`${size} Spot coral: the hot mark is gone after 500 ms`, (await root(page).locator("svg.board-svg use[data-hot]").count()) === 0);
    const coral = await computed(page, 'use[data-part="button"]', "fill");
    check(`${size} Spot coral: the button's spot computes to ${CORAL}`, coral === CORAL, coral);
    const bar = await computed(page, 'use[data-part="bar"]', "fill");
    check(`${size} Spot coral: so does the bar's, a part nobody touched`, bar === CORAL, bar);
    check(`${size} Spot coral: the drawing's label names coral`, /\bcoral\b/.test((await label(page)) ?? ""), (await label(page)) ?? "none");
    check(`${size} Spot coral: the rule line fails`, /Spot on paper 2\.8 to 1, fails\./.test(await ruleLine(page)), await ruleLine(page));
    const buttonShot = decodePng(await root(page).locator('use[data-part="button"]').screenshot());
    const bPx = getPixel(buttonShot, Math.floor(buttonShot.width * 0.18), Math.floor(buttonShot.height * 0.5));
    check(`${size} Spot coral: the button body centre-left is coral`, pixelMatches(bPx, [239, 106, 76]), `rgb(${bPx.join(", ")})`);
    const noteShot = decodePng(await root(page).locator('use[data-part="note"]').screenshot());
    const noteRatio = fractionMatching(noteShot, [239, 106, 76]);
    check(`${size} Spot coral: at least 0.2% of the note's pixels are coral`, noteRatio >= 0.002, `${(noteRatio * 100).toFixed(2)}%`);

    // No system: a knob moves nothing.
    await turn(noSystem(page));
    check(`${size} No system on: the counter says the parts keep their own values`, (await counter(page)) === "System off: every part keeps its own values.", await counter(page));
    const before = await computed(page, 'use[data-part="button"]', "fill");
    const beforeBar = await computed(page, 'use[data-part="bar"]', "fill");
    await watchHot(page);
    await turn(radio(page, "spot", "mint"));
    const said = await counter(page);
    check(`${size} No system, Spot mint: the counter says 0 parts followed, 9 to fix by hand`, /0 parts followed\. 9 to fix by hand\./.test(said), said);
    check(`${size} No system, Spot mint: no part was marked hot`, (await hotMax(page)) === 0, String(await hotMax(page)));
    const after = await computed(page, 'use[data-part="button"]', "fill");
    const afterBar = await computed(page, 'use[data-part="bar"]', "fill");
    check(`${size} No system, Spot mint: the button's fill is unchanged`, after === before, `${before} -> ${after}`);
    check(`${size} No system, Spot mint: the bar's fill is unchanged`, afterBar === beforeBar, `${beforeBar} -> ${afterBar}`);
    check(`${size} No system: the rule line has no rule to check`, /^No system, so no rule to check/.test(await ruleLine(page)), await ruleLine(page));

    // System back on, Corner round: nine stamps swap.
    await turn(noSystem(page), false);
    check(`${size} No system off: nine parts follow again`, (await counter(page)) === "System on: 9 parts follow the pots again.", await counter(page));
    await turn(radio(page, "corner", "round"));
    const round = await hrefs(page);
    check(`${size} Corner round: all nine <use>s point at a -round stamp`, round.length === 9 && round.every((h) => /^#part-[a-z]+-round$/.test(h ?? "")), round.join(" "));
    check(`${size} Corner round: the counter says "${FOLLOWED}"`, (await counter(page)) === FOLLOWED, await counter(page));

    // The rule: blue fails on night paper, yellow passes.
    await turn(radio(page, "spot", "blue"));
    await turn(radio(page, "paper", "night"));
    const night = await ruleLine(page);
    check(`${size} Paper night, Spot blue: the rule line fails`, /Ink on paper [\d.]+ to 1, passes\. Spot on paper 2\.7 to 1, fails\./.test(night), night);
    await turn(radio(page, "spot", "yellow"));
    const yellow = await ruleLine(page);
    check(`${size} Paper night, Spot yellow: the rule line passes`, /Spot on paper 10\.2 to 1, passes\./.test(yellow) && !/fails/.test(yellow), yellow);
    const yellowButtonShot = decodePng(await root(page).locator('use[data-part="button"]').screenshot());
    const ybPx = getPixel(yellowButtonShot, Math.floor(yellowButtonShot.width * 0.18), Math.floor(yellowButtonShot.height * 0.5));
    check(`${size} Paper night, Spot yellow: the button body centre-left is yellow`, pixelMatches(ybPx, [244, 184, 41]), `rgb(${ybPx.join(", ")})`);

    await turn(radio(page, "paper", "white"));
    const buttonWordWhite = await computed(page, 'text[data-word="button"]', "fill");
    check(`${size} Paper white: the button's word computes to rgb(255, 255, 255)`, buttonWordWhite === "rgb(255, 255, 255)", buttonWordWhite);

    // Dress as the Gazette: its own paper.
    await root(page).locator('button[data-dress="articles"]').click();
    await sleep(LAND_MS);
    const paper = await computed(page, "rect.screen", "fill");
    check(`${size} Dress as Gazette: the board's paper computes to ${GAZETTE_PAPER}`, paper === GAZETTE_PAPER, paper);
    check(`${size} Dress as Gazette: the counter says nine parts followed`, (await counter(page)) === "Dressed as Gazette: 9 parts followed.", await counter(page));

    // Reset: the start.
    await root(page).locator("button[data-reset]").click();
    await sleep(LAND_MS);
    check(`${size} Reset: the counter says "Back to the start."`, (await counter(page)) === "Back to the start.", await counter(page));
    check(`${size} Reset: the drawing's label is the start's`, (await label(page)) === start, `${await label(page)} vs ${start}`);
    check(`${size} Reset: the rule line is the start's`, (await ruleLine(page)) === "Ink on paper 15.5 to 1, passes. Spot on paper 6.2 to 1, passes.", await ruleLine(page));
    check(`${size} Reset: Spot blue is checked again`, await radio(page, "spot", "blue").isChecked());

    // Speed: motion is a decision too.
    const quick = await computed(page, 'use[data-part="card"]', "transitionDuration");
    check(`${size} Speed quick: a part glides over 0.15s`, quick === "0.15s", quick);
    await turn(radio(page, "speed", "still"));
    const still = await computed(page, 'use[data-part="card"]', "transitionDuration");
    check(`${size} Speed still: a part lands at once (0s)`, still === "0s", still);
  } finally {
    await context.close();
  }

  {
    const { context, page } = await open(browser, { viewport, reduced: true });
    try {
      await hydrated(page);
      const d = await computed(page, 'use[data-part="card"]', "transitionDuration");
      check(`${size} under reduced motion a part does not glide (0s)`, d.split(",").every((x) => parseFloat(x) === 0), d);
      const draws = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
      check(`${size} under reduced motion the figures draw nothing on`, draws === 0, `${draws} running`);
    } finally {
      await context.close();
    }
  }
}

async function keyboard(browser, viewport, size) {
  const { context, page } = await open(browser, { viewport });
  try {
    await hydrated(page);
    let reached = false;
    for (let i = 0; i < 80 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => document.activeElement?.matches('.notebook input[name="knob-spot"]') ?? false);
    }
    check(`${size} keyboard: Tab reaches the Spot group`, reached);
    const ring = await page.evaluate(() => getComputedStyle(document.activeElement.closest("label")).outlineStyle);
    check(`${size} keyboard: the focused knob shows a focus ring`, ring !== "none", ring);
    await page.keyboard.press("ArrowRight");
    await sleep(LAND_MS);
    const value = await page.evaluate(() => document.activeElement?.value);
    check(`${size} keyboard: ArrowRight checks the next spot, coral`, value === "coral" && (await radio(page, "spot", "coral").isChecked()), value);
    check(`${size} keyboard: the counter updates`, (await counter(page)) === FOLLOWED, await counter(page));
  } finally {
    await context.close();
  }
}

async function noScript(browser, viewport, size) {
  const { context, page } = await open(browser, { viewport, js: false });
  try {
    check(`${size} JavaScript off: the board draws nine parts`, (await root(page).locator("svg.board-svg use[data-part]").count()) === 9);
    check(`${size} JavaScript off: the knobs are greyed`, await page.evaluate(() => document.querySelector(".notebook fieldset[data-knobs]")?.disabled === true));
    check(`${size} JavaScript off: the counter says the start sentence`, (await counter(page)) === START, await counter(page));
    const coral = await computed(page, 'use[data-part="button"]', "fill");
    check(`${size} JavaScript off: the button is painted in the start blue`, coral === "rgb(36, 86, 179)", coral);
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
    await board(browser, viewport, size);
    await keyboard(browser, viewport, size);
    await noScript(browser, viewport, size);
    for (const scheme of ["light", "dark"]) {
      const { context, page } = await open(browser, { viewport, scheme });
      try {
        await hydrated(page);
        await runAxe(page, `${size} ${scheme} /design-system`);
      } finally {
        await context.close();
      }
    }
  }

  {
    const { context, page } = await open(browser, { viewport: NARROW });
    try {
      await hydrated(page);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth);
      check(`320x640 /design-system does not scroll sideways`, wide <= 320, `${wide} px wide`);
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
