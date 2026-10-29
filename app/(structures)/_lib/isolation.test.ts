// Structures owes nothing to the site or another project (the groups are read
// from app/), and none of them owes anything to Structures. _lib/ stays free
// of React and Next; only ink.ts and stamps.ts may import roughjs, and
// scenes.ts (which the island will lay out every beat with) reaches neither,
// even through another file, so rough.js never reaches the browser; there is
// exactly one client file (the use client directive), _components/machine-app.tsx, which reaches no
// ink, stamps, kit, life, costs or roughjs; only layout.tsx reads process.env;
// and _lib/ makes no network call, keeps
// no storage, rolls no dice and reads no clock, so every move replays the
// same. This reads import specifiers and source text, so it is modelled on
// app/(rotor)/_lib/isolation.test.ts, not shared with it.
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
const group = under("app/(structures)").filter((f) => f !== SELF);
const lib = (name: string) => join(ROOT, "app/(structures)/_lib", name);
const inLib = (f: string) => f.includes(`${sep}_lib${sep}`);
const libCode = group.filter((f) => inLib(f) && !/\.test\.ts$/.test(f));

const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(structures)")
  .map((e) => e.name)
  .sort();
const OUTSIDE = ["components", "content", "lib", ...GROUPS.map((g) => join("app", g))].map((d) => join(ROOT, d));

// Anything that resolves into the site's or another project's code or styles, by alias or by ../
function reachesOutside(file: string, spec: string): string | null {
  if (/globals\.css/.test(spec)) return "globals.css";
  if (/^@?tailwindcss(\/|$)/.test(spec) || /^@tailwindcss\//.test(spec)) return "tailwindcss";
  if (spec === "@" || spec.startsWith("@/")) {
    if (!spec.startsWith("@/app/(structures)/")) return spec.split("/").slice(0, 2).join("/");
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
const FETCH = /\bfetch\s*\(/;
const STORAGE = /\b(?:localStorage|sessionStorage)\b/;
const DICE = /\bMath\.random\b/;
const CLOCK = /\bDate\b/;
const CLIENT = /^\s*["']use client["']/m;
const MAY_INK = new Set([lib("ink.ts"), lib("stamps.ts")]);

test("the scan finds Structures' files", () => {
  for (const name of [
    "machine.ts",
    "copy.ts",
    "readability.ts",
    "words.ts",
    "structures/index.ts",
    "structures/heap.ts",
    "ink.ts",
    "stamps.ts",
    "paper.ts",
    "scenes.ts",
    "kit.ts",
    "costs.ts",
    "life/index.ts",
    "life/graph.ts",
    "play.ts",
  ]) {
    assert.ok(group.some((f) => f === lib(name)), name);
  }
  assert.equal(libCode.filter((f) => f.includes(`${sep}structures${sep}`)).length, 9, "eight structures and their index");
  assert.ok(!libCode.some((f) => f.endsWith(".test.ts")));
});

// Root-only exceptions: the appearance boundary and the site-wide plotter control.
// These exact shared entrypoints are allowed in layout.tsx alone. The checker
// itself still flags them, and every other file and specifier, so _lib/ and the components stay as isolated as before.
const APPEARANCE = new Set(["@/components/appearance-boot", "@/components/appearance-runtime", "@/components/plotter-toggle"]);
const ROOT_LAYOUT = join(ROOT, "app/(structures)/layout.tsx");
const rootAppearance = (file: string, spec: string) => file === ROOT_LAYOUT && APPEARANCE.has(spec);

test("the root layout mounts only the shared appearance and plotter boundaries", () => {
  const layout = readFileSync(ROOT_LAYOUT, "utf8");
  const shared = specifiers(ROOT_LAYOUT).filter((spec) => reachesOutside(ROOT_LAYOUT, spec) !== null);
  assert.deepEqual(shared.sort(), [...APPEARANCE].sort());
  assert.match(layout, /<AppearanceBoot root="structures" \/>\s*<\/head>/);
  assert.match(layout, /<PlotterToggle fallback \/><AppearanceRuntime \/><\/body>/);
  assert.ok(rootAppearance(ROOT_LAYOUT, "@/components/appearance-boot") && rootAppearance(ROOT_LAYOUT, "@/components/appearance-runtime"));
  assert.ok(!rootAppearance(join(ROOT, "app/(structures)/_lib/x.ts"), "@/components/appearance-boot"), "only the layout");
  assert.ok(!rootAppearance(join(ROOT, "app/(structures)/_components/x.tsx"), "@/components/appearance-runtime"), "only the layout");
  for (const spec of ["@/components/appearance.css", "@/lib/appearance-client", "@/lib/ink-lab", "@/components/figures", "@/components/appearance-boot.tsx", "../../(site)/globals.css"]) {
    assert.ok(!rootAppearance(ROOT_LAYOUT, spec), spec);
  }
  assert.notEqual(reachesOutside(ROOT_LAYOUT, "@/components/appearance-boot"), null, "the checker still flags the boundary");
});

test("nothing under app/(structures)/ imports the site, Tailwind or another project", () => {
  for (const file of group) {
    for (const spec of specifiers(file)) {
      const bad = rootAppearance(file, spec) ? null : reachesOutside(file, spec);
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

test("only ink.ts and stamps.ts import roughjs, and ink.ts does", () => {
  for (const file of group.filter((f) => !MAY_INK.has(f) && !f.endsWith(".d.ts"))) {
    for (const spec of specifiers(file)) assert.ok(!ROUGH.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
  assert.ok(specifiers(lib("ink.ts")).some((spec) => ROUGH.test(spec)));
});

// Every file a file reaches by relative imports, itself included.
function reach(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const spec of specifiers(file)) if (spec.startsWith(".")) reach(resolve(dirname(file), spec), seen);
  return seen;
}

test("scenes.ts reaches neither ink.ts nor stamps.ts (nor kit.ts, which inks), even through another file", () => {
  const reached = reach(lib("scenes.ts"));
  assert.ok(reached.has(lib("paper.ts")) && reached.has(lib("structures/queue.ts")), "the walk follows imports");
  for (const name of ["ink.ts", "stamps.ts", "kit.ts"]) assert.ok(!reached.has(lib(name)), `scenes.ts reaches ${name}`);
  for (const file of reached) {
    for (const spec of specifiers(file)) assert.ok(!ROUGH.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
  assert.ok(reach(lib("stamps.ts")).has(lib("ink.ts")), "and the check would see it");
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

const ISLAND = join(ROOT, "app/(structures)/_components/machine-app.tsx");
// What the island may import: React, and the parts of _lib/ that lay out and play a move.
const ISLAND_MAY = /^(?:react|\.\.\/_lib\/(?:machine|play|scenes)\.ts|\.\.\/_lib\/structures\/[a-z-]+\.ts)$/;

test('exactly one client file in the group, _components/machine-app.tsx, and it reaches no ink', () => {
  const clients = group.filter((f) => CLIENT.test(readFileSync(f, "utf8")));
  assert.deepEqual(
    clients.map((f) => relative(ROOT, f)),
    [relative(ROOT, ISLAND)],
  );
  for (const spec of specifiers(ISLAND)) {
    assert.ok(!ROUGH.test(spec) && !/(^|\/)(ink|stamps|kit|life|costs)(\.ts|\/|$)/.test(spec), `the island imports ${spec}`);
    assert.match(spec, ISLAND_MAY, `the island imports ${spec}`);
  }
  const reached = reach(ISLAND);
  assert.ok(reached.has(lib("scenes.ts")) && reached.has(lib("play.ts")), "the walk follows the island's imports");
  for (const name of ["ink.ts", "stamps.ts", "kit.ts", "costs.ts", "copy.ts", "life/index.ts"]) assert.ok(!reached.has(lib(name)), `the island reaches ${name}`);
  for (const file of reached) {
    for (const spec of specifiers(file)) assert.ok(!ROUGH.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("only layout.tsx reads process.env", () => {
  const readers = group.filter((f) => /\bprocess\.env\b/.test(readFileSync(f, "utf8")));
  assert.deepEqual(
    readers.map((f) => relative(ROOT, f)),
    ["app/(structures)/layout.tsx"],
  );
});

test("nothing outside app/(structures)/ imports Structures", () => {
  const others = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib"), ...under("content")];
  assert.ok(others.length > 10);
  assert.ok(others.some((f) => f.endsWith("orrery.css")));
  for (const file of others) {
    for (const spec of specifiers(file)) {
      assert.ok(!/structures\.css/.test(spec) && !/\(structures\)/.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    }
  }
});

test("GROUPS is read from app/: the site and every other project, never Structures", () => {
  for (const g of ["(site)", "(shore)", "(capsule)", "(orrery)", "(elements)", "(vinyl)", "(rotor)", "(barometer)", "(articles)"]) assert.ok(GROUPS.includes(g), g);
  assert.ok(!GROUPS.includes("(structures)"));
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
  assert.equal(reachesOutside(f, "@/app/(articles)/_lib/readability"), "@/app");
  assert.equal(reachesOutside(f, "../../(articles)/_lib/words.ts"), join("app", "(articles)"));
  assert.equal(reachesOutside(f, "../../(rotor)/rotor.css"), "app/(rotor)");
  assert.equal(reachesOutside(f, "./machine.ts"), null);
  assert.equal(reachesOutside(f, "../machine.ts"), null);
  assert.equal(reachesOutside(f, "../structures.css"), null);
  assert.equal(reachesOutside(f, "@/app/(structures)/_lib/copy"), null);
  assert.equal(reachesOutside(f, "roughjs/bundled/rough.cjs.js"), null);
  assert.ok(REACT.test("react") && REACT.test("react-dom/client") && !REACT.test("reactive") && !REACT.test("next/cache"));
  assert.ok(NEXT.test("next/cache") && NEXT.test("next") && !NEXT.test("nextjs") && !NEXT.test("./next.ts"));
  assert.ok(ROUGH.test("roughjs") && ROUGH.test("roughjs/bin/core") && !ROUGH.test("roughly"));
  assert.ok(FETCH.test("await fet" + "ch(url)") && !FETCH.test("prefetch") && !FETCH.test("fetched"));
  assert.ok(STORAGE.test("local" + "Storage.getItem") && !STORAGE.test("storage"));
  assert.ok(DICE.test("Math." + "random()") && !DICE.test("Math.floor(x)"));
  assert.ok(CLOCK.test("new " + "Date()") && CLOCK.test("Da" + "te.now()") && !CLOCK.test("update") && !CLOCK.test("dated"));
  assert.ok(ISLAND_MAY.test("react") && ISLAND_MAY.test("../_lib/play.ts") && ISLAND_MAY.test("../_lib/structures/index.ts"));
  assert.ok(!ISLAND_MAY.test("../_lib/stamps.ts") && !ISLAND_MAY.test("../_lib/life/index.ts") && !ISLAND_MAY.test("react-dom"));
  assert.ok(CLIENT.test("'use cli" + "ent';\nimport x") && CLIENT.test('"use cli' + 'ent"') && !CLIENT.test("// says use client"));
  assert.deepEqual(specifiers(lib("structures/index.ts")).sort(), [
    "../machine.ts",
    "./array.ts",
    "./binary-search-tree.ts",
    "./graph.ts",
    "./hash-table.ts",
    "./heap.ts",
    "./linked-list.ts",
    "./queue.ts",
    "./stack.ts",
  ]);
});
