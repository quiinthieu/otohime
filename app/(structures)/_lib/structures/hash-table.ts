// The hash table: a coat check whose hook is worked out from the coat. There
// are always 8 buckets; a word's bucket is the sum of its letters' places in
// the alphabet (a = 1) shared by 8, the remainder. Working that out is one
// step, and so is each word looked at in the bucket's chain. The cap is the
// whole table (8 buckets, chains of cap / 8). Ids: b0…b7, and w-<word>.
import { COST_ROOM, countSteps, done, measure, refuse, stepsWord, type Action, type Beat, type Move, type Structure } from "../machine.ts";

export type HashState = { cap: number; buckets: readonly (readonly string[])[] };

export const BUCKETS = 8;
const CAP = 24; // chains of 3
const WORD = /^[a-z]{1,5}$/;

const bucketId = (b: number) => `b${b}`;
const wordId = (w: string) => `w-${w}`;
const chain = (s: HashState) => Math.floor(s.cap / BUCKETS);

/** The sum of the letters' places in the alphabet, a = 1. */
export const letterSum = (w: string) => [...w].reduce((sum, c) => sum + c.charCodeAt(0) - 96, 0);
export const bucketOf = (w: string) => letterSum(w) % BUCKETS;

function work(w: string): Beat {
  const parts = [...w].map((c) => c.charCodeAt(0) - 96).join(" + ");
  const sum = letterSum(w);
  const b = sum % BUCKETS;
  return { say: `${w} adds up to ${parts} = ${sum}, and ${sum} shared by ${BUCKETS} leaves ${b}: bucket ${b}.`, hot: [bucketId(b)], step: true };
}

// Works out the bucket and reads its chain until it meets w.
function look(s: HashState, w: string): { b: number; trace: Beat[]; found: boolean } {
  const b = bucketOf(w);
  const words = s.buckets[b];
  const trace = [work(w)];
  for (let i = 0; i < words.length; i++) {
    const v = words[i];
    const where = i === 0 ? `Bucket ${b} holds ${v} first` : `The next word is ${v}`;
    if (v === w) {
      trace.push({ say: `${where}: that is it.`, hot: [wordId(v)], step: true });
      return { b, trace, found: true };
    }
    const end = i === words.length - 1;
    trace.push({ say: `${where}, not ${w}, ${end ? "and nothing comes after it" : "so look at the next word"}.`, hot: [wordId(v)], step: true });
  }
  if (words.length === 0) trace.push({ say: `Bucket ${b} is empty.`, hot: [bucketId(b)] });
  return { b, trace, found: false };
}

const PLEASE = "Use a word of 1 to 5 small letters, a to z.";
const asWord = (v: unknown) => (typeof v === "string" && WORD.test(v) ? v : null);

function reduce(s: HashState, a: Action): Move<HashState> {
  if (a.move !== "put" && a.move !== "get" && a.move !== "remove") return refuse(s, `The hash table has no move called ${a.move}.`);
  const w = asWord(a.value);
  if (w === null) return refuse(s, PLEASE);
  const b = bucketOf(w);
  const words = s.buckets[b];
  if (a.move === "put" && !words.includes(w) && words.length >= chain(s)) {
    return refuse(s, `Bucket ${b} already holds ${words.length} words, so there is no room for ${w}.`, [bucketId(b)]);
  }
  const { trace, found } = look(s, w);
  const n = () => stepsWord(countSteps(trace));
  switch (a.move) {
    case "put": {
      if (found) {
        trace.push({ say: `${w} is already here: ${n()}.`, hot: [wordId(w)] });
        return done(s, trace);
      }
      const behind = words[words.length - 1];
      trace.push({ say: behind ? `Write ${w} in bucket ${b}, behind ${behind}.` : `Write ${w} in bucket ${b}.`, hot: [wordId(w), bucketId(b)], step: true });
      trace.push({ say: `${w} is in bucket ${b}, in ${n()}.`, hot: [wordId(w)] });
      return done({ ...s, buckets: s.buckets.map((c, i) => (i === b ? [...c, w] : c)) }, trace);
    }
    case "get": {
      trace.push(found ? { say: `Found ${w} in ${n()}.`, hot: [wordId(w)] } : { say: `${w} is not here: ${n()}.` });
      return done(s, trace);
    }
    default: {
      if (!found) {
        trace.push({ say: `${w} is not here, so there is nothing to rub out: ${n()}.` });
        return done(s, trace);
      }
      trace.push({ say: `Rub out ${w}; any words behind it close up.`, hot: [wordId(w), bucketId(b)], step: true });
      trace.push({ say: `${w} is gone, in ${n()}.` });
      return done({ ...s, buckets: s.buckets.map((c, i) => (i === b ? c.filter((v) => v !== w) : c)) }, trace);
    }
  }
}

// One word to each bucket, 0 to 7.
export const COST_WORDS = ["cat", "cow", "dog", "ant", "bee", "fox", "eel", "emu"] as const;

export const hashTable: Structure<HashState> = {
  slug: "hash-table",
  cap: CAP,
  empty: (cap = CAP) => ({ cap, buckets: Array.from({ length: BUCKETS }, () => []) }),
  moves: [
    { id: "put", label: "Put", takes: "word" },
    { id: "get", label: "Get", takes: "word" },
    { id: "remove", label: "Remove", takes: "word" },
  ],
  defaultMove: "get",
  reduce,
  describe: (s) => {
    const held = s.buckets.flatMap((c, b) => (c.length ? [`bucket ${b} holds ${c.join(" then ")}`] : []));
    return `A hash table of ${BUCKETS} buckets, 0 to ${BUCKETS - 1}: ${held.length ? `${held.join("; ")}; the rest are empty` : "all empty"}.`;
  },
  labels: (s) => s.buckets.flat(),
  example: [
    { move: "put", value: "cat" },
    { move: "put", value: "dog" },
    { move: "put", value: "fox" },
    { move: "put", value: "act" },
    { move: "get", value: "act" },
  ],
  costs() {
    const start = hashTable.empty(COST_ROOM);
    const setup: Action[] = COST_WORDS.map((value) => ({ move: "put", value }));
    return {
      find: measure(hashTable, start, setup, { move: "get", value: "fox" }, "Get fox: work out its bucket, then look at the one word there."),
      add: measure(hashTable, start, setup, { move: "put", value: "pig" }, "Put pig: work out its bucket, look past cat, then write."),
      remove: measure(hashTable, start, setup, { move: "remove", value: "cat" }, "Remove cat: work out its bucket, find it, then rub it out."),
    };
  },
};
