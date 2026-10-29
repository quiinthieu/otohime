import assert from "node:assert/strict";
import { test } from "node:test";
import { FINDS, STICKERS } from "../content/stickers.ts";
import { claimFind, DAILY_COIN_CAP, drawSticker, explore, freshCollection, KONAMI, matchKonami, nextBatch, parseCollection, placeSticker, stockBoard } from "./gashapon.ts";

test("finite stock: every displayed probability matches draws through exhaustion, persists and cannot reroll", () => {
  let s = { ...freshCollection(), coins: 999 };
  const initial = Object.values(s.stock).reduce((a, b) => a + b, 0);
  for (let i = 0; i < initial; i++) {
    const board = stockBoard(s), total = initial - i;
    assert.equal(board.reduce((n, x) => n + x.remaining, 0), total);
    assert.ok(Math.abs(board.reduce((n, x) => n + x.odds, 0) - 1) < 1e-10);
    const before = s;
    s = drawSticker(s, (i * 0.61803398875) % 1);
    assert.equal(s.coins, before.coins - 1);
    assert.deepEqual(parseCollection(JSON.stringify(s)), s);
    assert.equal(nextBatch(s).batch, i === initial - 1 ? 2 : 1);
  }
  assert.equal(Object.values(s.owned).reduce((a, b) => a + b, 0), initial);
  assert.ok(Object.values(s.owned).some(n => n > 1));
  assert.equal(drawSticker(s, 0), s);
  assert.equal(stockBoard(s).reduce((n, x) => n + x.odds, 0), 0);
  const empty = freshCollection();
  assert.equal(drawSticker(empty, 0), empty);
});
test("exploration is bounded per day, unique after reload; finds grant exactly once", () => {
  let s = freshCollection();
  for (let i = 0; i < 20; i++) s = explore(s, `/notes/${i}`, "2026-10-29");
  assert.equal(s.coins, DAILY_COIN_CAP);
  assert.equal(explore(s, "/notes/0", s.day), s);
  s = explore(parseCollection(JSON.stringify(s)), "/notes/0", "2026-10-30");
  assert.equal(s.coins, DAILY_COIN_CAP + 1);
  s = claimFind(s, FINDS.notes);
  assert.equal(claimFind(s, FINDS.notes), s);
  assert.equal(s.owned[FINDS.notes], 1);
  assert.equal(explore(s, "/admin/users", s.day), s);
});
test("versioned state rejects corrupt stock, unknown versions, nonfinite placements and unowned copies", () => {
  for (const raw of ["{", "null", '{"version":2}', JSON.stringify({ ...freshCollection(), stock: {} }), JSON.stringify({ ...freshCollection(), coins: -1 })]) assert.deepEqual(parseCollection(raw), freshCollection());
  const s = claimFind(freshCollection(), FINDS.notes);
  const p = { copy: `${FINDS.notes}:0`, id: FINDS.notes, x: 2, y: -1, rotation: 0 };
  const placed = placeSticker(s, p);
  assert.deepEqual([placed.album[0].x, placed.album[0].y], [1, 0]);
  assert.deepEqual(parseCollection(JSON.stringify(placed)), placed);
  assert.equal(placeSticker(s, { ...p, copy: `${p.id}:1` }), s);
  assert.equal(placeSticker(s, { ...p, x: NaN }), s);
  assert.equal(STICKERS.length, 40);
});
test("Konami handles overlapping prefixes, resets in forms and requires full sequence", () => {
  let h: string[] = [];
  for (const key of ["ArrowUp", ...KONAMI]) h = matchKonami(h, key);
  assert.deepEqual(h, KONAMI);
  assert.deepEqual(matchKonami(h, "x", true), []);
  assert.deepEqual(matchKonami([], "a"), []);
});
