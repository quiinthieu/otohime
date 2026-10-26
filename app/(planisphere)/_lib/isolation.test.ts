// Planisphere owes nothing to the site or another project (the groups are read
// from app/), and none of them owes anything to Planisphere. _lib/ stays free
// of React and Next, only ink.ts may import roughjs (so rough.js never reaches
// the browser), the engine never imports the star data or the ink, and nothing
// under app/(planisphere)/ fetches. This reads import specifiers and source
// text, so it is modelled on app/(vinyl)/_lib/isolation.test.ts, not shared
// with it.
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
const group = under("app/(planisphere)").filter((f) => f !== SELF);
const lib = (name: string) => join(ROOT, "app/(planisphere)/_lib", name);

const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(planisphere)")
  .map((e) => e.name)
  .sort();
const OUTSIDE = ["components", "content", "lib", ...GROUPS.map((g) => join("app", g))].map((d) => join(ROOT, d));

// Anything that resolves into the site's or another project's code or styles, by alias or by ../
function reachesOutside(file: string, spec: string): string | null {
  if (/globals\.css/.test(spec)) return "globals.css";
  if (/^@?tailwindcss(\/|$)/.test(spec) || /^@tailwindcss\//.test(spec)) return "tailwindcss";
  for (const alias of ["components", "content", "lib"]) {
    if (spec === `@/${alias}` || spec.startsWith(`@/${alias}/`)) return `@/${alias}`;
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

const REACT = /^(react|react-dom|next)(\/|$)/;
const ROUGH = /^roughjs(\/|$)/;
const DATA_OR_INK = /(^|\/)(stars|lines|ink)(\.ts)?$/;
const FETCH = /\bfetch\s*\(/;
const CLIENT = /^\s*["']use client["']/m;
const INK = lib("ink.ts");
const ENGINE = ["time.ts", "sky.ts", "sun.ts", "moon.ts", "wheel.ts"];

test("the scan finds Planisphere's files", () => {
  for (const name of [...ENGINE, "cities.ts", "stars.ts", "lines.ts", "ink.ts", "words.ts", "roughjs.d.ts"]) {
    assert.ok(group.some((f) => f === lib(name)), name);
  }
});

// The one exception: the root layout mounts the shared print-run boundary (components/appearance-boot.tsx in <head>,
// components/appearance-runtime.tsx in <body>), these two specifiers exactly and in layout.tsx alone. The checker
// itself still flags them, and every other file and specifier, so _lib/ and the components stay as isolated as before.
const APPEARANCE = new Set(["@/components/appearance-boot", "@/components/appearance-runtime"]);
const ROOT_LAYOUT = join(ROOT, "app/(planisphere)/layout.tsx");
const rootAppearance = (file: string, spec: string) => file === ROOT_LAYOUT && APPEARANCE.has(spec);

test("the root layout mounts the shared appearance boundary and nothing else of the site", () => {
  const layout = readFileSync(ROOT_LAYOUT, "utf8");
  const shared = specifiers(ROOT_LAYOUT).filter((spec) => reachesOutside(ROOT_LAYOUT, spec) !== null);
  assert.deepEqual(shared.sort(), [...APPEARANCE].sort());
  assert.match(layout, /<AppearanceBoot root="planisphere" \/>\s*<\/head>/);
  assert.match(layout, /<AppearanceRuntime \/><\/body>/);
  assert.ok(rootAppearance(ROOT_LAYOUT, "@/components/appearance-boot") && rootAppearance(ROOT_LAYOUT, "@/components/appearance-runtime"));
  assert.ok(!rootAppearance(join(ROOT, "app/(planisphere)/_lib/x.ts"), "@/components/appearance-boot"), "only the layout");
  assert.ok(!rootAppearance(join(ROOT, "app/(planisphere)/_components/x.tsx"), "@/components/appearance-runtime"), "only the layout");
  for (const spec of ["@/components/appearance.css", "@/lib/appearance-client", "@/lib/ink-lab", "@/components/figures", "@/components/appearance-boot.tsx", "../../(site)/globals.css"]) {
    assert.ok(!rootAppearance(ROOT_LAYOUT, spec), spec);
  }
  assert.notEqual(reachesOutside(ROOT_LAYOUT, "@/components/appearance-boot"), null, "the checker still flags the boundary");
});

test("nothing under app/(planisphere)/ imports the site, Tailwind or another project", () => {
  for (const file of group) {
    for (const spec of specifiers(file)) {
      const bad = rootAppearance(file, spec) ? null : reachesOutside(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("_lib/ imports no React or Next", () => {
  for (const file of group.filter((f) => f.includes(`${sep}_lib${sep}`))) {
    for (const spec of specifiers(file)) assert.ok(!REACT.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("only ink.ts imports roughjs", () => {
  assert.ok(specifiers(INK).some((s) => ROUGH.test(s)), "ink.ts draws with rough.js");
  for (const file of group.filter((f) => f !== INK && !f.endsWith(".d.ts"))) {
    for (const spec of specifiers(file)) assert.ok(!ROUGH.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("stars.ts and lines.ts import nothing", () => {
  for (const name of ["stars.ts", "lines.ts"]) assert.deepEqual(specifiers(lib(name)), [], name);
});

test("the engine does not import the star data, the lines or the ink", () => {
  for (const name of ENGINE) {
    for (const spec of specifiers(lib(name))) assert.ok(!DATA_OR_INK.test(spec), `${name} imports ${spec}`);
  }
});

test("nothing outside app/(planisphere)/ imports Planisphere", () => {
  const others = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib"), ...under("content")];
  assert.ok(others.length > 10);
  assert.ok(others.some((f) => f.endsWith("orrery.css")));
  for (const file of others) {
    for (const spec of specifiers(file)) {
      assert.ok(!/planisphere\.css/.test(spec) && !/\(planisphere\)/.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    }
  }
});

test("no network call anywhere under app/(planisphere)/", () => {
  for (const file of group) assert.ok(!FETCH.test(readFileSync(file, "utf8")), relative(ROOT, file));
});

const ISLAND = join(ROOT, "app/(planisphere)/_components/planisphere-app.tsx");
const ISLAND_LIB = ["time", "sky", "sun", "moon", "wheel", "cities"];

test("exactly one client file in the group: planisphere-app.tsx", () => {
  const clients = group.filter((f) => CLIENT.test(readFileSync(f, "utf8")));
  assert.deepEqual(clients.map((f) => relative(ROOT, f)), [relative(ROOT, ISLAND)]);
  for (const f of group.filter((g) => g.includes(`${sep}_lib${sep}`))) assert.ok(!clients.includes(f), relative(ROOT, f));
});

test("the island imports none of the stars, the lines, the ink or roughjs, only the engine", () => {
  const specs = specifiers(ISLAND);
  for (const spec of specs) {
    assert.ok(!DATA_OR_INK.test(spec) && !ROUGH.test(spec), `the island imports ${spec}`);
    if (spec.startsWith(".")) {
      const m = /^\.\.\/_lib\/([a-z]+)\.ts$/.exec(spec);
      assert.ok(m && ISLAND_LIB.includes(m[1]), `the island imports ${spec}`);
    }
  }
  assert.ok(specs.includes("../_lib/wheel.ts"));
});

test("the components that ink are server files", () => {
  for (const name of ["wheel.tsx", "moon-corner.tsx"]) {
    assert.ok(!CLIENT.test(readFileSync(join(ROOT, "app/(planisphere)/_components", name), "utf8")), name);
  }
});

test("GROUPS is read from app/: the site and every other project, never Planisphere", () => {
  assert.ok(GROUPS.includes("(site)"), "(site)");
  assert.ok(GROUPS.includes("(shore)"), "(shore)");
  assert.ok(GROUPS.includes("(capsule)"), "(capsule)");
  assert.ok(GROUPS.includes("(orrery)"), "(orrery)");
  assert.ok(GROUPS.includes("(elements)"), "(elements)");
  assert.ok(GROUPS.includes("(vinyl)"), "(vinyl)");
  assert.ok(!GROUPS.includes("(planisphere)"));
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
  assert.equal(reachesOutside(f, "@/app/(orrery)/_lib/ink"), "app/(orrery)");
  assert.equal(reachesOutside(f, "../../(orrery)/_lib/ink.ts"), join("app", "(orrery)"));
  assert.equal(reachesOutside(f, "../../(vinyl)/vinyl.css"), "app/(vinyl)");
  assert.equal(reachesOutside(f, "./sky.ts"), null);
  assert.equal(reachesOutside(f, "../planisphere.css"), null);
  assert.equal(reachesOutside(f, "roughjs/bundled/rough.cjs.js"), null);
  assert.ok(REACT.test("react") && REACT.test("next/font/google") && !REACT.test("reactive"));
  assert.ok(ROUGH.test("roughjs") && ROUGH.test("roughjs/bin/core") && !ROUGH.test("roughly"));
  assert.ok(DATA_OR_INK.test("./stars.ts") && DATA_OR_INK.test("../_lib/lines") && DATA_OR_INK.test("./ink.ts") && !DATA_OR_INK.test("./sky.ts"));
  assert.ok(FETCH.test("await fet" + "ch(url)") && FETCH.test("fet" + "ch (x)") && !FETCH.test("prefetch") && !FETCH.test("fetched"));
  assert.ok(CLIENT.test("'use cli" + "ent';\nimport x") && CLIENT.test("\"use cli" + "ent\"") && !CLIENT.test("// says use client"));
  assert.deepEqual(specifiers(lib("moon.ts")), ["./sun.ts", "./time.ts"]);
});
