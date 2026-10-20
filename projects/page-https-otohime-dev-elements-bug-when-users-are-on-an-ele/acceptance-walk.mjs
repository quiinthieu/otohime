// Acceptance walk for pm-197 on a deployed /elements, headless Chromium with classic scrollbars.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "https://otohime.dev";
const CONTROL = process.env.CONTROL === "1"; // override the fix to show the measurement catches the jump
const SHOTS = process.env.SHOTS || "/tmp/acc/shots";
const rows = [];
const row = (state, action, result, pass) => { rows.push({ state, action, result, pass }); console.log(`${pass ? "PASS" : "FAIL"} | ${state} | ${action} | ${result}`); };
const errors = [];

const browser = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });

async function newPage(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, ...opts });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${viewport.width}: console ${m.text()}`); });
  page.on("pageerror", (e) => errors.push(`${viewport.width}: pageerror ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400) errors.push(`${viewport.width}: HTTP ${r.status()} ${r.url()}`); });
  return page;
}

async function load(page) {
  await page.goto(`${BASE}/elements`, { waitUntil: "networkidle" });
  if (CONTROL) await page.addStyleTag({ content: "html{scrollbar-gutter:auto !important} .table[data-settle] .cell:hover{transform:scale(1.08) !important}" });
  await page.waitForSelector('a[data-element="26"]');
  await page.mouse.move(683, 5);
  await page.waitForTimeout(150);
  return page.evaluate(() => ({ sha: document.querySelector('meta[name="build-sha"]')?.content, cw: document.documentElement.clientWidth, iw: innerWidth }));
}

// Record .table x/width and a far-right cell (Og, 118) x on every animation frame.
const startSampler = (page) => page.evaluate(() => {
  window.__s = [];
  const og = () => document.querySelector('a[data-element="18"]');
  const tick = () => {
    const t = document.querySelector(".table").getBoundingClientRect();
    const c = og()?.getBoundingClientRect();
    window.__s.push({ x: t.x, w: t.width, cx: c?.x ?? 0, open: !!document.querySelector("dialog[open]") });
    if (window.__s.length < 2000) window.__raf = requestAnimationFrame(tick);
  };
  tick();
});
const stopSampler = (page) => page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__s; });
const spread = (s, k) => Math.max(...s.map((v) => v[k])) - Math.min(...s.map((v) => v[k]));

const feY = (page) => page.locator('a[data-element="26"]').evaluate((el) => { const b = el.getBoundingClientRect(); return b.y + b.height / 2; });
const focusOn26 = (page) => page.evaluate(() => document.activeElement?.getAttribute("data-element"));
const transformAt = (page, x, y) => page.evaluate(([x, y]) => {
  const c = document.elementFromPoint(x, y)?.closest("a[data-element]");
  return c ? `${c.dataset.element}:${getComputedStyle(c).transform}` : "no cell";
}, [x, y]);

for (const vp of [{ width: 1366, height: 768 }, { width: 1920, height: 900 }]) {
  const page = await newPage(vp);
  for (const path of ["backdrop", "Esc", "Close button"]) {
    const info = await load(page);
    if (path === "backdrop") row(`${vp.width}x${vp.height}, /elements loaded`, "read build-sha and scrollbar", `build-sha ${info.sha.slice(0, 7)}, clientWidth ${info.cw} < innerWidth ${info.iw} (classic scrollbar)`, info.cw < info.iw);
    await page.locator('a[data-element="26"]').scrollIntoViewIfNeeded();
    await startSampler(page);
    await page.locator('a[data-element="26"]').click();
    await page.waitForSelector("dialog[open]");
    await page.waitForTimeout(600);
    if (path === "backdrop" && vp.width === 1366) await page.screenshot({ path: `${SHOTS}/${CONTROL ? "control-" : ""}open-1366.png` });
    if (path === "backdrop") await page.mouse.click(40, await feY(page));
    else if (path === "Esc") await page.keyboard.press("Escape");
    else await page.locator("dialog[open] .dialog-close").click();
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.waitForTimeout(500);
    const s = await stopSampler(page);
    if (path === "backdrop" && vp.width === 1366) await page.screenshot({ path: `${SHOTS}/${CONTROL ? "control-" : ""}closed-1366.png` });
    const dx = spread(s, "x"), dw = spread(s, "w"), dc = spread(s, "cx");
    const f = await focusOn26(page);
    row(`${vp.width}x${vp.height}, Fe (26) dialog open (mouse)`, `close by ${path}`,
      `${s.length} frames open→close+500 ms: table x spread ${dx.toFixed(2)} px, width spread ${dw.toFixed(2)} px, Ar (18) cell x spread ${dc.toFixed(2)} px (x ${s[0].x.toFixed(2)}, w ${s[0].w.toFixed(2)}); focus on ${f}`,
      dx <= 0.5 && dw <= 0.5 && dc <= 0.5 && f === "26");
  }

  // Backdrop click with a cell under the parked pointer.
  await load(page);
  await page.locator('a[data-element="26"]').click();
  await page.waitForSelector("dialog[open]");
  await page.waitForTimeout(600);
  const y = await feY(page);
  const px = vp.width === 1366 ? 80 : 360;
  await page.mouse.click(px, y);
  await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  const samples = [];
  for (const t of [50, 150, 300, 450, 800]) { await page.waitForTimeout(t - (samples.at(-1)?.t ?? 0)); samples.push({ t, v: await transformAt(page, px, y) }); }
  const still = samples.every((s) => s.v.endsWith(":none"));
  row(`${vp.width}x${vp.height}, Fe dialog open`, `click backdrop at (${px}, Fe row) and keep the pointer still`,
    samples.map((s) => `+${s.t} ms ${s.v}`).join(", "), still && !samples[0].v.startsWith("no cell"));
  await page.mouse.move(px + 2, y);
  await page.waitForTimeout(350);
  const lifted = await transformAt(page, px + 2, y);
  row("same, pointer parked", "move the mouse 2 px, wait 350 ms", `hovered ${lifted}`, /:matrix\(1\.08/.test(lifted));
  await page.close();
}

// Keyboard-only path: lift kept on the opener after Esc.
{
  const page = await newPage({ width: 1366, height: 768 });
  await load(page);
  await page.mouse.move(683, 5);
  await page.locator('a[data-element="26"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("dialog[open]");
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const a = document.activeElement; return `${a?.dataset.element} focus-visible=${a?.matches(":focus-visible")} ${getComputedStyle(a).transform}`; });
  row("1366x768, pointer off the table", "focus Fe, Enter, Esc", r, /^26 focus-visible=true matrix\(1\.08/.test(r));
  await page.close();
}

// 390x844 phone, touch: bottom sheet opens and closes, table steady.
{
  const page = await newPage({ width: 390, height: 844 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const info = await load(page);
  for (const path of ["Esc", "Close button", "tap outside"]) {
    await load(page);
    const fe = page.locator('a[data-element="26"]');
    await fe.scrollIntoViewIfNeeded();
    const before = await page.locator(".table").evaluate((el) => { const b = el.getBoundingClientRect(); return [b.x, b.width]; });
    await fe.tap();
    await page.waitForSelector("dialog[open]");
    await page.waitForTimeout(600);
    const d = await page.locator("dialog[open]").evaluate((el) => { const b = el.getBoundingClientRect(); return `${Math.round(b.width)}x${Math.round(b.height)} at y ${Math.round(b.y)}`; });
    if (path === "Esc") await page.screenshot({ path: `${SHOTS}/${CONTROL ? "control-" : ""}open-390.png` });
    if (path === "Esc") await page.keyboard.press("Escape");
    else if (path === "Close button") await page.locator("dialog[open] .dialog-close").tap();
    else await page.touchscreen.tap(195, 20);
    await page.waitForTimeout(500);
    const open = await page.locator("dialog[open]").count();
    const after = await page.locator(".table").evaluate((el) => { const b = el.getBoundingClientRect(); return [b.x, b.width]; });
    const f = await focusOn26(page);
    row(`390x844 touch, build-sha ${info.sha.slice(0, 7)}`, `tap Fe, close by ${path}`,
      `sheet ${d}; closed=${open === 0}; table [${before.map((v) => v.toFixed(2))}] → [${after.map((v) => v.toFixed(2))}]; focus on ${f}`,
      open === 0 && Math.abs(before[1] - after[1]) <= 0.5 && f === "26");
  }
  await page.close();
}

await browser.close();
console.log("ERRORS:", errors.length ? errors.join("\n") : "none");
console.log(JSON.stringify(rows));
process.exit(rows.every((r) => r.pass) ? 0 : 1);
