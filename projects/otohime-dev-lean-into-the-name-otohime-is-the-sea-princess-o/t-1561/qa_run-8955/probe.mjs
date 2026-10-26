// QA run-8955 probe for t-1561 (Tamatebako), independent of e2e/ryugu.test.ts.
// Walks every scrubber position in a real Chrome and checks each leaf against `git show` in the repository (not
// against content/history.json), that the paper's computed style ages at every step, that Space and PageUp/PageDown
// drive the box and the scrubber, and that the replay label is visible. MODE=empty instead expects a build made from
// an empty index: the empty box, and no scrubber.
//   BASE_URL  server (default http://localhost:4031)   REPO  git checkout to compare with (default cwd)
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://localhost:4031";
const REPO = process.env.REPO ?? process.cwd();
const MODE = process.env.MODE ?? "full";
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log(`${ok ? "ok" : "not ok"} - ${msg}`); };

const git = (sha) => {
  const [full, cdate, subject] = execFileSync("git", ["-C", REPO, "show", "-s", "--format=%H%x1f%cI%x1f%s", sha], { encoding: "utf8" }).trim().split("\x1f");
  return { full, date: new Date(cdate).toISOString().replace(/\.000Z$/, "Z"), subject };
};
// The indexer (t-1560) splits a "<plan>/<task>: " prefix off and caps long subjects with an ellipsis.
const stripPrefix = (s) => s.replace(/^[a-z]+-\d+\/[^\s:]+:\s*/, "");
const sameSubject = (gitSubject, shown) =>
  shown.endsWith("…") ? stripPrefix(gitSubject).startsWith(shown.slice(0, -1)) : stripPrefix(gitSubject) === shown;

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/ryugu`, { waitUntil: "networkidle" });

const box = page.locator(".tamatebako .box");
check((await box.getAttribute("aria-expanded")) === "false", "the box starts shut (aria-expanded=false)");
await box.focus();
await page.keyboard.press("Space");
check((await box.getAttribute("aria-expanded")) === "true", "Space opens the box");
const note = await page.locator(".replay-note").innerText();
check(/changelog replay/i.test(note) && /not rebuilt/.test(note), `the replay is labelled a changelog replay, not a rebuilt site: "${note.slice(0, 90)}…"`);

if (MODE === "empty") {
  check((await page.locator(".scrubber").count()) === 0, "an empty index shows no scrubber");
  const empty = await page.locator(".leaf-empty").innerText().catch(() => "");
  check(/The box is empty/.test(empty), `an empty index shows the empty box: "${empty}"`);
} else {
  const slider = page.getByRole("slider", { name: "Scrub back through the changelog" });
  check((await slider.count()) === 1, "one slider with its accessible name");
  const max = Number(await slider.getAttribute("max"));
  check(max > 0, `the scrubber has ${max + 1} positions`);
  await slider.focus();
  const read = () => page.evaluate(() => {
    const l = document.querySelector(".leaf");
    const s = getComputedStyle(l);
    return {
      value: Number(document.querySelector(".scrubber").value),
      sha: l.querySelector("code").textContent,
      date: l.querySelector("time").getAttribute("datetime"),
      subject: l.querySelector(".leaf-subject").textContent,
      text: document.querySelector(".scrubber").getAttribute("aria-valuetext"),
      age: Number(l.getAttribute("data-age")),
      paper: s.backgroundColor, ink: s.color, shadow: s.boxShadow, image: s.backgroundImage,
    };
  });
  // PageDown is a big step back, PageUp a big step forward, End back at the newest.
  await page.keyboard.press("End");
  await page.keyboard.press("PageDown");
  const pd = (await read()).value;
  check(pd < max, `PageDown steps back (${max} -> ${pd})`);
  await page.keyboard.press("PageUp");
  check((await read()).value > pd, "PageUp steps forward");
  await page.keyboard.press("End");

  let prev = null, capped = 0, gitMismatch = 0, notAged = 0, notYellower = 0, seen = new Set(), crossControl = 0;
  for (let v = max; v >= 0; v--) {
    const leaf = await read();
    if (leaf.value !== v) { fails.push(`position ${v}: slider at ${leaf.value}`); break; }
    const g = git(leaf.sha);
    seen.add(g.full);
    if (leaf.subject.endsWith("…")) capped++;
    const same = g.date === leaf.date && sameSubject(g.subject, leaf.subject) && leaf.text.includes(leaf.subject);
    if (!same) { gitMismatch++; if (gitMismatch < 4) console.log(`  mismatch at ${v}: ${JSON.stringify({ leaf, g })}`); }
    if (prev) {
      // negative control: the previous position's git commit never matches this leaf
      if (git(prev.sha).subject === g.subject && prev.date === leaf.date) crossControl++;
      const style = (x) => [x.paper, x.ink, x.shadow, x.image].join("|");
      if (!(leaf.age > prev.age) || style(leaf) === style(prev)) notAged++;
      const blue = (x) => Number(x.paper.match(/\d+/g)[2]);
      if (blue(leaf) > blue(prev)) notYellower++;
    }
    prev = leaf;
    if (v > 0) await page.keyboard.press("ArrowLeft");
  }
  check(gitMismatch === 0, `every one of ${max + 1} positions matches git show (sha, committer date in UTC, subject): ${gitMismatch} mismatches`);
  console.log(`  ${capped} subjects shown capped with an ellipsis`);
  check(seen.size === max + 1, `${seen.size} distinct commits on ${max + 1} positions`);
  check(crossControl === 0, `negative control: no position matches its neighbour's commit (${crossControl})`);
  check(notAged === 0, `the paper's computed style and data-age change at every step back (${notAged} steps did not)`);
  check(notYellower === 0, `the paper's blue channel never rises going back (${notYellower} rises)`);
  check(prev.age === 1 && /old and foxed/.test(prev.text), `the oldest position is fully aged: ${prev.text}`);
}
check(errors.length === 0, `no page errors (${errors.join("; ")})`);
await browser.close();
console.log(fails.length ? `FAIL ${fails.length}` : "PASS");
process.exit(fails.length ? 1 : 0);
