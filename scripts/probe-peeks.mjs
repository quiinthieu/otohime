// Drives headless Chromium over Fan-out Peeks on /projects and /music. Run by scripts/probe-peeks.sh, which
// installs Playwright into PW_PREFIX and passes BASE_URL.
//
// Input is real: the mouse, the keyboard, and CDP touch sequences on the phone. What is read back is what a
// user or an assistive technology meets: the fan (#peek-panel) by role and name, its cards' hrefs against the
// served /peeks.json, the trigger's aria-expanded, focus, the page URL, and the fan's box against the viewport.
// document.startViewTransition is counted by an init script, and a pageswap listener records whether a
// cross-document hop ran a view transition and which names the old page carried.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const SHOTS_DIR = process.env.SHOTS_DIR || "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const HOVER_MS = 250;

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

// Before any page script: count view transitions, and on a cross-document hop note what the old page carried.
function instrument() {
  window.__vt = 0;
  if (document.startViewTransition) {
    const real = document.startViewTransition.bind(document);
    document.startViewTransition = (...args) => {
      window.__vt++;
      return real(...args);
    };
  }
  addEventListener("pageswap", (e) => {
    const names = [...document.querySelectorAll(".peek-title, .project-title")].map((el) => [
      el.className,
      el.textContent,
      getComputedStyle(el).viewTransitionName,
    ]);
    sessionStorage.setItem("probe-swap", JSON.stringify({ vt: !!e.viewTransition, names }));
  });
}

async function open(browser, { viewport, reduced = false, url }) {
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
  await page.addInitScript(instrument);
  await goto(page, url);
  return { context, page };
}

// Load a page and wait until React has hydrated a marked element (its props are on the node).
async function goto(page, url) {
  await page.goto(`${BASE_URL}${url}`, { waitUntil: "load" });
  await hydrated(page);
}

async function hydrated(page) {
  await page.waitForFunction(
    () => {
      const el = document.querySelector("[data-peek]");
      return el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
    },
    null,
    { timeout: 15000 },
  );
  await sleep(200);
}

const fan = (page) => page.locator("#peek-panel");
const isOpen = async (page) => (await fan(page).count()) > 0 && (await fan(page).getAttribute("data-state")) === "open";
const waitOpen = (page, timeout = 3000) =>
  page.waitForSelector('#peek-panel[data-state="open"]', { state: "attached", timeout }).then(
    () => true,
    () => false,
  );
const waitGone = (page, timeout = 2000) =>
  page.waitForSelector("#peek-panel", { state: "detached", timeout }).then(
    () => true,
    () => false,
  );

const readFan = (page) =>
  page.evaluate(() => {
    const el = document.getElementById("peek-panel");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cards = [...el.querySelectorAll(".peek-card")].map((c) => {
      const s = getComputedStyle(c);
      return { href: c.getAttribute("href"), transform: s.transform, animation: s.animationName, rect: c.getBoundingClientRect().toJSON() };
    });
    return {
      label: el.getAttribute("aria-label"),
      role: el.getAttribute("role"),
      state: el.dataset.state,
      via: el.dataset.via,
      side: el.dataset.side,
      rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
      viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      cards,
      scrollsSideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });

// A computed transform's rotation in degrees: matrix(a, b, ...) turns by atan2(b, a).
const tilt = (transform) => {
  const m = /^matrix\(([^)]+)\)$/.exec(transform);
  if (!m) return 0;
  const [a, b] = m[1].split(",").map(Number);
  return (Math.atan2(b, a) * 180) / Math.PI;
};

const insideViewport = (f) =>
  !!f &&
  f.cards.length === 3 &&
  [f.rect, ...f.cards.map((c) => c.rect)].every((r) => r.left >= 0 && r.top >= 0 && r.right <= f.viewport.width && r.bottom <= f.viewport.height);

const titleOf = (page, name) => page.locator(".project-title", { hasText: name }).first();
const centre = async (locator) => {
  const b = await locator.boundingBox();
  return [b.x + b.width / 2, b.y + b.height / 2];
};
const expectedHrefs = (index, key) => index.peeks[key].map((id) => index.items[id].href);
const active = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return { peek: a?.getAttribute("data-peek") ?? null, card: !!a?.classList.contains("peek-card"), href: a?.getAttribute("href") ?? null, text: a?.textContent ?? "" };
  });

// An empty spot: the page's left gutter under the nav, far from any marked element.
const PARK = [8, DESKTOP.height - 8];

async function shot(page, name) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
}

// One finger: down, optionally drift, hold, up. CDP touch events, so pointer events, touch-action and the
// click the browser synthesises are all real.
async function touch(page, [x, y], { hold = 0, drift = 0 } = {}) {
  const cdp = await page.context().newCDPSession(page);
  const point = (px, py) => [{ x: px, y: py, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(x, y) });
  if (drift) {
    for (let i = 1; i <= 6; i++) {
      await sleep(15);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(x, y + (drift * i) / 6) });
    }
  }
  await sleep(hold);
  const during = { open: await isOpen(page), url: page.url() };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  return during;
}

async function desktop(browser, index) {
  const { context, page } = await open(browser, { viewport: DESKTOP, url: "/projects" });
  const shore = titleOf(page, "Shore");

  // Negative: a pass-through shorter than the intent opens nothing.
  await page.mouse.move(...PARK);
  await page.mouse.move(...(await centre(shore)), { steps: 2 });
  await sleep(90);
  await page.mouse.move(...PARK, { steps: 2 });
  await sleep(HOVER_MS + 400);
  check("desktop: a pass-through hover shorter than the intent opens no fan", (await fan(page).count()) === 0);

  // Hover with intent fans out the three indexed cards.
  const t0 = Date.now();
  await page.mouse.move(...(await centre(shore)), { steps: 2 });
  const opened = await waitOpen(page);
  const took = Date.now() - t0;
  check("desktop: hovering a marked project title fans out", opened);
  check(`desktop: the fan waits for intent (${took} ms >= ${HOVER_MS - 30} ms)`, took >= HOVER_MS - 30);
  await sleep(500);
  let f = await readFan(page);
  check("desktop: the fan is a group named for its link", f?.role === "group" && f?.label === "Related to Shore", JSON.stringify(f?.label));
  check(
    "desktop: its cards are the index's three for project:shore, in order",
    JSON.stringify(f?.cards.map((c) => c.href)) === JSON.stringify(expectedHrefs(index, "project:shore")),
    JSON.stringify(f?.cards.map((c) => c.href)),
  );
  check("desktop: the trigger says it is expanded and names the fan", (await shore.getAttribute("aria-expanded")) === "true" && (await shore.getAttribute("aria-controls")) === "peek-panel");
  const tilts = f?.cards.map((c) => tilt(c.transform)) ?? [];
  check(
    "desktop: the outer cards tilt opposite ways, the middle one does not",
    tilts.length === 3 && tilts[0] < -2 && tilts[2] > 2 && Math.abs(tilts[1]) < 0.5,
    JSON.stringify(tilts),
  );
  check("desktop: the fan is inside the viewport", insideViewport(f), JSON.stringify(f?.rect));
  await shot(page, "desktop-hover");

  // The pointer can travel from the link into the fan without it closing.
  const [cx, cy] = [f.cards[1].rect.x + f.cards[1].rect.width / 2, f.cards[1].rect.y + f.cards[1].rect.height / 2];
  await page.mouse.move(cx, cy, { steps: 8 });
  await sleep(600);
  check("desktop: moving into the fan keeps it open", await isOpen(page));

  // Leaving tucks it back.
  await page.mouse.move(...PARK, { steps: 4 });
  const tucking = await page.waitForSelector('#peek-panel[data-state="closing"]', { state: "attached", timeout: 1500 }).then(
    () => true,
    () => false,
  );
  check("desktop: leaving tucks the cards back", tucking);
  check("desktop: and then the fan is gone", await waitGone(page));
  check("desktop: the trigger is no longer expanded", (await shore.getAttribute("aria-expanded")) === null);

  // Negative: an unmarked nav link opens nothing.
  await page.mouse.move(...(await centre(page.locator(".nav-item").first())), { steps: 2 });
  await sleep(HOVER_MS + 500);
  check("desktop: hovering an unmarked nav link opens no fan", (await fan(page).count()) === 0);
  await page.mouse.move(...PARK);

  // Negative: a stale marker (a key the index does not know) is left a plain link.
  await page.evaluate(() => {
    const a = document.createElement("a");
    a.href = "/notes";
    a.id = "stale";
    a.dataset.peek = "project:not-in-the-index";
    a.textContent = "Stale marker";
    a.style.cssText = "position:fixed;left:240px;top:120px;z-index:70;background:var(--paper)";
    document.body.append(a);
  });
  await page.mouse.move(...(await centre(page.locator("#stale"))), { steps: 2 });
  await sleep(HOVER_MS + 500);
  check("desktop: a stale marker opens no fan", (await fan(page).count()) === 0);
  await page.locator("#stale").click();
  await page.waitForURL(/\/notes$/, { timeout: 10000 }).catch(() => {});
  check("desktop: and still follows its link", new URL(page.url()).pathname === "/notes");
  await goto(page, "/projects");

  // Edges: the rightmost title, hovered at its right end, and a title near the bottom of the window.
  const right = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".project-title")];
    const r = els.map((el) => el.getBoundingClientRect()).sort((a, b) => b.right - a.right)[0];
    return [r.right - 3, r.top + r.height / 2];
  });
  await page.mouse.move(...right, { steps: 2 });
  await waitOpen(page);
  await sleep(400);
  f = await readFan(page);
  check("desktop edge: near the right edge the fan is pushed inside", insideViewport(f) && f.rect.right <= DESKTOP.width - 7, JSON.stringify(f?.rect));
  await page.mouse.move(...PARK, { steps: 2 });
  await waitGone(page);

  const last = page.locator(".project-title").last();
  await page.evaluate(() => {
    const els = document.querySelectorAll(".project-title");
    const el = els[els.length - 1];
    const top = el.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, top - (document.documentElement.clientHeight - 40));
  });
  await sleep(300);
  await page.mouse.move(...(await centre(last)), { steps: 2 });
  await waitOpen(page);
  await sleep(400);
  f = await readFan(page);
  check("desktop edge: near the bottom the fan flips above, inside the viewport", f?.side === "above" && insideViewport(f), JSON.stringify({ side: f?.side, rect: f?.rect }));
  await shot(page, "desktop-bottom");

  // A scroll cannot carry a fan pinned to the pointer: it closes.
  await page.mouse.wheel(0, -200);
  check("desktop: scrolling closes a hover fan", await waitGone(page));
  await page.mouse.move(...PARK);

  // Keyboard: focus opens at once, the arrows walk the cards, Escape returns to the link.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.keyboard.press("Tab");
  let a = await active(page);
  for (let i = 0; i < 60 && a.peek !== "project:shore"; i++) {
    await page.keyboard.press("Tab");
    a = await active(page);
  }
  check("keys: Tab reaches the Shore title", a.peek === "project:shore", JSON.stringify(a));
  check("keys: keyboard focus opens the fan at once", await waitOpen(page, 1500));
  f = await readFan(page);
  check("keys: the focus fan is anchored on the link, inside the viewport", f?.via === "focus" && insideViewport(f), JSON.stringify({ via: f?.via }));
  await page.keyboard.press("ArrowDown");
  a = await active(page);
  check("keys: Down arrow moves into the first card", a.card && a.href === expectedHrefs(index, "project:shore")[0], JSON.stringify(a));
  await page.keyboard.press("ArrowRight");
  a = await active(page);
  check("keys: Right arrow moves to the next card", a.card && a.href === expectedHrefs(index, "project:shore")[1], JSON.stringify(a));
  await page.keyboard.press("End");
  a = await active(page);
  check("keys: End moves to the last card", a.card && a.href === expectedHrefs(index, "project:shore")[2], JSON.stringify(a));
  await page.keyboard.press("ArrowRight");
  a = await active(page);
  check("keys: the arrows wrap", a.card && a.href === expectedHrefs(index, "project:shore")[0], JSON.stringify(a));
  await page.keyboard.press("Escape");
  check("keys: Escape closes the fan", await waitGone(page));
  a = await active(page);
  check("keys: and returns focus to the link", a.peek === "project:shore", JSON.stringify(a));
  await sleep(400);
  check("keys: returning focus does not reopen it", (await fan(page).count()) === 0);
  await page.keyboard.press("Tab");
  check("keys: Tab to the next marked link opens its fan", (await waitOpen(page, 1500)) && (await readFan(page))?.label === "Related to Capsule");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  await sleep(300);
  a = await active(page);
  check("keys: Tab from the last card leaves where the link sits (the next title)", a.peek === "project:orrery", JSON.stringify(a));
  check("keys: and that title fans out in turn", (await waitOpen(page, 1500)) && (await readFan(page))?.label === "Related to Orrery");
  await page.keyboard.press("Escape");
  await waitGone(page);

  // A project card hops to its project, its title carrying the project's hop name, the old one lent away.
  const capsuleKey = "project:capsule";
  const target = index.peeks[capsuleKey].map((id) => index.items[id]).find((it) => it.kind === "project");
  if (target) {
    await page.mouse.move(...(await centre(titleOf(page, "Capsule"))), { steps: 2 });
    await waitOpen(page);
    await sleep(400);
    await page.locator(`#peek-panel .peek-card[href="${target.href}"]`).click();
    await page.waitForURL((u) => u.pathname === target.href, { timeout: 15000 }).catch(() => {});
    check(`card: a project card follows its link (${target.href})`, new URL(page.url()).pathname === target.href, page.url());
    await page.waitForLoadState("load");
    const swap = JSON.parse((await page.evaluate(() => sessionStorage.getItem("probe-swap"))) ?? "null");
    const name = `project-${target.href.slice(1)}`;
    const named = (swap?.names ?? []).filter((n) => n[2] === name);
    check("card: the hop ran a cross-document view transition", swap?.vt === true, JSON.stringify(swap?.vt));
    check(
      `card: exactly one element carried ${name} on the old page, the card's title`,
      named.length === 1 && named[0][0] === "peek-title",
      JSON.stringify(named),
    );
  } else check("card: project:capsule has a project card to follow", false);

  await context.close();
}

async function music(browser, index) {
  const { context, page } = await open(browser, { viewport: DESKTOP, url: "/music" });
  const credit = page.locator('button[data-peek="credit:adela"]');
  await credit.scrollIntoViewIfNeeded();
  await credit.click();
  check("credit: clicking a credit button opens its fan", await waitOpen(page, 2000));
  let f = await readFan(page);
  check(
    "credit: its cards are the index's three for credit:adela",
    JSON.stringify(f?.cards.map((c) => c.href)) === JSON.stringify(expectedHrefs(index, "credit:adela")),
    JSON.stringify(f?.cards.map((c) => c.href)),
  );
  check("credit: the button reports aria-expanded=true", (await credit.getAttribute("aria-expanded")) === "true");
  await page.mouse.move(...PARK, { steps: 3 });
  await sleep(600);
  check("credit: a clicked fan stays open when the pointer leaves", await isOpen(page));
  await credit.click();
  check("credit: clicking again closes it", await waitGone(page));
  await credit.focus();
  await page.keyboard.press("Enter");
  check("credit: Enter on the button toggles it open", await waitOpen(page, 2000));
  await page.mouse.click(...PARK);
  check("credit: a press outside closes it", await waitGone(page));

  // A card inside the site navigates in a view transition, and the fan leaves with the page.
  const inSite = index.peeks["credit:adela"].map((id) => index.items[id]).find((it) => ["/notes", "/sketches", "/projects", "/work"].includes(it.href.split("#")[0]));
  if (inSite) {
    await credit.click();
    await waitOpen(page, 2000);
    await sleep(400);
    const before = await page.evaluate(() => window.__vt);
    await page.locator(`#peek-panel .peek-card[href="${inSite.href}"]`).click();
    await page.waitForURL((u) => u.pathname === inSite.href.split("#")[0], { timeout: 15000 }).catch(() => {});
    await sleep(800);
    check(`card: a site card navigates (${inSite.href})`, new URL(page.url()).pathname === inSite.href.split("#")[0], page.url());
    const after = await page.evaluate(() => window.__vt);
    check("card: inside a view transition", after > before, `${before} -> ${after}`);
    check("card: no fan is left on the new page", (await fan(page).count()) === 0);
  } else check("card: credit:adela has a site card to follow", false);
  await context.close();
}

async function phone(browser, index) {
  const { context, page } = await open(browser, { viewport: PHONE, url: "/projects" });
  const shore = titleOf(page, "Shore");
  await shore.scrollIntoViewIfNeeded();
  await sleep(200);

  // Negative: a long-press that moves is a scroll, not a peek.
  await touch(page, await centre(shore), { hold: 700, drift: 40 });
  await sleep(200);
  check("touch: a press that moves opens no fan", (await fan(page).count()) === 0);
  check("touch: and does not follow the link", new URL(page.url()).pathname === "/projects", page.url());
  await shore.scrollIntoViewIfNeeded();
  await sleep(200);

  const during = await touch(page, await centre(shore), { hold: 650 });
  check("touch: a long-press opens the fan while the finger is down", during.open);
  await sleep(600);
  check("touch: releasing does not follow the link", new URL(page.url()).pathname === "/projects", page.url());
  check("touch: the fan stays open after release", await isOpen(page));
  const f = await readFan(page);
  check("touch: the fan fits the phone, no sideways scroll", insideViewport(f) && !f.scrollsSideways, JSON.stringify(f?.rect));
  check("touch: its cards are the index's three", JSON.stringify(f?.cards.map((c) => c.href)) === JSON.stringify(expectedHrefs(index, "project:shore")));
  await shot(page, "phone-long-press");

  // A tap outside closes it; a plain tap on the link still follows it.
  await touch(page, [PHONE.width / 2, 12]);
  check("touch: a tap outside closes the fan", await waitGone(page));
  await shore.scrollIntoViewIfNeeded();
  await shore.tap();
  await page.waitForURL(/\/shore$/, { timeout: 15000 }).catch(() => {});
  check("touch: a plain tap follows the link", new URL(page.url()).pathname === "/shore", page.url());

  await goto(page, "/music");
  const credit = page.locator('button[data-peek="credit:jennie"]');
  await credit.scrollIntoViewIfNeeded();
  await credit.tap();
  check("touch: tapping a credit button opens its fan", await waitOpen(page, 2000));
  const g = await readFan(page);
  check("touch: the credit fan fits the phone", insideViewport(g) && !g.scrollsSideways, JSON.stringify(g?.rect));
  await context.close();
}

async function reducedMotion(browser) {
  const { context, page } = await open(browser, { viewport: DESKTOP, reduced: true, url: "/projects" });
  await page.mouse.move(...PARK);
  await page.mouse.move(...(await centre(titleOf(page, "Orrery"))), { steps: 2 });
  check("reduced: hovering still opens the fan", await waitOpen(page));
  await sleep(100);
  const f = await readFan(page);
  check(
    "reduced: the cards lie flat, with no animation",
    !!f && f.cards.every((c) => c.transform === "none" && c.animation === "none"),
    JSON.stringify(f?.cards.map((c) => [c.transform, c.animation])),
  );
  check("reduced: the fan is inside the viewport", insideViewport(f));
  await page.mouse.move(...PARK, { steps: 2 });
  await sleep(320);
  check("reduced: leaving removes it at once, with no tuck", (await fan(page).count()) === 0);
  await context.close();
}

const browser = await chromium.launch();
try {
  const res = await fetch(`${BASE_URL}/peeks.json`);
  const index = res.ok ? await res.json() : null;
  check("/peeks.json is served", !!index?.peeks);
  if (index) {
    for (const [name, run] of [
      ["desktop", desktop],
      ["music", music],
      ["phone", phone],
      ["reduced", reducedMotion],
    ]) {
      try {
        await run(browser, index);
      } catch (e) {
        check(`${name}: ran to the end`, false, e.message.split("\n")[0]);
      }
    }
  }
} finally {
  await browser.close();
}

check("no console or page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
