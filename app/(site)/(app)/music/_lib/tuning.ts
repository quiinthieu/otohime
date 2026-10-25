// Pure tuning logic for Ink Radio: the station shape, the inked globe's
// orthographic projection, nearest-station lookup, the dial's key steps, the
// needle spring and the playback state machine. No DOM, no clock, no
// randomness; the component feeds in time and audio events.

/** One vendored station (see stations.json and scripts/vendor-radio.ts). */
export type Station = {
  /** Radio Browser stationuuid. */
  id: string;
  name: string;
  /** ISO 3166-1 alpha-2. */
  cc: string;
  lat: number;
  lon: number;
  /** Direct HTTPS stream, checked at vendor time. */
  url: string;
  codec: "MP3" | "AAC";
  /** kbps, 0 when the directory does not know. */
  bitrate: number;
  homepage: string | null;
};

export type Snapshot = {
  source: string;
  retrieved: string;
  license: string;
  query: string;
  stations: Station[];
};

export type LatLon = { lat: number; lon: number };

const RAD = Math.PI / 180;
const EARTH_KM = 6371;

/** Longitude wrapped to [-180, 180). */
export function wrapLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Orthographic projection onto a unit disc centred on `view`. x grows east,
 * y grows north (flip it for SVG). `visible` is false on the far side.
 */
export function project(p: LatLon, view: LatLon): { x: number; y: number; visible: boolean } {
  const phi = p.lat * RAD;
  const phi0 = view.lat * RAD;
  const dl = (p.lon - view.lon) * RAD;
  const cosc = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dl);
  return {
    x: Math.cos(phi) * Math.sin(dl),
    y: Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dl),
    visible: cosc >= 0,
  };
}

/** The point under (x, y) on the unit disc, or null off the globe. */
export function unproject(x: number, y: number, view: LatLon): LatLon | null {
  const rho = Math.hypot(x, y);
  if (rho > 1) return null;
  if (rho === 0) return { lat: view.lat, lon: wrapLon(view.lon) };
  const c = Math.asin(rho);
  const phi0 = view.lat * RAD;
  const lat = Math.asin(clamp(Math.cos(c) * Math.sin(phi0) + (y * Math.sin(c) * Math.cos(phi0)) / rho, -1, 1));
  const lon = view.lon * RAD + Math.atan2(x * Math.sin(c), rho * Math.cos(c) * Math.cos(phi0) - y * Math.sin(c) * Math.sin(phi0));
  return { lat: lat / RAD, lon: wrapLon(lon / RAD) };
}

/** Great-circle distance in km (haversine). */
export function distanceKm(a: LatLon, b: LatLon): number {
  const dphi = (b.lat - a.lat) * RAD;
  const dl = (b.lon - a.lon) * RAD;
  const h = Math.sin(dphi / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Highest latitude the globe tilts to, so the poles never flip the drag. */
export const MAX_TILT = 70;

/** Spin the globe by a pointer drag of (dx, dy) px on a globe of `radius` px. */
export function dragView(view: LatLon, dx: number, dy: number, radius: number): LatLon {
  if (!(radius > 0)) return view;
  return {
    lat: clamp(view.lat + (dy / radius) / RAD, -MAX_TILT, MAX_TILT),
    lon: wrapLon(view.lon - (dx / radius) / RAD),
  };
}

/** The globe view that centres a station. */
export function viewOf(s: LatLon): LatLon {
  return { lat: clamp(s.lat, -MAX_TILT, MAX_TILT), lon: wrapLon(s.lon) };
}

type Options = { exclude?: ReadonlySet<string>; maxKm?: number };

/** Stations by distance from `at`, ties by id; `exclude` and `maxKm` filter. */
export function nearby(stations: readonly Station[], at: LatLon, n: number, opts: Options = {}): Station[] {
  const max = opts.maxKm ?? Infinity;
  return stations
    .filter((s) => !opts.exclude?.has(s.id))
    .map((s) => ({ s, d: distanceKm(at, s) }))
    .filter((e) => e.d <= max)
    .sort((a, b) => a.d - b.d || (a.s.id < b.s.id ? -1 : a.s.id > b.s.id ? 1 : 0))
    .slice(0, Math.max(0, n))
    .map((e) => e.s);
}

/** The single nearest station, or null when nothing is in range. */
export function nearest(stations: readonly Station[], at: LatLon, opts: Options = {}): Station | null {
  return nearby(stations, at, 1, opts)[0] ?? null;
}

/** The dial runs west to east: by longitude, then latitude, then id. */
export function dialOrder(stations: readonly Station[]): Station[] {
  return [...stations].sort((a, b) => a.lon - b.lon || a.lat - b.lat || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** The ARIA slider keys: the next dial index, or null for a key it ignores. */
export function stepDial(index: number, key: string, length: number): number | null {
  if (length <= 0) return null;
  const big = Math.max(1, Math.round(length / 10));
  const delta: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: big, PageDown: -big };
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (!(key in delta)) return null;
  return clamp(index + delta[key], 0, length - 1);
}

/** Only direct HTTPS streams, no credentials, no playlists or HLS. */
export function isSafeStreamUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password || !u.hostname) return false;
  return !/\.(m3u8?|pls|asx|xspf)$/i.test(u.pathname);
}

// Needle: a damped spring stepped by the component's frame clock.

export type Spring = { x: number; v: number };
export const SPRING = { stiffness: 170, damping: 18 } as const;

/** One semi-implicit Euler step of `dt` seconds towards `target`. */
export function springStep(s: Spring, target: number, dt: number, k: { stiffness: number; damping: number } = SPRING): Spring {
  const h = clamp(dt, 0, 1 / 20);
  const v = s.v + (-k.stiffness * (s.x - target) - k.damping * s.v) * h;
  return { x: s.x + v * h, v };
}

export function settled(s: Spring, target: number, eps = 1e-3): boolean {
  return Math.abs(s.x - target) < eps && Math.abs(s.v) < eps;
}

/** FNV-1a of a station id, so a station's needle wobble is always its own. */
export function seedOf(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** Needle wobble in [-1, 1] at `t` seconds, from two seeded slow sines. */
export function wobble(seed: number, t: number): number {
  const a = 1.3 + (seed % 97) / 97;
  const b = 2.9 + ((seed >>> 8) % 89) / 89;
  const p = ((seed >>> 16) % 360) * RAD;
  return 0.6 * Math.sin(a * t + p) + 0.4 * Math.sin(b * t + 2 * p);
}

// Playback: idle until the listener presses play, never a retry loop.

/** No `playing` event within this long after play counts as no signal. */
export const LOAD_TIMEOUT_MS = 8000;

export type NoSignal = "error" | "stalled" | "timeout" | "blocked" | "known-bad";

export type RadioState = {
  status: "idle" | "loading" | "playing" | "no-signal";
  station: string | null;
  /** Bumped on every load; audio events carry it so stale ones are ignored. */
  attempt: number;
  /** Stations that failed this session; never loaded again. */
  bad: readonly string[];
  reason: NoSignal | null;
};

export type RadioEvent =
  | { type: "tune"; id: string }
  | { type: "play" }
  | { type: "stop" }
  | { type: "playing"; attempt: number }
  | { type: "fail"; reason: "error" | "stalled" | "timeout"; attempt: number };

export const initialRadio: RadioState = { status: "idle", station: null, attempt: 0, bad: [], reason: null };

/**
 * The playback state machine. Only "play" (a click or key press) starts sound;
 * tuning while idle just moves the needle, tuning while on air switches the
 * stream. Failures mark the station bad for the session and stop.
 */
export function radioReducer(state: RadioState, event: RadioEvent, stations: readonly Station[]): RadioState {
  const load = (id: string): RadioState => {
    const s = stations.find((x) => x.id === id);
    if (state.bad.includes(id)) return { ...state, status: "no-signal", station: id, reason: "known-bad" };
    if (!s || !isSafeStreamUrl(s.url)) {
      return { ...state, status: "no-signal", station: id, bad: [...state.bad, id], reason: "blocked" };
    }
    return { ...state, status: "loading", station: id, attempt: state.attempt + 1, reason: null };
  };
  switch (event.type) {
    case "tune":
      if (event.id === state.station && state.status !== "no-signal") return state;
      if (state.status === "loading" || state.status === "playing") return load(event.id);
      return { ...state, status: "idle", station: event.id, reason: null };
    case "play":
      if (state.station === null || state.status === "loading" || state.status === "playing") return state;
      return load(state.station);
    case "stop":
      return state.status === "idle" ? state : { ...state, status: "idle", reason: null };
    case "playing":
      if (event.attempt !== state.attempt || state.status !== "loading") return state;
      return { ...state, status: "playing" };
    case "fail": {
      if (event.attempt !== state.attempt || state.station === null) return state;
      const live = state.status === "loading" || (state.status === "playing" && event.reason === "error");
      if (!live) return state;
      return { ...state, status: "no-signal", bad: [...state.bad, state.station], reason: event.reason };
    }
  }
}

/** The lamp is lit only while audio is actually playing. */
export const onAir = (s: RadioState) => s.status === "playing";

/** After no signal, the nearest playable station that has not failed yet. */
export function nextAfterFailure(state: RadioState, stations: readonly Station[]): Station | null {
  const here = stations.find((s) => s.id === state.station);
  if (!here) return null;
  const unsafe = stations.filter((s) => !isSafeStreamUrl(s.url)).map((s) => s.id);
  return nearest(stations, here, { exclude: new Set([...state.bad, ...unsafe, here.id]) });
}
