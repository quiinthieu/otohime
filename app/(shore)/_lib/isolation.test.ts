// Shore owes nothing to the site's design, and the site owes nothing to Shore.
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

// Anything that resolves into the site's code or styles, by alias or by ../
const SITE_DIRS = ["components", "content", "lib", join("app", "(site)")].map((d) => join(ROOT, d));
function reachesSite(file: string, spec: string): string | null {
  if (/globals\.css/.test(spec)) return "globals.css";
  if (/^@?tailwindcss(\/|$)/.test(spec) || /^@tailwindcss\//.test(spec)) return "tailwindcss";
  for (const alias of ["components", "content", "lib"]) {
    if (spec === `@/${alias}` || spec.startsWith(`@/${alias}/`)) return `@/${alias}`;
  }
  if (spec.startsWith("@/app/(site)")) return "app/(site)";
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

test("nothing under app/(shore)/ imports the site's CSS, Tailwind or code", () => {
  for (const file of shoreFiles) {
    for (const spec of specifiers(file)) {
      const bad = reachesSite(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("nothing under app/(site)/, components/ or lib/ imports Shore", () => {
  const siteFiles = [...under("app/(site)"), ...under("components"), ...under("lib")];
  assert.ok(siteFiles.length > 10);
  for (const file of siteFiles) {
    for (const spec of specifiers(file)) {
      assert.ok(
        !/shore\.css/.test(spec) && !/\(shore\)/.test(spec),
        `${relative(ROOT, file)} imports ${spec}`,
      );
    }
  }
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
  assert.equal(reachesSite(f, "./shore.css"), null);
  assert.equal(reachesSite(f, "react"), null);
});
