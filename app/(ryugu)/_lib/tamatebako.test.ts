// The Tamatebako's replay: the scrubber's positions are the real commits of content/history.json, oldest first; the
// paper yellows at every step back; an empty or malformed index is an empty box; reduced motion opens it without
// smoke; and the box says it is a changelog replay, not the site as it was.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { ageAt, ageWord, EMPTY_REPLAY, opening, paperAt, replay, SMOKE_MS, stamp, valueText, type Leaf } from "./tamatebako.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const HISTORY = JSON.parse(readFileSync(join(ROOT, "content/history.json"), "utf8")) as {
  total: number;
  entries: { sha: string; date: string; subject: string; plan: string | null; task: string | null; files: number; areas: string[] }[];
};
const COMPONENT = readFileSync(join(ROOT, "app/(ryugu)/_components/tamatebako.tsx"), "utf8");

const rgb = (css: string) => css.match(/\d+(?:\.\d+)?/g)!.map(Number);

test("the positions are the committed changelog's real commits, oldest first, with their own dates and subjects", () => {
  assert.ok(HISTORY.entries.length > 1, "the committed index has commits");
  const { leaves, total } = replay(HISTORY);
  assert.equal(leaves.length, HISTORY.entries.length);
  assert.equal(total, HISTORY.total);
  const newestFirst = [...leaves].reverse();
  HISTORY.entries.forEach((e, i) => {
    assert.equal(newestFirst[i].sha, e.sha);
    assert.equal(newestFirst[i].date, e.date);
    assert.equal(newestFirst[i].subject, e.subject.trim());
  });
  // the scrubber's last position is the index's newest commit
  assert.equal(leaves.at(-1)!.sha, HISTORY.entries[0].sha);
});

test("an empty, missing or malformed index is an empty box, and bad entries are left out rather than drawn blank", () => {
  assert.deepEqual(replay({ version: 1, head: null, total: 0, entries: [] }), EMPTY_REPLAY);
  for (const bad of [null, undefined, {}, { entries: "no" }, 42, "[]"]) assert.deepEqual(replay(bad), EMPTY_REPLAY, String(bad));
  const good = { sha: "abcdef1234", date: "2026-10-25T17:32:34Z", plan: "pm-1", task: "t-1", subject: "Keep me", files: 2, areas: ["lib"] };
  const { leaves, total } = replay({
    total: 1,
    entries: [
      good,
      { ...good, sha: "not-a-sha" },
      { ...good, date: "yesterday" },
      { ...good, subject: "   " },
      { ...good, subject: undefined },
      null,
      { ...good, sha: "0123456789", files: -3, areas: ["app", 7], plan: 5 },
    ],
  });
  assert.deepEqual(leaves.map((l) => l.sha), ["0123456789", "abcdef1234"]);
  assert.deepEqual(leaves[0], { ...good, sha: "0123456789", files: 0, areas: ["app"], plan: null } satisfies Leaf);
  assert.equal(total, 2, "never fewer commits in all than on the scrubber");
});

test("the paper is fresh at the newest commit, oldest at the first, and older at every step back", () => {
  assert.equal(ageAt(9, 10), 0);
  assert.equal(ageAt(0, 10), 1);
  for (let p = 9; p > 0; p--) assert.ok(ageAt(p - 1, 10) > ageAt(p, 10), `${p}`);
  assert.equal(ageAt(0, 1), 0);
  assert.equal(ageAt(0, 0), 0);
  assert.equal(ageAt(-4, 10), 1);
  assert.equal(ageAt(40, 10), 0);
  assert.equal(ageAt(Number.NaN, 10), 0);
});

test("aged paper yellows, its ink fades and foxing comes up, a little more at every step", () => {
  const fresh = paperAt(0);
  assert.equal(fresh["--leaf-paper"], "rgb(242, 239, 231)", "the site's own paper at the newest commit");
  assert.equal(fresh["--leaf-foxing"], "0");
  let last = fresh;
  for (const age of [0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
    const now = paperAt(age);
    const [r, g, b] = rgb(now["--leaf-paper"]);
    const [pr, pg, pb] = rgb(last["--leaf-paper"]);
    assert.ok(b < pb && g < pg, `bluer or greener at ${age}`);
    assert.ok(r - b > pr - pb, `no yellower at ${age}`);
    assert.ok(rgb(now["--leaf-ink"])[3] < rgb(last["--leaf-ink"])[3], `ink no fainter at ${age}`);
    assert.ok(Number(now["--leaf-foxing"]) > Number(last["--leaf-foxing"]), `no more foxing at ${age}`);
    last = now;
  }
  assert.deepEqual(paperAt(3), paperAt(1));
  assert.deepEqual(paperAt(-1), paperAt(0));
  assert.deepEqual(paperAt(Number.NaN), paperAt(0));
  assert.equal(ageWord(0), "fresh paper");
  assert.equal(ageWord(1), "old and foxed");
});

test("dates print in UTC without the visitor's locale, so server and client agree", () => {
  assert.equal(stamp("2026-10-26T11:17:18Z"), "26 Oct 2026, 11:17 UTC");
  assert.equal(stamp("2026-01-02T03:04:05+09:00"), "1 Jan 2026, 18:04 UTC");
  assert.equal(stamp("nonsense"), "nonsense");
});

test("a screen reader hears each position as its commit's date and subject, where it stands and how old it is", () => {
  const { leaves } = replay(HISTORY);
  const newest = leaves.length - 1;
  const text = valueText(leaves, newest);
  assert.ok(text.startsWith(`${stamp(leaves[newest].date)}: ${leaves[newest].subject}.`), text);
  assert.match(text, new RegExp(`Commit ${leaves.length} of ${leaves.length}, fresh paper\\.$`));
  assert.match(valueText(leaves, 0), /Commit 1 of \d+, old and foxed\.$/);
  assert.equal(valueText([], 0), "No changelog");
});

test("reduced motion opens the box without smoke and at once; otherwise the smoke clears within two seconds", () => {
  assert.deepEqual(opening(true), { smoke: false, ms: 0 });
  assert.deepEqual(opening(false), { smoke: true, ms: SMOKE_MS });
  assert.ok(SMOKE_MS > 0 && SMOKE_MS <= 2000);
  const css = readFileSync(join(ROOT, "app/(ryugu)/ryugu.css"), "utf8");
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^@]*\.smoke \{\s*display: none;/);
});

test("the box says it is a changelog replay, scrubs with a native range input, and has an empty state", () => {
  assert.match(COMPONENT, /A changelog replay\./);
  assert.match(COMPONENT, /The site itself is not rebuilt as it was: only the paper ages\./);
  assert.match(COMPONENT, /type="range"/);
  assert.match(COMPONENT, /aria-valuetext=\{valueText\(leaves, position\)\}/);
  assert.match(COMPONENT, /aria-expanded=\{open\}/);
  assert.match(COMPONENT, /The box is empty: this build carries no changelog to replay\./);
  // negative control: the source checks can fail
  assert.doesNotMatch(COMPONENT, /snapshot of the site/i);
});
