import assert from "node:assert/strict";
import { test } from "node:test";
import { clearDay, sceneClass, washUp, withScene } from "./actions.ts";
import { normalizeLedger, serialize, today, type Ledger } from "./ledger.ts";
import { dayNumber, seedFor } from "./pebbles.ts";
import { begin } from "./timer.ts";

const NOW = new Date(2026, 9, 19, 12).getTime();
const DAY = 86_400_000;
const empty: Ledger = { scene: "light", pebbles: [] };

// Press a button, then reload the page: what update() stores, normalizeLedger reads.
const reload = (ledger: Ledger, now = NOW): Ledger => normalizeLedger(serialize(ledger), now);

test("Begin, Finish now, reload: one mint pebble with the day's first seed", () => {
  const ledger = reload(washUp(empty, begin(25, NOW)));
  const pebbles = today(ledger, NOW);
  assert.equal(pebbles.length, 1);
  assert.equal(pebbles[0].palette, "mint");
  assert.equal(pebbles[0].minutes, 25);
  assert.equal(pebbles[0].seed, seedFor(dayNumber(NOW), 0));
});

test("a second session the same day gets index 1 and a distinct seed", () => {
  const first = washUp(empty, begin(25, NOW));
  const ledger = reload(washUp(first, begin(25, NOW + 60_000)));
  const [a, b] = today(ledger, NOW);
  assert.equal(b.seed, seedFor(dayNumber(NOW), 1));
  assert.notEqual(a.seed, b.seed);
});

test("15 minutes gives amber and 45 gives lilac", () => {
  const ledger = reload(washUp(washUp(empty, begin(15, NOW)), begin(45, NOW + 60_000)));
  assert.deepEqual(
    today(ledger, NOW).map((p) => p.palette),
    ["amber", "lilac"],
  );
});

test("finishing the same session twice does not mint twice", () => {
  const session = begin(25, NOW);
  const once = washUp(empty, session);
  const twice = washUp(once, session);
  assert.equal(twice.pebbles.length, 1);
  assert.deepEqual(reload(twice), reload(once));
});

test("the dark scene survives a reload and takes the dark class", () => {
  const ledger = reload(withScene(empty, "dark"));
  assert.equal(ledger.scene, "dark");
  assert.equal(sceneClass(ledger.scene), "shore dark-scene");
  assert.equal(sceneClass("light"), "shore");
  assert.equal(reload(withScene(withScene(empty, "dark"), "light")).scene, "light");
});

test("changing the scene keeps the pebbles", () => {
  const ledger = reload(withScene(washUp(empty, begin(25, NOW)), "dark"));
  assert.equal(ledger.pebbles.length, 1);
});

test("Clear today keeps yesterday's pebbles", () => {
  const yesterday = NOW - DAY;
  let ledger = washUp(empty, begin(25, yesterday));
  ledger = washUp(ledger, begin(45, NOW));
  ledger = washUp(ledger, begin(15, NOW + 60_000));
  const cleared = reload(clearDay(ledger, NOW));
  assert.equal(today(cleared, NOW).length, 0);
  assert.deepEqual(
    cleared.pebbles.map((p) => p.startedAt),
    [yesterday],
  );
  assert.equal(cleared.pebbles[0].seed, seedFor(dayNumber(yesterday), 0));
});

test("Clear today leaves the scene alone", () => {
  const ledger = clearDay(withScene(washUp(empty, begin(25, NOW)), "dark"), NOW);
  assert.equal(ledger.scene, "dark");
});
