// The Pocket Terminal in a real browser, against a running production server: nothing of it loads with a page,
// "/" or Cmd/Ctrl-K brings its chunk and opens the dialog, keys stop at it while open (a document listener is the
// negative control: it hears keys while the terminal is shut), the palette and Enter navigate, the switches set
// theme, sound and season, Tab stays inside, and Escape closes and gives focus back. Drives Chrome through
// playwright-core: CHROME_PATH if set, else the installed Google Chrome, else Playwright's own Chromium.
//   BASE_URL  the server (default http://localhost:4000)
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";

let browser: Browser;
const contexts: BrowserContext[] = [];

// Chrome puts its singleton socket under TMPDIR and aborts when that path passes the 108-byte socket limit
// (a deep per-job TMPDIR does): such a TMPDIR is swapped for a short one under /tmp, removed afterwards.
let shortTmp = "";
function browserEnv(): Record<string, string | undefined> {
  if (tmpdir().length <= 60) return process.env;
  shortTmp ||= mkdtempSync("/tmp/pt-e2e-");
  return { ...process.env, TMPDIR: shortTmp };
}

async function launch(): Promise<Browser> {
  const env = browserEnv();
  if (process.env.CHROME_PATH) return chromium.launch({ executablePath: process.env.CHROME_PATH, env });
  try {
    return await chromium.launch({ channel: "chrome", env });
  } catch (chrome) {
    try {
      return await chromium.launch({ env });
    } catch {
      throw new Error(`e2e/pocket-terminal.test.ts needs a browser: install Google Chrome or set CHROME_PATH (${String(chrome).split("\n")[0]})`);
    }
  }
}

before(async () => {
  browser = await launch();
});

after(async () => {
  for (const c of contexts) await c.close().catch(() => {});
  await browser?.close();
  if (shortTmp) rmSync(shortTmp, { recursive: true, force: true });
});

// A page with a document-level key log (window.__heard), every script it fetched, and its errors.
async function open(path: string): Promise<{ page: Page; scripts: string[]; errors: string[] }> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  contexts.push(context);
  const page = await context.newPage();
  const scripts: string[] = [];
  const errors: string[] = [];
  page.on("response", (r) => r.request().resourceType() === "script" && scripts.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const w = window as unknown as { __heard: string[] };
    w.__heard = [];
    document.addEventListener("keydown", (e) => w.__heard.push(e.key));
  });
  const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  assert.equal(res?.status(), 200, path);
  return { page, scripts, errors };
}

const heard = (page: Page) => page.evaluate(() => (window as unknown as { __heard: string[] }).__heard.splice(0));
const terminal = (page: Page) => page.locator("dialog.pocket-terminal");
const isOpen = (page: Page) => page.evaluate(() => !!document.querySelector<HTMLDialogElement>("dialog.pocket-terminal")?.open);
const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.id ?? document.activeElement?.tagName ?? "");

test("nothing of the terminal loads with the page; / brings its chunk and opens an accessible dialog", async () => {
  const { page, scripts, errors } = await open("/notes");
  assert.equal(await terminal(page).count(), 0, "no terminal in the page before a key");
  const before = scripts.length;
  await page.keyboard.press("x");
  assert.deepEqual(await heard(page), ["x"], "negative control: with the terminal shut, a key reaches the document");

  await page.keyboard.press("/");
  await terminal(page).waitFor({ state: "visible" });
  assert.ok(scripts.length > before, "the first press fetched the terminal's chunk");
  assert.equal(await isOpen(page), true);
  assert.equal(await focusedId(page), "pt-in");
  assert.equal(await page.inputValue("#pt-in"), "", "the / that opened it is not typed");
  assert.equal(await page.getAttribute("#pt-in", "role"), "combobox");
  assert.equal(await page.getAttribute("dialog.pocket-terminal", "aria-labelledby"), "pt-title");
  assert.equal(await page.textContent("#pt-title"), "Pocket terminal");
  assert.equal(await page.getAttribute("[role=log]", "aria-live"), "polite");
  assert.deepEqual(await heard(page), [], "the opening key stopped at the loader");

  // keys stop at the terminal while it is open
  await page.keyboard.type("he");
  await page.keyboard.press("ArrowDown");
  assert.deepEqual(await heard(page), [], "no key reached the document while open");
  assert.equal(await page.getAttribute("#pt-in", "aria-activedescendant"), "pt-opt-0");
  assert.equal(await page.getAttribute("#pt-opt-0", "aria-selected"), "true");
  assert.deepEqual(errors, []);
});

test("help prints into the live log; Tab stays inside; Escape closes and gives focus back", async () => {
  const { page, errors } = await open("/notes");
  const link = page.locator("a[href='/work']").first();
  await link.focus();
  await page.keyboard.press("Control+k");
  await terminal(page).waitFor({ state: "visible" });
  await page.keyboard.type("help");
  await page.keyboard.press("Enter");
  assert.match((await page.textContent("[role=log]")) ?? "", /> help[\s\S]*go <page>/);
  assert.equal(await page.inputValue("#pt-in"), "");

  for (let i = 0; i < 4; i++) {
    await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab");
    assert.ok(await page.evaluate(() => !!document.activeElement?.closest("dialog.pocket-terminal")), `Tab ${i} left the dialog`);
  }
  await page.focus("#pt-in");
  await heard(page);
  // the very next key after Escape already reaches the page: the loader knows at once that the terminal is shut
  await page.keyboard.press("Escape");
  await page.keyboard.press("x");
  assert.deepEqual(await heard(page), ["x"]);
  assert.equal(await isOpen(page), false);
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("href")), "/work", "focus is back on the link");

  // the Esc chip closes it the same way
  await page.keyboard.press("/");
  await terminal(page).waitFor({ state: "visible" });
  await page.click("dialog.pocket-terminal .chip");
  await page.keyboard.press("x");
  assert.deepEqual((await heard(page)).slice(-1), ["x"]);
  assert.equal(await isOpen(page), false);
  assert.deepEqual(errors, []);
});

test("a bare page name, and a palette pick, navigate and close the terminal", async () => {
  const { page, errors } = await open("/work");
  await page.keyboard.press("/");
  await terminal(page).waitFor({ state: "visible" });
  await page.keyboard.type("not");
  await page.keyboard.press("Enter");
  await page.waitForURL(`${BASE}/notes`);
  await terminal(page).waitFor({ state: "hidden" });

  await page.keyboard.press("/");
  await terminal(page).waitFor({ state: "visible" });
  await page.keyboard.type("go mus");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForURL(`${BASE}/music`);
  assert.equal(await isOpen(page), false);
  assert.deepEqual(errors, []);
});

test("theme, sound and season set the page, and / in a field types a slash while Ctrl-K still opens", async () => {
  const { page, errors } = await open("/postcard");
  await page.focus("textarea[name=note]");
  await page.keyboard.press("/");
  assert.equal(await isOpen(page), false, "/ in a field does not open");
  assert.equal(await page.inputValue("textarea[name=note]"), "/");

  await page.keyboard.press("Control+k");
  await terminal(page).waitFor({ state: "visible" });
  for (const line of ["theme dark", "sound on", "season winter"]) {
    await page.keyboard.type(line);
    await page.keyboard.press("Enter");
  }
  assert.equal(await page.getAttribute("html", "data-theme"), "dark");
  assert.equal(await page.getAttribute("html", "data-season"), "winter");
  const stored = await page.evaluate(() => [localStorage.getItem("theme"), localStorage.getItem("sound"), localStorage.getItem("season")]);
  assert.deepEqual(stored, ["dark", "on", "winter"]);
  // the masthead's own controls follow
  assert.equal(await page.getAttribute(".sound-toggle", "aria-pressed"), "true");
  assert.equal(await page.isChecked("input[name=season-dial][value=winter]"), true);
  assert.equal(await page.getAttribute(".theme-toggle", "aria-pressed"), "true");

  await page.keyboard.type("season auto");
  await page.keyboard.press("Enter");
  assert.equal(await page.evaluate(() => localStorage.getItem("season")), null);
  assert.equal(await page.isChecked("input[name=season-dial][value=auto]"), true);
  assert.deepEqual(errors, []);
});
