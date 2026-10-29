// The Gazette owes nothing to the site or another project (the groups are read
// from app/), and none of them owes anything to the Gazette. _lib/ stays free
// of React and Next, only ink.ts may import roughjs (so rough.js never reaches
// the browser), nothing in the group is a client file, and _lib/ makes no
// network call and keeps no state. This reads import specifiers and source
// text, so it is modelled on app/(barometer)/_lib/isolation.test.ts, not
// shared with it.
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
const group = under("app/(articles)").filter((f) => f !== SELF);
const lib = (name: string) => join(ROOT, "app/(articles)/_lib", name);
const inLib = (f: string) => f.includes(`${sep}_lib${sep}`);
const libCode = group.filter((f) => inLib(f) && !/\.test\.ts$/.test(f));
// The root layout, once the paper has one, publishes BUILD_SHA.
const LAYOUT = join(ROOT, "app/(articles)/layout.tsx");

const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(articles)")
  .map((e) => e.name)
  .sort();
const OUTSIDE = ["components", "content", "lib", ...GROUPS.map((g) => join("app", g))].map((d) => join(ROOT, d));

// Anything that resolves into the site's or another project's code or styles, by alias or by ../
function reachesOutside(file: string, spec: string): string | null {
  if (/globals\.css/.test(spec)) return "globals.css";
  if (/^@?tailwindcss(\/|$)/.test(spec) || /^@tailwindcss\//.test(spec)) return "tailwindcss";
  if (spec === "@" || spec.startsWith("@/")) {
    if (!spec.startsWith("@/app/(articles)/")) return spec.split("/").slice(0, 2).join("/");
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

const REACT = /^(react|react-dom)(\/|$)/;
const NEXT = /^next(\/|$)/;
const ROUGH = /^roughjs(\/|$)/;
const FETCH = /\bfetch\s*\(/;
const ENV = /\bprocess\.env\b/;
const STORAGE = /\b(?:localStorage|sessionStorage)\b/;
const CLIENT = /^\s*["']use client["']/m;
const INK = lib("ink.ts");

test("the scan finds the Gazette's files", () => {
  for (const name of ["articles.ts", "readability.ts", "edition.ts", "ink.ts", "words.ts", "roughjs.d.ts", "figures/index.ts", "figures/kit.ts"]) {
    assert.ok(group.some((f) => f === lib(name)), name);
  }
  assert.ok(libCode.filter((f) => f.includes(`${sep}figures${sep}`)).length >= 7, "six figures and their kit");
  assert.ok(!libCode.some((f) => f.endsWith(".test.ts")));
});

// Root-only exceptions: the appearance boundary and the site-wide plotter control.
// These exact shared entrypoints are allowed in layout.tsx alone. The checker
// itself still flags them, and every other file and specifier, so _lib/ and the components stay as isolated as before.
const APPEARANCE = new Set(["@/components/appearance-boot", "@/components/appearance-runtime", "@/components/plotter-toggle"]);
const ROOT_LAYOUT = join(ROOT, "app/(articles)/layout.tsx");
const rootAppearance = (file: string, spec: string) => file === ROOT_LAYOUT && APPEARANCE.has(spec);

test("the root layout mounts only the shared appearance and plotter boundaries", () => {
  const layout = readFileSync(ROOT_LAYOUT, "utf8");
  const shared = specifiers(ROOT_LAYOUT).filter((spec) => reachesOutside(ROOT_LAYOUT, spec) !== null);
  assert.deepEqual(shared.sort(), [...APPEARANCE].sort());
  assert.match(layout, /<AppearanceBoot root="articles" \/>\s*<\/head>/);
  assert.match(layout, /<PlotterToggle fallback \/><AppearanceRuntime \/><\/body>/);
  assert.ok(rootAppearance(ROOT_LAYOUT, "@/components/appearance-boot") && rootAppearance(ROOT_LAYOUT, "@/components/appearance-runtime"));
  assert.ok(!rootAppearance(join(ROOT, "app/(articles)/_lib/x.ts"), "@/components/appearance-boot"), "only the layout");
  assert.ok(!rootAppearance(join(ROOT, "app/(articles)/_components/x.tsx"), "@/components/appearance-runtime"), "only the layout");
  for (const spec of ["@/components/appearance.css", "@/lib/appearance-client", "@/lib/ink-lab", "@/components/figures", "@/components/appearance-boot.tsx", "../../(site)/globals.css"]) {
    assert.ok(!rootAppearance(ROOT_LAYOUT, spec), spec);
  }
  assert.notEqual(reachesOutside(ROOT_LAYOUT, "@/components/appearance-boot"), null, "the checker still flags the boundary");
});

test("nothing under app/(articles)/ imports the site, Tailwind or another project", () => {
  for (const file of group) {
    for (const spec of specifiers(file)) {
      const bad = rootAppearance(file, spec) ? null : reachesOutside(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("_lib/ imports no React and nothing from Next", () => {
  for (const file of group.filter(inLib)) {
    for (const spec of specifiers(file)) {
      assert.ok(!REACT.test(spec), `${relative(ROOT, file)} imports ${spec}`);
      assert.ok(!NEXT.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    }
  }
});

test("only ink.ts imports roughjs", () => {
  assert.ok(specifiers(INK).some((s) => ROUGH.test(s)), "ink.ts draws with rough.js");
  for (const file of group.filter((f) => f !== INK && !f.endsWith(".d.ts"))) {
    for (const spec of specifiers(file)) assert.ok(!ROUGH.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("no client file anywhere in the group: the paper is server-rendered", () => {
  const clients = group.filter((f) => CLIENT.test(readFileSync(f, "utf8")));
  assert.deepEqual(clients.map((f) => relative(ROOT, f)), []);
});

test("_lib/ makes no network call and keeps no browser storage", () => {
  for (const file of group.filter(inLib)) {
    const text = readFileSync(file, "utf8");
    assert.ok(!FETCH.test(text), `${relative(ROOT, file)} calls the network`);
    assert.ok(!STORAGE.test(text), `${relative(ROOT, file)} touches storage`);
  }
});

test("process.env appears only in the root layout", () => {
  for (const file of group) {
    if (file === LAYOUT) continue;
    assert.ok(!ENV.test(readFileSync(file, "utf8")), relative(ROOT, file));
  }
});

test("nothing outside app/(articles)/ imports the Gazette", () => {
  const others = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib"), ...under("content")];
  assert.ok(others.length > 10);
  assert.ok(others.some((f) => f.endsWith("orrery.css")));
  for (const file of others) {
    for (const spec of specifiers(file)) {
      assert.ok(!/articles\.css/.test(spec) && !/\(articles\)/.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    }
  }
});

test("GROUPS is read from app/: the site and every other project, never the Gazette", () => {
  for (const g of ["(site)", "(shore)", "(capsule)", "(orrery)", "(elements)", "(vinyl)", "(barometer)"]) assert.ok(GROUPS.includes(g), g);
  assert.ok(!GROUPS.includes("(articles)"));
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
  assert.equal(reachesOutside(f, "@/app/(orrery)/_lib/ink"), "@/app");
  assert.equal(reachesOutside(f, "../../(orrery)/_lib/ink.ts"), join("app", "(orrery)"));
  assert.equal(reachesOutside(f, "../../(barometer)/barometer.css"), "app/(barometer)");
  assert.equal(reachesOutside(f, "./edition.ts"), null);
  assert.equal(reachesOutside(f, "../articles.css"), null);
  assert.equal(reachesOutside(f, "@/app/(articles)/_lib/articles"), null);
  assert.equal(reachesOutside(f, "roughjs/bundled/rough.cjs.js"), null);
  assert.ok(REACT.test("react") && REACT.test("react-dom/client") && !REACT.test("reactive") && !REACT.test("next/cache"));
  assert.ok(NEXT.test("next/cache") && NEXT.test("next") && !NEXT.test("nextjs") && !NEXT.test("./next.ts"));
  assert.ok(ROUGH.test("roughjs") && ROUGH.test("roughjs/bin/core") && !ROUGH.test("roughly"));
  assert.ok(FETCH.test("await fet" + "ch(url)") && FETCH.test("fet" + "ch (x)") && !FETCH.test("prefetch") && !FETCH.test("fetched"));
  assert.ok(ENV.test("process" + ".env.X") && !ENV.test("process.environment"));
  assert.ok(STORAGE.test("local" + "Storage.getItem") && !STORAGE.test("storage"));
  assert.ok(CLIENT.test("'use cli" + "ent';\nimport x") && CLIENT.test("\"use cli" + "ent\"") && !CLIENT.test("// says use client"));
  assert.deepEqual(specifiers(lib("figures/index.ts")).sort(), [
    "../articles.ts",
    "./how-tides-work.ts",
    "./how-your-phone-knows-where-it-is.ts",
    "./kit.ts",
    "./kit.ts",
    "./what-a-gigabyte-holds.ts",
    "./why-ice-floats.ts",
    "./why-the-sky-is-blue.ts",
    "./why-we-need-a-leap-day.ts",
  ]);
});
