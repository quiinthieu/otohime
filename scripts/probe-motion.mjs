// Drives headless Chromium across the hops between root layouts. Run by scripts/probe-motion.sh, which installs
// Playwright into PW_PREFIX and passes BASE_URL.
//
// Every hop clicks the real link, so it is the page's own navigation (a page.goto is browser UI and never gets a
// cross-document transition). pageswap fires on the old document, so its answer is kept in sessionStorage;
// pagereveal fires on the new one, before its first frame, and keeps the transition's animations once it is ready.
// Each /projects -> project hop is that project's first load in its context, as on a visitor's first hop.
// The site's own pages: a sidebar click /work -> /projects runs page-out and page-in, the eight /projects rows
// rise 40 ms apart, and /sign-in and the 404 load cleanly; under reduced motion all of it is still.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const PROJECTS = ["shore", "capsule", "orrery", "elements", "vinyl", "rotor", "planisphere", "barometer"];

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
    check(`${label}: /projects names its eight rows after the projects`, [...seen].sort().join(", ") === want, seen.join(", "));
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
        check(`${label}: /projects has 8 row rise animations`, rows.length === 8 && rows.every((r) => r.name === "rise"), JSON.stringify(rows));
        check(
          `${label}: the rows' delays increase, 40 ms apart`,
          delays.length === 8 && delays.every((d, i) => d === i * 40),
          delays.join(", "),
        );
        const last = rows.at(-1);
        check(`${label}: the last row is up within 0.7 s`, last !== undefined && last.delay + last.duration < 700, JSON.stringify(last));
      } else {
        check(`${label}: every /projects row's effective delay is <= 1 ms`, rows.length === 8 && rows.every((r) => r.delay <= 1 && r.cssDelay <= 1), JSON.stringify(rows));
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
  // The 404 document's own load is logged as a failed resource; anything else, a 404 subresource included, is an error.
  // HTTP/1.1 (next start) logs "404 (Not Found)"; HTTP/2 (otohime.dev) has no reason phrase and logs "404 ()".
  const notFoundLoad = (e) => /\/does-not-exist: Failed to load resource: the server responded with a status of 404 \((?:Not Found)?\)$/.test(e);
  const siteReal = siteErrors.filter((e) => !notFoundLoad(e));
  check("site: /projects, /sign-in and /does-not-exist load with no console error or page error", siteReal.length === 0, siteReal.slice(0, 3).join(" | "));

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
