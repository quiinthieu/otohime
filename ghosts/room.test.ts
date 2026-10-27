// The pure ink-ghosts room with an injected clock and id source: cap, fan-out to others only, the 15/s token
// bucket over every attempt, five invalid strikes, leave/bye, and restoring members from attachments (what the
// Durable Object does after hibernation) without losing a limit or a penalty.
import assert from "node:assert/strict";
import { test } from "node:test";
import { CLOSE_FULL, CLOSE_POLICY, MAX_INVALID, RATE_CAPACITY, ROOM_CAP } from "./protocol.ts";
import { Room, readMemberState, type Effect, type MemberState } from "./room.ts";

function clock(start = 1_000_000) {
  let t = start;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
}

function ids() {
  let n = 0;
  return () => `id-${++n}`;
}

const sends = (effects: Effect[]) => effects.filter((e) => e.kind === "send").map((e) => [e.to, e.msg]);
const closes = (effects: Effect[]) => effects.filter((e) => e.kind === "close").map((e) => [e.to, e.code]);
const move = (x: number, y: number) => JSON.stringify({ t: "m", x, y });

test("join greets the newcomer with its server id and tells the others the count", () => {
  const room = new Room(clock());
  const next = ids();
  const a = next();
  const first = room.join(a);
  assert.equal(first.ok, true);
  assert.deepEqual(sends(first.effects), [[a, { t: "hi", id: a, n: 1 }]]);
  const b = next();
  const second = room.join(b);
  assert.deepEqual(sends(second.effects), [
    [b, { t: "hi", id: b, n: 2 }],
    [a, { t: "n", n: 2 }],
  ]);
});

test("the room holds 24; the 25th is told full and closed 1013 without joining", () => {
  const room = new Room(clock());
  const next = ids();
  for (let i = 0; i < ROOM_CAP; i++) assert.equal(room.join(next()).ok, true);
  const extra = next();
  const result = room.join(extra);
  assert.equal(result.ok, false);
  assert.deepEqual(sends(result.effects), [[extra, { t: "full" }]]);
  assert.deepEqual(closes(result.effects), [[extra, CLOSE_FULL]]);
  assert.equal(room.size, ROOM_CAP);
  assert.equal(room.has(extra), false);
  // A seat frees when someone leaves.
  room.leave("id-1");
  assert.equal(room.join(next()).ok, true);
});

test("a duplicate id cannot join twice", () => {
  const room = new Room(clock());
  room.join("same");
  assert.equal(room.join("same").ok, false);
  assert.equal(room.size, 1);
});

test("accepted moves and clicks reach the other members only, with the server id", () => {
  const room = new Room(clock());
  room.join("a");
  room.join("b");
  room.join("c");
  const result = room.receive("a", JSON.stringify({ t: "c", x: 2, y: 0.5, id: "spoof" }));
  assert.equal(result.outcome, "accepted");
  assert.deepEqual(sends(result.effects), [
    ["b", { t: "c", id: "a", x: 1, y: 0.5 }],
    ["c", { t: "c", id: "a", x: 1, y: 0.5 }],
  ]);
  const lone = new Room(clock());
  lone.join("solo");
  assert.deepEqual(lone.receive("solo", move(0.1, 0.1)).effects, [], "a lone member echoes nothing");
});

test("15 frames pass in a burst, the 16th is dropped, and tokens refill at 15/s", () => {
  const time = clock();
  const room = new Room(time);
  room.join("a");
  room.join("b");
  for (let i = 0; i < RATE_CAPACITY; i++) assert.equal(room.receive("a", move(0.5, 0.5)).outcome, "accepted");
  const dropped = room.receive("a", move(0.5, 0.5));
  assert.equal(dropped.outcome, "rate");
  assert.deepEqual(dropped.effects, [], "rate overflow fans out nothing");
  time.advance(66); // 0.99 tokens: still short
  assert.equal(room.receive("a", move(0.5, 0.5)).outcome, "rate");
  time.advance(1); // the 0.99 kept from above plus 1 ms is one whole token
  assert.equal(room.receive("a", move(0.5, 0.5)).outcome, "accepted");
  assert.equal(room.receive("a", move(0.5, 0.5)).outcome, "rate");
});

test("refill caps at capacity after a long silence", () => {
  const time = clock();
  const room = new Room(time);
  room.join("a");
  time.advance(60_000);
  let accepted = 0;
  for (let i = 0; i < 40; i++) if (room.receive("a", move(0.1, 0.2)).outcome === "accepted") accepted++;
  assert.equal(accepted, RATE_CAPACITY);
});

test("invalid frames spend tokens too: a flood of garbage is rate limited before it is parsed", () => {
  const room = new Room(clock());
  room.join("a");
  for (let i = 0; i < MAX_INVALID - 1; i++) assert.equal(room.receive("a", "garbage").outcome, "invalid");
  for (let i = 0; i < RATE_CAPACITY - (MAX_INVALID - 1); i++) room.receive("a", move(0.1, 0.1));
  assert.equal(room.receive("a", "garbage").outcome, "rate", "an empty bucket drops even an invalid frame");
  assert.equal(room.snapshot("a")?.invalid, MAX_INVALID - 1);
});

test("the fifth invalid frame closes 1008; binary, oversize and malformed all count", () => {
  const room = new Room(clock());
  room.join("a");
  room.join("b");
  const frames: unknown[] = ["nope", new Uint8Array([1, 2]), "x".repeat(200), '{"t":"m","x":"1","y":0}'];
  for (const frame of frames) {
    const result = room.receive("a", frame);
    assert.equal(result.outcome, "invalid");
    assert.deepEqual(result.effects, [], "invalid frames fan out nothing");
  }
  const last = room.receive("a", "{");
  assert.equal(last.outcome, "closed");
  assert.deepEqual(closes(last.effects), [["a", CLOSE_POLICY]]);
  // Until the adapter reports the close, any further frame only repeats the close.
  const after = room.receive("a", move(0.2, 0.2));
  assert.equal(after.outcome, "closed");
  assert.deepEqual(sends(after.effects), []);
});

test("valid frames do not reset the strike count", () => {
  const room = new Room(clock());
  room.join("a");
  for (let i = 0; i < MAX_INVALID - 1; i++) {
    room.receive("a", "bad");
    room.receive("a", move(0.3, 0.3));
  }
  assert.equal(room.receive("a", "bad").outcome, "closed");
});

test("leave sends bye and the new count to the others, once", () => {
  const room = new Room(clock());
  room.join("a");
  room.join("b");
  room.join("c");
  assert.deepEqual(sends(room.leave("b")), [
    ["a", { t: "bye", id: "b" }],
    ["a", { t: "n", n: 2 }],
    ["c", { t: "bye", id: "b" }],
    ["c", { t: "n", n: 2 }],
  ]);
  assert.deepEqual(room.leave("b"), [], "idempotent: a close after an error does not repeat bye");
  assert.deepEqual(room.receive("b", move(0.1, 0.1)), { outcome: "unknown", member: null, effects: [] });
});

test("restoring members from attachments keeps the cap, the bucket and the strikes", () => {
  const time = clock();
  const first = new Room(time);
  const attachments = new Map<string, MemberState>();
  for (let i = 1; i <= ROOM_CAP; i++) {
    const joined = first.join(`m${i}`);
    assert.ok(joined.ok);
    attachments.set(joined.member.id, joined.member);
  }
  for (let i = 0; i < RATE_CAPACITY; i++) attachments.set("m1", first.receive("m1", move(0.5, 0.5)).member!);
  for (let i = 0; i < MAX_INVALID - 1; i++) attachments.set("m2", first.receive("m2", "bad").member!);

  // A new instance (hibernation wake) sees only the attachments.
  const second = new Room(time);
  for (const state of attachments.values()) assert.equal(second.restore(readMemberState(JSON.parse(JSON.stringify(state)))!), true);
  assert.equal(second.size, ROOM_CAP);
  assert.equal(second.join("late").ok, false, "still full");
  assert.equal(second.receive("m1", move(0.5, 0.5)).outcome, "rate", "the drained bucket stays drained");
  assert.equal(second.receive("m2", "bad").outcome, "closed", "four strikes plus one closes");
  const peer = second.receive("m3", move(0.4, 0.6));
  assert.equal(peer.outcome, "accepted");
  assert.equal(sends(peer.effects).length, ROOM_CAP - 1, "fan-out still reaches every restored member");
  assert.equal(second.restore({ id: "m3", tokens: 1, at: 0, invalid: 0 }), false, "no double restore");
});

test("attachments hold exactly id, tokens, at and invalid; anything else is not restored", () => {
  const room = new Room(clock());
  const joined = room.join("a");
  assert.ok(joined.ok);
  assert.deepEqual(Object.keys(joined.member).sort(), ["at", "id", "invalid", "tokens"]);
  const result = room.receive("a", move(0.9, 0.1));
  assert.deepEqual(Object.keys(result.member!).sort(), ["at", "id", "invalid", "tokens"], "no coordinates kept");
  assert.equal(JSON.stringify(result.member).includes("0.9"), false);
  for (const bad of [
    null,
    "a",
    [],
    { id: "a", tokens: 1, at: 0 },
    { id: "a", tokens: 1, at: 0, invalid: 0, x: 0.5 },
    { id: "", tokens: 1, at: 0, invalid: 0 },
    { id: "a", tokens: 99, at: 0, invalid: 0 },
    { id: "a", tokens: -1, at: 0, invalid: 0 },
    { id: "a", tokens: 1, at: "now", invalid: 0 },
    { id: "a", tokens: 1, at: 0, invalid: 0.5 },
  ]) {
    assert.equal(readMemberState(bad), null, JSON.stringify(bad));
  }
  assert.deepEqual(readMemberState({ invalid: 2, at: 5, tokens: 3, id: "b" }), { id: "b", tokens: 3, at: 5, invalid: 2 });
});

test("a clock that goes backwards never mints tokens", () => {
  const time = clock();
  const room = new Room(time);
  room.join("a");
  for (let i = 0; i < RATE_CAPACITY; i++) room.receive("a", move(0.1, 0.1));
  time.advance(-5_000);
  assert.equal(room.receive("a", move(0.1, 0.1)).outcome, "rate");
});

for (const reconstruct of [false, true]) {
  test(`rollback and recovery preserve the bucket time high-water mark${reconstruct ? " across attachment restoration" : ""}`, () => {
    const time = clock();
    let room = new Room(time);
    room.join("a");
    for (let i = 0; i < RATE_CAPACITY; i++) room.receive("a", move(0.1, 0.1));
    const drained = room.snapshot("a")!;
    time.advance(-5_000);
    assert.equal(room.receive("a", move(0.1, 0.1)).outcome, "rate");
    const attachment = readMemberState(JSON.parse(JSON.stringify(room.snapshot("a"))))!;
    assert.equal(attachment.at, drained.at, "a rolled-back attempt must retain the prior timestamp");
    assert.deepEqual(Object.keys(attachment).sort(), ["at", "id", "invalid", "tokens"]);
    if (reconstruct) {
      room = new Room(time);
      assert.equal(room.restore(attachment), true);
    }
    time.advance(5_000);
    assert.equal(room.receive("a", move(0.1, 0.1)).outcome, "rate", "recovery to T refills nothing");
    time.advance(66);
    assert.equal(room.receive("a", move(0.1, 0.1)).outcome, "rate", "T+66 ms is still short");
    time.advance(1);
    assert.equal(room.receive("a", move(0.1, 0.1)).outcome, "accepted", "T+67 ms refills one token");
    assert.equal(room.receive("a", move(0.1, 0.1)).outcome, "rate", "only one token was refilled");
  });
}
