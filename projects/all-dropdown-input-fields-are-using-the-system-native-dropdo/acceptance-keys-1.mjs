// pm-198 acceptance cycle 1: a keyboard user on /vinyl with a record on the platter uses the Genre picker.
// One "ok -" / "not ok -" line per check. Run: PW_PREFIX=<dir with playwright@1.64.0> node acceptance-keys-1.mjs
import { createRequire } from "node:module";
const require = createRequire((process.env.PW_PREFIX || "/tmp/acc198/pw") + "/");
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "https://otohime.dev";
const OUT = process.env.ARTIFACTS_DIR || "/tmp";
let ok = 0, bad = 0;
const check = (cond, name, extra = "") => {
  if (cond) ok++; else bad++;
  console.log(`${cond ? "ok" : "not ok"} - ${name}${extra ? ` (${extra})` : ""}`);
};

const browser = await chromium.launch();
console.log(`# chromium ${browser.version()} base=${BASE}`);
for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  const tag = `${vp.width}x${vp.height}`;
  const page = await browser.newPage({ viewport: vp });
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) errs.push(`${r.status()} ${r.url()}`); });
  const sel = page.locator(".crate-filters select");
  const open = () => sel.evaluate((s) => s.matches(":open"));
  const state = async () => ({
    phase: await page.locator(".deck").getAttribute("data-phase"),
    record: await page.locator('.turntable svg[role="group"]').first().getAttribute("aria-label"),
    value: await sel.inputValue(),
    sleeves: await page.locator(".crate button.place:visible").count(),
  });
  const fresh = async () => {
    await page.goto(`${BASE}/vinyl`, { waitUntil: "networkidle" });
    await page.locator("button.place").first().click();
    await page.waitForTimeout(1200);
    return state();
  };

  // 1. keyboard-only: Tab focus to the Genre select, open it with the keyboard, Escape out
  let s0 = await fresh();
  check(s0.phase !== "empty" && !!s0.record, `${tag} a record is on the platter`, `${s0.phase}`);
  await sel.focus();
  await page.keyboard.press("Enter");
  const kOpen = await open();
  check(kOpen, `${tag} Enter on the focused Genre select opens the page-styled picker`);
  await page.screenshot({ path: `${OUT}/acc1-${tag}-vinyl-open-loaded.png` });
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  let s1 = await state();
  check(!(await open()) && s1.value === "", `${tag} Escape closes the picker and leaves All`, `open=${await open()} value=${JSON.stringify(s1.value)}`);
  check(s1.phase === s0.phase && s1.record === s0.record, `${tag} Escape in the picker does not eject the record`, `${s0.phase} -> ${s1.phase}`);
  check(await sel.evaluate((s) => document.activeElement === s), `${tag} focus returns to the Genre select after Escape`);

  // 2. Space picks the highlighted genre; nothing plays; the crate filters
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press(" ");
  await page.waitForTimeout(800);
  let s2 = await state();
  check(!(await open()) && s2.value !== "", `${tag} ArrowDown+Space picks a genre and closes the picker`, s2.value);
  check(s2.phase === s0.phase && s2.record === s0.record, `${tag} Space in the picker does not start playback`, `${s0.phase} -> ${s2.phase}`);
  check(s2.sleeves > 0 && s2.sleeves < s0.sleeves, `${tag} the crate filters to the picked genre`, `${s0.sleeves} -> ${s2.sleeves}`);

  // 3. Arrows inside the picker move through options, never the record; type-ahead and Home+Enter
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(600);
  let s3 = await state();
  check(s3.phase === s0.phase && s3.record === s0.record, `${tag} ArrowLeft/ArrowRight in the picker leave the record alone`, `${s0.record?.slice(0, 40)} -> ${s3.record?.slice(0, 40)}`);
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  let s4 = await state();
  check(!(await open()) && s4.value === "" && s4.sleeves === s0.sleeves, `${tag} Home+Enter returns to All and the full crate`, `${s4.value || "All"} ${s4.sleeves}`);

  // 4. while playing: open the picker, pick by mouse, playback carries on
  await page.locator(".turntable-cell").focus();
  await page.keyboard.press(" ");
  await page.waitForTimeout(2500);
  const p0 = await state();
  check(["playing", "buffering", "cueing"].includes(p0.phase), `${tag} Space on the turntable starts playback (deck shortcut kept)`, p0.phase);
  await sel.click();
  await page.keyboard.press("Escape");
  await sel.click();
  await page.locator(".crate-filters option").nth(2).click();
  await page.waitForTimeout(800);
  const p1 = await state();
  check(p1.record === p0.record && p1.phase !== "empty" && p1.phase !== "paused", `${tag} opening, Escaping and picking in Genre does not stop or change the playing record`, `${p0.phase} -> ${p1.phase}`);

  // 5. deck shortcuts outside the picker still work
  await page.locator(".turntable-cell").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(800);
  const d1 = await state();
  check(d1.record !== p1.record, `${tag} ArrowRight on the turntable changes the record`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  const d2 = await state();
  check(d2.phase === "empty", `${tag} Escape on the turntable ejects the record`, d2.phase);
  await page.screenshot({ path: `${OUT}/acc1-${tag}-vinyl-after.png` });
  const real = errs.filter((e) => !/youtube|google|doubleclick|ytimg/i.test(e));
  check(real.length === 0, `${tag} no first-party console errors, page errors or 4xx/5xx`, real.slice(0, 3).join(" | "));
  if (errs.length) console.log(`# ${tag} third-party/other errors: ${errs.slice(0, 3).join(" | ")}`);
  await page.close();
}
await browser.close();
console.log(`keys: ${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
