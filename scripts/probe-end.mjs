// Drives headless Chromium across the Internet Save Point footer verification matrix.
// Run by scripts/probe-end.sh, which passes BASE_URL. The browser comes from scripts/probe-browser.mjs: the
// runner's Chrome in CI, else the Playwright the .sh installed into PW_PREFIX.
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { site } from "../content/site.ts";
import { away, KONAMI, TENTH_POKE } from "../lib/end.ts";
import { CONSOLE_MENU, PUBLIC_PAGES } from "../lib/pages.ts";
import { launchBrowser } from "./probe-browser.mjs";
import { endTitleBounds, endTitleText, inPage, settleEndTitle, VISIBLE_FOOTER } from "./probe-end-dom.mjs";

const rootRequire = createRequire(import.meta.url);
const pg = rootRequire("pg");

// Shared-layout hydration does not resolve loading.tsx's route Suspense boundary.
// Wait for rendered content, then leave the existing text/layout/error assertions to judge it.
async function observeMainHeading(page) {
  const heading = await page.waitForFunction(() => [...document.querySelectorAll("main h1")].some((el) =>
    el.innerText?.trim() && (typeof el.checkVisibility === "function" ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : el.offsetParent !== null)),
  null, { timeout: 10_000 });
  await heading.dispose();
}

const BASE_URL = process.env.BASE_URL;
const EXPECT_SHA = process.env.EXPECT_SHA ?? "";
const ANY_SHA_OR_DEV = process.env.ANY_SHA_OR_DEV === "1";
const PROBE_LOCAL = process.env.PROBE_LOCAL === "1";
const SERVER_LOG = process.env.SERVER_LOG ?? "";

const DESKTOP = { width: 1366, height: 768 };
const TABLET = { width: 768, height: 1024 };
const PHONE = { width: 390, height: 844 };

const PUBLIC_PATHS = PUBLIC_PAGES.map((p) => p.href);
const PROJECTS = [
  "shore",
  "capsule",
  "orrery",
  "elements",
  "vinyl",
  "rotor",
  "planisphere",
  "barometer",
  "articles",
  "structures",
  "design-system",
];
const SWATCHES = [
  { name: "yellow", hex: "#f4b829", rgb: "rgb(244, 184, 41)" },
  { name: "coral", hex: "#ef6a4c", rgb: "rgb(239, 106, 76)" },
  { name: "mint", hex: "#93d3b0", rgb: "rgb(147, 211, 176)" },
  { name: "blue", hex: "#76a0e2", rgb: "rgb(118, 160, 226)" },
  { name: "pink", hex: "#f3a6bb", rgb: "rgb(243, 166, 187)" },
];

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
const hydrationErrors = [];
const footerThirdPartyRequests = [];
// External requests attributed to /music's existing television (its API bootstrap or its verified embed frame).
const televisionRequests = [];

// /music's television loads YouTube's iframe API into the page, and the player then lives in its own embed frame.
// Hosts are compared exactly on parsed URLs, so "youtube.com" in a path, query or lookalike host never matches.
const PLAYER_HOST = "www.youtube.com";
const isPlayerBootstrap = (u) =>
  u.protocol === "https:" &&
  u.hostname === PLAYER_HOST &&
  (u.pathname === "/iframe_api" || /^\/s\/player\/[\w-]+\/www-widgetapi\.vflset\/www-widgetapi\.js$/.test(u.pathname));

// Classifies one external request. pagePath is the main frame's path; playerFrame is null for a main-frame request,
// or else whether the request's top-level child frame was verified as the television's own embed iframe.
function classifyExternal({ url, pagePath, playerFrame }) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return "unexpected";
  }
  if (pagePath !== "/music") return "unexpected";
  if (playerFrame === null) return isPlayerBootstrap(u) ? "television" : "unexpected";
  return playerFrame === true ? "television" : "unexpected";
}

// The same assertion the run ends with; the attribution negative control feeds it a separate sink.
const noUnexpectedExternal = (list) => ({ pass: list.length === 0, detail: list.slice(0, 3).join(" | ") });

// A child frame counts as the television's only if its <iframe> was created with a YouTube embed src inside main,
// outside the footer, directly in the main frame. The predicate runs in the page, on the iframe element.
function isPlayerIframe(iframe) {
  let src;
  try {
    src = new URL(iframe.getAttribute("src") || iframe.src || "", location.href);
  } catch {
    return false;
  }
  return (
    iframe.tagName === "IFRAME" &&
    src.protocol === "https:" &&
    src.hostname === "www.youtube.com" &&
    src.pathname.startsWith("/embed/") &&
    (Boolean(iframe.closest("main#main")) || Boolean(iframe.__endInMain)) &&
    !iframe.closest("footer") &&
    !iframe.__endInFooter
  );
}

// Report insertion and src changes: the player may attach a blank iframe before assigning its embed URL.
// Retain ownership for a frame destroyed on leaving /music or during Suspense swap before Playwright can read its element.
function recordIframes(player) {
  const tagHost = (node, host) => {
    if (!node || node.nodeType !== 1) return;
    const ctx = host && host.nodeType === 1 ? host : node;
    const inFooter = Boolean(ctx.closest?.("footer") || node.closest?.("footer"));
    const inMain = Boolean(ctx.closest?.("main#main") || node.closest?.("main#main"));
    const apply = (el) => {
      if (inFooter) el.__endInFooter = true;
      else if (inMain) el.__endInMain = true;
    };
    if (node.tagName === "IFRAME") apply(node);
    else node.querySelectorAll?.("iframe").forEach(apply);
  };
  const report = (iframe, host) => {
    if (!iframe || iframe.tagName !== "IFRAME") return;
    tagHost(iframe, host);
    const rawAttr = iframe.getAttribute("src") ?? "";
    let resolved = iframe.src || "";
    if (!resolved && rawAttr) {
      try {
        resolved = new URL(rawAttr, location.href).href;
      } catch {}
    }
    const isPlayer = player(iframe);
    window.__endProbeIframe?.({ src: resolved, player: isPlayer });
    if (rawAttr && rawAttr !== resolved) {
      try {
        const abs = new URL(rawAttr, location.href).href;
        if (abs !== resolved) window.__endProbeIframe?.({ src: abs, player: isPlayer });
      } catch {}
    }
  };
  const origSetAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name, value) {
    origSetAttribute.call(this, name, value);
    if (this.tagName === "IFRAME" && String(name).toLowerCase() === "src") report(this);
  };
  const srcDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "src");
  if (srcDesc?.set) {
    Object.defineProperty(HTMLIFrameElement.prototype, "src", {
      ...srcDesc,
      set(value) {
        srcDesc.set.call(this, value);
        report(this);
      },
    });
  }
  const origReplaceWith = Element.prototype.replaceWith;
  if (typeof origReplaceWith === "function") {
    Element.prototype.replaceWith = function (...nodes) {
      const parent = this.parentElement;
      for (const n of nodes) tagHost(n, parent);
      const res = origReplaceWith.apply(this, nodes);
      for (const n of nodes) {
        if (n?.nodeType === 1) {
          if (n.tagName === "IFRAME") report(n, parent);
          else n.querySelectorAll?.("iframe").forEach((f) => report(f, parent));
        }
      }
      return res;
    };
  }
  const origReplaceChild = Node.prototype.replaceChild;
  if (typeof origReplaceChild === "function") {
    Node.prototype.replaceChild = function (newChild, oldChild) {
      tagHost(newChild, this);
      const res = origReplaceChild.call(this, newChild, oldChild);
      if (newChild?.nodeType === 1) {
        if (newChild.tagName === "IFRAME") report(newChild, this);
        else newChild.querySelectorAll?.("iframe").forEach((f) => report(f, this));
      }
      return res;
    };
  }
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "attributes") {
        if (m.target.tagName === "IFRAME") report(m.target);
        continue;
      }
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.tagName === "IFRAME") report(node, m.target);
        else node.querySelectorAll("iframe").forEach((f) => report(f, m.target));
      }
    }
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
}

// Reads the live element; if the iframe is already disconnected from the document or the frame/element handle
// throws during Suspense swap or route teardown, falls back to the insertion record for the URL it navigated to,
// which must be unambiguous: every iframe inserted with that src was the player's.
async function verifyPlayerFrame(frame, recorded) {
  try {
    const el = await frame.frameElement();
    const connected = await el.evaluate((iframe) => iframe.isConnected !== false);
    if (connected) {
      const live = await el.evaluate(isPlayerIframe);
      if (live) return true;
      const stillConnected = await el.evaluate((iframe) => iframe.isConnected !== false);
      if (stillConnected) return false;
    }
  } catch {
    // Frame or element handle detached/destroyed during Suspense swap or route teardown;
    // fall back to the unambiguous insertion records captured in the document.
  }
  const same = recorded(frame);
  return same.length > 0 && same.every((r) => r.player);
}

const notFoundLoad = (e) =>
  /\/does-not-exist: Failed to load resource: the server responded with a status of 404/.test(e) ||
  /Failed to load resource: the server responded with a status of 404.*\/does-not-exist/.test(e);
const youtubeNoise = (e) =>
  /compute-pressure is not allowed/i.test(e) || /www\.youtube\.com|ytimg\.com|googlevideo\.com/.test(e);

function matchesExpectedSha(sha) {
  if (!sha) return false;
  if (EXPECT_SHA) return sha === EXPECT_SHA;
  if (ANY_SHA_OR_DEV) return /^([0-9a-f]{40}|dev)$/.test(sha);
  return /^[0-9a-f]{40}$/.test(sha);
}

// Track timer and rAF activity in the page so idle efficiency can be asserted.
function installLoopCounters() {
  window.__endRafCount = 0;
  window.__endPendingRafs = 0;
  window.__endMaxPendingRafs = 0;
  window.__endIntervalTicks = 0;
  const origRaf = window.requestAnimationFrame.bind(window);
  const origCancelRaf = window.cancelAnimationFrame.bind(window);
  const pending = new Set();
  window.requestAnimationFrame = (cb) => {
    const src = typeof cb === "function" ? Function.prototype.toString.call(cb) : "";
    if (src.includes("settled") && src.includes("scattered")) {
      return origRaf(cb);
    }
    const id = origRaf((ts) => {
      pending.delete(id);
      window.__endPendingRafs = pending.size;
      window.__endRafCount++;
      cb(ts);
    });
    pending.add(id);
    window.__endPendingRafs = pending.size;
    if (pending.size > window.__endMaxPendingRafs) {
      window.__endMaxPendingRafs = pending.size;
    }
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    pending.delete(id);
    window.__endPendingRafs = pending.size;
    return origCancelRaf(id);
  };
  const origSetInterval = window.setInterval.bind(window);
  window.setInterval = (fn, ms, ...args) => {
    if (typeof fn !== "function") return origSetInterval(fn, ms, ...args);
    return origSetInterval(
      (...a) => {
        window.__endIntervalTicks++;
        fn(...a);
      },
      ms,
      ...args,
    );
  };
}

async function open(
  browser,
  {
    viewport = DESKTOP,
    isMobile = viewport === PHONE,
    hasTouch = viewport === PHONE,
    reduced = false,
    scheme = "light",
    js = true,
    sink = errors,
    netSink = footerThirdPartyRequests,
    tvSink = televisionRequests,
  } = {},
) {
  const context = await browser.newContext({
    viewport,
    isMobile,
    hasTouch,
    reducedMotion: reduced ? "reduce" : "no-preference",
    colorScheme: scheme,
    javaScriptEnabled: js,
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    const text = m.text();
    if (/hydrat|did not match|server-rendered HTML/i.test(text)) {
      hydrationErrors.push(`${page.url()}: ${text}`);
    }
    if (m.type() !== "error") return;
    const from = m.location().url;
    const line = `console ${page.url()}: ${text}${from && from !== page.url() ? ` (${from})` : ""}`;
    if (!notFoundLoad(line) && !youtubeNoise(line)) sink.push(line);
  });
  page.on("pageerror", (e) => {
    const line = `pageerror ${page.url()}: ${e.message}`;
    if (/hydrat|did not match/i.test(e.message)) hydrationErrors.push(line);
    sink.push(line);
  });
  // Verify early for teardown, but a blank iframe can gain its src later. Only positive ownership is cached.
  const iframes = [];
  const navigations = new WeakMap();
  if (js) {
    await page.exposeBinding("__endProbeIframe", (_source, record) => iframes.push(record));
    await page.addInitScript({ content: `(${recordIframes})(${isPlayerIframe});` });
  }
  const recorded = (frame) => {
    const url = navigations.get(frame) ?? frame.url();
    return iframes.filter((r) => r.src === url);
  };
  const playerFrames = new WeakSet();
  const playerFrame = async (frame) => {
    if (playerFrames.has(frame)) return true;
    const verified = await verifyPlayerFrame(frame, recorded);
    if (verified) playerFrames.add(frame);
    return verified;
  };
  page.on("frameattached", (frame) => {
    if (frame.parentFrame() === page.mainFrame()) playerFrame(frame);
  });
  const attributions = new Set();
  page.on("request", (req) => {
    const url = req.url();
    let u;
    try {
      u = new URL(url);
    } catch {
      netSink.push(`unparsable -> ${url}`);
      return;
    }
    if (u.protocol === "data:" || u.protocol === "blob:") return;
    if (u.origin === new URL(BASE_URL).origin) return;
    const pagePath = (() => {
      try {
        return new URL(page.url()).pathname;
      } catch {
        return "";
      }
    })();
    // Walk the request's frame up to the main frame; a request from inside the player belongs to its top-level child.
    let frame = null;
    try {
      frame = req.frame();
    } catch {}
    let top = null;
    for (let f = frame; f && f !== page.mainFrame(); f = f.parentFrame()) top = f;
    if (top && frame === top && req.isNavigationRequest() && !navigations.has(top)) navigations.set(top, url);
    const done = (top ? playerFrame(top) : Promise.resolve(null)).then((verified) => {
      const kind = classifyExternal({ url, pagePath, playerFrame: verified });
      const line = `${pagePath} [${top ? `frame ${verified ? "television" : "unverified"}` : "main frame"}] -> ${url}`;
      (kind === "television" ? tvSink : netSink).push(line);
    });
    attributions.add(done);
    done.finally(() => attributions.delete(done));
  });
  // Settle every pending attribution before the context goes away, so no request is dropped unclassified.
  const close = context.close.bind(context);
  context.close = async (...args) => {
    await Promise.allSettled([...attributions]);
    return close(...args);
  };
  if (js) {
    await page.addInitScript(installLoopCounters);
  }
  return { context, page };
}

// Resolves once no scroll event has arrived for quietMs. A scroll event is dispatched on the frame after the scroll, so
// one can still land after a script scrollIntoView returns; on a site page it makes Kame (components/kame) ask for its
// edge frame, which a page-wide rAF count would charge to whatever runs next.
function scrollQuiet(page, quietMs = 200) {
  return page.evaluate(
    (quietMs) =>
      new Promise((resolve) => {
        let timer = 0;
        const done = () => {
          removeEventListener("scroll", arm);
          resolve();
        };
        const arm = () => {
          clearTimeout(timer);
          timer = setTimeout(done, quietMs);
        };
        addEventListener("scroll", arm, { passive: true });
        arm();
      }),
    quietMs,
  );
}

async function hydrated(page, selector = "[data-end-stage]") {
  await page
    .waitForFunction(
      (sel) => {
        const els = [...document.querySelectorAll(sel)];
        const el = els.find((e) => (typeof e.checkVisibility === "function" ? e.checkVisibility() : true)) ?? els[0];
        return Boolean(el) && Object.keys(el).some((k) => k.startsWith("__react"));
      },
      selector,
      { timeout: 10_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(120);
}

// A route navigation retried once, and only when the runner's network changed under it (Playwright's
// net::ERR_NETWORK_CHANGED, seen on hosted runners). Any other error, or a second failure, still throws.
async function gotoRoute(page, url) {
  try {
    return await page.goto(url, { waitUntil: "load" });
  } catch (e) {
    if (!String(e?.message).includes("net::ERR_NETWORK_CHANGED")) throw e;
    console.log(`# retry: ${url} after net::ERR_NETWORK_CHANGED`);
    return page.goto(url, { waitUntil: "load" });
  }
}

// The badge fades in over 0.15 s; wait (bounded) for the visible footer's badge to be unlocked, visible and opaque
// instead of sampling it after a fixed delay. On timeout, return what it looked like so a stuck badge is diagnosable.
const BADGE_SETTLE_MS = 2_000;
async function settleBadge(page, timeout = BADGE_SETTLE_MS) {
  const settled = await page
    .waitForFunction(
      () => {
        const footer = [...document.querySelectorAll("footer.end")].find((f) => f.checkVisibility());
        const badge = footer?.querySelector("[data-end-badge]");
        if (!badge) return false;
        const s = getComputedStyle(badge);
        return badge.dataset.unlocked === "true" && s.visibility === "visible" && parseFloat(s.opacity) >= 0.99;
      },
      null,
      { timeout, polling: "raf" },
    )
    .then(
      () => true,
      () => false,
    );
  if (settled) return { settled, diag: null };
  const diag = await page.evaluate(() => {
    const footers = [...document.querySelectorAll("footer.end")];
    const footer = footers.find((f) => f.checkVisibility());
    const badge = footer?.querySelector("[data-end-badge]");
    const s = badge ? getComputedStyle(badge) : null;
    return {
      sha: document.querySelector('meta[name="build-sha"]')?.content ?? null,
      visibilityState: document.visibilityState,
      footers: footers.length,
      visibleFooters: footers.filter((f) => f.checkVisibility()).length,
      unlocked: badge?.dataset.unlocked ?? null,
      visibility: s?.visibility ?? null,
      opacity: s?.opacity ?? null,
      transition: s ? `${s.transitionProperty} ${s.transitionDuration}` : null,
      animations: badge
        ? badge.getAnimations().map((a) => ({
            name: a.transitionProperty ?? a.animationName ?? a.constructor.name,
            state: a.playState,
            currentTime: a.currentTime,
            duration: a.effect?.getTiming().duration,
          }))
        : [],
    };
  });
  return { settled, diag };
}

// Canonical link and footer structure verifier shared by all-route checks AND the negative control.
async function verifyCanonicalLinks(page) {
  const expectedPages = CONSOLE_MENU.map((item, i) => ({
    href: item.href,
    label: item.label,
    fig: `Fig. ${String(i + 2).padStart(2, "0")}`,
  }));
  const expectedLines = site.lines.map((line) => ({
    label: line.label,
    code: line.code,
    href: line.href,
    ...away(line.href),
  }));

  return page.evaluate(
    ({ expectedPages: wantPages, expectedLines: wantLines }) => {
      const isVis = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null);
      const footers = [...document.querySelectorAll("footer.end")].filter(isVis);
      if (footers.length !== 1) {
        return { ok: false, reason: `expected 1 visible footer.end, found ${footers.length}` };
      }
      const footer = footers[0];

      const pageLinks = [...footer.querySelectorAll("a[data-end-page]")];
      if (pageLinks.length !== wantPages.length) {
        return { ok: false, reason: `expected ${wantPages.length} page links, found ${pageLinks.length}` };
      }
      for (let i = 0; i < wantPages.length; i++) {
        const a = pageLinks[i];
        const want = wantPages[i];
        const href = a.getAttribute("href");
        const text = (a.textContent ?? "").replace(/\s+/g, " ").trim();
        if (href !== want.href) {
          return { ok: false, reason: `page link ${i} (${want.label}) href "${href}" !== "${want.href}"` };
        }
        if (!text.includes(want.label) || !text.includes(want.fig)) {
          return { ok: false, reason: `page link ${i} text "${text}" missing "${want.fig} ${want.label}"` };
        }
      }

      const lineLinks = [...footer.querySelectorAll("a[data-end-line]")];
      if (lineLinks.length !== wantLines.length) {
        return { ok: false, reason: `expected ${wantLines.length} contact links, found ${lineLinks.length}` };
      }
      for (let i = 0; i < wantLines.length; i++) {
        const a = lineLinks[i];
        const want = wantLines[i];
        const href = a.getAttribute("href");
        const target = a.getAttribute("target");
        const rel = a.getAttribute("rel");
        const text = (a.textContent ?? "").replace(/\s+/g, " ").trim();
        if (href !== want.href) {
          return { ok: false, reason: `contact link ${i} (${want.label}) href "${href}" !== "${want.href}"` };
        }
        if (!text.includes(want.label) || !text.includes(want.code)) {
          return { ok: false, reason: `contact link ${i} text "${text}" missing "${want.code} ${want.label}"` };
        }
        if (want.target) {
          if (target !== want.target || rel !== want.rel) {
            return { ok: false, reason: `contact link ${want.label} target/rel "${target}/${rel}" !== "${want.target}/${want.rel}"` };
          }
        } else if (target !== null || rel !== null) {
          return { ok: false, reason: `mailto link ${want.label} must not set target or rel` };
        }
      }

      return { ok: true, reason: "" };
    },
    { expectedPages, expectedLines },
  );
}

const browser = await launchBrowser();
console.log(`# base_url: ${BASE_URL}`);

try {
  // 1. All routes: 7 public pages, auth/404, and 11 isolated project roots.
  {
    const { context, page } = await open(browser, { viewport: DESKTOP });
    try {
      const utcYear = String(new Date().getUTCFullYear());
      for (const route of PUBLIC_PATHS) {
        const res = await gotoRoute(page, `${BASE_URL}${route}`);
        await hydrated(page);
        check(`route ${route}: HTTP 200`, res?.status() === 200, String(res?.status()));

        const meta = await page.evaluate(
          ({ wantCopy, wantYear, isHome }) => {
            const isVis = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null);
            const sha = document.querySelector('meta[name="build-sha"]')?.getAttribute("content") ?? "";
            const mains = [...document.querySelectorAll("main#main")].filter(isVis);
            const footers = [...document.querySelectorAll("footer.end")].filter(isVis);
            const mainNavs = [...document.querySelectorAll('nav[aria-label="Main"]')].filter(isVis);
            if (mains.length !== 1 || footers.length !== 1) {
              return { sha, ok: false, detail: `mains=${mains.length}, footers=${footers.length}` };
            }
            const main = mains[0];
            const footer = footers[0];
            const domAfter = Boolean(main.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING);
            const mainRect = main.getBoundingClientRect();
            const footerRect = footer.getBoundingClientRect();
            const belowMain = footerRect.top >= mainRect.bottom - 1;
            const labelledBy = footer.getAttribute("aria-labelledby") === "end-title";
            const footerNav = footer.querySelectorAll('nav[aria-label="Footer"]').length === 1;
            const footerMainNav = footer.querySelectorAll('[aria-label="Main"]').length === 0;
            const mainNavOk = mainNavs.length === (isHome ? 0 : 1);
            const sub = footer.querySelector(".end-sub")?.textContent?.trim() ?? "";
            const status = footer.querySelector(".end-copy > .caption")?.textContent?.trim() ?? "";
            const sig = footer.querySelector("[data-end-signature]")?.textContent?.trim() ?? "";
            const copy = footer.querySelector("[data-end-copyright]")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
            const topHref = footer.querySelector("a[data-end-top]")?.getAttribute("href") ?? "";
            // The scene's three layers, then the waterline's one wave under everything (the way down to Ryugu-jo).
            const svgs = [...footer.querySelectorAll("svg")];
            const sceneSvgs = svgs.filter((s) => !s.closest("[data-end-waterline]"));
            const waterline = footer.lastElementChild?.matches("[data-end-waterline]") ? footer.lastElementChild : null;
            const waveCount = waterline?.querySelectorAll("svg").length ?? 0;
            const ryuguHref = waterline?.querySelector("a[data-end-ryugu]")?.getAttribute("href") ?? "";
            const svgsHidden =
              sceneSvgs.length === 3 && waveCount === 1 && svgs.every((s) => s.getAttribute("aria-hidden") === "true");
            return {
              sha,
              ok:
                domAfter &&
                belowMain &&
                labelledBy &&
                footerNav &&
                footerMainNav &&
                mainNavOk &&
                sub === wantCopy.sub &&
                status === wantCopy.status &&
                sig === wantCopy.signature &&
                copy === `© ${wantYear} Otohime` &&
                topHref === "#main" &&
                ryuguHref === "/ryugu" &&
                svgsHidden,
              detail: JSON.stringify({
                domAfter,
                belowMain,
                labelledBy,
                footerNav,
                footerMainNav,
                mainNavOk,
                sub,
                copy,
                topHref,
                ryuguHref,
                sceneSvgCount: sceneSvgs.length,
                waveCount,
              }),
            };
          },
          { wantCopy: site.end, wantYear: utcYear, isHome: route === "/" },
        );

        // The heading's accessible plain source (not RisoText's aria-hidden plates), from the same visible footer.
        const title = await page.evaluate(inPage(endTitleText, VISIBLE_FOOTER));

        check(`route ${route}: build-sha matches (${meta.sha || "none"})`, matchesExpectedSha(meta.sha), meta.sha);
        check(
          `route ${route}: one semantic footer.end below main#main with landmarks, copy, year, 3 aria-hidden scene SVGs and the waterline last`,
          meta.ok && title === site.end.title,
          `${meta.detail} title=${JSON.stringify(title)}`,
        );

        const links = await verifyCanonicalLinks(page);
        check(`route ${route}: 6 canonical CONSOLE_MENU links and 4 site.lines links match source`, links.ok, links.reason);
      }

      // Auth and global 404 must remain footer-free
      for (const [route, wantStatus] of [
        ["/sign-in", 200],
        ["/forgot-password", 200],
        ["/does-not-exist", 404],
      ]) {
        const res = await gotoRoute(page, `${BASE_URL}${route}`);
        check(`isolated ${route}: HTTP ${wantStatus}`, res?.status() === wantStatus, String(res?.status()));
        const count = await page.evaluate(
          () => document.querySelectorAll("footer, [data-end-stage], #end-title").length,
        );
        check(`isolated ${route}: zero footer or save-point nodes in DOM`, count === 0, `found ${count}`);
      }

      // Eleven independent project roots must remain footer-free
      for (const proj of PROJECTS) {
        const route = `/${proj}`;
        const res = await gotoRoute(page, `${BASE_URL}${route}`);
        check(`project ${route}: HTTP 200`, res?.status() === 200, String(res?.status()));
        const info = await page.evaluate(() => ({
          sha: document.querySelector('meta[name="build-sha"]')?.getAttribute("content") ?? "",
          endNodes: document.querySelectorAll("footer.end, [data-end-stage], #end-title").length,
        }));
        check(`project ${route}: build-sha matches`, matchesExpectedSha(info.sha), info.sha);
        check(`project ${route}: isolated from site EndFooter`, info.endNodes === 0, `found ${info.endNodes}`);
      }
    } finally {
      await context.close();
    }
  }

  // 2. Responsive scene across 1366x768, 768x1024, and 390x844 (touch mobile) on /, /work, /music, /projects.
  for (const [label, viewport, mobile] of [
    ["1366x768 desktop", DESKTOP, false],
    ["768x1024 tablet", TABLET, false],
    ["390x844 touch mobile", PHONE, true],
  ]) {
    const { context, page } = await open(browser, { viewport, isMobile: mobile, hasTouch: mobile });
    try {
      for (const route of ["/", "/work", "/music", "/projects"]) {
        await gotoRoute(page, `${BASE_URL}${route}`);
        await hydrated(page);
        await page.locator("footer.end").filter({ visible: true }).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        // Let the heading's one-shot ink entry land, then measure its plain text's final line boxes.
        const settled = await page.evaluate(inPage(settleEndTitle, VISIBLE_FOOTER, 3000));
        const titleBounds = await page.evaluate(inPage(endTitleBounds, VISIBLE_FOOTER, viewport.width));

        const layout = await page.evaluate(
          ({ vw, isDesktop, isMobile, isMusic }) => {
            const isVis = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null);
            const main = [...document.querySelectorAll("main#main")].find(isVis);
            const footer = [...document.querySelectorAll("footer.end")].find(isVis);
            if (!main || !footer) return { ok: false, detail: "missing visible main or footer" };

            const scrollWidth = document.documentElement.scrollWidth;
            const noOverflow = scrollWidth <= vw;

            const mainRect = main.getBoundingClientRect();
            const footerRect = footer.getBoundingClientRect();
            const stage = footer.querySelector("[data-end-stage]");
            const canvas = footer.querySelector(".end-canvas");
            const copy = footer.querySelector(".end-copy");
            const readout = footer.querySelector("[data-end-readout]");
            const links = [...footer.querySelectorAll(".end-links > *")];
            const details = footer.querySelector("details.end-knobs-details");
            const summary = footer.querySelector("summary[data-end-disclosure]");

            const stageRect = stage.getBoundingClientRect();
            const canvasRect = canvas.getBoundingClientRect();
            const copyRect = copy.getBoundingClientRect();
            const linksRectA = links[0].getBoundingClientRect();
            const linksRectB = links[1].getBoundingClientRect();

            const gridPlacementOk = isDesktop
              ? stageRect.right <= copyRect.left + 2 && Math.abs(stageRect.top - copyRect.top) < 40
              : stageRect.bottom <= copyRect.top + 2;

            const inBounds =
              canvasRect.left >= 0 &&
              canvasRect.right <= vw &&
              copyRect.left >= 0 &&
              copyRect.right <= vw &&
              linksRectA.right <= linksRectB.left + 2;

            const textUnclipped = readout.scrollHeight <= readout.clientHeight + 2;

            const summaryStyle = getComputedStyle(summary);
            const disclosureOk = isMobile
              ? details.open === false && summaryStyle.display !== "none"
              : details.open === true && summaryStyle.display === "none";

            let musicTvOk = true;
            let musicDetail = "";
            if (isMusic) {
              const machine = main.querySelector(".machine");
              const screenBox = main.querySelector(".machine .relative > div.absolute");
              if (!machine || !screenBox) {
                musicTvOk = false;
                musicDetail = "missing television machine or screen box";
              } else {
                const mRect = machine.getBoundingClientRect();
                const sRect = screenBox.getBoundingClientRect();
                const clearGap = footerRect.top - mRect.bottom;
                // Scroll television into view to verify nothing from .end overlaps its screen center
                machine.scrollIntoView({ block: "center" });
                const sRectAfter = screenBox.getBoundingClientRect();
                const cx = sRectAfter.left + sRectAfter.width / 2;
                const cy = sRectAfter.top + sRectAfter.height / 2;
                const hit = document.elementFromPoint(cx, cy);
                const hitInsideTv = Boolean(hit && (screenBox.contains(hit) || machine.contains(hit)) && !footer.contains(hit));
                musicTvOk = clearGap >= 16 && sRect.width >= 200 && sRect.height >= 200 && hitInsideTv;
                musicDetail = `gap=${clearGap.toFixed(1)}, screen=${sRect.width.toFixed(0)}x${sRect.height.toFixed(0)}, hitInsideTv=${hitInsideTv}`;
              }
            }

            return {
              noOverflow,
              belowMain: footerRect.top >= mainRect.bottom - 1,
              gridPlacementOk,
              inBounds,
              textUnclipped,
              disclosureOk,
              musicTvOk,
              detail: JSON.stringify({
                scrollWidth,
                vw,
                gridPlacementOk,
                inBounds,
                textUnclipped,
                disclosureOk,
                musicDetail,
              }),
            };
          },
          { vw: viewport.width, isDesktop: viewport === DESKTOP, isMobile: mobile, isMusic: route === "/music" },
        );

        check(`${label} ${route}: no horizontal overflow and footer sits below main`, layout.noOverflow && layout.belowMain, layout.detail);
        check(
          `${label} ${route}: stage/copy grid, link columns, and text bounds are unclipped`,
          layout.gridPlacementOk && layout.inBounds && layout.textUnclipped && titleBounds.ok,
          `${layout.detail} title=${JSON.stringify({ ...titleBounds, settled })}`,
        );
        check(`${label} ${route}: customization disclosure state matches viewport`, layout.disclosureOk, layout.detail);
        if (route === "/music") {
          check(`${label} /music: television and its >=200x200 clear area stay unobscured above footer`, layout.musicTvOk, layout.detail);
        }
      }
    } finally {
      await context.close();
    }
  }

  // 3. Layout stability: compare reserved footer/stage/canvas/readout/badge geometry before entry, after reveal,
  // after poke, after unlock, and after persisted reload (<= 1 CSS px tolerance).
  for (const [label, viewport, mobile] of [
    ["1366x768 desktop", DESKTOP, false],
    ["390x844 touch mobile", PHONE, true],
  ]) {
    const { context, page } = await open(browser, { viewport, isMobile: mobile, hasTouch: mobile });
    try {
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "load" });
      await hydrated(page);

      const measureBoxes = () =>
        page.evaluate(() => {
          const isVis = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null);
          const footer = [...document.querySelectorAll("footer.end")].find(isVis);
          const pick = (sel) => {
            const el = sel ? footer.querySelector(sel) : footer;
            const r = el.getBoundingClientRect();
            return { w: r.width, h: r.height };
          };
          return {
            seen: footer.dataset.seen ?? "false",
            unlocked: footer.querySelector("[data-end-badge]")?.dataset.unlocked ?? "false",
            footer: pick(null),
            stage: pick("[data-end-stage]"),
            canvas: pick(".end-canvas"),
            readout: pick("[data-end-readout]"),
            badge: pick("[data-end-badge]"),
          };
        });

      const beforeEntry = await measureBoxes();
      check(`${label} layout stability: footer starts offscreen before entry on /projects`, beforeEntry.seen === "false", JSON.stringify(beforeEntry));

      await page.locator("footer.end").filter({ visible: true }).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(850);
      const afterReveal = await measureBoxes();

      await page.locator("[data-end-mascot]").filter({ visible: true }).first().click();
      await page.waitForTimeout(260);
      const afterPoke = await measureBoxes();

      for (const k of KONAMI) await page.keyboard.press(k);
      await page.waitForTimeout(100);
      const afterUnlock = await measureBoxes();

      await page.reload({ waitUntil: "load" });
      await hydrated(page);
      await page.locator("footer.end").filter({ visible: true }).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(850);
      const afterRestore = await measureBoxes();

      const maxDelta = (a, b) =>
        Math.max(
          Math.abs(a.footer.w - b.footer.w),
          Math.abs(a.footer.h - b.footer.h),
          Math.abs(a.stage.w - b.stage.w),
          Math.abs(a.stage.h - b.stage.h),
          Math.abs(a.canvas.w - b.canvas.w),
          Math.abs(a.canvas.h - b.canvas.h),
          Math.abs(a.readout.w - b.readout.w),
          Math.abs(a.readout.h - b.readout.h),
          Math.abs(a.badge.w - b.badge.w),
          Math.abs(a.badge.h - b.badge.h),
        );

      const dReveal = maxDelta(beforeEntry, afterReveal);
      const dPoke = maxDelta(beforeEntry, afterPoke);
      const dUnlock = maxDelta(beforeEntry, afterUnlock);
      const dRestore = maxDelta(beforeEntry, afterRestore);

      check(
        `${label} layout stability: reserved footer/stage/canvas/readout/badge geometry shifts <= 1 px across entry, reveal, poke, unlock and persisted restore`,
        dReveal <= 1 && dPoke <= 1 && dUnlock <= 1 && dRestore <= 1 && afterRestore.unlocked === "true",
        `max deltas px: reveal=${dReveal.toFixed(2)}, poke=${dPoke.toFixed(2)}, unlock=${dUnlock.toFixed(2)}, restore=${dRestore.toFixed(2)}`,
      );
    } finally {
      await context.close();
    }
  }

  // 4. Readability: actual SVG LCD text bounds in every state (idle, all poke lines, 10th poke, 11th resume, unlocked),
  // light/dark contrast, 5 accents, wobble displacement scale, and mobile keyboard disclosure.
  for (const [label, viewport, mobile] of [
    ["1366x768 desktop", DESKTOP, false],
    ["768x1024 tablet", TABLET, false],
    ["390x844 touch mobile", PHONE, true],
  ]) {
    const { context, page } = await open(browser, { viewport, isMobile: mobile, hasTouch: mobile });
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
      await hydrated(page);
      await page.locator("footer.end").filter({ visible: true }).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      const checkLcd = () =>
        page.evaluate(() => {
          const isVis = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null);
          const footer = [...document.querySelectorAll("footer.end")].find(isVis);
          const screen = footer.querySelector("[data-lcd-screen]");
          const eyes = footer.querySelector("[data-end-eyes]");
          const t0 = footer.querySelector('[data-lcd-line="0"]');
          const t1 = footer.querySelector('[data-lcd-line="1"]');
          const readout = footer.querySelector("[data-end-readout]");
          const sb = screen.getBBox();
          const eb = eyes.getBBox();
          const b0 = t0.getBBox();
          const b1 = t1.getBBox();
          const l0 = t0.getComputedTextLength();
          const l1 = t1.getComputedTextLength();
          const sr = screen.getBoundingClientRect();
          const r0 = t0.getBoundingClientRect();
          const r1 = t1.getBoundingClientRect();
          const fitsSvg =
            l0 <= sb.width - 6 &&
            l1 <= sb.width - 6 &&
            b0.x >= sb.x + 2 &&
            b0.x + b0.width <= sb.x + sb.width - 2 &&
            b1.x >= sb.x + 2 &&
            b1.x + b1.width <= sb.x + sb.width - 2 &&
            b0.y >= eb.y + eb.height &&
            b1.y >= b0.y + b0.height - 2 &&
            b1.y + b1.height <= sb.y + sb.height - 1;
          const fitsClient =
            r0.left >= sr.left &&
            r0.right <= sr.right &&
            r0.top >= sr.top &&
            r0.bottom <= sr.bottom &&
            r1.left >= sr.left &&
            r1.right <= sr.right &&
            r1.top >= sr.top &&
            r1.bottom <= sr.bottom;
          return {
            rows: [t0.textContent, t1.textContent],
            readout: readout.textContent,
            l0: +l0.toFixed(2),
            l1: +l1.toFixed(2),
            fitsSvg,
            fitsClient,
          };
        });

      const states = [];
      states.push({ state: "idle", ...(await checkLcd()) });
      const mascot = page.locator("[data-end-mascot]").filter({ visible: true }).first();
      for (let i = 1; i <= TENTH_POKE + 1; i++) {
        await mascot.click();
        await page.waitForTimeout(220);
        states.push({ state: `poke-${i}`, ...(await checkLcd()) });
      }
      for (const k of KONAMI) await page.keyboard.press(k);
      await page.waitForTimeout(80);
      states.push({ state: "unlocked", ...(await checkLcd()) });

      const allFit = states.every((s) => s.fitsSvg && s.fitsClient);
      const tenth = states.find((s) => s.state === `poke-${TENTH_POKE}`);
      const eleventh = states.find((s) => s.state === `poke-${TENTH_POKE + 1}`);
      const unlocked = states.find((s) => s.state === "unlocked");

      check(
        `${label} LCD bounds: all ${states.length} displayed states fit inside the 64-unit LCD screen in SVG and client coords`,
        allFit,
        JSON.stringify(states.filter((s) => !s.fitsSvg || !s.fitsClient)),
      );
      check(
        `${label} LCD states: 10th poke shows STOP/POKING, 11th resumes cycle, and unlock shows REACHED/THE END with full HTML readout`,
        tenth?.rows.join("/") === "STOP/POKING" &&
          tenth?.readout === site.end.tenth.readout &&
          eleventh?.rows.join("/") === site.end.lines[4].lcd.join("/") &&
          unlocked?.rows.join("/") === "REACHED/THE END" &&
          unlocked?.readout === site.end.unlocked.readout,
        JSON.stringify({ tenth, eleventh, unlocked }),
      );
    } finally {
      await context.close();
    }
  }

  // Theme colors/contrast, 5 accents, displacement scale, and mobile keyboard disclosure.
  {
    for (const scheme of ["light", "dark"]) {
      const { context, page } = await open(browser, { viewport: DESKTOP, scheme });
      try {
        await page.goto(`${BASE_URL}/work`, { waitUntil: "load" });
        await hydrated(page);
        const themeCheck = await page.evaluate(() => {
          const parseRgb = (s) => {
            const m = s.match(/\d+(\.\d+)?/g);
            if (!m) return [0, 0, 0];
            const vals = m.slice(0, 3).map(Number);
            return s.startsWith("color(") ? vals.map((v) => v * 255) : vals;
          };
          const lum = ([r, g, b]) => {
            const f = (c) => {
              const v = c / 255;
              return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const ratio = (a, b) => {
            const l1 = lum(a);
            const l2 = lum(b);
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          };
          const bodyBg = parseRgb(getComputedStyle(document.body).backgroundColor);
          const footer = document.querySelector("footer.end");
          const titleColor = parseRgb(getComputedStyle(footer.querySelector("h2#end-title")).color);
          const mutedColor = parseRgb(getComputedStyle(footer.querySelector("[data-end-readout]")).color);
          const lcdBg = parseRgb(getComputedStyle(footer.querySelector(".fig-lcd")).fill);
          const lcdFg = parseRgb(getComputedStyle(footer.querySelector('[data-lcd-line="0"]')).fill);
          const starFill = parseRgb(getComputedStyle(footer.querySelector(".end-star")).fill);
          return {
            bodyBg: getComputedStyle(document.body).backgroundColor,
            inkRatio: +ratio(bodyBg, titleColor).toFixed(2),
            mutedRatio: +ratio(bodyBg, mutedColor).toFixed(2),
            lcdRatio: +ratio(lcdBg, lcdFg).toFixed(2),
            starRatio: +ratio(bodyBg, starFill).toFixed(2),
          };
        });
        check(
          `theme ${scheme}: WCAG contrast passes for heading/links (${themeCheck.inkRatio}:1), muted copy (${themeCheck.mutedRatio}:1), LCD (${themeCheck.lcdRatio}:1) and stars (${themeCheck.starRatio}:1)`,
          themeCheck.inkRatio >= 12 && themeCheck.mutedRatio >= 4.5 && themeCheck.lcdRatio >= 8 && themeCheck.starRatio >= 10,
          JSON.stringify(themeCheck),
        );
      } finally {
        await context.close();
      }
    }

    // Five accents and wobble slider on /work (also verifying isolation from other machines on the page)
    const { context, page } = await open(browser, { viewport: DESKTOP });
    try {
      await page.goto(`${BASE_URL}/work`, { waitUntil: "load" });
      await hydrated(page);
      const footer = page.locator("footer.end").filter({ visible: true }).first();
      await footer.scrollIntoViewIfNeeded();

      const otherMachineBefore = await page.evaluate(() => {
        const m = document.querySelector("main .machine");
        return m ? getComputedStyle(m).getPropertyValue("--fig").trim() : "";
      });

      for (const sw of SWATCHES) {
        await footer.locator(`input[type="radio"][value="${sw.name}"]`).check({ force: true });
        const got = await page.evaluate(() => {
          const stage = document.querySelector("footer.end [data-end-stage]");
          const lits = stage.querySelectorAll(".end-console-wrap .fig-lit");
          const bodyLit = lits[lits.length - 1];
          const other = document.querySelector("main .machine");
          return {
            fig: stage.style.getPropertyValue("--fig").trim(),
            fill: getComputedStyle(bodyLit).fill,
            otherFig: other ? getComputedStyle(other).getPropertyValue("--fig").trim() : "",
          };
        });
        check(
          `customization swatch ${sw.name}: updates stage --fig (${got.fig}) and console fill (${got.fill}) without mutating main machine`,
          got.fig === sw.hex && got.fill === sw.rgb && got.otherFig === otherMachineBefore,
          JSON.stringify(got),
        );
      }

      // Check wobble displacement scale default (3.5) and updated values (0 and 6.4)
      const defaultScales = await page.evaluate(() =>
        [...document.querySelectorAll("footer.end feDisplacementMap")].map((el) => Number(el.getAttribute("scale"))),
      );
      check(
        "customization wobble: default displacement scale is 3.5 on both Inked SVG filters",
        defaultScales.length === 2 && defaultScales.every((n) => Math.abs(n - 3.5) < 0.01),
        JSON.stringify(defaultScales),
      );

      for (const targetWobble of [0, 6.4]) {
        await footer.locator("input[data-end-wobble]").fill(String(targetWobble));
        const scales = await page.evaluate(() =>
          [...document.querySelectorAll("footer.end feDisplacementMap")].map((el) => Number(el.getAttribute("scale"))),
        );
        check(
          `customization wobble: setting range to ${targetWobble} updates both feDisplacementMap scales`,
          scales.length === 2 && scales.every((n) => Math.abs(n - targetWobble) < 0.01),
          JSON.stringify(scales),
        );
      }
    } finally {
      await context.close();
    }

    // Mobile keyboard access to customization disclosure
    const { context: mCtx, page: mPage } = await open(browser, {
      viewport: PHONE,
      isMobile: true,
      hasTouch: true,
    });
    try {
      await mPage.goto(`${BASE_URL}/`, { waitUntil: "load" });
      await hydrated(mPage);
      const footer = mPage.locator("footer.end").filter({ visible: true }).first();
      await footer.scrollIntoViewIfNeeded();
      const summary = footer.locator("summary[data-end-disclosure]");
      await summary.focus();
      await mPage.keyboard.press("Enter");
      const opened = await footer.locator("details.end-knobs-details").evaluate((el) => el.open);
      const wobbleVisible = await footer.locator("input[data-end-wobble]").isVisible();
      check(
        "390x844 mobile disclosure: Enter on 'Customize scene' summary opens the panel and exposes wobble/swatches",
        opened === true && wobbleVisible === true,
        `open=${opened}, wobbleVisible=${wobbleVisible}`,
      );
    } finally {
      await mCtx.close();
    }
  }

  // 5. Entrance once, offscreen/document-hidden pause, filter isolation, idle JS loop efficiency, and reduced motion.
  {
    const { context, page } = await open(browser, { viewport: DESKTOP });
    try {
      await page.addInitScript(() => {
        window.__endEntranceStarts = 0;
        addEventListener("animationstart", (e) => {
          const el = e.target;
          if (
            el instanceof Element &&
            el.closest("footer.end") &&
            (el.matches(".end-ground-wrap, .end-console-wrap, .end-title-text, .end-rise"))
          ) {
            window.__endEntranceStarts++;
          }
        });
      });

      await page.goto(`${BASE_URL}/projects`, { waitUntil: "load" });
      await hydrated(page);

      const initial = await page.evaluate(() => {
        const footer = document.querySelector("footer.end");
        const stage = footer.querySelector("[data-end-stage]");
        const playStates = [".end-cloud", ".end-star", ".end-lamp", ".end-packet"].map(
          (sel) => getComputedStyle(footer.querySelector(sel)).animationPlayState,
        );
        return {
          seen: footer.dataset.seen ?? null,
          active: stage.dataset.active ?? null,
          playStates,
        };
      });
      check(
        "entrance & offscreen pause: before scrolling to footer on /projects, data-seen and data-active are unset and ambient loops are paused",
        initial.seen === null && initial.active === null && initial.playStates.every((s) => s === "paused"),
        JSON.stringify(initial),
      );

      // Scroll footer into view
      await page.locator("footer.end").filter({ visible: true }).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(950);

      const inViewState = await page.evaluate(() => {
        const footer = document.querySelector("footer.end");
        const stage = footer.querySelector("[data-end-stage]");
        const playStates = [".end-cloud", ".end-star", ".end-lamp", ".end-packet"].map(
          (sel) => getComputedStyle(footer.querySelector(sel)).animationPlayState,
        );
        return {
          seen: footer.dataset.seen ?? null,
          active: stage.dataset.active ?? null,
          playStates,
          starts: window.__endEntranceStarts,
        };
      });
      check(
        "entrance: scrolling footer into view sets data-seen=true, data-active=true, runs entrance once, and starts ambient loops",
        inViewState.seen === "true" &&
          inViewState.active === "true" &&
          inViewState.starts === 6 &&
          inViewState.playStates.every((s) => s === "running"),
        JSON.stringify(inViewState),
      );

      // Filter isolation: no animated ambient or interactive SVG node has an ancestor with an SVG filter or CSS filter
      const filterCheck = await page.evaluate(() => {
        const footer = document.querySelector("footer.end");
        const targets = footer.querySelectorAll(
          ".end-cloud, .end-star, .end-lamp, .end-packet, [data-end-eyes], [data-end-pupils], [data-lcd-line]",
        );
        const filtered = [];
        for (const el of targets) {
          let cur = el;
          while (cur && cur !== footer) {
            const attrFilter = cur.getAttribute("filter");
            const cssFilter = getComputedStyle(cur).filter;
            if (attrFilter || (cssFilter && cssFilter !== "none")) {
              filtered.push(`${el.tagName}.${el.getAttribute("class")} -> ${cur.tagName}(${attrFilter || cssFilter})`);
            }
            cur = cur.parentElement;
          }
        }
        return { count: targets.length, filtered };
      });
      check(
        "efficiency: ambient animated layers, eyes and LCD lines have no SVG/CSS filter ancestor",
        filterCheck.count >= 16 && filterCheck.filtered.length === 0,
        JSON.stringify(filterCheck),
      );

      // Idle efficiency: while visible and idle over 400 ms, zero rAF callbacks and zero setInterval ticks run
      const idleActivity = await page.evaluate(async () => {
        const r0 = window.__endRafCount;
        const i0 = window.__endIntervalTicks;
        await new Promise((r) => setTimeout(r, 400));
        return {
          rafDelta: window.__endRafCount - r0,
          intervalDelta: window.__endIntervalTicks - i0,
          pendingRafs: window.__endPendingRafs,
        };
      });
      check(
        "efficiency: zero rAF callbacks and zero JS interval ticks run while the visible footer is idle",
        idleActivity.rafDelta === 0 && idleActivity.intervalDelta === 0 && idleActivity.pendingRafs === 0,
        JSON.stringify(idleActivity),
      );

      // Scroll back to top -> pauses ambient motion while keeping data-seen=true; re-entry does not replay entrance
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(250);
      const offscreenAgain = await page.evaluate(() => {
        const footer = document.querySelector("footer.end");
        const stage = footer.querySelector("[data-end-stage]");
        const playStates = [".end-cloud", ".end-star", ".end-lamp", ".end-packet"].map(
          (sel) => getComputedStyle(footer.querySelector(sel)).animationPlayState,
        );
        return {
          seen: footer.dataset.seen ?? null,
          active: stage.dataset.active ?? null,
          playStates,
        };
      });
      check(
        "offscreen pause: scrolling back to top keeps data-seen=true, removes data-active, and pauses ambient loops",
        offscreenAgain.seen === "true" &&
          offscreenAgain.active === null &&
          offscreenAgain.playStates.every((s) => s === "paused"),
        JSON.stringify(offscreenAgain),
      );

      await page.locator("footer.end").filter({ visible: true }).first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(350);
      const reentered = await page.evaluate(() => ({
        active: document.querySelector("footer.end [data-end-stage]")?.dataset.active ?? null,
        starts: window.__endEntranceStarts,
      }));
      check(
        "entrance: scrolling back into view resumes data-active without replaying entrance animations",
        reentered.active === "true" && reentered.starts === 6,
        JSON.stringify(reentered),
      );

      // Document-hidden pause: move pointer to offset eyes, type 3 Konami keys, then simulate hidden tab
      const stageBox = await page.locator("footer.end [data-end-stage]").boundingBox();
      await page.mouse.move(stageBox.x + 20, stageBox.y + 20);
      await page.waitForTimeout(60);
      for (const k of KONAMI.slice(0, 3)) await page.keyboard.press(k);

      const hiddenState = await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
        Object.defineProperty(document, "hidden", { value: true, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      void hiddenState;
      await page.waitForTimeout(60);

      const whileHidden = await page.evaluate(() => {
        const footer = document.querySelector("footer.end");
        const stage = footer.querySelector("[data-end-stage]");
        const pupils = footer.querySelector("[data-end-pupils]");
        const playStates = [".end-cloud", ".end-star", ".end-lamp", ".end-packet"].map(
          (sel) => getComputedStyle(footer.querySelector(sel)).animationPlayState,
        );
        return {
          active: stage.dataset.active ?? null,
          pupilsTransform: pupils.style.transform,
          playStates,
        };
      });
      check(
        "document-hidden pause: hiding the document pauses ambient loops and resets pupils to (0, 0)",
        whileHidden.active === null &&
          whileHidden.pupilsTransform === "translate(0px, 0px)" &&
          whileHidden.playStates.every((s) => s === "paused"),
        JSON.stringify(whileHidden),
      );

      // Restore visibility and type remaining 7 Konami keys -> must NOT unlock because hiding cleared partial progress
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
        Object.defineProperty(document, "hidden", { value: false, configurable: true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForTimeout(60);
      for (const k of KONAMI.slice(3)) await page.keyboard.press(k);
      const unlockedAfterHide = await page.locator("footer.end [data-end-stage]").getAttribute("data-unlocked");
      check(
        "document-hidden pause: partial Konami progress was cleared on hide and remaining keys do not unlock",
        unlockedAfterHide === "false",
        String(unlockedAfterHide),
      );
    } finally {
      await context.close();
    }

    // Reduced motion: initial context and live toggle mid-press
    {
      const { context, page } = await open(browser, { viewport: DESKTOP, reduced: true });
      try {
        await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
        await hydrated(page);
        await page.locator("footer.end").filter({ visible: true }).first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(100);

        await page.locator("footer.end [data-end-stage]").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
        const stageBox = await page.locator("footer.end [data-end-stage]").boundingBox();
        await page.mouse.move(stageBox.x + 15, stageBox.y + 15);
        await page.waitForTimeout(60);

        const reducedInitial = await page.evaluate(() => {
          const footer = document.querySelector("footer.end");
          const stage = footer.querySelector("[data-end-stage]");
          const pupils = footer.querySelector("[data-end-pupils]");
          const anims = document
            .getAnimations()
            .filter((a) => !(a.animationName ?? "").startsWith("-ua-"))
            .map((a) => ({
              name: a.animationName ?? a.transitionProperty ?? "",
              duration: Number(a.effect?.getComputedTiming().duration),
              state: a.playState,
            }));
          const longRunning = anims.filter((a) => !(a.duration <= 1 || a.state === "finished"));
          return {
            active: stage.dataset.active ?? null,
            pupils: pupils.style.transform,
            longRunning,
          };
        });
        check(
          "reduced motion (initial): scene is still, data-active is unset, eyes stay at (0, 0), and all CSS animations are <= 1 ms or finished",
          reducedInitial.active === null &&
            reducedInitial.pupils === "translate(0px, 0px)" &&
            reducedInitial.longRunning.length === 0,
          JSON.stringify(reducedInitial),
        );

        await page.locator("footer.end [data-end-mascot]").click();
        const afterReducedPoke = await page.evaluate(() => {
          const footer = document.querySelector("footer.end");
          const btn = footer.querySelector("[data-end-mascot]");
          const t0 = footer.querySelector('[data-lcd-line="0"]');
          const t1 = footer.querySelector('[data-lcd-line="1"]');
          return {
            pressed: btn.getAttribute("aria-pressed"),
            rows: `${t0.textContent}/${t1.textContent}`,
          };
        });
        check(
          "reduced motion (initial): poking advances LCD immediately and settles press without delay",
          afterReducedPoke.pressed === "false" && afterReducedPoke.rows === "HI/THERE",
          JSON.stringify(afterReducedPoke),
        );
      } finally {
        await context.close();
      }

      // Live toggle of prefers-reduced-motion mid-press
      const { context: liveCtx, page: livePage } = await open(browser, { viewport: DESKTOP, reduced: false });
      try {
        await livePage.goto(`${BASE_URL}/`, { waitUntil: "load" });
        await hydrated(livePage);
        await livePage.locator("footer.end").filter({ visible: true }).first().scrollIntoViewIfNeeded();
        await livePage.waitForTimeout(200);

        // Optional companion controls make the full footer taller than this viewport.
        // Center the stage below the sticky masthead; nearest scrolling can leave its top corners behind it.
        await livePage.locator("footer.end [data-end-stage]").evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
        const stageBox = await livePage.locator("footer.end [data-end-stage]").boundingBox();
        await livePage.mouse.move(stageBox.x + 25, stageBox.y + 25);
        await livePage.waitForTimeout(60);

        // Click mascot to start the 2-tick press, verify busy/pressed and offset eyes, then emulate reducedMotion: reduce mid-press
        const ticksBefore = await livePage.evaluate(() => window.__endIntervalTicks);
        await livePage.locator("footer.end [data-end-mascot]").click();
        const midPress = await livePage.evaluate(() => {
          const stage = document.querySelector("footer.end [data-end-stage]");
          const btn = stage.querySelector("[data-end-mascot]");
          const pupils = stage.querySelector("[data-end-pupils]");
          return {
            busy: stage.dataset.busy ?? null,
            pressed: btn.getAttribute("aria-pressed"),
            pupils: pupils.style.transform,
          };
        });
        check(
          "reduced motion (mid-press): press starts busy with aria-pressed=true and offset desktop eyes",
          midPress.busy === "true" && midPress.pressed === "true" && midPress.pupils !== "translate(0px, 0px)",
          JSON.stringify(midPress),
        );

        await livePage.emulateMedia({ reducedMotion: "reduce" });
        await livePage
          .waitForFunction(
            () => {
              const stage = document.querySelector("footer.end [data-end-stage]");
              const btn = stage?.querySelector("[data-end-mascot]");
              const pupils = stage?.querySelector("[data-end-pupils]");
              return (
                stage &&
                stage.dataset.active === undefined &&
                stage.dataset.busy === undefined &&
                btn?.getAttribute("aria-pressed") === "false" &&
                pupils?.style.transform === "translate(0px, 0px)"
              );
            },
            null,
            { timeout: 500 },
          )
          .catch(() => {});
        const afterToggle = await livePage.evaluate((beforeTicks) => {
          const stage = document.querySelector("footer.end [data-end-stage]");
          const btn = stage.querySelector("[data-end-mascot]");
          const pupils = stage.querySelector("[data-end-pupils]");
          return {
            active: stage.dataset.active ?? null,
            busy: stage.dataset.busy ?? null,
            pressed: btn.getAttribute("aria-pressed"),
            pupils: pupils.style.transform,
            ticksDelta: window.__endIntervalTicks - beforeTicks,
          };
        }, ticksBefore);
        check(
          "reduced motion (mid-press): toggling prefers-reduced-motion settles active press and resets eyes immediately",
          afterToggle.active === null &&
            afterToggle.busy === null &&
            afterToggle.pressed === "false" &&
            afterToggle.pupils === "translate(0px, 0px)" &&
            afterToggle.ticksDelta < 2,
          JSON.stringify(afterToggle),
        );
      } finally {
        await liveCtx.close();
      }
    }
  }

  // 6. Mascot click, tap, Enter, Space; desktop eye bounds & touch eye stillness; Konami exclusions, unlock, reload persistence, and blocked localStorage.
  {
    const { context, page } = await open(browser, { viewport: DESKTOP });
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
      await hydrated(page);
      const footer = page.locator("footer.end").filter({ visible: true }).first();
      await footer.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);

      // Desktop eye bounds across all 4 corners and reset on leave
      const stage = footer.locator("[data-end-stage]");
      await stage.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
      const box = await stage.boundingBox();
      // The setup scroll also positions Kame at the edge. Measure pointer work only after its last scroll event has
      // landed and the frames it asked for have drained.
      await scrollQuiet(page);
      await page.waitForFunction(() => window.__endPendingRafs === 0);
      await page.evaluate(() => {
        window.__endMaxPendingRafs = 0;
      });
      const samples = [];
      for (const [px, py] of [
        [box.x + 12, box.y + 12],
        [box.x + box.width - 12, box.y + 12],
        [box.x + 12, box.y + box.height - 12],
        [box.x + box.width - 12, box.y + box.height - 12],
      ]) {
        await page.mouse.move(px, py);
        await page.waitForTimeout(40);
        const tr = await footer.locator("[data-end-pupils]").evaluate((el) => el.style.transform);
        const m = tr.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
        samples.push(m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 999, y: 999 });
      }
      await page.mouse.move(Math.max(2, box.x - 12), Math.max(2, box.y - 12));
      await page.waitForTimeout(40);
      const resetTr = await footer.locator("[data-end-pupils]").evaluate((el) => el.style.transform);
      const maxPending = await page.evaluate(() => window.__endMaxPendingRafs);

      check(
        "desktop eyes: follow pointer within |x| <= 2.2 and |y| <= 1.8, schedule at most 1 pending rAF, and reset on leave",
        samples.every((s) => (s.x !== 0 || s.y !== 0) && Math.abs(s.x) <= 2.2 && Math.abs(s.y) <= 1.8) &&
          resetTr === "translate(0px, 0px)" &&
          maxPending <= 1,
        JSON.stringify({ samples, resetTr, maxPending }),
      );

      // Negative control for that wait: a scroll landing during pointer work makes Kame's edge frame overlap the eyes'
      // one, and the same page-wide count sees 2. Kame swims after the pointer moved, and only then takes an edge frame.
      const overlap = await stage.evaluate(async (el) => {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        window.__endMaxPendingRafs = 0;
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: r.left + 12, clientY: r.top + 12 }));
        window.dispatchEvent(new Event("scroll"));
        const seen = window.__endMaxPendingRafs;
        el.dispatchEvent(new PointerEvent("pointerleave", { bubbles: false }));
        return seen;
      });
      check(
        "rAF negative control: a scroll during pointer work overlaps Kame's edge frame with the eyes' and the count sees 2",
        overlap === 2,
        JSON.stringify({ overlap }),
      );

      // Mascot click, Enter, Space
      const mascot = footer.locator("[data-end-mascot]");
      await mascot.click();
      await page.waitForTimeout(220);
      const afterClick = await footer.locator('[data-lcd-line="0"]').textContent();

      await mascot.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(220);
      const afterEnter = await footer.locator('[data-lcd-line="0"]').textContent();

      await page.keyboard.press(" ");
      await page.waitForTimeout(220);
      const afterSpace = await footer.locator('[data-lcd-line="0"]').textContent();

      check(
        "mascot desktop activations: click, Enter and Space each advance the console cue and settle",
        afterClick === "HI" && afterEnter === `${PUBLIC_PAGES.length} PAGES` && afterSpace === "12 FPS",
        `${afterClick} -> ${afterEnter} -> ${afterSpace}`,
      );
    } finally {
      await context.close();
    }

    // Touch mobile: tap mascot and verify eyes remain still
    {
      const { context: tCtx, page: tPage } = await open(browser, {
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
      });
      try {
        await tPage.goto(`${BASE_URL}/`, { waitUntil: "load" });
        await hydrated(tPage);
        const footer = tPage.locator("footer.end").filter({ visible: true }).first();
        await footer.scrollIntoViewIfNeeded();
        await tPage.waitForTimeout(200);

        await footer.locator("[data-end-mascot]").tap();
        await tPage.waitForTimeout(220);
        const touchState = await tPage.evaluate(() => {
          const footer = document.querySelector("footer.end");
          return {
            lcd: `${footer.querySelector('[data-lcd-line="0"]').textContent}/${footer.querySelector('[data-lcd-line="1"]').textContent}`,
            pupils: footer.querySelector("[data-end-pupils]").style.transform,
            cloudsDisplay: getComputedStyle(footer.querySelector(".end-clouds")).display,
            packetsDisplay: getComputedStyle(footer.querySelector(".end-packets")).display,
          };
        });
        check(
          "390x844 touch mobile: tap activates mascot, eyes stay at (0, 0), and clouds/packets are suppressed below 40rem",
          touchState.lcd === "HI/THERE" &&
            touchState.pupils === "translate(0px, 0px)" &&
            touchState.cloudsDisplay === "none" &&
            touchState.packetsDisplay === "none",
          JSON.stringify(touchState),
        );
      } finally {
        await tCtx.close();
      }
    }

    // Konami exclusions, unlock, default preservation, no A-navigation, and reload persistence
    {
      const { context, page } = await open(browser, { viewport: DESKTOP });
      try {
        await page.goto(`${BASE_URL}/projects`, { waitUntil: "load" });
        await hydrated(page);

        // (a) Inactive-footer exclusion: footer is offscreen at scrollY=0 on /projects
        for (const k of KONAMI) await page.keyboard.press(k);
        const offscreenUnlocked = await page.locator("footer.end [data-end-stage]").getAttribute("data-unlocked");
        check(
          "Konami exclusion: typing sequence while footer is offscreen does not unlock",
          offscreenUnlocked === "false",
          String(offscreenUnlocked),
        );

        // Scroll footer into view
        const footer = page.locator("footer.end").filter({ visible: true }).first();
        await footer.scrollIntoViewIfNeeded();
        await page.waitForTimeout(250);

        // (b) Editable targets exclusion: range input, text input, textarea, select, and contenteditable descendant
        await footer.locator("input[data-end-wobble]").focus();
        for (const k of KONAMI) await page.keyboard.press(k);
        const rangeUnlocked = await footer.locator("[data-end-stage]").getAttribute("data-unlocked");

        const editableUnlocked = await page.evaluate((keys) => {
          const host = document.createElement("div");
          host.innerHTML = `
            <input id="probe-in" type="text" />
            <textarea id="probe-ta"></textarea>
            <select id="probe-sel"><option>1</option></select>
            <div contenteditable="true"><span id="probe-ce">edit</span></div>
          `;
          document.body.appendChild(host);
          for (const sel of ["#probe-in", "#probe-ta", "#probe-sel", "#probe-ce"]) {
            const el = host.querySelector(sel);
            for (const key of keys) {
              el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
            }
          }
          host.remove();
          return document.querySelector("footer.end [data-end-stage]")?.getAttribute("data-unlocked");
        }, KONAMI);

        check(
          "Konami exclusion: typing sequence in input, textarea, select or contenteditable descendant does not unlock",
          rangeUnlocked === "false" && editableUnlocked === "false",
          `range=${rangeUnlocked}, editable=${editableUnlocked}`,
        );

        //Blur any input before testing modifier/repeat/wrong/correct sequences
        await footer.locator("[data-end-mascot]").focus();

        // (c) Modifier and repeat exclusions
        const modRepeatUnlocked = await page.evaluate((keys) => {
          for (const key of keys) {
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key,
                ctrlKey: key === "a",
                bubbles: true,
                cancelable: true,
              }),
            );
          }
          for (const key of keys) {
            window.dispatchEvent(
              new KeyboardEvent("keydown", {
                key,
                repeat: key === "b",
                bubbles: true,
                cancelable: true,
              }),
            );
          }
          return document.querySelector("footer.end [data-end-stage]")?.getAttribute("data-unlocked");
        }, KONAMI);
        check(
          "Konami exclusion: modifier shortcuts and repeated keydown events do not unlock",
          modRepeatUnlocked === "false",
          String(modRepeatUnlocked),
        );

        // (d) Wrong sequence exclusion
        for (const k of [...KONAMI.slice(0, 8), "x", "b", "a"]) {
          await page.keyboard.press(k);
        }
        const wrongUnlocked = await footer.locator("[data-end-stage]").getAttribute("data-unlocked");
        check(
          "Konami exclusion: wrong key sequence resets progress and does not unlock",
          wrongUnlocked === "false",
          String(wrongUnlocked),
        );

        // (e) Correct Konami sequence (with prefix overlap ArrowUp + uppercase B/A), checking defaultPrevented and URL stability
        await page.evaluate(() => {
          window.__endPreventedKeys = [];
          window.addEventListener("keydown", (e) => {
            if (e.defaultPrevented) window.__endPreventedKeys.push(e.key);
          });
        });

        await page.keyboard.press("ArrowUp");
        for (const k of [...KONAMI.slice(0, 8), "B", "A"]) {
          await page.keyboard.press(k);
        }
        const unlockSettle = await settleBadge(page);

        const unlockResult = await page.evaluate(() => {
          const footer = document.querySelector("footer.end");
          const stage = footer.querySelector("[data-end-stage]");
          const badge = footer.querySelector("[data-end-badge]");
          const badgeStyle = getComputedStyle(badge);
          return {
            pathname: location.pathname,
            prevented: window.__endPreventedKeys,
            stageUnlocked: stage.getAttribute("data-unlocked"),
            badgeUnlocked: badge.getAttribute("data-unlocked"),
            badgeVisible: badgeStyle.visibility === "visible" && parseFloat(badgeStyle.opacity) >= 0.99,
            badgeText: badge.textContent?.trim(),
            lcd: `${footer.querySelector('[data-lcd-line="0"]').textContent}/${footer.querySelector('[data-lcd-line="1"]').textContent}`,
            readout: footer.querySelector("[data-end-readout]").textContent?.trim(),
            stored: localStorage.getItem("end:achievement"),
          };
        });

        check(
          "Konami achievement: unlocks 'Reached the end', updates LCD/readout/badge, stores end:achievement=1, preserves key defaults and stays on /projects",
          unlockResult.pathname === "/projects" &&
            unlockResult.prevented.length === 0 &&
            unlockResult.stageUnlocked === "true" &&
            unlockResult.badgeUnlocked === "true" &&
            unlockResult.badgeVisible === true &&
            unlockResult.badgeText === site.end.badge &&
            unlockResult.lcd === "REACHED/THE END" &&
            unlockResult.readout === site.end.unlocked.readout &&
            unlockResult.stored === "1",
          JSON.stringify({ ...unlockResult, settle: unlockSettle.diag }),
        );

        // Badge negative control (this browser's DOM only): hold the unlocked badge at opacity 0 and the same bounded
        // settling must time out and the same visibility test must fail; lifting the hold must settle again.
        await page.evaluate(() => {
          const hold = document.createElement("style");
          hold.id = "probe-badge-hold";
          hold.textContent = '.end-badge[data-unlocked="true"] { opacity: 0 !important; transition: none !important; }';
          document.head.append(hold);
        });
        const heldSettle = await settleBadge(page, 600);
        const heldVisible = await page.evaluate(() => {
          const s = getComputedStyle(document.querySelector("footer.end [data-end-badge]"));
          return s.visibility === "visible" && parseFloat(s.opacity) >= 0.99;
        });
        await page.evaluate(() => document.getElementById("probe-badge-hold")?.remove());
        const liftedSettle = await settleBadge(page);
        check(
          "badge negative control: a badge held at opacity 0 fails the bounded visibility wait, then settles once released",
          heldSettle.settled === false && heldVisible === false && heldSettle.diag?.opacity === "0" && liftedSettle.settled === true,
          JSON.stringify({ held: heldSettle.diag, heldVisible, lifted: liftedSettle.diag }),
        );

        // (f) Persistence across reload with no hydration error
        await page.reload({ waitUntil: "load" });
        await hydrated(page);
        const restoreSettle = await settleBadge(page);
        const restoredResult = await page.evaluate(() => {
          const footer = document.querySelector("footer.end");
          const stage = footer.querySelector("[data-end-stage]");
          const badge = footer.querySelector("[data-end-badge]");
          const badgeStyle = getComputedStyle(badge);
          return {
            stageUnlocked: stage.getAttribute("data-unlocked"),
            badgeUnlocked: badge.getAttribute("data-unlocked"),
            badgeVisible: badgeStyle.visibility === "visible" && parseFloat(badgeStyle.opacity) >= 0.99,
            lcd: `${footer.querySelector('[data-lcd-line="0"]').textContent}/${footer.querySelector('[data-lcd-line="1"]').textContent}`,
          };
        });
        check(
          "Konami persistence: reloading restores the unlocked badge and LCD state without hydration error",
          restoredResult.stageUnlocked === "true" &&
            restoredResult.badgeUnlocked === "true" &&
            restoredResult.badgeVisible === true &&
            restoredResult.lcd === "REACHED/THE END",
          JSON.stringify({ ...restoredResult, settle: restoreSettle.diag }),
        );
      } finally {
        await context.close();
      }
    }

    // Blocked localStorage fallback
    {
      const blockedErrors = [];
      const { context, page } = await open(browser, { viewport: DESKTOP, sink: blockedErrors });
      try {
        await page.addInitScript(() => {
          Object.defineProperty(window, "localStorage", {
            get() {
              throw new DOMException("Storage disabled", "SecurityError");
            },
            configurable: true,
          });
        });
        await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
        await hydrated(page);
        const footer = page.locator("footer.end").filter({ visible: true }).first();
        await footer.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);

        for (const k of KONAMI) await page.keyboard.press(k);
        await page.waitForTimeout(80);

        const ephemeral = await page.evaluate(() => {
          const footer = document.querySelector("footer.end");
          const badge = footer.querySelector("[data-end-badge]");
          return {
            unlocked: badge.getAttribute("data-unlocked"),
            lcd: `${footer.querySelector('[data-lcd-line="0"]').textContent}/${footer.querySelector('[data-lcd-line="1"]').textContent}`,
          };
        });
        check(
          "blocked localStorage: Konami unlocks ephemerally without throwing a page or console error",
          ephemeral.unlocked === "true" && ephemeral.lcd === "REACHED/THE END" && blockedErrors.length === 0,
          JSON.stringify({ ephemeral, blockedErrors }),
        );
      } finally {
        await context.close();
      }
    }
  }

  // 7. Internal navigation & group transitions via footer links, real Tab order, Back to top, and no-JavaScript.
  {
    const { context, page } = await open(browser, { viewport: DESKTOP });
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
      await hydrated(page);

      // Navigate / ((home)) -> /work ((app)) -> /projects ((app)) -> /work ((app)) -> / ((home))
      for (const [from, linkSel, to] of [
        ["/", 'footer.end a[data-end-page="/work"]', "/work"],
        ["/work", 'footer.end a[data-end-page="/projects"]', "/projects"],
        ["/projects", 'footer.end a[data-end-page="/work"]', "/work"],
        ["/work", 'header.masthead a[href="/"]', "/"],
      ]) {
        const target = page.locator(linkSel).filter({ visible: true }).first();
        await target.scrollIntoViewIfNeeded();
        await Promise.all([
          page.waitForURL((u) => u.pathname === to, { timeout: 15_000 }),
          target.click(),
        ]);
        await page.waitForTimeout(450);
        await hydrated(page);
        const state = await page.evaluate(() => {
          const isVis = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null);
          const visFooters = [...document.querySelectorAll("footer.end")].filter(isVis);
          const visMains = [...document.querySelectorAll("main#main")].filter(isVis);
          return {
            pathname: location.pathname,
            visFooters: visFooters.length,
            visMains: visMains.length,
          };
        });
        check(
          `navigation ${from} -> ${to}: completes with exactly 1 visible main#main and 1 visible footer.end`,
          state.pathname === to && state.visFooters === 1 && state.visMains === 1,
          JSON.stringify(state),
        );
      }

      // Real keyboard Tab progression through the entire footer on /work (after group transitions!)
      const workLink = page.locator('footer.end a[data-end-page="/work"]').filter({ visible: true }).first();
      await Promise.all([
        page.waitForURL((u) => u.pathname === "/work", { timeout: 15_000 }),
        workLink.click(),
      ]);
      await page.waitForTimeout(450);
      await hydrated(page);

      const footer = page.locator("footer.end").filter({ visible: true }).first();
      await footer.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);

      // Position focus on the mascot button, verify Shift+Tab then Tab reaches it cleanly, then walk Tab through all footer controls
      await footer.locator("[data-end-mascot]").focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");

      const tabStops = [];
      const describeActive = () =>
        page.evaluate(() => {
          const el = document.activeElement;
          if (!el) return null;
          const inFooter = Boolean(el.closest("footer.end"));
          const style = getComputedStyle(el);
          const swatchSpan = el.matches('input[type="radio"]') ? el.nextElementSibling : null;
          const swatchStyle = swatchSpan ? getComputedStyle(swatchSpan) : null;
          const focusRing =
            (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
            Boolean(swatchStyle && swatchStyle.outlineStyle !== "none" && parseFloat(swatchStyle.outlineWidth) > 0);
          let kind = el.tagName.toLowerCase();
          if (el.hasAttribute("data-end-mascot")) kind = "mascot";
          else if (el.hasAttribute("data-end-disclosure")) kind = "disclosure";
          else if (el.hasAttribute("data-end-wobble")) kind = "wobble";
          else if (el.matches('input[type="radio"]')) kind = `swatch:${el.getAttribute("value")}`;
          else if (el.hasAttribute("data-end-page")) kind = `page:${el.getAttribute("data-end-page")}`;
          else if (el.hasAttribute("data-end-zine")) kind = "zine";
          else if (el.hasAttribute("data-end-line")) kind = `line:${el.getAttribute("data-end-line")}`;
          else if (el.hasAttribute("data-kame-action")) kind = `kame:${el.getAttribute("data-kame-action")}`;
          else if (el.matches('input[aria-label="Kame name"]')) kind = "kame:name";
          else if (el.hasAttribute("data-end-top")) kind = "top";
          else if (el.hasAttribute("data-end-ryugu")) kind = "ryugu";
          return { inFooter, kind, focusRing };
        });

      // Every stop the footer should hold, in order: the pages, then the zine link under them (/zine, a sheet to print,
      // not a CONSOLE_MENU room), then the contact lines, Back to top, and last the waterline's way down to Ryugu-jo.
      // The walk takes one Tab per stop, so a new page or line lengthens it instead of leaving the last stops unvisited.
      const expectedKinds = [
        "mascot",
        "wobble",
        "swatch:mint",
        ...CONSOLE_MENU.map((m) => `page:${m.href}`),
        "zine",
        ...site.lines.map((l) => `line:${l.label}`),
        "kame:call", "kame:pet", "kame:hide", "kame:name",
        "top",
        "ryugu",
      ];
      const firstStop = await describeActive();
      if (firstStop) tabStops.push(firstStop);
      for (let i = 1; i < expectedKinds.length; i++) {
        await page.keyboard.press("Tab");
        const stop = await describeActive();
        if (stop) tabStops.push(stop);
      }
      // One more Tab should leave the footer (no keyboard trap)
      await page.keyboard.press("Tab");
      const afterFooter = await describeActive();

      const gotKinds = tabStops.map((s) => s.kind);
      const allRingsVisible = tabStops.every((s) => s.inFooter && s.focusRing);

      check(
        `keyboard Tab progression: visits mascot, wobble, swatch group, ${CONSOLE_MENU.length} pages, the zine link, ${site.lines.length} contact lines, Kame controls, Back to top and the waterline in order with visible focus rings and no trap`,
        JSON.stringify(gotKinds) === JSON.stringify(expectedKinds) &&
          allRingsVisible &&
          afterFooter?.inFooter === false,
        JSON.stringify({ gotKinds, allRingsVisible, afterFooter }),
      );

      // Back to top: scroll down on /projects, press Enter on Back to top, verify scrollY near 0 and visible main#main focused
      await page.goto(`${BASE_URL}/projects`, { waitUntil: "load" });
      await hydrated(page);
      const projFooter = page.locator("footer.end").filter({ visible: true }).first();
      await projFooter.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const scrollBefore = await page.evaluate(() => window.scrollY);
      const topBtn = projFooter.locator("a[data-end-top]");
      await topBtn.focus();
      await page.keyboard.press("Enter");
      await page
        .waitForFunction(() => window.scrollY <= 4, null, { timeout: 5000 })
        .catch(() => {});
      const topResult = await page.evaluate((beforeY) => {
        const isVis = (el) => (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null);
        const visMain = [...document.querySelectorAll("main#main")].find(isVis);
        return {
          scrollBefore: beforeY,
          scrollAfter: window.scrollY,
          focusedVisibleMain: document.activeElement === visMain,
        };
      }, scrollBefore);
      check(
        "Back to top: scrolls to page start (scrollY <= 4) and focuses the visible main#main landmark",
        topResult.scrollBefore > 100 && topResult.scrollAfter <= 4 && topResult.focusedVisibleMain === true,
        JSON.stringify(topResult),
      );
    } finally {
      await context.close();
    }

    // No JavaScript: still scene, heading, links, credits, UTC year, and #main anchor fallback
    {
      const { context, page } = await open(browser, { viewport: DESKTOP, js: false });
      try {
        await page.goto(`${BASE_URL}/`, { waitUntil: "load" });
        const noJsCheck = await verifyCanonicalLinks(page);
        const noJsTitle = await page.evaluate(inPage(endTitleText, `document.querySelector("footer.end")`));
        const noJsDom = await page.evaluate(() => {
          const footer = document.querySelector("footer.end");
          const svgs = [...footer.querySelectorAll("svg")].filter((s) => !s.closest("[data-end-waterline]"));
          return {
            svgCount: svgs.length,
            lcd: `${footer.querySelector('[data-lcd-line="0"]')?.textContent}/${footer.querySelector('[data-lcd-line="1"]')?.textContent}`,
            topHref: footer.querySelector("a[data-end-top]")?.getAttribute("href"),
            runningFooterAnims: document
              .getAnimations()
              .filter((a) => a.effect?.target?.closest("footer.end") && a.playState === "running").length,
          };
        });
        check(
          "no-JS: renders complete still scene, heading, 6 page links, 4 contact links, credits, year and #main top anchor",
          noJsCheck.ok &&
            noJsTitle === site.end.title &&
            noJsDom.svgCount === 3 &&
            noJsDom.lcd === "SAVE/POINT" &&
            noJsDom.topHref === "#main" &&
            noJsDom.runningFooterAnims === 0,
          JSON.stringify({ noJsCheck, noJsDom, noJsTitle }),
        );

        // Follow footer Work link without JS
        await Promise.all([
          page.waitForURL((u) => u.pathname === "/work", { timeout: 10_000 }),
          page.locator('footer.end a[data-end-page="/work"]').click(),
        ]);
        check("no-JS: clicking footer Work link navigates to /work", new URL(page.url()).pathname === "/work", page.url());

        // Click Back to top anchor without JS
        await page.locator("footer.end a[data-end-top]").scrollIntoViewIfNeeded();
        await page.locator("footer.end a[data-end-top]").click();
        const hashAfter = await page.evaluate(() => ({ hash: location.hash, y: window.scrollY }));
        check(
          "no-JS: Back to top anchor jumps to #main near top of page",
          hashAfter.hash === "#main" && hashAfter.y <= 8,
          JSON.stringify(hashAfter),
        );
      } finally {
        await context.close();
      }
    }

    // Local-only repeated plain-user full-load 403 -> /projects -> full-load 403 -> /dashboard at 390x844 reduced motion.
    // Preserves strictly read-only remote BASE_URL behavior.
    const isLocalHost = ["localhost", "127.0.0.1"].includes(new URL(BASE_URL).hostname);
    if ((PROBE_LOCAL || isLocalHost) && process.env.DATABASE_URL) {
      let dbClient = null;
      let dbReady = false;
      try {
        dbClient = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
        await dbClient.connect();
        await dbClient.query("SELECT 1");
        dbReady = true;
      } catch {
        dbReady = false;
      }
      if (dbReady && dbClient) {
        const probeEmail = `end-403-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@probe.test`;
        const abortDigests = [];
        let signedUp = false;
        let cookies = [];
        try {
          for (let attempt = 0; attempt < 3; attempt++) {
            const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
              method: "POST",
              headers: { origin: BASE_URL, "content-type": "application/json" },
              body: JSON.stringify({
                name: "end-probe",
                email: probeEmail,
                password: "end-probe-local-password-123",
              }),
            });
            if (res.status === 429) {
              await new Promise((r) => setTimeout(r, 1000 * Number(res.headers.get("x-retry-after") ?? 10)));
              continue;
            }
            if (res.status === 200) {
              signedUp = true;
              cookies = res.headers.getSetCookie().map((c) => {
                const [pair] = c.split(";");
                const at = pair.indexOf("=");
                return { name: pair.slice(0, at), value: pair.slice(at + 1), url: BASE_URL };
              });
            }
            break;
          }
          check(
            "local 390x844 reduced-motion 403 exit: isolated plain-user sign-up succeeds",
            signedUp && cookies.length > 0,
            `signedUp=${signedUp}, cookies=${cookies.length}`,
          );
          if (signedUp && cookies.length > 0) {
            const errorsFrom = errors.length;
            const { context, page } = await open(browser, {
              viewport: PHONE,
              isMobile: true,
              hasTouch: true,
              reduced: true,
            });
            try {
              await context.addCookies(cookies);
              page.on("response", async (response) => {
                if (!response.url().startsWith(BASE_URL)) return;
                if (!["document", "fetch"].includes(response.request().resourceType())) return;
                try {
                  const body = await response.text();
                  for (const m of body.matchAll(/\$RX\("([^"]+)","([^"]+)"/g)) {
                    abortDigests.push(`${m[1]}:${m[2]}`);
                  }
                } catch {}
              });

              const cycleResults = [];
              for (let cycle = 0; cycle < 2; cycle++) {
                for (const target of ["projects", "dashboard"]) {
                  await page.goto(`${BASE_URL}/admin/roles`, { waitUntil: "load" });
                  await page.getByRole("heading", { name: "This room is locked" }).waitFor({ timeout: 15_000 });
                  await hydrated(page);
                  const denied = await page.evaluate(() => {
                    const isVis = (el) =>
                      typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null;
                    const robots = [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content);
                    const visFooters = [...document.querySelectorAll("footer.end")].filter(isVis).length;
                    return {
                      h1: document.querySelector("main h1")?.textContent?.trim() ?? "",
                      noindex: robots.some((c) => c.includes("noindex")),
                      visFooters,
                    };
                  });
                  await page.locator(`nav[aria-label="Main"] a[href="/${target}"]`).click();
                  await page.waitForURL(`${BASE_URL}/${target}`, { timeout: 15_000 });
                  await hydrated(page);
                  await observeMainHeading(page);
                  const landed = await page.evaluate(() => {
                    const isVis = (el) =>
                      typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null;
                    return {
                      pathname: location.pathname,
                      h1: document.querySelector("main h1")?.textContent?.trim() ?? "",
                      visMains: [...document.querySelectorAll("main#main")].filter(isVis).length,
                      visFooters: [...document.querySelectorAll("footer.end")].filter(isVis).length,
                    };
                  });
                  cycleResults.push({ cycle, target, denied, landed });
                }
              }

              const local403Errors = errors.slice(errorsFrom);
              const allDeniedOk = cycleResults.every(
                (r) =>
                  r.denied.h1.includes("This room is locked") &&
                  r.denied.noindex === true &&
                  r.denied.visFooters === 1,
              );
              const allLandedOk = cycleResults.every(
                (r) =>
                  r.landed.pathname === `/${r.target}` &&
                  r.landed.visMains === 1 &&
                  r.landed.visFooters === 1 &&
                  (r.target === "dashboard" ? r.landed.h1.includes("Hello,") : r.landed.h1.includes("Projects")),
              );
              check(
                "local 390x844 reduced-motion 403 exit: repeated full-load /admin/roles -> /projects -> full-load /admin/roles -> /dashboard preserves access denial, noindex, 1 visible footer, normal navigation, zero abort digests and zero page/console errors",
                allDeniedOk && allLandedOk && abortDigests.length === 0 && local403Errors.length === 0,
                JSON.stringify({ allDeniedOk, allLandedOk, abortDigests, local403Errors, cycleResults }),
              );
            } finally {
              await context.close();
            }
          }
        } finally {
          await dbClient.query('DELETE FROM "user" WHERE email = $1', [probeEmail]).catch(() => {});
          await dbClient.end().catch(() => {});
        }
      } else if (dbClient) {
        await dbClient.end().catch(() => {});
      }
    }
  }

  // 8. Harness negative control: corrupt a canonical footer href via local browser interception / DOM mutation,
  // prove verifyCanonicalLinks fails on the corruption, then restore/reload and prove it passes.
  {
    const { context, page } = await open(browser, { viewport: DESKTOP });
    try {
      await page.goto(`${BASE_URL}/work`, { waitUntil: "load" });
      await hydrated(page);

      // Mutate one canonical footer link href in-memory in this isolated context (read-only on the server)
      await page.evaluate(() => {
        const link = document.querySelector('footer.end a[data-end-page="/play"]');
        if (link) link.setAttribute("href", "/broken-play");
      });
      const corrupted = await verifyCanonicalLinks(page);
      check(
        "negative control: verifyCanonicalLinks rejects a corrupted canonical footer href (/broken-play !== /play)",
        corrupted.ok === false && corrupted.reason.includes('/broken-play" !== "/play"'),
        corrupted.reason,
      );

      // Reload clean document and verify the exact same assertion passes
      await page.reload({ waitUntil: "load" });
      await hydrated(page);
      const restored = await verifyCanonicalLinks(page);
      check(
        "negative control: after reload, the same verifyCanonicalLinks assertion passes",
        restored.ok === true,
        restored.reason,
      );
    } finally {
      await context.close();
    }
  }

  // 8b. Network attribution negative control. The classifier on its own: exact parsed hosts, no substring bypass.
  {
    const cases = [
      ["television API from /music", { url: "https://www.youtube.com/iframe_api", pagePath: "/music", playerFrame: null }, "television"],
      ["television API from /work", { url: "https://www.youtube.com/iframe_api", pagePath: "/work", playerFrame: null }, "unexpected"],
      ["youtube.com only in the path", { url: "https://evil.test/www.youtube.com/iframe_api", pagePath: "/music", playerFrame: null }, "unexpected"],
      ["youtube.com only in the query", { url: "https://evil.test/x?u=https://www.youtube.com/iframe_api", pagePath: "/music", playerFrame: null }, "unexpected"],
      ["lookalike host", { url: "https://www.youtube.com.evil.test/iframe_api", pagePath: "/music", playerFrame: null }, "unexpected"],
      ["ads from the main frame", { url: "https://googleads.g.doubleclick.net/pagead/id", pagePath: "/music", playerFrame: null }, "unexpected"],
      ["ads from the verified player frame", { url: "https://googleads.g.doubleclick.net/pagead/id", pagePath: "/music", playerFrame: true }, "television"],
      ["ads from an unverified frame", { url: "https://googleads.g.doubleclick.net/pagead/id", pagePath: "/music", playerFrame: false }, "unexpected"],
    ];
    const wrong = cases.filter(([, input, want]) => classifyExternal(input) !== want).map(([name]) => name);
    // A frame whose element can no longer be read (or was disconnected during Suspense swap / teardown)
    // is the player's only by an unambiguous insertion record.
    const EMBED = "https://www.youtube.com/embed/?probe=1";
    const gone = (detached) => ({
      frameElement: async () => {
        throw new Error("frame was detached");
      },
      isDetached: () => detached,
      url: () => EMBED,
    });
    const disconnected = () => ({
      frameElement: async () => ({
        evaluate: async (fn) =>
          fn({
            isConnected: false,
            tagName: "IFRAME",
            getAttribute: (name) => (name === "src" ? EMBED : null),
            src: EMBED,
            closest: () => null,
          }),
      }),
      isDetached: () => false,
      url: () => EMBED,
    });
    const frames = [
      ["detached player frame with its record", gone(true), [{ src: EMBED, player: true }], true],
      ["teardown frame throwing before isDetached flips with unambiguous player record", gone(false), [{ src: EMBED, player: true }], true],
      ["disconnected iframe (!isConnected) after Suspense swap with unambiguous player record", disconnected(), [{ src: EMBED, player: true }], true],
      ["disconnected iframe (!isConnected) whose src was also inserted outside the player", disconnected(), [{ src: EMBED, player: true }, { src: EMBED, player: false }], false],
      ["detached frame whose src was also inserted outside the player", gone(true), [{ src: EMBED, player: true }, { src: EMBED, player: false }], false],
      ["detached frame with no record", gone(true), [], false],
      ["teardown frame throwing before isDetached flips with no record", gone(false), [], false],
      ["detached frame recorded outside the player", gone(true), [{ src: EMBED, player: false }], false],
    ];
    for (const [name, frame, records, want] of frames) {
      if ((await verifyPlayerFrame(frame, () => records)) !== want) wrong.push(name);
    }
    check(
      "network negative control: the classifier keeps the player API and verified player frame apart from main-frame, lookalike, path/query, unverified-frame and ambiguous detached-frame requests",
      wrong.length === 0,
      wrong.join(", "),
    );
  }

  // In a real browser, with every control URL fulfilled locally by page.route (nothing reaches the network or the
  // deployed site): a stub player API creates the television's embed iframe, whose ad request must be attributed to
  // the television, while the same request from the main frame, from a look-alike embed inside the footer, or from
  // look-alike URLs must make the run's final network assertion fail.
  {
    const controlNet = [];
    const controlTv = [];
    const { context, page } = await open(browser, { viewport: DESKTOP, netSink: controlNet, tvSink: controlTv, sink: [] });
    try {
      const AD = "https://googleads.g.doubleclick.net/pagead/id";
      await page.route("https://www.youtube.com/iframe_api", (route) =>
        route.fulfill({
          contentType: "text/javascript",
          body: `window.YT = { Player: class {
            constructor(slot, opts) {
              const f = document.createElement("iframe");
              f.dataset.probePlayer = "";
              slot.replaceWith(f);
              this.f = f;
              setTimeout(() => opts.events.onReady({ target: this }));
            }
            cuePlaylist() {} playVideo() {} pauseVideo() {} playVideoAt() {}
            getPlaylistIndex() { return 0; }
            destroy() { this.f.remove(); }
          } };
          window.onYouTubeIframeAPIReady();`,
        }),
      );
      await page.route("https://www.youtube.com/embed/**", (route) =>
        route.fulfill({ contentType: "text/html", body: `<script>fetch(${JSON.stringify(AD)}, { mode: "no-cors" })</script>` }),
      );
      for (const pattern of ["https://googleads.g.doubleclick.net/**", "https://evil.test/**", "https://www.youtube.com.evil.test/**"]) {
        await page.route(pattern, (route) => route.fulfill({ status: 204, body: "" }));
      }

      await page.goto(`${BASE_URL}/music`, { waitUntil: "load" });
      await hydrated(page);
      await page.locator("iframe[data-probe-player]").waitFor({ state: "attached", timeout: 10_000 });
      // Reproduce the real player lifecycle: attach about:blank, then assign src
      // after the eager ownership check has had a browser round trip to settle.
      await page.frameLocator("iframe[data-probe-player]").locator("body").waitFor({ state: "attached" });
      check("network delayed-src setup: the player's attached iframe starts without an embed URL",
        await page.locator("iframe[data-probe-player]").getAttribute("src") === null);
      await page.locator("iframe[data-probe-player]").evaluate((frame) => {
        frame.src = "https://www.youtube.com/embed/?probe=television";
      });
      // Wait for the player frame's own ad request, bounded.
      const deadline = Date.now() + 5_000;
      while (!controlTv.some((l) => l.includes("doubleclick")) && Date.now() < deadline) await page.waitForTimeout(50);
      const televisionAttributed = controlTv.filter((l) => l.includes("[frame television]") && l.includes(AD));
      const beforeInjection = noUnexpectedExternal(controlNet);
      check(
        "network negative control: the television's own embed frame request is attributed to the television, and the assertion still passes",
        televisionAttributed.length > 0 && beforeInjection.pass,
        JSON.stringify({ controlTv, controlNet }),
      );

      const embedUrl = "https://www.youtube.com/embed/?probe=television";
      const twinRequest = page.waitForRequest((request) => request.url() === embedUrl && request.isNavigationRequest());
      await page.evaluate(() => {
        const twin = document.createElement("iframe");
        twin.src = "https://www.youtube.com/embed/?probe=television";
        document.querySelector("footer.end").append(twin);
      });
      await twinRequest;
      // context.close below awaits the actual pending attribution; this check
      // observes the same rejection before the remaining existing controls.
      await page.waitForFunction(() => [...document.querySelectorAll("footer.end iframe")]
        .some((frame) => frame.contentWindow && frame.getAttribute("src")?.includes("probe=television")));
      const twinDeadline = Date.now() + 5_000;
      while (!controlNet.some((line) => line.includes(`[frame unverified] -> ${embedUrl}`)) && Date.now() < twinDeadline) await page.waitForTimeout(50);
      check("network delayed-src negative control: the same embed URL in the footer remains unexpected",
        controlNet.some((line) => line.includes(`[frame unverified] -> ${embedUrl}`)) && !noUnexpectedExternal(controlNet).pass,
        JSON.stringify({ controlTv, controlNet }));

      // Now the same traffic from places the footer or main page could make it.
      await page.evaluate((ad) => {
        const footer = [...document.querySelectorAll("footer.end")].find((f) => f.checkVisibility());
        const lookalike = document.createElement("iframe");
        lookalike.src = "https://www.youtube.com/embed/?probe=footer";
        lookalike.dataset.probeFooterFrame = "";
        footer.append(lookalike);
        for (const url of [ad, "https://evil.test/www.youtube.com/iframe_api?h=www.youtube.com", "https://www.youtube.com.evil.test/iframe_api"]) {
          fetch(url, { mode: "no-cors" }).catch(() => {});
        }
      }, AD);
      const want = [
        `/music [main frame] -> ${AD}`,
        "/music [main frame] -> https://evil.test/www.youtube.com/iframe_api?h=www.youtube.com",
        "/music [main frame] -> https://www.youtube.com.evil.test/iframe_api",
        `/music [frame unverified] -> ${AD}`,
      ];
      const injectDeadline = Date.now() + 5_000;
      while (!want.every((w) => controlNet.includes(w)) && Date.now() < injectDeadline) await page.waitForTimeout(50);
      const afterInjection = noUnexpectedExternal(controlNet);
      check(
        "network negative control: main-frame ad, path/query and look-alike host requests and a footer-side embed frame make the same network assertion fail",
        afterInjection.pass === false && want.every((w) => controlNet.includes(w)),
        JSON.stringify({ controlNet, controlTv }),
      );
    } finally {
      await context.close();
    }
  }

  // 9. Global error and server-log hygiene.
  check(
    "errors: zero hydration errors across all contexts",
    hydrationErrors.length === 0,
    hydrationErrors.slice(0, 3).join(" | "),
  );
  check(
    "errors: zero console errors or page errors across all contexts",
    errors.length === 0,
    errors.slice(0, 3).join(" | "),
  );
  const network = noUnexpectedExternal(footerThirdPartyRequests);
  console.log(`# network: ${televisionRequests.length} external requests attributed to /music's existing television`);
  check("network: zero unexpected external network requests from footer pages", network.pass, network.detail);

  if (PROBE_LOCAL && SERVER_LOG && existsSync(SERVER_LOG)) {
    const serverLog = readFileSync(SERVER_LOG, "utf8");
    const badServerLines = serverLog
      .split("\n")
      .filter((line) => /Error occurred prerendering|UnhandledPromiseRejection|ReferenceError:|TypeError:/.test(line));
    check(
      "local server: server.log contains no runtime errors",
      badServerLines.length === 0,
      badServerLines.slice(0, 3).join(" | "),
    );
  }
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
