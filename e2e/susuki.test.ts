import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium, type Browser, type BrowserContextOptions, type Page } from "playwright-core";

const base = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
before(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, channel: process.env.CHROME_PATH ? undefined : "chrome", env: { ...process.env, TMPDIR: "/tmp" } });
});
after(async () => { await browser?.close(); });

type Proof = {
  calls: number; ticks: number; pixels: number; vertices: number; instances: number;
  uniforms: Record<string, number | number[]>;
  inspect: () => number;
};
declare global { interface Window { __susukiProof: Proof } }

// Observe the real GL program at the draw boundary, including readPixels before
// the compositor discards its buffer. No fake renderer or claimed dataset proof.
function instrument() {
  const proof: Proof = { calls: 0, ticks: 0, pixels: 0, vertices: 0, instances: 0, uniforms: {}, inspect: () => 0 };
  window.__susukiProof = proof;
  const draw = WebGL2RenderingContext.prototype.drawArraysInstanced;
  WebGL2RenderingContext.prototype.drawArraysInstanced = function(mode, first, vertices, instances) {
    draw.call(this, mode, first, vertices, instances);
    if (!(this.canvas instanceof HTMLCanvasElement) || !this.canvas.hasAttribute("data-susuki-field")) return;
    proof.calls++; proof.vertices = vertices; proof.instances = instances;
    const program = this.getParameter(this.CURRENT_PROGRAM) as WebGLProgram;
    for (const name of ["uPointer", "uPointerVel", "uScrollBoost", "uTint", "uFox", "uBladeCount"]) {
      const value = this.getUniform(program, this.getUniformLocation(program, name)!);
      proof.uniforms[name] = typeof value === "number" ? value : Array.from(value);
    }
    proof.inspect = () => {
      const pixels = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
      this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, pixels);
      let ink = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 8) ink++;
      return ink;
    };
    // Reading every frame would distort the adaptive performance budget.
    if (proof.calls <= 2) proof.pixels = proof.inspect();
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    if (!Function.prototype.toString.call(cb).includes("susuki-ambient-frame")) return raf(cb);
    return raf(ts => { proof.ticks++; cb(ts); });
  };
}
async function open(options: BrowserContextOptions = {}, fallback?: "no-webgl" | "save-data") {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, ...options });
  await context.addInitScript(instrument);
  if (fallback) await context.addInitScript((mode) => {
    if (mode === "no-webgl") {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function(this: HTMLCanvasElement, id: string, ...args: unknown[]) {
        if (id === "webgl2" && this.hasAttribute("data-susuki-field")) return null;
        return Reflect.apply(get, this, [id, ...args]);
      } as typeof get;
    } else Object.defineProperty(navigator, "connection", { value: { saveData: true, addEventListener() {}, removeEventListener() {} } });
  }, fallback);
  const p = await context.newPage(); p.setDefaultTimeout(10_000);
  await p.goto(base);
  await p.locator("canvas[data-susuki-field]").waitFor({ state: "attached" });
  await p.locator("[data-susuki-field]").scrollIntoViewIfNeeded();
  await p.waitForFunction(() => Number(document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.frames) > 0);
  return { context, p, canvas: p.locator("[data-susuki-field]") };
}
async function live(p: Page) {
  await p.waitForFunction(() => Number(document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.rafTicks) > 2);
}

test("Susuki renders real instanced ink, pointer/scroll uniforms and an input-cancellable fox without shifting the footer", async () => {
  const { context, p, canvas } = await open();
  try {
    const errors: string[] = []; p.on("pageerror", e => errors.push(e.message));
    await live(p);
    assert.equal(await canvas.getAttribute("data-renderer"), "webgl2");
    const proof = await p.evaluate(() => ({ ...window.__susukiProof, inspect: undefined }));
    assert.ok(proof.pixels > 1000, `actual framebuffer must contain ink: ${JSON.stringify(proof)}`);
    assert.equal(proof.vertices, 34);
    if (process.env.SUSUKI_SCREENSHOT) await canvas.screenshot({ path: process.env.SUSUKI_SCREENSHOT });
    assert.equal(proof.instances, proof.uniforms.uBladeCount);
    assert.ok(proof.instances >= 1200 && proof.instances <= 8000);
    assert.equal(await p.locator("footer.end svg").count(), 5);
    assert.equal(await p.locator("footer.end").evaluate(f => f.lastElementChild?.matches("[data-end-waterline]")), true);
    const geometry = await p.evaluate(() => {
      const backdrop = document.querySelector<HTMLElement>(".end-susuki")!;
      const read = () => ["footer.end", ".end-canvas", '[data-bottle-entry="footer"]'].map(s => {
        const r = document.querySelector(s)!.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];
      });
      const before = read(); backdrop.style.display = "none"; const without = read(); backdrop.style.display = "";
      return { before, without };
    });
    assert.deepEqual(geometry.before, geometry.without, "absolute island shifts footer/stage/Bottle by zero pixels");
    const box = (await canvas.boundingBox())!;
    await p.mouse.move(box.x + box.width * .35, box.y + box.height * .6);
    await p.mouse.move(box.x + box.width * .65, box.y + box.height * .65, { steps: 3 });
    await p.waitForFunction(() => Number(document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.gust) > .01);
    assert.ok(await p.evaluate(() => (window.__susukiProof.uniforms.uPointerVel as number[]).some(v => Math.abs(v) > .01)), "CPU gust reaches actual shader uniform");
    // The initial scrollIntoView also raises the boost. Observe this scroll's
    // actual input event before triggering a fox that any later input cancels.
    await p.evaluate(() => new Promise<void>(resolve => {
      window.addEventListener("scroll", () => resolve(), { once: true });
      scrollBy({ top: -90, behavior: "instant" });
    }));
    await p.waitForFunction(() => Number(window.__susukiProof.uniforms.uScrollBoost) > .01);
    assert.ok(Number(await canvas.getAttribute("data-scroll-boost")) > .01);
    // Scroll is itself input; start only after it has settled, no idle delay.
    await p.evaluate(() => window.__triggerSusukiFox?.());
    await p.waitForFunction(() => document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.fox === "trotting");
    await p.waitForFunction(() => Number(window.__susukiProof.uniforms.uFox) > 0);
    assert.equal(await p.evaluate(() => window.__susukiProof.instances - Number(window.__susukiProof.uniforms.uBladeCount)), 1, "fox is an extra instance in the same draw");
    await p.mouse.move(box.x + box.width * .5, box.y + box.height * .6);
    assert.equal(await canvas.getAttribute("data-fox"), "done");
    assert.equal(await p.evaluate(() => window.__susukiProof.uniforms.uFox), -1, "input removes actual fox instance immediately");
    await canvas.evaluate(c => c.setAttribute("data-susuki-fox-trigger", ""));
    assert.equal(await canvas.getAttribute("data-fox"), "done", "a consumed fox cannot run twice");
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ renderer: "real WebGL2", inkPixels: proof.pixels, geometry, browser: browser.version() }));
  } finally { await context.close(); }
});

test("Susuki retints real uniforms across four seasons and themes; decorative ink keeps links and controls clickable", async () => {
  const { context, p, canvas } = await open();
  try {
    await live(p);
    const tints: string[] = [];
    for (const season of ["spring", "summer", "autumn", "winter"]) {
      await p.evaluate(s => { document.documentElement.dataset.season = s; }, season);
      await p.waitForFunction(s => document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.season === s, season);
      const tint = (await p.evaluate(() => window.__susukiProof.uniforms.uTint)) as number[];
      tints.push(tint.join(","));
      const exposed = (await canvas.getAttribute("data-tint"))!.split(",").map(Number);
      exposed.forEach((v, i) => assert.ok(Math.abs(v - tint[i]) < 1e-6));
    }
    assert.equal(new Set(tints).size, 4);
    await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
    await p.waitForFunction(t => (window.__susukiProof.uniforms.uTint as number[]).join(",") !== t, tints[3]);
    assert.equal(await canvas.getAttribute("aria-hidden"), "true");
    assert.equal(await canvas.locator("..").getAttribute("aria-hidden"), "true");
    assert.equal(await canvas.evaluate(c => getComputedStyle(c).pointerEvents), "none");
    assert.equal(await canvas.evaluate(c => c.tabIndex), -1);
    assert.equal(await canvas.evaluate(c => c.closest(".end-susuki")?.querySelectorAll("a,button,input,[tabindex]").length), 0);
    const links = p.locator("footer.end a");
    for (let i = 0; i < await links.count(); i++) await links.nth(i).click({ trial: true });
    // Exercise actual click dispatch while retaining this test page.
    const link = p.locator('[data-end-page="/work"]');
    await link.evaluate(el => el.addEventListener("click", e => { e.preventDefault(); el.setAttribute("data-clicked", "true"); }, { once: true }));
    await link.click(); assert.equal(await link.getAttribute("data-clicked"), "true");
    await p.locator('[data-bottle-entry="footer"]').click();
    await p.getByRole("dialog", { name: "Message in a Bottle", exact: true }).waitFor();
    await p.getByRole("button", { name: "Close Bottle" }).click();
    await p.locator("[data-end-mascot]").click();
  } finally { await context.close(); }
});

for (const fallback of ["reduced", "save-data", "no-webgl"] as const) {
  test(`Susuki ${fallback} draws one nonblank static frame and schedules zero ambient rAF callbacks`, async () => {
    const { context, p, canvas } = await open(fallback === "reduced" ? { reducedMotion: "reduce" } : {}, fallback === "reduced" ? undefined : fallback);
    try {
      assert.equal(await canvas.getAttribute("data-mode"), "static");
      assert.equal(await canvas.getAttribute("data-running"), "false");
      assert.equal(await canvas.getAttribute("data-frames"), "1");
      const proof = await p.evaluate(() => {
        const canvas = document.querySelector<HTMLCanvasElement>("[data-susuki-field]")!;
        const ctx = canvas.getContext("2d");
        let pixels = window.__susukiProof.pixels;
        if (ctx) { pixels = 0; const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; for (let i = 3; i < data.length; i += 4) if (data[i] > 8) pixels++; }
        return { pixels, calls: window.__susukiProof.calls, ticks: window.__susukiProof.ticks };
      });
      assert.ok(proof.pixels > 1000, `static ink is nonblank: ${JSON.stringify(proof)}`);
      await p.mouse.move(600, 600); await p.evaluate(() => { window.__triggerSusukiFox?.(); scrollBy(0, -30); });
      await p.locator("footer.end").dispatchEvent("pointerup", { pointerType: "touch" });
      // Advance unrelated browser frames on demand; do not wait for a clock/soak.
      await p.evaluate(async () => { for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame); });
      assert.equal(await canvas.getAttribute("data-raf-ticks"), "0");
      assert.equal(await p.evaluate(() => window.__susukiProof.ticks), 0);
      assert.equal(await canvas.getAttribute("data-frames"), "1");
      assert.equal(await canvas.getAttribute("data-gust"), "0");
      assert.equal(await canvas.getAttribute("data-scroll-boost"), "0");
      assert.notEqual(await canvas.getAttribute("data-fox"), "trotting");
      console.log(JSON.stringify({ fallback, ...proof }));
    } finally { await context.close(); }
  });
}

test("Susuki stops outside the viewport and when hidden, changes motion preference live, and recovers a real lost GL context", async () => {
  const { context, p, canvas } = await open();
  try {
    await live(p);
    await p.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await p.waitForFunction(() => document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.running === "false");
    const paused = await p.evaluate(() => window.__susukiProof.ticks);
    await p.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); });
    assert.equal(await p.evaluate(() => window.__susukiProof.ticks), paused);
    await canvas.scrollIntoViewIfNeeded(); await live(p);
    await p.emulateMedia({ reducedMotion: "reduce" });
    await p.waitForFunction(() => document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.mode === "static");
    const staticTicks = await p.evaluate(() => window.__susukiProof.ticks);
    await p.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); });
    assert.equal(await p.evaluate(() => window.__susukiProof.ticks), staticTicks);
    await p.emulateMedia({ reducedMotion: "no-preference" });
    await p.waitForFunction(t => window.__susukiProof.ticks > t, staticTicks);
    // Visibility event fixture; the GPU/context and rendering remain real.
    await p.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
    const hiddenTicks = await p.evaluate(() => window.__susukiProof.ticks);
    await p.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); });
    assert.equal(await p.evaluate(() => window.__susukiProof.ticks), hiddenTicks);
    await p.evaluate(() => { delete (document as unknown as { hidden?: boolean }).hidden; document.dispatchEvent(new Event("visibilitychange")); });
    await p.waitForFunction(t => window.__susukiProof.ticks > t, hiddenTicks);
    const extension = await canvas.evaluateHandle(c => (c as HTMLCanvasElement).getContext("webgl2")!.getExtension("WEBGL_lose_context"));
    assert.ok(await extension.evaluate(e => !!e), "real browser exposes loss extension");
    await canvas.evaluate(c => c.addEventListener("webglcontextlost", e => { c.setAttribute("data-loss-prevented", String(e.defaultPrevented)); }, { once: true }));
    await extension.evaluate(e => e!.loseContext());
    await p.waitForFunction(() => document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.state === "context-lost");
    assert.equal(await canvas.getAttribute("data-loss-prevented"), "true");
    const lostTicks = await p.evaluate(() => window.__susukiProof.ticks);
    await p.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); });
    assert.equal(await p.evaluate(() => window.__susukiProof.ticks), lostTicks);
    await extension.evaluate(e => e!.restoreContext());
    await p.waitForFunction(t => window.__susukiProof.ticks > t && document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.state === "live", lostTicks);
    // Negative control: erase actual ink and prove the pixel observer sees blank.
    const blank = await canvas.evaluate(c => {
      const gl = (c as HTMLCanvasElement).getContext("webgl2")!;
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      return window.__susukiProof.inspect();
    });
    assert.equal(blank, 0, "blank canvas must fail the nonblank predicate");
    const calls = await p.evaluate(() => window.__susukiProof.calls);
    await p.waitForFunction(n => window.__susukiProof.calls > n, calls);
    assert.equal(await canvas.getAttribute("data-renderer"), "webgl2");
  } finally { await context.close(); }
});

test("Susuki touch gust exists only during contact, caps DPR, and supports the attribute fox trigger", async () => {
  const { context, p, canvas } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
  try {
    await live(p);
    const dpr = await canvas.evaluate(c => (c as HTMLCanvasElement).width / c.clientWidth);
    assert.ok(dpr <= 1.501 && dpr > 1, `DPR is capped at 1.5: ${dpr}`);
    await canvas.evaluate(c => c.setAttribute("data-susuki-fox-trigger", ""));
    await p.waitForFunction(() => document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.fox === "trotting");
    const box = (await canvas.boundingBox())!;
    const client = await context.newCDPSession(p);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.width * .3, y: box.y + box.height * .7 }] });
    await p.waitForFunction(() => Number(document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.gust) > .01);
    assert.equal(await canvas.getAttribute("data-fox"), "done", "native touch immediately cancels the fox");
    // Stay below native pan slop: larger swipes correctly cause pointercancel
    // because these passive listeners leave browser scrolling in control.
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: box.width * .31, y: box.y + box.height * .7 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await p.waitForFunction(() => Number(document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.gust) === 0);
    assert.deepEqual(await p.evaluate(() => window.__susukiProof.uniforms.uPointer), [-2, -2]);
    assert.equal(await p.evaluate(() => window.__susukiProof.uniforms.uFox), -1);
    await p.reload(); await canvas.waitFor({ state: "attached" }); await canvas.scrollIntoViewIfNeeded();
    await p.waitForFunction(() => document.querySelector<HTMLElement>("[data-susuki-field]")?.dataset.fox === "done");
    await p.evaluate(() => window.__triggerSusukiFox?.());
    assert.equal(await canvas.getAttribute("data-fox"), "done", "fox session lock survives remount");
  } finally { await context.close(); }
});
