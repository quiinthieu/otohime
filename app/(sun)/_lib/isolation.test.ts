// Sun owes nothing to the site, Shore or Capsule, and none of them owes anything
// to Sun. This reads import specifiers only, so prose that mentions a name is
// fine. Modelled on app/(capsule)/_lib/isolation.test.ts, not shared with it.
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
const sunFiles = under("app/(sun)").filter((f) => f !== SELF);

// Anything that resolves into the site's, Shore's or Capsule's code or styles, by alias or by ../
const OUTSIDE = ["components", "content", "lib", join("app", "(site)"), join("app", "(shore)"), join("app", "(capsule)")].map((d) =>
  join(ROOT, d),
);
function reachesOutside(file: string, spec: string): string | null {
  if (/globals\.css/.test(spec)) return "globals.css";
  if (/^@?tailwindcss(\/|$)/.test(spec) || /^@tailwindcss\//.test(spec)) return "tailwindcss";
  for (const alias of ["components", "content", "lib"]) {
    if (spec === `@/${alias}` || spec.startsWith(`@/${alias}/`)) return `@/${alias}`;
  }
  if (spec.startsWith("@/app/(site)")) return "app/(site)";
  if (spec.startsWith("@/app/(shore)") || /shore\.css/.test(spec)) return "app/(shore)";
  if (spec.startsWith("@/app/(capsule)") || /capsule\.css/.test(spec)) return "app/(capsule)";
  if (spec.startsWith(".")) {
    const target = resolve(dirname(file), spec);
    const hit = OUTSIDE.find((d) => target === d || target.startsWith(d + sep));
    if (hit) return relative(ROOT, hit);
  }
  return null;
}

test("the scan finds Sun's files", () => {
  assert.ok(sunFiles.some((f) => f.endsWith(join("_lib", "sun.ts"))));
  assert.ok(sunFiles.some((f) => f.endsWith("layout.tsx")));
  assert.ok(sunFiles.some((f) => f.endsWith("sun.css")));
});

test("nothing under app/(sun)/ imports the site, Tailwind, Shore or Capsule", () => {
  for (const file of sunFiles) {
    for (const spec of specifiers(file)) {
      const bad = reachesOutside(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("nothing under app/(site)/, app/(shore)/, app/(capsule)/, components/ or lib/ imports Sun", () => {
  const others = [...under("app/(site)"), ...under("app/(shore)"), ...under("app/(capsule)"), ...under("components"), ...under("lib")];
  assert.ok(others.length > 10);
  assert.ok(others.some((f) => f.endsWith("shore.css")));
  assert.ok(others.some((f) => f.endsWith("capsule.css")));
  for (const file of others) {
    for (const spec of specifiers(file)) {
      assert.ok(
        !/sun\.css/.test(spec) && !/\(sun\)/.test(spec),
        `${relative(ROOT, file)} imports ${spec}`,
      );
    }
  }
});

test("the checker flags what it should", () => {
  const f = join(ROOT, "app/(sun)/_lib/x.ts");
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
  assert.equal(reachesOutside(f, "../../(capsule)/_lib/cards"), join("app", "(capsule)"));
  assert.equal(reachesOutside(f, "@/app/(capsule)/_lib/cards"), "app/(capsule)");
  assert.equal(reachesOutside(f, "../../(capsule)/capsule.css"), "app/(capsule)");
  assert.equal(reachesOutside(f, "./sun.ts"), null);
  assert.equal(reachesOutside(f, "../sun.css"), null);
  assert.equal(reachesOutside(f, "react"), null);
});
