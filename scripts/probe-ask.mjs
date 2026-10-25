// Drives headless Chromium over the Ask chip and its receipt dialog on /. Run by scripts/probe-ask.sh, which
// installs Playwright into PW_PREFIX and passes BASE_URL (and EXPECT_SHA, checked if set).
//
// The dialog's chunk is told apart by its marker (the receipt's class name, which only components/ask-console.tsx
// carries); every script body the page receives is searched for it. The index hrefs come from /ask-index.json
// fetched by the probe itself, outside the page, so the page's own request count stays clean.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const EXPECT_SHA = process.env.EXPECT_SHA ?? "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const MARKER = "ask-receipt";
const CONSOLE = 'section[aria-label="Pocket console"]';
const DIALOG = "dialog.ask-console";
const OUT = `${DIALOG} .ask-out`;
const QUERY = "shore";

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

const index = await (await fetch(`${BASE_URL}/ask-index.json`)).json();
const indexHrefs = new Set(index.passages.map((p) => p.href));
const shorePassage = index.passages.find((p) => p.href === "/shore");
const squash = (s) => s.replace(/\s+/g, "");
const hrefsOk = (hrefs) => hrefs.length > 0 && hrefs.every((h) => indexHrefs.has(h));

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
  const net = { index: 0, scripts: new Map() };
  page.on("request", (r) => {
    if (new URL(r.url()).pathname === "/ask-index.json") net.index++;
  });
  page.on("response", (r) => {
    if (r.request().resourceType() === "script") net.scripts.set(r.url(), r.text().catch(() => ""));
  });
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  return { context, page, net, phone };
}

async function markedScripts(net) {
  const urls = [...net.scripts.keys()];
  const bodies = await Promise.all(urls.map((u) => net.scripts.get(u)));
  return urls.filter((_, i) => bodies[i].includes(MARKER)).map((u) => new URL(u).pathname);
}

const chipOf = (page) => page.locator(CONSOLE).locator("xpath=following-sibling::*").getByRole("button", { name: "Ask the console" });

async function press(page, phone, locator) {
  if (phone) await locator.tap();
  else await locator.click();
}

// The receipt as printed: the characters on paper (the rows' own text, read from the DOM) against the answer's
// full length, rows still short of their full text, rows whose box hides text, animations running on rows, and
// what the screen-reader-only live region says.
const rowState = (page) =>
  page.evaluate((out) => {
    const receipt = document.querySelector(`${out} .ask-receipt`);
    const rows = [...document.querySelectorAll(`${out} .ask-row`)];
    const live = document.querySelector(`${out} [aria-live]`);
    return {
      rows: rows.length,
      chars: rows.reduce((n, r) => n + r.textContent.length, 0),
      total: Number(receipt?.dataset.total ?? -1),
      short: rows.filter((r) => r.textContent.length < Number(r.dataset.n)).length,
      hidden: rows.filter((r) => r.clientWidth + 0.5 < r.scrollWidth).length,
      running: rows.reduce((n, r) => n + r.getAnimations().filter((a) => a.playState === "running").length, 0),
      livePolite: live?.getAttribute("aria-live") === "polite",
      liveInside: !!live && !!receipt && receipt.contains(live),
      live: live?.textContent ?? "",
    };
  }, OUT);
const typedOut = (s) => s.rows > 0 && s.total > 0 && s.chars === s.total && s.short === 0 && s.hidden === 0;
const saysShore = (s) => !!shorePassage && squash(s.live).includes(squash(shorePassage.text));

async function ask(page) {
  await page.locator("#ask-q").fill(QUERY);
  await page.locator("#ask-q").press("Enter");
  await page.waitForSelector(`${OUT} .ask-receipt`, { timeout: 5000 });
}

async function motion(browser, viewport) {
  const size = viewport === PHONE ? "390x844 touch" : "1366x768";
  const { context, page, net, phone } = await open(browser, { viewport });
  try {
    const chip = chipOf(page);
    check(`${size}: the Ask chip shows under the console`, await chip.isVisible().catch(() => false));
    const below = await page.evaluate(
      ({ sel }) => {
        const machine = document.querySelector(sel)?.getBoundingClientRect();
        const chip = [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Ask the console"))?.getBoundingClientRect();
        return machine && chip ? chip.top >= machine.bottom - 1 : false;
      },
      { sel: CONSOLE },
    );
    check(`${size}: the chip sits below the console`, below);

    // Untouched page: nothing of the dialog has loaded.
    check(`${size}: /ask-index.json is not requested before the first open`, net.index === 0, `${net.index} requests`);
    const early = await markedScripts(net);
    check(`${size}: no script carrying the dialog loads before the first open`, early.length === 0, JSON.stringify(early));
    check(`${size}: the dialog is not in the page before the first open`, (await page.locator(DIALOG).count()) === 0);

    await press(page, phone, chip);
    await page.waitForSelector(`${DIALOG}[open]`, { timeout: 10000 }).catch(() => {});
    const opened = await page.evaluate((sel) => {
      const d = document.querySelector(sel);
      const input = document.querySelector("#ask-q");
      return {
        open: !!d?.open,
        modal: !!d?.matches(":modal"),
        focus: document.activeElement?.id ?? document.activeElement?.tagName,
        enterkeyhint: input?.getAttribute("enterkeyhint"),
        fontSize: input ? getComputedStyle(input).fontSize : null,
        label: input?.labels?.[0]?.textContent ?? "",
      };
    }, DIALOG);
    check(`${size}: the chip opens a native modal dialog`, opened.open && opened.modal, JSON.stringify(opened));
    check(`${size}: focus lands in the > prompt`, opened.focus === "ask-q", opened.focus);
    check(`${size}: the prompt has enterkeyhint=send, 16px text and a label`, opened.enterkeyhint === "send" && opened.fontSize === "16px" && opened.label.length > 0, JSON.stringify(opened));

    // Positive control for the lazy checks above: once open, the chunk and the index are both seen.
    await sleep(300);
    const late = await markedScripts(net);
    check(`${size}: control: the dialog's chunk is seen once it opens`, late.length >= 1, JSON.stringify(late));
    check(`${size}: the first open fetches /ask-index.json once`, net.index === 1, `${net.index} requests`);

    const sheet = await page.locator(DIALOG).evaluate((d) => {
      const r = d.getBoundingClientRect();
      return { left: r.left, width: r.width, bottom: r.bottom, vw: innerWidth, vh: innerHeight };
    });
    if (phone) check(`${size}: the dialog is a bottom sheet`, Math.abs(sheet.bottom - sheet.vh) <= 1 && sheet.left <= 0.5 && Math.abs(sheet.width - sheet.vw) <= 1, JSON.stringify(sheet));
    else check(`${size}: the dialog floats in the middle`, sheet.bottom < sheet.vh - 16 && sheet.left > 16, JSON.stringify(sheet));

    await ask(page);
    const typing = await rowState(page);
    await sleep(400);
    const later = await rowState(page);
    check(
      `${size}: the receipt types the answer out (part of it right after Enter, more 400 ms later)`,
      typing.total > 0 && typing.chars < typing.total && later.chars > typing.chars && later.chars < later.total,
      JSON.stringify({ typing, later: { chars: later.chars, total: later.total } }),
    );
    check(`${size}: the live region stays empty while it types`, typing.live === "" && later.live === "", JSON.stringify([typing.live, later.live]));

    let done = later;
    for (let i = 0; i < 80 && !typedOut(done); i++) {
      await sleep(250);
      done = await rowState(page);
    }
    check(`${size}: the receipt finishes typing every row`, typedOut(done), JSON.stringify(done));
    check(
      `${size}: once typed, aria-live=polite (outside the typed receipt) holds the whole answer`,
      done.livePolite && !done.liveInside && saysShore(done),
      JSON.stringify(done),
    );
    const hrefs = await page.locator(`${OUT} a[href]`).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    check(`${size}: each citation is a link, only to pages in /ask-index.json`, hrefsOk(hrefs) && hrefs.includes("/shore"), JSON.stringify(hrefs));

    // A new question cancels the old typing: the receipt starts over and finishes the new answer only.
    await page.locator("#ask-q").fill("now");
    await page.locator("#ask-q").press("Enter");
    await sleep(50);
    const restart = await rowState(page);
    check(`${size}: a new question starts a new receipt and clears the live region`, restart.chars < restart.total && restart.live === "", JSON.stringify(restart));
    let again = restart;
    for (let i = 0; i < 80 && !typedOut(again); i++) {
      await sleep(250);
      again = await rowState(page);
    }
    const echo = await page.locator(`${OUT} .ask-echo`).textContent();
    check(`${size}: the new answer types out in full under its own question`, typedOut(again) && echo === "> now" && again.live !== "", JSON.stringify({ echo, again }));
    await page.locator("#ask-q").fill(QUERY);
    await page.locator("#ask-q").press("Enter");
    await sleep(50);
    done = await rowState(page);
    for (let i = 0; i < 80 && !(typedOut(done) && saysShore(done)); i++) {
      await sleep(250);
      done = await rowState(page);
    }

    // Focus stays inside: forward from the prompt and back from it.
    const inside = [];
    await page.locator("#ask-q").focus();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      inside.push(await page.evaluate((sel) => !!document.querySelector(sel)?.contains(document.activeElement), DIALOG));
    }
    await page.locator("#ask-q").focus();
    await page.keyboard.press("Shift+Tab");
    inside.push(await page.evaluate((sel) => !!document.querySelector(sel)?.contains(document.activeElement), DIALOG));
    check(`${size}: Tab and Shift+Tab keep focus inside the dialog`, inside.every(Boolean), JSON.stringify(inside));

    // The console's window keys stay quiet behind the dialog.
    const readout = await page.locator(`${CONSOLE} .readout`).textContent();
    await page.locator(`${OUT} a[href]`).first().focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("a");
    await sleep(500);
    const after = await page.locator(`${CONSOLE} .readout`).textContent();
    check(`${size}: arrow and A keys in the dialog do not drive the console`, after === readout && new URL(page.url()).pathname === "/", `${readout} -> ${after} at ${page.url()}`);

    await page.keyboard.press("Escape");
    await sleep(200);
    const closed = await page.evaluate((sel) => ({
      open: !!document.querySelector(sel)?.open,
      chip: document.activeElement?.textContent?.includes("Ask the console") ?? false,
    }), DIALOG);
    check(`${size}: Escape closes the dialog`, !closed.open, JSON.stringify(closed));
    check(`${size}: focus returns to the Ask chip`, closed.chip, JSON.stringify(closed));

    await press(page, phone, chip);
    await page.waitForSelector(`${DIALOG}[open]`, { timeout: 5000 }).catch(() => {});
    check(`${size}: a second open fetches nothing again`, net.index === 1, `${net.index} requests`);

    // Negative control: a link outside the index fails the same href check.
    const tampered = await page.locator(`${OUT} a[href]`).evaluateAll((as) => [...as.map((a) => a.getAttribute("href")), "/not-in-index"]);
    check(`${size}: control: a link to /not-in-index fails the href check`, !hrefsOk(tampered), JSON.stringify(tampered));

    const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    check(`${size}: nothing scrolls sideways`, wide <= 0, `${wide}px over`);

    await press(page, phone, page.locator(`${OUT} a[href="/shore"]`).first());
    await page.waitForURL(/\/shore$/, { timeout: 10000 }).catch(() => {});
    check(`${size}: the receipt's link goes to its page`, new URL(page.url()).pathname === "/shore", page.url());
  } finally {
    await context.close();
  }
}

async function still(browser, viewport) {
  const size = viewport === PHONE ? "390x844 touch" : "1366x768";
  const { context, page, phone } = await open(browser, { viewport, reduced: true });
  try {
    await press(page, phone, chipOf(page));
    await page.waitForSelector(`${DIALOG}[open]`, { timeout: 10000 }).catch(() => {});
    await ask(page);
    const state = await rowState(page);
    check(`${size} reduced motion: the full answer shows at once, no typewriter`, typedOut(state) && state.running === 0, JSON.stringify(state));
    check(`${size} reduced motion: aria-live holds the whole answer at once`, state.livePolite && saysShore(state), JSON.stringify(state));
    const hrefs = await page.locator(`${OUT} a[href]`).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    check(`${size} reduced motion: every citation link is there at once`, hrefsOk(hrefs) && hrefs.includes("/shore"), JSON.stringify(hrefs));
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  if (EXPECT_SHA) {
    const html = await (await fetch(BASE_URL + "/")).text();
    const sha = html.match(/<meta name="build-sha" content="([^"]*)"/)?.[1] ?? "none";
    check(`build-sha is ${EXPECT_SHA}`, sha === EXPECT_SHA, sha);
  }
  check("/ask-index.json has a /shore passage", !!shorePassage);
  for (const viewport of [DESKTOP, PHONE]) {
    await motion(browser, viewport);
    await still(browser, viewport);
  }
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
