// Real production browser contract. Only storage denial is injected; the controls, commands, store and DOM
// adapter are real. The Lab page itself is delivered separately: navigation below proves the requested /lab URL.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { encodeLab, INK_LAB_KEY, normalizeLab, PRINT_RUN_KEY } from "../lib/ink-lab.ts";
import { PRINT_RUN_IDS, PRINT_RUNS, type PrintRunId } from "../lib/print-runs.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
let context: BrowserContext;
let shortTmp = "";

before(async () => {
  const env = tmpdir().length <= 60 ? process.env : { ...process.env, TMPDIR: (shortTmp = mkdtempSync("/tmp/prc-")) };
  if (process.env.CHROME_PATH) browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, env });
  else browser = await chromium.launch({ channel: "chrome", env }).catch(() => chromium.launch({ env }));
});
after(async () => {
  await context?.close();
  await browser?.close();
  if (shortTmp) rmSync(shortTmp, { recursive: true, force: true });
});

async function open() {
  await context?.close();
  context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as unknown as { heard: string[] }).heard = [];
    document.addEventListener("keydown", (e) => (window as unknown as { heard: string[] }).heard.push(e.key));
  });
  await page.goto(BASE, { waitUntil: "load" });
  await page.waitForFunction(() => "otohimeAppearance" in window);
  return { page, errors };
}
const pocket = (p: Page) => p.getByRole("region", { name: "Pocket console", exact: true });
const dialog = (p: Page) => p.locator("dialog.pocket-terminal");
const switchIn = (p: Page) => dialog(p).getByRole("group", { name: "Print run", exact: true });
const output = (p: Page) => dialog(p).getByRole("log").textContent();
const heard = (p: Page) => p.evaluate(() => (window as unknown as { heard: string[] }).heard.splice(0));
async function terminal(p: Page) {
  await p.keyboard.press("Control+k");
  await dialog(p).waitFor({ state: "visible" });
}
async function command(p: Page, line: string) {
  await p.locator("#pt-in").fill(line);
  await p.locator("#pt-in").press("Enter");
}
async function selected(p: Page, id: PrintRunId) {
  await p.waitForFunction((id) => {
    const radios = [...document.querySelectorAll<HTMLInputElement>(`[data-print-run-switch] input[value="${id}"]`)];
    return radios.length > 0 && radios.every((r) => r.checked) && document.documentElement.getAttribute("data-print-run") === (id === "house" ? null : id);
  }, id);
  const radio = pocket(p).getByRole("radio", { name: PRINT_RUNS[id].label, exact: true });
  assert.equal(await radio.isChecked(), true);
  if (await dialog(p).isVisible()) assert.equal(await switchIn(p).getByRole("radio", { name: PRINT_RUNS[id].label, exact: true }).isChecked(), true);
}

test("visible Pocket chips, commands and terminal settings agree, clear Lab and survive reload", async () => {
  const { page, errors } = await open();
  const group = pocket(page).getByRole("group", { name: "Print run", exact: true });
  assert.equal(await group.isVisible(), true);
  assert.deepEqual(await group.getByRole("radio").evaluateAll((rs) => rs.map((r) => r.closest("label")?.textContent)), PRINT_RUN_IDS.map((id) => PRINT_RUNS[id].label));
  // Negative control: with the terminal shut, an unrelated key reaches the document.
  await page.keyboard.press("x");
  assert.deepEqual(await heard(page), ["x"]);
  await group.getByText("Riso pink + mint", { exact: true }).click();
  await selected(page, "riso");
  await terminal(page);
  await command(page, "print run");
  assert.match((await output(page)) ?? "", /print run: Riso pink \+ mint \(riso\)/);
  await command(page, "print run indigo");
  await selected(page, "indigo");
  assert.match((await output(page)) ?? "", /Saved for reload; Ink Lab override cleared/);
  for (const line of ["print run wrong", "print run riso extra", "print riso"]) await command(page, line);
  await selected(page, "indigo");
  assert.equal(await page.evaluate((key) => localStorage.getItem(key), PRINT_RUN_KEY), "indigo");
  await switchIn(page).getByText("Sumi black", { exact: true }).click();
  await command(page, "print run");
  assert.match((await output(page)) ?? "", /print run: Sumi black \(sumi\)/);
  await page.keyboard.press("Escape");
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => "otohimeAppearance" in window);
  await selected(page, "sumi");
  // Seed an applied Lab through its real store API, then reselect even the already effective radio.
  await page.evaluate((lab) => (window as unknown as { otohimeAppearance: { applyLab: (s: unknown) => void } }).otohimeAppearance.applyLab(lab), normalizeLab({ printRun: "sumi" }));
  assert.equal(await page.getAttribute("html", "data-ink-lab"), "");
  await group.getByText("Sumi black", { exact: true }).click();
  assert.equal(await page.getAttribute("html", "data-ink-lab"), null);
  assert.equal(await page.evaluate((key) => sessionStorage.getItem(key), INK_LAB_KEY), null);
  await terminal(page);
  await page.evaluate((lab) => (window as unknown as { otohimeAppearance: { applyLab: (s: unknown) => void } }).otohimeAppearance.applyLab(lab), normalizeLab({ printRun: "riso" }));
  await command(page, "print run");
  assert.match((await output(page)) ?? "", /Riso pink \+ mint \(riso\); Ink Lab override active/);
  await command(page, "print run house");
  await selected(page, "house");
  assert.equal(await page.getAttribute("html", "data-ink-lab"), null);
  assert.deepEqual(errors, []);
});

test("native arrows and Space work through capture; Tab wraps, Escape returns focus, buttons keep Enter", async () => {
  const { page, errors } = await open();
  const house = pocket(page).getByRole("radio", { name: "House", exact: true });
  await house.focus();
  await page.keyboard.press("ArrowRight");
  await selected(page, "sumi");
  const back = pocket(page).getByRole("radio", { name: "Sumi black", exact: true });
  await back.focus();
  await terminal(page);
  const radios = switchIn(page).getByRole("radio");
  await radios.nth(1).focus();
  await heard(page);
  for (const [key, id] of [["ArrowRight", "riso"], ["ArrowDown", "indigo"], ["ArrowRight", "house"], ["ArrowLeft", "indigo"], ["ArrowUp", "riso"]] as const) {
    await page.keyboard.press(key);
    await selected(page, id);
    assert.equal(await switchIn(page).getByRole("radio", { name: PRINT_RUNS[id].label, exact: true }).evaluate((r) => r === document.activeElement), true);
  }
  await radios.first().focus();
  await page.keyboard.press("Space");
  await selected(page, "house");
  assert.deepEqual(await heard(page), [], "captured radio keys do not escape to the document");
  const esc = dialog(page).getByRole("button", { name: "Esc", exact: true });
  await esc.focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.locator("#pt-in").evaluate((e) => e === document.activeElement), true);
  await page.keyboard.press("Tab");
  assert.equal(await esc.evaluate((e) => e === document.activeElement), true);
  await page.keyboard.press("Tab");
  assert.equal(await radios.first().evaluate((e) => e === document.activeElement), true, "one radio tab stop");
  // Chrome also gives an overflowing log a native Tab stop so keyboard users can scroll its history.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Tab");
    assert.equal(await dialog(page).evaluate((d) => d.contains(document.activeElement)), true);
    if (await page.locator("#pt-in").evaluate((e) => e === document.activeElement)) break;
  }
  assert.equal(await page.locator("#pt-in").evaluate((e) => e === document.activeElement), true);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog(page).evaluate((d) => d.contains(document.activeElement)), true);
    if (await radios.first().evaluate((e) => e === document.activeElement)) break;
  }
  assert.equal(await radios.first().evaluate((e) => e === document.activeElement), true);
  await page.keyboard.press("Escape");
  assert.equal(await back.evaluate((e) => e === document.activeElement), true);
  await terminal(page);
  await esc.focus();
  await page.keyboard.press("Enter");
  await dialog(page).waitFor({ state: "hidden" });
  assert.equal(await back.evaluate((e) => e === document.activeElement), true);
  assert.deepEqual(errors, []);
});

for (const denied of ["localStorage", "sessionStorage", "both"] as const) {
  test(`denied ${denied} works in memory and truthfully discloses reload risk`, async () => {
    const { page, errors } = await open();
    await page.evaluate(({ key, lab }) => sessionStorage.setItem(key, lab), { key: INK_LAB_KEY, lab: encodeLab(normalizeLab({ printRun: "indigo" })) });
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => "otohimeAppearance" in window);
    await page.evaluate((denied) => {
      for (const area of ["localStorage", "sessionStorage"] as const) if (denied === area || denied === "both") {
        Object.defineProperty(window, area, { configurable: true, get: () => { throw new DOMException("blocked", "SecurityError"); } });
      }
    }, denied);
    await terminal(page);
    await command(page, "print run riso");
    await selected(page, "riso");
    assert.equal(await page.getAttribute("html", "data-ink-lab"), null);
    assert.match((await output(page)) ?? "", /Storage is blocked; active on this page only\. Reload may not retain this choice\./);
    await switchIn(page).getByText("Sumi black", { exact: true }).click();
    await selected(page, "sumi");
    assert.match((await switchIn(page).textContent()) ?? "", /Reload may not retain this choice/);
    await command(page, "print run");
    assert.match((await output(page)) ?? "", /Sumi black \(sumi\)/);
    await page.keyboard.press("Escape");
    await page.reload({ waitUntil: "load" });
    await page.waitForFunction(() => "otohimeAppearance" in window);
    await selected(page, denied === "localStorage" ? "house" : "indigo"); // failed session removal restores the stale Lab
    assert.deepEqual(errors, []);
  });
}

test("lab and go lab route through the command effect and close the dialog", async () => {
  const { page, errors } = await open();
  for (const line of ["lab", "go lab"]) {
    await page.goto(BASE, { waitUntil: "load" });
    await page.waitForFunction(() => "otohimeAppearance" in window);
    await terminal(page);
    await command(page, line);
    await page.waitForURL(`${BASE}/lab`);
    assert.equal(await dialog(page).isVisible(), false);
  }
  assert.deepEqual(errors, []);
});

test("quota-denied writes keep the Pocket choice in memory and disclose failure", async () => {
  const { page, errors } = await open();
  const group = pocket(page).getByRole("group", { name: "Print run", exact: true });
  await group.getByText("Indigo night", { exact: true }).click();
  await selected(page, "indigo");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException("full", "QuotaExceededError"); };
    Storage.prototype.removeItem = () => { throw new DOMException("blocked", "SecurityError"); };
  });
  await terminal(page);
  await command(page, "print run indigo");
  assert.match((await group.getByRole("status").textContent()) ?? "", /Reload may not retain this choice/, "a same-run failed save replaces the earlier success on both controls");
  assert.match((await switchIn(page).getByRole("status").textContent()) ?? "", /Reload may not retain this choice/);
  await command(page, "print run");
  assert.match((await output(page)) ?? "", /Indigo night \(indigo\)/);
  await command(page, "print run sumi");
  await selected(page, "sumi");
  assert.match((await output(page)) ?? "", /Reload may not retain this choice/);
  await page.keyboard.press("Escape");
  await group.getByText("Riso pink + mint", { exact: true }).click();
  await selected(page, "riso");
  assert.match((await group.getByRole("status").textContent()) ?? "", /Reload may not retain this choice/);
  assert.deepEqual(errors, []);
});

test("controls reflow and stay reachable on desktop, phone and a 200% equivalent viewport", async () => {
  const { page, errors } = await open();
  const evidence = process.env.PRINT_RUN_CONSOLE_EVIDENCE;
  if (evidence) mkdirSync(evidence, { recursive: true });
  for (const [width, height] of [[1366, 768], [1920, 1080], [390, 844], [640, 450]] as const) {
    await page.setViewportSize({ width, height });
    const group = pocket(page).getByRole("group", { name: "Print run", exact: true });
    await group.getByText("Riso pink + mint", { exact: true }).click();
    await selected(page, "riso");
    const box = await group.boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= width, `Pocket control reflows at ${width}`);
    if (evidence) await pocket(page).screenshot({ path: join(evidence, `pocket-${width}.png`) });
    await terminal(page);
    await switchIn(page).getByText("Indigo night", { exact: true }).click();
    await selected(page, "indigo");
    await page.locator("#pt-in").focus();
    await page.keyboard.press("Tab");
    const esc = dialog(page).getByRole("button", { name: "Esc", exact: true });
    assert.equal(await esc.evaluate((e) => e === document.activeElement), true);
    if (evidence) await dialog(page).screenshot({ path: join(evidence, `terminal-${width}.png`) });
    await page.keyboard.press("Escape");
  }
  assert.deepEqual(errors, []);
});
