// Drives headless Chromium over /zine, the fold zine. Run by scripts/probe-zine.sh, which installs Playwright and
// axe-core into PW_PREFIX and passes BASE_URL.
//
// For A4 and Letter: the sheet has eight [data-page] cells, the document holds exactly one @page rule (the paper's
// size, margin 0) and one stylesheet of its own (no Tailwind, none of the site's), five dashed folds, one solid cut
// with its scissors, and an eager sketch that has loaded. Under print media the controls are gone, the sheet sits at
// 0,0 at its true size, no page's words overflow or leave its 6 mm safe area, and page 8's rule measures 100 mm end
// to end. page.pdf({ preferCSSPageSize: true }) is read back as bytes: exactly one page, MediaBox 595x842 (A4) or
// 612x792 (Letter). Negative controls: landscape forced by a second @page rule must fail the same PDF check (and the
// @page count), a 2 mm margin must fail the safe-area check, and with JavaScript off, stripping the <noscript> style
// must leave the sheet hidden behind its fallback. Bad query values draw the defaults; the Print button is the
// only one, waits and calls window.print; with JavaScript off the sheet still shows (not the fallback), the GET
// form changes paper and sketch, and the PDF is still one page. The site's footer links to /zine exactly once and
// the link lands on the sheet. axe (wcag2a/aa/21aa) finds nothing on /zine; no console or page error anywhere.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");
const AXE_PATH = require.resolve("axe-core/axe.min.js");

const BASE_URL = process.env.BASE_URL;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 900 };
const PX_PER_MM = 96 / 25.4;
const SAFE_MM = 6;
const PAPERS = {
  a4: { size: "210mm 297mm", box: [595, 842], mm: [210, 297] },
  letter: { size: "8.5in 11in", box: [612, 792], mm: [215.9, 279.4] },
};
const DEFAULT_SKETCH = "/sketches/03-lake.jpg";

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

async function open(browser, { viewport = DESKTOP, js = true, init = [] } = {}) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, javaScriptEnabled: js });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`console ${page.url()}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  for (const fn of init) await page.addInitScript(fn);
  return { context, page };
}

// The sheet streams in after the static shell, and React may hold its reveal back a moment: wait until it shows.
async function goZine(page, query = "") {
  const res = await page.goto(`${BASE_URL}/zine${query}`, { waitUntil: "load" });
  await page.locator(".sheet").waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
  return res?.status() ?? 0;
}

/** Page count and every MediaBox, read from the PDF's own bytes (Chromium writes its page tree uncompressed). */
function readPdf(buf) {
  const s = buf.toString("latin1");
  const pages = (s.match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length;
  const boxes = [...s.matchAll(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g)].map((m) => {
    const [x0, y0, x1, y1] = m.slice(1, 5).map(Number);
    return [Math.round(x1 - x0), Math.round(y1 - y0)];
  });
  return { pages, boxes, pdf: s.startsWith("%PDF-") };
}

function pdfFits(buf, paper) {
  const { pages, boxes, pdf } = readPdf(buf);
  const [w, h] = PAPERS[paper].box;
  const pass = pdf && pages === 1 && boxes.length >= 1 && boxes.every(([bw, bh]) => bw === w && bh === h);
  return { pass, detail: `${pdf ? "" : "not a PDF, "}${pages} page(s), MediaBox ${JSON.stringify(boxes)}, want 1 page of ${w}x${h}` };
}

const printPdf = (page) => page.pdf({ preferCSSPageSize: true, printBackground: true });

// What the sheet's document says about itself, on screen.
function sheetFacts(page) {
  return page.evaluate(() => {
    const pageRules = [];
    const walk = (rules) => {
      for (const r of rules) {
        if (r.constructor.name === "CSSPageRule") {
          pageRules.push({ size: r.style.getPropertyValue("size"), margin: r.style.getPropertyValue("margin") });
        } else if (r.cssRules) walk(r.cssRules);
      }
    };
    const sheets = [...document.styleSheets];
    let tailwind = false;
    for (const s of sheets) {
      walk(s.cssRules);
      const text = [...s.cssRules].map((r) => r.cssText).join("\n");
      if (/--tw-|tailwindcss/.test(text)) tailwind = true;
    }
    const fold = [...document.querySelectorAll('.sheet [data-guide="fold"]')];
    const cut = [...document.querySelectorAll('.sheet [data-guide="cut"]')];
    const img = document.querySelector('[data-page="7"] img');
    return {
      paper: document.querySelector(".sheet")?.getAttribute("data-sheet"),
      cells: [...document.querySelectorAll("[data-page]")].map((e) => e.getAttribute("data-page")),
      pageRules,
      links: [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => new URL(l.href).pathname),
      tailwind,
      siteChrome: document.querySelectorAll("footer.end, .masthead-bar, [aria-label='Main']").length,
      folds: fold.length,
      foldsDashed: fold.every((l) => getComputedStyle(l).strokeDasharray !== "none"),
      cuts: cut.length,
      cutSolid: cut.every((l) => getComputedStyle(l).strokeDasharray === "none"),
      scissors: document.querySelectorAll('.sheet [data-guide="scissors"]').length,
      img: img
        ? { src: new URL(img.src).pathname, loading: img.getAttribute("loading"), complete: img.complete, natural: img.naturalWidth }
        : null,
      prints: document.querySelectorAll("[data-print]").length,
      jsOffHint: !!document.querySelector("[data-js-off-hint]")?.checkVisibility(),
      fallback: !!document.querySelector(".zine-wait")?.checkVisibility(),
      sheetShown: !!document.querySelector(".sheet")?.checkVisibility(),
    };
  });
}

// The same document under print media: what is left, where it sits, and whether every page keeps its words in.
function printFacts(page, safeMm) {
  return page.evaluate(
    ({ pxPerMm, safeMm }) => {
      const shown = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.checkVisibility()).length;
      const sheet = document.querySelector(".sheet").getBoundingClientRect();
      const safe = safeMm * pxPerMm;
      const tol = 0.75;
      const overflow = [];
      const outside = [];
      for (const cell of document.querySelectorAll("[data-page]")) {
        const no = cell.getAttribute("data-page");
        const body = cell.querySelector(".page-body");
        if (body.scrollHeight > body.clientHeight + 1 || body.scrollWidth > body.clientWidth + 1) {
          overflow.push(`${no}: ${body.scrollWidth}x${body.scrollHeight} in ${body.clientWidth}x${body.clientHeight}`);
        }
        const p = cell.querySelector(".page").getBoundingClientRect();
        const inner = { l: p.left + safe, t: p.top + safe, r: p.right - safe, b: p.bottom - safe };
        for (const el of body.querySelectorAll("*")) {
          if (el.matches(".rule-shape")) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.left < inner.l - tol || r.top < inner.t - tol || r.right > inner.r + tol || r.bottom > inner.b + tol) {
            outside.push(`${no} ${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}`);
          }
        }
      }
      const ends = [...document.querySelectorAll('[data-page="8"] [data-rule-end]')].map((e) => {
        const r = e.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      });
      const rulePx = ends.length === 2 ? Math.hypot(ends[0][0] - ends[1][0], ends[0][1] - ends[1][1]) : NaN;
      return {
        controls: shown(".screen-only, .controls, .zine-form, [data-print], .fold-diagram, .zine-head"),
        sheet: { x: sheet.x, y: sheet.y, w: sheet.width, h: sheet.height },
        overflow,
        outside,
        ruleEnds: ends.length,
        ruleMm: rulePx / pxPerMm,
        rules: document.querySelectorAll("[data-rule-mm]").length,
        ruleOnEight: !!document.querySelector('[data-page="8"] [data-rule-mm="100"]'),
      };
    },
    { pxPerMm: PX_PER_MM, safeMm },
  );
}

async function runAxe(page, name) {
  await page.addScriptTag({ path: AXE_PATH });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
    return result.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, first: v.nodes[0]?.target }));
  });
  check(`${name}: axe finds no violations on /zine`, violations.length === 0, JSON.stringify(violations));
}

async function paperChecks(browser, paper) {
  const want = PAPERS[paper];
  const { context, page } = await open(browser);
  const status = await goZine(page, `?paper=${paper}`);
  check(`${paper}: /zine?paper=${paper} answers 200`, status === 200, `HTTP ${status}`);
  const f = await sheetFacts(page);
  check(`${paper}: the sheet shows, laid out for ${paper}`, f.sheetShown && f.paper === paper, `shown ${f.sheetShown}, data-sheet ${f.paper}`);
  check(
    `${paper}: eight [data-page] cells, pages 1 to 8 once each`,
    f.cells.length === 8 && [...f.cells].sort().join("") === "12345678",
    JSON.stringify(f.cells),
  );
  check(
    `${paper}: exactly one @page rule, size ${want.size}, margin 0`,
    f.pageRules.length === 1 && f.pageRules[0].size === want.size && /^0(px)?$/.test(f.pageRules[0].margin),
    JSON.stringify(f.pageRules),
  );
  check(`${paper}: only its own stylesheet (one <link>, no Tailwind, no site chrome)`, f.links.length === 1 && !f.tailwind && f.siteChrome === 0, JSON.stringify(f));
  check(`${paper}: five dashed folds, one solid cut, one scissors mark`, f.folds === 5 && f.foldsDashed && f.cuts === 1 && f.cutSolid && f.scissors === 1, JSON.stringify({ folds: f.folds, dashed: f.foldsDashed, cuts: f.cuts, solid: f.cutSolid, scissors: f.scissors }));
  check(
    `${paper}: page 7's sketch is an eager <img> that has loaded`,
    f.img && f.img.loading !== "lazy" && f.img.complete && f.img.natural > 0 && f.img.src === DEFAULT_SKETCH,
    JSON.stringify(f.img),
  );

  await page.emulateMedia({ media: "print" });
  const p = await printFacts(page, SAFE_MM);
  check(`${paper} print: every control is hidden`, p.controls === 0, `${p.controls} still shown`);
  const [wMm, hMm] = want.mm;
  check(
    `${paper} print: the sheet sits at 0,0 at ${wMm} x ${hMm} mm`,
    Math.abs(p.sheet.x) < 0.5 && Math.abs(p.sheet.y) < 0.5 && Math.abs(p.sheet.w - wMm * PX_PER_MM) < 1 && Math.abs(p.sheet.h - hMm * PX_PER_MM) < 1,
    JSON.stringify(p.sheet),
  );
  check(`${paper} print: no page overflows`, p.overflow.length === 0, p.overflow.join("; "));
  check(`${paper} print: every page keeps its words inside the 6 mm safe area`, p.outside.length === 0, p.outside.slice(0, 6).join("; "));
  check(
    `${paper} print: one calibration rule, on page 8, 100 mm end to end`,
    p.rules === 1 && p.ruleOnEight && p.ruleEnds === 2 && Math.abs(p.ruleMm - 100) < 0.3,
    `${p.rules} rules, on page 8 ${p.ruleOnEight}, ${p.ruleEnds} ends, ${p.ruleMm.toFixed(2)} mm`,
  );
  // Negative control: a 2 mm margin instead of 6 mm must fail the safe-area check.
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.id = "thin-margin";
    style.textContent = ".page-body{padding:2mm!important}";
    document.body.append(style);
  });
  const thin = await printFacts(page, SAFE_MM);
  check(`${paper} negative control: a 2 mm margin fails the safe-area check`, thin.outside.length > 0, "nothing left the safe area");
  await page.evaluate(() => document.getElementById("thin-margin")?.remove());
  // null, not "screen": an emulated screen medium would make page.pdf() lay out the screen view.
  await page.emulateMedia({ media: null });

  const fit = pdfFits(await printPdf(page), paper);
  check(`${paper} PDF: exactly one page, MediaBox ${want.box.join("x")}`, fit.pass, fit.detail);

  // Negative control: the same checks must catch a sheet forced to landscape. The rule goes last in <body>, after
  // the sheet's own, so it wins on order the way a stray second @page rule would.
  await page.evaluate(([w, h]) => {
    const style = document.createElement("style");
    style.textContent = `@page{size:${h}mm ${w}mm}`;
    document.body.append(style);
  }, want.mm);
  const forced = pdfFits(await printPdf(page), paper);
  console.log(`# ${paper} forced landscape: ${forced.detail}`);
  check(`${paper} negative control: forced landscape fails the PDF check`, !forced.pass, forced.detail);
  const forcedRules = (await sheetFacts(page)).pageRules.length;
  check(`${paper} negative control: forced landscape fails the one-@page check`, forcedRules !== 1, `${forcedRules} @page rules`);
  await context.close();
}

async function queryChecks(browser) {
  const { context, page } = await open(browser);
  for (const [query, paper, sketch] of [
    ["?paper=bogus", "a4", DEFAULT_SKETCH],
    ["?paper=LETTER&sketch=cove", "letter", "/sketches/01-cove.jpg"],
    ["?paper=letter&sketch=..%2F..%2Fetc%2Fpasswd", "letter", DEFAULT_SKETCH],
    ["?paper=a4&paper=letter&sketch=wallet&sketch=cove", "a4", "/sketches/12-wallet.jpg"],
  ]) {
    const status = await goZine(page, query);
    const f = await sheetFacts(page);
    check(
      `/zine${query}: 200, ${paper}, ${sketch.split("/").pop()}`,
      status === 200 && f.paper === paper && f.img?.src === sketch && f.pageRules.length === 1 && f.pageRules[0].size === PAPERS[paper].size,
      `HTTP ${status}, ${f.paper}, ${f.img?.src}, ${JSON.stringify(f.pageRules)}`,
    );
  }
  await context.close();
}

async function printButton(browser) {
  const stub = () => {
    window.__printed = 0;
    window.print = () => {
      window.__printed++;
    };
  };
  const { context, page } = await open(browser, { init: [stub] });
  await goZine(page, "?paper=letter");
  const button = page.locator("[data-print]");
  await button.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  const count = await button.count();
  check("Print: one Print button once hydrated", count === 1 && (await button.textContent()) === "Print the zine", `${count} buttons`);
  if (count === 1) await button.click();
  const printed = await page.waitForFunction(() => window.__printed === 1, null, { timeout: 5000 }).then(() => true, () => false);
  check("Print: a click waits for fonts and the sketch, then calls window.print() once", printed);
  // React commits setBusy(false) a moment after print() returns, so wait for it rather than read it at once.
  const after = await page
    .waitForFunction(() => document.querySelector("[data-print]")?.disabled === false, null, { timeout: 5000 })
    .then(() => true, () => false);
  check("Print: the button is ready again afterwards", after);
  await context.close();
}

async function jsOff(browser) {
  const { context, page } = await open(browser, { js: false });
  const status = await goZine(page, "?paper=letter");
  const f = await sheetFacts(page);
  check("JavaScript off: /zine answers 200 and shows the sheet, not the fallback", status === 200 && f.sheetShown && !f.fallback, `HTTP ${status}, sheet ${f.sheetShown}, fallback ${f.fallback}`);
  check("JavaScript off: no Print button, and the hint to use the browser's Print shows", f.prints === 0 && f.jsOffHint, `${f.prints} buttons, hint ${f.jsOffHint}`);
  check("JavaScript off: still eight cells and one @page rule", f.cells.length === 8 && f.pageRules.length === 1, `${f.cells.length} cells, ${f.pageRules.length} @page`);
  await page.locator('input[name="paper"][value="a4"]').check();
  await page.locator('select[name="sketch"]').selectOption("cove");
  await Promise.all([page.waitForURL(/\/zine\?/), page.getByRole("button", { name: "Lay it out" }).click()]);
  await page.locator(".sheet").waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  const g = await sheetFacts(page);
  const url = new URL(page.url());
  check(
    "JavaScript off: the GET form lays out A4 with the Cove sketch",
    url.searchParams.get("paper") === "a4" && url.searchParams.get("sketch") === "cove" && g.paper === "a4" && g.img?.src === "/sketches/01-cove.jpg",
    `${page.url()}, ${g.paper}, ${g.img?.src}`,
  );
  const fit = pdfFits(await printPdf(page), "a4");
  check("JavaScript off: the PDF is still exactly one A4 page", fit.pass, fit.detail);
  // Negative control: without the <noscript> style the sheet stays in React's hidden holder behind the fallback.
  await page.evaluate(() => document.querySelectorAll("noscript style").forEach((s) => s.remove()));
  const bare = await sheetFacts(page);
  check("JavaScript off negative control: without the <noscript> style the sheet is hidden", !bare.sheetShown && bare.fallback, `sheet ${bare.sheetShown}, fallback ${bare.fallback}`);
  await context.close();
}

async function footer(browser) {
  for (const path of ["/", "/work"]) {
    const { context, page } = await open(browser);
    await page.goto(`${BASE_URL}${path}`, { waitUntil: "load" });
    const facts = await page.evaluate(() => {
      const all = [...document.querySelectorAll('a[href="/zine"]')];
      const inFooter = [...document.querySelectorAll('footer.end a[href="/zine"]')];
      return { all: all.length, inFooter: inFooter.length, text: inFooter[0]?.textContent?.replace(/\s+/g, " ").trim() ?? "" };
    });
    check(`${path}: the footer links to /zine exactly once ("Print a zine")`, facts.all === 1 && facts.inFooter === 1 && facts.text.includes("Print a zine"), JSON.stringify(facts));
    const link = page.locator('footer.end a[href="/zine"]').filter({ visible: true }).first();
    await link.scrollIntoViewIfNeeded().catch(() => {});
    await Promise.all([page.waitForURL(`${BASE_URL}/zine`), link.click()]).catch(() => {});
    await page.locator(".sheet").waitFor({ state: "visible", timeout: 15000 }).catch(() => {});
    const landed = await page.evaluate(() => ({ path: location.pathname, cells: document.querySelectorAll("[data-page]").length }));
    check(`${path}: the footer link lands on the sheet`, landed.path === "/zine" && landed.cells === 8, JSON.stringify(landed));
    await context.close();
  }
}

async function screens(browser) {
  for (const viewport of [DESKTOP, PHONE]) {
    const name = viewport === PHONE ? "390x844" : "1366x900";
    const { context, page } = await open(browser, { viewport });
    await goZine(page);
    const fit = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      preview: document.querySelector(".preview")?.getBoundingClientRect().width ?? 0,
    }));
    check(`${name}: the scaled preview fits the screen, no sideways scroll`, fit.scroll <= fit.inner && fit.preview > 0 && fit.preview <= fit.inner, JSON.stringify(fit));
    await runAxe(page, name);
    await context.close();
  }
}

const browser = await chromium.launch();
console.log(`# browser: Chromium ${browser.version()}`);
console.log(`# base_url: ${BASE_URL}`);
try {
  for (const paper of Object.keys(PAPERS)) await paperChecks(browser, paper);
  await queryChecks(browser);
  await printButton(browser);
  await jsOff(browser);
  await footer(browser);
  await screens(browser);
  check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
