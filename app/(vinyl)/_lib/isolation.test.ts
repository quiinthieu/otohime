// Vinyl owes nothing to the site or another project, and none of them owes
// anything to Vinyl. _lib/ stays free of React; nothing offers a download, and
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

const GROUPS = ["(site)", "(shore)", "(capsule)", "(sun)", "(elements)"];
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
  for (const name of ["records.ts", "deck.ts", "spin.ts", "geometry.ts", "oembed.ts", "player.ts", "youtube.ts"]) {
    assert.ok(vinylFiles.some((f) => f.endsWith(join("_lib", name))), name);
  }
});

test("nothing under app/(vinyl)/ imports the site, Tailwind or another project", () => {
  for (const file of vinylFiles) {
    for (const spec of specifiers(file)) {
      const bad = reachesOutside(file, spec);
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
  assert.ok(others.some((f) => f.endsWith("sun.css")));
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
  for (const file of vinylFiles.filter((f) => f !== CRACKLE)) {
    assert.ok(!/AudioContext/.test(readFileSync(file, "utf8")), relative(ROOT, file));
  }
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
  assert.equal(reachesOutside(f, "../../(sun)/_lib/sun"), join("app", "(sun)"));
  assert.equal(reachesOutside(f, "@/app/(elements)/_lib/grid"), "app/(elements)");
  assert.equal(reachesOutside(f, "../../(elements)/_lib/grid"), join("app", "(elements)"));
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
