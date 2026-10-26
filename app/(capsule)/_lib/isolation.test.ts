// Capsule owes nothing to the site or another project (the groups are read from
// app/), and none of them owes anything to Capsule (art/ink.ts is a copy of
// Orrery's, never an import). This reads import specifiers only, so prose that
// mentions a name is fine. Modelled on app/(shore)/_lib/isolation.test.ts, not
// shared with it.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { test } from "node:test";

const ROOT = resolve(import.meta.dirname, "../../..");
const SOURCE = /\.(?:[cm]?[jt]sx?|css)$/;

function filesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name === "node_modules" || e.name === ".next") return [];
    const path = join(dir, e.name);
    return e.isDirectory() ? filesUnder(path) : SOURCE.test(e.name) ? [path] : [];
  });
}

function specifiers(file: string): string[] {
  const text = readFileSync(file, "utf8");
  const found = [...text.matchAll(/(?:\bfrom|\bimport|\brequire|@import)\s*\(?\s*["']([^"']+)["']/g)];
  return found.map((m) => m[1]);
}

const under = (dir: string) => filesUnder(join(ROOT, dir));

const SELF = import.meta.filename;
const capsuleFiles = under("app/(capsule)").filter((f) => f !== SELF);

const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(capsule)")
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

test("the scan finds Capsule's files", () => {
  assert.ok(capsuleFiles.some((f) => f.endsWith(join("_lib", "cards.ts"))));
  assert.ok(capsuleFiles.some((f) => f.endsWith(join("(capsule)", "layout.tsx"))));
  assert.ok(capsuleFiles.some((f) => f.endsWith(join("(capsule)", "capsule.css"))));
});

// The one exception: the root layout mounts the shared print-run boundary (components/appearance-boot.tsx in <head>,
// components/appearance-runtime.tsx in <body>), these two specifiers exactly and in layout.tsx alone. The checker
// itself still flags them, and every other file and specifier, so _lib/ and the components stay as isolated as before.
const APPEARANCE = new Set(["@/components/appearance-boot", "@/components/appearance-runtime"]);
const ROOT_LAYOUT = join(ROOT, "app/(capsule)/layout.tsx");
const rootAppearance = (file: string, spec: string) => file === ROOT_LAYOUT && APPEARANCE.has(spec);

test("the root layout mounts the shared appearance boundary and nothing else of the site", () => {
  const layout = readFileSync(ROOT_LAYOUT, "utf8");
  const shared = specifiers(ROOT_LAYOUT).filter((spec) => reachesOutside(ROOT_LAYOUT, spec) !== null);
  assert.deepEqual(shared.sort(), [...APPEARANCE].sort());
  assert.match(layout, /<AppearanceBoot root="capsule" \/>\s*<\/head>/);
  assert.match(layout, /<AppearanceRuntime \/><\/body>/);
  assert.ok(rootAppearance(ROOT_LAYOUT, "@/components/appearance-boot") && rootAppearance(ROOT_LAYOUT, "@/components/appearance-runtime"));
  assert.ok(!rootAppearance(join(ROOT, "app/(capsule)/_lib/x.ts"), "@/components/appearance-boot"), "only the layout");
  assert.ok(!rootAppearance(join(ROOT, "app/(capsule)/_components/x.tsx"), "@/components/appearance-runtime"), "only the layout");
  for (const spec of ["@/components/appearance.css", "@/lib/appearance-client", "@/lib/ink-lab", "@/components/figures", "@/components/appearance-boot.tsx", "../../(site)/globals.css"]) {
    assert.ok(!rootAppearance(ROOT_LAYOUT, spec), spec);
  }
  assert.notEqual(reachesOutside(ROOT_LAYOUT, "@/components/appearance-boot"), null, "the checker still flags the boundary");
});

test("nothing under app/(capsule)/ imports the site, Tailwind or another project", () => {
  for (const file of capsuleFiles) {
    for (const spec of specifiers(file)) {
      const bad = rootAppearance(file, spec) ? null : reachesOutside(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("nothing outside app/(capsule)/ imports Capsule", () => {
  const others = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib")];
  assert.ok(others.length > 10);
  assert.ok(others.some((f) => f.endsWith("shore.css")));
  for (const file of others) {
    for (const spec of specifiers(file)) {
      assert.ok(
        !/capsule\.css/.test(spec) && !/\(capsule\)/.test(spec),
        `${relative(ROOT, file)} imports ${spec}`,
      );
    }
  }
});

test("GROUPS is read from app/: the site and every other project, never Capsule", () => {
  assert.ok(GROUPS.includes("(site)"), "(site)");
  assert.ok(GROUPS.includes("(shore)"), "(shore)");
  assert.ok(GROUPS.includes("(orrery)"), "(orrery)");
  assert.ok(GROUPS.includes("(elements)"), "(elements)");
  assert.ok(GROUPS.includes("(vinyl)"), "(vinyl)");
  assert.ok(!GROUPS.includes("(capsule)"));
});

test("the checker flags what it should", () => {
  const f = join(ROOT, "app/(capsule)/_lib/x.ts");
  assert.equal(reachesOutside(f, "@/components/figures"), "@/components");
  assert.equal(reachesOutside(f, "@/content/site"), "@/content");
  assert.equal(reachesOutside(f, "@/lib/machines"), "@/lib");
  assert.equal(reachesOutside(f, "tailwindcss"), "tailwindcss");
  assert.equal(reachesOutside(f, "@tailwindcss/typography"), "tailwindcss");
  assert.equal(reachesOutside(f, "../../(site)/globals.css"), "globals.css");
  assert.equal(reachesOutside(f, "../../../lib/machines"), "lib");
  assert.equal(reachesOutside(f, "../../(site)/layout"), join("app", "(site)"));
  assert.equal(reachesOutside(f, "../../(shore)/_lib/ledger"), join("app", "(shore)"));
  assert.equal(reachesOutside(f, "@/app/(shore)/_lib/ledger"), "app/(shore)");
  assert.equal(reachesOutside(f, "../../(shore)/shore.css"), "app/(shore)");
  assert.equal(reachesOutside(f, "../../(orrery)/_lib/ink.ts"), join("app", "(orrery)"));
  assert.equal(reachesOutside(f, "@/app/(orrery)/_lib/ink"), "app/(orrery)");
  assert.equal(reachesOutside(f, "../../(vinyl)/_lib/deck"), join("app", "(vinyl)"));
  assert.equal(reachesOutside(f, "./art/ink.ts"), null);
  assert.equal(reachesOutside(f, "./cards.ts"), null);
  assert.equal(reachesOutside(f, "../capsule.css"), null);
  assert.equal(reachesOutside(f, "react"), null);
});
