import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ARTICLES } from "./articles.ts";
import { dateline, editionDate, longDate, parseDate } from "./edition.ts";

test("the first edition is dated Wednesday, 21 October 2026", () => {
  assert.equal(editionDate(ARTICLES), "2026-10-21");
  assert.equal(longDate("2026-10-21"), "Wednesday, 21 October 2026");
  assert.equal(dateline(ARTICLES), "Vol. I · No. 1 · Wednesday, 21 October 2026 · otohime.dev · Free");
});

test("longDate writes other days from the tables", () => {
  assert.equal(longDate("2024-02-29"), "Thursday, 29 February 2024");
  assert.equal(longDate("2000-01-01"), "Saturday, 1 January 2000");
  assert.equal(longDate("1999-12-31"), "Friday, 31 December 1999");
  assert.throws(() => longDate("2023-02-29"));
  assert.throws(() => longDate("21 October 2026"));
});

test("parseDate accepts only real days", () => {
  assert.deepEqual(parseDate("2026-10-21"), [2026, 10, 21]);
  assert.equal(parseDate("2026-13-01"), null);
  assert.equal(parseDate("2026-04-31"), null);
  assert.equal(parseDate("2026-1-1"), null);
});

test("editionDate picks the newest published", () => {
  assert.equal(editionDate([{ published: "2026-10-21" }, { published: "2026-11-04" }, { published: "2026-10-28" }]), "2026-11-04");
  assert.equal(editionDate([{ published: "2025-01-01" }]), "2025-01-01");
  assert.throws(() => editionDate([]));
});

test("no Intl, no locale and no clock", () => {
  const code = readFileSync(new URL("./edition.ts", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  assert.match(code, /Date\.UTC/);
  assert.doesNotMatch(code, /\bIntl\b|toLocale|Date\.now|new Date\(\)/);
});
