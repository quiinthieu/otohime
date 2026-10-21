// The graph: a metro map of eight fixed stations, A to H, and the lines
// between them. Drawing or rubbing out a line is one step. A ripple lights the
// start, then every station one line away, then every station one line from
// those, one step a station lit; ties are broken by letter, so the shortest
// way it finds is always the same one. The cap is the most lines. Ids: the
// stations' letters, and lines as A-B.
import { COST_ROOM, countSteps, done, measure, refuse, stepsWord, type Action, type Beat, type Move, type Structure } from "../machine.ts";

export type GraphState = { cap: number; lines: readonly string[] }; // "A-B", letters in order, sorted

export const STATIONS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const CAP = 12;

export const STARTER = ["A-B", "A-C", "A-D", "B-E", "C-E", "C-F", "D-G", "F-H", "G-H"] as const;

const lineId = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const station = (v: unknown) => (typeof v === "string" && /^[A-Ha-h]$/.test(v.trim()) ? v.trim().toUpperCase() : null);
const hops = (n: number) => (n === 1 ? "1 hop" : `${n} hops`);

export function neighboursOf(s: GraphState, a: string): string[] {
  return s.lines
    .flatMap((l) => {
      const [x, y] = l.split("-");
      return x === a ? [y] : y === a ? [x] : [];
    })
    .sort();
}

// The ripple from `from`, breadth first in letter order, until `to` is lit
// (or every station it can reach): the order lit, and where each came from.
function spread(s: GraphState, from: string, to?: string): { lit: string[]; came: Map<string, string>; level: Map<string, number> } {
  const lit = [from];
  const came = new Map<string, string>();
  const level = new Map([[from, 0]]);
  for (let i = 0; i < lit.length && !(to && level.has(to)); i++) {
    const at = lit[i];
    for (const n of neighboursOf(s, at)) {
      if (level.has(n)) continue;
      level.set(n, (level.get(at) ?? 0) + 1);
      came.set(n, at);
      lit.push(n);
      if (n === to) break;
    }
  }
  return { lit, came, level };
}

/** The stations by hops from `from`, not counting `from` itself. */
export function ripple(s: GraphState, from: string): string[][] {
  const { lit, level } = spread(s, from);
  const out: string[][] = [];
  for (const st of lit.slice(1)) (out[(level.get(st) ?? 1) - 1] ??= []).push(st);
  return out;
}

/** The shortest way from a to b, ties broken by letter, or null. */
export function path(s: GraphState, a: string, b: string): string[] | null {
  const { came, level } = spread(s, a, b);
  if (!level.has(b)) return null;
  const way = [b];
  while (way[0] !== a) way.unshift(came.get(way[0]) ?? a);
  return way;
}

function lightBeats(lit: readonly string[], came: Map<string, string>, level: Map<string, number>): Beat[] {
  return lit.map((st, i) =>
    i === 0
      ? { say: `Start at ${st} and light it.`, hot: [st], step: true }
      : {
          say: came.get(st) === lit[0] ? `${st} is 1 hop from ${lit[0]}.` : `${st} is ${hops(level.get(st) ?? 0)} from ${lit[0]}, reached from ${came.get(st)}.`,
          hot: [st, lineId(st, came.get(st) ?? st)],
          step: true,
        },
  );
}

function pair(a: Action): [string, string] | string {
  const x = station(a.value);
  const y = station(a.to);
  if (x === null || y === null) return "Pick two stations from A to H.";
  if (x === y) return `Pick two different stations, not ${x} twice.`;
  return [x, y];
}

function reduce(s: GraphState, a: Action): Move<GraphState> {
  switch (a.move) {
    case "connect": {
      const p = pair(a);
      if (typeof p === "string") return refuse(s, p);
      const [x, y] = p;
      const l = lineId(x, y);
      if (s.lines.includes(l)) return refuse(s, `${x} and ${y} are already joined.`, [l]);
      if (s.lines.length >= s.cap) return refuse(s, `The map already has ${s.cap} lines and is full.`);
      return done({ ...s, lines: [...s.lines, l].sort() }, [
        { say: `Draw a line from ${x} to ${y}.`, hot: [x, y, l], step: true },
        { say: `${x} and ${y} are joined.`, hot: [l] },
      ]);
    }
    case "cut": {
      const p = pair(a);
      if (typeof p === "string") return refuse(s, p);
      const [x, y] = p;
      const l = lineId(x, y);
      if (!s.lines.includes(l)) return refuse(s, `There is no line from ${x} to ${y} to rub out.`, [x, y]);
      return done({ ...s, lines: s.lines.filter((v) => v !== l) }, [
        { say: `Rub out the line from ${x} to ${y}.`, hot: [x, y, l], step: true },
        { say: `${x} and ${y} are no longer joined.`, hot: [x, y] },
      ]);
    }
    case "ripple": {
      const from = station(a.value);
      if (from === null) return refuse(s, "Pick a station from A to H.");
      const { lit, came, level } = spread(s, from);
      const trace = lightBeats(lit, came, level);
      const far = Math.max(...level.values());
      const n = stepsWord(countSteps(trace));
      const say =
        lit.length === STATIONS.length
          ? `Lit all ${lit.length} stations in ${n}; the farthest is ${hops(far)} away.`
          : lit.length === 1
            ? `No line leaves ${from}, so only ${from} is lit: ${n}.`
            : `Lit ${lit.length} of ${STATIONS.length} stations in ${n}; the rest have no way in from ${from}.`;
      trace.push({ say, hot: lit });
      return done(s, trace);
    }
    case "path": {
      const p = pair(a);
      if (typeof p === "string") return refuse(s, p);
      const [x, y] = p;
      const { lit, came, level } = spread(s, x, y);
      const trace = lightBeats(lit, came, level);
      const way = path(s, x, y);
      if (!way) {
        trace.push({ say: `There is no way from ${x} to ${y}: ${stepsWord(countSteps(trace))}.` });
        return done(s, trace);
      }
      const back = way
        .slice(1)
        .reverse()
        .map((st, i, r) => `${st} from ${r[i + 1] ?? x}`);
      trace.push({ say: `Follow the way back: ${back.join(", ")}.`, hot: [...way] });
      trace.push({ say: `The way from ${x} to ${y} is ${way.join(" ")}: ${hops(way.length - 1)}, found in ${stepsWord(countSteps(trace))}.`, hot: [...way] });
      return done(s, trace);
    }
    default:
      return refuse(s, `The graph has no move called ${a.move}.`);
  }
}

const join = (l: string): Action => {
  const [value, to] = l.split("-");
  return { move: "connect", value, to };
};

export const graph: Structure<GraphState> = {
  slug: "graph",
  cap: CAP,
  empty: (cap = CAP) => ({ cap, lines: [] }),
  moves: [
    { id: "connect", label: "Connect", takes: "pair" },
    { id: "cut", label: "Cut", takes: "pair" },
    { id: "ripple", label: "Ripple from", takes: "word" },
    { id: "path", label: "Path", takes: "pair" },
  ],
  defaultMove: "path",
  reduce,
  describe: (s) =>
    `A metro map of ${STATIONS.length} stations, ${STATIONS.join(", ")}, ${s.lines.length ? `and ${s.lines.length} lines: ${s.lines.join(", ")}` : "and no lines yet"}.`,
  labels: () => [...STATIONS],
  example: [...STARTER.map(join), { move: "ripple", value: "A" }, { move: "path", value: "A", to: "H" }],
  costs() {
    const start = graph.empty(COST_ROOM);
    const setup = STARTER.map(join);
    return {
      find: measure(graph, start, setup, { move: "ripple", value: "A" }, "Ripple from A: light each of the 8 stations once."),
      add: measure(graph, start, setup, { move: "connect", value: "B", to: "C" }, "Connect B and C: draw one line."),
      remove: measure(graph, start, setup, { move: "cut", value: "A", to: "B" }, "Cut A and B: rub out one line."),
    };
  },
};
