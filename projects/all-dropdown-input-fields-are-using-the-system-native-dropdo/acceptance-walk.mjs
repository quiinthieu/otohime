// Acceptance walk for pm-198 against a deployed site. One "ok -" / "not ok -" line per check.
// Run: npm i --prefix $PW_PREFIX playwright@1.64.0 && npx --prefix $PW_PREFIX playwright install chromium firefox; node acceptance-walk.mjs
import { createRequire } from "node:module";
const require = createRequire((process.env.PW_PREFIX || "/tmp/acc198/pw") + "/");
const { chromium, firefox, webkit } = require("playwright");

const BASE = process.env.BASE_URL || "https://otohime.dev";
const OUT = process.env.ARTIFACTS_DIR || "/tmp";
let ok = 0, bad = 0;
const check = (cond, name, extra = "") => {
  if (cond) { ok++; console.log(`ok - ${name}${extra ? ` (${extra})` : ""}`); }
  else { bad++; console.log(`not ok - ${name}${extra ? ` (${extra})` : ""}`); }
};

const VIEWPORTS = [{ width: 1366, height: 768 }, { width: 390, height: 844 }];

function watch(page) {
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text()}`); });
  page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) errs.push(`${r.status()} ${r.url()}`); });
  return errs;
}

// resolve a token to rgb() through a throwaway element inside `scope`
const token = (page, scope, v) => page.evaluate(([scope, v]) => {
  const d = document.createElement("div");
  d.style.background = `var(${v})`;
  document.querySelector(scope).appendChild(d);
  const c = getComputedStyle(d).backgroundColor; d.remove(); return c;
}, [scope, v]);

async function chromiumWalk(browser, vp) {
  const tag = `${vp.width}x${vp.height}`;
  const ctx = await browser.newContext({ viewport: vp });

  // ---- /vinyl: the real Genre select ----
  {
    const page = await ctx.newPage();
    const errs = watch(page);
    await page.goto(`${BASE}/vinyl`, { waitUntil: "networkidle" });
    const sel = page.locator(".crate-filters select");
    await sel.scrollIntoViewIfNeeded();
    const sleeves = () => page.locator(".crate article:visible, article:has(.sleeve-art):visible").count();
    const before = await sleeves();
    const card = await token(page, "body", "--card");
    const accent = await token(page, "body", "--accent");
    const raised = await token(page, "body", "--raised");
    const line = await token(page, "body", "--line");
    await sel.click();
    check(await sel.evaluate((s) => s.matches(":open")), `${tag} /vinyl Genre opens a picker on click`);
    const pk = await sel.evaluate((s) => { const c = getComputedStyle(s, "::picker(select)"); return { bg: c.backgroundColor, border: c.borderTopColor, radius: c.borderTopLeftRadius }; });
    check(pk.bg === card, `${tag} /vinyl picker is the --card panel`, pk.bg);
    check(pk.border === line && pk.radius === "8px", `${tag} /vinyl picker has the --line border and 8px radius`, `${pk.border} ${pk.radius}`);
    const checked = await page.locator(".crate-filters option:checked").evaluate((o) => { const c = getComputedStyle(o); return { bg: c.backgroundColor, w: c.fontWeight, text: o.textContent }; });
    check(checked.bg === accent && Number(checked.w) >= 700, `${tag} /vinyl checked option is bold --accent`, `${checked.text} ${checked.bg} ${checked.w}`);
    const opt2 = page.locator(".crate-filters option").nth(2);
    await opt2.hover();
    const hov = await opt2.evaluate((o) => getComputedStyle(o).backgroundColor);
    check(hov === raised, `${tag} /vinyl hovered option is --raised`, hov);
    // option box inside the viewport (nothing clipped off the side of the phone)
    const box = await page.locator(".crate-filters option").last().boundingBox();
    const first = await page.locator(".crate-filters option").first().boundingBox();
    check(box && first && first.x >= 0 && first.x + first.width <= vp.width + 1, `${tag} /vinyl picker options sit inside the viewport width`, first && `x=${first.x.toFixed(0)} w=${first.width.toFixed(0)}`);
    await page.screenshot({ path: `${OUT}/walk-${tag}-vinyl-open.png` });
    // Escape closes without changing the value
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    check(!(await sel.evaluate((s) => s.matches(":open"))) && (await sel.inputValue()) === "", `${tag} /vinyl Escape closes the picker and keeps All`, `open=${await sel.evaluate((s) => s.matches(":open"))} value=${JSON.stringify(await sel.inputValue())}`);
    if (await sel.evaluate((s) => s.matches(":open"))) await sel.click();
    // pick a genre with the mouse; the crate filters
    await sel.click();
    await opt2.click();
    const val = await sel.inputValue();
    const after = await sleeves();
    check(val !== "" && !(await sel.evaluate((s) => s.matches(":open"))), `${tag} /vinyl clicking an option picks it and closes`, val);
    check(after > 0 && after < before, `${tag} /vinyl picking a genre filters the crate`, `${before} -> ${after} sleeves`);
    // keyboard: back to All with Home+Enter after open
    await sel.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Home");
    await page.keyboard.press("Enter");
    check((await sel.inputValue()) === "" && (await sleeves()) === before, `${tag} /vinyl keyboard Home+Enter returns to All and the full crate`, `${await sleeves()} sleeves`);
    await page.screenshot({ path: `${OUT}/walk-${tag}-vinyl-closed.png` });
    check(errs.length === 0, `${tag} /vinyl no console errors, page errors or 4xx/5xx`, errs.slice(0, 3).join(" | "));
    await page.close();
  }

  // ---- /music: replicas of the Colour (add-channel form) and Role (admin) fields, real stylesheet, real theme toggle ----
  for (const theme of ["light", "dark"]) {
    const page = await ctx.newPage();
    const errs = watch(page);
    await page.goto(`${BASE}/music`, { waitUntil: "networkidle" });
    // use the real toggle to pin the theme
    for (let i = 0; i < 3; i++) {
      const cur = await page.evaluate(() => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
      if (cur === theme && await page.evaluate(() => !!document.documentElement.dataset.theme)) break;
      await page.locator(".theme-toggle").first().click();
      await page.waitForTimeout(700);
    }
    const pinned = await page.evaluate(() => document.documentElement.dataset.theme);
    check(pinned === theme, `${tag} /music theme toggle pins ${theme}`, pinned);
    await page.evaluate(() => {
      const main = document.querySelector("main");
      const wrap = document.createElement("div");
      wrap.id = "acc";
      wrap.innerHTML = `
        <form id="acc-colour" class="card grid gap-3 p-5" style="margin:16px 0">
          <div><label for="acc-c" class="label">Title</label><input id="acc-t" name="title" class="field"></div>
          <div><label for="acc-c" class="label">Colour</label>
          <select id="acc-c" name="colour" class="field">${["yellow","coral","mint","blue","pink"].map((k) => `<option value="${k}">${k}</option>`).join("")}</select></div>
        </form>
        <form id="acc-role" class="card grid content-start gap-3 p-5" style="margin:16px 0">
          <h2 id="acc-role-h" class="caption">Role</h2>
          <select id="acc-r" name="role" aria-labelledby="acc-role-h" class="field"><option value="user">user</option><option value="admin">admin</option></select>
        </form>`;
      main.prepend(wrap);
    });
    const paper = await token(page, "#acc", "--paper");
    const paper2 = await token(page, "#acc", "--paper-2");
    const ink = await token(page, "#acc", "--ink");
    const yellow = await token(page, "#acc", "--yellow");
    for (const [id, label] of [["#acc-c", "Colour"], ["#acc-r", "Role"]]) {
      const sel = page.locator(id);
      await sel.scrollIntoViewIfNeeded();
      await sel.click();
      check(await sel.evaluate((s) => s.matches(":open")), `${tag} ${theme} ${label} opens a picker on click`);
      const pk = await sel.evaluate((s) => { const c = getComputedStyle(s, "::picker(select)"); return { bg: c.backgroundColor, border: c.borderTopColor, radius: c.borderTopLeftRadius, shadow: c.boxShadow }; });
      check(pk.bg === paper, `${tag} ${theme} ${label} picker is --paper`, pk.bg);
      check(pk.border === ink && pk.radius === "10px" && pk.shadow.includes(ink) && pk.shadow.includes("2px 2px 0px"), `${tag} ${theme} ${label} picker has the ink border, 10px radius and hard ink shadow`, `${pk.border} ${pk.radius} ${pk.shadow}`);
      const ch = await page.locator(`${id} option:checked`).evaluate((o) => getComputedStyle(o).backgroundColor);
      check(ch === yellow, `${tag} ${theme} ${label} checked option is --yellow`, ch);
      const o1 = page.locator(`${id} option`).nth(1);
      await o1.hover();
      const hv = await o1.evaluate((o) => getComputedStyle(o).backgroundColor);
      check(hv === paper2, `${tag} ${theme} ${label} hovered option is --paper-2`, hv);
      const fb = await page.locator(`${id} option`).first().boundingBox();
      check(fb && fb.x >= 0 && fb.x + fb.width <= vp.width + 1, `${tag} ${theme} ${label} picker sits inside the viewport width`, fb && `x=${fb.x.toFixed(0)} w=${fb.width.toFixed(0)}`);
      await page.screenshot({ path: `${OUT}/walk-${tag}-${theme}-${label.toLowerCase()}-open.png` });
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Escape");
      check(!(await sel.evaluate((s) => s.matches(":open"))), `${tag} ${theme} ${label} Escape closes the picker`);
      if (await sel.evaluate((s) => s.matches(":open"))) await sel.click();
      await sel.click();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      check(!(await sel.evaluate((s) => s.matches(":open"))) && (await sel.inputValue()) !== (label === "Colour" ? "yellow" : "user"), `${tag} ${theme} ${label} ArrowDown+Enter picks the next option and closes`, await sel.inputValue());
    }
    // form participation: the picked colour submits
    const fd = await page.evaluate(() => Object.fromEntries(new FormData(document.getElementById("acc-colour"))));
    check(fd.colour === "coral", `${tag} ${theme} Colour value submits with the form`, JSON.stringify(fd));
    // closed box height matches the neighbouring .field input
    const hs = await page.evaluate(() => [document.getElementById("acc-t").getBoundingClientRect().height, document.getElementById("acc-c").getBoundingClientRect().height]);
    check(Math.abs(hs[0] - hs[1]) <= 1, `${tag} ${theme} closed Colour box height matches the input`, `${hs[1]} vs ${hs[0]}`);
    // type-ahead on the closed select
    await page.locator("#acc-c").focus();
    await page.keyboard.type("p");
    check((await page.locator("#acc-c").inputValue()) === "pink", `${tag} ${theme} type-ahead "p" picks pink`, await page.locator("#acc-c").inputValue());
    check(errs.length === 0, `${tag} ${theme} /music no console errors, page errors or 4xx/5xx`, errs.slice(0, 3).join(" | "));
    await page.close();
  }
  await ctx.close();
}

async function fallbackWalk(type, name) {
  let browser;
  try { browser = await type.launch(); } catch (e) { console.log(`skip - ${name} did not launch: ${e.message.split("\n")[0]}`); return; }
  console.log(`# ${name} ${browser.version()}`);
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errs = watch(page);
  await page.goto(`${BASE}/vinyl`, { waitUntil: "networkidle" });
  const sup = await page.evaluate(() => CSS.supports("appearance", "base-select"));
  const sel = page.locator(".crate-filters select");
  const app = await sel.evaluate((s) => getComputedStyle(s).appearance);
  console.log(`# ${name} supports base-select=${sup} computed appearance=${app}`);
  if (sup) check(app === "base-select", `${name} /vinyl Genre uses the page-styled picker`, app);
  else check(app !== "base-select", `${name} /vinyl Genre keeps the native popup`, app);
  const opts = await sel.locator("option").allTextContents();
  await sel.selectOption(opts[2]);
  check((await sel.inputValue()) === opts[2], `${name} /vinyl Genre still selects a value`, opts[2]);
  await page.goto(`${BASE}/music`, { waitUntil: "networkidle" });
  await page.evaluate(() => { const s = document.createElement("select"); s.className = "field"; s.id = "fx"; s.innerHTML = "<option>yellow</option><option>coral</option>"; document.querySelector("main").prepend(s); });
  const fapp = await page.locator("#fx").evaluate((s) => getComputedStyle(s).appearance);
  if (sup) check(fapp === "base-select", `${name} /music select.field uses the page-styled picker`, fapp);
  else check(fapp === "none", `${name} /music select.field keeps the closed styling (appearance none) and the native popup`, fapp);
  await page.locator("#fx").selectOption("coral");
  check((await page.locator("#fx").inputValue()) === "coral", `${name} /music select.field still selects a value`);
  check(errs.length === 0, `${name} no console errors, page errors or 4xx/5xx`, errs.slice(0, 3).join(" | "));
  await browser.close();
}

const browser = await chromium.launch();
console.log(`# chromium ${browser.version()} base=${BASE}`);
for (const vp of VIEWPORTS) await chromiumWalk(browser, vp);
await browser.close();
await fallbackWalk(firefox, "firefox");
await fallbackWalk(webkit, "webkit");
console.log(`walk: ${ok} ok, ${bad} failed`);
process.exit(bad ? 1 : 0);
