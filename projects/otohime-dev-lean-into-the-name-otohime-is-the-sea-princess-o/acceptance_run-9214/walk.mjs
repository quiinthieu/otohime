// pm-271 acceptance walk (run-9214): a visitor's path through the Tamatebako and the palace sound on the live site, at
// 1366x768 (mouse + keyboard) and 390x844 (touch). Real Google Chrome via the repo's locked playwright-core. Sound is
// judged by RMS from an AnalyserNode mirrored onto every connect() to the destination. Each leaf's sha is checked with
// `git cat-file`/`git show` in this checkout, and the newest leaf is compared with the sha /api/health serves.
// BASE_URL (default https://otohime.dev), SHOTS dir. Exit 1 on any failed check.
import { chromium } from "playwright-core";
import { execFileSync } from "node:child_process";

const BASE = process.env.BASE_URL ?? "https://otohime.dev";
const SHOTS = process.env.SHOTS ?? "shots";
const fails = [];
let n = 0;
const check = (ok, msg) => { n++; if (!ok) fails.push(msg); console.log(`${ok ? "ok" : "not ok"} ${n} - ${msg}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const git = (...a) => execFileSync("git", a, { encoding: "utf8" }).trim();

function TAP() {
  const C = window.AudioContext;
  if (!C) return;
  window.__ctxs = [];
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (to, ...rest) {
    const r = connect.call(this, to, ...rest);
    if (to instanceof AudioDestinationNode) {
      const c = this.context;
      if (!c.__tap) { c.__tap = c.createAnalyser(); c.__tap.fftSize = 2048; }
      connect.call(this, c.__tap);
    }
    return r;
  };
  window.AudioContext = class extends C { constructor(...a) { super(...a); window.__ctxs.push(this); } };
  // Leaving destroys the document, so record each close() call (and the state at the time) where the next page can read it.
  const close = C.prototype.close;
  C.prototype.close = function (...a) {
    sessionStorage.setItem("__closes", String(Number(sessionStorage.getItem("__closes") ?? 0) + 1) + ":" + this.state);
    return close.apply(this, a);
  };
  window.__rms = () => window.__ctxs.map((c) => {
    if (!c.__tap || c.state !== "running") return { state: c.state, rms: 0 };
    const b = new Float32Array(c.__tap.fftSize);
    c.__tap.getFloatTimeDomainData(b);
    return { state: c.state, rms: Math.sqrt(b.reduce((s, x) => s + x * x, 0) / b.length) };
  });
}

const health = await (await fetch(`${BASE}/api/health`)).json();
console.log(`# live sha ${health.sha}`);
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=user-gesture-required"] });

const VIEWS = [
  { name: "desk", opts: { viewport: { width: 1366, height: 768 } } },
  { name: "phone", opts: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
];

for (const v of VIEWS) {
  const touch = v.name === "phone";
  const ctx = await browser.newContext(v.opts);
  await ctx.addInitScript(TAP);
  const errors = [];
  ctx.on("page", (p) => {
    p.on("pageerror", (e) => errors.push(`pageerror ${e}`));
    p.on("console", (m) => m.type() === "error" && errors.push(`console ${m.text()} @ ${m.location().url}`));
    p.on("response", (r) => r.status() >= 400 && r.url().startsWith(BASE) && errors.push(`http ${r.status()} ${r.url()}`));
  });
  const page = await ctx.newPage();
  const meter = () => page.evaluate(() => (window.__rms ? window.__rms() : []));

  // Entry: type the secret word on the home page.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await wait(800);
  await page.keyboard.type("urashima", { delay: 60 });
  const entered = await page.waitForURL(/\/ryugu$/, { timeout: 8000 }).then(() => true, () => false);
  check(entered, `${v.name}: typing 'urashima' on / lands on /ryugu`);
  if (!entered) await page.goto(`${BASE}/ryugu`);
  await page.waitForSelector(".tamatebako .box");
  await wait(800);

  // Tamatebako: shut, then opened by a tap (phone) or keyboard Enter (desk).
  const box = page.locator(".tamatebako .box");
  check((await box.getAttribute("aria-expanded")) === "false" && (await page.locator(".replay").isHidden()), `${v.name}: the box starts shut, replay hidden`);
  await page.screenshot({ path: `${SHOTS}/${v.name}-box-shut.png` });
  if (touch) await box.tap(); else { await box.focus(); await page.keyboard.press("Enter"); }
  check((await box.getAttribute("aria-expanded")) === "true" && (await page.locator(".replay").isVisible()), `${v.name}: ${touch ? "a tap" : "Enter"} opens the box`);
  const note = await page.locator(".replay-note").innerText();
  check(/A changelog replay/.test(note) && /not rebuilt/.test(note), `${v.name}: the note presents a changelog replay, not rebuilt site versions`);
  const claim = note.match(/the newest (\d+) of its (\d+) commits|all (\d+) of its commits/);
  const claimedTotal = Number(claim?.[2] ?? claim?.[3]);
  const slider = page.getByRole("slider", { name: "Scrub back through the changelog" });
  check((await slider.count()) === 1, `${v.name}: one labelled slider`);
  await wait(1600);
  await page.screenshot({ path: `${SHOTS}/${v.name}-box-open-newest.png` });

  const leafNow = () => page.evaluate(() => {
    const leaf = document.querySelector(".leaf");
    const cs = getComputedStyle(leaf);
    return { sha: leaf.querySelector("code")?.textContent, date: leaf.querySelector("time")?.getAttribute("datetime"),
      subject: leaf.querySelector(".leaf-subject")?.textContent, age: Number(leaf.dataset.age), bg: cs.backgroundColor,
      value: document.querySelector(".scrubber").value, valuetext: document.querySelector(".scrubber").getAttribute("aria-valuetext") };
  });
  const newest = await leafNow();
  // A real entry: the leaf's sha resolves in this repository and its subject is the commit's subject (prefix stripped).
  const realSubject = (sha) => { try { return git("show", "-s", "--format=%s", sha); } catch { return null; } };
  const s0 = realSubject(newest.sha);
  check(s0 !== null && s0.includes(newest.subject.replace(/…$/, "").slice(0, 40)), `${v.name}: newest leaf ${newest.sha} is a real commit: "${newest.subject}"`);
  // The replay is of otohime.dev's own history: how far is its newest leaf behind what the site serves?
  const behind = Number(git("rev-list", "--count", `${newest.sha}..${health.sha}`));
  const total = Number(git("rev-list", "--count", health.sha));
  console.log(`# newest leaf ${newest.sha} ${newest.date}; live ${health.sha.slice(0, 10)}; leaf is ${behind} commits behind live; note claims ${claimedTotal} commits, git has ${total} at live`);
  check(behind <= 20, `${v.name}: the replay's newest leaf is within the indexer's own MAX_LAG (20) of the live sha (it is ${behind} behind)`);
  check(claimedTotal === total, `${v.name}: the note's commit count matches the live sha's history (claims ${claimedTotal}, git has ${total})`);

  // Scrub to the oldest end: keyboard Home (desk) or a tap at the left end (phone).
  if (touch) {
    const bb = await slider.boundingBox();
    await page.touchscreen.tap(bb.x + 2, bb.y + bb.height / 2);
  } else { await slider.focus(); await page.keyboard.press("Home"); }
  await wait(300);
  const oldest = await leafNow();
  const s1 = realSubject(oldest.sha);
  check(oldest.value === "0" && s1 !== null && oldest.sha !== newest.sha, `${v.name}: ${touch ? "a tap at the left end" : "Home"} goes to the oldest leaf ${oldest.sha} (${oldest.date}), a real commit`);
  check(oldest.age === 1 && newest.age === 0 && oldest.bg !== newest.bg, `${v.name}: paper ages from ${newest.bg} (age 0) to ${oldest.bg} (age 1)`);
  // Middle step: the paper is in between.
  if (!touch) { for (let i = 0; i < 100; i++) await page.keyboard.press("ArrowRight"); }
  else { const bb = await slider.boundingBox(); await page.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); }
  await wait(300);
  const mid = await leafNow();
  check(mid.age > 0 && mid.age < 1 && realSubject(mid.sha) !== null, `${v.name}: a middle position shows a real commit ${mid.sha} at age ${mid.age} (${mid.bg})`);
  check(/Commit \d+ of \d+/.test(mid.valuetext) && mid.valuetext.includes(mid.subject.slice(0, 20)), `${v.name}: the slider speaks the commit: "${mid.valuetext.slice(0, 80)}…"`);
  await page.locator(".tamatebako").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${v.name}-box-open-older.png` });

  // Sound: off until the visitor enables it.
  const sound = page.locator("[data-ambience] .sound");
  check((await page.getAttribute("[data-ambience]", "data-ambience")) === "off" && (await meter()).length === 0, `${v.name}: after taps and keys in the palace there is no AudioContext and sound is off`);
  if (touch) await sound.tap(); else await sound.click();
  await wait(2600);
  const on = await meter();
  check(on.length === 1 && on[0].state === "running" && on[0].rms > 1e-4 && on[0].rms < 0.05, `${v.name}: the Sea sound button plays a quiet ambience (rms ${on[0]?.rms?.toExponential(2)})`);
  await page.screenshot({ path: `${SHOTS}/${v.name}-sound-on.png` });

  // Pocket on Home, in a second tab: switch it off there.
  const home = await ctx.newPage();
  await home.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const chip = home.locator("[data-pocket-sea-sound]");
  if (!(await chip.isVisible())) await home.locator("[data-pocket-sea-sound]").scrollIntoViewIfNeeded().catch(() => {});
  check((await chip.getAttribute("aria-pressed")) === "true", `${v.name}: Pocket's Sea sound chip shows it on`);
  await home.screenshot({ path: `${SHOTS}/${v.name}-pocket-chip.png` });
  if (touch) await chip.tap(); else await chip.click();
  await wait(1200);
  const off = await meter();
  check(off.every((c) => c.rms === 0) && (await page.getAttribute("[data-ambience]", "data-ambience")) === "off", `${v.name}: switching it off in Pocket silences the palace (rms ${off.map((c) => c.rms).join(",")})`);
  check((await home.evaluate(() => (window.__ctxs ?? []).length)) === 0, `${v.name}: Home made no AudioContext`);
  await home.close();

  // On again in the palace, then leave: the context closes.
  if (touch) await sound.tap(); else await sound.click();
  await wait(1500);
  const again = await meter();
  check(again.some((c) => c.state === "running" && c.rms > 1e-4), `${v.name}: enabled again in the palace, it plays`);
  await page.evaluate(() => sessionStorage.removeItem("__closes"));
  if (touch) await page.getByRole("link", { name: /Back to the surface/ }).tap(); else await page.getByRole("link", { name: /Back to the surface/ }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/ryugu"), { timeout: 8000 });
  const closes = await page.evaluate(() => sessionStorage.getItem("__closes"));
  const surfaceCtx = await page.evaluate(() => (window.__ctxs ?? []).length);
  check(closes !== null && closes.startsWith("1:running") && surfaceCtx === 0, `${v.name}: leaving the palace closes its playing audio (close() calls ${closes}); the surface makes ${surfaceCtx} contexts`);

  check(errors.length === 0, `${v.name}: no page errors, console errors or same-origin 4xx/5xx${errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""}`);
  await ctx.close();
}

// No Web Audio: the button degrades without errors.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => { delete window.AudioContext; delete window.webkitAudioContext; });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${BASE}/ryugu`, { waitUntil: "networkidle" });
  await wait(800);
  await page.locator("[data-ambience] .sound").tap({ force: true });
  await wait(300);
  check((await page.getAttribute("[data-ambience]", "data-ambience")) === "unsupported" && (await page.getAttribute(".sound", "aria-disabled")) === "true" && errors.length === 0,
    `no Web Audio: the button is unsupported/aria-disabled and a tap throws nothing (${errors.length} errors)`);
  await page.screenshot({ path: `${SHOTS}/phone-no-webaudio.png` });
  await ctx.close();
}

await browser.close();
console.log(fails.length ? `FAIL ${fails.length} of ${n}` : `PASS ${n}/${n}`);
process.exit(fails.length ? 1 : 0);
