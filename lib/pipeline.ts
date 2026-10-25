// The Work page's data pipeline, as pure state: (state, action) => state, so a test can run a whole day of
// traffic without a browser. It is an illustrative simulation, not telemetry: nothing here reads a clock,
// a random source or a service.
//
// A packet is born at the source and walks six places in order, one place per frame at most, never
// skipping one: source -> to-queue (pipe) -> queue -> to-warehouse (pipe) -> warehouse -> to-dashboard
// (pipe), and on arriving at the dashboard it is shown, which is a count, not a packet any more. So every
// packet ever emitted is in exactly one place, and
//   emitted === waiting + inFlight + queued + stored + shown.
//
// The source lets one packet into its pipe every SPACING frames and the queue's consumer takes one every
// DRAIN frames; a pipe takes LEG[i] frames and the warehouse holds a packet DWELL frames before the
// dashboard reads it. Pause stops only the queue's consumer: the source keeps sending, the queue fills,
// and what is past the queue still arrives. Resume drains it, one packet every DRAIN frames.
//
// Actions: "emit" sends one packet, "backfill" sends BACKFILL (eight) spaced by the source's gate, "pause"
// and "resume" hold and release the queue, "tick" is one 12 fps frame and "settle" jumps to rest: paused,
// everything upstream lands in the queue and waits there; unpaused, everything is shown. At most CAP
// packets are live (not yet shown); an emit past it does nothing and a backfill sends what fits.

export const PLACES = ["source", "to-queue", "queue", "to-warehouse", "warehouse", "to-dashboard"] as const;
export type Place = (typeof PLACES)[number];
export type Pipe = "to-queue" | "to-warehouse" | "to-dashboard";

// Frames a packet spends in each pipe.
export const LEG: Readonly<Record<Pipe, number>> = { "to-queue": 6, "to-warehouse": 8, "to-dashboard": 6 };
export const SPACING = 3; // frames between the source's releases
export const DRAIN = 3; // frames between the queue's departures
export const DWELL = 2; // frames a packet rests in the warehouse
export const BACKFILL = 8;
export const CAP = 32; // live packets, so the work per frame and to rest is bounded

export type Packet = {
  id: number; // emission order, from 0, never reused
  place: Place;
  t: number; // frames spent in this place
};

export type Pipeline = {
  packets: readonly Packet[]; // every live packet, in id order
  paused: boolean; // the queue's consumer is held
  nextId: number; // also the count ever emitted
  shown: number; // packets that reached the dashboard
  sourceWait: number; // frames until the source may release again
  drainWait: number; // frames until the queue may release again
  frame: number; // ticks that did some work
};

export type PipelineAction = "emit" | "backfill" | "pause" | "resume" | "tick" | "settle";

export const initialPipeline: Pipeline = {
  packets: [],
  paused: false,
  nextId: 0,
  shown: 0,
  sourceWait: 0,
  drainWait: 0,
  frame: 0,
};

const isPipe = (place: Place): place is Pipe => place === "to-queue" || place === "to-warehouse" || place === "to-dashboard";
const next = (place: Place) => PLACES[PLACES.indexOf(place) + 1] as Place | undefined;

// Something will change on the next tick. A paused queue with nothing else live is at rest: the figure's
// clock can stop.
export const busy = (s: Pipeline) => s.packets.some((p) => p.place !== "queue" || !s.paused);

export type Counters = {
  emitted: number;
  waiting: number; // at the source
  inFlight: number; // in any pipe
  queued: number;
  stored: number; // in the warehouse, not yet read
  shown: number;
  lag: number; // emitted but not yet on the dashboard
  busy: boolean;
};

export function counters(s: Pipeline): Counters {
  const n = (place: Place) => s.packets.filter((p) => p.place === place).length;
  return {
    emitted: s.nextId,
    waiting: n("source"),
    inFlight: s.packets.filter((p) => isPipe(p.place)).length,
    queued: n("queue"),
    stored: n("warehouse"),
    shown: s.shown,
    lag: s.nextId - s.shown,
    busy: busy(s),
  };
}

// How far along its pipe a packet is, 0 at the start and 1 on arrival; a packet at a station is at 0.
export const progress = (p: Packet) => (isPipe(p.place) ? Math.min(1, p.t / LEG[p.place]) : 0);

function send(s: Pipeline, count: number): Pipeline {
  const n = Math.min(count, CAP - s.packets.length);
  if (n <= 0) return s;
  const born = Array.from({ length: n }, (_, i): Packet => ({ id: s.nextId + i, place: "source", t: 0 }));
  return { ...s, packets: [...s.packets, ...born], nextId: s.nextId + n };
}

// One frame. The source's and the queue's first-in-line may leave if their gate is open; everyone else
// ages a frame, and a packet whose pipe or dwell is done moves to the next place. A packet that arrives
// this frame was not at the station when its gate was read, so it waits at least one frame there.
function frame(s: Pipeline): Pipeline {
  const leaving = new Set<number>();
  let { sourceWait, drainWait } = s;
  const head = (place: Place) => s.packets.find((p) => p.place === place);
  const atSource = head("source");
  if (sourceWait === 0 && atSource) {
    leaving.add(atSource.id);
    sourceWait = SPACING - 1;
  } else sourceWait = Math.max(0, sourceWait - 1);
  const atQueue = s.paused ? undefined : head("queue");
  if (drainWait === 0 && atQueue) {
    leaving.add(atQueue.id);
    drainWait = DRAIN - 1;
  } else drainWait = Math.max(0, drainWait - 1);

  let shown = s.shown;
  const packets: Packet[] = [];
  for (const p of s.packets) {
    const t = p.t + 1;
    const done = leaving.has(p.id) || (isPipe(p.place) && t >= LEG[p.place]) || (p.place === "warehouse" && t >= DWELL);
    if (!done) {
      packets.push({ ...p, t });
      continue;
    }
    const to = next(p.place);
    if (to) packets.push({ id: p.id, place: to, t: 0 });
    else shown++;
  }
  return { ...s, packets, shown, sourceWait, drainWait, frame: s.frame + 1 };
}

// Rest, at once: the same places and counts that ticking until !busy reaches, without the frames.
function settle(s: Pipeline): Pipeline {
  if (!busy(s)) return s;
  const upstream = (p: Packet) => p.place === "source" || p.place === "to-queue" || p.place === "queue";
  const packets = s.paused ? s.packets.filter(upstream).map((p): Packet => (p.place === "queue" ? p : { id: p.id, place: "queue", t: 0 })) : [];
  return { ...s, packets, shown: s.shown + s.packets.length - packets.length, sourceWait: 0, drainWait: 0 };
}

export function pipeline(s: Pipeline, action: PipelineAction): Pipeline {
  switch (action) {
    case "emit":
      return send(s, 1);
    case "backfill":
      return send(s, BACKFILL);
    case "pause":
      return s.paused ? s : { ...s, paused: true };
    case "resume":
      return s.paused ? { ...s, paused: false } : s;
    case "tick":
      return busy(s) ? frame(s) : s;
    case "settle":
      return settle(s);
  }
}
