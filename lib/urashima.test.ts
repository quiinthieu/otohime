// The three ways down to Ryugu-jo: typing "urashima" (the matcher here, its listener in components/urashima-keys.tsx),
// the Pocket console's Dive chip and the waterline under the site's footer. The wiring is read from the files as
// text, the way lib/motion.test.ts reads them; e2e/ryugu.test.ts walks all three in a browser.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { site } from "../content/site.ts";
import { IGNORED, PALACE_HREF, SECRET, TAKE_FROM, urashimaStep } from "./urashima.ts";

const ROOT = resolve(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
// The JSX of a file, comments stripped.
const jsx = (p: string) => read(p).replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

function type(keys: string[], from = 0) {
  let progress = from;
  return keys.map((key) => {
    const step = urashimaStep(progress, key);
    progress = step.progress;
    return step;
  });
}

test("the word is urashima and it leads to /ryugu, a page the palace's root layout serves", () => {
  assert.equal(SECRET, "urashima");
  assert.equal(PALACE_HREF, "/ryugu");
  assert.ok(existsSync(join(ROOT, "app/(ryugu)/ryugu/page.tsx")));
  assert.ok(existsSync(join(ROOT, "app/(ryugu)/layout.tsx")));
});

test("typing the word completes on its last letter, and only there", () => {
  const steps = type([..."urashima"]);
  assert.deepEqual(
    steps.map((s) => s.done),
    [false, false, false, false, false, false, false, true],
  );
  assert.equal(steps.at(-1)!.progress, 0, "the word starts over once done");
});

test("from the third letter on, every key that keeps the word going is taken, so the console never sees the a's", () => {
  const steps = type([..."urashima"]);
  assert.deepEqual(
    steps.map((s) => s.take),
    [false, false, true, true, true, true, true, true],
  );
  assert.equal(TAKE_FROM, 2);
  // the word's a's are both taken
  for (const i of [2, 7]) assert.equal(SECRET[i], "a");
});

test("a lone a, or u then a, is never taken: the console's A still opens its page", () => {
  assert.equal(urashimaStep(0, "a").take, false);
  const [u, a] = type(["u", "a"]);
  assert.equal(u.take, false);
  assert.equal(a.take, false);
  assert.equal(a.progress, 0);
});

test("a wrong key starts the word again, counting itself if it is a u", () => {
  assert.equal(type([..."urx"]).at(-1)!.progress, 0);
  assert.equal(type([..."uru"]).at(-1)!.progress, 1);
  assert.equal(type([..."uurashima"]).at(-1)!.done, true);
  assert.equal(type([..."urashimx"]).some((s) => s.done), false);
  // a key that is not one character breaks the word
  assert.equal(type(["u", "r", "ArrowDown", "a"]).some((s) => s.take), false);
});

test("case is ignored, and nonsense progress is treated as none", () => {
  assert.equal(type([..."URASHIMA"]).at(-1)!.done, true);
  assert.equal(urashimaStep(99, "u").progress, 1);
  assert.equal(urashimaStep(-3, "u").progress, 1);
  assert.ok(IGNORED.has("Shift"));
});

test("the listener: capture phase on window, skips fields, dialogs, modifiers and handled keys, and loads the palace", () => {
  const src = read("components/urashima-keys.tsx");
  assert.match(src, /^"use client";/);
  assert.match(src, /addEventListener\("keydown", onKey, true\)/);
  assert.match(src, /removeEventListener\("keydown", onKey, true\)/);
  assert.match(src, /event\.defaultPrevented \|\| event\.repeat/);
  assert.match(src, /event\.metaKey \|\| event\.ctrlKey \|\| event\.altKey/);
  assert.match(src, /closest\("input, textarea, select, dialog\[open\]/);
  assert.match(src, /if \(step\.take\) event\.preventDefault\(\);/);
  // a full load: the palace is another root layout
  assert.match(src, /location\.assign\(PALACE_HREF\)/);
});

test("the site root layout mounts the listener once, ahead of the pages, so it runs before the console's", () => {
  const layout = jsx("app/(site)/layout.tsx");
  assert.match(layout, /^import \{ UrashimaKeys \} from "@\/components\/urashima-keys";$/m);
  assert.equal(layout.match(/<UrashimaKeys \/>/g)?.length, 1);
  assert.ok(layout.indexOf("<UrashimaKeys />") < layout.indexOf("{children}"));
  // The console's own key listener is also capture phase on window, and gives way to keys already handled.
  const handheld = read("components/handheld.tsx");
  assert.match(handheld, /window\.addEventListener\("keydown", listener, \{ capture: true \}\)/);
  assert.match(handheld, /event\.defaultPrevented\) return;/);
});

test("Pocket: the console's menu carries a Dive chip, a plain link to the palace", () => {
  const src = read("components/handheld.tsx");
  assert.match(src, /^import \{ PALACE_HREF \} from "@\/lib\/urashima";$/m);
  assert.match(src, /<a href=\{PALACE_HREF\} className="chip" data-pocket-ryugu="">\s*\{P\.dive\}\s*<\/a>/);
  assert.equal(site.pocket.dive, "▽ Dive");
});

test("the waterline: the last thing in the site's footer, below its bar, links down to the palace", () => {
  const src = jsx("components/end-footer.tsx");
  assert.match(src, /^import \{ PALACE_HREF \} from "@\/lib\/urashima";$/m);
  const bar = src.indexOf('<div className="end-bar">');
  const line = src.indexOf('<div className="end-waterline" data-end-waterline="">');
  assert.ok(bar !== -1 && line > bar, "the waterline is not below the bar");
  assert.match(src.slice(line), /^<div className="end-waterline" data-end-waterline="">[\s\S]*<a href=\{PALACE_HREF\} data-end-ryugu=""[^>]*>\s*\{site\.end\.below\}\s*<\/a>[\s\S]*<\/div>\s*<\/footer>/);
  assert.match(site.end.below, /waterline/i);
  const css = read("app/(site)/globals.css");
  for (const sel of [".end-waterline", ".end-wave", ".end-deep", ".end-ryugu-link"]) assert.ok(css.includes(`${sel} {`), sel);
});
