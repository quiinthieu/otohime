// Ryugu-jo owes nothing to the site's design (its cartridges, Tailwind, tokens) or another project, and none of
// them owes anything to the palace: the site reaches it only by a plain link to /ryugu. The groups are read from
// app/, so a new project is guarded without editing this file.
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
const palaceFiles = under("app/(ryugu)").filter((f) => f !== SELF);

const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(ryugu)")
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

test("the scan finds the palace's files", () => {
  assert.ok(palaceFiles.some((f) => f.endsWith("layout.tsx")));
  assert.ok(palaceFiles.some((f) => f.endsWith("ryugu.css")));
  assert.ok(palaceFiles.some((f) => f.endsWith("sea.tsx")));
});

// The one exception: the root layout mounts the shared print-run boundary (components/appearance-boot.tsx in <head>,
// components/appearance-runtime.tsx in <body>), these two specifiers exactly and in layout.tsx alone. The checker
// itself still flags them, and every other file and specifier, so _lib/ and the components stay as isolated as before.
const APPEARANCE = new Set(["@/components/appearance-boot", "@/components/appearance-runtime"]);
const ROOT_LAYOUT = join(ROOT, "app/(ryugu)/layout.tsx");
const rootAppearance = (file: string, spec: string) => file === ROOT_LAYOUT && APPEARANCE.has(spec);

test("the root layout mounts the shared appearance boundary and nothing else of the site", () => {
  const layout = readFileSync(ROOT_LAYOUT, "utf8");
  const shared = specifiers(ROOT_LAYOUT).filter((spec) => reachesSite(ROOT_LAYOUT, spec) !== null);
  assert.deepEqual(shared.sort(), [...APPEARANCE].sort());
  assert.match(layout, /<AppearanceBoot root="ryugu" \/>\s*<\/head>/);
  assert.match(layout, /<AppearanceRuntime \/><\/body>/);
  assert.ok(rootAppearance(ROOT_LAYOUT, "@/components/appearance-boot") && rootAppearance(ROOT_LAYOUT, "@/components/appearance-runtime"));
  assert.ok(!rootAppearance(join(ROOT, "app/(ryugu)/_lib/x.ts"), "@/components/appearance-boot"), "only the layout");
  assert.ok(!rootAppearance(join(ROOT, "app/(ryugu)/_components/x.tsx"), "@/components/appearance-runtime"), "only the layout");
  for (const spec of ["@/components/appearance.css", "@/lib/appearance-client", "@/lib/ink-lab", "@/components/figures", "@/components/appearance-boot.tsx", "../../(site)/globals.css"]) {
    assert.ok(!rootAppearance(ROOT_LAYOUT, spec), spec);
  }
  assert.notEqual(reachesSite(ROOT_LAYOUT, "@/components/appearance-boot"), null, "the checker still flags the boundary");
});

// The other exception is data, not code or style: the palace page reads the Tamatebako's changelog, the static
// content/history.json the build writes (scripts/history-index.ts). That specifier exactly, in page.tsx alone.
const HISTORY = "@/content/history.json";
const PAGE = join(ROOT, "app/(ryugu)/ryugu/page.tsx");
const history = (file: string, spec: string) => file === PAGE && spec === HISTORY;

test("the palace page reads the static changelog and nothing else of content/", () => {
  const shared = specifiers(PAGE).filter((spec) => reachesSite(PAGE, spec) !== null);
  assert.deepEqual(shared, [HISTORY]);
  assert.notEqual(reachesSite(PAGE, HISTORY), null, "the checker still flags the data");
  assert.ok(!history(join(ROOT, "app/(ryugu)/_components/tamatebako.tsx"), HISTORY), "only the page");
  for (const spec of ["@/content/site", "@/content/ledger.json", "@/content/history", "../../../content/history.json"]) {
    assert.ok(!history(PAGE, spec), spec);
  }
});

test("nothing under app/(ryugu)/ imports the site's CSS, Tailwind, code or another project", () => {
  for (const file of palaceFiles) {
    for (const spec of specifiers(file)) {
      const bad = rootAppearance(file, spec) || history(file, spec) ? null : reachesSite(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("nothing outside app/(ryugu)/ imports the palace", () => {
  const siteFiles = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib")];
  assert.ok(siteFiles.length > 10);
  assert.ok(siteFiles.some((f) => f.endsWith("orrery.css")));
  for (const file of siteFiles) {
    for (const spec of specifiers(file)) {
      assert.ok(
        !/ryugu\.css/.test(spec) && !/\(ryugu\)/.test(spec),
        `${relative(ROOT, file)} imports ${spec}`,
      );
    }
  }
});

test("GROUPS is read from app/: the site and every other project, never the palace", () => {
  assert.ok(GROUPS.includes("(site)"), "(site)");
  assert.ok(GROUPS.includes("(capsule)"), "(capsule)");
  assert.ok(GROUPS.includes("(orrery)"), "(orrery)");
  assert.ok(GROUPS.includes("(elements)"), "(elements)");
  assert.ok(GROUPS.includes("(vinyl)"), "(vinyl)");
  assert.ok(GROUPS.includes("(shore)"), "(shore)");
  assert.ok(!GROUPS.includes("(ryugu)"));
});

test("the checker flags what it should", () => {
  const f = join(ROOT, "app/(ryugu)/x.ts");
  assert.equal(reachesSite(f, "@/components/figures"), "@/components");
  assert.equal(reachesSite(f, "@/content/site"), "@/content");
  assert.equal(reachesSite(f, "@/lib/auth"), "@/lib");
  assert.equal(reachesSite(f, "tailwindcss"), "tailwindcss");
  assert.equal(reachesSite(f, "../../(site)/globals.css"), "globals.css");
  assert.equal(reachesSite(f, "../../lib/auth"), "lib");
  assert.equal(reachesSite(f, "../(site)/layout"), "app/(site)");
  assert.equal(reachesSite(f, "../(capsule)/_lib/cards"), "app/(capsule)");
  assert.equal(reachesSite(f, "@/app/(orrery)/_lib/sun"), "app/(orrery)");
  assert.equal(reachesSite(f, "./ryugu.css"), null);
  assert.equal(reachesSite(f, "../_lib/school"), null);
  assert.equal(reachesSite(f, "../(shore)/_lib/timer"), "app/(shore)");
  assert.equal(reachesSite(f, "react"), null);
});

test("the palace's root layout is its own document: its own <html> and <body>, one sheet, no theme or site script", () => {
  const layout = readFileSync(join(ROOT, "app/(ryugu)/layout.tsx"), "utf8");
  assert.deepEqual([...layout.matchAll(/^import "([^"]+)";/gm)].map((m) => m[1]), ["./ryugu.css"]);
  // suppressHydrationWarning: the shared print-run boot script (the one exception above) may mark <html> before React
  // hydrates; the body holds the page and that runtime only.
  assert.match(layout, /<html lang="en" suppressHydrationWarning>/);
  assert.match(layout, /<body>\{children\}<AppearanceRuntime \/><\/body>/);
  assert.doesNotMatch(layout, /dangerouslySetInnerHTML|data-theme|className=/);
  // a secret: kept out of search
  assert.match(layout, /robots: \{ index: false, follow: false \}/);
});

test("ryugu.css styles none of the site's cartridge, machine or Tailwind classes", () => {
  const css = readFileSync(join(ROOT, "app/(ryugu)/ryugu.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /@import|@tailwind|@apply|@layer/);
  assert.doesNotMatch(css, /\.(?:cartridge|machine|chip|btn|masthead|end|console)\b/);
});
