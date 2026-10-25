// Headless Chromium browser probe for /sketches at 1366x768 and 390x844.
// Asserts build-sha, rendered section/figure counts, responsive loaded images,
// negative-control 404 image interception, and named PNG download behavior.
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
