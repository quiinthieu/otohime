// Rotor owes nothing to the site or another project (the groups are read from
// app/), and none of them owes anything to Rotor. _lib/ stays free of React
// and Next, only ink.ts may import roughjs (so rough.js never reaches the
// browser), and nothing under app/(rotor)/ fetches. This reads import
// specifiers and source text, so it is modelled on
// app/(vinyl)/_lib/isolation.test.ts, not shared with it.
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
const rotorFiles = under("app/(rotor)").filter((f) => f !== SELF);

const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(rotor)")
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
const INK = join(ROOT, "app/(rotor)/_lib/ink.ts");
const FETCH = /\bfetch\s*\(/;

test("the scan finds Rotor's files", () => {
  for (const name of ["wiring.ts", "enigma.ts", "tape.ts", "machine.ts", "ink.ts", "words.ts", "roughjs.d.ts"]) {
    assert.ok(rotorFiles.some((f) => f.endsWith(join("_lib", name))), name);
  }
});

// Root-only exceptions: the appearance boundary and the site-wide plotter control.
// These exact shared entrypoints are allowed in layout.tsx alone. The checker
// itself still flags them, and every other file and specifier, so _lib/ and the components stay as isolated as before.
const APPEARANCE = new Set(["@/components/appearance-boot", "@/components/appearance-runtime", "@/components/plotter-toggle"]);
const ROOT_LAYOUT = join(ROOT, "app/(rotor)/layout.tsx");
const rootAppearance = (file: string, spec: string) => file === ROOT_LAYOUT && APPEARANCE.has(spec);

test("the root layout mounts only the shared appearance and plotter boundaries", () => {
  const layout = readFileSync(ROOT_LAYOUT, "utf8");
  const shared = specifiers(ROOT_LAYOUT).filter((spec) => reachesOutside(ROOT_LAYOUT, spec) !== null);
  assert.deepEqual(shared.sort(), [...APPEARANCE].sort());
  assert.match(layout, /<AppearanceBoot root="rotor" \/>\s*<\/head>/);
  assert.match(layout, /<PlotterToggle fallback \/><AppearanceRuntime \/><\/body>/);
  assert.ok(rootAppearance(ROOT_LAYOUT, "@/components/appearance-boot") && rootAppearance(ROOT_LAYOUT, "@/components/appearance-runtime"));
  assert.ok(!rootAppearance(join(ROOT, "app/(rotor)/_lib/x.ts"), "@/components/appearance-boot"), "only the layout");
  assert.ok(!rootAppearance(join(ROOT, "app/(rotor)/_components/x.tsx"), "@/components/appearance-runtime"), "only the layout");
  for (const spec of ["@/components/appearance.css", "@/lib/appearance-client", "@/lib/ink-lab", "@/components/figures", "@/components/appearance-boot.tsx", "../../(site)/globals.css"]) {
    assert.ok(!rootAppearance(ROOT_LAYOUT, spec), spec);
  }
  assert.notEqual(reachesOutside(ROOT_LAYOUT, "@/components/appearance-boot"), null, "the checker still flags the boundary");
});

test("nothing under app/(rotor)/ imports the site, Tailwind or another project", () => {
  for (const file of rotorFiles) {
    for (const spec of specifiers(file)) {
      const bad = rootAppearance(file, spec) ? null : reachesOutside(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("_lib/ imports no React or Next", () => {
  for (const file of rotorFiles.filter((f) => f.includes(`${sep}_lib${sep}`))) {
    for (const spec of specifiers(file)) assert.ok(!REACT.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("only ink.ts imports roughjs", () => {
  assert.ok(specifiers(INK).some((s) => ROUGH.test(s)), "ink.ts draws with rough.js");
  for (const file of rotorFiles.filter((f) => f !== INK && !f.endsWith(".d.ts"))) {
    for (const spec of specifiers(file)) assert.ok(!ROUGH.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("nothing outside app/(rotor)/ imports Rotor", () => {
  const others = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib"), ...under("content")];
  assert.ok(others.length > 10);
  assert.ok(others.some((f) => f.endsWith("orrery.css")));
  for (const file of others) {
    for (const spec of specifiers(file)) {
      assert.ok(!/rotor\.css/.test(spec) && !/\(rotor\)/.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    }
  }
});

test("no fetch( anywhere under app/(rotor)/", () => {
  for (const file of rotorFiles) assert.ok(!FETCH.test(readFileSync(file, "utf8")), relative(ROOT, file));
});

test("exactly one \"use client\" file, the island, and it imports no ink, box or rough.js", () => {
  const clients = rotorFiles.filter((f) => /^\s*["']use client["']/m.test(readFileSync(f, "utf8")));
  assert.deepEqual(clients.map((f) => relative(ROOT, f)), [join("app", "(rotor)", "_components", "rotor-app.tsx")]);
  for (const spec of specifiers(clients[0])) {
    assert.ok(!ROUGH.test(spec) && !/\/ink(\.ts)?$/.test(spec) && !/\/box$/.test(spec), `the island imports ${spec}`);
  }
});

test("only the layout's theme pin and nothing else under app/(rotor)/ touches localStorage", () => {
  const users = rotorFiles.filter((f) => /\.tsx?$/.test(f) && readFileSync(f, "utf8").includes("localStorage"));
  assert.deepEqual(users.map((f) => relative(ROOT, f)), [join("app", "(rotor)", "layout.tsx")]);
});

test("GROUPS is read from app/: the site and every other project, never Rotor", () => {
  assert.ok(GROUPS.includes("(site)"), "(site)");
  assert.ok(GROUPS.includes("(shore)"), "(shore)");
  assert.ok(GROUPS.includes("(capsule)"), "(capsule)");
  assert.ok(GROUPS.includes("(orrery)"), "(orrery)");
  assert.ok(GROUPS.includes("(elements)"), "(elements)");
  assert.ok(GROUPS.includes("(vinyl)"), "(vinyl)");
  assert.ok(!GROUPS.includes("(rotor)"));
});

test("the checkers flag what they should", () => {
  const f = join(ROOT, "app/(rotor)/_lib/x.ts");
  assert.equal(reachesOutside(f, "@/components/television"), "@/components");
  assert.equal(reachesOutside(f, "@/content/site"), "@/content");
  assert.equal(reachesOutside(f, "@/lib/songs"), "@/lib");
  assert.equal(reachesOutside(f, "tailwindcss"), "tailwindcss");
  assert.equal(reachesOutside(f, "../../(site)/globals.css"), "globals.css");
  assert.equal(reachesOutside(f, "../../../lib/songs"), "lib");
  assert.equal(reachesOutside(f, "../../(site)/layout"), join("app", "(site)"));
  assert.equal(reachesOutside(f, "@/app/(orrery)/_lib/ink"), "app/(orrery)");
  assert.equal(reachesOutside(f, "../../(orrery)/_lib/ink.ts"), join("app", "(orrery)"));
  assert.equal(reachesOutside(f, "../../(capsule)/_lib/crank"), join("app", "(capsule)"));
  assert.equal(reachesOutside(f, "../../(vinyl)/vinyl.css"), "app/(vinyl)");
  assert.equal(reachesOutside(f, "./enigma.ts"), null);
  assert.equal(reachesOutside(f, "../rotor.css"), null);
  assert.equal(reachesOutside(f, "roughjs/bundled/rough.cjs.js"), null);
  assert.ok(REACT.test("react") && REACT.test("next/font/google") && !REACT.test("reactive"));
  assert.ok(ROUGH.test("roughjs") && ROUGH.test("roughjs/bin/core") && !ROUGH.test("roughly"));
  assert.ok(FETCH.test("await fetch(url)") && FETCH.test("fetch (x)") && !FETCH.test("prefetch") && !FETCH.test("fetched"));
  assert.deepEqual(specifiers(join(ROOT, "app/(rotor)/_lib/enigma.ts")), ["./wiring.ts"]);
});
