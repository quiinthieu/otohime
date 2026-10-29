// Barometer owes nothing to the site or another project (the groups are read
// from app/), and none of them owes anything to Barometer. _lib/ stays free of
// React, only ink.ts may import roughjs (so rough.js never reaches the
// browser), and the one network call, the feed's host, process.env and the
// only import from Next live in station.ts. This reads import specifiers and
// source text, so it is modelled on app/(vinyl)/_lib/isolation.test.ts, not
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
const group = under("app/(barometer)").filter((f) => f !== SELF);
const lib = (name: string) => join(ROOT, "app/(barometer)/_lib", name);
const inLib = (f: string) => f.includes(`${sep}_lib${sep}`);
// _lib's code: the tests may name the host (reading.test.ts quotes the URL it
// captured a fixture from) and read station.ts as text.
const libCode = group.filter((f) => inLib(f) && !/\.test\.ts$/.test(f));
const STATION = lib("station.ts");

const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(barometer)")
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

const REACT = /^(react|react-dom)(\/|$)/;
const NEXT = /^next(\/|$)/;
const ROUGH = /^roughjs(\/|$)/;
const FETCH = /\bfetch\s*\(/;
const HOST = /api\.open-meteo\.com/;
const ENV = /\bprocess\.env\b/;
const STORAGE = /\blocalStorage\b/;
const CLIENT = /^\s*["']use client["']/m;
const INK = lib("ink.ts");

test("the scan finds Barometer's files", () => {
  for (const name of ["cities.ts", "codes.ts", "dial.ts", "reading.ts", "hand.ts", "station.ts", "ink.ts", "words.ts", "roughjs.d.ts"]) {
    assert.ok(group.some((f) => f === lib(name)), name);
  }
  assert.ok(libCode.includes(STATION));
  assert.ok(!libCode.some((f) => f.endsWith(".test.ts")));
});

// Root-only exceptions: the appearance boundary and the site-wide plotter control.
// These exact shared entrypoints are allowed in layout.tsx alone. The checker
// itself still flags them, and every other file and specifier, so _lib/ and the components stay as isolated as before.
const APPEARANCE = new Set(["@/components/appearance-boot", "@/components/appearance-runtime", "@/components/plotter-toggle"]);
const ROOT_LAYOUT = join(ROOT, "app/(barometer)/layout.tsx");
const rootAppearance = (file: string, spec: string) => file === ROOT_LAYOUT && APPEARANCE.has(spec);

test("the root layout mounts only the shared appearance and plotter boundaries", () => {
  const layout = readFileSync(ROOT_LAYOUT, "utf8");
  const shared = specifiers(ROOT_LAYOUT).filter((spec) => reachesOutside(ROOT_LAYOUT, spec) !== null);
  assert.deepEqual(shared.sort(), [...APPEARANCE].sort());
  assert.match(layout, /<AppearanceBoot root="barometer" \/>\s*<\/head>/);
  assert.match(layout, /<PlotterToggle fallback \/><AppearanceRuntime \/><\/body>/);
  assert.ok(rootAppearance(ROOT_LAYOUT, "@/components/appearance-boot") && rootAppearance(ROOT_LAYOUT, "@/components/appearance-runtime"));
  assert.ok(!rootAppearance(join(ROOT, "app/(barometer)/_lib/x.ts"), "@/components/appearance-boot"), "only the layout");
  assert.ok(!rootAppearance(join(ROOT, "app/(barometer)/_components/x.tsx"), "@/components/appearance-runtime"), "only the layout");
  for (const spec of ["@/components/appearance.css", "@/lib/appearance-client", "@/lib/ink-lab", "@/components/figures", "@/components/appearance-boot.tsx", "../../(site)/globals.css"]) {
    assert.ok(!rootAppearance(ROOT_LAYOUT, spec), spec);
  }
  assert.notEqual(reachesOutside(ROOT_LAYOUT, "@/components/appearance-boot"), null, "the checker still flags the boundary");
});

test("nothing under app/(barometer)/ imports the site, Tailwind or another project", () => {
  for (const file of group) {
    for (const spec of specifiers(file)) {
      const bad = rootAppearance(file, spec) ? null : reachesOutside(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("_lib/ imports no React", () => {
  for (const file of group.filter(inLib)) {
    for (const spec of specifiers(file)) assert.ok(!REACT.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("only station.ts imports from Next, and only next/cache", () => {
  for (const file of libCode) {
    for (const spec of specifiers(file)) {
      if (!NEXT.test(spec)) continue;
      assert.equal(file, STATION, `${relative(ROOT, file)} imports ${spec}`);
      assert.equal(spec, "next/cache");
    }
  }
  assert.ok(specifiers(STATION).includes("next/cache"));
});

test("only ink.ts imports roughjs", () => {
  assert.ok(specifiers(INK).some((s) => ROUGH.test(s)), "ink.ts draws with rough.js");
  for (const file of group.filter((f) => f !== INK && !f.endsWith(".d.ts"))) {
    for (const spec of specifiers(file)) assert.ok(!ROUGH.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("the one network call is in station.ts", () => {
  for (const file of group) {
    assert.equal(FETCH.test(readFileSync(file, "utf8")), file === STATION, relative(ROOT, file));
  }
});

test("the feed's host and process.env appear under _lib/ only in station.ts", () => {
  for (const file of libCode) {
    const text = readFileSync(file, "utf8");
    assert.equal(HOST.test(text), file === STATION, `${relative(ROOT, file)} and the host`);
    assert.equal(ENV.test(text), file === STATION, `${relative(ROOT, file)} and process.env`);
  }
});

test("_lib/ never touches localStorage: hand.ts takes and returns strings", () => {
  for (const file of libCode) assert.ok(!STORAGE.test(readFileSync(file, "utf8")), relative(ROOT, file));
});

test("at most one client file in the group, never under _lib/", () => {
  const clients = group.filter((f) => CLIENT.test(readFileSync(f, "utf8")));
  assert.ok(clients.length <= 1, clients.map((f) => relative(ROOT, f)).join(", "));
  for (const f of clients) assert.ok(f.endsWith("hand-app.tsx"), relative(ROOT, f));
  for (const f of group.filter(inLib)) assert.ok(!clients.includes(f), relative(ROOT, f));
});

test("nothing outside app/(barometer)/ imports Barometer", () => {
  const others = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib"), ...under("content")];
  assert.ok(others.length > 10);
  assert.ok(others.some((f) => f.endsWith("orrery.css")));
  for (const file of others) {
    for (const spec of specifiers(file)) {
      assert.ok(!/barometer\.css/.test(spec) && !/\(barometer\)/.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    }
  }
});

test("GROUPS is read from app/: the site and every other project, never Barometer", () => {
  for (const g of ["(site)", "(shore)", "(capsule)", "(orrery)", "(elements)", "(vinyl)"]) assert.ok(GROUPS.includes(g), g);
  assert.ok(!GROUPS.includes("(barometer)"));
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
  assert.equal(reachesOutside(f, "@/app/(orrery)/_lib/ink"), "app/(orrery)");
  assert.equal(reachesOutside(f, "../../(orrery)/_lib/ink.ts"), join("app", "(orrery)"));
  assert.equal(reachesOutside(f, "../../(vinyl)/vinyl.css"), "app/(vinyl)");
  assert.equal(reachesOutside(f, "./dial.ts"), null);
  assert.equal(reachesOutside(f, "../barometer.css"), null);
  assert.equal(reachesOutside(f, "roughjs/bundled/rough.cjs.js"), null);
  assert.ok(REACT.test("react") && REACT.test("react-dom/client") && !REACT.test("reactive") && !REACT.test("next/cache"));
  assert.ok(NEXT.test("next/cache") && NEXT.test("next") && !NEXT.test("nextjs") && !NEXT.test("./next.ts"));
  assert.ok(ROUGH.test("roughjs") && ROUGH.test("roughjs/bin/core") && !ROUGH.test("roughly"));
  assert.ok(FETCH.test("await fet" + "ch(url)") && FETCH.test("fet" + "ch (x)") && !FETCH.test("prefetch") && !FETCH.test("fetched"));
  assert.ok(HOST.test("https://api.open-meteo" + ".com/v1") && !HOST.test("https://open-meteo.com/"));
  assert.ok(ENV.test("process" + ".env.X") && !ENV.test("process.environment"));
  assert.ok(STORAGE.test("local" + "Storage.getItem") && !STORAGE.test("sessionStorage"));
  assert.ok(CLIENT.test("'use cli" + "ent';\nimport x") && CLIENT.test("\"use cli" + "ent\"") && !CLIENT.test("// says use client"));
  assert.deepEqual(specifiers(lib("hand.ts")), ["./cities.ts", "./reading.ts"]);
});
