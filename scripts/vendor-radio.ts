// Vendors a curated station snapshot from Radio Browser (radio-browser.info,
// data in the public domain) into app/(site)/(app)/music/_lib/stations.json.
// Run by hand and commit the output; the site never calls the directory.
//   npm run radio:vendor   fetch, curate, probe every stream, write the file
//   npm run radio:check    offline: exit 1 if the committed file breaks a rule
// --file=<path> reads or writes another file (the tests check tampered copies).
//
// Curation: direct HTTPS MP3/AAC streams (no HLS, no playlists) the directory
// last saw working, with real coordinates, no adult words, up to two per
// country by popularity, each one answered with audio bytes when probed here.
import { promises as dns } from "node:dns";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isSafeStreamUrl, type Snapshot, type Station } from "../app/(site)/(app)/music/_lib/tuning.ts";

const DEFAULT_FILE = join(import.meta.dirname, "../app/(site)/(app)/music/_lib/stations.json");
const AGENT = "otohime.dev/1.0 (vendor-radio; +https://otohime.dev/music)";
export const SOURCE = "Radio Browser, https://www.radio-browser.info";
export const LICENSE =
  "Station data: public domain (radio-browser.info). Streams, names' content and homepages belong to the stations.";
export const QUERY = "/json/stations/search?hidebroken=true&has_geo_info=true&is_https=true&order=clickcount&reverse=true&limit=10000";
export const PER_COUNTRY = 2;
export const MAX_STATIONS = 240;
export const MIN_STATIONS = 120;
const NAME_MAX = 48;
// "adult" is left out on purpose: "adult contemporary" is an ordinary format.
const BLOCKED_WORDS = /(^|[^\p{L}\p{N}])(sex|sexy|xxx|porn|porno|erotic|erotica|nsfw|hentai|18\+)(?![\p{L}\p{N}])/iu;
// Hand-curated removals by stationuuid, with the reason beside each. Reviewed
// against the 2026-10-25 directory; re-read the output after every vendor run.
const BLOCKED_IDS: ReadonlySet<string> = new Set<string>([
  "319a9758-9b6b-4aa6-8415-432e43c46d1e", // Exclusively Madonna: AE, pinned in the Red Sea
  "deee9775-41ff-4e36-8b1f-2b8e601eb3e7", // KISS FM Nederland: Amsterdam filed as Bonaire (BQ)
  "7758bd16-da9a-40db-9333-48a550b0801f", // BitrRcord: CY, pinned in Ukraine
  "a798586c-efc8-4f2b-ae3c-74729ce0f085", // Offshore Radio: Dutch station filed as Marshall Islands
  "c3ccfb01-d0e4-41e0-af53-2ce1f02a568c", // Radio linea de refugio: NI, pinned in Greenland
  "8d79497f-6f50-486a-bacd-97bf47cb7e65", // 93.7 KHJ Oldies: Los Angeles filed as US Minor Islands
  "af566e6b-3d2b-4b96-92ca-a9cb183e6fd8", // Free FM Tokyo: streams a Madrid station
  "12f00053-c258-4194-84fd-dcf1e36c02ea", // Jeddah: an uploaded file, not a station
  "2d8ae9e8-d207-44fe-8a35-196388626837", // Pyongyang Radio FM: unofficial relay of unclear origin
  "2678a502-9a27-4774-a549-e00091878051", // Sputnik: state outlet under EU sanctions
  "56f14e5f-1234-42a9-946b-1ab9e7c06794", // Supreme Master TV: sect broadcaster, not a station
  "be61261d-ba40-4ab1-a045-34f0c49b0ca6", // Exclusively Daft Punk: AE, pinned in Doha
  "39094c88-fc5d-4628-b5e7-5884b58ba8a5", // Zvezda: defence ministry outlet under EU sanctions
  "a0742466-5326-4b22-99f7-b1cef79f542b", // Rockin' the Suburbs: Virginia filed as US Minor Islands
]);
// Streams that come back under other uuids and countries, and the CDNs of
// state outlets under EU sanctions (RIA/Sputnik, VGTRK, Zvezda).
const BLOCKED_STREAMS = [
  "//live.offshoreradio.net/",
  "//listen7.myradio24.com/69366",
  "//icecast-rian.",
  "//icecast-vgtrk.",
  "//icecast-zvezda.",
];
// No resident broadcasters; every entry is a mainland station misfiled.
const BLOCKED_COUNTRIES: ReadonlySet<string> = new Set(["UM"]);

/** The fields of a Radio Browser station this script reads. */
export type RawStation = {
  stationuuid: string;
  name: string;
  url_resolved: string;
  homepage: string;
  tags: string;
  countrycode: string;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  ssl_error: number;
  geo_lat: number | null;
  geo_long: number | null;
  clickcount: number;
  votes: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fixed = (n: number) => Number(n.toFixed(3));

/** Trimmed, single-spaced, no control or symbol-only noise, at most 48 chars. */
export function cleanName(name: string): string {
  const s = name
    .normalize("NFC")
    .replace(/[\p{Cc}\p{Cf}\p{So}\p{Cs}]/gu, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-_|.*~:#]+|[\s\-_|.*~:]+$/g, "");
  return s.length > NAME_MAX ? `${s.slice(0, NAME_MAX - 1).trimEnd()}…` : s;
}

function safeHomepage(url: string): string | null {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}

const CODEC: Record<string, Station["codec"]> = { MP3: "MP3", AAC: "AAC", "AAC+": "AAC" };

/** A raw directory row as a Station, or null if it breaks a curation rule. */
export function toStation(r: RawStation): Station | null {
  const codec = CODEC[r.codec?.toUpperCase()];
  if (!codec || r.hls !== 0 || r.lastcheckok !== 1 || r.ssl_error !== 0) return null;
  if (!UUID.test(r.stationuuid) || BLOCKED_IDS.has(r.stationuuid)) return null;
  if (!isSafeStreamUrl(r.url_resolved) || BLOCKED_STREAMS.some((b) => r.url_resolved.includes(b))) return null;
  const lat = r.geo_lat;
  const lon = r.geo_long;
  if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) return null;
  const cc = r.countrycode?.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc ?? "") || BLOCKED_COUNTRIES.has(cc)) return null;
  const name = cleanName(r.name ?? "");
  if (!/\p{L}|\p{N}/u.test(name) || BLOCKED_WORDS.test(`${r.name} ${r.tags}`)) return null;
  if (r.bitrate > 0 && r.bitrate < 32) return null;
  return {
    id: r.stationuuid,
    name,
    cc,
    lat: fixed(lat),
    lon: fixed(lon),
    url: r.url_resolved,
    codec,
    bitrate: Math.max(0, Math.round(r.bitrate || 0)),
    homepage: safeHomepage(r.homepage ?? ""),
  };
}

export type Candidates = {
  /** Country code to its eligible stations, most popular first. */
  groups: Map<string, Station[]>;
  /** Station id to its place in the directory's popularity order. */
  rank: Map<string, number>;
};

/**
 * Eligible stations by country, ranked by clicks, then votes, then id, with
 * repeated streams and same-named stations in a country dropped.
 */
export function candidates(raw: readonly RawStation[]): Candidates {
  const rank = [...raw].sort(
    (a, b) => b.clickcount - a.clickcount || b.votes - a.votes || (a.stationuuid < b.stationuuid ? -1 : 1),
  );
  const urls = new Set<string>();
  const names = new Set<string>();
  const groups = new Map<string, Station[]>();
  const order = new Map<string, number>();
  for (const r of rank) {
    const s = toStation(r);
    if (!s) continue;
    const nameKey = `${s.cc}:${s.name.toLowerCase()}`;
    if (urls.has(s.url) || names.has(nameKey)) continue;
    urls.add(s.url);
    names.add(nameKey);
    order.set(s.id, order.size);
    groups.set(s.cc, [...(groups.get(s.cc) ?? []), s]);
  }
  return { groups, rank: order };
}

/** The codec a live stream answers with, or null if it is not audio. */
export type Probe = (s: Station) => Promise<Station["codec"] | null>;

/**
 * Round one takes each country's best live station, round two a second one;
 * a dead stream is skipped for the country's next candidate, at most `tries`
 * per country and round. Seconds are kept in popularity order until
 * MAX_STATIONS. Countries are probed `pool` at a time; each country's pick
 * depends only on its own list, so the result does not depend on timing.
 */
export async function select(c: Candidates, probe: Probe, tries = 4, pool = 12): Promise<Station[]> {
  const picks = new Map<string, Station[]>();
  const countries = [...c.groups.keys()].sort();
  const pickFor = async (cc: string) => {
    const list = c.groups.get(cc)!;
    const got: Station[] = [];
    let i = 0;
    for (let round = 0; round < PER_COUNTRY; round++) {
      for (let t = 0; t < tries && i < list.length; t++) {
        const s = list[i++];
        const codec = await probe(s);
        if (codec) {
          got.push({ ...s, codec });
          break;
        }
      }
    }
    picks.set(cc, got);
  };
  let next = 0;
  const worker = async () => {
    while (next < countries.length) await pickFor(countries[next++]);
  };
  await Promise.all(Array.from({ length: Math.max(1, pool) }, worker));
  const lists = countries.map((cc) => picks.get(cc)!).filter((l) => l.length > 0);
  const byRank = (a: Station, b: Station) => c.rank.get(a.id)! - c.rank.get(b.id)!;
  const firsts = lists.map((l) => l[0]).sort(byRank);
  const seconds = lists.filter((l) => l[1]).map((l) => l[1]).sort(byRank);
  return sortStations([...firsts, ...seconds].slice(0, MAX_STATIONS));
}

export const sortStations = (list: readonly Station[]) =>
  [...list].sort((a, b) => (a.cc < b.cc ? -1 : a.cc > b.cc ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

/** Stable text: header fields, then one station per line. */
export function serializeSnapshot(s: Snapshot): string {
  const head = { source: s.source, retrieved: s.retrieved, license: s.license, query: s.query };
  const lines = s.stations.map((st) => `    ${JSON.stringify(st)}`);
  const meta = JSON.stringify(head, null, 2).slice(0, -2);
  return `${meta},\n  "stations": [\n${lines.join(",\n")}\n  ]\n}\n`;
}

/** Every rule the committed snapshot must keep; [] means it passes. */
export function checkSnapshot(text: string): string[] {
  let data: Snapshot;
  try {
    data = JSON.parse(text) as Snapshot;
  } catch (e) {
    return [`not JSON: ${(e as Error).message}`];
  }
  const errors: string[] = [];
  if (data.source !== SOURCE) errors.push(`source must be "${SOURCE}"`);
  if (data.license !== LICENSE) errors.push("license notice changed");
  if (data.query !== QUERY) errors.push("query changed");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(data.retrieved ?? "") || Number.isNaN(Date.parse(data.retrieved))) {
    errors.push("retrieved must be an ISO UTC instant");
  }
  const list = Array.isArray(data.stations) ? data.stations : [];
  if (list.length < MIN_STATIONS || list.length > MAX_STATIONS) {
    errors.push(`expected ${MIN_STATIONS}-${MAX_STATIONS} stations, got ${list.length}`);
  }
  const ids = new Set<string>();
  const urls = new Set<string>();
  const perCountry = new Map<string, number>();
  for (const s of list) {
    if (typeof s !== "object" || s === null) {
      errors.push("a station is not an object");
      continue;
    }
    const at = `station ${s.id ?? "?"}`;
    const keys = Object.keys(s ?? {}).sort().join(",");
    if (keys !== "bitrate,cc,codec,homepage,id,lat,lon,name,url") errors.push(`${at}: fields are ${keys}`);
    if (!UUID.test(s.id)) errors.push(`${at}: id is not a uuid`);
    if (BLOCKED_IDS.has(s.id) || BLOCKED_COUNTRIES.has(s.cc) || BLOCKED_STREAMS.some((b) => String(s.url).includes(b))) {
      errors.push(`${at}: blocked`);
    }
    if (ids.has(s.id)) errors.push(`${at}: duplicate id`);
    if (urls.has(s.url)) errors.push(`${at}: duplicate url`);
    ids.add(s.id);
    urls.add(s.url);
    if (typeof s.name !== "string" || s.name !== cleanName(s.name) || !s.name) errors.push(`${at}: name is not clean`);
    if (BLOCKED_WORDS.test(s.name ?? "")) errors.push(`${at}: blocked word in name`);
    if (!/^[A-Z]{2}$/.test(s.cc ?? "")) errors.push(`${at}: cc`);
    perCountry.set(s.cc, (perCountry.get(s.cc) ?? 0) + 1);
    if (!(Math.abs(s.lat) <= 90) || !(Math.abs(s.lon) <= 180) || (s.lat === 0 && s.lon === 0)) {
      errors.push(`${at}: coordinates out of range`);
    }
    if (!isSafeStreamUrl(s.url)) errors.push(`${at}: stream is not a direct https url`);
    if (s.codec !== "MP3" && s.codec !== "AAC") errors.push(`${at}: codec ${s.codec}`);
    if (!Number.isInteger(s.bitrate) || s.bitrate < 0) errors.push(`${at}: bitrate`);
    if (s.homepage !== null && safeHomepage(s.homepage ?? "") !== s.homepage) errors.push(`${at}: homepage is not https`);
  }
  for (const [cc, n] of perCountry) if (n > PER_COUNTRY) errors.push(`${cc}: ${n} stations, at most ${PER_COUNTRY}`);
  if (errors.length === 0 && serializeSnapshot({ ...data, stations: sortStations(list) }) !== text) {
    errors.push("not in canonical order or format; rerun npm run radio:vendor");
  }
  return errors;
}

// Network: only `npm run radio:vendor` reaches here.

async function servers(): Promise<string[]> {
  let names: string[] = [];
  try {
    names = (await dns.resolveSrv("_api._tcp.radio-browser.info")).map((r) => r.name);
  } catch {
    const ips = await dns.resolve4("all.api.radio-browser.info");
    names = (await Promise.all(ips.map((ip) => dns.reverse(ip).catch(() => [])))).flat();
  }
  if (names.length === 0) throw new Error("no Radio Browser servers found");
  return names.sort(() => Math.random() - 0.5);
}

async function getJson<T>(hosts: string[], path: string): Promise<{ host: string; body: T }> {
  let last: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    const host = hosts[attempt % hosts.length];
    try {
      const res = await fetch(`https://${host}${path}`, { headers: { "user-agent": AGENT }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`${host}${path}: ${res.status}`);
      return { host, body: (await res.json()) as T };
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error(`Radio Browser unreachable: ${String(last)}`);
}

/** Opens the stream, needs an audio content type and a first chunk of bytes. */
const probeStream: Probe = async (s) => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await fetch(s.url, { headers: { "user-agent": AGENT, "icy-metadata": "0" }, signal: ctl.signal });
    if (!res.ok || !res.url.startsWith("https://") || !res.body) return null;
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    const codec = /audio\/(mpeg|mp3|x-mpeg)/.test(type) ? "MP3" : /audio\/(aac|aacp|x-aac)/.test(type) ? "AAC" : null;
    if (!codec) return null;
    const first = await res.body.getReader().read();
    return first.value && first.value.length > 0 ? codec : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    ctl.abort();
  }
};

async function vendor(file: string): Promise<void> {
  const hosts = await servers();
  const retrieved = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const { host, body } = await getJson<RawStation[]>(hosts, QUERY);
  const c = candidates(body);
  console.log(`radio:vendor: ${body.length} rows from ${host}, ${c.rank.size} eligible in ${c.groups.size} countries`);
  let live = 0;
  let dead = 0;
  const counted: Probe = async (s) => {
    const codec = await probeStream(s);
    if (codec) live++;
    else dead++;
    return codec;
  };
  const stations = await select(c, counted);
  const snapshot: Snapshot = { source: SOURCE, retrieved, license: LICENSE, query: QUERY, stations };
  const text = serializeSnapshot(snapshot);
  const errors = checkSnapshot(text);
  if (errors.length) throw new Error(`snapshot fails its own check:\n${errors.join("\n")}`);
  writeFileSync(file, text);
  console.log(`radio:vendor: probed ${live} live, ${dead} dead; wrote ${stations.length} stations to ${file}`);
}

async function main(argv: string[]): Promise<number> {
  const fileArg = argv.find((a) => a.startsWith("--file="));
  const file = fileArg ? resolve(fileArg.slice("--file=".length)) : DEFAULT_FILE;
  if (!argv.includes("--check")) {
    await vendor(file);
    return 0;
  }
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    console.error(`radio:check: ${file} is missing; run npm run radio:vendor`);
    return 1;
  }
  const errors = checkSnapshot(text);
  if (errors.length) {
    console.error(`radio:check: ${file} breaks ${errors.length} rule(s):\n  ${errors.slice(0, 20).join("\n  ")}`);
    return 1;
  }
  const n = (JSON.parse(text) as Snapshot).stations.length;
  console.log(`radio:check: ${n} stations in ${file} pass`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) process.exitCode = await main(process.argv.slice(2));
