// The validator for funFacts.json (also `npm run elements:validate`): the schema,
// the 200-character rule and a source on an allowlisted host for all 118.
// Each assertion names the first offending key.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const FILE = join(import.meta.dirname, "funFacts.json");
const data = JSON.parse(readFileSync(FILE, "utf8")) as Record<string, unknown>;

const MAX_FACT = 200;
const HOSTS = [
  "en.wikipedia.org",
  "periodic-table.rsc.org",
  "www.rsc.org",
  "www.nist.gov",
  "physics.nist.gov",
  "pubchem.ncbi.nlm.nih.gov",
  "iupac.org",
  "www.lanl.gov",
  "science.nasa.gov",
];

const NUMBERS = Array.from({ length: 118 }, (_, i) => String(i + 1));
const entries = () => NUMBERS.map((k) => [k, data[k] as Record<string, unknown>] as const);

test("keys are exactly 1..118 plus needsReview", () => {
  const expected = [...NUMBERS, "needsReview"];
  const extra = Object.keys(data).find((k) => !expected.includes(k));
  const missing = expected.find((k) => !(k in data));
  assert.equal(extra, undefined, `unexpected key ${extra}`);
  assert.equal(missing, undefined, `missing key ${missing}`);
});

test("each entry is exactly { fact, sourceUrl }", () => {
  for (const [k, v] of entries()) {
    assert.ok(v && typeof v === "object" && !Array.isArray(v), `${k}: not an object`);
    assert.deepEqual(Object.keys(v).sort(), ["fact", "sourceUrl"], `${k}: keys`);
  }
});

test(`each fact is one sentence of at most ${MAX_FACT} characters`, () => {
  for (const [k, v] of entries()) {
    const fact = v.fact;
    assert.equal(typeof fact, "string", `${k}: fact is not a string`);
    const s = fact as string;
    assert.ok(s.trim().length > 0, `${k}: empty fact`);
    assert.equal(s, s.trim(), `${k}: surrounding whitespace`);
    assert.ok([...s].length <= MAX_FACT, `${k}: ${[...s].length} characters`);
    assert.ok(s.endsWith("."), `${k}: does not end with a full stop`);
    assert.ok(!/http/i.test(s), `${k}: a URL in the fact`);
  }
});

test("each sourceUrl is https on an allowlisted host", () => {
  for (const [k, v] of entries()) {
    assert.equal(typeof v.sourceUrl, "string", `${k}: sourceUrl is not a string`);
    const raw = v.sourceUrl as string;
    assert.ok(!/\s/.test(raw), `${k}: whitespace in ${raw}`);
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      assert.fail(`${k}: not a URL: ${raw}`);
    }
    assert.equal(url.protocol, "https:", `${k}: ${raw}`);
    assert.ok(HOSTS.includes(url.hostname), `${k}: host ${url.hostname} not allowed`);
  }
});

test("facts are unique", () => {
  const seen = new Map<string, string>();
  for (const [k, v] of entries()) {
    const fact = (v.fact as string).toLowerCase();
    assert.ok(!seen.has(fact), `${k}: same fact as ${seen.get(fact)}`);
    seen.set(fact, k);
  }
});

test("needsReview is a list of unique atomic numbers", () => {
  const list = data.needsReview;
  assert.ok(Array.isArray(list), "needsReview is not an array");
  const bad = (list as unknown[]).find((n) => !Number.isInteger(n) || (n as number) < 1 || (n as number) > 118);
  assert.equal(bad, undefined, `needsReview holds ${bad}`);
  assert.equal(new Set(list).size, list.length, "needsReview repeats a number");
});
