// Drives headless Chromium across the hops between root layouts. Run by scripts/probe-motion.sh, which installs
// Playwright into PW_PREFIX and passes BASE_URL.
//
// Every hop clicks the real link, so it is the page's own navigation (a page.goto is browser UI and never gets a
// cross-document transition). pageswap fires on the old document, so its answer is kept in sessionStorage;
// pagereveal fires on the new one, before its first frame, and keeps the transition's animations once it is ready.
// Each /projects -> project hop is that project's first load in its context, as on a visitor's first hop.
// A location.assign from /shore into the streamed site pages (/work, /play, /notes, /music, /sign-in,
// /forgot-password) carries the hop and logs no page error.
// The site's own pages: a sidebar click /work -> /projects runs page-out and page-in, the eleven /projects rows
// rise 40 ms apart, and /sign-in and the 404 load cleanly; under reduced motion all of it is still.
// The group swaps: both ways out of the 404 (its Go home and the brand mark, the 404 reached by page.goto and by
// router.push from /work), /work -> / by the brand mark, / -> /work by the console, /work -> /sign-in and
// /sign-in -> / each fade the old page out and the new one in, read once a frame from getAnimations(); moves
// inside one group still do, with the sidebar and the masthead out of the fading groups. A location.assign from
// /shore into the 404 carries the hop. With JavaScript off the 404 is the parcel page and its Go home goes to /.
// The instruments: Barometer's four parts settle 0.15 s apart, Planisphere's lines draw on and its stars fade up
// (a turn of the wheel adds only the disc's transform transition and replays nothing), and Rotor's windows roll
// only once a key is pressed. Under reduced motion none of it runs, and with JavaScript off each page still
// ends at its resting pose.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const PROJECTS = ["shore", "capsule", "orrery", "elements", "vinyl", "rotor", "planisphere", "barometer", "articles", "structures", "design-system"];

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

function watchHops() {
  addEventListener("pageswap", (e) => {
    sessionStorage.setItem("probe:pageswap", JSON.stringify({ from: location.pathname, vt: e.viewTransition !== null }));
  });
  addEventListener("pagereveal", (e) => {
    const vt = e.viewTransition;
    window.__probe = { reveal: vt !== null, types: vt ? [...vt.types] : [], anims: [], done: vt === null };
    if (!vt) return;
    vt.ready
      .then(() => {
        window.__probe.anims = document.documentElement
          .getAnimations({ subtree: true })
          .filter((a) => a.effect?.pseudoElement?.startsWith("::view-transition"))
          .map((a) => {
            const t = a.effect.getComputedTiming();
            return { name: a.animationName ?? "", pseudo: a.effect.pseudoElement, duration: Number(t.duration), delay: t.delay, state: a.playState };
          });
      })
      .catch(() => {});
    const done = () => void (window.__probe.done = true);
    vt.finished.then(done, done);
  });
}

async function open(browser, { viewport, reduced, sink = errors }) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    // A failed subresource names itself; the document's own load does not.
    const from = m.location().url;
    sink.push(`console ${page.url()}: ${m.text()}${from && from !== page.url() ? ` (${from})` : ""}`);
  });
  page.on("pageerror", (e) => sink.push(`pageerror ${page.url()}: ${e.message}`));
  await page.addInitScript(watchHops);
  return { context, page };
}

// Each project-* name on one element at most; returns every name in the document.
const projectNames = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("*")]
      .map((el) => ({ tag: el.tagName.toLowerCase(), name: getComputedStyle(el).viewTransitionName }))
      .filter((n) => n.name.startsWith("project-")),
  );

function checkNames(label, path, names) {
  const seen = names.map((n) => n.name);
  const dupes = seen.filter((n, i) => seen.indexOf(n) !== i);
  check(`${label}: ${path} names no project-* element twice`, dupes.length === 0, dupes.join(", "));
  const slug = path.split("/")[1];
  if (PROJECTS.includes(slug)) {
    const want = `h1 project-${slug}`;
    const got = names.map((n) => `${n.tag} ${n.name}`).join(", ");
    check(`${label}: ${path} names exactly one element, its h1, project-${slug}`, got === want, got || "none");
  } else if (path === "/projects") {
    const want = PROJECTS.map((p) => `project-${p}`).sort().join(", ");
    check(`${label}: /projects names its eleven rows after the projects`, [...seen].sort().join(", ") === want, seen.join(", "));
  }
}

// Every animation the page has at load, minus the UA's own (a transition in flight), lasts <= 1 ms or is done.
const loadAnimations = (page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => !(a.animationName ?? "").startsWith("-ua-"))
      .map((a) => ({ name: a.animationName ?? a.transitionProperty ?? a.constructor.name, duration: Number(a.effect?.getComputedTiming().duration), state: a.playState })),
  );
// The rise animation on each /projects row: its name, delay and duration, and the computed animation-delay.
const rowRises = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main li.rise")].map((li) => {
      const a = li.getAnimations().find((x) => x.animationName === "rise");
      const t = a?.effect.getComputedTiming();
      const css = getComputedStyle(li).animationDelay;
      const cssDelay = css.endsWith("ms") ? parseFloat(css) : parseFloat(css) * 1000;
      return { name: a?.animationName ?? "none", delay: t ? t.delay : 0, duration: t ? Number(t.duration) : 0, cssDelay };
    }),
  );
const siteErrors = [];
// The 404 document's own load is logged as a failed resource, and so is the router's fetch of its flight data on a
// soft navigation to it (the router then loads the document); anything else, any other 404 subresource included,
// is an error. HTTP/1.1 (next start) logs "404 (Not Found)"; HTTP/2 (otohime.dev) has no reason phrase: "404 ()".
const notFoundLoad = (e) =>
  /\/does-not-exist: Failed to load resource: the server responded with a status of 404 \((?:Not Found)?\)$/.test(e) ||
  /: Failed to load resource: the server responded with a status of 404 \((?:Not Found)?\) \(\S+\/does-not-exist\?_rsc=[^\s)]+\)$/.test(e);
const still = (anims) => anims.filter((a) => !(a.duration <= 1 || a.state === "finished"));
const show = (anims) =>
  anims
    .slice(0, 6)
    .map((a) => `${a.pseudo ?? ""} ${a.name} ${a.duration}ms ${a.state}`.trim())
    .join(", ") + (anims.length > 6 ? `, and ${anims.length - 6} more` : "");

/**
 * Loads `from`, then reaches `to` by clicking its link (or by `via` when no link exists), and waits for the new
 * document's transition to finish. Returns what pageswap and pagereveal saw.
 */
async function hop(page, from, to, via = null) {
  await page.goto(`${BASE_URL}${from}`, { waitUntil: "load" });
  // A document that has not painted yet has nothing to capture, and its hop cuts: a cached page can fire load
  // before its first frame. Measured: 10 of 40 hops from /shore with no wait, 0 of 120 after two frames.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(() => sessionStorage.removeItem("probe:pageswap"));
  const fromNames = await projectNames(page);
  const target = (u) => new URL(u).pathname === to;
  if (via) await Promise.all([page.waitForURL(target, { waitUntil: "load" }), page.evaluate(via, to)]);
  else {
    const link = page.locator(`a[href="${to}"]`).filter({ visible: true }).first();
    await Promise.all([page.waitForURL(target, { waitUntil: "load" }), link.click()]);
  }
  await page.waitForFunction(() => window.__probe?.done === true, null, { timeout: 10_000 }).catch(() => {});
  const swap = await page.evaluate(() => JSON.parse(sessionStorage.getItem("probe:pageswap") ?? "null"));
  const probe = await page.evaluate(() => window.__probe ?? null);
  return { swap, reveal: probe?.reveal ?? null, types: probe?.types ?? [], anims: probe?.anims ?? [], fromNames, toNames: await projectNames(page) };
}

const HOPS = [
  ...PROJECTS.map((p) => ({ from: "/projects", to: `/${p}`, morph: `project-${p}` })),
  { from: "/shore", to: "/projects", morph: "project-shore" },
  { from: "/planisphere", to: "/orrery", how: '"Next door" link' },
  // Orrery links no other project, so this direction is the page's own script navigation.
  { from: "/orrery/sun", to: "/planisphere", via: (to) => location.assign(to), how: "location.assign" },
];

// The site's own transitions (React's, same document) keep the default root crossfade: the typed hop fade must
// not reach them, or the unchanged sidebar would dip to blank. Wraps startViewTransition to read each one's root.
function watchSameDocument() {
  const start = Document.prototype.startViewTransition;
  window.__same = [];
  Document.prototype.startViewTransition = function (...args) {
    const vt = start.apply(this, args);
    vt.ready
      .then(() => {
        const anims = document.documentElement
          .getAnimations({ subtree: true })
          .filter((a) => a.effect?.pseudoElement?.startsWith("::view-transition"));
        const root = anims
          .filter((a) => /^::view-transition-(?:old|new)\(root\)$/.test(a.effect.pseudoElement))
          .map((a) => `${a.effect.pseudoElement} ${a.animationName}`);
        // page-out and page-in only reach a wrapped page's own groups: fade-out on an old one, fade-in on a new one.
        const page = anims
          .filter((a) => /^::view-transition-(?:old|new)\((?!root\))/.test(a.effect.pseudoElement))
          .map((a) => {
            const t = a.effect.getComputedTiming();
            return { pseudo: a.effect.pseudoElement, name: a.animationName, duration: Number(t.duration), delay: t.delay };
          });
        window.__same.push({ types: [...vt.types], root, page });
      })
      .catch(() => {});
    return vt;
  };
}

// Every ::view-transition-old/new animation the document runs, sampled once a frame from its creation, so a
// same-document change (React's) and a full load (the hop, read in the new document) are read the same way.
// Also every element that gets an inline view-transition-name (React names the <ViewTransition> it animates),
// with whether it holds the sidebar or the masthead.
function watchFades() {
  const seen = new Set();
  window.__fades = [];
  window.__named = [];
  window.__fadesReset = () => {
    seen.clear();
    window.__fades.length = 0;
    window.__named.length = 0;
  };
  const tick = () => {
    for (const a of document.documentElement?.getAnimations({ subtree: true }) ?? []) {
      const m = /^::view-transition-(old|new)\((.+)\)$/.exec(a.effect?.pseudoElement ?? "");
      if (!m || seen.has(a)) continue;
      seen.add(a);
      const t = a.effect.getComputedTiming();
      window.__fades.push({ side: m[1], group: m[2], name: a.animationName ?? "", duration: Number(t.duration), delay: t.delay });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // React sets the name and restores the style before an observer runs, so the name is read from either side.
  new MutationObserver((records) => {
    for (const { target: el, oldValue } of records) {
      const style = `${oldValue ?? ""};${el.getAttribute("style") ?? ""}`;
      const name = /view-transition-name:\s*([^;\s]+)/.exec(style)?.[1];
      if (!name || name === "none") continue;
      const holds = (sel) => el.matches(sel) || el.querySelector(sel) !== null;
      window.__named.push({ name, tag: el.tagName.toLowerCase(), nav: holds(".appnav"), masthead: holds("header.masthead") });
    }
  }).observe(document, { attributes: true, attributeFilter: ["style"], attributeOldValue: true, subtree: true });
}

// Clicks `selector` (the first one visible) and waits for `to`, then for the new side to fade in and every
// transition animation to end. Returns the fades and the named elements the change ran.
async function swap(page, selector, to) {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.evaluate(() => window.__fadesReset());
  const target = page.locator(selector).filter({ visible: true }).first();
  // The masthead's Sign in streams in behind its own boundary.
  await target.waitFor({ timeout: 15_000 });
  await Promise.all([page.waitForURL((u) => u.pathname === to, { timeout: 15_000 }), target.click()]);
  return settleFades(page);
}
async function settleFades(page) {
  await page.waitForFunction(() => window.__fades.some((f) => f.side === "new" && /fade-in$/.test(f.name)), null, { timeout: 4000 }).catch(() => {});
  await page
    .waitForFunction(
      () => !document.documentElement.getAnimations({ subtree: true }).some((a) => a.effect?.pseudoElement?.startsWith("::view-transition") && a.playState === "running"),
      null,
      { timeout: 4000 },
    )
    .catch(() => {});
  await page.waitForTimeout(200);
  return page.evaluate(() => ({ fades: window.__fades, named: window.__named }));
}
const fadedOut = (fades) => fades.some((f) => f.side === "old" && /fade-out$/.test(f.name) && f.duration === 150);
const fadedIn = (fades) => fades.some((f) => f.side === "new" && /fade-in$/.test(f.name) && f.duration === 210 && f.delay === 150);
const showFades = (fades) => fades.map((f) => `${f.side}(${f.group}) ${f.name} ${f.delay}+${f.duration}`).join(", ") || "no transition";

// Every animationstart in the document, with the animation's own timing: its start on the timeline, its delay and
// its duration. Animation events bubble, so one listener on window hears every part.
function watchStarts() {
  window.__starts = [];
  addEventListener("animationstart", (e) => {
    const el = e.target;
    const a = el.getAnimations().find((x) => x.animationName === e.animationName);
    const t = a?.effect.getTiming();
    window.__starts.push({
      name: e.animationName,
      tag: el.tagName.toLowerCase(),
      cls: el.getAttribute("class") ?? "",
      data: [...el.attributes].map((x) => x.name).filter((n) => n.startsWith("data-")).join(" "),
      start: a?.startTime ?? null,
      delay: t?.delay ?? null,
      duration: t ? Number(t.duration) : null,
    });
  });
}
const starts = (page) => page.evaluate(() => window.__starts ?? []);
const BAROMETER_NAMES = ["swing", "rise", "vane-swing"];
const BAROMETER_PARTS = ["needle", "mercury", "arrow", "water"];
// React has hydrated the island once the node carries its fiber; give its effects a beat to attach their listeners.
async function hydrated(page, selector) {
  await page
    .waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return Boolean(el) && Object.keys(el).some((k) => k.startsWith("__react"));
    }, selector, { timeout: 10_000 })
    .catch(() => {});
  await page.waitForTimeout(200);
}

const browser = await chromium.launch();
try {
  for (const [size, viewport] of [["1366x768", DESKTOP], ["390x844", PHONE]]) {
    // Motion on: every hop crossfades, the title travels, and each document keeps its names unique.
    {
      const { context, page } = await open(browser, { viewport, reduced: false });
      try {
        for (const h of HOPS) {
          const label = `${size} ${h.from} -> ${h.to}${h.how ? ` (${h.how})` : ""}`;
          const r = await hop(page, h.from, h.to, h.via);
          check(`${label}: pageswap carries a view transition`, r.swap?.from === h.from && r.swap?.vt === true, JSON.stringify(r.swap));
          check(`${label}: pagereveal carries a view transition of type hop`, r.reveal === true && r.types.includes("hop"), `${r.reveal} ${r.types}`);
          const old = r.anims.find((a) => a.pseudo === "::view-transition-old(root)" && /fade-out$/.test(a.name));
          const now = r.anims.find((a) => a.pseudo === "::view-transition-new(root)" && /fade-in$/.test(a.name));
          check(`${label}: the old page fades out in 150 ms`, old?.duration === 150, show(r.anims));
          check(`${label}: the new page fades in over 210 ms after 150 ms`, now?.duration === 210 && now?.delay === 150, show(r.anims));
          if (h.morph) {
            const group = r.anims.some((a) => a.pseudo === `::view-transition-group(${h.morph})`);
            check(`${label}: the title moves as ${h.morph}`, group, show(r.anims));
          }
          checkNames(size, h.from, r.fromNames);
          checkNames(size, h.to, r.toNames);
        }
      } finally {
        await context.close();
      }
    }

    // Reduced motion: the same hops complete, and nothing runs longer than 1 ms.
    {
      const { context, page } = await open(browser, { viewport, reduced: true });
      try {
        for (const h of HOPS) {
          const label = `${size} reduced motion ${h.from} -> ${h.to}`;
          const r = await hop(page, h.from, h.to, h.via);
          check(`${label}: the hop completes`, new URL(page.url()).pathname === h.to, page.url());
          const vt = r.anims.filter((a) => !a.name.startsWith("-ua-"));
          check(`${label}: the transition's own animations last 0 ms`, still(vt).length === 0 && vt.every((a) => a.duration <= 1 && a.delay === 0), show(vt));
          const anims = await loadAnimations(page);
          check(`${label}: every animation at load lasts <= 1 ms or has finished`, still(anims).length === 0, show(still(anims)));
        }
      } finally {
        await context.close();
      }
    }
  }

  // A full load from a project into the site's streamed pages: React's Suspense reveal waits for the hop (the root
  // layout's pagereveal guard), so the hop runs and nothing is skipped. Watched until the hop has finished, no
  // Suspense template is left and no transition of React's is in flight.
  for (const [size, viewport] of [["1366x768", DESKTOP], ["390x844", PHONE]]) {
    const sink = [];
    const { context, page } = await open(browser, { viewport, reduced: false, sink });
    try {
      for (const to of ["/work", "/play", "/notes", "/music", "/sign-in", "/forgot-password"]) {
        const label = `${size} /shore -> ${to} (location.assign, signed out)`;
        const from = sink.length;
        const r = await hop(page, "/shore", to, (t) => location.assign(t));
        const settled = await page
          .waitForFunction(() => !document.querySelector('template[id^="B:"]') && !document.__reactViewTransition, null, { timeout: 10_000 })
          .then(() => true, () => false);
        await page.waitForTimeout(300);
        check(`${label}: pagereveal carries a view transition of type hop`, r.reveal === true && r.types.includes("hop"), `${r.reveal} ${r.types}`);
        check(`${label}: every streamed reveal settles`, settled);
        const mine = sink.slice(from);
        check(`${label}: no page error and no console error`, mine.length === 0, mine.slice(0, 3).join(" | "));
      }
    } finally {
      await context.close();
    }
  }

  // The site's page changes: the /work load (its masthead's Suspense reveal) and a sidebar click to /projects.
  {
    const { context, page } = await open(browser, { viewport: DESKTOP, reduced: false });
    try {
      await page.addInitScript(watchSameDocument);
      await page.goto(`${BASE_URL}/work`, { waitUntil: "load" });
      await page.waitForTimeout(800);
      await page.locator('a[href="/projects"]').filter({ visible: true }).first().click();
      await page.waitForURL((u) => u.pathname === "/projects");
      await page.waitForTimeout(800);
      const same = await page.evaluate(() => window.__same);
      check("site: a same-document page change runs a view transition", same.length > 0, JSON.stringify(same));
      const faded = same.filter((t) => t.types.includes("hop") || t.root.some((r) => / (?:vt-)?fade-(?:in|out)$/.test(r)));
      check("site: the hop's fade stays off the site's own page changes", faded.length === 0, JSON.stringify(faded));
      const pageAnims = same.flatMap((t) => t.page);
      const out = pageAnims.find((a) => a.pseudo.startsWith("::view-transition-old(") && a.name === "fade-out" && a.duration === 150);
      const into = pageAnims.find((a) => a.pseudo.startsWith("::view-transition-new(") && a.name === "fade-in" && a.duration === 210 && a.delay === 150);
      check("site: /work -> /projects runs page-out on /work (fade-out, 150 ms)", Boolean(out), show(pageAnims));
      check("site: /work -> /projects runs page-in on /projects (fade-in, 210 ms after 150 ms)", Boolean(into), show(pageAnims));
    } finally {
      await context.close();
    }
  }

  // Every exit from the 404 and every move between the (home), (app) and (auth) group layouts: the old page fades
  // out and the new one fades in, and the masthead is never part of a fading group. Moves inside one group still
  // hand over, with the sidebar and the masthead still. Under reduced motion each completes and nothing runs.
  {
    const toNotFound = {
      goto: async (page) => {
        await page.goto(`${BASE_URL}/does-not-exist`, { waitUntil: "load" });
      },
      soft: async (page) => {
        await page.goto(`${BASE_URL}/work`, { waitUntil: "load" });
        await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        await Promise.all([page.waitForURL((u) => u.pathname === "/does-not-exist"), page.evaluate(() => window.next.router.push("/does-not-exist"))]);
      },
    };
    const swapErrors = [];
    const MOVES = [
      ...Object.entries(toNotFound).flatMap(([how, reach]) => [
        { label: `404 (${how === "goto" ? "page.goto" : "router.push from /work"}) -> / by its Go home`, reach, selector: 'a.btn[href="/"]', to: "/" },
        { label: `404 (${how === "goto" ? "page.goto" : "router.push from /work"}) -> / by the brand mark`, reach, selector: 'header.masthead a[href="/"]', to: "/" },
      ]),
      { label: "/work -> / by the brand mark", from: "/work", selector: 'header.masthead a[href="/"]', to: "/" },
      { label: "/ -> /work by the console menu", from: "/", selector: 'button.chip:has-text("Open")', to: "/work" },
      { label: "/work -> /sign-in by the masthead's Sign in", from: "/work", selector: 'header.masthead a[href="/sign-in"]', to: "/sign-in" },
      { label: "/sign-in -> / by the brand mark", from: "/sign-in", selector: 'header.masthead a[href="/"]', to: "/" },
      { label: "/work -> /projects by the sidebar (one group)", from: "/work", selector: 'nav[aria-label="Main"] a[href="/projects"]', to: "/projects", within: true },
      { label: "/sign-in -> /forgot-password (one group)", from: "/sign-in", selector: 'main a[href="/forgot-password"]', to: "/forgot-password", within: true },
    ];
    for (const [size, viewport] of [["1366x768", DESKTOP], ["390x844", PHONE]]) {
      for (const reduced of [false, true]) {
        const { context, page } = await open(browser, { viewport, reduced, sink: swapErrors });
        try {
          await page.addInitScript(watchFades);
          for (const m of MOVES) {
            const label = `${size}${reduced ? " reduced motion" : ""} ${m.label}`;
            try {
              if (m.reach) await m.reach(page);
              else await page.goto(`${BASE_URL}${m.from}`, { waitUntil: "load" });
              const r = await swap(page, m.selector, m.to);
              if (reduced) {
                const anims = await loadAnimations(page);
                check(`${label}: completes, with every transition animation 0 ms`, r.fades.every((f) => f.duration <= 1 && f.delay <= 1), showFades(r.fades));
                check(`${label}: every animation after it lasts <= 1 ms or has finished`, still(anims).length === 0, show(still(anims)));
                continue;
              }
              check(`${label}: the old page fades out (150 ms) and the new page fades in (210 ms after 150 ms)`, fadedOut(r.fades) && fadedIn(r.fades), showFades(r.fades));
              const held = r.named.filter((n) => n.masthead || (m.within && n.nav));
              check(`${label}: the masthead${m.within ? " and the sidebar stay" : " stays"} out of the fading groups`, held.length === 0, JSON.stringify(held));
            } catch (e) {
              check(`${label}: completes`, false, e.message.split("\n")[0]);
            }
          }
        } finally {
          await context.close();
        }
      }
    }

    const swapReal = swapErrors.filter((e) => !notFoundLoad(e));
    check("group swaps: no console error and no page error", swapReal.length === 0, swapReal.slice(0, 3).join(" | "));

    // A full load from a project into the 404 carries the hop, and the 404's document opts in before its first frame.
    for (const [size, viewport] of [["1366x768", DESKTOP], ["390x844", PHONE]]) {
      const sink = [];
      const { context, page } = await open(browser, { viewport, reduced: false, sink });
      const label = `${size} /shore -> /does-not-exist (location.assign)`;
      try {
        const r = await hop(page, "/shore", "/does-not-exist", (t) => location.assign(t));
        await page.waitForTimeout(300);
        check(`${label}: pagereveal carries a view transition of type hop`, r.reveal === true && r.types.includes("hop"), `${r.reveal} ${r.types}`);
        const old = r.anims.find((a) => a.pseudo === "::view-transition-old(root)" && /fade-out$/.test(a.name));
        const now = r.anims.find((a) => a.pseudo === "::view-transition-new(root)" && /fade-in$/.test(a.name));
        check(`${label}: the hop fades /shore out and the 404 in`, old?.duration === 150 && now?.duration === 210 && now?.delay === 150, show(r.anims));
        const real = sink.filter((e) => !notFoundLoad(e));
        check(`${label}: no page error and no console error`, real.length === 0, real.slice(0, 3).join(" | "));
      } catch (e) {
        check(`${label}: completes`, false, e.message.split("\n")[0]);
      } finally {
        await context.close();
      }
    }

    // JavaScript off: the 404 still says what it says, with its status, and its Go home is a link to /.
    {
      const context = await browser.newContext({ viewport: DESKTOP, javaScriptEnabled: false });
      const page = await context.newPage();
      try {
        const response = await page.goto(`${BASE_URL}/does-not-exist`, { waitUntil: "load" });
        check("no-JS: /does-not-exist answers 404", response?.status() === 404, String(response?.status()));
        const heading = await page.locator("h1").filter({ visible: true }).allTextContents();
        check("no-JS: /does-not-exist shows the parcel page", heading.some((h) => h.includes("Nothing in this parcel")), heading.join(" | ") || "no h1");
        const home = page.locator('a[href="/"]', { hasText: "Go home" }).filter({ visible: true }).first();
        await Promise.all([page.waitForURL((u) => u.pathname === "/", { timeout: 10_000 }), home.click({ timeout: 5000 })]);
        check("no-JS: the 404's Go home navigates to /", new URL(page.url()).pathname === "/", page.url());
      } catch (e) {
        check("no-JS: the 404's Go home navigates to /", false, e.message.split("\n")[0]);
      } finally {
        await context.close();
      }
    }
  }

  // The site's other pages: /projects' rows rise in turn, and the sign-in page and the 404 load cleanly. Under
  // reduced motion the same pages are still and no row waits.
  for (const reduced of [false, true]) {
    const { context, page } = await open(browser, { viewport: DESKTOP, reduced, sink: siteErrors });
    const label = reduced ? "site reduced motion" : "site";
    try {
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "load" });
      const rows = await rowRises(page);
      if (!reduced) {
        const delays = rows.map((r) => r.delay);
        check(`${label}: /projects has 11 row rise animations`, rows.length === 11 && rows.every((r) => r.name === "rise"), JSON.stringify(rows));
        check(
          `${label}: the rows' delays increase, 40 ms apart`,
          delays.length === 11 && delays.every((d, i) => d === i * 40),
          delays.join(", "),
        );
        const last = rows.at(-1);
        check(`${label}: the last row is up within 0.8 s`, last !== undefined && last.delay + last.duration <= 800, JSON.stringify(last));
      } else {
        check(`${label}: every /projects row's effective delay is <= 1 ms`, rows.length === 11 && rows.every((r) => r.delay <= 1 && r.cssDelay <= 1), JSON.stringify(rows));
        const anims = await loadAnimations(page);
        check(`${label}: every animation on /projects lasts <= 1 ms or has finished`, still(anims).length === 0, show(still(anims)));
      }
      for (const [path, status] of [["/sign-in", 200], ["/does-not-exist", 404]]) {
        const response = await page.goto(`${BASE_URL}${path}`, { waitUntil: "load" });
        check(`${label}: ${path} answers ${status}`, response?.status() === status, String(response?.status()));
        if (reduced) {
          const anims = await loadAnimations(page);
          check(`${label}: every animation on ${path} lasts <= 1 ms or has finished`, still(anims).length === 0, show(still(anims)));
        }
      }
    } finally {
      await context.close();
    }
  }
  const siteReal = siteErrors.filter((e) => !notFoundLoad(e));
  check("site: /projects, /sign-in and /does-not-exist load with no console error or page error", siteReal.length === 0, siteReal.slice(0, 3).join(" | "));

  // The instruments' own load motion. animationstart is recorded as it happens, with the animation's timing, so
  // a part that has already finished by the load event still counts.
  for (const reduced of [false, true]) {
    const { context, page } = await open(browser, { viewport: DESKTOP, reduced });
    const label = reduced ? "instruments reduced motion" : "instruments";
    try {
      await page.addInitScript(watchStarts);

      // Barometer: the needle, the mercury, the vane and the water, one after another.
      await page.goto(`${BASE_URL}/barometer?city=tokyo`, { waitUntil: "load" });
      const face = await page.locator("svg.station").getAttribute("data-face");
      const atLoad = await loadAnimations(page);
      await page.waitForTimeout(1800);
      const parts = (await starts(page)).filter((a) => BAROMETER_NAMES.includes(a.name)).map((a) => ({ ...a, part: BAROMETER_PARTS.find((p) => a.cls.split(" ").includes(p)) ?? a.cls }));
      console.log(`# ${label}: /barometer?city=tokyo shows the ${face} face`);
      if (reduced) {
        check(`${label}: /barometer starts none of its instrument animations`, parts.length === 0, show(parts));
        check(`${label}: every animation on /barometer lasts <= 1 ms or has finished`, still(atLoad).length === 0, show(still(atLoad)));
      } else if (face === "reading") {
        const order = parts.map((p) => p.part).join(", ");
        check(`${label}: /barometer starts its 4 instrument animations, one per part`, order === BAROMETER_PARTS.join(", "), order || "none");
        check(
          `${label}: /barometer's parts settle in turn, 0.15 s apart, each over 1.1 s`,
          parts.length === 4 && parts.every((p, i) => p.delay === i * 150 && p.duration === 1100),
          parts.map((p) => `${p.part} ${p.name} ${p.delay}+${p.duration}ms`).join(", "),
        );
        check(`${label}: /barometer's four start together and differ only by their delay`, parts.length === 4 && parts.every((p) => Math.abs(p.start - parts[0].start) <= 50), parts.map((p) => p.start).join(", "));
        const running = atLoad.filter((a) => BAROMETER_NAMES.includes(a.name));
        check(`${label}: /barometer's instrument animations at load are its own, none longer than 1.1 s`, running.every((a) => a.duration === 1100), show(running));
      } else {
        // The feed is live; when it is down the quiet face is drawn, and it must stand still.
        check(`${label}: /barometer's quiet face starts none of the instrument animations`, parts.length === 0, show(parts));
      }

      // Planisphere: the lines draw on, then the stars, then the names and the markers.
      await page.goto(`${BASE_URL}/planisphere`, { waitUntil: "load" });
      await hydrated(page, "[data-disc]");
      await page.waitForTimeout(1900);
      const sky = (await starts(page)).filter((a) => a.name.startsWith("sky-"));
      const lineCount = await page.locator("[data-line]").count();
      const draws = sky.filter((a) => a.name === "sky-draw");
      const fades = sky.filter((a) => a.name === "sky-fade");
      const fadeOf = (pick) => fades.filter(pick).map((a) => `${a.delay}+${a.duration}`);
      if (reduced) {
        check(`${label}: /planisphere starts no draw-on or fade`, sky.length === 0, show(sky));
      } else {
        check(`${label}: /planisphere draws every one of its ${lineCount} lines on over 0.9 s`, lineCount >= 80 && draws.length === lineCount && draws.every((a) => a.tag === "polyline" && a.duration === 900 && a.delay === 0), `${draws.length} draws, ${show(draws)}`);
        check(`${label}: /planisphere's stars fade up as one group 0.4 s in`, fadeOf((a) => a.cls === "star-layer").join() === "400+600", fadeOf((a) => a.cls === "star-layer").join() || "none");
        const late = fades.filter((a) => a.cls !== "star-layer");
        const lateWho = late.map((a) => a.cls || a.data).sort().join(", ");
        check(`${label}: /planisphere's names, ecliptic, Sun and Moon fade up from 1.3 s`, lateWho === "data-moon, data-sun, ecliptic-layer, name-layer" && late.every((a) => a.delay === 1300), `${lateWho}: ${late.map((a) => a.delay).join(", ")}`);
        check(`${label}: no single star animates on its own`, sky.every((a) => a.tag !== "circle"), show(sky.filter((a) => a.tag === "circle")));
      }
      // A turn of the wheel: only the transform transition is new, and the draw-on does not restart.
      await page.evaluate(() => {
        window.__before = new Set(document.getAnimations());
        for (const el of document.querySelectorAll("[data-line]")) el.__probe = true;
        window.__value = document.querySelector("[data-disc]").getAttribute("aria-valuenow");
      });
      await page.focus("[data-disc]");
      await page.keyboard.press("ArrowRight");
      await page.waitForTimeout(120);
      const turn = await page.evaluate(() => {
        const disc = document.querySelector("[data-disc]");
        const fresh = document.getAnimations().filter((a) => !window.__before.has(a));
        const describe = (a) => ({ kind: a.constructor.name, name: a.animationName ?? a.transitionProperty, target: [...(a.effect?.target?.attributes ?? [])].map((x) => x.name).filter((n) => n.startsWith("data-")).join(" "), duration: Number(a.effect?.getComputedTiming().duration), state: a.playState });
        return {
          turned: disc.getAttribute("aria-valuenow") !== window.__value,
          fresh: fresh.map(describe),
          disc: disc.getAnimations().map(describe),
          kept: [...document.querySelectorAll("[data-line]")].every((el) => el.__probe === true),
        };
      });
      const drawsAfter = (await starts(page)).filter((a) => a.name === "sky-draw").length;
      check(`${label}: ArrowRight turns the wheel`, turn.turned, JSON.stringify(turn));
      if (reduced) {
        check(`${label}: the turn adds no animation or transition`, turn.fresh.length === 0, show(turn.fresh));
      } else {
        check(`${label}: after ArrowRight the disc runs only its transform transition`, turn.disc.length >= 1 && turn.disc.every((a) => a.kind === "CSSTransition" && a.name === "transform" && a.duration === 400), show(turn.disc));
        check(`${label}: after ArrowRight only transform transitions on the disc and rim are new`, turn.fresh.length >= 1 && turn.fresh.every((a) => a.kind === "CSSTransition" && a.name === "transform" && /\bdata-(?:disc|rim)\b/.test(a.target)), show(turn.fresh));
      }
      check(`${label}: the turn replays no line draw and remounts no line`, turn.kept && drawsAfter === draws.length, `${draws.length} -> ${drawsAfter} draws, kept ${turn.kept}`);

      // Rotor: still at load; pressing A steps the right rotor and rolls that one window.
      await page.goto(`${BASE_URL}/rotor`, { waitUntil: "load" });
      await hydrated(page, "[data-windows]");
      await page.waitForTimeout(300);
      const rollsAtLoad = (await starts(page)).filter((a) => a.name === "roll");
      const rollingAtLoad = (await loadAnimations(page)).filter((a) => a.name === "roll");
      check(`${label}: /rotor rolls no window at load`, rollsAtLoad.length === 0 && rollingAtLoad.length === 0, show([...rollsAtLoad, ...rollingAtLoad]));
      const before = await page.locator("[data-windows]").getAttribute("data-windows");
      await page.keyboard.press("a");
      await page.waitForFunction((b) => document.querySelector("[data-windows]")?.getAttribute("data-windows") !== b, before, { timeout: 3000 }).catch(() => {});
      const afterPress = await loadAnimations(page);
      await page.waitForTimeout(400);
      const after = await page.locator("[data-windows]").getAttribute("data-windows");
      check(`${label}: pressing A on /rotor steps the windows ${before} -> AAB`, before === "AAA" && after === "AAB", `${before} -> ${after}`);
      const rolls = (await starts(page)).filter((a) => a.name === "roll");
      if (reduced) {
        check(`${label}: pressing A rolls no window`, rolls.length === 0, show(rolls));
        check(`${label}: after pressing A every animation lasts <= 1 ms or has finished`, still(afterPress).length === 0, show(still(afterPress)));
      } else {
        check(`${label}: pressing A rolls exactly one window, on twos in 170 ms`, rolls.length === 1 && rolls[0].data.includes("data-window") && rolls[0].duration === 170, show(rolls));
        const marked = await page.evaluate(() => [...document.querySelectorAll("[data-window][data-rolled]")].map((el) => `${el.getAttribute("data-window")} ${el.textContent}`));
        check(`${label}: the window that rolled is the right rotor's, now B`, marked.join() === "2 B", marked.join() || "none");
      }
    } finally {
      await context.close();
    }
  }

  // JavaScript off: no island, and each instrument still ends at its resting pose.
  {
    const context = await browser.newContext({ viewport: DESKTOP, javaScriptEnabled: false });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
    const settle = () => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))).then(() => true));
    const noReact = () => page.evaluate(() => ![...document.querySelectorAll("*")].some((el) => Object.keys(el).some((k) => k.startsWith("__react"))));
    try {
      await page.goto(`${BASE_URL}/barometer?city=tokyo`, { waitUntil: "load" });
      await settle();
      check("no-JS: /barometer is not hydrated", await noReact());
      const rest = await page.evaluate(() =>
        [".needle", "rect.mercury", ".arrow", ".water"].map((sel) => {
          const el = document.querySelector(`svg.station ${sel}`);
          // counted first: clearing and restoring the animation below restarts it
          const running = el.getAnimations().length;
          const now = getComputedStyle(el).transform;
          el.style.animation = "none";
          const still = getComputedStyle(el).transform;
          el.style.animation = "";
          return { sel, now, still, running };
        }),
      );
      check("no-JS: /barometer's four parts end at their resting transform", rest.every((r) => r.now === r.still && r.running === 0), JSON.stringify(rest));

      await page.goto(`${BASE_URL}/planisphere`, { waitUntil: "load" });
      await settle();
      check("no-JS: /planisphere is not hydrated", await noReact());
      const chart = await page.evaluate(() => {
        // counted first: clearing and restoring an animation below restarts it
        const running = document.getAnimations().length;
        const lines = [...document.querySelectorAll("[data-line]")];
        const restOpacity = (el) => {
          const now = getComputedStyle(el).opacity;
          el.style.animation = "none";
          const still = getComputedStyle(el).opacity;
          el.style.animation = "";
          return now === still;
        };
        return {
          lines: lines.length,
          offsets: [...new Set(lines.map((el) => getComputedStyle(el).strokeDashoffset))],
          length: [...new Set(lines.map((el) => el.getAttribute("pathLength")))],
          layers: [".star-layer", ".name-layer", ".ecliptic-layer", "[data-sun]", "[data-moon]"].every((sel) => restOpacity(document.querySelector(`.wheel ${sel}`))),
          running,
        };
      });
      check("no-JS: /planisphere's lines end drawn (stroke-dashoffset 0)", chart.lines >= 80 && chart.offsets.every((o) => parseFloat(o) === 0) && chart.length.join() === "1", JSON.stringify(chart));
      check("no-JS: /planisphere's stars, names and markers end at their resting opacity", chart.layers && chart.running === 0, JSON.stringify(chart));

      await page.goto(`${BASE_URL}/rotor`, { waitUntil: "load" });
      await settle();
      check("no-JS: /rotor is not hydrated", await noReact());
      const windows = await page.evaluate(() => ({
        rolled: [...document.querySelectorAll("[data-window]")].some((el) => el.hasAttribute("data-rolled")),
        letters: [...document.querySelectorAll("[data-window]")].map((el) => `${el.textContent} ${getComputedStyle(el).opacity} ${getComputedStyle(el).transform}`),
        running: document.getAnimations().length,
      }));
      check("no-JS: /rotor's windows stand still, reading AAA", windows.rolled === false && windows.letters.join() === "A 1 none,A 1 none,A 1 none" && windows.running === 0, JSON.stringify(windows));
    } finally {
      await context.close();
    }
  }

  // Negative: strip @view-transition from everything /shore loads (the inline copy in its HTML and the rule in its
  // CSS), and the hop into it must cut. Its errors are expected: the old page's transition is aborted.
  {
    const { context, page } = await open(browser, { viewport: DESKTOP, reduced: false, sink: [] });
    let stripped = 0;
    const strip = (text) => text.replace(/@view-transition\s*\{[^}]*\}/g, () => (stripped++, ""));
    try {
      await page.route(/./, async (route) => {
        const request = route.request();
        const doc = request.resourceType() === "document" && new URL(request.url()).pathname === "/shore";
        const css = request.resourceType() === "stylesheet" && /\/shore(\?|$)/.test(request.headers().referer ?? "");
        if (!doc && !css) return route.continue();
        const response = await route.fetch();
        await route.fulfill({ response, body: strip(await response.text()) });
      });
      const r = await hop(page, "/projects", "/shore");
      check("negative: the probe stripped @view-transition from /shore's HTML and CSS", stripped >= 2, `${stripped} rules stripped`);
      check("negative: /projects -> /shore without the rule reveals with no transition", r.reveal === false, String(r.reveal));
    } finally {
      await context.close();
    }
  }

  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
