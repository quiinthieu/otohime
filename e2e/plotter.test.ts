import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BASE, open, shot } from "./paper-experiments-helpers.ts";

test("plotter samples real SVG transforms and separate subpaths, draws and exports physical layers", { timeout: 60000 }, async () => {
  const { page, context, errors } = await open("/work");
  try {
    await page.waitForFunction(() => "otohimeAppearance" in window);
    await page.evaluate(() => {
      document.querySelectorAll("main svg").forEach(s => s.setAttribute("data-plotter-ignore", ""));
      const fixture = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      fixture.setAttribute("width", "120"); fixture.setAttribute("height", "120");
      fixture.setAttribute("data-plotter-fixture", "");
      fixture.innerHTML = '<g transform="translate(20 40) scale(2)"><path d="M0 0L10 0 M0 10L10 10" stroke="#ff0000" fill="none"/><circle cx="25" cy="10" r="5" stroke="#0000ff" fill="none"/></g>';
      // First in the collection: late scene hydration must not spend the bounded point budget before this fixture.
      document.querySelector("main")!.prepend(fixture);
    });
    await page.locator("svg[data-plotter-fixture]").waitFor();
    await page.getByRole("button", { name: "Pen plotter", exact: true }).click();
    await page.locator(".plotter-overlay polyline").first().waitFor({ state: "attached" });
    const red = await page.locator('.plotter-overlay polyline[stroke="#ff0000"]').evaluateAll(lines => lines.map(l => (l as SVGPolylineElement).getBBox()).map(b => ({ width: b.width, y: b.y })));
    assert.equal(red.length, 2, "two subpaths require two pen strokes");
    assert.ok(red.every(b => Math.abs(b.width - 20) < .01), JSON.stringify(red));
    assert.ok(Math.abs(Math.abs(red[1].y - red[0].y) - 20) < .01);
    await page.getByRole("button", { name: "Skip drawing" }).click();
    await page.locator('.plotter-session[data-complete="true"]').waitFor({ state: "attached" });
    await page.getByRole("button", { name: "Replay", exact: true }).click();
    await page.waitForFunction(() => {
      const pen = document.querySelector("[data-carriage]");
      return !!pen && getComputedStyle(pen).display !== "none";
    });
    await page.getByLabel("Paper", { exact: true }).selectOption("A5");
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export SVG" }).click();
    const download = await downloading;
    const svg = readFileSync((await download.path())!, "utf8");
    assert.match(download.suggestedFilename(), /work-A5.svg$/);
    assert.match(svg, /width="148mm" height="210mm"/);
    assert.equal((svg.match(/inkscape:groupmode="layer"/g) ?? []).length, 2);
    assert.doesNotMatch(svg, /<script|<image|<text|transform=/);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".plotter-overlay").count(), 0);
    assert.deepEqual(errors.unexpected, []);
  } finally { await context.close(); }
});

test("plotter completes for reduced motion, cleans up on navigation, and explains empty drawings", { timeout: 60000 }, async () => {
  const { page, context, errors } = await open("/work", { reduced: true });
  try {
    await page.getByRole("button", { name: "Pen plotter", exact: true }).click();
    await page.locator('.plotter-session[data-complete="true"]').waitFor({ state: "attached" });
    await shot(page, "plotter-complete");
    await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Notes", exact: true }).click();
    await page.waitForURL(BASE + "/notes");
    await page.locator(".plotter-session").waitFor({ state: "detached" });
    await page.evaluate(() => document.querySelectorAll("main svg").forEach(s => s.setAttribute("data-plotter-ignore", "")));
    await page.getByRole("button", { name: "Pen plotter", exact: true }).click();
    await page.getByRole("status").filter({ hasText: "No inline vector strokes" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Export SVG" }).isDisabled(), true);
    assert.deepEqual(errors.unexpected, []);
  } finally { await context.close(); }
});

test("plotter sound follows the shared preference and live reduced motion finishes playback", { timeout: 60000 }, async () => {
  const { page, context, errors } = await open("/work");
  try {
    await page.evaluate(() => {
      const probe = { sources: 0, closed: 0 };
      Object.assign(window, { plotAudioProbe: probe });
      const Original = window.AudioContext;
      class Tracked extends Original {
        createBufferSource() { probe.sources++; return super.createBufferSource(); }
        close() { probe.closed++; return super.close(); }
      }
      window.AudioContext = Tracked;
    });
    await page.getByRole("button", { name: "Pen plotter", exact: true }).click();
    await page.locator(".plotter-overlay").waitFor();
    const probe = () => page.evaluate(() => (window as unknown as { plotAudioProbe: { sources: number; closed: number } }).plotAudioProbe);
    assert.equal((await probe()).sources, 0, "sound is silent by default");
    await page.getByRole("button", { name: "Exit plotter", exact: true }).click();
    await page.getByRole("button", { name: "Console sounds", exact: true }).click();
    await page.getByRole("button", { name: "Pen plotter", exact: true }).click();
    await page.waitForFunction(() => (window as unknown as { plotAudioProbe: { sources: number } }).plotAudioProbe.sources > 0);
    await page.getByRole("button", { name: "Console sounds", exact: true }).click();
    await page.waitForFunction(() => (window as unknown as { plotAudioProbe: { closed: number } }).plotAudioProbe.closed > 0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator('.plotter-session[data-complete="true"]').waitFor({ state: "attached" });
    await page.getByRole("button", { name: "Exit plotter", exact: true }).click();
    await page.goto(BASE + "/shore");
    await page.getByRole("button", { name: "Pen plotter", exact: true }).click();
    await page.getByRole("region", { name: "Pen plotter controls" }).waitFor();
    await page.getByRole("button", { name: "Exit plotter", exact: true }).click();
    assert.deepEqual(errors.unexpected, []);
  } finally { await context.close(); }
});
