import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  candidates,
  checkSnapshot,
  cleanName,
  LICENSE,
  MAX_STATIONS,
  PER_COUNTRY,
  select,
  SOURCE,
  toStation,
  type RawStation,
} from "../../../../../scripts/vendor-radio.ts";
import { isSafeStreamUrl, type Snapshot } from "./tuning.ts";

const ROOT = join(import.meta.dirname, "../../../../..");
const FILE = join(import.meta.dirname, "stations.json");
const text = readFileSync(FILE, "utf8");
const snapshot: Snapshot = JSON.parse(text);

function runCheck(file: string) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      join(ROOT, "scripts/vendor-radio.ts"),
      "--check",
      `--file=${file}`,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
}

let n = 0;
const raw = (over: Partial<RawStation> = {}): RawStation => {
  n++;
  return {
    stationuuid: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    name: `Station ${n}`,
    url_resolved: `https://radio.test/${n}.mp3`,
    homepage: "https://radio.test/",
    tags: "pop",
    countrycode: "FR",
    codec: "MP3",
    bitrate: 128,
    hls: 0,
    lastcheckok: 1,
    ssl_error: 0,
    geo_lat: 48.8566,
    geo_long: 2.3522,
    clickcount: 100,
    votes: 10,
    ...over,
  };
};

// The committed snapshot

test("the committed snapshot passes every rule", () => {
  assert.deepEqual(checkSnapshot(text), []);
});

test("the snapshot names its source, licence and retrieval date", () => {
  assert.equal(snapshot.source, SOURCE);
  assert.equal(snapshot.license, LICENSE);
  assert.match(snapshot.license, /public domain/);
  assert.ok(Date.parse(snapshot.retrieved) > Date.parse("2026-10-01T00:00:00Z"));
});

test("every station is a direct https MP3/AAC stream with real coordinates", () => {
  for (const s of snapshot.stations) {
    assert.ok(isSafeStreamUrl(s.url), s.url);
    assert.ok(s.url.startsWith("https://"), s.url);
    assert.ok(s.codec === "MP3" || s.codec === "AAC", s.codec);
    assert.ok(Math.abs(s.lat) <= 90 && Math.abs(s.lon) <= 180, s.id);
    assert.ok(s.homepage === null || s.homepage.startsWith("https://"), s.id);
  }
});

test("the snapshot spreads across the globe, at most two per country", () => {
  const per = new Map<string, number>();
  for (const s of snapshot.stations) per.set(s.cc, (per.get(s.cc) ?? 0) + 1);
  assert.ok(per.size >= 100, `${per.size} countries`);
  assert.ok(Math.max(...per.values()) <= PER_COUNTRY);
  const lons = snapshot.stations.map((s) => s.lon);
  const lats = snapshot.stations.map((s) => s.lat);
  assert.ok(Math.min(...lons) < -100 && Math.max(...lons) > 100, "both hemispheres east and west");
  assert.ok(Math.min(...lats) < -30 && Math.max(...lats) > 50, "both hemispheres north and south");
});

test("radio:check passes the committed file", () => {
  const run = runCheck(FILE);
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /pass/);
});

test("radio:check fails tampered or missing snapshots", () => {
  const dir = mkdtempSync(join(tmpdir(), "radio-check-"));
  try {
    const first = snapshot.stations[0];
    const cases: [string, string, RegExp][] = [
      ["http", text.replace(JSON.stringify(first.url), JSON.stringify(first.url.replace("https:", "http:"))), /direct https/],
      ["hls", text.replace(JSON.stringify(first.url), JSON.stringify("https://radio.test/live.m3u8")), /direct https/],
      ["codec", text.replace(`"codec":"${first.codec}"`, `"codec":"OGG"`), /codec OGG/],
      ["lat", text.replace(`"lat":${first.lat},`, `"lat":91,`), /coordinates/],
      ["order", text.replace(/\n {4}(\{.*\}),\n {4}(\{.*\}),/, "\n    $2,\n    $1,"), /canonical/],
      ["licence", text.replace("public domain", "all rights reserved"), /license/],
      ["not json", "{", /not JSON/],
    ];
    for (const [name, body, why] of cases) {
      assert.notEqual(body, text, `${name}: the tamper changed the file`);
      const file = join(dir, `${name}.json`);
      writeFileSync(file, body);
      const run = runCheck(file);
      assert.equal(run.status, 1, `${name} should fail`);
      assert.match(run.stderr, why, name);
    }
    const missing = runCheck(join(dir, "missing.json"));
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /missing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a duplicated or extra station breaks the rules", () => {
  const dup: Snapshot = { ...snapshot, stations: [snapshot.stations[0], ...snapshot.stations] };
  assert.ok(checkSnapshot(JSON.stringify(dup)).some((e) => /duplicate id/.test(e)));
  const third = { ...snapshot.stations[0], id: "ffffffff-ffff-4fff-8fff-ffffffffffff", url: "https://radio.test/x" };
  const crowded: Snapshot = {
    ...snapshot,
    stations: [...snapshot.stations, { ...third, cc: snapshot.stations[0].cc }, { ...third, id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", url: "https://radio.test/y" }],
  };
  assert.ok(checkSnapshot(JSON.stringify(crowded)).some((e) => /at most 2/.test(e)));
});

// Curation, with no network

test("curation keeps a healthy https MP3 station and normalises it", () => {
  const s = toStation(raw({ name: "  ♫  Radio   Ink ★ ", geo_lat: 48.856613, codec: "AAC+" }));
  assert.ok(s);
  assert.equal(s.name, "Radio Ink");
  assert.equal(s.lat, 48.857);
  assert.equal(s.codec, "AAC");
  assert.equal(s.homepage, "https://radio.test/");
});

test("curation rejects http, HLS, broken, ungeolocated, odd codecs and adult content", () => {
  const rejects: [string, Partial<RawStation>][] = [
    ["http stream", { url_resolved: "http://radio.test/live.mp3" }],
    ["playlist", { url_resolved: "https://radio.test/live.pls" }],
    ["hls flag", { hls: 1 }],
    ["hls url", { url_resolved: "https://radio.test/live.m3u8" }],
    ["last check failed", { lastcheckok: 0 }],
    ["ssl error", { ssl_error: 1 }],
    ["no geo", { geo_lat: null }],
    ["null island", { geo_lat: 0, geo_long: 0 }],
    ["ogg", { codec: "OGG" }],
    ["unknown codec", { codec: "UNKNOWN" }],
    ["adult tag", { tags: "pop,xxx" }],
    ["adult name", { name: "Radio 18+ Nights" }],
    ["bad country", { countrycode: "" }],
    ["blocked country", { countrycode: "UM" }],
    ["sanctioned cdn", { url_resolved: "https://icecast-rian.cdnvideo.ru/voicerus" }],
    ["blocked id", { stationuuid: "2678a502-9a27-4774-a549-e00091878051" }],
    ["symbols only", { name: "★★★" }],
    ["tiny bitrate", { bitrate: 16 }],
  ];
  for (const [why, over] of rejects) assert.equal(toStation(raw(over)), null, why);
  assert.ok(toStation(raw({ tags: "adult contemporary,pop" })), "adult contemporary is an ordinary format");
  assert.equal(toStation(raw({ homepage: "http://radio.test/" }))!.homepage, null, "http homepages are dropped");
});

test("names are cleaned and capped", () => {
  assert.equal(cleanName("# TOP 100 CLUB"), "TOP 100 CLUB");
  assert.equal(cleanName("Radio\u0000​Ink"), "RadioInk");
  const long = cleanName("x".repeat(80));
  assert.equal(long.length, 48);
  assert.ok(long.endsWith("…"));
  assert.equal(cleanName(long), long, "cleaning is idempotent");
});

test("candidates rank by popularity and drop repeated streams and names", () => {
  const a = raw({ clickcount: 5 });
  const b = raw({ clickcount: 50 });
  const sameUrl = raw({ clickcount: 1, url_resolved: b.url_resolved });
  const sameName = raw({ clickcount: 2, name: b.name });
  const jp = raw({ countrycode: "JP", geo_lat: 35.6, geo_long: 139.6 });
  const c = candidates([a, sameUrl, b, sameName, jp]);
  assert.deepEqual(
    c.groups.get("FR")!.map((s) => s.id),
    [b.stationuuid, a.stationuuid],
  );
  assert.equal(c.groups.get("JP")!.length, 1);
  assert.ok(c.rank.get(b.stationuuid)! < c.rank.get(a.stationuuid)!);
});

test("selection takes live streams only, two per country, popular seconds first", async () => {
  const rows = [
    raw({ countrycode: "FR", clickcount: 90 }),
    raw({ countrycode: "FR", clickcount: 80 }),
    raw({ countrycode: "FR", clickcount: 70 }),
    raw({ countrycode: "JP", clickcount: 60, geo_lat: 35.6, geo_long: 139.6 }),
    raw({ countrycode: "JP", clickcount: 50, geo_lat: 34.7, geo_long: 135.5 }),
  ];
  const dead = new Set([rows[0].stationuuid]);
  const probed: string[] = [];
  const picked = await select(candidates(rows), async (s) => {
    probed.push(s.id);
    return dead.has(s.id) ? null : "MP3";
  });
  assert.deepEqual(
    picked.map((s) => s.id).sort(),
    [rows[1], rows[2], rows[3], rows[4]].map((r) => r.stationuuid).sort(),
  );
  assert.ok(!picked.some((s) => dead.has(s.id)), "a dead stream is never kept");
  assert.equal(new Set(probed).size, probed.length, "no stream is probed twice");
  assert.ok(picked.length <= MAX_STATIONS);
});

test("the probe's codec wins over the directory's", async () => {
  const [s] = await select(candidates([raw({ codec: "MP3" })]), async () => "AAC");
  assert.equal(s.codec, "AAC");
});

test("selection does not depend on probe timing", async () => {
  const rows = Array.from({ length: 30 }, (_, i) => raw({ countrycode: `A${String.fromCharCode(65 + (i % 10))}`, clickcount: 100 - i }));
  const c = candidates(rows);
  const slowFirst = await select(c, async (s) => {
    await new Promise((r) => setTimeout(r, (seedLike(s.id) % 5) * 2));
    return "MP3";
  });
  const instant = await select(c, async () => "MP3");
  assert.deepEqual(slowFirst, instant);
});

function seedLike(id: string) {
  return [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
}
