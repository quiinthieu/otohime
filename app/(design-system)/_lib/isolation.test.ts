// Design system owes nothing to the site or another project (the groups are
// read from app/), and none of them owes anything to Design system: the
// "Right here" pins are data, and only siblings.test.ts reads the sister
// sheets, as text. _lib/ stays free of React and Next and reads no files;
// only ink.ts and stamps.ts may import roughjs, and scenes.ts (which the
// island will import) reaches neither, even through another file; the
// figures reach the engine only through _lib/; there is exactly one client
// file (the use client directive), _components/board-app.tsx, which imports
// only React, board.ts, contrast.ts, scenes.ts and siblings.ts and reaches no
// ink, stamps, kit, figures or roughjs; only layout.tsx reads process.env;
// and _lib/ makes no network call, keeps no storage, rolls no dice and reads
// no clock, so every turn replays the same. Modelled on
// app/(structures)/_lib/isolation.test.ts, not shared with it.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "../../..");
const SOURCE = /\.(?:[cm]?[jt]sx?|css)$/;

function filesUnder(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    if (e.name === "node_modules" || e.name === ".next") return [];
    const path = join(dir, e.name);
    return e.isDirectory() ? filesUnder(path) : SOURCE.test(e.name) ? [path] : [];
  });
}

function specifiers(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const found = [...text.matchAll(/(?:\bfrom|\bimport|\brequire|@import)\s*\(?\s*["'`]([^"'`]+)["'`]/g)];
  return found.map((m) => m[1]);
}

const under = (dir: string) => filesUnder(join(ROOT, dir));

const SELF = import.meta.filename;
const group = under("app/(design-system)").filter((f) => f !== SELF);
const lib = (name: string) => join(ROOT, "app/(design-system)/_lib", name);
const inLib = (f: string) => f.includes(`${sep}_lib${sep}`);
const isTest = (f: string) => /\.test\.ts$/.test(f);
const libCode = group.filter((f) => inLib(f) && !isTest(f));

const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(design-system)")
  .map((e) => e.name)
  .sort();
const OUTSIDE = ["components", "content", "lib", ...GROUPS.map((g) => join("app", g))].map((d) => join(ROOT, d));

// Anything that resolves into the site's or another project's code or styles, by alias or by ../
function reachesOutside(file: string, spec: string): string | null {
  if (/globals\.css/.test(spec)) return "globals.css";
  if (/^@?tailwindcss(\/|$)/.test(spec) || /^@tailwindcss\//.test(spec)) return "tailwindcss";
  if (spec === "@" || spec.startsWith("@/")) {
    if (!spec.startsWith("@/app/(design-system)/")) return spec.split("/").slice(0, 2).join("/");
  }
  for (const g of GROUPS) {
    const name = g.slice(1, -1);
    if (spec.startsWith(`@/app/${g}`) || new RegExp(`(^|/)${name}\\.css$`).test(spec)) return `app/${g}`;
  }
  if (spec.startsWith(".")) {
    const target = resolve(dirname(file), spec);
    const hit = OUTSIDE.find((d) => target === d || target.startsWith(d + sep));
    if (hit) return relative(ROOT, hit);
  }
  return null;
}

const REACT = /^(react|react-dom)(\/|$)/;
const NEXT = /^next(\/|$)/;
const ROUGH = /^roughjs(\/|$)/;
const NODE = /^(?:node:|fs$|fs\/|path$)/;
const FETCH = /\bfetch\s*\(/;
const STORAGE = /\b(?:localStorage|sessionStorage)\b/;
const DICE = /\bMath\.random\b/;
const CLOCK = /\bDate\b/;
const FILES = /\b(?:readFileSync|readFile|readdirSync|readdir)\b/;
const CLIENT = /^\s*["']use client["']/m;
const MAY_INK = new Set([lib("ink.ts"), lib("stamps.ts")]);

test("the scan finds Design system's files", () => {
  for (const name of [
    "board.ts",
    "contrast.ts",
    "siblings.ts",
    "copy.ts",
    "readability.ts",
    "words.ts",
    "ink.ts",
    "paper.ts",
    "kit.ts",
    "stamps.ts",
    "scenes.ts",
    "figures/box.ts",
    "figures/follow.ts",
    "figures/here.ts",
  ]) {
    assert.ok(group.some((f) => f === lib(name)), name);
  }
  for (const name of ["layout.tsx", "design-system.css", "design-system/page.tsx", "_components/board.tsx", "_components/board-app.tsx", "_components/chrome.tsx", "_components/figure.tsx"]) {
    assert.ok(group.includes(join(ROOT, "app/(design-system)", name)), name);
  }
  assert.ok(!libCode.some(isTest));
});

test("nothing under app/(design-system)/ imports the site, Tailwind or another project", () => {
  for (const file of group) {
    for (const spec of specifiers(file)) {
      const bad = reachesOutside(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("_lib/ imports no React and nothing from Next", () => {
  for (const file of group.filter(inLib)) {
    for (const spec of specifiers(file)) {
      assert.ok(!REACT.test(spec), `${relative(ROOT, file)} imports ${spec}`);
      assert.ok(!NEXT.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    }
  }
});

test("only ink.ts and stamps.ts may import roughjs", () => {
  for (const file of group.filter((f) => !MAY_INK.has(f) && !f.endsWith(".d.ts"))) {
    for (const spec of specifiers(file)) assert.ok(!ROUGH.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("_lib/ reads no files: the Right here pins are data, and only the tests read the sheets", () => {
  for (const file of libCode) {
    for (const spec of specifiers(file)) assert.ok(!NODE.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    assert.ok(!FILES.test(readFileSync(file, "utf8")), `${relative(ROOT, file)} reads files`);
  }
  assert.ok(specifiers(lib("siblings.test.ts")).includes("node:fs"), "and the check would see it");
});

test("_lib/ makes no network call, keeps no storage, rolls no dice and reads no clock", () => {
  for (const file of libCode) {
    const text = readFileSync(file, "utf8");
    assert.ok(!FETCH.test(text), `${relative(ROOT, file)} calls the network`);
    assert.ok(!STORAGE.test(text), `${relative(ROOT, file)} touches storage`);
    assert.ok(!DICE.test(text), `${relative(ROOT, file)} uses Math.random`);
    assert.ok(!CLOCK.test(text), `${relative(ROOT, file)} reads the clock`);
  }
});

// Every file a file reaches by relative imports, itself included.
function reach(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const spec of specifiers(file)) if (spec.startsWith(".")) reach(resolve(dirname(file), spec), seen);
  return seen;
}

test("scenes.ts reaches neither ink.ts nor stamps.ts, nor roughjs, even through another file", () => {
  const reached = [...reach(lib("scenes.ts"))].map((f) => relative(ROOT, f).replace(/\\/g, "/"));
  assert.ok(reached.includes("app/(design-system)/_lib/board.ts") && reached.includes("app/(design-system)/_lib/paper.ts"), "and the walk sees its imports");
  for (const file of reach(lib("scenes.ts"))) {
    assert.ok(!MAY_INK.has(file), `scenes.ts reaches ${relative(ROOT, file)}`);
    assert.ok(!/(^|\/)(kit|figures)(\.ts|\/|$)/.test(relative(ROOT, file).replace(/\\/g, "/")), `scenes.ts reaches ${relative(ROOT, file)}`);
    for (const spec of specifiers(file)) assert.ok(!ROUGH.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
  assert.ok([...reach(lib("stamps.ts"))].includes(lib("ink.ts")), "and the walk would see ink.ts");
});

test("the ink is drawn in ink.ts: it imports roughjs, and every other importer is stamps.ts", () => {
  const importers = libCode.filter((f) => !f.endsWith(".d.ts") && specifiers(f).some((s) => ROUGH.test(s)));
  assert.ok(importers.includes(lib("ink.ts")), "ink.ts draws with roughjs");
  for (const f of importers) assert.ok(MAY_INK.has(f), `${relative(ROOT, f)} imports roughjs`);
});

const ISLAND = join(ROOT, "app/(design-system)/_components/board-app.tsx");
const NO_INK = /(^|\/)(ink|stamps|kit|figures)(\.ts|\/|$)/;

// What the island may import: React, and the engine it plays (never the ink).
const ISLAND_IMPORTS = new Set(["react", "../_lib/board.ts", "../_lib/contrast.ts", "../_lib/scenes.ts", "../_lib/siblings.ts"]);

test("exactly one client file, _components/board-app.tsx, importing only React and the engine, reaching no ink", () => {
  const clients = group.filter((f) => CLIENT.test(readFileSync(f, "utf8")));
  assert.deepEqual(
    clients.map((f) => relative(ROOT, f)),
    [relative(ROOT, ISLAND)],
  );
  const specs = specifiers(ISLAND);
  assert.ok(specs.includes("react") && specs.includes("../_lib/board.ts"), "and the scan sees its imports");
  for (const spec of specs) assert.ok(ISLAND_IMPORTS.has(spec), `the island imports ${spec}`);
  for (const spec of specs) assert.ok(!ROUGH.test(spec) && !NO_INK.test(spec), `the island imports ${spec}`);
  for (const file of reach(ISLAND)) {
    assert.ok(!NO_INK.test(relative(ROOT, file).replace(/\\/g, "/")), `the island reaches ${relative(ROOT, file)}`);
    for (const spec of specifiers(file)) assert.ok(!ROUGH.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("only the server board inks the stamps, and the page, not the island, draws the figures", () => {
  const inkers = group.filter((f) => !inLib(f) && specifiers(f).some((s) => /(^|\/)stamps\.ts$/.test(s)));
  assert.deepEqual(inkers.map((f) => relative(ROOT, f)), ["app/(design-system)/_components/board.tsx"]);
  assert.match(readFileSync(join(ROOT, "app/(design-system)/design-system/page.tsx"), "utf8"), /export const ensureStatic = "navigation";/);
});

test("no <path> in the island's <defs> has both a fill and a rough stroke d", () => {
  const text = readFileSync(ISLAND, "utf8");
  const defsMatch = text.match(/<defs>([\s\S]*?)<\/defs>/);
  assert.ok(defsMatch, "defs block found in board-app.tsx");
  const paths = defsMatch[1].match(/<path[^>]*\/>/g) ?? [];
  assert.ok(paths.length > 0, "paths found in defs");
  for (const p of paths) {
    if (/strokeWidth/.test(p)) {
      assert.match(p, /fill="none"/, `stroke path must have fill="none": ${p}`);
    }
    if (/fill="currentColor"/.test(p)) {
      assert.match(p, /stroke="none"/, `fill path must have stroke="none": ${p}`);
    }
  }
});

test("only layout.tsx reads process.env", () => {
  const readers = group.filter((f) => /\bprocess\.env\b/.test(readFileSync(f, "utf8")));
  for (const f of readers) assert.equal(relative(ROOT, f), "app/(design-system)/layout.tsx");
});

test("the engine's imports stay inside _lib/: board reads siblings, contrast reads board, copy reads both", () => {
  assert.deepEqual(specifiers(lib("board.ts")), ["./siblings.ts"]);
  assert.deepEqual(specifiers(lib("siblings.ts")), ["./board.ts"]);
  assert.deepEqual(specifiers(lib("contrast.ts")), ["./board.ts"]);
  assert.deepEqual(specifiers(lib("copy.ts")).sort(), ["./board.ts", "./siblings.ts"]);
  assert.ok(/import type/.test(readFileSync(lib("siblings.ts"), "utf8")), "siblings.ts takes only types from board.ts");
});

test("nothing outside app/(design-system)/ imports Design system", () => {
  const others = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib"), ...under("content")];
  assert.ok(others.length > 10);
  assert.ok(others.some((f) => f.endsWith("structures.css")));
  for (const file of others) {
    for (const spec of specifiers(file)) {
      assert.ok(!/design-system\.css/.test(spec) && !/\(design-system\)/.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    }
  }
});

test("GROUPS is read from app/: the site and every other project, never Design system", () => {
  for (const g of ["(site)", "(shore)", "(capsule)", "(orrery)", "(elements)", "(vinyl)", "(rotor)", "(barometer)", "(articles)", "(structures)"]) {
    assert.ok(GROUPS.includes(g), g);
  }
  assert.ok(!GROUPS.includes("(design-system)"));
});

test("the checkers flag what they should", () => {
  const f = lib("x.ts");
  assert.equal(reachesOutside(f, "@/components/television"), "@/components");
  assert.equal(reachesOutside(f, "@/content/site"), "@/content");
  assert.equal(reachesOutside(f, "@/lib/songs"), "@/lib");
  assert.equal(reachesOutside(f, "tailwindcss"), "tailwindcss");
  assert.equal(reachesOutside(f, "../../(site)/globals.css"), "globals.css");
  assert.equal(reachesOutside(f, "../../../lib/songs"), "lib");
  assert.equal(reachesOutside(f, "../../(site)/layout"), join("app", "(site)"));
  assert.equal(reachesOutside(f, "@/app/(structures)/_lib/readability"), "@/app");
  assert.equal(reachesOutside(f, "../../(structures)/_lib/words.ts"), join("app", "(structures)"));
  assert.equal(reachesOutside(f, "../../(structures)/structures.css"), "app/(structures)");
  assert.equal(reachesOutside(f, "./board.ts"), null);
  assert.equal(reachesOutside(f, "../board.ts"), null);
  assert.equal(reachesOutside(f, "../design-system.css"), null);
  assert.equal(reachesOutside(f, "@/app/(design-system)/_lib/copy"), null);
  assert.equal(reachesOutside(f, "roughjs/bundled/rough.cjs.js"), null);
  assert.ok(REACT.test("react") && REACT.test("react-dom/client") && !REACT.test("reactive") && !REACT.test("next/cache"));
  assert.ok(NEXT.test("next/cache") && NEXT.test("next") && !NEXT.test("nextjs") && !NEXT.test("./next.ts"));
  assert.ok(ROUGH.test("roughjs") && ROUGH.test("roughjs/bin/core") && !ROUGH.test("roughly"));
  assert.ok(NODE.test("node:fs") && NODE.test("fs") && NODE.test("path") && !NODE.test("./fs.ts") && !NODE.test("pathname"));
  assert.ok(FETCH.test("await fet" + "ch(url)") && !FETCH.test("prefetch") && !FETCH.test("fetched"));
  assert.ok(STORAGE.test("local" + "Storage.getItem") && !STORAGE.test("storage"));
  assert.ok(DICE.test("Math." + "random()") && !DICE.test("Math.floor(x)"));
  assert.ok(CLOCK.test("new " + "Date()") && CLOCK.test("Da" + "te.now()") && !CLOCK.test("update") && !CLOCK.test("dated"));
  assert.ok(FILES.test("read" + "FileSync(x)") && !FILES.test("ready"));
  assert.ok(NO_INK.test("../_lib/stamps.ts") && NO_INK.test("../_lib/figures/box.ts") && NO_INK.test("../_lib/kit.ts"));
  assert.ok(!NO_INK.test("../_lib/board.ts") && !NO_INK.test("../_lib/scenes.ts") && !NO_INK.test("../_lib/think.ts"));
  assert.ok(CLIENT.test("'use cli" + "ent';\nimport x") && CLIENT.test('"use cli' + 'ent"') && !CLIENT.test("// says use client"));
});
