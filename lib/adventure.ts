// The Pocket Terminal's hidden game, pure: a walk through a data-engineering world of eight rooms, four things to
// carry and four secrets. step() takes the game and one typed line and gives back the next game and the lines to
// print; it never touches the page. components/pocket-terminal.tsx enters it with the `adventure` command, sends it
// every line until `quit`, and saves after each one with saveProgress, which also puts the stamp in the terminal's
// stamp list (lib/terminal.ts STAMPS_KEY) once all four secrets are found. Storage is optional throughout: blocked
// (private mode, a full quota), the game runs in memory and the terminal says once that it will not keep.
import { parseStamps, STAMPS_KEY, type Suggestion } from "./terminal.ts";

export const DIRS = ["north", "south", "east", "west"] as const;
export type Dir = (typeof DIRS)[number];

export type RoomId = "warehouse" | "lake" | "glacier" | "stream" | "staging" | "dag" | "tavern" | "catalog";
export type ItemId = "lantern" | "net" | "key" | "schema";
export type SecretId = "first-commit" | "lost-partition" | "clean-load" | "green-dag";

export type AdventureState = {
  room: RoomId;
  // what is carried, in the order it was taken; a thing taken is gone from its room
  inventory: readonly ItemId[];
  // the secrets found, in the order they were found
  secrets: readonly SecretId[];
};

// The line that ends the game is `quit`; `won` is set only on the line that finds the last secret.
export type Turn = { state: AdventureState; lines: string[]; quit?: true; won?: true };

type Room = {
  name: string;
  text: string;
  exits: Partial<Record<Dir, RoomId>>;
  // things to look at that cannot be taken
  scenery?: Record<string, string>;
};

type Item = { name: string; words: readonly string[]; home: RoomId; text: string };

// A secret is found by using one thing in one room.
type Secret = { name: string; item: ItemId; room: RoomId; found: string[] };

export const START: RoomId = "warehouse";
export const ADVENTURE_KEY = "terminal-adventure";
export const STAMP = "Keeper of the Pipeline";
export const UNSAVED = "(storage is blocked here, so this walk lasts until the page reloads.)";

export const ROOMS: Readonly<Record<RoomId, Room>> = {
  warehouse: {
    name: "The Warehouse",
    text: "columns of crates run up to the rafters, each labelled in someone else's handwriting.",
    exits: { north: "lake", east: "staging", south: "tavern", west: "catalog" },
    scenery: { crates: "fact_orders, fact_orders_v2, fact_orders_final, fact_orders_final_REAL." },
  },
  lake: {
    name: "The Lake",
    text: "a wide grey lake of files nobody has opened in years. something glints under the surface.",
    exits: { south: "warehouse", east: "stream", north: "glacier" },
    scenery: { glint: "a partition, drifting just out of reach. a net would do it." },
  },
  glacier: {
    name: "The Glacier",
    text: "cold storage. it is too dark in here to read the ice.",
    exits: { south: "lake" },
    scenery: { ice: "every backup ever taken, frozen in rows. you need light to read it." },
  },
  stream: {
    name: "The Stream",
    text: "events rush past in a narrow channel, a few of them twice.",
    exits: { west: "lake", south: "staging" },
    scenery: { events: "click, click, click, click. at least once, never exactly once." },
  },
  staging: {
    name: "Staging Table",
    text: "rows pile up on a long table, waiting to load. a clerk mutters about a schema mismatch.",
    exits: { north: "stream", west: "warehouse", east: "dag" },
    scenery: { clerk: "\"column 7 was a string yesterday,\" the clerk sighs. \"find me the current schema.\"" },
  },
  dag: {
    name: "The Broken DAG",
    text: "a web of tasks hangs from the ceiling. one node glows red: FAILED, retries exhausted.",
    exits: { west: "staging" },
    scenery: { node: "load_everything. it has a small brass keyhole marked RETRY." },
  },
  tavern: {
    name: "Cron Tavern",
    text: "the regulars all arrive exactly on the hour. the clock over the bar reads 0 0 * * *.",
    exits: { north: "warehouse" },
    scenery: { clock: "midnight, every night, in whatever timezone the server thinks it is in." },
  },
  catalog: {
    name: "The Catalog",
    text: "a quiet library of schemas, every one versioned, most of them deprecated.",
    exits: { east: "warehouse" },
  },
};

export const ITEMS: Readonly<Record<ItemId, Item>> = {
  lantern: { name: "an index lantern", words: ["lantern", "lamp", "index"], home: "warehouse", text: "it lights whatever it is pointed at, eventually." },
  net: { name: "a dedup net", words: ["net", "dedup"], home: "stream", text: "fine mesh. it catches each thing once." },
  key: { name: "a brass key stamped RETRY", words: ["key", "retry", "brass"], home: "tavern", text: "worn smooth by a thousand reruns." },
  schema: { name: "a rolled-up schema, v3", words: ["schema", "v3", "scroll"], home: "catalog", text: "current, signed and only a little out of date." },
};

export const SECRETS: Readonly<Record<SecretId, Secret>> = {
  "first-commit": {
    name: "the first commit",
    item: "lantern",
    room: "glacier",
    found: ["the lantern catches the oldest ice. carved in it: \"initial commit. please don't touch the cron.\""],
  },
  "lost-partition": {
    name: "the lost partition",
    item: "net",
    room: "lake",
    found: ["you sweep the net through the shallows and land the glint: a partition dated 1970-01-01."],
  },
  "clean-load": {
    name: "the clean load",
    item: "schema",
    room: "staging",
    found: ["the clerk unrolls the schema and the rows slide into the table. one row reads: \"thanks.\""],
  },
  "green-dag": {
    name: "the green DAG",
    item: "key",
    room: "dag",
    found: ["the key turns. load_everything retries, runs, and goes green; the whole web follows."],
  },
};

const ROOM_IDS = Object.keys(ROOMS) as RoomId[];
const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
const SECRET_IDS = Object.keys(SECRETS) as SecretId[];

export const fresh = (): AdventureState => ({ room: START, inventory: [], secrets: [] });
export const complete = (state: AdventureState) => SECRET_IDS.every((s) => state.secrets.includes(s));

const SHORT: Record<string, Dir> = { n: "north", s: "south", e: "east", w: "west" };
const asDir = (word: string | undefined): Dir | undefined =>
  word === undefined ? undefined : (SHORT[word] ?? DIRS.find((d) => d === word));

// Little words that never name a thing.
const FILLER = new Set(["the", "a", "an", "at", "to", "on", "with", "up", "my", "in", "into"]);

export const HELP = [
  "look [thing]      the room, or a thing in it",
  "go <direction>    north, south, east, west (or n, s, e, w)",
  "take <thing>      pick something up",
  "use <thing>       use what you carry, here",
  "inventory         what you carry and the secrets found",
  "restart           start over (a stamp, once won, stays)",
  "quit              back to the terminal; the walk is kept",
];

const tally = (state: AdventureState) => `secrets: ${state.secrets.length} of ${SECRET_IDS.length}`;

function lit(state: AdventureState, room: RoomId) {
  return room === "glacier" && state.secrets.includes("first-commit");
}

// The things still lying in a room.
const itemsIn = (state: AdventureState, room: RoomId) =>
  ITEM_IDS.filter((i) => ITEMS[i].home === room && !state.inventory.includes(i));

export function describe(state: AdventureState): string[] {
  const room = ROOMS[state.room];
  const text = lit(state, state.room) ? "cold storage, lit now: ice walls, and in them every backup ever taken." : room.text;
  const here = itemsIn(state, state.room).map((i) => ITEMS[i].name);
  return [
    `== ${room.name} ==`,
    text,
    ...(here.length ? [`you see ${here.join(", ")}.`] : []),
    `exits: ${DIRS.filter((d) => room.exits[d]).join(", ")}.`,
  ];
}

// The first lines on entering: what to type, how far along a kept walk is, and the room.
export function begin(state: AdventureState): string[] {
  const kept = state.room !== START || state.inventory.length > 0 || state.secrets.length > 0;
  return [
    "the data world. type look, go, take, use, inventory, help or quit.",
    ...(complete(state) ? [`every secret is found and the stamp is yours. wander on.`] : kept ? [`welcome back. ${tally(state)}.`] : []),
    ...describe(state),
  ];
}

// The thing a list of words names, carried or lying here.
function findItem(words: string[]): ItemId | undefined {
  return ITEM_IDS.find((i) => words.some((w) => ITEMS[i].words.includes(w)));
}

function look(state: AdventureState, words: string[]): string[] {
  if (words.length === 0) return describe(state);
  const item = findItem(words);
  if (item && (state.inventory.includes(item) || itemsIn(state, state.room).includes(item))) return [`${ITEMS[item].name}: ${ITEMS[item].text}`];
  const scenery = ROOMS[state.room].scenery ?? {};
  const seen = words.find((w) => Object.hasOwn(scenery, w));
  if (seen) return [lit(state, state.room) && seen === "ice" ? "the ice is lit, and the first commit is plain to read." : scenery[seen]];
  return [`you see no ${words.join(" ")} here.`];
}

function go(state: AdventureState, dir: Dir | undefined, typed: string): Turn {
  if (!dir) return { state, lines: [typed ? `"${typed}" is not a direction. north, south, east or west.` : "go where? north, south, east or west."] };
  const to = ROOMS[state.room].exits[dir];
  if (!to) return { state, lines: [`no way ${dir} from here.`] };
  const next = { ...state, room: to };
  return { state: next, lines: describe(next) };
}

function take(state: AdventureState, words: string[]): Turn {
  if (words.length === 0) return { state, lines: ["take what?"] };
  const item = findItem(words);
  if (item && state.inventory.includes(item)) return { state, lines: [`you already carry ${ITEMS[item].name}.`] };
  if (!item || !itemsIn(state, state.room).includes(item)) {
    const scenery = ROOMS[state.room].scenery ?? {};
    if (words.some((w) => Object.hasOwn(scenery, w))) return { state, lines: ["that stays where it is."] };
    return { state, lines: [`there is no ${words.join(" ")} here to take.`] };
  }
  return { state: { ...state, inventory: [...state.inventory, item] }, lines: [`taken: ${ITEMS[item].name}.`] };
}

function apply(state: AdventureState, words: string[]): Turn {
  if (words.length === 0) return { state, lines: ["use what?"] };
  const item = findItem(words);
  if (!item || !state.inventory.includes(item)) return { state, lines: [`you carry no ${words.join(" ")}.`] };
  const id = SECRET_IDS.find((s) => SECRETS[s].item === item && SECRETS[s].room === state.room);
  if (!id) return { state, lines: [`you try ${ITEMS[item].name}. nothing here needs it.`] };
  if (state.secrets.includes(id)) return { state, lines: [`done already: you found ${SECRETS[id].name} here.`] };
  const next = { ...state, secrets: [...state.secrets, id] };
  const lines = [...SECRETS[id].found, `secret found: ${SECRETS[id].name}. ${tally(next)}.`];
  if (!complete(next)) return { state: next, lines };
  return {
    state: next,
    lines: [...lines, `all four secrets found. a stamp is yours: ${STAMP}.`, "type quit, then stamps, to see it."],
    won: true,
  };
}

function inventory(state: AdventureState): string[] {
  const carried = state.inventory.length ? `you carry ${state.inventory.map((i) => ITEMS[i].name).join(", ")}.` : "your pockets are empty.";
  const found = state.secrets.length ? [`found: ${state.secrets.map((s) => SECRETS[s].name).join(", ")}.`] : [];
  return [carried, `${tally(state)}.`, ...found];
}

// One typed line. Words are matched without case and little words like "the" are skipped.
export function step(state: AdventureState, line: string): Turn {
  const [verb = "", ...rest] = line.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const words = rest.filter((w) => !FILLER.has(w));

  const dir = asDir(verb);
  if (dir) return go(state, dir, verb);

  switch (verb) {
    case "":
      return { state, lines: [] };
    case "look":
    case "l":
    case "examine":
    case "x":
      return { state, lines: look(state, words) };
    case "go":
    case "walk":
    case "move":
      return go(state, asDir(words[0]), words.join(" "));
    case "take":
    case "get":
    case "grab":
    case "pick":
      return take(state, words);
    case "use":
      return apply(state, words);
    case "inventory":
    case "inv":
    case "i":
      return { state, lines: inventory(state) };
    case "help":
    case "?":
      return { state, lines: HELP };
    case "restart":
      return { state: fresh(), lines: ["the world rolls back to its first snapshot.", ...describe(fresh())] };
    case "quit":
    case "q":
    case "exit":
    case "leave":
      return { state, lines: [`you step out of the data world. ${tally(state)}; type adventure to come back.`], quit: true };
    default:
      return { state, lines: [`"${verb}" means nothing here. type help.`] };
  }
}

// What to try next, for the palette under the prompt: look, the exits, what lies here, what is carried, the rest.
export function moves(state: AdventureState, query = ""): Suggestion[] {
  const { name, exits } = ROOMS[state.room];
  const all: Suggestion[] = [
    { line: "look", label: "Look around", hint: name },
    ...DIRS.flatMap((d) => {
      const to = exits[d];
      return to ? [{ line: `go ${d}`, label: `Go ${d}`, hint: ROOMS[to].name }] : [];
    }),
    ...itemsIn(state, state.room).map((i) => ({ line: `take ${i}`, label: `Take the ${i}`, hint: "here" })),
    ...state.inventory.map((i) => ({ line: `use ${i}`, label: `Use the ${i}`, hint: "carried" })),
    { line: "inventory", label: "Inventory", hint: tally(state) },
    { line: "help", label: "Help", hint: "every verb" },
    { line: "quit", label: "Quit", hint: "back to the terminal" },
  ];
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!q) return all;
  const first = all.filter((s) => s.line.startsWith(q));
  const then = all.filter((s) => !first.includes(s) && s.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)));
  return [...first, ...then];
}

// Saved as JSON; anything unreadable, or naming a room, thing or secret that does not exist, is dropped.
export function encode(state: AdventureState): string {
  return JSON.stringify({ v: 1, room: state.room, inventory: state.inventory, secrets: state.secrets });
}

const known = <T extends string>(ids: readonly T[], value: unknown): T[] =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is T => ids.includes(v as T)))] : [];

export function decode(stored: string | null | undefined): AdventureState {
  if (!stored) return fresh();
  try {
    const value: unknown = JSON.parse(stored);
    if (typeof value !== "object" || value === null) return fresh();
    const v = value as Record<string, unknown>;
    return {
      room: ROOM_IDS.includes(v.room as RoomId) ? (v.room as RoomId) : START,
      inventory: known(ITEM_IDS, v.inventory),
      secrets: known(SECRET_IDS, v.secrets),
    };
  } catch {
    return fresh();
  }
}

export type StoreLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };

// The kept walk, or a fresh one when there is none or storage is blocked.
export function loadProgress(storage: StoreLike | null | undefined): AdventureState {
  try {
    return decode(storage?.getItem(ADVENTURE_KEY));
  } catch {
    return fresh();
  }
}

// Keep the walk, and once every secret is found put the stamp in the terminal's list (once). `saved` is false when
// storage refused the walk; `stamp` is true when the stamp is in the stored list after this call.
export function saveProgress(storage: StoreLike | null | undefined, state: AdventureState): { saved: boolean; stamp: boolean } {
  if (!storage) return { saved: false, stamp: false };
  let saved = false;
  let stamp = false;
  try {
    storage.setItem(ADVENTURE_KEY, encode(state));
    saved = true;
  } catch {
    // private mode or a full quota: the walk lasts until reload
  }
  if (complete(state)) {
    try {
      const stamps = parseStamps(storage.getItem(STAMPS_KEY));
      if (!stamps.includes(STAMP)) storage.setItem(STAMPS_KEY, JSON.stringify([...stamps, STAMP]));
      stamp = true;
    } catch {
      // the stamp is shown as won in the log, only not kept
    }
  }
  return { saved, stamp };
}
