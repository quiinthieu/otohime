// Elements owes nothing to the site, Shore, Capsule or Sun, and none of them owes
// anything to Elements. Inside Elements, only _components/atom-3d.tsx may import
// three, @react-three/fiber or @react-three/drei, so the table page can never pull
// the 3D chunk, and _lib/ stays free of React. This reads import specifiers only,
// so prose that mentions a name is fine. Modelled on app/(sun)/_lib/isolation.test.ts.
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
const elementsFiles = under("app/(elements)").filter((f) => f !== SELF);

const GROUPS = ["(site)", "(shore)", "(capsule)", "(sun)"];
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

const THREE = /^(?:three(?:\/|$)|@react-three\/)/;
const ATOM_3D = join(ROOT, "app/(elements)/_components/atom-3d.tsx");
const REACT = /^(react|react-dom|next)(\/|$)/;

test("the scan finds Elements' files", () => {
  assert.ok(elementsFiles.some((f) => f.endsWith(join("_lib", "grid.ts"))));
  assert.ok(elementsFiles.some((f) => f.endsWith(join("_lib", "elements.ts"))));
});

test("nothing under app/(elements)/ imports the site, Tailwind or another project", () => {
  for (const file of elementsFiles) {
    for (const spec of specifiers(file)) {
      const bad = reachesOutside(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("only _components/atom-3d.tsx imports three, fiber or drei", () => {
  for (const file of elementsFiles.filter((f) => f !== ATOM_3D)) {
    for (const spec of specifiers(file)) assert.ok(!THREE.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("_lib/ imports no React or Next", () => {
  for (const file of elementsFiles.filter((f) => f.includes(`${sep}_lib${sep}`))) {
    for (const spec of specifiers(file)) assert.ok(!REACT.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("nothing outside app/(elements)/ imports Elements", () => {
  const others = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib")];
  assert.ok(others.length > 10);
  assert.ok(others.some((f) => f.endsWith("sun.css")));
  for (const file of others) {
    for (const spec of specifiers(file)) {
      assert.ok(!/elements\.css/.test(spec) && !/\(elements\)/.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    }
  }
});

test("the checkers flag what they should", () => {
  const f = join(ROOT, "app/(elements)/_lib/x.ts");
  assert.equal(reachesOutside(f, "@/components/figures"), "@/components");
  assert.equal(reachesOutside(f, "@/content/site"), "@/content");
  assert.equal(reachesOutside(f, "@/lib/machines"), "@/lib");
  assert.equal(reachesOutside(f, "tailwindcss"), "tailwindcss");
  assert.equal(reachesOutside(f, "../../(site)/globals.css"), "globals.css");
  assert.equal(reachesOutside(f, "../../../lib/machines"), "lib");
  assert.equal(reachesOutside(f, "../../(site)/layout"), join("app", "(site)"));
  assert.equal(reachesOutside(f, "@/app/(shore)/_lib/ledger"), "app/(shore)");
  assert.equal(reachesOutside(f, "../../(capsule)/capsule.css"), "app/(capsule)");
  assert.equal(reachesOutside(f, "../../(sun)/_lib/sun"), join("app", "(sun)"));
  assert.equal(reachesOutside(f, "@/app/(sun)/_lib/words"), "app/(sun)");
  assert.equal(reachesOutside(f, "./grid.ts"), null);
  assert.equal(reachesOutside(f, "../elements.css"), null);
  assert.equal(reachesOutside(f, "react"), null);
  for (const s of ["three", "three/examples/jsm/x", "@react-three/fiber", "@react-three/drei"]) assert.ok(THREE.test(s), s);
  assert.ok(!THREE.test("threeish") && !THREE.test("./three-notes"));
  assert.ok(REACT.test("react") && REACT.test("next/dynamic") && !REACT.test("reactive"));
  assert.deepEqual(specifiers(join(ROOT, "app/(elements)/_lib/grid.ts")), ["./elements.ts"]);
});
