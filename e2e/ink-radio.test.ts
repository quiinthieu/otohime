// Ink Radio over HTTP, against a running production server: what /music serves before any script runs, and
// where the stations live. The served page holds only the slot, the credit and no audio; the 240 stations
// ship in a chunk of their own that the page's scripts load on demand, never in the page or its first
// scripts. What the set does in a browser (play, stop, no signal, the Television, keys, drag, reduced
// motion) is scripts/probe-ink-radio.sh.
//   BASE_URL  the server (default http://localhost:4000)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { before, test } from "node:test";
import type { Snapshot } from "../app/(site)/(app)/music/_lib/tuning.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const snapshot: Snapshot = JSON.parse(
  readFileSync(join(import.meta.dirname, "../app/(site)/(app)/music/_lib/stations.json"), "utf8"),
);
// A handful of streams spread through the snapshot: none may be in the page, all are in the radio's chunk.
const SAMPLE = snapshot.stations.filter((_, i) => i % 40 === 0).map((s) => s.url);

async function text(path: string): Promise<string> {
  const res = await fetch(`${BASE}${path}`);
  assert.equal(res.status, 200, `${path}: status ${res.status}`);
  return res.text();
}

const scriptsOf = (html: string) => [...new Set([...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]))];
const chunkRefs = (js: string) => [
  ...new Set([...js.matchAll(/static\/chunks\/[\w.-]+\.js/g)].map((m) => `/_next/${m[0]}`)),
];

let html = "";
let first = new Map<string, string>();

before(async () => {
  html = await text("/music");
  first = new Map(await Promise.all(scriptsOf(html).map(async (src) => [src, await text(src)] as const)));
});

test("/music serves the radio's slot under its heading, with the snapshot's credit", () => {
  // Riso headings wrap their plain source and add aria-hidden visual plates.
  // Bound the match to this heading so a label elsewhere cannot satisfy it.
  const heading = /<section aria-labelledby="ink-radio"[^>]*>\s*<h2 id="ink-radio"[^>]*>([\s\S]*?)<\/h2>/.exec(html)?.[1] ?? "";
  assert.match(heading, /(?:^|>)Ink Radio(?:<|$)/);
  assert.match(html, /data-radio="slot"[^>]*>\s*<p class="readout" data-radio="waiting">Warming up the valves…<\/p>/);
  const credit = /<p[^>]*data-radio="credit"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
  assert.ok(credit, "the credit is in the served page");
  assert.match(credit, new RegExp(`^${snapshot.stations.length}<!-- --> stations from`));
  assert.match(credit, /href="https:\/\/www\.radio-browser\.info"/);
  assert.match(
    credit,
    new RegExp(`<time dateTime="${snapshot.retrieved}">${snapshot.retrieved.slice(0, 10)}</time>`, "i"),
  );
  const listings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)]
    .find((h) => /(?:^|>)Listings(?:<|$)/.test(h[1]))?.index ?? -1;
  assert.ok(
    listings > html.indexOf('aria-label="Television"') && html.indexOf('id="ink-radio"') > listings,
    "the radio comes after the Television and its listings",
  );
});

test("the served page plays nothing: no audio element, no autoplay, no stream", () => {
  assert.doesNotMatch(html, /<audio\b/);
  assert.doesNotMatch(html, /\bautoplay\b/i);
  for (const url of SAMPLE) assert.ok(!html.includes(url), `${url} is not in the page`);
  assert.ok(!html.includes(snapshot.stations[0].id), "no station id is in the page");
});

test("the stations are lazy: not in the page's first scripts, but in a chunk those scripts load", async () => {
  assert.ok(first.size > 0, "the page loads scripts");
  for (const [src, js] of first) {
    for (const url of SAMPLE) assert.ok(!js.includes(url), `${src} carries ${url}`);
  }
  const later = [...new Set([...first.values()].flatMap(chunkRefs))].filter((src) => !first.has(src));
  assert.ok(later.length > 0, "the first scripts name chunks to load later");
  const lazy: string[] = [];
  for (const src of later) {
    const js = await text(src);
    if (SAMPLE.every((url) => js.includes(url))) lazy.push(src);
  }
  assert.equal(lazy.length, 1, `exactly one on-demand chunk holds the stations: ${lazy.join(", ")}`);
  const js = await text(lazy[0]);
  for (const s of snapshot.stations) assert.ok(js.includes(s.url), `${s.name}'s stream is in the radio's chunk`);
  assert.doesNotMatch(js, /http:\/\/[^"']*\.(?:mp3|aac)\b/, "no plain-http stream rides along");
});

test("negative control: the Television is unchanged and other pages carry no radio", async () => {
  assert.match(html, /aria-label="Television"/);
  assert.match(html, /CH 01/);
  for (const path of ["/", "/projects", "/notes"]) {
    const page = await text(path);
    assert.ok(!page.includes('data-radio="slot"'), `${path} has no radio slot`);
    for (const url of SAMPLE.slice(0, 2)) assert.ok(!page.includes(url), `${path} names no stream`);
  }
});
