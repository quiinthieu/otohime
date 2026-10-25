// Drives headless Chromium over the /projects cartridges. Run by scripts/probe-cartridges.sh, which installs
// Playwright into PW_PREFIX and passes BASE_URL and EXPECTED (content/site.ts's projectList as JSON).
//
// Every check reads the page the browser laid out: the rows and links from the DOM and the accessibility tree,
// the lift from the cartridge's bounding box once its 160 ms glide has landed (and its computed translate), the
// fit from each label's own box against its children's, the contrast from computed colours. Each negative
// control runs the same check function against a page knocked out on purpose, and that check must fail.
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const SHOTS_DIR = process.env.SHOTS_DIR || "";
const EXPECTED = JSON.parse(readFileSync(process.env.EXPECTED, "utf8"));
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const LIST = "main ul.cartridges";
const LIFT = 6;
const PRESS = 2;
const GLIDE = 320;

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

function watchHops() {
  addEventListener("pagereveal", (e) => {
    const vt = e.viewTransition;
    window.__probe = { reveal: vt !== null, types: vt ? [...vt.types] : [], groups: [], done: vt === null };
    if (!vt) return;
    vt.ready
      .then(() => {
        window.__probe.groups = document.documentElement
          .getAnimations({ subtree: true })
          .filter((a) => /^::view-transition-group\(project-/.test(a.effect?.pseudoElement ?? ""))
          .map((a) => {
            const [first] = a.effect.getKeyframes();
            return { pseudo: a.effect.pseudoElement, width: parseFloat(first?.width ?? "NaN"), height: parseFloat(first?.height ?? "NaN") };
          });
      })
      .catch(() => {});
    const done = () => void (window.__probe.done = true);
    vt.finished.then(done, done);
  });
}

async function open(browser, { viewport, scheme = "light", reduced = false, js = true, sink = errors }) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: scheme,
    reducedMotion: reduced ? "reduce" : "no-preference",
    javaScriptEnabled: js,
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const from = m.location().url;
    sink.push(`console ${page.url()}: ${m.text()}${from && from !== page.url() ? ` (${from})` : ""}`);
  });
  page.on("pageerror", (e) => sink.push(`pageerror ${page.url()}: ${e.message}`));
  if (js) await page.addInitScript(watchHops);
  return { context, page };
}

async function load(page) {
  await page.goto(`${BASE_URL}/projects`, { waitUntil: "load" });
  await page.locator(LIST).waitFor({ timeout: 15000 });
  // The rows rise in (0.4 s, 40 ms apart); measure the resting shelf.
  await page.waitForFunction(
    (sel) => [...document.querySelectorAll(`${sel} > li`)].every((li) => li.getAnimations().every((a) => a.playState !== "running")),
    LIST,
    { timeout: 5000 },
  ).catch(() => {});
}

// The shelf as rendered, row by row.
const rows = (page) =>
  page.evaluate((sel) => {
    const lum = (c) => {
      const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => {
        const s = Number(v) / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
      return (x + 0.05) / (y + 0.05);
    };
    return [...document.querySelectorAll(`${sel} > li`)].map((li) => {
      const cart = li.querySelector(".cartridge");
      const label = cart?.querySelector(".cartridge-label");
      const links = [...li.querySelectorAll("a")];
      const link = li.querySelector("a.project-title");
      const note = label?.querySelector(".cartridge-note");
      const shell = cart?.querySelector("svg.cartridge-shell");
      const lr = label?.getBoundingClientRect();
      const inside = label
        ? [...label.querySelectorAll("*")].every((el) => {
            const r = el.getBoundingClientRect();
            return r.left >= lr.left - 0.5 && r.right <= lr.right + 0.5 && r.top >= lr.top - 0.5 && r.bottom <= lr.bottom + 0.5;
          })
        : false;
      const cr = cart?.getBoundingClientRect();
      return {
        rise: li.classList.contains("rise"),
        i: li.style.getPropertyValue("--i"),
        links: links.length,
        href: link?.getAttribute("href") ?? null,
        vt: link?.style.getPropertyValue("--vt") ?? null,
        vtName: link ? getComputedStyle(link).viewTransitionName : null,
        title: link?.textContent ?? null,
        badge: li.querySelector(".badge")?.textContent ?? null,
        note: note?.textContent ?? null,
        shell: shell
          ? {
              hidden: shell.getAttribute("aria-hidden") === "true",
              parts: ["shadow", "body", "cut", "notch", "stamp"].filter((p) => shell.querySelector(`.cartridge-${p}`)),
            }
          : null,
        fits: Boolean(label) && label.scrollWidth <= label.clientWidth && label.scrollHeight <= label.clientHeight && inside,
        noteSize: note ? parseFloat(getComputedStyle(note).fontSize) : 0,
        contrast: label && note ? ratio(getComputedStyle(note).color, getComputedStyle(label).backgroundColor) : 0,
        titleContrast: label && link ? ratio(getComputedStyle(link).color, getComputedStyle(label).backgroundColor) : 0,
        box: cr ? { x: Math.round(cr.left), y: cr.top, w: cr.width, h: cr.height, right: cr.right } : null,
      };
    });
  }, LIST);

// The rows match content/site.ts: count, order, hrefs, names, text and the rise identity.
function parity(got) {
  const want = EXPECTED;
  const bad = [];
  if (got.length !== want.length) bad.push(`${got.length} rows, want ${want.length}`);
  want.forEach((p, i) => {
    const r = got[i];
    if (!r) return;
    if (!r.rise || r.i !== String(i)) bad.push(`row ${i}: rise ${r.rise} --i ${r.i}`);
    if (r.links !== 1) bad.push(`row ${i}: ${r.links} links`);
    if (r.href !== (p.href ?? null)) bad.push(`row ${i}: href ${r.href}, want ${p.href}`);
    if (p.href && r.vt !== `project-${p.href.slice(1)}`) bad.push(`row ${i}: --vt ${r.vt}`);
    if (p.href && r.vtName !== `project-${p.href.slice(1)}`) bad.push(`row ${i}: view-transition-name ${r.vtName}`);
    if (r.title !== p.title || r.badge !== p.status || r.note !== p.note) bad.push(`row ${i}: text ${r.title}/${r.badge}`);
  });
  return bad;
}

// Nothing on the shelf (or the page) is filtered, and the page never scrolls sideways.
const layout = (page) =>
  page.evaluate((sel) => {
    const shelf = document.querySelector(sel);
    const filtered = [shelf, ...shelf.querySelectorAll("*")].filter(
      (el) => getComputedStyle(el).filter !== "none" || el.hasAttribute("filter"),
    );
    return {
      filtered: filtered.map((el) => el.className?.baseVal ?? el.className).slice(0, 3),
      scrollWidth: document.scrollingElement.scrollWidth,
      innerWidth,
      hover: matchMedia("(hover: hover)").matches,
    };
  }, LIST);

const cartBox = (page, n) =>
  page.evaluate(
    ([sel, n]) => {
      const cart = document.querySelectorAll(`${sel} > li .cartridge`)[n];
      const r = cart.getBoundingClientRect();
      return { y: r.top, x: r.left, w: r.width, h: r.height, translate: getComputedStyle(cart).translate, shadow: getComputedStyle(cart.querySelector(".cartridge-shadow")).translate };
    },
    [LIST, n],
  );

// Brings a cartridge to the middle of the viewport, so the mouse can reach it.
const reveal = (page, n) =>
  page.evaluate(
    ([sel, n]) => document.querySelectorAll(`${sel} > li .cartridge`)[n].scrollIntoView({ block: "center", behavior: "instant" }),
    [LIST, n],
  );

// A point on the cartridge's body, below its label text: not on the title's words.
async function bodyPoint(page, n) {
  const b = await cartBox(page, n);
  return [b.x + b.w * 0.5, b.y + b.h - 12];
}

async function shot(page, name) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS_DIR, `${name}.png`), fullPage: true });
}

// The shelf checks every view shares; returns the rows for view-specific checks.
async function shelf(page, label, { phone }) {
  const got = await rows(page);
  const bad = parity(got);
  check(`${label}: the rows match content/site.ts (${EXPECTED.length}: li.rise, --i, one link, href, --vt, text)`, bad.length === 0, bad.slice(0, 3).join("; "));
  const snapshot = await page.locator(LIST).ariaSnapshot();
  const named = EXPECTED.filter((p) => p.href).every((p) => snapshot.includes(`- link "${p.title}"`));
  check(`${label}: the list's items are links named by the title alone`, named && (snapshot.match(/- listitem/g) ?? []).length === EXPECTED.length, snapshot.slice(0, 200));
  check(`${label}: every shell is hidden from assistive tech and has shadow, body, corner, connector and stamp`, got.every((r) => r.shell?.hidden && r.shell.parts.length === 5), JSON.stringify(got.map((r) => r.shell)).slice(0, 200));
  const l = await layout(page);
  check(`${label}: no filter anywhere on the shelf`, l.filtered.length === 0, l.filtered.join(", "));
  check(`${label}: nothing scrolls sideways`, l.scrollWidth <= l.innerWidth, `${l.scrollWidth} > ${l.innerWidth}`);
  check(`${label}: every cartridge sits inside the viewport`, got.every((r) => r.box && r.box.x >= 0 && r.box.right <= l.innerWidth), JSON.stringify(got.map((r) => r.box)).slice(0, 200));
  check(`${label}: every label's text fits inside its label`, got.every((r) => r.fits), got.filter((r) => !r.fits).map((r) => r.title).join(", "));
  check(`${label}: label text is >= 12px and >= 4.5:1 on its swatch`, got.every((r) => r.noteSize >= 12 && r.contrast >= 4.5 && r.titleContrast >= 4.5), got.map((r) => `${r.title} ${r.contrast.toFixed(1)}`).join(", "));
  const cols = new Set(got.map((r) => r.box?.x)).size;
  if (phone) check(`${label}: two columns, each >= 150px wide`, cols === 2 && got.every((r) => r.box.w >= 150), `${cols} columns, ${got.map((r) => r.box?.w.toFixed(0)).join(", ")}`);
  else check(`${label}: two or three columns`, cols === 2 || cols === 3, `${cols} columns`);
  return { got, layout: l };
}

// Hover over a cartridge's body and report how far it moved up from rest.
async function hoverLift(page, n) {
  await reveal(page, n);
  await page.mouse.move(2, 2);
  await sleep(GLIDE);
  const rest = await cartBox(page, n);
  const [x, y] = await bodyPoint(page, n);
  await page.mouse.move(x, y, { steps: 3 });
  await sleep(GLIDE);
  const lifted = await cartBox(page, n);
  await page.mouse.move(2, 2);
  await sleep(GLIDE);
  return { lift: rest.y - lifted.y, translate: lifted.translate, shadow: lifted.shadow };
}

// Tab to a cartridge's link and report the lift.
async function focusLift(page, n) {
  await reveal(page, n);
  const rest = await cartBox(page, n);
  await page.evaluate(([sel, n]) => {
    // Start just before the link, so the next Tab is a real keyboard focus on it.
    const link = document.querySelectorAll(`${sel} a.project-title`)[n];
    const before = document.createElement("button");
    before.dataset.probe = "before";
    before.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0";
    link.closest("li").before(before);
    before.focus();
  }, [LIST, n]);
  await page.keyboard.press("Tab");
  await sleep(GLIDE);
  const state = await page.evaluate(([sel, n]) => {
    const link = document.querySelectorAll(`${sel} a.project-title`)[n];
    return { focused: document.activeElement === link, visible: link.matches(":focus-visible"), outline: getComputedStyle(link).outlineStyle };
  }, [LIST, n]);
  const lifted = await cartBox(page, n);
  await page.evaluate(() => {
    document.activeElement?.blur();
    document.querySelector('[data-probe="before"]')?.remove();
  });
  await sleep(GLIDE);
  return { ...state, lift: rest.y - lifted.y };
}

// Press the mouse on a cartridge's body, read the push-in, then release elsewhere so nothing navigates.
async function pressIn(page, n) {
  await reveal(page, n);
  await page.mouse.move(2, 2);
  await sleep(GLIDE);
  const rest = await cartBox(page, n);
  const [x, y] = await bodyPoint(page, n);
  await page.mouse.move(x, y, { steps: 3 });
  await page.mouse.down();
  await sleep(GLIDE);
  const pressed = await cartBox(page, n);
  await page.mouse.move(2, 2, { steps: 3 });
  await page.mouse.up();
  await sleep(GLIDE);
  return { push: pressed.y - rest.y, translate: pressed.translate, path: new URL(page.url()).pathname };
}

// Click (or tap) a cartridge's body to its project; returns what the new document's pagereveal saw and the title
// box the old document had.
async function hopFrom(page, n, { tap = false } = {}) {
  await load(page);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const want = EXPECTED[n];
  await reveal(page, n);
  const title = await page.evaluate(([sel, n]) => {
    const r = document.querySelectorAll(`${sel} a.project-title`)[n].getBoundingClientRect();
    return { w: r.width, h: r.height };
  }, [LIST, n]);
  const [x, y] = await bodyPoint(page, n);
  const target = (u) => new URL(u).pathname === want.href;
  const went = await Promise.all([
    page.waitForURL(target, { waitUntil: "load", timeout: 15000 }),
    tap ? page.touchscreen.tap(x, y) : page.mouse.click(x, y),
  ]).then(
    () => true,
    () => false,
  );
  if (!went) return { title, probe: null, path: new URL(page.url()).pathname };
  await page.waitForFunction(() => window.__probe?.done === true, null, { timeout: 10_000 }).catch(() => {});
  const probe = await page.evaluate(() => window.__probe ?? null);
  return { title, probe, path: new URL(page.url()).pathname };
}

function checkHop(label, n, r) {
  const want = EXPECTED[n];
  const name = `project-${want.href.slice(1)}`;
  check(`${label}: a ${r.tapped ? "tap" : "click"} on ${want.title}'s cartridge body opens ${want.href}`, r.path === want.href, r.path);
  check(`${label}: the hop to ${want.href} is a view transition of type hop`, r.probe?.reveal === true && r.probe.types.includes("hop"), JSON.stringify(r.probe));
  const group = r.probe?.groups.find((g) => g.pseudo === `::view-transition-group(${name})`);
  check(
    `${label}: the ${name} group starts at the title's own box, not the card's`,
    group !== undefined && Math.abs(group.width - r.title.w) <= 2 && Math.abs(group.height - r.title.h) <= 2,
    `group ${JSON.stringify(group)}, title ${JSON.stringify(r.title)}`,
  );
}

async function desktop(browser, scheme) {
  const label = `desktop ${scheme}`;
  const { context, page } = await open(browser, { viewport: DESKTOP, scheme });
  try {
    await load(page);
    await shelf(page, label, { phone: false });
    await shot(page, `desktop-${scheme}`);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    for (const n of [0, EXPECTED.length - 1]) {
      const h = await hoverLift(page, n);
      check(`${label}: hovering ${EXPECTED[n].title} lifts it ${LIFT}px, its shadow staying down`, Math.abs(h.lift - LIFT) <= 0.5 && h.shadow === `0px ${LIFT}px`, JSON.stringify(h));
    }
    const f = await focusLift(page, 1);
    check(`${label}: Tab focus on a title shows a focus ring and lifts its cartridge ${LIFT}px`, f.focused && f.visible && f.outline !== "none" && Math.abs(f.lift - LIFT) <= 0.5, JSON.stringify(f));
    const p = await pressIn(page, 2);
    check(`${label}: pressing a cartridge pushes it ${PRESS}px in, and releasing off it stays on /projects`, Math.abs(p.push - PRESS) <= 0.5 && p.path === "/projects", JSON.stringify(p));
    for (const n of [0, EXPECTED.length - 1]) checkHop(label, n, await hopFrom(page, n));
  } finally {
    await context.close();
  }
}

async function phone(browser, scheme) {
  const label = `phone ${scheme}`;
  const { context, page } = await open(browser, { viewport: PHONE, scheme });
  try {
    await load(page);
    const { layout: l } = await shelf(page, label, { phone: true });
    check(`${label}: a touch screen has no hover, so no hover lift`, l.hover === false, String(l.hover));
    await shot(page, `phone-${scheme}`);
    const r = await hopFrom(page, 3, { tap: true });
    checkHop(label, 3, { ...r, tapped: true });
  } finally {
    await context.close();
  }
}

async function reduced(browser) {
  const label = "reduced motion";
  const { context, page } = await open(browser, { viewport: DESKTOP, reduced: true });
  try {
    await load(page);
    await shelf(page, label, { phone: false });
    const h = await hoverLift(page, 0);
    check(`${label}: hover leaves the cartridge on the shelf`, Math.abs(h.lift) <= 0.5 && h.translate === "none", JSON.stringify(h));
    const f = await focusLift(page, 1);
    check(`${label}: focus shows the ring and leaves the cartridge still`, f.focused && f.visible && Math.abs(f.lift) <= 0.5, JSON.stringify(f));
    const p = await pressIn(page, 2);
    check(`${label}: a press leaves the cartridge still`, Math.abs(p.push) <= 0.5 && p.path === "/projects", JSON.stringify(p));
  } finally {
    await context.close();
  }
  // The preference switched on while a cartridge is lifted puts it straight back.
  const live = await open(browser, { viewport: DESKTOP });
  try {
    await load(live.page);
    const [x, y] = await bodyPoint(live.page, 0);
    const rest = await cartBox(live.page, 0);
    await live.page.mouse.move(x, y, { steps: 3 });
    await sleep(GLIDE);
    const up = await cartBox(live.page, 0);
    await live.page.emulateMedia({ reducedMotion: "reduce" });
    await sleep(60);
    const after = await cartBox(live.page, 0);
    check(`${label}: switched on mid-hover, the lifted cartridge drops back at once`, Math.abs(rest.y - up.y - LIFT) <= 0.5 && Math.abs(after.y - rest.y) <= 0.5, `rest ${rest.y}, up ${up.y}, after ${after.y}`);
  } finally {
    await live.context.close();
  }
}

async function noJs(browser) {
  for (const viewport of [DESKTOP, PHONE]) {
    const label = `no-JS ${viewport === PHONE ? "phone" : "desktop"}`;
    const { context, page } = await open(browser, { viewport, js: false });
    try {
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "load" });
      await sleep(600);
      await shelf(page, label, { phone: viewport === PHONE });
    } finally {
      await context.close();
    }
  }
}

// The same checks against pages knocked out on purpose; each must fail.
async function negatives(browser) {
  const sink = [];
  const { context, page } = await open(browser, { viewport: DESKTOP, sink });
  try {
    await load(page);
    await page.evaluate((sel) => document.querySelector(`${sel} a.project-title`).setAttribute("href", "/nowhere"), LIST);
    check("negative control: a wrong href fails the content parity check", parity(await rows(page)).some((b) => b.includes("/nowhere")));

    await load(page);
    await page.addStyleTag({ content: ".cartridge { translate: none !important; }" });
    const h = await hoverLift(page, 0);
    check("negative control: with the lift knocked out, the hover check sees no 6px lift", Math.abs(h.lift - LIFT) > 0.5, JSON.stringify(h));

    await load(page);
    await page.addStyleTag({ content: ".cartridge-note { white-space: nowrap; }" });
    check("negative control: a label forced onto one line fails the fit check", (await rows(page)).some((r) => !r.fits));

    await load(page);
    await page.evaluate((sel) => (document.querySelector(`${sel} .cartridge`).style.filter = "blur(0.5px)"), LIST);
    check("negative control: a filter on one card fails the no-filter check", (await layout(page)).filtered.length === 1);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch();
try {
  for (const scheme of ["light", "dark"]) await desktop(browser, scheme);
  for (const scheme of ["light", "dark"]) await phone(browser, scheme);
  await reduced(browser);
  await noJs(browser);
  await negatives(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
