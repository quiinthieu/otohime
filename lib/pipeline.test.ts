import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BACKFILL,
  busy,
  CAP,
  counters,
  DRAIN,
  DWELL,
  initialPipeline,
  LEG,
  pipeline,
  PLACES,
  progress,
  SPACING,
  type Packet,
  type Pipeline,
  type PipelineAction,
} from "./pipeline.ts";

const play = (s: Pipeline, ...actions: PipelineAction[]) => actions.reduce(pipeline, s);
const ticks = (n: number): PipelineAction[] => Array(n).fill("tick");
const rank = (p: Packet) => PLACES.indexOf(p.place);
const where = (s: Pipeline) => new Map(s.packets.map((p) => [p.id, p]));

// The longest any state can take to rest by ticking: every live packet through both gates, then the
// slowest walk through the pipes and the warehouse.
const LIMIT = CAP * (SPACING + DRAIN) + LEG["to-queue"] + LEG["to-warehouse"] + LEG["to-dashboard"] + DWELL + 2;
function toRest(s: Pipeline): { s: Pipeline; frames: number } {
  let frames = 0;
  while (busy(s)) {
    assert.ok(frames < LIMIT, `still busy after ${LIMIT} frames`);
    s = pipeline(s, "tick");
    frames++;
  }
  return { s, frames };
}

// A seeded generator for the fixture traces (mulberry32), so a trace is the same on every run.
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function trace(seed: number, length: number): PipelineAction[] {
  const r = seeded(seed);
  return Array.from({ length }, (): PipelineAction => {
    const x = r();
    if (x < 0.7) return "tick";
    if (x < 0.82) return "emit";
    if (x < 0.86) return "backfill";
    if (x < 0.92) return "pause";
    if (x < 0.98) return "resume";
    return "settle";
  });
}

// Every place holds every packet once: the counters add up.
function conserved(s: Pipeline, label: string) {
  const c = counters(s);
  assert.equal(c.emitted, c.waiting + c.inFlight + c.queued + c.stored + c.shown, `${label}: conservation`);
  assert.equal(c.emitted, s.nextId, label);
  assert.equal(c.lag, c.emitted - c.shown, label);
  assert.equal(s.packets.length, c.emitted - c.shown, label);
  assert.ok(s.packets.length <= CAP, `${label}: over the cap`);
  const ids = s.packets.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, `${label}: ids unique`);
  ids.forEach((id, i) => {
    assert.ok(Number.isInteger(id) && id >= 0 && id < s.nextId, `${label}: id ${id}`);
    if (i > 0) assert.ok(id > ids[i - 1], `${label}: ids in emission order`);
  });
  // first in, first out: an older packet is never behind a younger one
  s.packets.forEach((p, i) => {
    if (i > 0) assert.ok(rank(p) <= rank(s.packets[i - 1]), `${label}: packet ${p.id} overtook ${s.packets[i - 1].id}`);
  });
}

function deepFreeze(s: Pipeline): Pipeline {
  s.packets.forEach((p) => Object.freeze(p));
  Object.freeze(s.packets);
  return Object.freeze(s);
}

test("the initial pipeline is empty and at rest, and ticks leave it alone", () => {
  assert.deepEqual(counters(initialPipeline), {
    emitted: 0,
    waiting: 0,
    inFlight: 0,
    queued: 0,
    stored: 0,
    shown: 0,
    lag: 0,
    busy: false,
  });
  assert.equal(play(initialPipeline, ...ticks(50)), initialPipeline);
  assert.equal(pipeline(initialPipeline, "settle"), initialPipeline);
});

test("one packet walks every leg in order, in pinned frames", () => {
  let s = pipeline(initialPipeline, "emit");
  assert.deepEqual(s.packets, [{ id: 0, place: "source", t: 0 }]);
  const seen: string[] = [];
  let frames = 0;
  while (s.shown === 0) {
    s = pipeline(s, "tick");
    frames++;
    if (s.packets[0]) seen.push(s.packets[0].place);
  }
  const runs: [string, number][] = [];
  for (const place of seen) {
    if (runs.at(-1)?.[0] === place) runs[runs.length - 1][1]++;
    else runs.push([place, 1]);
  }
  assert.deepEqual(runs, [
    ["to-queue", LEG["to-queue"]],
    ["queue", 1],
    ["to-warehouse", LEG["to-warehouse"]],
    ["warehouse", DWELL],
    ["to-dashboard", LEG["to-dashboard"]],
  ]);
  assert.equal(frames, 24);
  assert.deepEqual(s.packets, []);
  assert.equal(busy(s), false);
  assert.equal(counters(s).lag, 0);
});

test("a packet's progress runs from 0 to 1 along its pipe and is 0 at a station", () => {
  assert.equal(progress({ id: 0, place: "to-warehouse", t: 0 }), 0);
  assert.equal(progress({ id: 0, place: "to-warehouse", t: 4 }), 0.5);
  assert.equal(progress({ id: 0, place: "to-warehouse", t: 99 }), 1);
  assert.equal(progress({ id: 0, place: "queue", t: 5 }), 0);
  let s = play(initialPipeline, "emit", "tick");
  const along: number[] = [];
  while (s.packets[0]?.place === "to-queue") {
    along.push(progress(s.packets[0]));
    s = pipeline(s, "tick");
  }
  assert.deepEqual(along, [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]);
});

test("backfill sends eight packets, spaced SPACING frames apart, and all eight reach the dashboard", () => {
  let s = pipeline(initialPipeline, "backfill");
  assert.equal(BACKFILL, 8);
  assert.deepEqual(
    s.packets.map((p) => [p.id, p.place]),
    Array.from({ length: 8 }, (_, i) => [i, "source"]),
  );
  const released: number[] = [];
  let frame = 0;
  while (busy(s)) {
    const before = counters(s).waiting;
    s = pipeline(s, "tick");
    frame++;
    if (counters(s).waiting < before) released.push(frame);
    conserved(s, `frame ${frame}`);
  }
  assert.deepEqual(released, [1, 4, 7, 10, 13, 16, 19, 22]);
  assert.ok(released.every((f, i) => i === 0 || f - released[i - 1] === SPACING));
  assert.equal(s.shown, 8);
  assert.equal(counters(s).lag, 0);
  // a second backfill gets fresh ids
  s = pipeline(s, "backfill");
  assert.deepEqual(
    s.packets.map((p) => p.id),
    [8, 9, 10, 11, 12, 13, 14, 15],
  );
});

test("paused, the queue fills and the pipeline comes to rest without draining it", () => {
  let s = play(initialPipeline, "backfill", "pause");
  let queued = 0;
  for (let f = 0; busy(s); f++) {
    assert.ok(f < LIMIT);
    s = pipeline(s, "tick");
    const c = counters(s);
    assert.ok(c.queued >= queued, "a paused queue never shrinks");
    queued = c.queued;
    assert.equal(c.shown, 0);
    assert.equal(c.inFlight + c.waiting + c.queued, 8);
  }
  assert.deepEqual(counters(s), {
    emitted: 8,
    waiting: 0,
    inFlight: 0,
    queued: 8,
    stored: 0,
    shown: 0,
    lag: 8,
    busy: false,
  });
  // at rest the clock can stop: ticks return the very same state
  assert.equal(play(s, ...ticks(200)), s);
  // more traffic while paused queues behind the first eight
  s = toRest(play(s, "emit", "emit")).s;
  assert.equal(counters(s).queued, 10);
  assert.deepEqual(
    s.packets.map((p) => p.id),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  );
});

test("pausing does not hold packets already past the queue", () => {
  // tick until two packets are past the queue, then pause
  let s = pipeline(initialPipeline, "backfill");
  while (s.packets.filter((p) => rank(p) > PLACES.indexOf("queue")).length < 2) s = pipeline(s, "tick");
  const past = s.packets.filter((p) => rank(p) > PLACES.indexOf("queue")).length;
  s = toRest(pipeline(s, "pause")).s;
  assert.equal(s.shown, past);
  assert.equal(counters(s).queued, 8 - past);
});

test("resume drains the queue in order, one packet every DRAIN frames, to the dashboard", () => {
  let s = toRest(play(initialPipeline, "backfill", "pause")).s;
  s = pipeline(s, "resume");
  assert.equal(busy(s), true);
  const departures: [frame: number, id: number][] = [];
  let frame = 0;
  while (busy(s)) {
    const before = new Set(s.packets.filter((p) => p.place === "queue").map((p) => p.id));
    s = pipeline(s, "tick");
    frame++;
    conserved(s, `frame ${frame}`);
    for (const p of s.packets) if (before.has(p.id) && p.place !== "queue") departures.push([frame, p.id]);
  }
  assert.deepEqual(
    departures.map(([, id]) => id),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  assert.ok(departures.every(([f], i) => i === 0 || f - departures[i - 1][0] === DRAIN));
  assert.equal(departures[0][0], 1, "the first packet leaves on the first frame after resume");
  assert.deepEqual(counters(s), {
    emitted: 8,
    waiting: 0,
    inFlight: 0,
    queued: 0,
    stored: 0,
    shown: 8,
    lag: 0,
    busy: false,
  });
});

test("pause and resume are idempotent", () => {
  const paused = pipeline(initialPipeline, "pause");
  assert.equal(pipeline(paused, "pause"), paused);
  assert.equal(pipeline(initialPipeline, "resume"), initialPipeline);
  assert.equal(pipeline(paused, "resume").paused, false);
});

test("unpaused, settle shows every pending packet and stops all work", () => {
  let s = play(initialPipeline, "backfill", ...ticks(14), "emit", "backfill");
  assert.ok(counters(s).inFlight > 0 && counters(s).waiting > 0);
  s = pipeline(s, "settle");
  assert.deepEqual(counters(s), {
    emitted: 17,
    waiting: 0,
    inFlight: 0,
    queued: 0,
    stored: 0,
    shown: 17,
    lag: 0,
    busy: false,
  });
  assert.equal(play(s, ...ticks(10)), s);
});

test("paused, settle keeps the queued packets queued and lands the upstream ones behind them", () => {
  let s = play(initialPipeline, "backfill", ...ticks(16), "pause", "emit");
  const before = counters(s);
  const upstream = s.packets.filter((p) => rank(p) <= PLACES.indexOf("queue")).map((p) => p.id);
  const downstream = s.packets.filter((p) => rank(p) > PLACES.indexOf("queue"));
  const queuedBefore = s.packets.filter((p) => p.place === "queue");
  assert.ok(before.queued > 0 && before.waiting > 0 && downstream.length > 0, JSON.stringify(before));
  assert.ok(s.packets.some((p) => p.place === "to-queue"), "a packet is in the pipe to the queue");
  s = pipeline(s, "settle");
  const c = counters(s);
  assert.equal(c.busy, false);
  assert.equal(c.shown, before.shown + downstream.length);
  assert.deepEqual(
    s.packets.map((p) => p.id),
    upstream,
  );
  assert.equal(c.queued, 9 - c.shown);
  // the packets that were already queued are untouched, at the head of the line
  assert.deepEqual(s.packets.slice(0, queuedBefore.length), queuedBefore);
  assert.ok(s.packets.every((p) => p.place === "queue"));
  // and the work stops: ticks change nothing until resume
  assert.equal(play(s, ...ticks(20)), s);
  const drained = toRest(pipeline(s, "resume")).s;
  assert.equal(drained.shown, 9);
});

test("settle reaches the same rest as ticking there, on seeded traces", () => {
  for (let seed = 1; seed <= 20; seed++) {
    let s = initialPipeline;
    for (const [i, action] of trace(seed, 300).entries()) {
      s = pipeline(s, action);
      if (i % 7) continue;
      const settled = pipeline(s, "settle");
      const ticked = toRest(s).s;
      const label = `seed ${seed} step ${i}`;
      assert.deepEqual(counters(settled), counters(ticked), label);
      assert.deepEqual(
        settled.packets.map((p) => [p.id, p.place]),
        ticked.packets.map((p) => [p.id, p.place]),
        label,
      );
    }
  }
});

test("seeded traces conserve packets, never skip a leg and hold a paused queue", () => {
  for (let seed = 1; seed <= 60; seed++) {
    let s = initialPipeline;
    for (const [i, action] of trace(seed, 400).entries()) {
      const prev = s;
      s = pipeline(prev, action);
      const label = `seed ${seed} step ${i} ${action}`;
      conserved(s, label);
      const before = where(prev);
      const after = where(s);

      // new packets only by emit/backfill, born at the source with fresh ids
      for (const p of s.packets)
        if (!before.has(p.id)) {
          assert.ok(action === "emit" || action === "backfill", label);
          assert.ok(p.id >= prev.nextId && p.place === "source", label);
        }
      const gone = prev.packets.filter((p) => !after.has(p.id));
      assert.equal(s.shown - prev.shown, gone.length, `${label}: shown counts the packets that left`);

      if (action === "tick" && !busy(prev)) {
        assert.equal(s, prev, `${label}: an idle tick did work`);
      } else if (action === "tick") {
        // one place at most per frame, in order; only the dashboard pipe hands packets to the dashboard
        for (const p of gone) assert.equal(p.place, "to-dashboard", label);
        for (const p of s.packets) {
          const q = before.get(p.id);
          if (!q) continue;
          if (p.place === q.place) assert.equal(p.t, q.t + 1, label);
          else assert.deepEqual([rank(p), p.t], [rank(q) + 1, 0], `${label}: packet ${p.id} skipped a leg`);
        }
      } else if (action === "settle") {
        for (const p of s.packets) assert.ok(rank(p) >= rank(before.get(p.id)!), label);
        assert.equal(busy(s), false, label);
      } else {
        // emit, backfill, pause and resume move nothing
        for (const p of prev.packets) assert.deepEqual(after.get(p.id), p, label);
      }

      // a paused queue holds every packet it had, through ticks and settles
      if (prev.paused && s.paused)
        for (const q of prev.packets) if (q.place === "queue") assert.equal(after.get(q.id)?.place, "queue", label);
    }
    // and every trace comes to rest in bounded frames, delivering all once resumed
    const end = toRest(pipeline(toRest(s).s, "resume")).s;
    assert.equal(end.shown, end.nextId, `seed ${seed}`);
  }
});

test("at most CAP packets are live: emit at the cap does nothing and backfill sends what fits", () => {
  let s = pipeline(initialPipeline, "pause");
  for (let i = 0; i < 3; i++) s = pipeline(s, "backfill");
  s = play(s, ...Array<PipelineAction>(CAP - 24 - 2).fill("emit"));
  assert.equal(s.packets.length, CAP - 2);
  s = pipeline(s, "backfill");
  assert.equal(s.packets.length, CAP);
  assert.equal(s.nextId, CAP);
  assert.equal(pipeline(s, "emit"), s);
  assert.equal(pipeline(s, "backfill"), s);
  // a full pipeline still rests in bounded frames, and drains on resume
  const rest = toRest(s);
  assert.ok(rest.frames < LIMIT);
  assert.equal(counters(rest.s).queued, CAP);
  const drained = toRest(pipeline(rest.s, "resume"));
  assert.equal(drained.s.shown, CAP);
  assert.equal(pipeline(drained.s, "emit").nextId, CAP + 1, "room again once shown");
});

test("the reducer never changes its input", () => {
  const r = seeded(7);
  const initial = JSON.stringify(initialPipeline);
  let s = deepFreeze(play(initialPipeline, "backfill", ...ticks(9), "emit"));
  for (let i = 0; i < 300; i++) {
    const copy = JSON.stringify(s);
    for (const action of ["emit", "backfill", "pause", "resume", "tick", "settle"] as const) pipeline(s, action);
    assert.equal(JSON.stringify(s), copy);
    s = deepFreeze(pipeline(s, r() < 0.8 ? "tick" : r() < 0.5 ? "pause" : r() < 0.5 ? "resume" : "emit"));
  }
  assert.equal(JSON.stringify(initialPipeline), initial, "the shared initial state is untouched");
});
