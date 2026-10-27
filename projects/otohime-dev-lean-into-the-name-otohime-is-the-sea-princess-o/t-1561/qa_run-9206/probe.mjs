// QA run-9206 probe for t-1561 (Tamatebako) against a served /ryugu, independent of e2e/ryugu.test.ts and of
// qa_run-8955/probe.mjs. Three real Chrome contexts:
//   keyboard  Enter opens the box, Home/End and ArrowRight walk every position oldest -> newest; each leaf is checked
//             against `git show` in REPO (not content/history.json) and the paper's computed colour must age.
//   touch     hasTouch/isMobile: a tap opens the box, a tap at the scrubber's left end jumps back in time.
//   reduced   prefers-reduced-motion: reduce opens with no smoke node; the no-preference context must show smoke
//             that clears within two seconds (each is the other's control).
// MODE=empty expects the empty box and no scrubber instead of the walk.
//   BASE_URL (default https://otohime.dev)   REPO git checkout to compare with (default cwd)
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "https://otohime.dev";
const REPO = process.env.REPO ?? process.cwd();
const MODE = process.env.MODE ?? "full";
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`${ok ? "ok" : "not ok"} - ${msg}`); };
const git = (sha) => {
  try {
    const [full, cdate, subject] = execFileSync("git", ["-C", REPO, "show", "-s", "--format=%H%x1f%cI%x1f%s", sha], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\x1f");
    return { full, date: new Date(cdate).toISOString().replace(/\.000Z$/, "Z"), subject };
  } catch { return null; }
};
const body = (s) => s.replace(/^[a-z]+-\d+\/[^\s:]+:\s*/, "");
const sameSubject = (g, shown) => (shown.endsWith("…") ? body(g).startsWith(shown.slice(0, -1)) : body(g) === shown);

const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
const open = async (opts) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/ryugu`, { waitUntil: "networkidle" });
  return { ctx, page, box: page.locator(".tamatebako .box") };
};

// keyboard
{
  const { ctx, page, box } = await open({});
  check((await box.getAttribute("aria-expanded")) === "false", "keyboard: the box starts shut");
  check(await page.locator(".replay").isHidden(), "keyboard: the replay is hidden until the box opens");
  await box.focus();
  await page.keyboard.press("Enter");
  check((await box.getAttribute("aria-expanded")) === "true", "keyboard: Enter opens the box");
  const note = await page.locator(".replay-note").innerText();
  check(/changelog replay/i.test(note) && /not rebuilt/.test(note), `keyboard: labelled a changelog replay, not a rebuilt site`);
  if (MODE === "empty") {
    check((await page.locator(".scrubber").count()) === 0, "empty: no scrubber");
    check(/The box is empty/.test(await page.locator(".leaf-empty").innerText().catch(() => "")), "empty: the empty box");
  } else {
    const slider = page.getByRole("slider", { name: "Scrub back through the changelog" });
    check((await slider.count()) === 1, "keyboard: one slider with its accessible name");
    const max = Number(await slider.getAttribute("max"));
    const read = () => page.evaluate(() => {
      const l = document.querySelector(".leaf");
      return {
        value: Number(document.querySelector(".scrubber").value),
        sha: l.querySelector("code").textContent,
        date: l.querySelector("time").getAttribute("datetime"),
        subject: l.querySelector(".leaf-subject").textContent,
        text: document.querySelector(".scrubber").getAttribute("aria-valuetext"),
        age: Number(l.getAttribute("data-age")),
        paper: getComputedStyle(l).backgroundColor,
        style: [getComputedStyle(l).backgroundColor, getComputedStyle(l).color, getComputedStyle(l).boxShadow].join("|"),
      };
    });
    await slider.focus();
    await page.keyboard.press("Home");
    let prev = null, bad = 0, unknown = 0, notAged = 0, backwards = 0, shas = new Set();
    const rgb = (x) => x.paper.match(/\d+/g).map(Number);
    for (let v = 0; v <= max; v++) {
      const leaf = await read();
      if (leaf.value !== v) { fails.push(`position ${v}: slider at ${leaf.value}`); break; }
      const g = git(leaf.sha);
      if (!g) unknown++;
      else {
        shas.add(g.full);
        if (!(g.date === leaf.date && sameSubject(g.subject, leaf.subject) && leaf.text.includes(leaf.subject))) {
          bad++; if (bad < 4) console.log(`  mismatch at ${v}: ${JSON.stringify({ leaf, g })}`);
        }
      }
      // going forward the paper gets younger: data-age falls and the computed style (paper, ink, edge shadow) changes at
      // every step; the 8-bit paper colour alone can round equal between neighbours, but never turns yellower
      if (prev && !(leaf.age < prev.age && leaf.style !== prev.style)) notAged++;
      if (prev && rgb(leaf).some((c, i) => c < rgb(prev)[i])) backwards++;
      prev = leaf;
      if (v < max) await page.keyboard.press("ArrowRight");
    }
    check(max > 0, `keyboard: ${max + 1} positions`);
    check(unknown === 0, `keyboard: every shown sha exists in the repository (${unknown} unknown)`);
    check(bad === 0, `keyboard: every position matches git show (sha, UTC committer date, subject): ${bad} mismatches`);
    check(shas.size === max + 1, `keyboard: ${shas.size} distinct commits on ${max + 1} positions`);
    check(notAged === 0, `keyboard: data-age and the computed paper/ink/shadow change at every step (${notAged} did not)`);
    check(backwards === 0, `keyboard: the paper colour never yellows going forward in time (${backwards} steps did)`);
    check(prev.age === 0 && prev.paper === "rgb(242, 239, 231)", `keyboard: the newest leaf is fresh paper (${prev.paper})`);
    await page.keyboard.press("Home");
    const oldest = await read();
    check(oldest.age === 1 && oldest.paper === "rgb(214, 186, 122)", `keyboard: the oldest leaf is fully yellowed (${oldest.paper})`);
  }
  await ctx.close();
}

// touch
if (MODE !== "empty") {
  const { ctx, page, box } = await open({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await box.scrollIntoViewIfNeeded();
  await box.tap();
  check((await box.getAttribute("aria-expanded")) === "true", "touch: a tap opens the box");
  const slider = page.locator(".scrubber");
  await slider.scrollIntoViewIfNeeded();
  const bb = await slider.boundingBox();
  const before = Number(await slider.inputValue());
  await page.touchscreen.tap(bb.x + 2, bb.y + bb.height / 2);
  const after = Number(await slider.inputValue());
  const age = Number(await page.locator(".leaf").getAttribute("data-age"));
  check(after < before && age > 0.9, `touch: a tap at the scrubber's left end goes back (${before} -> ${after}, age ${age})`);
  await ctx.close();
}

// reduced motion vs no preference
for (const reducedMotion of ["reduce", "no-preference"]) {
  const { ctx, page, box } = await open({ reducedMotion });
  await box.click();
  const smoke = await page.locator("[data-smoke]").count();
  if (reducedMotion === "reduce") check(smoke === 0, `reduced motion: no smoke on opening (${smoke})`);
  else {
    check(smoke === 1, `no preference (control): smoke rises on opening (${smoke})`);
    await page.waitForTimeout(2000);
    check((await page.locator("[data-smoke]").count()) === 0, "no preference: the smoke clears within two seconds");
  }
  check((await box.getAttribute("aria-expanded")) === "true", `${reducedMotion}: the box opens`);
  await ctx.close();
}

check(errors.length === 0, `no page errors (${errors.join("; ")})`);
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "PASS");
process.exit(fails.length ? 1 : 0);
