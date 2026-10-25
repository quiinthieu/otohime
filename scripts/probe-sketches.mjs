// Headless Chromium browser probe for /sketches at 1366x768 and 390x844.
// Asserts build-sha, rendered section/figure counts, responsive loaded images,
// negative-control 404 image interception, and named PNG download behavior; then the scroll-drawn frame and
// paper wash in light and dark, under reduced motion (initial and live), without view-timeline support and
// without JavaScript.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const EXPECT_PEOPLE = Number(process.env.EXPECT_PEOPLE ?? "0");
const EXPECT_SHA = process.env.EXPECT_SHA ?? "";
const ANY_SHA_OR_DEV = process.env.ANY_SHA_OR_DEV === "1";

const REQUIRED_DOWNLOADS = [
  "01_Quiet_Reader.png",
  "02_Flower_Girl.png",
  "03_Rainy_Afternoon.png",
  "04_Cafe_Dreamer.png",
  "05_Autumn_Wanderer.png",
  "06_Violinist.png",
  "07_Morning_by_the_Window.png",
  "08_Painter.png",
  "09_Spring_Breeze.png",
  "10_Letter_Writer.png",
];

const VIEWPORTS = [
  { label: "1366x768", width: 1366, height: 768, isMobile: false, hasTouch: false },
  { label: "390x844", width: 390, height: 844, isMobile: true, hasTouch: true },
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

async function scrollAndMeasureImages(page, selector) {
  return page.evaluate(async (sel) => {
    const imgs = Array.from(document.querySelectorAll(sel));
    for (const img of imgs) {
      img.scrollIntoView({ behavior: "instant", block: "center" });
      await new Promise((r) => setTimeout(r, 40));
    }
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (imgs.every((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0)) {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    return imgs.map((img) => ({
      src: img.getAttribute("src") ?? "",
      widthAttr: img.getAttribute("width"),
      heightAttr: img.getAttribute("height"),
      sizes: img.getAttribute("sizes") ?? "",
      srcset: img.getAttribute("srcset") ?? "",
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }));
  }, selector);
}

const browser = await chromium.launch();
try {
  for (const vp of VIEWPORTS) {
    const errors = [];
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });
    const page = await context.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

    try {
      const res = await page.goto(`${BASE_URL}/sketches`, { waitUntil: "load" });
      check(`probe ${vp.label}: /sketches status 200`, res?.status() === 200, `got ${res?.status()}`);

      const buildSha = await page.locator('meta[name="build-sha"]').getAttribute("content");
      const shaOk = EXPECT_SHA
        ? buildSha === EXPECT_SHA
        : ANY_SHA_OR_DEV
          ? /^([0-9a-f]{40}|dev)$/.test(buildSha ?? "")
          : /^[0-9a-f]{40}$/.test(buildSha ?? "");
      check(`probe ${vp.label}: meta build-sha valid`, shaOk, `got ${buildSha}`);

      const expectedSections = EXPECT_PEOPLE > 0 ? 3 : 2;
      const expectedFigures = 12 + EXPECT_PEOPLE;

      const sectionCount = await page.locator("main section").count();
      check(`probe ${vp.label}: rendered section count is ${expectedSections}`, sectionCount === expectedSections, `got ${sectionCount}`);

      const figureCount = await page.locator("main figure").count();
      check(`probe ${vp.label}: rendered figure count is ${expectedFigures}`, figureCount === expectedFigures, `got ${figureCount}`);

      const placesCount = await page.locator('section[aria-labelledby="places"] figure').count();
      const objectsCount = await page.locator('section[aria-labelledby="objects"] figure').count();
      check(`probe ${vp.label}: Places has 6 figures and Small things has 6 figures`, placesCount === 6 && objectsCount === 6, `places=${placesCount}, objects=${objectsCount}`);

      const allImages = await scrollAndMeasureImages(page, "main figure img");
      const allLoaded =
        allImages.length === expectedFigures &&
        allImages.every((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
      check(
        `probe ${vp.label}: all ${expectedFigures} images finish loading with nonzero natural dimensions`,
        allLoaded,
        JSON.stringify(allImages.filter((i) => !i.complete || i.naturalWidth === 0)),
      );

      if (EXPECT_PEOPLE > 0) {
        const peopleImgs = await scrollAndMeasureImages(page, 'section[aria-labelledby="people"] figure img');
        const peopleAttrsOk =
          peopleImgs.length === EXPECT_PEOPLE &&
          peopleImgs.every(
            (img) =>
              img.widthAttr === "1152" &&
              img.heightAttr === "1536" &&
              img.sizes.includes("33vw") &&
              img.srcset.length > 0 &&
              img.complete &&
              img.naturalWidth > 0 &&
              img.naturalHeight > 0,
          );
        check(
          `probe ${vp.label}: all ${EXPECT_PEOPLE} People images have 1152x1536 intrinsic size, responsive sizes/srcset and loaded pixels`,
          peopleAttrsOk,
        );

        const dlHrefs = await page
          .locator('section[aria-labelledby="people"] figcaption a[download]')
          .evaluateAll((els) => els.map((e) => ({ href: e.getAttribute("href"), download: e.getAttribute("download") })));
        const dlMatches =
          dlHrefs.length === REQUIRED_DOWNLOADS.length &&
          REQUIRED_DOWNLOADS.every(
            (fn, i) => dlHrefs[i]?.download === fn && dlHrefs[i]?.href === `/sketches/download/${fn}`,
          );
        check(`probe ${vp.label}: People captions expose all 10 named PNG download links`, dlMatches, JSON.stringify(dlHrefs));
      } else {
        const peopleSectionCount = await page.locator('section[aria-labelledby="people"]').count();
        check(`probe ${vp.label}: People section is absent when EXPECT_PEOPLE=0`, peopleSectionCount === 0);
      }

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      check(
        `probe ${vp.label}: no horizontal overflow`,
        overflow.scrollWidth <= overflow.innerWidth,
        `scrollWidth=${overflow.scrollWidth}, innerWidth=${overflow.innerWidth}`,
      );

      check(`probe ${vp.label}: no console or page errors`, errors.length === 0, errors.join("; "));
    } finally {
      await context.close();
    }
  }

  // The scroll-drawn frame and paper wash (app/(site)/(app)/sketches/page.tsx, globals.css .sheet). Every figure
  // wraps its picture in one .sheet with one wash and one pathLength=1 frame; where view timelines run, a sheet below
  // the fold waits washed and undrawn, washes off then draws as it enters, and is whole at the end of the page.
  // Reduced motion (from the start and switched live), stripped @supports support and JavaScript off show the whole
  // sheet with no animation at all.
  const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const sheetStates = (page) =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll("main figure")).map((fig) => {
        const sheets = fig.querySelectorAll(":scope > .sheet");
        const sheet = sheets[0];
        const img = sheet?.querySelector(":scope > img");
        const washes = sheet ? sheet.querySelectorAll(":scope > .sheet-wash") : [];
        const frames = sheet ? sheet.querySelectorAll(":scope > svg.sheet-frame > path") : [];
        const wash = washes[0];
        const path = frames[0];
        const svg = path?.ownerSVGElement;
        const transform = wash ? getComputedStyle(wash).transform : "none";
        const anims = [wash, path].filter(Boolean).flatMap((el) => el.getAnimations());
        const rect = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { top: r.top, left: r.left, width: r.width, height: r.height };
        };
        let inside = false;
        if (path && svg) {
          const b = path.getBBox();
          const v = svg.viewBox.baseVal;
          inside = b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width && b.y + b.height <= v.height && b.width > v.width * 0.8 && b.height > v.height * 0.8;
        }
        const caption = fig.querySelector(":scope > figcaption");
        return {
          sheets: sheets.length,
          washes: washes.length,
          frames: frames.length,
          pathLength: path?.getAttribute("pathLength") ?? null,
          filtered: !!sheet?.querySelector("[filter]") || (path ? getComputedStyle(path).filter !== "none" : false),
          scale: transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a,
          dash: path ? parseFloat(getComputedStyle(path).strokeDashoffset) : NaN,
          anims: anims.length,
          viewTimelines: anims.filter((a) => typeof ViewTimeline !== "undefined" && a.timeline instanceof ViewTimeline).length,
          img: rect(img),
          svg: rect(svg),
          washRect: rect(wash),
          inside,
          washBg: wash ? getComputedStyle(wash).backgroundColor : "",
          stroke: path ? getComputedStyle(path).stroke : "",
          paper: getComputedStyle(document.body).backgroundColor,
          captionVisible: !!caption && caption.getBoundingClientRect().height > 0 && getComputedStyle(caption).visibility === "visible",
          downloads: fig.querySelectorAll("figcaption a[download]").length,
        };
      }),
    );
  const scrollTo = async (page, top) => {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), top);
    await frames(page);
  };
  // Place the last figure's sheet so that `progress` of its height has entered from the bottom of the viewport.
  const enter = async (page, progress) => {
    const y = await page.evaluate((p) => {
      const sheet = Array.from(document.querySelectorAll("main figure > .sheet")).at(-1);
      const r = sheet.getBoundingClientRect();
      return window.scrollY + r.top - window.innerHeight + r.height * p;
    }, progress);
    await scrollTo(page, y);
  };
  const whole = (s) => s.scale <= 0.01 && s.dash <= 0.01;
  const waiting = (s) => s.scale >= 0.99 && s.dash >= 0.99;
  const close = (a, b) => !!a && !!b && ["top", "left", "width", "height"].every((k) => Math.abs(a[k] - b[k]) <= 1.5);
  const expectedFigures = 12 + EXPECT_PEOPLE;
  const loadedNoTimers = async (page) => {
    // JavaScript may be off, so no timers run in the page: poll from here, one synchronous read at a time.
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
    for (let i = 0; i < 150; i++) {
      const done = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll("main figure img"));
        return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) ? imgs.length : 0;
      });
      if (done) return done;
      await page.waitForTimeout(100);
    }
    return 0;
  };

  const themeSeen = {};
  for (const vp of VIEWPORTS) {
    for (const scheme of ["light", "dark"]) {
      const tag = `reveal ${vp.label} ${scheme}`;
      const errors = [];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        colorScheme: scheme,
        reducedMotion: "no-preference",
      });
      const page = await context.newPage();
      page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      try {
        await page.goto(`${BASE_URL}/sketches`, { waitUntil: "load" });
        await page.waitForTimeout(700);
        await scrollTo(page, 0);
        const supports = await page.evaluate(() => CSS.supports("animation-timeline: view()") && typeof ViewTimeline !== "undefined");
        check(`${tag}: Chromium supports view timelines`, supports);

        const before = await sheetStates(page);
        check(
          `${tag}: each of ${expectedFigures} figures has one sheet, one wash and one unfiltered pathLength=1 frame inside its picture`,
          before.length === expectedFigures &&
            before.every((s) => s.sheets === 1 && s.washes === 1 && s.frames === 1 && s.pathLength === "1" && !s.filtered && s.inside && s.captionVisible),
          JSON.stringify(before.filter((s) => !(s.sheets === 1 && s.washes === 1 && s.frames === 1 && s.pathLength === "1" && !s.filtered && s.inside && s.captionVisible)).slice(0, 2)),
        );
        check(
          `${tag}: every wash and frame runs on its sheet's view timeline`,
          before.every((s) => s.anims === 2 && s.viewTimelines === 2),
          JSON.stringify(before.map((s) => [s.anims, s.viewTimelines])),
        );
        check(
          `${tag}: each frame covers its picture exactly`,
          before.every((s) => close(s.svg, s.img) && close(s.washRect ? { ...s.washRect, width: s.img?.width, left: s.img?.left } : null, s.img)),
          JSON.stringify(before.filter((s) => !close(s.svg, s.img)).map((s) => [s.svg, s.img]).slice(0, 2)),
        );
        const last = before.at(-1);
        check(
          `${tag}: below the fold the last sheet waits washed (scale 1, full width) and undrawn (dashoffset 1)`,
          last.img.top > vp.height && waiting(last) && Math.abs(last.washRect.width - last.img.width) <= 1.5,
          JSON.stringify({ top: last.img.top, scale: last.scale, dash: last.dash, wash: last.washRect?.width }),
        );

        await enter(page, 0.35);
        const mid = (await sheetStates(page)).at(-1);
        check(
          `${tag}: a third in, the wash is part way off and the frame not yet drawn past the wash`,
          mid.scale > 0.05 && mid.scale < 0.95 && mid.dash > 0.5 && mid.washRect.width > 1 && mid.washRect.width < mid.img.width - 1,
          JSON.stringify({ scale: mid.scale, dash: mid.dash, wash: mid.washRect.width }),
        );
        await enter(page, 0.8);
        const later = (await sheetStates(page)).at(-1);
        check(
          `${tag}: four fifths in, the wash is gone and the frame part drawn`,
          later.scale <= 0.01 && later.dash > 0.05 && later.dash < 0.95,
          JSON.stringify({ scale: later.scale, dash: later.dash }),
        );

        await scrollTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
        const end = await sheetStates(page);
        check(
          `${tag}: at the end of the page every sheet is whole (wash scale 0, width 0; dashoffset 0)`,
          end.every((s) => whole(s) && s.washRect.width <= 0.5),
          JSON.stringify(end.filter((s) => !whole(s)).map((s) => [s.scale, s.dash])),
        );
        check(
          `${tag}: the wash is the page's paper and the frame the page's ink`,
          end.every((s) => s.washBg === s.paper && s.stroke && s.stroke !== "none"),
          JSON.stringify({ wash: end[0].washBg, paper: end[0].paper, stroke: end[0].stroke }),
        );
        themeSeen[`${vp.label} ${scheme}`] = `${end[0].paper}|${end[0].stroke}`;
        check(`${tag}: the frame adds no horizontal overflow`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

        if (vp.width === 1366 && scheme === "light") {
          // The same end-of-page assertion against a wash pinned on: it must fail.
          await page.addStyleTag({ content: ".sheet-wash{animation:none!important;transform:scaleX(1)!important}" });
          await frames(page);
          const pinned = await sheetStates(page);
          check(`${tag}: negative control: a wash pinned over the art fails the whole-at-end check`, !pinned.every((s) => whole(s)) && pinned.every((s) => s.scale >= 0.99));
        }
        check(`${tag}: no console or page errors`, errors.length === 0, errors.join("; "));
      } finally {
        await context.close();
      }
    }
  }
  for (const vp of VIEWPORTS) {
    check(`reveal ${vp.label}: light and dark draw in different paper and ink`, !!themeSeen[`${vp.label} light`] && themeSeen[`${vp.label} light`] !== themeSeen[`${vp.label} dark`], JSON.stringify(themeSeen));
  }

  // Reduced motion: from the first frame, and switched on and off mid-visit.
  for (const vp of VIEWPORTS) {
    const tag = `reduced ${vp.label}`;
    const errors = [];
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    try {
      await page.goto(`${BASE_URL}/sketches`, { waitUntil: "load" });
      await scrollTo(page, 0);
      const s = await sheetStates(page);
      check(`${tag}: no wash or frame has an animation`, s.length === expectedFigures && s.every((x) => x.anims === 0), JSON.stringify(s.map((x) => x.anims)));
      check(`${tag}: below the fold every sheet is already whole`, s.every(whole), JSON.stringify(s.filter((x) => !whole(x)).map((x) => [x.scale, x.dash])));
      await enter(page, 0.35);
      const mid = await sheetStates(page);
      check(`${tag}: scrolling in changes nothing`, mid.every((x) => whole(x) && x.anims === 0));
      const loaded = await loadedNoTimers(page);
      check(`${tag}: all ${expectedFigures} images load`, loaded === expectedFigures, `loaded ${loaded}`);
      check(`${tag}: captions show and downloads are unchanged`, mid.every((x) => x.captionVisible) && mid.reduce((n, x) => n + x.downloads, 0) === EXPECT_PEOPLE);
      check(`${tag}: no console or page errors`, errors.length === 0, errors.join("; "));
    } finally {
      await context.close();
    }
  }
  {
    const tag = "reduced live 1366x768";
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "no-preference" });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/sketches`, { waitUntil: "load" });
      await page.waitForTimeout(700);
      await scrollTo(page, 0);
      const a = (await sheetStates(page)).at(-1);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await scrollTo(page, 0);
      const b = await sheetStates(page);
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await scrollTo(page, 0);
      const c = (await sheetStates(page)).at(-1);
      check(`${tag}: the last sheet waits washed before the switch`, waiting(a) && a.anims === 2, JSON.stringify(a));
      check(`${tag}: switching to reduce drops every animation and shows every sheet whole`, b.every((x) => x.anims === 0 && whole(x)));
      check(`${tag}: switching back restores the waiting wash and frame (the check above can fail)`, waiting(c) && c.anims === 2, JSON.stringify(c));
    } finally {
      await context.close();
    }
  }

  // No view-timeline support: the @supports block is rewritten false in the served CSS, as in a browser without it.
  for (const vp of VIEWPORTS) {
    const tag = `unsupported ${vp.label}`;
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch });
    const page = await context.newPage();
    let rewritten = 0;
    await page.route("**/*.css*", async (route) => {
      const res = await route.fetch();
      let body = await res.text();
      body = body.replace(/@supports\s*\(animation-timeline:\s*view\(\)\)/g, () => {
        rewritten++;
        return "@supports (not-a-property:view())";
      });
      await route.fulfill({ response: res, body });
    });
    try {
      await page.goto(`${BASE_URL}/sketches`, { waitUntil: "load" });
      await scrollTo(page, 0);
      check(`${tag}: the served stylesheet's view-timeline @supports was rewritten`, rewritten >= 1, `rewrote ${rewritten}`);
      const s = await sheetStates(page);
      check(`${tag}: no wash or frame animates`, s.length === expectedFigures && s.every((x) => x.anims === 0), JSON.stringify(s.map((x) => x.anims)));
      check(`${tag}: below the fold every sheet is whole and every caption shows`, s.every((x) => whole(x) && x.captionVisible));
      const loaded = await loadedNoTimers(page);
      check(`${tag}: all ${expectedFigures} images load`, loaded === expectedFigures, `loaded ${loaded}`);
    } finally {
      await context.close();
    }
  }

  // JavaScript off: the <noscript> style stands the sheets still, though Chromium runs scroll timelines without it.
  for (const vp of VIEWPORTS) {
    const tag = `no-JS ${vp.label}`;
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      const res = await page.goto(`${BASE_URL}/sketches`, { waitUntil: "load" });
      check(`${tag}: /sketches answers 200`, res?.status() === 200, String(res?.status()));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(100);
      const s = await sheetStates(page);
      check(`${tag}: ${expectedFigures} sheets, none animating`, s.length === expectedFigures && s.every((x) => x.anims === 0 && x.washes === 1 && x.frames === 1), JSON.stringify(s.map((x) => x.anims)));
      check(`${tag}: below the fold every sheet is whole with its caption`, s.every((x) => whole(x) && x.captionVisible));
      check(`${tag}: downloads are unchanged`, s.reduce((n, x) => n + x.downloads, 0) === EXPECT_PEOPLE);
      const loaded = await loadedNoTimers(page);
      check(`${tag}: all ${expectedFigures} images load`, loaded === expectedFigures, `loaded ${loaded}`);
    } finally {
      await context.close();
    }
  }

  // A client navigation into /sketches still gets the reveal: React keeps <noscript> children as text, not a style.
  {
    const tag = "client nav 1366x768";
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE_URL}/work`, { waitUntil: "load" });
      await page.waitForTimeout(500);
      const link = page.locator('a[href="/sketches"]:visible').first();
      await link.click();
      await page.waitForURL(/\/sketches$/, { timeout: 15000 });
      await page.locator("main figure > .sheet").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(700);
      await scrollTo(page, 0);
      const s = await sheetStates(page);
      const styles = await page.evaluate(() => Array.from(document.querySelectorAll("style")).filter((el) => el.textContent?.includes(".sheet-wash")).length);
      check(`${tag}: no <noscript> style is live after the navigation`, styles === 0, `found ${styles}`);
      check(`${tag}: the sheets run on view timelines and the last waits washed`, s.length === expectedFigures && s.every((x) => x.anims === 2) && waiting(s.at(-1)), JSON.stringify(s.at(-1)));
    } catch (e) {
      check(`${tag}: navigates from /work to /sketches`, false, e.message.split("\n")[0]);
    } finally {
      await context.close();
    }
  }

  // Negative control in browser: intercept one sketch image with 404 and confirm loaded-image check detects failure
  {
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    try {
      let intercepted = false;
      await page.route("**/_next/image*", async (route) => {
        if (!intercepted) {
          intercepted = true;
          await route.fulfill({ status: 404, contentType: "text/plain", body: "not found" });
          return;
        }
        await route.continue();
      });
      await page.goto(`${BASE_URL}/sketches`, { waitUntil: "load" });
      const imgs = await page.evaluate(async () => {
        const list = Array.from(document.querySelectorAll("main figure img"));
        await new Promise((r) => setTimeout(r, 300));
        return list.map((img) => ({ complete: img.complete, naturalWidth: img.naturalWidth }));
      });
      const detectedBroken = intercepted && imgs.some((i) => !i.complete || i.naturalWidth === 0);
      check("probe negative control: intercepting a sketch image with 404 causes naturalWidth=0 failure detection", detectedBroken);
    } finally {
      await context.close();
    }
  }

  // Download route checks via Playwright APIRequestContext
  {
    const context = await browser.newContext();
    try {
      const unknownRes = await context.request.get(`${BASE_URL}/sketches/download/unknown_file.png`);
      check("probe download negative control: unknown filename returns 404", unknownRes.status() === 404, `got ${unknownRes.status()}`);

      const paramRes = await context.request.get(
        `${BASE_URL}/sketches/download/01_Quiet_Reader.png?url=https://evil.example/x.png`,
      );
      check("probe download negative control: external URL query parameter returns 400", paramRes.status() === 400, `got ${paramRes.status()}`);

      if (EXPECT_PEOPLE === 10) {
        for (const fn of REQUIRED_DOWNLOADS) {
          const dlRes = await context.request.get(`${BASE_URL}/sketches/download/${fn}`);
          const body = await dlRes.body();
          const pngSig =
            body.length > 8 &&
            body[0] === 0x89 &&
            body[1] === 0x50 &&
            body[2] === 0x4e &&
            body[3] === 0x47;
          const headersOk =
            dlRes.status() === 200 &&
            (dlRes.headers()["content-type"] ?? "").includes("image/png") &&
            dlRes.headers()["content-disposition"] === `attachment; filename="${fn}"` &&
            pngSig;
          check(`probe download: ${fn} streams PNG attachment`, headersOk, `status=${dlRes.status()}`);
        }
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
