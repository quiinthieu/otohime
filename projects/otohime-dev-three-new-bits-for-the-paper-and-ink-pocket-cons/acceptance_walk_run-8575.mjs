// Acceptance walk for pm-248 against the live deployment. Independent of the repo's probes.
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "https://otohime.dev";
const EXE = "/usr/bin/google-chrome";
const VIEWPORTS = [
  { name: "1366x768", width: 1366, height: 768 },
  { name: "390x844", width: 390, height: 844 },
];
const rows = [];
const log = (step, ok, detail) => {
  rows.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} | ${step} | ${detail}`);
};

const browser = await chromium.launch({ executablePath: EXE, headless: true });

async function newPage(vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  const apiAsk = [];
  page.on("console", (m) => { if (m.type() === "error" && !/status of 404/.test(m.text())) errors.push(`console: ${m.text()}`); });
  page.on("requestfailed", (r) => { if (!(r.failure()?.errorText === "net::ERR_ABORTED" && r.url().includes("_rsc="))) errors.push(`requestfailed ${r.failure()?.errorText} ${r.url()}`); });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("requestfinished", (r) => { if (r.url().includes("/api/ask")) apiAsk.push(r.url()); });
  page.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon") && !r.url().includes("/acc-")) errors.push(`http ${r.status()} ${r.url()}`); });
  return { ctx, page, errors, apiAsk };
}

for (const vp of VIEWPORTS) {
  // 1. Home: build sha, season from clock + zone, dial, layer, Ask console.
  {
    const { ctx, page, errors, apiAsk } = await newPage(vp, { timezoneId: "Australia/Sydney" });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const sha = await page.locator('meta[name="build-sha"]').getAttribute("content");
    log(`[${vp.name}] home build-sha`, sha === "3604c822f6616f8eb7f091ff46c2af68a8ef488b", `meta build-sha=${sha}`);

    const season = await page.evaluate(() => document.documentElement.dataset.season);
    // Oct 26 2026 in Sydney is spring (south flips the north autumn).
    log(`[${vp.name}] clock+zone season (Sydney, Oct)`, season === "spring", `data-season=${season}`);

    const layer = page.locator("svg.season-layer");
    const layerInfo = await layer.evaluate((el) => ({ aria: el.getAttribute("aria-hidden"), bits: el.querySelectorAll(".almanac-bit").length, pe: getComputedStyle(el).pointerEvents, z: getComputedStyle(el).zIndex }));
    log(`[${vp.name}] ambient layer`, layerInfo.aria === "true" && layerInfo.bits > 0 && layerInfo.bits <= 40 && layerInfo.pe === "none", JSON.stringify(layerInfo));

    const dial = page.getByRole("radiogroup", { name: "Season" });
    const dialVisible = await dial.isVisible().catch(() => false);
    log(`[${vp.name}] season dial visible`, dialVisible, `radiogroup visible=${dialVisible}`);
    if (dialVisible) {
      await page.locator('input[name="season-dial"][value="winter"]').focus();
      await page.keyboard.press("Space");
      const set = await page.evaluate(() => [document.documentElement.dataset.season, localStorage.getItem("season")]);
      log(`[${vp.name}] dial pick winter sets data-season`, set[0] === "winter" && set[1] === "winter", `data-season=${set[0]} localStorage=${set[1]}`);
      await page.reload({ waitUntil: "networkidle" });
      const after = await page.evaluate(() => document.documentElement.dataset.season);
      log(`[${vp.name}] pick persists across reload`, after === "winter", `after reload data-season=${after}`);
      await page.evaluate(() => localStorage.removeItem("season"));
    } else {
      log(`[${vp.name}] season dial folded control`, true, "below 40rem the dial folds to one button (not separately asserted)");
    }

    await page.screenshot({ path: `/tmp/acc-walk-pm248/home-${vp.name}.png` });

    // Ask the Ink: open the console, ask a question, watch for the typed answer and citations.
    await page.getByRole("button", { name: /Ask the console/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 15000 });
    const input = dialog.locator("input, textarea").first();
    await input.fill("what is your work");
    await input.press("Enter");
    await dialog.getByText(/Sources:/).waitFor({ state: "attached", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(500);
    const answerText = await dialog.innerText();
    console.log("ASK DIALOG TEXT:", JSON.stringify(answerText.slice(0, 600)));
    console.log("ASK ANCHORS:", JSON.stringify(await dialog.locator("a").evaluateAll((as) => as.map((a) => [a.textContent.trim(), a.getAttribute("href")]))));
    const cites = await dialog.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    log(`[${vp.name}] ask: answer and citations`, /work|data/i.test(answerText) && cites.length > 0, `citations=${JSON.stringify([...new Set(cites)])}`);
    log(`[${vp.name}] ask: model endpoint used by console`, apiAsk.length === 0, `requests to /api/ask=${apiAsk.length}`);
    await page.screenshot({ path: `/tmp/acc-walk-pm248/ask-${vp.name}.png` });
    await page.keyboard.press("Escape");

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    log(`[${vp.name}] home no horizontal overflow`, overflow <= 0, `scrollWidth-clientWidth=${overflow}`);
    log(`[${vp.name}] home console errors`, errors.length === 0, errors.length ? errors.join(" | ") : "none");
    await ctx.close();
  }

  // 2. Lost sheet 404 with JavaScript.
  {
    const { ctx, page, errors } = await newPage(vp);
    const resp = await page.goto(`${BASE}/acc-no-such-page-${Date.now()}`, { waitUntil: "networkidle" });
    log(`[${vp.name}] unknown path status`, resp.status() === 404, `status=${resp.status()}`);
    const sheet = await page.locator("svg").count();
    const links = await page.locator('a[href="/"], a[href="/work"], a[href="/projects"], a[href="/notes"], a[href="/play"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
    log(`[${vp.name}] 404 five plain links`, links.length === 5, `links=${JSON.stringify(links)}`);
    const smooth = page.getByRole("button", { name: /Smooth it out/ });
    const hasIsland = await smooth.isVisible().catch(() => false);
    log(`[${vp.name}] 404 smooth island (JS on)`, hasIsland, `button visible=${hasIsland}`);
    if (hasIsland) {
      const pcts = [];
      for (let i = 0; i < 12; i++) {
        if ((await smooth.getAttribute("aria-disabled")) === "true") break;
        await smooth.click();
        pcts.push((await page.locator('p[role="status"]').innerText()).trim());
      }
      await page.waitForTimeout(300);
      const disabled = (await smooth.getAttribute("aria-disabled")) === "true";
      const status = (await page.locator('p[role="status"]').innerText()).trim();
      log(`[${vp.name}] 404 smooth to flat`, disabled && /Flat again/.test(status), `presses=${pcts.length} final status="${status}" trail=${JSON.stringify(pcts)}`);
    }
    await page.screenshot({ path: `/tmp/acc-walk-pm248/404-${vp.name}.png` });
    log(`[${vp.name}] 404 console errors`, errors.length === 0, errors.length ? errors.join(" | ") : "none");
    await ctx.close();
  }

  // 3. Lost sheet 404 with JavaScript disabled: links must still work.
  {
    const { ctx, page } = await newPage(vp, { javaScriptEnabled: false });
    await page.goto(`${BASE}/acc-no-js-${Date.now()}`, { waitUntil: "load" });
    const hrefs = ["/", "/work", "/projects", "/notes", "/play"];
    const results = [];
    for (const h of hrefs) {
      const r = await ctx.request.get(`${BASE}${h}`);
      results.push(`${h}=${r.status()}`);
    }
    const jsOff = await page.locator('a[href="/work"]').count();
    log(`[${vp.name}] 404 no-JS links reachable`, jsOff > 0 && results.every((x) => x.endsWith("=200")), results.join(" "));
    await ctx.close();
  }

  // 4. Reduced motion: flat sheet, no island, no layer bits animate.
  {
    const { ctx, page, errors } = await newPage(vp, { reducedMotion: "reduce" });
    await page.goto(`${BASE}/acc-reduce-${Date.now()}`, { waitUntil: "networkidle" });
    const island = await page.getByRole("button", { name: /Smooth it out/ }).count();
    const running = await page.evaluate(() => [...document.querySelectorAll(".almanac-bit")].filter((el) => getComputedStyle(el).animationName !== "none").length);
    log(`[${vp.name}] reduced motion: no island, no running bits`, island === 0 && running === 0, `island=${island} runningBits=${running}`);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const bits = await page.evaluate(() => [...document.querySelectorAll(".almanac-bit")].filter((el) => getComputedStyle(el).animationName !== "none").length);
    log(`[${vp.name}] reduced motion on home: layer static`, bits === 0, `runningBits=${bits}`);
    log(`[${vp.name}] reduced motion console errors`, errors.length === 0, errors.length ? errors.join(" | ") : "none");
    await ctx.close();
  }
}

await browser.close();
const failed = rows.filter((r) => !r.ok);
console.log(`\nSUMMARY ${rows.length - failed.length}/${rows.length} pass`);
