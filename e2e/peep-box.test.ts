import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
let browser: Browser;
const contexts: BrowserContext[] = [];
const tmp = mkdtempSync("/tmp/peep-e2e-");
before(async () => {
  const env = { ...process.env, TMPDIR: tmp };
  if (process.env.CHROME_PATH)
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH,
      env,
    });
  else {
    try {
      browser = await chromium.launch({ channel: "chrome", env });
    } catch {
      browser = await chromium.launch({ env });
    }
  }
});
after(async () => {
  for (const c of contexts) await c.close();
  await browser?.close();
  rmSync(tmp, { recursive: true, force: true });
});

async function open(
  options: BrowserContextOptions = {},
  permission: "granted" | "denied" | "missing" | "pending" = "missing",
  saveData = false,
) {
  const c = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    ...options,
  });
  contexts.push(c);
  await c.addInitScript(
    ({ permission, saveData }) => {
      const w = window as unknown as {
        peepRaf: string[];
        permissions: number;
        shifts: number;
        sensorListeners: number;
        cameraCalls: number;
        workerCalls: number;
        resolveTilt?: (permission: string) => void;
      };
      w.peepRaf = [];
      w.permissions = 0;
      w.shifts = 0;
      w.sensorListeners = 0;
      w.cameraCalls = 0;
      w.workerCalls = 0;
      const RealWorker = window.Worker;
      window.Worker = new Proxy(RealWorker, {
        construct(target, args) {
          w.workerCalls++;
          return Reflect.construct(target, args);
        },
      });
      if (saveData)
        Object.defineProperty(navigator, "connection", {
          configurable: true,
          value: Object.assign(new EventTarget(), { saveData: true }),
        });
      if (navigator.mediaDevices)
        navigator.mediaDevices.getUserMedia = async () => {
          w.cameraCalls++;
          throw new Error("Camera must remain unused");
        };
      const raf = requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => {
        w.peepRaf.push(new Error().stack ?? "");
        return raf(cb);
      };
      const add = window.addEventListener.bind(window),
        remove = window.removeEventListener.bind(window);
      window.addEventListener = ((type: string, ...args: unknown[]) => {
        if (type === "deviceorientation") w.sensorListeners++;
        return Reflect.apply(add, window, [type, ...args]);
      }) as typeof window.addEventListener;
      window.removeEventListener = ((type: string, ...args: unknown[]) => {
        if (type === "deviceorientation") w.sensorListeners--;
        return Reflect.apply(remove, window, [type, ...args]);
      }) as typeof window.removeEventListener;
      if (permission !== "missing")
        Object.defineProperty(window, "DeviceOrientationEvent", {
          configurable: true,
          value: class extends Event {
            static async requestPermission() {
              w.permissions++;
              if (permission === "pending")
                return new Promise<string>((resolve) => {
                  w.resolveTilt = resolve;
                });
              return permission;
            }
          },
        });
      else
        Object.defineProperty(window, "DeviceOrientationEvent", {
          configurable: true,
          value: undefined,
        });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {
            value: number;
            sources?: { node: Node }[];
          };
          if (
            shift.sources?.some(
              (s) =>
                s.node instanceof Element &&
                (s.node.closest("[data-peep]") ||
                  s.node.querySelector("[data-peep]")),
            )
          )
            w.shifts += shift.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    },
    { permission, saveData },
  );
  const p = await c.newPage();
  const scripts = new Map<string, string>();
  const requests: string[] = [];
  const errors: string[] = [];
  p.on("request", (r) => requests.push(r.url()));
  p.on("response", async (r) => {
    if (r.request().resourceType() === "script")
      scripts.set(r.url(), await r.text().catch(() => ""));
  });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(`${BASE}/play`, { waitUntil: "networkidle" });
  return { p, c, scripts, requests, errors };
}
const box = (p: Page) => p.locator("[data-peep]");
const aperture = (p: Page) => box(p).locator("[data-peep-aperture]");
// The controller renders its buttons before its effect wires them, and only runs once
// its IntersectionObserver reports the aperture. Input before that is ignored by
// design, so wait for the running pointer source before driving it.
async function activate(p: Page, { running = true } = {}) {
  await box(p)
    .getByRole("button", { name: "Look inside", exact: true })
    .click();
  await box(p).locator("[data-peep-controller]").waitFor();
  if (running)
    await p.waitForFunction(() => {
      const e = document.querySelector("[data-peep]");
      return (
        e?.getAttribute("data-running") === "true" &&
        e.getAttribute("data-source") === "pointer"
      );
    });
}
// Everything the geometry assertions depend on, for their failure messages.
async function geometry(p: Page) {
  return box(p).evaluate((e) => {
    const a = e.querySelector("[data-peep-aperture]")!;
    const r = (n: Element) => {
      const b = n.getBoundingClientRect();
      return [b.x, b.y, b.width, b.height].map((v) => +v.toFixed(2));
    };
    return {
      running: e.getAttribute("data-running"),
      source: e.getAttribute("data-source"),
      moving: e.getAttribute("data-moving"),
      scrollY,
      innerHeight,
      aperture: r(a),
      svg: r(a.querySelector("svg")!),
      ctm: [...e.querySelectorAll<SVGGraphicsElement>("[data-peep-layer]")].map(
        (l) => {
          const m = l.getScreenCTM()!;
          return [m.a, m.d, m.e, m.f].map((v) => +v.toFixed(3));
        },
      ),
    };
  });
}
async function settle(p: Page) {
  await p.waitForFunction(
    () =>
      document.querySelector("[data-peep]")?.getAttribute("data-moving") ===
      "false",
  );
}
async function point(p: Page, index: number) {
  return box(p)
    .locator("[data-peep-layer]")
    .nth(index)
    .evaluate((e: SVGGraphicsElement) => {
      const pt = new DOMPoint(400, 230).matrixTransform(e.getScreenCTM()!);
      const frame = e.closest("[data-peep-aperture]")!.getBoundingClientRect();
      return { x: pt.x - frame.x, y: pt.y - frame.y };
    });
}
async function windowRect(p: Page) {
  return aperture(p).evaluate((e) => {
    const r = e.getBoundingClientRect();
    return {
      x: r.x + scrollX,
      y: r.y + scrollY,
      width: r.width,
      height: r.height,
    };
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1366, height: 768 },
])
  test(`real layer geometry, pointer, keyboard, fixed aperture and lazy budget at ${viewport.width}`, async () => {
    const { p, scripts, requests, errors } = await open({ viewport });
    // The pre-existing Press loads when crossed while scrolling to the peep-box.
    // Finish its own layout before attributing any geometry/CLS to this toy.
    await p.locator("#press-heading").scrollIntoViewIfNeeded();
    await p.waitForSelector("[data-press=poster]", { timeout: 20_000 });
    await box(p).scrollIntoViewIfNeeded();
    await p.waitForLoadState("networkidle");
    await p.evaluate(
      () => ((window as unknown as { shifts: number }).shifts = 0),
    );
    assert.equal(
      [...scripts.values()].some((b) => b.includes("peep-box-active")),
      false,
      "input controller is gesture loaded",
    );
    const before = new Set(scripts.keys());
    const rect = await aperture(p).boundingBox();
    assert.ok(rect);
    const fixed = await windowRect(p);
    const svgRect = await aperture(p).locator("svg").boundingBox();
    assert.ok(svgRect);
    const neutral = [await point(p, 0), await point(p, 3)];
    const neutralGeometry = await geometry(p);
    await activate(p);
    await box(p)
      .getByRole("button", { name: "Look right", exact: true })
      .focus();
    await p.keyboard.press("Enter");
    await settle(p);
    const right = [await point(p, 0), await point(p, 3)];
    const rightGeometry = await geometry(p);
    for (const [i, depth] of [
      [0, 500],
      [1, 60],
    ]) {
      const expected =
        ((120 * depth) / (600 + depth)) *
        Math.min(svgRect.width / 600, svgRect.height / 360);
      const actual = right[i].x - neutral[i].x;
      assert.ok(
        Math.abs(actual - expected) < 0.1,
        `depth ${depth}: displacement ${actual} expected ${expected} ` +
          JSON.stringify({ neutral, right, svgRect, neutralGeometry, rightGeometry }),
      );
    }
    assert.ok(right[0].x - neutral[0].x > (right[1].x - neutral[1].x) * 3);
    await p.keyboard.press("ArrowLeft");
    await settle(p);
    const left = await point(p, 0);
    assert.ok(Math.abs(left.x + right[0].x - 2 * neutral[0].x) < 0.1);
    await box(p).getByRole("button", { name: "Look up", exact: true }).click();
    await settle(p);
    const up = await point(p, 0);
    assert.ok(up.y < neutral[0].y);
    await box(p)
      .getByRole("button", { name: "Look down", exact: true })
      .click();
    await settle(p);
    assert.ok(Math.abs((await point(p, 0)).y + up.y - 2 * neutral[0].y) < 0.1);
    await box(p).getByRole("button", { name: "Center", exact: true }).click();
    await settle(p);
    await aperture(p).scrollIntoViewIfNeeded();
    const pointerRect = await aperture(p).boundingBox();
    assert.ok(pointerRect);
    await p.mouse.move(
      pointerRect.x + pointerRect.width * 0.9,
      pointerRect.y + pointerRect.height / 2,
    );
    await settle(p);
    assert.ok(
      (await point(p, 0)).x > neutral[0].x + 5,
      "actual pointer changes the eye",
    );
    assert.deepEqual(
      await windowRect(p),
      fixed,
      "window stays fixed in the document, including when controls scroll into view",
    );
    assert.ok(
      await box(p)
        .locator(".peep-tools")
        .evaluate((e) => e.scrollHeight <= e.clientHeight),
      "reserved tools contain their text and touch controls",
    );
    const peepChunks = [...scripts].filter(
      ([url, body]) => !before.has(url) || body.includes("peep-box-loader"),
    );
    const bytes =
      peepChunks.reduce((sum, [, body]) => sum + gzipSync(body).length, 0) +
      gzipSync(readFileSync("components/peep-box/peep-box.css")).length;
    assert.ok(peepChunks.some(([, body]) => body.includes("peep-box-active")));
    assert.ok(
      bytes <= 35 * 1024,
      `incremental JS plus scoped CSS ${bytes} gzip`,
    );
    assert.equal(
      requests.some((url) =>
        /mediapipe|\.wasm|\.task(?:\?|$)|peep.*worker/i.test(url),
      ),
      false,
    );
    assert.equal(
      await p.evaluate(
        () => (window as unknown as { permissions: number }).permissions,
      ),
      0,
    );
    assert.equal(
      await p.evaluate(
        () => (window as unknown as { cameraCalls: number }).cameraCalls,
      ),
      0,
    );
    assert.equal(
      await p.evaluate(
        () => (window as unknown as { workerCalls: number }).workerCalls,
      ),
      0,
    );
    assert.ok(
      (await p.evaluate(
        () => (window as unknown as { shifts: number }).shifts,
      )) <= 0.001,
    );
    console.log(
      JSON.stringify({
        viewport,
        gzipBytes: bytes,
        attributableCLS: await p.evaluate(
          () => (window as unknown as { shifts: number }).shifts,
        ),
        browser: browser.version(),
        chunks: peepChunks.map(([url, body]) => ({
          path: new URL(url).pathname,
          sha256: createHash("sha256").update(body).digest("hex"),
          gzipBytes: gzipSync(body).length,
        })),
      }),
    );
    assert.deepEqual(errors, []);
  });

test("tilt permission grant calibrates, rotates, relinquishes to controls and tears down", async () => {
  const { p } = await open({}, "granted");
  await activate(p);
  await settle(p);
  await box(p)
    .getByRole("button", { name: "Enable tilt", exact: true })
    .click();
  const sensor = async (beta: number, gamma: number) =>
    p.evaluate(
      ({ beta, gamma }) => {
        const e = new Event("deviceorientation");
        Object.assign(e, { beta, gamma });
        window.dispatchEvent(e);
      },
      { beta, gamma },
    );
  await sensor(20, 10);
  const neutral = await point(p, 0);
  await sensor(20, 30);
  await settle(p);
  assert.ok((await point(p, 0)).x > neutral.x + 10);
  assert.equal(await box(p).getAttribute("data-source"), "tilt");
  await p.evaluate(() =>
    Object.defineProperty(screen, "orientation", {
      configurable: true,
      value: { angle: 90 },
    }),
  );
  await sensor(20, 30);
  await settle(p); // Screen rotation recalibrates before using a new axis.
  await sensor(20, 50);
  await settle(p);
  const rotated = await point(p, 0);
  assert.ok(
    Math.abs(rotated.x - neutral.x) < 0.1 && rotated.y < neutral.y - 10,
  );
  await box(p).getByRole("button", { name: "Center", exact: true }).click();
  await settle(p);
  assert.equal(await box(p).getAttribute("data-source"), "pointer");
  assert.equal(
    await p.evaluate(
      () => (window as unknown as { sensorListeners: number }).sensorListeners,
    ),
    0,
  );
  await sensor(40, 50);
  assert.ok(Math.abs((await point(p, 0)).x - neutral.x) < 0.1);
  await box(p)
    .getByRole("button", { name: "Enable tilt", exact: true })
    .click();
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(
    await p.evaluate(
      () => (window as unknown as { sensorListeners: number }).sensorListeners,
    ),
    0,
  );
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(
    await box(p).getAttribute("data-source"),
    "pointer",
    "tilt never silently resumes",
  );
});

test("denial and unavailable tilt preserve pointer controls", async () => {
  for (const permission of ["denied", "missing"] as const) {
    const { p } = await open({}, permission);
    await activate(p);
    await box(p)
      .getByRole("button", { name: "Enable tilt", exact: true })
      .click();
    assert.match(
      await box(p).getByRole("status").innerText(),
      /unavailable|not allowed/i,
    );
    await box(p)
      .getByRole("button", { name: "Look right", exact: true })
      .click();
    await settle(p);
    assert.equal(await box(p).getAttribute("data-source"), "pointer");
    assert.equal(
      await p.evaluate(
        () =>
          (window as unknown as { sensorListeners: number }).sensorListeners,
      ),
      0,
    );
  }
});

test("a pending tilt grant cannot reactivate after Disable or reduced motion", async () => {
  for (const stop of ["disable", "reduce"] as const) {
    const { p } = await open({}, "pending");
    await activate(p);
    await box(p)
      .getByRole("button", { name: "Enable tilt", exact: true })
      .click();
    if (stop === "disable")
      await box(p)
        .getByRole("button", { name: "Disable", exact: true })
        .click();
    else {
      await p.emulateMedia({ reducedMotion: "reduce" });
      await box(p)
        .getByText("Motion is reduced. Enjoy the still paper scene.")
        .waitFor();
    }
    await p.evaluate(() =>
      (window as unknown as { resolveTilt: (p: string) => void }).resolveTilt(
        "granted",
      ),
    );
    assert.equal(
      await p.evaluate(
        () =>
          (window as unknown as { sensorListeners: number }).sensorListeners,
      ),
      0,
    );
    assert.equal(await box(p).getAttribute("data-running"), "false");
  }
});

test("rest, offscreen, hidden, disable, pagehide and live reduced motion cancel work", async () => {
  const { p, scripts } = await open({}, "granted");
  await activate(p);
  const url = [...scripts].find(([, body]) =>
    body.includes("peep-box-active"),
  )![0];
  const count = () =>
    p.evaluate(
      (url) =>
        (window as unknown as { peepRaf: string[] }).peepRaf.filter((s) =>
          s.includes(url),
        ).length,
      url,
    );
  await box(p).getByRole("button", { name: "Look right", exact: true }).click();
  await settle(p);
  assert.ok(
    (await count()) > 0,
    "moving negative control proves frame attribution",
  );
  const stable = await count();
  await p.waitForTimeout(150);
  assert.equal(await count(), stable, "rest schedules zero frames");
  await box(p)
    .getByRole("button", { name: "Enable tilt", exact: true })
    .click();
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(150);
  const off = await count();
  await p.waitForTimeout(150);
  assert.equal(await count(), off);
  assert.equal(await box(p).getAttribute("data-running"), "false");
  assert.equal(
    await p.evaluate(
      () => (window as unknown as { sensorListeners: number }).sensorListeners,
    ),
    0,
  );
  await box(p).scrollIntoViewIfNeeded();
  await p.waitForTimeout(100);
  await box(p).getByRole("button", { name: "Look left", exact: true }).click();
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const hidden = await count();
  await p.waitForTimeout(150);
  assert.equal(await count(), hidden);
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.emulateMedia({ reducedMotion: "reduce" });
  await box(p)
    .getByText("Motion is reduced. Enjoy the still paper scene.")
    .waitFor();
  const reduced = await count();
  await p.waitForTimeout(150);
  assert.equal(await count(), reduced);
  assert.equal(
    await box(p)
      .getByRole("button", { name: "Enable tilt", exact: true })
      .count(),
    0,
  );
  await p.emulateMedia({ reducedMotion: "no-preference" });
  await box(p).getByRole("button", { name: "Look right", exact: true }).click();
  await box(p).getByRole("button", { name: "Disable", exact: true }).click();
  const disabled = await count();
  await p.waitForTimeout(150);
  assert.equal(await count(), disabled);
  await activate(p);
  await box(p)
    .getByRole("button", { name: "Enable tilt", exact: true })
    .click();
  await p.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  assert.equal(
    await p.evaluate(
      () => (window as unknown as { sensorListeners: number }).sensorListeners,
    ),
    0,
  );
  await p.evaluate(() => window.dispatchEvent(new Event("pageshow")));
  await box(p)
    .getByRole("button", { name: "Enable tilt", exact: true })
    .click();
  await p.evaluate(() =>
    Object.assign(window, { peepNavigationMarker: "same-document" }),
  );
  await p
    .getByRole("link", { name: "Projects", exact: true })
    .first()
    .evaluate((e: HTMLAnchorElement) => e.click());
  await p.waitForURL(`${BASE}/projects`);
  // Next updates history before the outgoing ViewTransition/Activity releases
  // the old page. Assert cleanup at the actual route commit, not URL mutation.
  await box(p).waitFor({ state: "hidden", timeout: 5_000 });
  await p.waitForFunction(
    () =>
      (window as unknown as { sensorListeners: number }).sensorListeners === 0,
    null,
    { timeout: 1_000 },
  );
  assert.equal(
    await p.evaluate(
      () =>
        (window as unknown as { peepNavigationMarker: string })
          .peepNavigationMarker,
    ),
    "same-document",
    "route exit exercises React cleanup",
  );
  assert.equal(
    await p.evaluate(
      () => (window as unknown as { sensorListeners: number }).sensorListeners,
    ),
    0,
  );
  const exited = await count();
  await p.waitForTimeout(150);
  assert.equal(await count(), exited);
});

test("touch pans scroll normally, Save-Data stays opt-in and original toys remain", async () => {
  const { p, c, scripts } = await open(
    {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    },
    "missing",
    true,
  );
  // Ink Press grows from its placeholder once scrolled near; let it finish so the
  // document height and the aperture stay put while the pan is measured.
  await p.locator("#press-heading").scrollIntoViewIfNeeded();
  await p.waitForSelector("[data-press=poster]", { timeout: 20_000 });
  await box(p).scrollIntoViewIfNeeded();
  await p.waitForLoadState("networkidle");
  assert.equal(
    [...scripts.values()].some((b) => b.includes("peep-box-active")),
    false,
    "Save-Data never auto-activates the diorama",
  );
  await activate(p);
  await settle(p);
  await aperture(p).scrollIntoViewIfNeeded();
  assert.equal(
    await aperture(p).evaluate((e) => getComputedStyle(e).touchAction),
    "pan-y",
  );
  const start = await aperture(p).evaluate((e) => {
    const r = e.getBoundingClientRect();
    return {
      aperture: [r.x, r.y, r.width, r.height],
      scrollY,
      max: document.documentElement.scrollHeight - innerHeight,
    };
  });
  // Pan toward whichever side has room: a finger moving up scrolls down.
  const down = start.max - start.scrollY >= 60;
  assert.ok(
    down || start.scrollY >= 60,
    `no room to scroll either way ${JSON.stringify(start)}`,
  );
  const [ax, ay, aw, ah] = start.aperture;
  const x = ax + aw / 2,
    y0 = ay + ah * (down ? 0.8 : 0.2),
    step = down ? -20 : 20;
  const session = await c.newCDPSession(p);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: y0 }],
  });
  for (let i = 1; i <= 6; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y0 + i * step }],
    });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const moved = await p
    .waitForFunction(
      ({ from, down }) => (down ? scrollY - from : from - scrollY) > 30,
      { from: start.scrollY, down },
      { timeout: 2_000 },
    )
    .then(() => true)
    .catch(() => false);
  const end = await p.evaluate(() => ({
    scrollY,
    max: document.documentElement.scrollHeight - innerHeight,
  }));
  assert.ok(
    moved,
    `touch negative control really scrolls the document ${JSON.stringify({ down, start, end })}`,
  );
  assert.equal(
    await p.getByRole("heading", { name: "Suminagashi pond" }).count(),
    1,
  );
  assert.equal(
    await p.getByRole("heading", { name: /Ink poster press/ }).count(),
    1,
  );
  assert.ok(
    (await p.locator("[data-claw], .claw-machine").count()) ||
      (await p.getByText("Claw", { exact: false }).count()),
  );
});

test("enlarged text grows the peep tools instead of clipping them", async () => {
  const { p } = await open({ viewport: { width: 390, height: 844 } });
  await box(p).scrollIntoViewIfNeeded();
  await activate(p);
  const tools = box(p).locator(".peep-tools");
  await tools.evaluate((el) => {
    el.style.fontSize = "24px";
    for (const node of el.querySelectorAll("button, p, span"))
      (node as HTMLElement).style.fontSize = "24px";
  });
  const grown = await tools.evaluate((el) => ({
    client: el.clientHeight,
    scroll: el.scrollHeight,
  }));
  assert.ok(grown.client >= 460, JSON.stringify(grown));
  assert.ok(grown.scroll <= grown.client, JSON.stringify(grown));
  const clipped = await tools.evaluate((el) => {
    el.style.height = "460px";
    return el.scrollHeight > el.clientHeight;
  });
  assert.equal(clipped, true);
});

test("no-JS and reduced motion keep the server paper scene with no pose loop", async () => {
  const nojs = await open({ javaScriptEnabled: false });
  assert.equal(await box(nojs.p).locator("svg[role=img]").count(), 1);
  assert.equal(await box(nojs.p).locator("[data-peep-layer]").count(), 4);
  const { p, scripts } = await open({ reducedMotion: "reduce" }, "granted");
  await activate(p, { running: false });
  await box(p)
    .getByText("Motion is reduced. Enjoy the still paper scene.")
    .waitFor();
  assert.equal(
    await p.evaluate(
      () => (window as unknown as { permissions: number }).permissions,
    ),
    0,
  );
  const url = [...scripts].find(([, body]) =>
    body.includes("peep-box-active"),
  )![0];
  assert.equal(
    await p.evaluate(
      (url) =>
        (window as unknown as { peepRaf: string[] }).peepRaf.filter((s) =>
          s.includes(url),
        ).length,
      url,
    ),
    0,
  );
});
