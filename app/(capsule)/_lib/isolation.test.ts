// Capsule owes nothing to the site, Shore or Sun, and neither owes anything to
// Capsule (art/ink.ts is a copy of Sun's, never an import). This reads import specifiers only, so prose that mentions a name is
// fine. Modelled on app/(shore)/_lib/isolation.test.ts, not shared with it.
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

// Anything that resolves into the site's, Shore's or Sun's code or styles, by alias or by ../
const OUTSIDE = ["components", "content", "lib", join("app", "(site)"), join("app", "(shore)"), join("app", "(sun)")].map((d) =>
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
  if (spec.startsWith("@/app/(sun)")) return "app/(sun)";
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

test("nothing under app/(capsule)/ imports the site, Tailwind, Shore or Sun", () => {
  for (const file of capsuleFiles) {
    for (const spec of specifiers(file)) {
      const bad = reachesOutside(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("nothing under app/(site)/, app/(shore)/, components/ or lib/ imports Capsule", () => {
  const others = [...under("app/(site)"), ...under("app/(shore)"), ...under("components"), ...under("lib")];
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
  assert.equal(reachesOutside(f, "../../(sun)/_lib/ink.ts"), join("app", "(sun)"));
  assert.equal(reachesOutside(f, "@/app/(sun)/_lib/ink"), "app/(sun)");
  assert.equal(reachesOutside(f, "./art/ink.ts"), null);
  assert.equal(reachesOutside(f, "./cards.ts"), null);
  assert.equal(reachesOutside(f, "../capsule.css"), null);
  assert.equal(reachesOutside(f, "react"), null);
});
