// "Right here" must be true of this repo: every pin in siblings.ts is read
// back from the real stylesheet, as text, the way lib/motion.test.ts reads
// them. A sister that changes its sheet, or a new project, fails here with
// the value to re-pin (see the README's Design system section).
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { FACES, type Face } from "./board.ts";
import { cornerFor, CREAMS, DRESSES, dress, INK_COUNT, PAPER_COUNT, SIBLINGS } from "./siblings.ts";

const ROOT = resolve(import.meta.dirname, "../../..");
const SELF = "(design-system)";

const read = (file: string) => readFileSync(join(ROOT, file), "utf8");
const css = (file: string) => read(file).replace(/\/\*[\s\S]*?\*\//g, "");

// A custom property declared anywhere: --name followed by a colon, not part of a longer name.
const DECLARED = /(?<![\w-])(--[\w-]+)\s*:/g;
const declared = (text: string) => new Set([...text.matchAll(DECLARED)].map((m) => m[1]));

// The first declaration of a property, its value up to the semicolon.
function first(text: string, name: string): string | null {
  const m = new RegExp(`(?<![\\w-])${name}\\s*:\\s*([^;]+);`).exec(text);
  return m ? m[1].trim() : null;
}
const firstHex = (value: string | null) => (value ? (/#[0-9a-f]{6}\b/i.exec(value)?.[0].toLowerCase() ?? null) : null);

// The generic family that ends the stack :root sets as font-family, following var(--x, fallback).
function rootFace(text: string): Face | null {
  const root = /:root\s*\{([^}]*)\}/.exec(text)?.[1] ?? "";
  const expand = (value: string, depth = 0): string =>
    depth > 8
      ? value
      : value.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g, (_, name: string, fallback?: string) => {
          const own = first(text, name);
          return expand(own ?? fallback ?? "", depth + 1);
        });
  const stack = first(root, "font-family");
  if (!stack) return null;
  const families = expand(stack)
    .split(",")
    .map((f) => f.trim().replace(/^["']|["']$/g, ""));
  return ([...families].reverse().find((f) => (FACES as readonly string[]).includes(f)) as Face | undefined) ?? null;
}

// The site's season tints: imported by its layout beside globals.css, they re-tint the site's own paper and ink
// under data-season. The house pin stays the root sheet's, so they are not a sister stylesheet of their own.
const TINTS = ["app/(site)/seasons.css"];

// The root stylesheet of every route group but this one: each top-level sheet its layout.tsx imports. A
// feature's own sheet imported further down (the site's peeks.css) names no paper or ink of its own.
const IMPORTED = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== SELF)
  .flatMap((e) => {
    const layout = join(ROOT, "app", e.name, "layout.tsx");
    const imported = existsSync(layout) ? readFileSync(layout, "utf8") : "";
    return readdirSync(join(ROOT, "app", e.name))
      .filter((f) => f.endsWith(".css") && imported.includes(`import "./${f}";`))
      .map((f) => `app/${e.name}/${f}`);
  })
  .sort();
const SHEETS = IMPORTED.filter((f) => !TINTS.includes(f));

test("the season tints are imported by the site layout and re-tint only the site's own paper and ink", () => {
  for (const file of TINTS) assert.ok(IMPORTED.includes(file), `${file} is no longer imported: drop it from TINTS`);
  const site = SIBLINGS.find((s) => s.group === "site")!;
  assert.equal(site.file, "app/(site)/globals.css");
  const house = declared(css(site.file));
  const tinted = declared(css("app/(site)/seasons.css"));
  assert.deepEqual([...tinted].sort(), ["--ink", "--paper", "--paper-2"]);
  for (const name of tinted) assert.ok(house.has(name), `seasons.css tints ${name}, which globals.css never declares`);
  // The house paper the page quotes is still the root sheet's first --paper, untinted.
  assert.equal(firstHex(first(css(site.file), "--paper")), site.paper);
});

test("eleven sister stylesheets: the site's and ten projects', never this group's own", () => {
  assert.equal(SIBLINGS.length, 11);
  assert.equal(new Set(SIBLINGS.map((s) => s.group)).size, 11);
  assert.ok(!SIBLINGS.some((s) => s.file.includes(SELF)));
  for (const s of SIBLINGS) {
    assert.ok(existsSync(join(ROOT, s.file)), `${s.file} is pinned but gone: drop its row`);
    assert.equal(s.file.split("/")[1], `(${s.group})`, s.file);
  }
});

test("every group stylesheet under app/ is pinned", () => {
  const pinned = new Set(SIBLINGS.map((s) => s.file));
  for (const file of SHEETS) {
    const c = css(file);
    const paper = first(c, "--paper");
    assert.ok(
      pinned.has(file),
      `${file} is not pinned: add { group: "${file.split("/")[1].slice(1, -1)}", file: "${file}", paper: ${JSON.stringify(firstHex(paper))}, ink: ${JSON.stringify(firstHex(first(c, "--ink")))}, decisions: ${declared(c).size}, hasPaper: ${paper !== null}, hasInk: ${first(c, "--ink") !== null} }`,
    );
  }
  assert.deepEqual([...pinned].sort(), SHEETS);
});

for (const s of SIBLINGS) {
  test(`${s.group}: paper ${s.paper}, ink ${s.ink}, ${s.decisions} named decisions`, () => {
    const c = css(s.file);
    const paper = first(c, "--paper");
    const ink = first(c, "--ink");
    assert.equal(paper !== null, s.hasPaper, `${s.file}: re-pin hasPaper to ${paper !== null}`);
    assert.equal(ink !== null, s.hasInk, `${s.file}: re-pin hasInk to ${ink !== null}`);
    assert.equal(firstHex(paper), s.paper, `${s.file}: re-pin paper to ${JSON.stringify(firstHex(paper))}`);
    assert.equal(firstHex(ink), s.ink, `${s.file}: re-pin ink to ${JSON.stringify(firstHex(ink))}`);
    assert.equal(declared(c).size, s.decisions, `${s.file}: re-pin decisions to ${declared(c).size}`);
  });
}

test("the counts the page quotes are what the files give: 10 name a paper, 11 an ink, 8 creams", () => {
  const files = SHEETS.map(css);
  const papers = files.map((c) => firstHex(first(c, "--paper")));
  assert.equal(PAPER_COUNT, files.filter((c) => first(c, "--paper") !== null).length);
  assert.equal(INK_COUNT, files.filter((c) => first(c, "--ink") !== null).length);
  assert.equal(CREAMS, new Set(papers.filter((p) => p !== null)).size);
  assert.deepEqual([PAPER_COUNT, INK_COUNT, CREAMS], [10, 11, 8]);
});

test("six dresses, named for pinned groups", () => {
  assert.deepEqual(
    DRESSES.map((d) => [d.group, d.dress.name]),
    [
      ["shore", "Shore"],
      ["capsule", "Capsule"],
      ["orrery", "Orrery"],
      ["elements", "Elements"],
      ["articles", "Gazette"],
      ["structures", "Structures"],
    ],
  );
  const groups = new Set(SIBLINGS.map((s) => s.group));
  for (const d of DRESSES) assert.ok(groups.has(d.group));
});

for (const d of DRESSES) {
  test(`dress ${d.dress.name}: spot ${d.dress.spot}, corner ${d.dress.radius}px, ${d.dress.face}, from the files`, () => {
    assert.ok(d.dress.spotFrom.startsWith(`app/(${d.group})/`), `${d.dress.spotFrom} is ${d.group}'s own`);
    assert.ok(read(d.dress.spotFrom).toLowerCase().includes(d.dress.spot), `${d.dress.spotFrom} no longer paints ${d.dress.spot}: re-pin the spot`);
    const c = css(d.file);
    assert.match(c, new RegExp(`radius\\s*:\\s*${d.dress.radius}px\\b`), `${d.file} has no ${d.dress.radius}px corner: re-pin the radius`);
    const face = rootFace(c);
    assert.equal(face, d.dress.face, `${d.file}: re-pin face to ${JSON.stringify(face)}`);
    assert.deepEqual(dress(d.group), { paper: d.paper, ink: d.ink, spot: d.dress.spot, corner: cornerFor(d.dress.radius), face: d.dress.face });
  });
}

test("the dresses use all three corners", () => {
  assert.deepEqual(new Set(DRESSES.map((d) => cornerFor(d.dress.radius))), new Set(["sharp", "soft", "round"]));
});

test("cornerFor: 0-3 sharp, 4-9 soft, 10 and up round", () => {
  for (const [px, corner] of [
    [0, "sharp"],
    [3, "sharp"],
    [4, "soft"],
    [9, "soft"],
    [10, "round"],
    [999, "round"],
  ] as const)
    assert.equal(cornerFor(px), corner, String(px));
});

test("the readers find what they should", () => {
  const text = ":root { --paper: light-dark(#F2EFE7, #1c1915); --x-ink: #000000; --ink: #231e16; font-family: var(--body, var(--serif)); --serif: Georgia, serif; }\n.tint { --cat: red; }\na { color: var(--ink); }";
  assert.equal(firstHex(first(text, "--paper")), "#f2efe7");
  assert.equal(firstHex(first(text, "--ink")), "#231e16");
  assert.equal(first(text, "--bg"), null);
  assert.deepEqual([...declared(text)].sort(), ["--cat", "--ink", "--paper", "--serif", "--x-ink"]);
  assert.equal(rootFace(text), "serif");
  assert.equal(rootFace(":root { font-family: ui-sans-serif, Arial, sans-serif; }"), "sans-serif");
  assert.equal(rootFace("body { color: red; }"), null);
});
