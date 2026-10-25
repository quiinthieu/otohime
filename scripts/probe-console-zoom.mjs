// Drives headless Chromium over the pocket console's A: the chosen label morphs into the page's h1 and the page
// grows out of the LCD. Run by scripts/probe-console-zoom.sh, which installs Playwright into PW_PREFIX and passes
// BASE_URL (and EXPECT_SHA, checked if set).
//
// An init script, before any page script, wraps Document.prototype.startViewTransition. At the call, which React
// makes after naming the parts it animates and before the browser snapshots the old page, it records the
// transition's types and the console label (its name, whether it is painted, its box); once the transition is
// ready it records every ::view-transition animation, the first and last keyframe of the title-* group and the
// transform-origin of each console-zoom. A MutationObserver counts every time the label is shown.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const EXPECT_SHA = process.env.EXPECT_SHA ?? "";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const MENU = [
  ["/work", "Work"],
  ["/play", "Play"],
  ["/notes", "Notes"],
  ["/music", "Music"],
  ["/projects", "Projects"],
  ["/sketches", "Sketches"],
];
const LIMIT = 400; // the whole console transition, ms
const NEAR = 3; // px
const RISE = 6; // px: the page's .rise starts this far down, where the new snapshot catches the h1

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

function instrument({ unsupported }) {
  window.__vt = [];
  window.__shown = 0;
  if (unsupported) {
    delete Document.prototype.startViewTransition;
    return;
  }
  const start = Document.prototype.startViewTransition;
  const visibleLabel = () => [...document.querySelectorAll(".console-label")].find((l) => l.closest("section")?.checkVisibility());
  Document.prototype.startViewTransition = function (arg) {
    const label = visibleLabel();
    const named = [...document.querySelectorAll("*")].filter((el) => /^title-/.test(getComputedStyle(el).viewTransitionName));
    const rec = {
      at: location.pathname,
      types: arg && arg.types ? [...arg.types] : [],
      label: label
        ? {
            name: getComputedStyle(label).viewTransitionName,
            painted: label.checkVisibility({ visibilityProperty: true }),
            text: label.textContent,
            w: label.offsetWidth,
            h: label.offsetHeight,
          }
        : null,
      named: named.map((el) => getComputedStyle(el).viewTransitionName),
      anims: null,
      error: null,
      finished: false,
    };
    window.__vt.push(rec);
    const vt = start.call(this, arg);
    vt.ready.then(
      () => {
        rec.anims = document.documentElement
          .getAnimations({ subtree: true })
          .filter((a) => a.effect?.pseudoElement?.startsWith("::view-transition-"))
          .map((a) => {
            const t = a.effect.getComputedTiming();
            const pseudo = a.effect.pseudoElement;
            const out = { pseudo, name: a.animationName ?? "", duration: Number(t.duration), delay: t.delay };
            if (/^::view-transition-group\(title-/.test(pseudo)) {
              const kf = a.effect.getKeyframes();
              out.from = { transform: kf[0]?.transform, width: kf[0]?.width, height: kf[0]?.height };
              out.to = { transform: kf.at(-1)?.transform, width: kf.at(-1)?.width, height: kf.at(-1)?.height };
            }
            if (out.name === "console-zoom") out.origin = getComputedStyle(document.documentElement, pseudo).transformOrigin;
            return out;
          });
      },
      (e) => (rec.error = String(e)),
    );
    vt.finished.then(
      () => (rec.finished = true),
      () => (rec.finished = true),
    );
    return vt;
  };
  new MutationObserver((records) => {
    for (const r of records) if (r.target.classList?.contains("console-label") && r.target.hasAttribute("data-open")) window.__shown++;
  }).observe(document, { attributes: true, attributeFilter: ["data-open"], subtree: true });
}

function watch(page, sink) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const from = m.location().url;
    sink.push(`console ${page.url()}: ${m.text()}${from && from !== page.url() ? ` (${from})` : ""}`);
  });
  page.on("pageerror", (e) => sink.push(`pageerror ${page.url()}: ${e.message}`));
}

async function open(browser, { viewport = DESKTOP, scheme = "light", reduced = false, js = true, unsupported = false, sink = errors } = {}) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    javaScriptEnabled: js,
    colorScheme: scheme,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await context.addInitScript({ content: `(${instrument})(${JSON.stringify({ unsupported })})` });
  const page = await context.newPage();
  watch(page, sink);
  return { context, page };
}

const visibleConsole = 'section[aria-label="Pocket console"]:visible';

// Home, hydrated (React has attached to the console's Down chip) and booted, at the top of the page.
async function home(page) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
  await page.waitForFunction(
    () => {
      const sec = [...document.querySelectorAll('section[aria-label="Pocket console"]')].find((s) => s.checkVisibility());
      const b = sec && [...sec.querySelectorAll("button")].find((x) => x.textContent?.includes("Down"));
      return b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
    },
    null,
    { timeout: 15000 },
  );
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-booted"), null, { timeout: 5000 }).catch(() => {});
  await top(page);
}

async function top(page) {
  await page.evaluate(() => {
    document.activeElement?.blur?.();
    scrollTo({ top: 0, behavior: "instant" });
  });
}

// Moves the cursor to the menu line `i` with the arrow keys, then lets the console prefetch that page.
async function choose(page, i) {
  await top(page);
  for (let k = 0; k < i; k++) await page.keyboard.press("ArrowDown");
  const [href, label] = MENU[i];
  await page.waitForFunction((t) => document.querySelector('section[aria-label="Pocket console"] .readout')?.textContent?.includes(`open ${t}.`), label.toLowerCase(), { timeout: 3000 });
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
  return href;
}

// Measured before the press: the LCD's centre in the viewport.
const lcdCentre = (page) =>
  page.evaluate(() => {
    const sec = [...document.querySelectorAll('section[aria-label="Pocket console"]')].find((s) => s.checkVisibility());
    const r = sec.querySelector(".fig-lcd").getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });

async function press(page, how) {
  if (how === "enter") {
    await top(page);
    await page.keyboard.press("Enter");
  } else if (how === "tap") {
    await page.locator(`${visibleConsole} button.chip`, { hasText: "A Open" }).tap();
  } else {
    await page.locator(`${visibleConsole} button.chip`, { hasText: "A Open" }).click();
  }
}

// After the URL changes: the last transition (if any) has finished, then a beat.
async function settle(page) {
  await page
    .waitForFunction(() => window.__vt.length === 0 || window.__vt.at(-1).finished, null, { timeout: 5000 })
    .catch(() => {});
  await page.waitForTimeout(150);
  return page.evaluate(() => ({ vt: window.__vt, shown: window.__shown }));
}

const heading = (page) =>
  page.evaluate(() => {
    const h1 = [...document.querySelectorAll("main h1")].find((h) => h.checkVisibility());
    if (!h1) return null;
    const r = h1.getBoundingClientRect();
    return { text: h1.textContent ?? "", x: r.left, y: r.top, w: r.width, h: r.height };
  });

const matrix = (t) => {
  const m = /matrix\(([^)]+)\)/.exec(t ?? "");
  return m ? m[1].split(",").map(Number) : null;
};
const px = (v) => Number.parseFloat(v ?? "NaN");
const show = (anims) => (anims ?? []).map((a) => `${a.pseudo} ${a.name} ${a.delay}+${a.duration}`).join(", ") || "none";

// The label was in the old snapshot: named title-<page>, painted at the call, and the pair's group starts at its
// box (its own size and skew), on the LCD.
function captured(rec, page, lcd) {
  const name = `title-${page.slice(1)}`;
  const group = rec?.anims?.find((a) => a.pseudo === `::view-transition-group(${name})`);
  const old = rec?.anims?.some((a) => a.pseudo === `::view-transition-old(${name})`);
  const m = matrix(group?.from?.transform);
  const pass =
    rec?.label?.name === name &&
    rec.label.painted === true &&
    old === true &&
    m !== null &&
    Math.abs(m[0] - 0.9) < 0.01 &&
    Math.abs(m[1] + 0.5) < 0.01 &&
    Math.abs(px(group.from.width) - rec.label.w) <= 1 &&
    Math.abs(px(group.from.height) - rec.label.h) <= 1 &&
    Math.abs(m[4] - lcd.x) < 80 &&
    Math.abs(m[5] - lcd.y) < 80;
  return { pass, detail: JSON.stringify({ label: rec?.label, from: group?.from, old, lcd }) };
}

// One console navigation at a size, theme and input: label -> h1, zoom from the LCD, all within 400 ms, then Back.
async function opens(browser, viewport, scheme, how, i) {
  const size = viewport === PHONE ? "390x844" : "1366x768";
  const tag = `${size} ${scheme} ${how}`;
  const { context, page } = await open(browser, { viewport, scheme });
  try {
    await home(page);
    const href = await choose(page, i);
    const label = MENU[i][1];
    // A pointer first brings the chip into view (on a phone that scrolls), so the LCD is measured where it is pressed.
    if (how !== "enter") await page.locator(`${visibleConsole} button.chip`, { hasText: "A Open" }).scrollIntoViewIfNeeded();
    const lcd = await lcdCentre(page);
    await Promise.all([page.waitForURL((u) => u.pathname === href, { timeout: 10000 }), press(page, how)]);
    const { vt, shown } = await settle(page);
    const rec = vt.at(-1);
    check(`${tag}: A opens ${href} in one typed console transition`, vt.length === 1 && rec?.types.includes("console") && rec.error === null, JSON.stringify(vt.map((v) => ({ types: v.types, error: v.error }))));
    check(`${tag}: the label was shown before the navigation`, shown >= 1, `shown ${shown}`);
    const cap = captured(rec, href, lcd);
    check(`${tag}: the old snapshot holds the ${label.toUpperCase()} label as title-${href.slice(1)}, at its box on the LCD`, cap.pass, cap.detail);
    check(`${tag}: one element carries the title name at the call`, rec?.named?.length === 1, JSON.stringify(rec?.named));
    const h1 = await heading(page);
    const name = `title-${href.slice(1)}`;
    const group = rec?.anims?.find((a) => a.pseudo === `::view-transition-group(${name})`);
    const to = matrix(group?.to?.transform);
    check(
      `${tag}: the pair ends on the page's h1 "${label}"`,
      h1?.text.includes(label) &&
        rec?.anims?.some((a) => a.pseudo === `::view-transition-new(${name})`) &&
        to !== null &&
        Math.abs(to[4] - h1.x) < NEAR &&
        to[5] - h1.y > -NEAR &&
        to[5] - h1.y < RISE + NEAR &&
        Math.abs(px(group.to.width) - h1.w) < NEAR,
      JSON.stringify({ h1, to: group?.to }),
    );
    const zoom = (rec?.anims ?? []).filter((a) => a.name === "console-zoom");
    const grid = await page.evaluate(() => {
      const main = [...document.querySelectorAll("#main")].find((m) => m.checkVisibility());
      const r = main?.parentElement?.getBoundingClientRect();
      return r ? { x: r.left, y: r.top + scrollY } : null;
    });
    const origin = zoom[0]?.origin?.split(" ").map(px);
    check(
      `${tag}: the page grows out of the LCD's centre (console-zoom)`,
      zoom.length >= 1 &&
        zoom.every((z) => z.pseudo.startsWith("::view-transition-new(") && z.origin === zoom[0].origin) &&
        grid !== null &&
        Math.abs(grid.x + origin[0] - lcd.x) < NEAR &&
        Math.abs(grid.y + origin[1] - lcd.y) < NEAR,
      JSON.stringify({ zoom, grid, lcd }),
    );
    const parts = (rec?.anims ?? []).filter((a) => a.duration > 0);
    const late = parts.filter((a) => a.delay + a.duration > LIMIT);
    check(`${tag}: every part of it ends within ${LIMIT} ms`, parts.length > 0 && late.length === 0, show(late.length ? late : parts));

    // Back: the console is there and works, with no label left showing.
    await Promise.all([page.waitForURL((u) => u.pathname === "/", { timeout: 10000 }), page.goBack()]);
    await settle(page);
    await top(page);
    const back = await page.evaluate(() => {
      const sec = [...document.querySelectorAll('section[aria-label="Pocket console"]')].find((s) => s.checkVisibility());
      const l = sec?.querySelector(".console-label");
      return { readout: sec?.querySelector(".readout")?.textContent ?? "", label: l ? l.checkVisibility({ visibilityProperty: true }) : null };
    });
    await page.keyboard.press(i === MENU.length - 1 ? "ArrowUp" : "ArrowDown");
    const moved = await page
      .waitForFunction((r) => document.querySelector(`section[aria-label="Pocket console"] .readout`) && [...document.querySelectorAll('section[aria-label="Pocket console"]')].find((s) => s.checkVisibility())?.querySelector(".readout")?.textContent !== r, back.readout, { timeout: 3000 })
      .then(() => true, () => false);
    check(`${tag}: Back returns to a working console with the label at rest`, back.label === false && back.readout.includes("Press A") && moved, JSON.stringify({ ...back, moved }));
  } catch (e) {
    check(`${tag}: completes`, false, e.message.split("\n")[0]);
  } finally {
    await context.close();
  }
}

// Navigation by other means: unsupported view transitions, a delayed page, the sidebar and the plain menu links.
async function fallbacks(browser) {
  {
    const { context, page } = await open(browser, { unsupported: true });
    try {
      await home(page);
      await choose(page, 0);
      await Promise.all([page.waitForURL((u) => u.pathname === "/work", { timeout: 10000 }), press(page, "click")]);
      await page.waitForTimeout(400);
      const h1 = await heading(page);
      const vt = await page.evaluate(() => typeof document.startViewTransition);
      check("no view transitions: A still opens /work with its heading", vt === "undefined" && h1?.text.includes("Work"), JSON.stringify({ vt, h1 }));
    } catch (e) {
      check("no view transitions: completes", false, e.message.split("\n")[0]);
    } finally {
      await context.close();
    }
  }
  {
    // The page's data held back 2.5 s (its prefetch too): A still lands on it, whole.
    const { context, page } = await open(browser);
    let held = 0;
    try {
      await context.route(
        (u) => u.pathname === "/notes",
        async (route) => {
          if (route.request().headers()["rsc"] === "1") {
            held++;
            await new Promise((r) => setTimeout(r, 2500));
          }
          await route.continue().catch(() => {});
        },
      );
      await home(page);
      await top(page);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await Promise.all([page.waitForURL((u) => u.pathname === "/notes", { timeout: 15000 }), press(page, "enter")]);
      const { vt } = await settle(page);
      const h1 = await heading(page);
      check("delayed page: A waits for /notes and lands on its heading", held >= 1 && h1?.text.includes("Notes") && vt.every((v) => v.error === null), JSON.stringify({ held, h1, vt: vt.map((v) => ({ types: v.types, error: v.error })) }));
      const rest = await page.evaluate(() => [...document.querySelectorAll(".console-label")].filter((l) => l.checkVisibility({ visibilityProperty: true })).length);
      check("delayed page: no label is left showing", rest === 0, `${rest}`);
    } catch (e) {
      check("delayed page: completes", false, e.message.split("\n")[0]);
    } finally {
      await context.close();
    }
  }
  {
    // The sidebar keeps its plain fade: untyped, no pair, no zoom. So does a plain menu link from Home.
    const { context, page } = await open(browser);
    try {
      await page.goto(`${BASE_URL}/work`, { waitUntil: "load" });
      await page.waitForTimeout(800);
      await Promise.all([page.waitForURL((u) => u.pathname === "/projects"), page.locator('nav[aria-label="Main"] a[href="/projects"]:visible').click()]);
      let { vt } = await settle(page);
      let rec = vt.at(-1);
      check(
        "sidebar /work -> /projects: plain page fade, no title pair and no zoom",
        rec?.types.length === 0 &&
          rec.anims?.some((a) => a.name === "fade-in" && a.duration === 210 && a.delay === 150) &&
          !rec.anims.some((a) => a.name === "console-zoom" || /title-/.test(a.pseudo)),
        show(rec?.anims),
      );
      await home(page);
      await page.evaluate(() => (window.__vt.length = 0));
      const link = page.locator('nav[aria-label="Pages"] a[href="/music"]');
      await link.focus();
      await Promise.all([page.waitForURL((u) => u.pathname === "/music"), page.keyboard.press("Enter")]);
      ({ vt } = await settle(page));
      rec = vt.at(-1);
      const h1 = await heading(page);
      check("plain menu link / -> /music: navigates untyped, with no zoom", h1?.text.includes("Music") && rec?.types.length === 0 && !rec.anims?.some((a) => a.name === "console-zoom"), JSON.stringify({ h1, types: rec?.types, anims: show(rec?.anims) }));
    } catch (e) {
      check("sidebar and plain link: complete", false, e.message.split("\n")[0]);
    } finally {
      await context.close();
    }
  }
}

// The same assertions, made to fail: an untyped push of the console's page has no zoom, and with the label not
// rendered the old snapshot holds no label.
async function negatives(browser) {
  {
    const { context, page } = await open(browser);
    try {
      await home(page);
      await choose(page, 0);
      await Promise.all([page.waitForURL((u) => u.pathname === "/work"), page.evaluate(() => window.next.router.push("/work"))]);
      const { vt } = await settle(page);
      const zoom = (vt.at(-1)?.anims ?? []).filter((a) => a.name === "console-zoom");
      check("negative: an untyped router.push('/work') from Home is caught with no console-zoom", vt.length === 1 && zoom.length === 0, show(vt.at(-1)?.anims));
    } catch (e) {
      check("negative: untyped push completes", false, e.message.split("\n")[0]);
    } finally {
      await context.close();
    }
  }
  {
    const { context, page } = await open(browser);
    try {
      await home(page);
      await page.addStyleTag({ content: ".console-label{display:none!important}" });
      await choose(page, 0);
      const lcd = await lcdCentre(page);
      await Promise.all([page.waitForURL((u) => u.pathname === "/work"), press(page, "click")]);
      const { vt } = await settle(page);
      const cap = captured(vt.at(-1), "/work", lcd);
      check("negative: with the label not rendered, the old-snapshot assertion fails", !cap.pass, cap.detail);
    } catch (e) {
      check("negative: hidden label completes", false, e.message.split("\n")[0]);
    } finally {
      await context.close();
    }
  }
}

// Reduced motion, from the start and switched on at Home: A navigates with no label, no type and no zoom.
async function reducedMotion(browser) {
  for (const live of [false, true]) {
    const tag = live ? "reduced motion (switched on at Home)" : "reduced motion";
    const { context, page } = await open(browser, { reduced: !live });
    try {
      await home(page);
      if (live) await page.emulateMedia({ reducedMotion: "reduce" });
      await choose(page, 1);
      await Promise.all([page.waitForURL((u) => u.pathname === "/play", { timeout: 10000 }), press(page, "click")]);
      const { vt, shown } = await settle(page);
      const h1 = await heading(page);
      const all = vt.flatMap((v) => v.anims ?? []);
      check(
        `${tag}: A opens /play with no label, no console type and no zoom`,
        h1?.text.includes("Play") && shown === 0 && vt.every((v) => !v.types.includes("console")) && !all.some((a) => a.name === "console-zoom"),
        JSON.stringify({ h1, shown, types: vt.map((v) => v.types), anims: show(all) }),
      );
      check(`${tag}: every transition animation is 0 ms`, all.every((a) => a.duration <= 1 && a.delay <= 1), show(all));
    } catch (e) {
      check(`${tag}: completes`, false, e.message.split("\n")[0]);
    } finally {
      await context.close();
    }
  }
}

// JavaScript off: the menu's links are in the HTML and go to their pages; the label is in the HTML, unpainted.
async function noJs(browser) {
  const { context, page } = await open(browser, { js: false });
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
    const hrefs = await page.locator('nav[aria-label="Pages"] a').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    const label = await page.evaluate(() => {
      const l = document.querySelector(".console-label");
      return l ? { text: l.textContent, painted: l.checkVisibility({ visibilityProperty: true }) } : null;
    });
    check("no-JS: Home has the six menu links and an unpainted WORK label", JSON.stringify(hrefs) === JSON.stringify(MENU.map(([h]) => h)) && label?.text === "WORK" && label.painted === false, JSON.stringify({ hrefs, label }));
    await page.locator('nav[aria-label="Pages"] a[href="/work"]').focus();
    await Promise.all([page.waitForURL((u) => u.pathname === "/work"), page.keyboard.press("Enter")]);
    const h1 = await heading(page);
    check("no-JS: the menu's Work link loads /work with its heading", h1?.text.includes("Work"), JSON.stringify(h1));
  } catch (e) {
    check("no-JS: completes", false, e.message.split("\n")[0]);
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
  console.log(`# ${browser.version()}`);
  // Every menu page at least once, by pointer and by Enter, at both sizes and in both themes.
  const RUNS = [
    [DESKTOP, "light", "click", 0],
    [DESKTOP, "light", "enter", 2],
    [DESKTOP, "dark", "click", 1],
    [DESKTOP, "dark", "enter", 5],
    [PHONE, "light", "tap", 3],
    [PHONE, "light", "enter", 4],
    [PHONE, "dark", "tap", 0],
    [PHONE, "dark", "enter", 2],
  ];
  for (const [viewport, scheme, how, i] of RUNS) await opens(browser, viewport, scheme, how, i);
  await fallbacks(browser);
  await reducedMotion(browser);
  await noJs(browser);
  await negatives(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
