import assert from "node:assert/strict";
import { test } from "node:test";
import { createKame, KAME_KEY, localDay, moodAt, trimName } from "./kame.ts";

function fixture(raw: string | null = null, date = new Date(2026, 9, 26, 12)) {
  let elapsed = 0;
  const writes = new Map<string, string>();
  const kame = createKame({ now: () => elapsed, calendar: () => date, storage: {
    getItem: () => raw, setItem: (key, value) => { writes.set(key, value); },
  } });
  return { kame, writes, advance: (ms: number) => { elapsed += ms; kame.tick(); } };
}

test("elapsed clock sleeps exactly at 45s and activity wakes it; pet and shell win over idle", () => {
  const f = fixture();
  assert.equal(f.kame.state(), "swim");
  f.advance(44_999); assert.equal(f.kame.state(), "swim");
  f.advance(1); assert.equal(f.kame.state(), "nap");
  f.kame.call(); assert.equal(f.kame.state(), "follow");
  f.kame.pet(true); f.advance(50_000); assert.equal(f.kame.state(), "pet");
  f.kame.pet(false); assert.equal(f.kame.state(), "swim");
  f.kame.dismiss(true); f.kame.call(); f.kame.pet(true); f.advance(50_000);
  assert.equal(f.kame.state(), "shell");
  f.kame.dismiss(false); assert.equal(f.kame.state(), "swim");
});

test("fetch command accepts only available motion and cancels locally", () => {
  const { kame } = fixture();
  assert.equal(kame.fetch({ type: "fetch", target: { x: 30, y: 90 } }), true);
  assert.equal(kame.state(), "fetch");
  assert.deepEqual(kame.target(), { x: 30, y: 90 });
  kame.fetch({ type: "cancel" }); assert.equal(kame.state(), "swim");
  kame.reduced(true); assert.equal(kame.state(), "nap");
  kame.call(); kame.pet(true); assert.equal(kame.state(), "nap");
  assert.equal(kame.fetch({ type: "fetch", target: { x: 1, y: 2 } }), false);
  kame.reduced(false); kame.pause(true); assert.equal(kame.state(), "nap");
  assert.equal(kame.fetch({ type: "fetch", target: { x: 1, y: 2 } }), false);
  kame.pause(false); assert.equal(kame.state(), "swim");
});

test("local calendar visits count once, cross month/year and reset after missed/future/invalid days", () => {
  const raw = (lastVisit: string, streak = 2) => JSON.stringify({ lastVisit, streak, name: "  Mizu  ", dismissed: true });
  for (const [last, expected] of [["2026-10-26", 2], ["2026-10-25", 3], ["2026-10-24", 1], ["2026-10-27", 1], ["2026-02-30", 1], ["garbage", 1]] as const) {
    const f = fixture(raw(last));
    assert.equal(f.kame.memory().streak, expected, last);
    assert.equal(f.kame.memory().name, "Mizu");
    assert.equal(f.kame.state(), "shell");
    assert.deepEqual([...f.writes.keys()], [KAME_KEY]);
    assert.deepEqual(Object.keys(JSON.parse(f.writes.get(KAME_KEY)!)).sort(), ["dismissed", "lastVisit", "name", "streak"]);
  }
  assert.equal(fixture(raw("2026-12-31"), new Date(2027, 0, 1)).kame.memory().streak, 3);
  assert.equal(fixture(raw("2024-02-28"), new Date(2024, 1, 29)).kame.memory().streak, 3);
  assert.equal(localDay(new Date(2026, 0, 1, 0, 1)), "2026-01-01");
});

test("malformed and blocked storage stays usable; names trim to 24 Unicode characters", () => {
  for (const raw of [null, "{", "null", "[]", "2", '{"streak":-2}', '{"lastVisit":"2026-10-25","streak":1e99}']) {
    const { kame } = fixture(raw);
    assert.equal(kame.memory().streak, 1);
  }
  const kame = createKame({ now: () => 0, calendar: () => new Date(2026, 9, 26), storage: {
    getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("blocked"); },
  } });
  kame.name("   " + "🐢".repeat(30) + "   ");
  assert.equal([...kame.memory().name].length, 24);
  assert.equal(trimName("  \n  "), "Kame");
  const capped = trimName("   Mizu from the very long sea name   ");
  assert.equal(capped, "Mizu from the very long");
  assert.equal(trimName(capped), capped, "reload does not change a capped name ending at a space");
  kame.dismiss(true); kame.dismiss(false); kame.call(); assert.equal(kame.state(), "follow");
});

test("hour mood boundaries and friendly three-day greeting are explicit", () => {
  assert.deepEqual([0, 5, 6, 11, 12, 18, 19, 23].map(moodAt), ["sleepy", "sleepy", "bright", "bright", "calm", "calm", "drowsy", "drowsy"]);
  const { kame } = fixture('{"lastVisit":"2026-10-25","streak":2}');
  assert.equal(kame.friendly(), true);
});
