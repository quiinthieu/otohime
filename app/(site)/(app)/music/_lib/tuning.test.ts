import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  dialOrder,
  distanceKm,
  dragView,
  initialRadio,
  isSafeStreamUrl,
  LOAD_TIMEOUT_MS,
  MAX_TILT,
  nearby,
  nearest,
  nextAfterFailure,
  onAir,
  project,
  radioReducer,
  seedOf,
  settled,
  springStep,
  stepDial,
  unproject,
  viewOf,
  wobble,
  wrapLon,
  type RadioEvent,
  type RadioState,
  type Snapshot,
  type Station,
} from "./tuning.ts";

const snapshot: Snapshot = JSON.parse(readFileSync(join(import.meta.dirname, "stations.json"), "utf8"));

const st = (id: string, lat: number, lon: number, url = `https://radio.test/${id}`): Station => ({
  id,
  name: id,
  cc: "XX",
  lat,
  lon,
  url,
  codec: "MP3",
  bitrate: 128,
  homepage: null,
});

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

const LONDON = { lat: 51.5074, lon: -0.1278 };
const PARIS = { lat: 48.8566, lon: 2.3522 };
const TOKYO = { lat: 35.6762, lon: 139.6503 };

// Projection

test("the view centre projects to the middle of the disc", () => {
  const p = project(TOKYO, TOKYO);
  near(p.x, 0);
  near(p.y, 0);
  assert.equal(p.visible, true);
});

test("x grows east, y grows north, the far side is hidden", () => {
  const view = { lat: 0, lon: 0 };
  const east = project({ lat: 0, lon: 90 }, view);
  near(east.x, 1);
  near(east.y, 0);
  const north = project({ lat: 90, lon: 0 }, view);
  near(north.x, 0);
  near(north.y, 1);
  assert.equal(project({ lat: 0, lon: 180 }, view).visible, false);
  assert.equal(project({ lat: 0, lon: 135 }, view).visible, false);
  assert.equal(project({ lat: 0, lon: 45 }, view).visible, true);
});

test("projection stays on the unit disc", () => {
  const view = { lat: 23, lon: -47 };
  for (let lat = -90; lat <= 90; lat += 15) {
    for (let lon = -180; lon < 180; lon += 20) {
      const p = project({ lat, lon }, view);
      assert.ok(Math.hypot(p.x, p.y) <= 1 + 1e-12, `${lat},${lon}`);
    }
  }
});

test("unproject inverts project on the visible side and refuses off-disc points", () => {
  const view = { lat: 35, lon: 120 };
  for (const p of [TOKYO, { lat: 10, lon: 100 }, { lat: 60, lon: 150 }, { lat: -20, lon: 130 }]) {
    const xy = project(p, view);
    assert.equal(xy.visible, true);
    const back = unproject(xy.x, xy.y, view)!;
    near(back.lat, p.lat, 1e-9);
    near(back.lon, p.lon, 1e-9);
  }
  assert.equal(unproject(0.8, 0.8, view), null);
  assert.deepEqual(unproject(0, 0, view), { lat: 35, lon: 120 });
});

test("longitudes wrap to [-180, 180)", () => {
  assert.equal(wrapLon(180), -180);
  assert.equal(wrapLon(190), -170);
  assert.equal(wrapLon(-190), 170);
  assert.equal(wrapLon(720 + 5), 5);
});

test("dragging spins the globe and the tilt stops before the poles", () => {
  const r = 100;
  const right = dragView({ lat: 0, lon: 0 }, r * (Math.PI / 2), 0, r);
  near(right.lon, -90);
  near(right.lat, 0);
  assert.equal(dragView({ lat: 0, lon: 0 }, 0, 10_000, r).lat, MAX_TILT);
  assert.equal(dragView({ lat: 0, lon: 0 }, 0, -10_000, r).lat, -MAX_TILT);
  assert.deepEqual(dragView({ lat: 1, lon: 2 }, 5, 5, 0), { lat: 1, lon: 2 });
  assert.deepEqual(viewOf({ lat: 89, lon: 200 }), { lat: MAX_TILT, lon: -160 });
});

// Nearest station

test("great-circle distances match known pairs", () => {
  near(distanceKm(LONDON, PARIS), 343.5, 1);
  near(distanceKm(LONDON, TOKYO), 9559, 10);
  near(distanceKm({ lat: 0, lon: 179.5 }, { lat: 0, lon: -179.5 }), 111.2, 0.5);
  assert.equal(distanceKm(PARIS, PARIS), 0);
});

test("nearest finds the closest station across the antimeridian", () => {
  const list = [st("fiji", -17.7, 178.1), st("samoa", -13.8, -171.8), st("perth", -31.9, 115.9)];
  assert.equal(nearest(list, { lat: -16, lon: -179 })?.id, "fiji");
  assert.equal(nearest(list, { lat: -14, lon: -172 })?.id, "samoa");
});

test("nearest is deterministic: equal distance goes to the lower id, order does not matter", () => {
  const a = st("b-east", 0, 10);
  const b = st("a-west", 0, -10);
  assert.equal(nearest([a, b], { lat: 0, lon: 0 })?.id, "a-west");
  assert.equal(nearest([b, a], { lat: 0, lon: 0 })?.id, "a-west");
});

test("nearest honours exclude and range, and returns null when nothing fits", () => {
  const list = [st("london", LONDON.lat, LONDON.lon), st("paris", PARIS.lat, PARIS.lon)];
  assert.equal(nearest(list, LONDON, { exclude: new Set(["london"]) })?.id, "paris");
  assert.equal(nearest(list, TOKYO, { maxKm: 1000 }), null);
  assert.equal(nearest([], LONDON), null);
  assert.deepEqual(
    nearby(list, LONDON, 5).map((s) => s.id),
    ["london", "paris"],
  );
  assert.deepEqual(nearby(list, LONDON, 0), []);
});

test("every vendored station is its own nearest station", () => {
  for (const s of snapshot.stations) {
    const hit = nearest(snapshot.stations, s);
    assert.ok(hit && distanceKm(hit, s) === 0, s.id);
  }
});

// Dial

test("the dial runs west to east and follows slider keys", () => {
  const order = dialOrder([st("tokyo", TOKYO.lat, TOKYO.lon), st("london", LONDON.lat, LONDON.lon), st("paris", PARIS.lat, PARIS.lon)]);
  assert.deepEqual(
    order.map((s) => s.id),
    ["london", "paris", "tokyo"],
  );
  assert.equal(stepDial(0, "ArrowRight", 3), 1);
  assert.equal(stepDial(0, "ArrowUp", 3), 1);
  assert.equal(stepDial(0, "ArrowLeft", 3), 0, "clamps at the west end");
  assert.equal(stepDial(2, "ArrowRight", 3), 2, "clamps at the east end");
  assert.equal(stepDial(1, "Home", 3), 0);
  assert.equal(stepDial(1, "End", 3), 2);
  assert.equal(stepDial(0, "PageUp", 240), 24);
  assert.equal(stepDial(30, "PageDown", 240), 6);
  assert.equal(stepDial(0, "Enter", 3), null);
  assert.equal(stepDial(0, "ArrowRight", 0), null);
});

test("dial order is total over the snapshot", () => {
  const order = dialOrder(snapshot.stations);
  assert.equal(new Set(order.map((s) => s.id)).size, snapshot.stations.length);
  assert.deepEqual(dialOrder([...snapshot.stations].reverse()), order);
});

// Needle

test("the needle spring settles on the target without running away", () => {
  let s = { x: 0, v: 0 };
  let peak = 0;
  for (let i = 0; i < 240; i++) {
    s = springStep(s, 1, 1 / 60);
    peak = Math.max(peak, s.x);
  }
  assert.ok(settled(s, 1), JSON.stringify(s));
  assert.ok(peak > 1 && peak < 1.5, `a little overshoot, got ${peak}`);
  const once = springStep({ x: 0, v: 0 }, 1, 10);
  assert.deepEqual(once, springStep({ x: 0, v: 0 }, 1, 1 / 20), "a long frame is clamped");
});

test("wobble is seeded by the station id and bounded", () => {
  assert.equal(seedOf("abc"), seedOf("abc"));
  assert.notEqual(seedOf("abc"), seedOf("abd"));
  const a = seedOf(snapshot.stations[0].id);
  const b = seedOf(snapshot.stations[1].id);
  assert.equal(wobble(a, 1.25), wobble(a, 1.25));
  assert.notEqual(wobble(a, 1.25), wobble(b, 1.25));
  for (let t = 0; t < 60; t += 0.1) assert.ok(Math.abs(wobble(a, t)) <= 1);
});

// Stream safety

test("only direct https streams are playable", () => {
  assert.equal(isSafeStreamUrl("https://radio.test/live.mp3"), true);
  assert.equal(isSafeStreamUrl("https://radio.test:8443/;"), true);
  assert.equal(isSafeStreamUrl("http://radio.test/live.mp3"), false);
  assert.equal(isSafeStreamUrl("https://user:pw@radio.test/live"), false);
  assert.equal(isSafeStreamUrl("https://radio.test/live.m3u8"), false);
  assert.equal(isSafeStreamUrl("https://radio.test/list.pls"), false);
  assert.equal(isSafeStreamUrl("javascript:alert(1)"), false);
  assert.equal(isSafeStreamUrl("//radio.test/live"), false);
  assert.equal(isSafeStreamUrl("not a url"), false);
});

// Playback state machine

const LIST = [st("london", LONDON.lat, LONDON.lon), st("paris", PARIS.lat, PARIS.lon), st("tokyo", TOKYO.lat, TOKYO.lon), st("plain", 40, 0, "http://radio.test/plain")];
const run = (events: RadioEvent[], from: RadioState = initialRadio) => events.reduce((s, e) => radioReducer(s, e, LIST), from);

test("tuning never starts sound; only play does", () => {
  const tuned = run([{ type: "tune", id: "london" }, { type: "tune", id: "paris" }]);
  assert.equal(tuned.status, "idle");
  assert.equal(tuned.station, "paris");
  assert.equal(tuned.attempt, 0);
  assert.equal(run([{ type: "play" }]).status, "idle", "play with nothing tuned does nothing");
  const loading = run([{ type: "play" }], tuned);
  assert.equal(loading.status, "loading");
  assert.equal(loading.attempt, 1);
  assert.equal(onAir(loading), false, "the lamp waits for real audio");
});

test("the lamp lights on the current attempt's playing event only", () => {
  const loading = run([{ type: "tune", id: "london" }, { type: "play" }]);
  assert.equal(run([{ type: "playing", attempt: 0 }], loading).status, "loading", "a stale event is ignored");
  const playing = run([{ type: "playing", attempt: loading.attempt }], loading);
  assert.equal(playing.status, "playing");
  assert.equal(onAir(playing), true);
  const stopped = run([{ type: "stop" }], playing);
  assert.equal(stopped.status, "idle");
  assert.equal(stopped.station, "london");
  assert.equal(onAir(stopped), false);
});

test("tuning on air switches the stream with a new attempt", () => {
  const playing = run([{ type: "tune", id: "london" }, { type: "play" }, { type: "playing", attempt: 1 }]);
  const switched = run([{ type: "tune", id: "paris" }], playing);
  assert.equal(switched.status, "loading");
  assert.equal(switched.station, "paris");
  assert.equal(switched.attempt, 2);
  assert.equal(run([{ type: "playing", attempt: 1 }], switched).status, "loading", "the old stream cannot light the lamp");
  assert.equal(run([{ type: "tune", id: "paris" }], switched), switched, "re-tuning the same station is a no-op");
});

for (const reason of ["error", "stalled", "timeout"] as const) {
  test(`${reason} while loading gives no signal and marks the station bad`, () => {
    const loading = run([{ type: "tune", id: "london" }, { type: "play" }]);
    const failed = run([{ type: "fail", reason, attempt: loading.attempt }], loading);
    assert.equal(failed.status, "no-signal");
    assert.equal(failed.reason, reason);
    assert.deepEqual(failed.bad, ["london"]);
    assert.equal(onAir(failed), false);
  });
}

test("stale failures, and stalls while playing, are ignored; an error while playing is not", () => {
  const loading = run([{ type: "tune", id: "london" }, { type: "play" }]);
  assert.equal(run([{ type: "fail", reason: "error", attempt: 0 }], loading), loading);
  const playing = run([{ type: "playing", attempt: 1 }], loading);
  assert.equal(run([{ type: "fail", reason: "stalled", attempt: 1 }], playing), playing);
  assert.equal(run([{ type: "fail", reason: "timeout", attempt: 1 }], playing), playing);
  assert.equal(run([{ type: "fail", reason: "error", attempt: 1 }], playing).status, "no-signal");
  const idle = run([{ type: "stop" }], playing);
  assert.equal(run([{ type: "fail", reason: "error", attempt: 1 }], idle), idle, "nothing fails after stop");
});

test("a bad station is never loaded again: no retry loop", () => {
  const failed = run([{ type: "tune", id: "london" }, { type: "play" }, { type: "fail", reason: "timeout", attempt: 1 }]);
  const again = run([{ type: "play" }], failed);
  assert.equal(again.status, "no-signal");
  assert.equal(again.reason, "known-bad");
  assert.equal(again.attempt, 1, "no new load was started");
  const back = run([{ type: "tune", id: "paris" }, { type: "tune", id: "london" }, { type: "play" }], failed);
  assert.equal(back.status, "no-signal");
  assert.equal(back.attempt, 1);
});

test("an http or unknown station is blocked without loading", () => {
  const http = run([{ type: "tune", id: "plain" }, { type: "play" }]);
  assert.equal(http.status, "no-signal");
  assert.equal(http.reason, "blocked");
  assert.equal(http.attempt, 0);
  assert.deepEqual(http.bad, ["plain"]);
  const unknown = run([{ type: "tune", id: "nowhere" }, { type: "play" }]);
  assert.equal(unknown.reason, "blocked");
});

test("after no signal the suggestion is the nearest station that has not failed", () => {
  const failed = run([{ type: "tune", id: "london" }, { type: "play" }, { type: "fail", reason: "error", attempt: 1 }]);
  assert.equal(nextAfterFailure(failed, LIST)?.id, "paris");
  const both = run([{ type: "tune", id: "paris" }, { type: "play" }, { type: "fail", reason: "error", attempt: 2 }], failed);
  assert.deepEqual(both.bad, ["london", "paris"]);
  assert.equal(nextAfterFailure(both, LIST)?.id, "tokyo", "skips the failed and the http station");
  assert.equal(nextAfterFailure(initialRadio, LIST), null);
});

test("the load timeout is eight seconds", () => {
  assert.equal(LOAD_TIMEOUT_MS, 8000);
});
