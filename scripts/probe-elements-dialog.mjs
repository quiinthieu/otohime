// Drives headless Chromium (classic scrollbars shown) over the Elements dialog close paths.
// Run by scripts/probe-elements-dialog.sh, which installs Playwright into PW_PREFIX and passes BASE_URL.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const TOLERANCE = 0.5;

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

const fmt = (r) => `x=${r.x} width=${r.width}`;
const same = (a, b) => Math.abs(a.x - b.x) <= TOLERANCE && Math.abs(a.width - b.width) <= TOLERANCE;

const browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const opener = page.locator('a[data-element="26"]');
  const tableRect = () => page.locator(".table").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, width: r.width };
  });
  const feRowY = async () => {
    const r = await opener.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { y: b.y, height: b.height };
    });
    return r.y + r.height / 2;
  };
  const focusIsOpener = () => page.evaluate(() => document.activeElement?.matches('a[data-element="26"]') ?? false);

  async function load() {
    await page.goto(`${BASE_URL}/elements`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector('a[data-element="26"]')?.tabIndex !== undefined && document.querySelector(".table a[tabindex]"));
    await page.mouse.move(683, 5);
    await page.waitForTimeout(100);
  }
  const openFe = async () => {
    await opener.scrollIntoViewIfNeeded();
    await opener.click();
    await page.waitForSelector("dialog[open]");
    await page.waitForTimeout(500);
  };
  const closed = async () => {
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  };

  const paths = {
    backdrop: async () => page.mouse.click(40, await feRowY()),
    Esc: () => page.keyboard.press("Escape"),
    "Close button": () => page.locator("dialog[open] .dialog-close").click(),
  };

  for (const [label, close] of Object.entries(paths)) {
    await load();
    const before = await tableRect();
    await openFe();
    const during = await tableRect();
    await close();
    await closed();
    await page.waitForTimeout(300);
    const after = await tableRect();
    check(
      `${label} close: table x and width unchanged before/open/300 ms after close`,
      same(before, during) && same(before, after),
      `before ${fmt(before)}, open ${fmt(during)}, after ${fmt(after)}`,
    );
    check(`${label} close: focus returns to the opener`, await focusIsOpener());
  }

  await load();
  await openFe();
  const y = await feRowY();
  await page.mouse.click(80, y);
  await closed();
  const hoveredTransform = () =>
    page.evaluate(([x, py]) => {
      const cell = document.elementFromPoint(x, py)?.closest("a[data-element]");
      return cell ? getComputedStyle(cell).transform : "no cell under pointer";
    }, [80, y]);
  await page.waitForTimeout(150);
  const t150 = await hoveredTransform();
  check("backdrop close at (80, Fe row): hovered cell transform is none at +150 ms", t150 === "none", t150);
  await page.waitForTimeout(300);
  const t450 = await hoveredTransform();
  check("backdrop close at (80, Fe row): hovered cell transform is none at +450 ms", t450 === "none", t450);

  await page.mouse.move(82, y);
  await page.waitForTimeout(350);
  const lifted = await hoveredTransform();
  check("a 2 px mouse move lifts the hovered cell to scale 1.08", lifted.startsWith("matrix(1.08"), lifted);
  check("backdrop close at (80, Fe row): focus returns to the opener", await focusIsOpener());
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
