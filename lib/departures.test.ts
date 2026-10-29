import assert from "node:assert/strict";
import { test } from "node:test";
import { site } from "../content/site.ts";
import {
  buildDepartureClackCue,
  buildProjectDepartures,
  buildRowFlipFrames,
  buildWorkDepartures,
  canPlayDepartureClack,
  DEPARTURE_CLACK_INTERVAL_MS,
  FLAP_ALPHABET,
  flipPath,
  MAX_FLAP_STEPS,
  normalizeFlapChar,
  padFlapCell,
  type DepartureRow,
} from "./departures.ts";
import { cueGain, cueLength, dbToGain, MAX_DB } from "./sound.ts";

function checkBoard(rows: DepartureRow[], kind: DepartureRow["kind"]) {
  assert.ok(rows.length >= 3 && rows.length <= 12);
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length);
  assert.equal(new Set(rows.map((row) => row.code)).size, rows.length);
  assert.deepEqual(new Set(rows.map((row) => row.status)), new Set(["ON TIME", "DELAYED", "BACKFILLING"]));
  for (const row of rows) {
    assert.equal(row.kind, kind);
    assert.ok(row.name.trim());
    assert.ok(row.schedule.trim());
    assert.match(row.note, /^Illustrative schedule and status\./);
  }
}

test("Work and Projects build deterministic, bounded illustrative boards from actual site content", (t) => {
  // Negative control: these builders must not consult a clock, random source or network.
  const forbidden = () => { throw new Error("Departure model consulted ambient state"); };
  t.mock.method(Date, "now", forbidden);
  t.mock.method(Math, "random", forbidden);
  t.mock.method(globalThis, "fetch", forbidden);
  const before = JSON.stringify(site);
  const work = buildWorkDepartures();
  const projects = buildProjectDepartures();
  assert.deepEqual(work, buildWorkDepartures(site));
  assert.deepEqual(projects, buildProjectDepartures(site));
  checkBoard(work, "pipeline");
  checkBoard(projects, "project");
  assert.deepEqual(work.slice(0, 4).map((row) => row.name), Object.values(site.pipeline.stations));
  for (const entry of site.stack) {
    const row = work.find((row) => row.name === `${entry.what} / ${entry.tools}`);
    assert.ok(row);
    assert.ok(row.note.endsWith(entry.note));
  }
  assert.deepEqual(projects.map((row) => row.name), site.projectList.map((project) => project.title));
  projects.forEach((row, i) => {
    assert.equal(row.href, site.projectList[i].href);
    assert.equal(row.schedule, site.projectList[i].shipped);
    assert.ok(row.note.endsWith(site.projectList[i].note));
  });
  assert.equal(JSON.stringify(site), before, "builders must not mutate source content");
  projects[0].name = "changed returned row";
  assert.equal(buildProjectDepartures()[0].name, site.projectList[0].title);
});

test("injected frozen content controls rows, retains source order and is capped before expansion", () => {
  const projects = Object.freeze([
    Object.freeze({ title: "New project", note: "Underway", started: "2026-10-01", href: "/new" }),
    Object.freeze({ title: "Shipped project", note: "Done", shipped: "2026-10-02", started: "2026-09-01" }),
    Object.freeze({ title: "Undated", note: "No promised run time" }),
  ]);
  const rows = buildProjectDepartures({ projectList: projects });
  assert.deepEqual(rows.map((row) => row.name), projects.map((project) => project.title));
  assert.deepEqual(rows.map((row) => row.schedule), ["2026-10-01", "2026-10-02", "ON DEMAND"]);
  assert.deepEqual(rows.map((row) => row.status), ["ON TIME", "DELAYED", "BACKFILLING"]);
  assert.equal(rows[1].href, undefined);
  assert.equal(buildProjectDepartures({ projectList: Array(30).fill(projects[0]) }).length, 12);
  assert.deepEqual(buildProjectDepartures({ projectList: [] }), []);
  assert.equal(buildProjectDepartures({ projectList: projects.slice(0, 1) }).length, 1);

  const pipeline = Object.freeze({
    stations: Object.freeze({ source: "INPUT", queue: "BUFFER", warehouse: "STORE", dashboard: "OUTPUT" }),
    note: "Made-up packets",
  });
  const entry = Object.freeze({ what: "Stream", tools: "SQL", note: "Frozen stack entry" });
  const work = buildWorkDepartures({ pipeline, stack: Object.freeze(Array(30).fill(entry)) });
  checkBoard(work, "pipeline");
  assert.equal(work.length, 12);
  assert.equal(work[0].name, "INPUT");
  assert.ok(work[0].note.endsWith(pipeline.note));
  assert.equal(work[4].name, "Stream / SQL");
  assert.ok(work[4].note.endsWith(entry.note));
  assert.equal(buildWorkDepartures({ pipeline, stack: [] }).length, 4);
});

test("normalization uses one supported uppercase drum glyph per input code point", () => {
  assert.equal(FLAP_ALPHABET, " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·/-:");
  for (const char of FLAP_ALPHABET) assert.equal(normalizeFlapChar(char.toLowerCase()), char);
  for (const char of ["", "?", "é", "ß", "海", "🐢", "\n", "\t"]) assert.equal(normalizeFlapChar(char), " ");
  assert.equal(normalizeFlapChar("abc"), "A");
  assert.equal(padFlapCell("ab·/-:09", 10), "AB·/-:09  ");
  assert.equal(padFlapCell("abc", 2), "AB");
  assert.equal(padFlapCell("a🐢ßz", 5), "A  Z ");
  assert.equal(padFlapCell("abc", 0), "");
  for (const width of [-1, 1.5, NaN, Infinity]) assert.throws(() => padFlapCell("A", width), RangeError);
});

test("short drum paths are consecutive and wrap from colon through the blank slot", () => {
  assert.deepEqual(flipPath("A", "D"), ["B", "C", "D"]);
  assert.deepEqual(flipPath(":", "B"), [" ", "A", "B"]);
  assert.deepEqual(flipPath("-", "A"), [":", " ", "A"]);
  assert.deepEqual(flipPath("A", "a"), ["A"]);
  assert.deepEqual(flipPath("🐢", "b"), ["A", "B"]);
  assert.deepEqual(flipPath(":", "?"), [" "]);
  assert.deepEqual(flipPath("?", "🐢"), [" "]);
  assert.deepEqual(flipPath("A", "Z", 3), ["J", "R", "Z"]);
});

test("all alphabet pairs terminate within every step budget and follow the forward wrapping arc", () => {
  assert.equal(MAX_FLAP_STEPS, 12);
  for (const from of FLAP_ALPHABET) {
    for (const to of FLAP_ALPHABET) {
      const distance = (FLAP_ALPHABET.indexOf(to) - FLAP_ALPHABET.indexOf(from) + FLAP_ALPHABET.length) % FLAP_ALPHABET.length;
      for (const budget of [1, 2, 5, 12, 100, Infinity]) {
        const path = flipPath(from, to, budget);
        const limit = Math.min(budget, MAX_FLAP_STEPS);
        assert.equal(path.at(-1), to);
        assert.equal(path.length, Math.max(1, Math.min(distance, limit)));
        let previousOffset = 0;
        for (const char of path) {
          const offset = (FLAP_ALPHABET.indexOf(char) - FLAP_ALPHABET.indexOf(from) + FLAP_ALPHABET.length) % FLAP_ALPHABET.length;
          assert.ok(FLAP_ALPHABET.includes(char));
          assert.ok(offset <= distance);
          if (distance) assert.ok(offset > previousOffset, `${from} -> ${to} must advance forward`);
          previousOffset = offset;
        }
      }
      assert.deepEqual(flipPath(from, to), flipPath(from, to, 12));
      for (const budget of [0, -1, -Infinity, NaN, 0.5]) assert.deepEqual(flipPath(from, to, budget), [to]);
    }
  }
  assert.ok(flipPath("A", "Z").length === 12);
});

test("row frames synchronize independent cells, hold finished cells and normalize final text", () => {
  assert.deepEqual(buildRowFlipFrames("AA:", "DBB", 3), ["BB ", "CBA", "DBB"]);
  assert.deepEqual(buildRowFlipFrames("AB", "ab", 4), ["AB  "]);
  assert.deepEqual(buildRowFlipFrames("LONG", "hi🐢", 4, 0), ["HI  "]);
  assert.deepEqual(buildRowFlipFrames("A", "Z", 0), [""]);
  for (const budget of [0, 1, 4, 12, 100]) {
    const frames = buildRowFlipFrames(" :A9", "z?b", 6, budget);
    assert.ok(frames.length >= 1 && frames.length <= Math.max(1, Math.min(12, budget)));
    assert.ok(frames.every((frame) => frame.length === 6));
    assert.equal(frames.at(-1), "Z B   ");
  }
});

test("clacks require sound permission, full motion and at least 60ms since the previous clack", () => {
  assert.equal(DEPARTURE_CLACK_INTERVAL_MS, 60);
  for (const delta of [-60, 0, 59, 59.999]) assert.equal(canPlayDepartureClack(100, 100 + delta, true, false), false);
  for (const delta of [60, 60.001, 120]) assert.equal(canPlayDepartureClack(100, 100 + delta, true, false), true);
  assert.equal(canPlayDepartureClack(0, 60, true, false), true);
  assert.equal(canPlayDepartureClack(-Infinity, 0, true, false), true);
  for (const soundOn of [false, true]) {
    for (const reduced of [false, true]) {
      assert.equal(canPlayDepartureClack(0, 100, soundOn, reduced), soundOn && !reduced);
    }
  }
  for (const invalid of [NaN, Infinity, -Infinity]) assert.equal(canPlayDepartureClack(0, invalid, true, false), false);
  for (const invalid of [NaN, Infinity]) assert.equal(canPlayDepartureClack(invalid, 100, true, false), false);
  let lastPlayed = -Infinity;
  const played: number[] = [];
  for (let now = 0; now <= 200; now++) {
    if (canPlayDepartureClack(lastPlayed, now, true, false)) {
      lastPlayed = now;
      played.push(now);
    }
  }
  assert.deepEqual(played, [0, 60, 120, 180]);
});

test("clack cues are deterministic, short, quiet high ticks followed by a mechanical latch", () => {
  assert.deepEqual(buildDepartureClackCue(), buildDepartureClackCue(0));
  for (const step of [...Array.from({ length: 100 }, (_, i) => i - 50), 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER]) {
    const cue = buildDepartureClackCue(step);
    assert.deepEqual(cue, buildDepartureClackCue(step));
    assert.ok(Number.isFinite(cue.db) && cue.db <= -22 && cue.db <= MAX_DB);
    assert.ok(cueGain(cue) > 0 && cueGain(cue) <= dbToGain(-22) && cueGain(cue) <= dbToGain(MAX_DB));
    assert.ok(cueLength(cue) > 0 && cueLength(cue) <= 0.05);
    assert.equal(cue.wave, "square");
    assert.equal(cue.notes.length, 3);
    assert.ok(cue.notes[0].hz > 1500 && cue.notes[1].hz > 1500);
    assert.ok(cue.notes[2].hz >= 100 && cue.notes[2].hz < 200);
    for (const note of cue.notes) {
      assert.ok(Number.isFinite(note.hz) && note.at >= 0 && note.attack > 0 && note.decay > 0);
    }
    assert.ok(cue.notes[2].at > cue.notes[1].at && cue.notes[1].at > cue.notes[0].at);
  }
  const first = buildDepartureClackCue();
  first.db = 0;
  assert.equal(buildDepartureClackCue().db, -22, "returned cues do not share mutable state");
});
