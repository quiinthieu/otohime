// The pond's prints (lib/pond-print.ts): the background wash keeps --ink and --muted at 4.5:1 over the worst
// pigment on every paper the site paints (globals.css and each season in seasons.css), in both themes, and 20%
// fails (the negative control). pond.css washes with the tested number. A stored value that is not our JPEG parses
// to none, in parseStoredPrint and in the inline script alike, and a print is named and grained by its seed.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  MAX_STORED,
  MAX_WASH,
  PIGMENTS,
  PRINT_H,
  PRINT_W,
  STORAGE_KEY,
  WASH,
  contrast,
  grain,
  parseStoredPrint,
  pondPrintScript,
  printFrame,
  printName,
  printSeed,
  washed,
  worstContrast,
} from "./pond-print.ts";

const ROOT = resolve(import.meta.dirname, "..");
const MIN = 4.5;
const read = (path: string) => readFileSync(resolve(ROOT, path), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

type Pair = { light: string; dark: string };
function pairs(body: string): Record<string, Pair> {
  const out: Record<string, Pair> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*light-dark\(\s*(#[0-9a-f]+)\s*,\s*(#[0-9a-f]+)\s*\)\s*;/gi)) out[m[1]] = { light: m[2], dark: m[3] };
  return out;
}

const root = pairs(/:root\s*\{([^{}]*)\}/.exec(read("app/(site)/globals.css"))?.[1] ?? "");
const seasons = [...read("app/(site)/seasons.css").matchAll(/:root\[data-season="([a-z]+)"\]\s*\{([^{}]*)\}/g)].map((m) => ({ name: m[1], tints: pairs(m[2]) }));
// Every paper the body can wear, and the text that sits on it: a season tints --ink but not --muted.
const PAPERS = [{ name: "base", paper: root["--paper"], ink: root["--ink"] }, ...seasons.map((s) => ({ name: s.name, paper: s.tints["--paper"], ink: s.tints["--ink"] }))];
const SCHEMES = ["light", "dark"] as const;

function worstOnSite(wash: number) {
  let worst = { ratio: Infinity, where: "" };
  for (const p of PAPERS) {
    for (const scheme of SCHEMES) {
      for (const [role, text] of [["ink", p.ink[scheme]], ["muted", root["--muted"][scheme]]] as const) {
        const w = worstContrast(text, p.paper[scheme], wash);
        if (w.ratio < worst.ratio) worst = { ratio: w.ratio, where: `${role} on ${p.name} ${scheme} paper over ${w.pigment}` };
      }
    }
  }
  return worst;
}

test("the palette is read: base and four seasons, each with paper and ink in both themes", () => {
  assert.ok(root["--paper"] && root["--ink"] && root["--muted"], "globals.css :root pairs");
  assert.equal(seasons.length, 4);
  for (const p of PAPERS) assert.ok(p.paper?.light && p.paper?.dark && p.ink?.light && p.ink?.dark, p.name);
});

test("the pigments are the pond's own water and inks", () => {
  const src = readFileSync(resolve(ROOT, "components/pond-static.tsx"), "utf8");
  const water = /export const WATER = "(#[0-9a-f]{6})"/i.exec(src)?.[1];
  const body = /export const INK_HEX[^{]*\{([^}]*)\}/.exec(src)?.[1] ?? "";
  const inks = [...body.matchAll(/"(#[0-9a-f]{6})"/gi)].map((m) => m[1].toLowerCase());
  const all = new Set([water!.toLowerCase(), ...inks]);
  assert.deepEqual([...all].sort(), [...PIGMENTS].sort());
});

test("the wash maths composite paper over pigment in sRGB", () => {
  assert.deepEqual(washed("#ffffff", "#000000", 0), [255, 255, 255]);
  assert.deepEqual(washed("#ffffff", "#000000", 1), [0, 0, 0]);
  assert.deepEqual(washed("#ffffff", "#000000", 0.5), [127.5, 127.5, 127.5]);
  assert.equal(contrast("#000", "#fff"), 21);
  assert.equal(contrast("#231e16", "#f2efe7").toFixed(1), "14.4");
});

test(`at WASH (${WASH * 100}%, at most ${MAX_WASH * 100}%) the worst pigment keeps --ink and --muted at ${MIN}:1 on every paper`, () => {
  assert.ok(WASH > 0 && WASH <= MAX_WASH);
  const w = worstOnSite(WASH);
  assert.ok(w.ratio >= MIN, `${w.ratio.toFixed(2)}:1 for ${w.where}`);
  // and on the base paper the contract's ceiling itself still holds
  for (const scheme of SCHEMES) {
    for (const text of [root["--ink"][scheme], root["--muted"][scheme]]) {
      assert.ok(worstContrast(text, root["--paper"][scheme], MAX_WASH).ratio >= MIN, `${text} on base ${scheme} at ${MAX_WASH}`);
    }
  }
});

test("negative control: a 20% wash sinks --muted under 4.5:1, in both themes", () => {
  assert.ok(worstOnSite(0.2).ratio < MIN);
  for (const scheme of SCHEMES) {
    const w = worstContrast(root["--muted"][scheme], root["--paper"][scheme], 0.2);
    assert.ok(w.ratio < MIN, `${scheme}: ${w.ratio.toFixed(2)}`);
  }
});

test("pond.css washes the page with the tested number", () => {
  const css = read("app/(site)/pond.css");
  const wash = /--pond-wash:\s*([\d.]+)%/.exec(css)?.[1];
  assert.equal(Number(wash) / 100, WASH);
  assert.match(css, /color-mix\(in srgb, var\(--paper\) calc\(100% - var\(--pond-wash\)\), transparent\)/);
  assert.match(css, /background-image: linear-gradient\(var\(--pond-veil\), var\(--pond-veil\)\), var\(--pond-print, none\)/);
});

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
const BAD: unknown[] = [
  null,
  undefined,
  "",
  42,
  "{}",
  "not a print",
  "data:image/png;base64,iVBORw0KGgo=",
  "data:image/jpeg;base64,",
  "data:image/jpeg;base64,abc def",
  'data:image/jpeg;base64,abc")}body{color:red',
  `data:image/jpeg;base64,${"A".repeat(MAX_STORED)}`,
];

test("a stored print parses only as a JPEG data URL; anything else is none", () => {
  assert.equal(parseStoredPrint(JPEG), JPEG);
  for (const v of BAD) assert.equal(parseStoredPrint(v), null, String(v).slice(0, 40));
});

// The inline script against a fake page: it sets --pond-print for our JPEG and nothing for the rest, and a
// localStorage that throws (blocked storage) is swallowed.
function runScript(stored: unknown, throws = false) {
  const props = new Map<string, string>();
  const localStorage = {
    getItem(k: string) {
      if (throws) throw new Error("SecurityError");
      return k === STORAGE_KEY ? stored : null;
    },
  };
  const document = { documentElement: { style: { setProperty: (k: string, v: string) => props.set(k, v) } } };
  new Function("localStorage", "document", pondPrintScript)(localStorage, document);
  return props;
}

test("the head script sets --pond-print from storage, and bad or blocked storage sets nothing", () => {
  assert.deepEqual([...runScript(JPEG)], [["--pond-print", `url("${JPEG}")`]]);
  for (const v of BAD) assert.equal(runScript(v).size, 0, String(v).slice(0, 40));
  assert.equal(runScript(JPEG, true).size, 0);
});

test("a print is named by its seed, and the seed follows the rings", () => {
  const a = { drops: [{ ink: "sumi", pts: [1, 2, 3, 4, 5, 6] }] };
  const b = { drops: [{ ink: "coral", pts: [1, 2, 3, 4, 5, 6] }] };
  const c = { drops: [{ ink: "sumi", pts: [1, 2, 3, 4, 5, 6.5] }] };
  assert.match(printSeed(a), /^[0-9a-f]{8}$/);
  assert.equal(printSeed(a), printSeed({ drops: [{ ink: "sumi", pts: [1, 2, 3, 4, 5, 6] }] }));
  assert.notEqual(printSeed(a), printSeed(b));
  assert.notEqual(printSeed(a), printSeed(c));
  assert.equal(printName(printSeed(a)), `suminagashi-${printSeed(a)}.png`);
});

test("the 2400x1800 sheet covers the 600x400 pond's middle, cropping its sides", () => {
  assert.deepEqual([PRINT_W, PRINT_H], [2400, 1800]);
  const f = printFrame(600, 400, PRINT_W, PRINT_H);
  assert.equal(f.s, 4.5);
  assert.equal(f.oy, 0);
  assert.ok(Math.abs((600 - 2 * f.ox) * f.s - PRINT_W) < 1e-9);
});

test("the grain is seeded: the same seed lays the same specks, another seed others, all on the sheet", () => {
  const a = grain("0badf00d", 240, 180);
  assert.equal(a.length, 108);
  assert.deepEqual(a, grain("0badf00d", 240, 180));
  assert.notDeepEqual(a, grain("12345678", 240, 180));
  for (const s of a) assert.ok(s.x >= 0 && s.x < 240 && s.y >= 0 && s.y < 180 && s.alpha > 0 && s.alpha <= 0.15);
});
