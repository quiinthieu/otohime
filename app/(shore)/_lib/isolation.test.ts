// Shore owes nothing to the site's design or another project, and none of them
// owes anything to Shore. The groups are read from app/, so a new project is
// guarded without editing this file.
// This reads import specifiers only, so prose that mentions a name is fine.
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
const shoreFiles = under("app/(shore)").filter((f) => f !== SELF);

const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(shore)")
  .map((e) => e.name)
  .sort();
const SITE_DIRS = ["components", "content", "lib", ...GROUPS.map((g) => join("app", g))].map((d) => join(ROOT, d));

// Anything that resolves into the site's or another project's code or styles, by alias or by ../
function reachesSite(file: string, spec: string): string | null {
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
    const hit = SITE_DIRS.find((d) => target === d || target.startsWith(d + sep));
    if (hit) return relative(ROOT, hit);
  }
  return null;
}

test("the scan finds Shore's files", () => {
  assert.ok(shoreFiles.some((f) => f.endsWith("layout.tsx")));
  assert.ok(shoreFiles.some((f) => f.endsWith("shore.css")));
});

// Root-only exceptions: the appearance boundary and the site-wide plotter control.
// These exact shared entrypoints are allowed in layout.tsx alone. The checker
// itself still flags them, and every other file and specifier, so _lib/ and the components stay as isolated as before.
const APPEARANCE = new Set(["@/components/appearance-boot", "@/components/appearance-runtime", "@/components/plotter-toggle"]);
const ROOT_LAYOUT = join(ROOT, "app/(shore)/layout.tsx");
const rootAppearance = (file: string, spec: string) => file === ROOT_LAYOUT && APPEARANCE.has(spec);

test("the root layout mounts only the shared appearance and plotter boundaries", () => {
  const layout = readFileSync(ROOT_LAYOUT, "utf8");
  const shared = specifiers(ROOT_LAYOUT).filter((spec) => reachesSite(ROOT_LAYOUT, spec) !== null);
  assert.deepEqual(shared.sort(), [...APPEARANCE].sort());
  assert.match(layout, /<AppearanceBoot root="shore" \/>\s*<\/head>/);
  assert.match(layout, /<PlotterToggle fallback \/><AppearanceRuntime \/><\/body>/);
  assert.ok(rootAppearance(ROOT_LAYOUT, "@/components/appearance-boot") && rootAppearance(ROOT_LAYOUT, "@/components/appearance-runtime"));
  assert.ok(!rootAppearance(join(ROOT, "app/(shore)/_lib/x.ts"), "@/components/appearance-boot"), "only the layout");
  assert.ok(!rootAppearance(join(ROOT, "app/(shore)/_components/x.tsx"), "@/components/appearance-runtime"), "only the layout");
  for (const spec of ["@/components/appearance.css", "@/lib/appearance-client", "@/lib/ink-lab", "@/components/figures", "@/components/appearance-boot.tsx", "../../(site)/globals.css"]) {
    assert.ok(!rootAppearance(ROOT_LAYOUT, spec), spec);
  }
  assert.notEqual(reachesSite(ROOT_LAYOUT, "@/components/appearance-boot"), null, "the checker still flags the boundary");
});

test("nothing under app/(shore)/ imports the site's CSS, Tailwind, code or another project", () => {
  for (const file of shoreFiles) {
    for (const spec of specifiers(file)) {
      const bad = rootAppearance(file, spec) ? null : reachesSite(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("nothing outside app/(shore)/ imports Shore", () => {
  const siteFiles = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib")];
  assert.ok(siteFiles.length > 10);
  assert.ok(siteFiles.some((f) => f.endsWith("orrery.css")));
  for (const file of siteFiles) {
    for (const spec of specifiers(file)) {
      assert.ok(
        !/shore\.css/.test(spec) && !/\(shore\)/.test(spec),
        `${relative(ROOT, file)} imports ${spec}`,
      );
    }
  }
});

test("GROUPS is read from app/: the site and every other project, never Shore", () => {
  assert.ok(GROUPS.includes("(site)"), "(site)");
  assert.ok(GROUPS.includes("(capsule)"), "(capsule)");
  assert.ok(GROUPS.includes("(orrery)"), "(orrery)");
  assert.ok(GROUPS.includes("(elements)"), "(elements)");
  assert.ok(GROUPS.includes("(vinyl)"), "(vinyl)");
  assert.ok(!GROUPS.includes("(shore)"));
});

test("the checker flags what it should", () => {
  const f = join(ROOT, "app/(shore)/x.ts");
  assert.equal(reachesSite(f, "@/components/figures"), "@/components");
  assert.equal(reachesSite(f, "@/content/site"), "@/content");
  assert.equal(reachesSite(f, "@/lib/auth"), "@/lib");
  assert.equal(reachesSite(f, "tailwindcss"), "tailwindcss");
  assert.equal(reachesSite(f, "../../(site)/globals.css"), "globals.css");
  assert.equal(reachesSite(f, "../../lib/auth"), "lib");
  assert.equal(reachesSite(f, "../(site)/layout"), "app/(site)");
  assert.equal(reachesSite(f, "../(capsule)/_lib/cards"), "app/(capsule)");
  assert.equal(reachesSite(f, "@/app/(orrery)/_lib/sun"), "app/(orrery)");
  assert.equal(reachesSite(f, "./shore.css"), null);
  assert.equal(reachesSite(f, "react"), null);
});
