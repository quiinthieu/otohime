// Vinyl owes nothing to the site or another project (the groups are read from
// app/), and none of them owes anything to Vinyl. _lib/ stays free of React; nothing offers a download, and
// only crackle.ts may open an AudioContext, so the YouTube player's sound is
// never touched. This reads import specifiers and source text, so it is
// modelled on app/(elements)/_lib/isolation.test.ts, not shared with it.
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
const vinylFiles = under("app/(vinyl)").filter((f) => f !== SELF);

const GROUPS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name) && e.name !== "(vinyl)")
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

const REACT = /^(react|react-dom|next)(\/|$)/;
const CRACKLE = join(ROOT, "app/(vinyl)/_lib/crackle.ts");
const DOWNLOAD = /\bdownload\s*=|["'`]download["'`]|\.download\b|<[A-Za-z][^>]*\sdownload(?=[\s/>={])/;

test("the scan finds Vinyl's files", () => {
  for (const name of ["records.ts", "deck.ts", "spin.ts", "geometry.ts", "oembed.ts", "player.ts", "youtube.ts", "tonearm.ts", "flight.ts", "crackle.ts"]) {
    assert.ok(vinylFiles.some((f) => f.endsWith(join("_lib", name))), name);
  }
});

// Root-only exceptions: the appearance boundary and the site-wide plotter control.
// These exact shared entrypoints are allowed in layout.tsx alone. The checker
// itself still flags them, and every other file and specifier, so _lib/ and the components stay as isolated as before.
const APPEARANCE = new Set(["@/components/appearance-boot", "@/components/appearance-runtime", "@/components/plotter-toggle"]);
const ROOT_LAYOUT = join(ROOT, "app/(vinyl)/layout.tsx");
const rootAppearance = (file: string, spec: string) => file === ROOT_LAYOUT && APPEARANCE.has(spec);

test("the root layout mounts only the shared appearance and plotter boundaries", () => {
  const layout = readFileSync(ROOT_LAYOUT, "utf8");
  const shared = specifiers(ROOT_LAYOUT).filter((spec) => reachesOutside(ROOT_LAYOUT, spec) !== null);
  assert.deepEqual(shared.sort(), [...APPEARANCE].sort());
  assert.match(layout, /<AppearanceBoot root="vinyl" \/>\s*<\/head>/);
  assert.match(layout, /<PlotterToggle fallback \/><AppearanceRuntime \/><\/body>/);
  assert.ok(rootAppearance(ROOT_LAYOUT, "@/components/appearance-boot") && rootAppearance(ROOT_LAYOUT, "@/components/appearance-runtime"));
  assert.ok(!rootAppearance(join(ROOT, "app/(vinyl)/_lib/x.ts"), "@/components/appearance-boot"), "only the layout");
  assert.ok(!rootAppearance(join(ROOT, "app/(vinyl)/_components/x.tsx"), "@/components/appearance-runtime"), "only the layout");
  for (const spec of ["@/components/appearance.css", "@/lib/appearance-client", "@/lib/ink-lab", "@/components/figures", "@/components/appearance-boot.tsx", "../../(site)/globals.css"]) {
    assert.ok(!rootAppearance(ROOT_LAYOUT, spec), spec);
  }
  assert.notEqual(reachesOutside(ROOT_LAYOUT, "@/components/appearance-boot"), null, "the checker still flags the boundary");
});

test("nothing under app/(vinyl)/ imports the site, Tailwind or another project", () => {
  for (const file of vinylFiles) {
    for (const spec of specifiers(file)) {
      const bad = rootAppearance(file, spec) ? null : reachesOutside(file, spec);
      assert.equal(bad, null, `${relative(ROOT, file)} imports ${spec} (${bad})`);
    }
  }
});

test("_lib/ imports no React or Next", () => {
  for (const file of vinylFiles.filter((f) => f.includes(`${sep}_lib${sep}`))) {
    for (const spec of specifiers(file)) assert.ok(!REACT.test(spec), `${relative(ROOT, file)} imports ${spec}`);
  }
});

test("nothing outside app/(vinyl)/ imports Vinyl", () => {
  const others = [...GROUPS.flatMap((g) => under(`app/${g}`)), ...under("components"), ...under("lib"), ...under("content")];
  assert.ok(others.length > 10);
  assert.ok(others.some((f) => f.endsWith("orrery.css")));
  for (const file of others) {
    for (const spec of specifiers(file)) {
      assert.ok(!/vinyl\.css/.test(spec) && !/\(vinyl\)/.test(spec), `${relative(ROOT, file)} imports ${spec}`);
    }
  }
});

test("no download attribute anywhere in Vinyl", () => {
  for (const file of vinylFiles) assert.ok(!DOWNLOAD.test(readFileSync(file, "utf8")), relative(ROOT, file));
});

test("only crackle.ts may mention AudioContext", () => {
  assert.ok(/new AudioContext\(/.test(readFileSync(CRACKLE, "utf8")), "crackle.ts opens its own");
  for (const file of vinylFiles.filter((f) => f !== CRACKLE)) {
    assert.ok(!/AudioContext/.test(readFileSync(file, "utf8")), relative(ROOT, file));
  }
});

test("no audio file under app/(vinyl)/ or public/", () => {
  const audio = (dir: string): string[] => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries.flatMap((e) => {
      const path = join(dir, e.name);
      return e.isDirectory() ? audio(path) : /\.(mp3|wav|ogg)$/i.test(e.name) ? [path] : [];
    });
  };
  assert.deepEqual([...audio(join(ROOT, "app/(vinyl)")), ...audio(join(ROOT, "public"))].map((f) => relative(ROOT, f)), []);
});

test("touch-action: none is set on the tonearm and nowhere else", () => {
  const css = readFileSync(join(ROOT, "app/(vinyl)/vinyl.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /touch-action:\s*none/.test(m[2]));
  assert.deepEqual(rules.map((m) => m[1].trim()), [".tonearm"]);
  for (const file of vinylFiles.filter((f) => /\.tsx?$/.test(f))) {
    assert.ok(!/touchAction/.test(readFileSync(file, "utf8")), relative(ROOT, file)); // no inline style sets it
  }
});

test("GROUPS is read from app/: the site and every other project, never Vinyl", () => {
  assert.ok(GROUPS.includes("(site)"), "(site)");
  assert.ok(GROUPS.includes("(shore)"), "(shore)");
  assert.ok(GROUPS.includes("(capsule)"), "(capsule)");
  assert.ok(GROUPS.includes("(orrery)"), "(orrery)");
  assert.ok(GROUPS.includes("(elements)"), "(elements)");
  assert.ok(!GROUPS.includes("(vinyl)"));
});

test("the checkers flag what they should", () => {
  const f = join(ROOT, "app/(vinyl)/_lib/x.ts");
  assert.equal(reachesOutside(f, "@/components/television"), "@/components");
  assert.equal(reachesOutside(f, "@/content/site"), "@/content");
  assert.equal(reachesOutside(f, "@/lib/songs"), "@/lib");
  assert.equal(reachesOutside(f, "tailwindcss"), "tailwindcss");
  assert.equal(reachesOutside(f, "../../(site)/globals.css"), "globals.css");
  assert.equal(reachesOutside(f, "../../../lib/songs"), "lib");
  assert.equal(reachesOutside(f, "../../../components/television"), "components");
  assert.equal(reachesOutside(f, "../../(site)/layout"), join("app", "(site)"));
  assert.equal(reachesOutside(f, "@/app/(shore)/_lib/ledger"), "app/(shore)");
  assert.equal(reachesOutside(f, "../../(capsule)/capsule.css"), "app/(capsule)");
  assert.equal(reachesOutside(f, "../../(orrery)/_lib/sun"), join("app", "(orrery)"));
  assert.equal(reachesOutside(f, "@/app/(elements)/_lib/grid"), "app/(elements)");
  assert.equal(reachesOutside(f, "../../(elements)/_lib/grid"), join("app", "(elements)"));
  assert.equal(reachesOutside(f, "../../(shore)/_lib/ledger"), join("app", "(shore)"));
  assert.equal(reachesOutside(f, "./deck.ts"), null);
  assert.equal(reachesOutside(f, "../vinyl.css"), null);
  assert.equal(reachesOutside(f, "react"), null);
  assert.ok(REACT.test("react") && REACT.test("next/script") && !REACT.test("reactive"));
  for (const bad of ['<a download href="x">', "<a download={true}>", 'el.setAttribute("download", "x")', "a.download = name"]) {
    assert.ok(DOWNLOAD.test(bad), bad);
  }
  assert.ok(!DOWNLOAD.test("// no downloads, ever"));
  assert.deepEqual(specifiers(join(ROOT, "app/(vinyl)/_lib/deck.ts")), ["./records.ts"]);
});
