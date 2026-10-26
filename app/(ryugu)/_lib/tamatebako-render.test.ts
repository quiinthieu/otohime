// The Tamatebako as React renders it, not only its source text: _components/tamatebako.tsx is compiled with the
// repo's TypeScript, its one local import pointed at ./tamatebako.ts, and rendered with react-dom/server. The real
// content/history.json renders a range scrubber over every commit, labelled a changelog replay, and no empty box; an
// empty index renders the empty box and no scrubber. Each is the other's negative control.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { createElement, type FC } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { EMPTY_REPLAY, replay, stamp, valueText, type Replay } from "./tamatebako.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const SOURCE = readFileSync(join(ROOT, "app/(ryugu)/_components/tamatebako.tsx"), "utf8");
const HISTORY = JSON.parse(readFileSync(join(ROOT, "content/history.json"), "utf8"));

const LOCAL = '"../_lib/tamatebako"';
assert.ok(SOURCE.includes(LOCAL), "the component's lib import moved; update this test");
const js = ts.transpileModule(SOURCE, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const resolved = (spec: string) => JSON.stringify(import.meta.resolve(spec));
const out = js
  .replace(LOCAL, JSON.stringify(pathToFileURL(join(import.meta.dirname, "tamatebako.ts")).href))
  .replace(/(["'])react\/jsx-runtime\1/, resolved("react/jsx-runtime"))
  .replace(/(["'])react\1/, resolved("react"));
const dir = mkdtempSync(join(tmpdir(), "tamatebako-"));
after(() => rmSync(dir, { recursive: true, force: true }));
writeFileSync(join(dir, "tamatebako.mjs"), out);
const { Tamatebako } = (await import(pathToFileURL(join(dir, "tamatebako.mjs")).href)) as { Tamatebako: FC<{ replay: Replay }> };

const render = (r: Replay) => renderToStaticMarkup(createElement(Tamatebako, { replay: r }));
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const attr = (html: string, name: string) => {
  const m = html.match(new RegExp(`<input[^>]*\\b${name}="([^"]*)"`));
  return m ? unescape(m[1]) : null;
};

test("the real changelog renders a shut box over a range scrubber at the newest commit, on fresh paper", () => {
  const r = replay(HISTORY);
  assert.ok(r.leaves.length > 1, "the committed index has commits");
  const html = render(r);
  const newest = r.leaves.at(-1)!;
  assert.match(html, /<button[^>]*aria-expanded="false"[^>]*>[\s\S]*Open the Tamatebako/);
  assert.match(html, /class="replay" hidden=""/, "the replay is shut in the box until it is opened");
  assert.match(html, /<strong>A changelog replay\.<\/strong>/);
  assert.match(html, /not rebuilt as it was/);
  assert.equal(attr(html, "type"), "range");
  assert.equal(attr(html, "min"), "0");
  assert.equal(attr(html, "max"), String(r.leaves.length - 1));
  assert.equal(attr(html, "value"), String(r.leaves.length - 1));
  assert.equal(attr(html, "aria-valuetext"), valueText(r.leaves, r.leaves.length - 1));
  assert.match(html, new RegExp(`<label[^>]*for="${attr(html, "id")}"[^>]*>Scrub back through the changelog</label>`));
  assert.match(html, /<article class="leaf" data-age="0\.000" style="--leaf-paper:rgb\(242, 239, 231\)/);
  assert.ok(html.includes(`<time dateTime="${newest.date}">${stamp(newest.date)}</time>`), "the newest commit's date");
  assert.ok(unescape(html).includes(newest.subject), "the newest commit's subject");
  assert.ok(html.includes(`<code>${newest.sha}</code>`));
  assert.ok(!html.includes("The box is empty"), "negative control: a full index is no empty box");
});

test("an empty history renders the empty box, with no scrubber and no leaf", () => {
  for (const r of [EMPTY_REPLAY, replay({ version: 1, head: null, total: 0, entries: [] }), replay(null)]) {
    const html = render(r);
    assert.match(html, /<p class="leaf leaf-empty"[^>]*>The box is empty: this build carries no changelog to replay\.<\/p>/);
    assert.match(html, /<strong>A changelog replay\.<\/strong>/);
    assert.match(html, /Open the Tamatebako/, "the box itself still opens");
    assert.equal(attr(html, "type"), null, "negative control: no scrubber over nothing");
    assert.doesNotMatch(html, /<article|<time|role="slider"/);
  }
});
