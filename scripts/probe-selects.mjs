// Drives headless Chromium over the three dropdown pickers. Run by scripts/probe-selects.sh,
// which installs Playwright into PW_PREFIX and passes BASE_URL, SWATCH_KEYS and ARTIFACTS_DIR.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const SWATCH_KEYS = process.env.SWATCH_KEYS.split(",");
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR;

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

const isOpen = (sel) => sel.evaluate((el) => el.matches(":open"));
const height = (loc) => loc.evaluate((el) => el.getBoundingClientRect().height);
const pickerBackground = (sel) => sel.evaluate((el) => getComputedStyle(el, "::picker(select)").backgroundColor);

async function probeSelect({ page, label, select, input, picker, checkedBackground, shot }) {
  const appearance = await select.evaluate((el) => getComputedStyle(el).appearance);
  check(`${label}: computed appearance is base-select`, appearance === "base-select", appearance);

  await select.click();
  await page.waitForTimeout(150);
  check(`${label}: click opens the picker`, await isOpen(select));
  check(`${label}: picker background is ${picker}`, (await pickerBackground(select)) === picker, await pickerBackground(select));

  if (checkedBackground) {
    const bg = await select.evaluate((el) => getComputedStyle(el.querySelector("option:checked")).backgroundColor);
    check(`${label}: checked option background is ${checkedBackground}`, bg === checkedBackground, bg);
  }

  const file = path.join(ARTIFACTS_DIR, shot);
  await page.screenshot({ path: file });
  console.log(`screenshot: ${file}`);

  const before = await select.inputValue();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const after = await select.inputValue();
  check(`${label}: ArrowDown+Enter changes the value`, after !== before, `${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
  check(`${label}: ArrowDown+Enter closes the picker`, !(await isOpen(select)));

  const sh = await height(select);
  const ih = await height(input);
  check(`${label}: closed height ${sh} matches the input's ${ih} within 1px`, Math.abs(sh - ih) <= 1);
}

async function probeVinylKeys(browser, viewport) {
  const tag = `/vinyl keys ${viewport.width}x${viewport.height}`;
  const page = await browser.newPage({ viewport });
  const genre = page.locator(".crate-filters select");
  const deck = page.locator(".deck");
  const state = async () => ({
    phase: await deck.getAttribute("data-phase"),
    record: await page.locator('.turntable svg[role="group"]').first().getAttribute("aria-label"),
  });
  const same = (a, b) => a.phase === b.phase && a.record === b.record;
  const round = async () => {
    await page.goto(`${BASE_URL}/vinyl`, { waitUntil: "networkidle" });
    await genre.waitFor();
    await page.locator("button.place").first().click();
    await page.waitForTimeout(600);
    const start = await state();
    await genre.click();
    await page.waitForTimeout(150);
    return start;
  };
  const show = (a, b) => `${JSON.stringify(a)} -> ${JSON.stringify(b)}`;
  try {
    let start = await round();
    check(`${tag}: a record is on the platter`, start.phase !== "empty" && !!start.record, JSON.stringify(start));
    check(`${tag}: click opens the picker`, await isOpen(genre));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    let end = await state();
    check(`${tag}: Escape closes the picker`, !(await isOpen(genre)));
    check(`${tag}: Escape leaves the value on All`, (await genre.inputValue()) === "", JSON.stringify(await genre.inputValue()));
    check(`${tag}: Escape leaves the record and phase alone`, same(start, end), show(start, end));

    start = await round();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
    end = await state();
    check(`${tag}: ArrowDown+Space changes the value`, (await genre.inputValue()) !== "", JSON.stringify(await genre.inputValue()));
    check(`${tag}: ArrowDown+Space closes the picker`, !(await isOpen(genre)));
    check(`${tag}: ArrowDown+Space leaves the phase alone`, same(start, end), show(start, end));

    for (const key of ["ArrowRight", "ArrowLeft"]) {
      start = await round();
      await page.keyboard.press(key);
      await page.waitForTimeout(150);
      end = await state();
      check(`${tag}: ${key} leaves the record and phase alone`, same(start, end), show(start, end));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(150);
      check(`${tag}: Escape after ${key} closes the picker`, !(await isOpen(genre)));
    }

    start = await round();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    await page.locator(".turntable-cell").focus();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    end = await state();
    check(`${tag}: control: ArrowRight on the turntable changes the record`, end.record !== start.record, show(start, end));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    end = await state();
    check(`${tag}: control: Escape on the turntable empties the deck`, end.phase === "empty", JSON.stringify(end));
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 600 } });

  await page.goto(`${BASE_URL}/vinyl`, { waitUntil: "networkidle" });
  const genre = page.locator(".crate-filters select");
  await genre.waitFor();
  const before = await genre.inputValue();
  check("/vinyl: genre starts on All", before === "", JSON.stringify(before));
  await probeSelect({
    page,
    label: "/vinyl genre",
    select: genre,
    input: page.locator('.crate-filters input[type="search"]'),
    picker: "rgb(42, 35, 30)",
    shot: "select-vinyl.png",
  });

  for (const theme of ["light", "dark"]) {
    await page.goto(`${BASE_URL}/projects`, { waitUntil: "networkidle" });
    await page.evaluate(
      ({ theme, keys }) => {
        document.documentElement.dataset.theme = theme;
        const wrap = document.createElement("div");
        wrap.id = "probe-fields";
        wrap.style.cssText = "display:grid;gap:12px;padding:16px 16px 260px";
        const input = document.createElement("input");
        input.className = "field";
        input.id = "probe-input";
        const select = document.createElement("select");
        select.className = "field";
        select.id = "probe-select";
        for (const k of keys) select.add(new Option(k, k));
        wrap.append(input, select);
        document.querySelector("main").prepend(wrap);
      },
      { theme, keys: SWATCH_KEYS },
    );
    await probeSelect({
      page,
      label: `/projects ${theme} select.field`,
      select: page.locator("#probe-select"),
      input: page.locator("#probe-input"),
      picker: theme === "light" ? "rgb(242, 239, 231)" : "rgb(28, 25, 21)",
      checkedBackground: "rgb(244, 184, 41)",
      shot: `select-site-${theme}.png`,
    });
  }

  await probeVinylKeys(browser, { width: 1366, height: 768 });
  await probeVinylKeys(browser, { width: 390, height: 844 });
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
