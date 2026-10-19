// The shipped crate is valid, and every rule in validateRecords catches what it should.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  contrast,
  filterRecords,
  genres,
  labelArt,
  labelText,
  MIN_CONTRAST,
  parseRecords,
  validateRecords,
  videoIds,
  watchUrl,
  type VinylRecord,
} from "./records.ts";

const RAW: unknown = JSON.parse(readFileSync(join(import.meta.dirname, "records.json"), "utf8"));
const RECORDS = parseRecords(RAW);
const PLACEHOLDER_IDS = ["IXA6bQsVNjs", "agneRtEe-t8", "vR49dHUwMUA"];

test("records.json validates with no errors and at least 12 records", () => {
  const { errors, warnings } = validateRecords(RAW);
  assert.deepEqual(errors, []);
  assert.ok(RECORDS.length >= 12);
  // the placeholders share three ids, which is a warning and only a warning
  assert.ok(warnings.length > 0 && warnings.every((w) => /is also on/.test(w)), warnings.join("\n"));
});

test("the sample crate covers what the page needs", () => {
  assert.ok(genres(RECORDS).length >= 5);
  assert.ok(RECORDS.some((r) => r.rpm === 33) && RECORDS.some((r) => r.rpm === 45));
  const sided = RECORDS.find((r) => r.tracks);
  assert.ok(sided, "one record has tracks");
  assert.deepEqual([...new Set(sided.tracks!.map((t) => t.side))].sort(), ["A", "B"]);
  assert.ok(RECORDS.some((r) => r.startSeconds !== undefined && r.endSeconds !== undefined));
  for (const r of RECORDS) {
    assert.equal(r.coverArtUrl, `procedural:${r.id}`);
    assert.equal(r.placeholder, true);
    for (const id of videoIds(r)) assert.ok(PLACEHOLDER_IDS.includes(id), `${r.id}: ${id}`);
  }
  assert.deepEqual([...new Set(RECORDS.map((r) => r.youtubeVideoId))].sort(), [...PLACEHOLDER_IDS].sort());
});

const base = (): Record<string, unknown> => ({ ...(RECORDS[0] as unknown as Record<string, unknown>) });
function withOne(patch: Record<string, unknown>, drop: string[] = []) {
  const one = { ...base(), ...patch };
  for (const key of drop) delete one[key];
  return [one, ...RECORDS.slice(1)];
}
function errorsFor(patch: Record<string, unknown>, drop: string[] = []) {
  return validateRecords(withOne(patch, drop)).errors;
}
function rejects(patch: Record<string, unknown>, pattern: RegExp, drop: string[] = []) {
  const errors = errorsFor(patch, drop);
  assert.ok(errors.some((e) => pattern.test(e)), `${JSON.stringify(patch)} gave ${JSON.stringify(errors)}`);
}

test("every rule has a failing fixture", () => {
  assert.deepEqual(validateRecords({}).errors, ["records must be a list"]);
  assert.ok(validateRecords(RECORDS.slice(0, 11)).errors.some((e) => /at least 12/.test(e)));
  assert.ok(validateRecords([...RECORDS, 7]).errors.some((e) => /not an object/.test(e)));
  assert.ok(validateRecords([...RECORDS, RECORDS[0]]).errors.some((e) => /id repeats/.test(e)));

  for (const key of ["id", "title", "artist", "genre", "coverArtUrl", "labelColor", "accentColor", "youtubeVideoId"]) {
    rejects({ [key]: "  " }, new RegExp(`${key} must be a non-empty string`));
    rejects({}, new RegExp(`${key} must be a non-empty string`), [key]);
  }
  rejects({ id: "Harbour Lights" }, /lower-case words/);
  rejects({ year: 1899 }, /year/);
  rejects({ year: new Date().getFullYear() + 1 }, /year/);
  rejects({ year: 1961.5 }, /year/);
  rejects({ year: "1961" }, /year/);
  rejects({ rpm: 78 }, /rpm must be 33 or 45/);
  rejects({ rpm: "33" }, /rpm must be 33 or 45/);
  rejects({ youtubeVideoId: "IXA6bQsVNj" }, /youtubeVideoId must be 11/);
  rejects({ youtubeVideoId: "IXA6bQsVNj$" }, /youtubeVideoId must be 11/);
  rejects({ youtubePlaylistId: "PL short" }, /youtubePlaylistId/);
  rejects({ youtubePlaylistId: "PL123" }, /youtubePlaylistId/);
  rejects({ labelColor: "#12345" }, /labelColor must be #rrggbb/);
  rejects({ accentColor: "red" }, /accentColor must be #rrggbb/);
  rejects({ startSeconds: -1 }, /startSeconds must be a number/);
  rejects({ endSeconds: "90" }, /endSeconds must be a number/);
  rejects({ startSeconds: 90, endSeconds: 90 }, /before endSeconds/);
  rejects({ startSeconds: 120, endSeconds: 30 }, /before endSeconds/);
  rejects({ coverArtUrl: "https://example.com/cover.png" }, /procedural/);
  rejects({ coverArtUrl: "//cdn.example.com/cover.png" }, /procedural/);
  rejects({ tracks: [] }, /tracks must be a non-empty list/);
  rejects({ tracks: [{ side: "C", title: "x", youtubeVideoId: "IXA6bQsVNjs" }] }, /side must be/);
  rejects({ tracks: [{ side: "A", title: "", youtubeVideoId: "IXA6bQsVNjs" }] }, /title must be/);
  rejects({ tracks: [{ side: "B", title: "x", youtubeVideoId: "nope" }] }, /tracks\[0\]: youtubeVideoId/);
  rejects({ placeholder: false }, /placeholder/);
});

test("YouTube thumbnails are never cover art", () => {
  for (const url of [
    "https://i.ytimg.com/vi/IXA6bQsVNjs/hqdefault.jpg",
    "https://img.youtube.com/vi/IXA6bQsVNjs/0.jpg",
    "/proxy?u=i.ytimg.com/vi/x.jpg",
    "procedural:ytimg.com",
  ]) {
    rejects({ coverArtUrl: url }, /YouTube thumbnail/);
  }
  assert.deepEqual(errorsFor({ coverArtUrl: "/vinyl/sleeves/harbour.svg" }), []);
  assert.deepEqual(errorsFor({ coverArtUrl: "procedural:anything" }), []);
});

test("valid optional fields pass and unknown fields only warn", () => {
  assert.deepEqual(errorsFor({ youtubePlaylistId: "PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG" }), []);
  assert.deepEqual(errorsFor({ endSeconds: 60 }), []);
  assert.deepEqual(errorsFor({ startSeconds: 0, endSeconds: 1 }), []);
  const { errors, warnings } = validateRecords(withOne({ colour: "#ffffff" }));
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => /unknown field colour/.test(w)));
});

test("parseRecords throws with every error", () => {
  assert.throws(() => parseRecords(withOne({ rpm: 78, year: 1800 })), (e: Error) => /rpm/.test(e.message) && /year/.test(e.message));
  assert.equal(parseRecords(RAW).length, RECORDS.length);
});

test("contrast follows WCAG and every label's text is readable", () => {
  assert.equal(contrast("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(contrast("#777777", "#ffffff").toFixed(2), "4.48");
  assert.equal(contrast("#ffffff", "#777777"), contrast("#777777", "#ffffff"));
  assert.equal(labelText({ labelColor: "#ffffff" }), "#000000");
  assert.equal(labelText({ labelColor: "#000000" }), "#ffffff");
  for (const r of RECORDS) {
    assert.ok(contrast(labelText(r), r.labelColor) >= MIN_CONTRAST, `${r.id} on ${r.labelColor}`);
  }
  // the crate uses both
  assert.deepEqual(new Set(RECORDS.map(labelText)), new Set(["#000000", "#ffffff"]));
  // the worst possible label still finds a readable text colour
  for (let v = 0; v < 256; v++) {
    const hex = `#${v.toString(16).padStart(2, "0").repeat(3)}`;
    assert.ok(contrast(labelText({ labelColor: hex }), hex) >= MIN_CONTRAST, hex);
  }
});

test("genres are unique and sorted; filter matches title or artist, any case, within a genre", () => {
  const g = genres(RECORDS);
  assert.deepEqual(g, [...new Set(g)].sort());
  assert.deepEqual(filterRecords(RECORDS, {}), RECORDS);
  assert.deepEqual(
    filterRecords(RECORDS, { genre: "Jazz" }).map((r) => r.id),
    RECORDS.filter((r) => r.genre === "Jazz").map((r) => r.id),
  );
  assert.deepEqual(filterRecords(RECORDS, { query: "  harbour " }).map((r) => r.id), ["harbour-lights"]);
  assert.deepEqual(filterRecords(RECORDS, { query: "ROSA" }).map((r) => r.id), ["velvet-morning"]);
  assert.deepEqual(filterRecords(RECORDS, { query: "harbour", genre: "Soul" }), []);
  assert.deepEqual(filterRecords(RECORDS, { query: "no such record" }), []);
});

test("watch links and label art", () => {
  assert.equal(watchUrl(RECORDS[0]), "https://www.youtube.com/watch?v=IXA6bQsVNjs");
  const seen = new Set<number>();
  for (const r of RECORDS) {
    const art = labelArt(r);
    assert.deepEqual(art, labelArt({ ...r } as VinylRecord), "deterministic");
    assert.equal(art.background, r.labelColor);
    assert.equal(art.accent, r.accentColor);
    assert.equal(art.text, labelText(r));
    assert.ok(art.rings.length >= 2 && art.rings.length <= 4);
    assert.ok(art.rings.every((x, i) => x > 0.3 && x < 1 && (i === 0 || x < art.rings[i - 1])), `${r.id} ${art.rings}`);
    assert.ok(art.arc.sweep >= 140 && art.arc.sweep <= 220);
    assert.ok(art.rotation >= 0 && art.rotation <= 360);
    seen.add(art.seed);
  }
  assert.equal(seen.size, RECORDS.length, "every record gets its own seed");
});
