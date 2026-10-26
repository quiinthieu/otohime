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

test("nothing under app/(ryugu)/ imports the site's CSS, Tailwind, code or another project", () => {
  for (const file of palaceFiles) {
    for (const spec of specifiers(file)) {
      const bad = reachesSite(file, spec);
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
  assert.match(layout, /<html lang="en">/);
  assert.match(layout, /<body>\{children\}<\/body>/);
  assert.doesNotMatch(layout, /dangerouslySetInnerHTML|data-theme|className=/);
  // a secret: kept out of search
  assert.match(layout, /robots: \{ index: false, follow: false \}/);
});

test("ryugu.css styles none of the site's cartridge, machine or Tailwind classes", () => {
  const css = readFileSync(join(ROOT, "app/(ryugu)/ryugu.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(css, /@import|@tailwind|@apply|@layer/);
  assert.doesNotMatch(css, /\.(?:cartridge|machine|chip|btn|masthead|end|console)\b/);
});
