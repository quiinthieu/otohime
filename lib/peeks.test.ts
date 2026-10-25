import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { test } from "node:test";
import {
  buildPeekIndex,
  isPeekKey,
  PEEK_COUNT,
  peeksFor,
  rank,
  relate,
  serializePeeks,
  type PeekCandidate,
  type PeekIndex,
  type PeekKind,
} from "./peeks.ts";

const ROOT = join(import.meta.dirname, "..");
const INDEX_FILE = join(ROOT, "public/peeks.json");
const index: PeekIndex = JSON.parse(readFileSync(INDEX_FILE, "utf8"));

// The index is built by a script, not imported: lib/ may not reach the Gazette.
function runIndexScript(...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      join(ROOT, "scripts/peeks-index.ts"),
      ...args,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
}

const item = (id: string, text: string, extra: Partial<PeekCandidate> = {}): PeekCandidate => {
  const kind = id.split(":")[0] as PeekKind;
  return { id, item: { kind, title: id, href: `/${kind}` }, text, order: 0, ...extra } as PeekCandidate;
};

test("the committed index matches a fresh build", () => {
  const run = runIndexScript("--check");
  assert.equal(run.status, 0, run.stderr);
});

test("the check fails on a stale or missing index", () => {
  const dir = mkdtempSync(join(tmpdir(), "peeks-"));
  try {
    const stale = join(dir, "peeks.json");
    copyFileSync(INDEX_FILE, stale);
    assert.equal(runIndexScript("--check", `--file=${stale}`).status, 0, "an untouched copy passes");
    writeFileSync(stale, readFileSync(stale, "utf8").replace("sea glass", "sea grass"));
    const run = runIndexScript("--check", `--file=${stale}`);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /stale/);
    const missing = runIndexScript("--check", `--file=${join(dir, "missing.json")}`);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /missing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a rare shared word outranks a common one", () => {
  const pool = [
    item("sketch:a", "lantern street"),
    item("sketch:b", "street"),
    item("sketch:c", "street"),
    item("note:d", "street"),
  ];
  assert.deepEqual(
    rank({ key: "tag:x", text: "lantern street" }, pool).map((c) => c.id),
    ["sketch:a", "sketch:b", "sketch:c", "note:d"],
  );
  assert.equal(rank({ key: "tag:x", text: "lantern" }, pool)[0].id, "sketch:a");
});

test("a peek takes the best of each kind before a second of any kind", () => {
  const pool = [
    item("sketch:a", "tide moon"),
    item("sketch:b", "tide moon"),
    item("note:c", "moon"),
    item("project:d", "nothing shared"),
    item("article:e", "tide"),
  ];
  assert.deepEqual(relate({ key: "tag:x", text: "tide moon" }, pool), ["sketch:a", "note:c", "article:e"]);
  // With two kinds only, the third card repeats the best-ranked kind.
  assert.deepEqual(relate({ key: "tag:x", text: "tide moon" }, pool.slice(0, 3)), ["sketch:a", "note:c", "sketch:b"]);
  assert.throws(() => relate({ key: "tag:x", text: "tide" }, pool.slice(0, 2)), /only 2 items/);
});

test("an item never peeks at itself", () => {
  const pool = [item("sketch:a", "tide"), item("note:b", "x"), item("project:c", "y"), item("article:d", "z")];
  assert.ok(!relate({ key: "sketch:a", text: "tide" }, pool).includes("sketch:a"));
});

test("ties go to the kind order, then the freshest, then content order, then id", () => {
  // Nothing shared: sketch, note, project in that order.
  const pool = [
    item("article:z", "a"),
    item("project:y", "b"),
    item("note:x", "c"),
    item("sketch:w", "d"),
  ];
  assert.deepEqual(relate({ key: "tag:q", text: "nothing" }, pool), ["sketch:w", "note:x", "project:y"]);

  const notes = [
    item("note:old", "ink", { date: "2026-01-01" }),
    item("note:new", "ink", { date: "2026-10-01" }),
    item("note:undated", "ink"),
  ];
  assert.deepEqual(
    rank({ key: "tag:q", text: "ink" }, notes).map((c) => c.id),
    ["note:new", "note:old", "note:undated"],
    "newer dates first, undated last",
  );

  const sketches = [item("sketch:b", "ink", { order: 1 }), item("sketch:a", "ink", { order: 2 }), item("sketch:c", "ink", { order: 1 })];
  assert.deepEqual(
    rank({ key: "tag:q", text: "ink" }, sketches).map((c) => c.id),
    ["sketch:b", "sketch:c", "sketch:a"],
    "content order, then id",
  );
});

test("the ranking does not depend on input order", () => {
  const pool = [
    item("sketch:a", "ink paper", { order: 0 }),
    item("sketch:b", "paper", { order: 1 }),
    item("note:c", "ink", { order: 0, date: "2026-05-05" }),
    item("project:d", "console paper", { order: 0 }),
    item("article:e", "ink console", { order: 0, date: "2026-01-01" }),
  ];
  const targets = [{ key: "tag:ink", text: "ink paper console" }, ...pool.map((c) => ({ key: c.id, text: c.text }))];
  const forward = buildPeekIndex(pool, targets);
  assert.deepEqual(buildPeekIndex([...pool].reverse(), targets).peeks, forward.peeks);
  assert.equal(serializePeeks(buildPeekIndex(pool, targets)), serializePeeks(forward), "same input, same bytes");
});

test("the builder refuses bad and duplicate keys", () => {
  const pool = [item("sketch:a", "x"), item("note:b", "x"), item("project:c", "x")];
  assert.throws(() => buildPeekIndex([...pool, item("sketch:a", "y")], []), /duplicate peek id/);
  assert.throws(() => buildPeekIndex(pool, [{ key: "Tag:Sky", text: "x" }]), /bad peek key/);
  assert.throws(() => buildPeekIndex(pool, [{ key: "tag:x", text: "x" }, { key: "tag:x", text: "y" }]), /duplicate peek key/);
});

test("peeksFor resolves three cards and ignores unknown or inherited keys", () => {
  const [key, ids] = Object.entries(index.peeks)[0];
  assert.deepEqual(peeksFor(index, key), ids.map((id) => index.items[id]));
  for (const k of ["tag:nope", "", "__proto__", "constructor", "toString"]) assert.deepEqual(peeksFor(index, k), [], k);
  const broken: PeekIndex = { ...index, peeks: { "tag:x": ["sketch:gone", ids[1], ids[2]] } };
  assert.deepEqual(peeksFor(broken, "tag:x"), []);
});

// Every page file under app/, as a route pattern with groups dropped.
function routes(): { segments: string[]; file: string }[] {
  const out: { segments: string[]; file: string }[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) walk(path);
      else if (e.name === "page.tsx") {
        const segments = relative(join(ROOT, "app"), dir).split(sep).filter((s) => s && !/^\(.*\)$/.test(s));
        out.push({ segments, file: path });
      }
    }
  };
  walk(join(ROOT, "app"));
  return out;
}

test("every card leads to a real page, and a #fragment to an id on it", () => {
  const pages = routes();
  for (const [id, it] of Object.entries(index.items)) {
    const [path, fragment] = it.href.split("#");
    assert.ok(path.startsWith("/") && !path.startsWith("//"), `${id}: ${it.href} is internal`);
    const parts = path.split("/").filter(Boolean);
    const page = pages.find((p) => p.segments.length === parts.length && p.segments.every((s, i) => /^\[.+\]$/.test(s) || s === parts[i]));
    assert.ok(page, `${id}: no page for ${it.href}`);
    if (fragment) assert.match(readFileSync(page.file, "utf8"), new RegExp(`id="${fragment}"`), `${id}: no #${fragment}`);
    if (path.startsWith("/articles/")) {
      const slug = parts[1];
      assert.ok(readFileSync(join(ROOT, "app/(articles)/_lib/articles.ts"), "utf8").includes(`slug: "${slug}"`), `${id}: no article ${slug}`);
    }
  }
});

test("each peek is three distinct items with distinct destinations", () => {
  const keys = Object.keys(index.peeks);
  assert.ok(keys.length > 0);
  for (const key of keys) {
    assert.ok(isPeekKey(key), key);
    const ids = index.peeks[key];
    assert.equal(ids.length, PEEK_COUNT, key);
    assert.equal(new Set(ids).size, PEEK_COUNT, `${key}: repeated item`);
    assert.ok(!ids.includes(key), `${key}: peeks at itself`);
    for (const id of ids) assert.ok(Object.hasOwn(index.items, id), `${key}: unknown item ${id}`);
    assert.equal(new Set(ids.map((id) => index.items[id].href)).size, PEEK_COUNT, `${key}: repeated destination`);
  }
});

test("the index covers projects, notes, sketches, articles, tags and credits", () => {
  const site = readFileSync(join(ROOT, "content/site.ts"), "utf8");
  const prefixes = new Set(Object.keys(index.peeks).map((k) => k.split(":")[0]));
  for (const p of ["sketch", "note", "project", "article", "tag", "credit"]) assert.ok(prefixes.has(p), p);
  for (const id of Object.keys(index.items)) assert.ok(Object.hasOwn(index.peeks, id), `${id} has no peek of its own`);
  // Every project link on /projects can be marked.
  for (const [, href] of site.matchAll(/href: "(\/[a-z-]+)", status:/g)) {
    assert.ok(Object.values(index.items).some((it) => it.kind === "project" && it.href === href), `no project for ${href}`);
  }
  assert.deepEqual(peeksFor(index, "project:shore").length, PEEK_COUNT);
  for (const [, it] of Object.entries(index.items)) {
    assert.ok(it.title && it.blurb, `${it.href}: card text`);
    assert.equal(Boolean(it.src), it.kind === "sketch", `${it.title}: only sketches carry a picture`);
  }
});
