import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import {
  ADVENTURE_KEY,
  begin,
  complete,
  decode,
  describe,
  DIRS,
  encode,
  fresh,
  HELP,
  ITEMS,
  loadProgress,
  moves,
  ROOMS,
  saveProgress,
  SECRETS,
  STAMP,
  START,
  step,
  UNSAVED,
  type AdventureState,
  type Dir,
  type RoomId,
  type StoreLike,
  type Turn,
} from "./adventure.ts";
import { parseStamps, run, STAMPS_KEY, type TerminalState } from "./terminal.ts";

const ROOT = resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

// The shortest walk that finds every secret, from the Warehouse.
const WIN = [
  "take lantern",
  "w",
  "take schema",
  "e",
  "s",
  "take key",
  "n",
  "e",
  "use schema",
  "e",
  "use key",
  "w",
  "n",
  "take net",
  "w",
  "use net",
  "n",
  "use lantern",
];

// Every line in turn, the turns kept.
function play(lines: string[], state: AdventureState = fresh()): { state: AdventureState; turns: Turn[] } {
  const turns: Turn[] = [];
  for (const line of lines) {
    const turn = step(state, line);
    turns.push(turn);
    state = turn.state;
  }
  return { state, turns };
}

const text = (turn: Turn) => turn.lines.join("\n");

// localStorage in memory.
function memory(seed: Record<string, string> = {}): StoreLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

// Safari private mode and a full quota: reads and writes both throw.
const blocked: StoreLike = {
  getItem() {
    throw new DOMException("The operation is insecure.", "SecurityError");
  },
  setItem() {
    throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
  },
};

const OPPOSITE: Record<Dir, Dir> = { north: "south", south: "north", east: "west", west: "east" };

test("eight rooms with the named places, every exit has a way back, and every room is reachable", () => {
  const ids = Object.keys(ROOMS) as RoomId[];
  assert.equal(ids.length, 8);
  for (const name of ["The Warehouse", "The Lake", "The Broken DAG", "Staging Table", "Cron Tavern"]) {
    assert.ok(ids.some((id) => ROOMS[id].name === name), name);
  }
  for (const id of ids) {
    for (const d of DIRS) {
      const to = ROOMS[id].exits[d];
      if (to) assert.equal(ROOMS[to].exits[OPPOSITE[d]], id, `${id} ${d} -> ${to} has no way back`);
    }
  }
  const seen = new Set<RoomId>([START]);
  const queue: RoomId[] = [START];
  while (queue.length) {
    for (const to of Object.values(ROOMS[queue.shift()!].exits)) {
      if (!seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  assert.deepEqual([...seen].sort(), [...ids].sort());
});

test("four secrets, each found with a different thing in a different room, and every thing lies in a real room", () => {
  const secrets = Object.values(SECRETS);
  assert.equal(secrets.length, 4);
  assert.equal(new Set(secrets.map((s) => s.item)).size, 4);
  assert.equal(new Set(secrets.map((s) => s.room)).size, 4);
  for (const s of secrets) {
    assert.ok(s.room in ROOMS && s.item in ITEMS, s.name);
    assert.notEqual(ITEMS[s.item].home, s.room, `${s.name}: the thing is not found where it is used`);
  }
  for (const item of Object.values(ITEMS)) assert.ok(item.home in ROOMS, item.name);
});

test("entering fresh prints the verbs and the Warehouse with its lantern and four exits", () => {
  const lines = begin(fresh());
  assert.match(lines[0], /look, go, take, use, inventory, help or quit/);
  assert.ok(lines.includes("== The Warehouse =="));
  assert.ok(lines.includes("you see an index lantern."));
  assert.equal(lines.at(-1), "exits: north, south, east, west.");
  assert.ok(!lines.some((l) => /welcome back/.test(l)));
});

test("n/s/e/w, the full words and go <direction> all walk; a wall or a non-direction stays put", () => {
  for (const line of ["n", "north", "go north", "GO N", "walk n", "  go   north  "]) {
    const turn = step(fresh(), line);
    assert.equal(turn.state.room, "lake", line);
    assert.equal(turn.lines[0], "== The Lake ==", line);
  }
  assert.equal(step(fresh(), "e").state.room, "staging");
  assert.equal(step(fresh(), "s").state.room, "tavern");
  assert.equal(step(fresh(), "w").state.room, "catalog");
  const tavern = step(fresh(), "s").state;
  const wall = step(tavern, "south");
  assert.equal(wall.state, tavern, "a wall leaves the very same state");
  assert.deepEqual(wall.lines, ["no way south from here."]);
  assert.deepEqual(step(fresh(), "go").lines, ["go where? north, south, east or west."]);
  assert.deepEqual(step(fresh(), "go lake").lines, ['"lake" is not a direction. north, south, east or west.']);
  assert.equal(step(fresh(), "go lake").state.room, "warehouse");
});

test("take picks up what lies here once; the room no longer shows it", () => {
  const took = step(fresh(), "take the lantern");
  assert.deepEqual(took.state.inventory, ["lantern"]);
  assert.deepEqual(took.lines, ["taken: an index lantern."]);
  assert.ok(!describe(took.state).some((l) => l.startsWith("you see")));
  assert.deepEqual(step(took.state, "get lamp").lines, ["you already carry an index lantern."]);
  assert.equal(step(took.state, "get lamp").state, took.state);
  assert.deepEqual(step(fresh(), "pick up lantern").state.inventory, ["lantern"]);
  assert.deepEqual(step(fresh(), "take net").lines, ["there is no net here to take."]);
  assert.deepEqual(step(fresh(), "take crates").lines, ["that stays where it is."]);
  assert.deepEqual(step(fresh(), "take").lines, ["take what?"]);
});

test("use needs the thing in hand and the right room; a found secret is found once", () => {
  assert.deepEqual(step(fresh(), "use lantern").lines, ["you carry no lantern."]);
  assert.deepEqual(step(fresh(), "use").lines, ["use what?"]);
  const held = step(fresh(), "take lantern").state;
  const wrong = step(held, "use lantern");
  assert.deepEqual(wrong.state.secrets, []);
  assert.match(text(wrong), /nothing here needs it/);

  const atGlacier = play(["n", "n"], held).state;
  assert.match(describe(atGlacier).join(" "), /too dark/);
  const found = step(atGlacier, "use lantern");
  assert.deepEqual(found.state.secrets, ["first-commit"]);
  assert.match(text(found), /initial commit/);
  assert.match(text(found), /secret found: the first commit\. secrets: 1 of 4\./);
  assert.equal(found.won, undefined);
  assert.match(describe(found.state).join(" "), /lit now/);
  const again = step(found.state, "use lantern");
  assert.equal(again.state, found.state);
  assert.match(text(again), /done already/);
});

test("step never changes the state it is given", () => {
  const deepFreeze = (s: AdventureState) => Object.freeze({ ...s, inventory: Object.freeze([...s.inventory]), secrets: Object.freeze([...s.secrets]) });
  let state: AdventureState = deepFreeze(fresh());
  for (const line of [...WIN, "restart", "inventory", "look", "quit"]) {
    const before = JSON.stringify(state);
    const turn = step(state, line);
    assert.equal(JSON.stringify(state), before, line);
    state = deepFreeze(turn.state);
  }
});

test("the full walk finds all four secrets, wins on the last line only, and names the stamp", () => {
  const { state, turns } = play(WIN);
  assert.equal(state.room, "glacier");
  assert.deepEqual([...state.secrets].sort(), Object.keys(SECRETS).sort());
  assert.ok(complete(state));
  assert.deepEqual(
    turns.map((t) => t.won ?? false),
    WIN.map((_, i) => i === WIN.length - 1),
  );
  assert.ok(turns.every((t) => !t.quit));
  const last = text(turns.at(-1)!);
  assert.match(last, /secrets: 4 of 4/);
  assert.match(last, new RegExp(`a stamp is yours: ${STAMP}`));
  // the secrets come one at a time
  assert.deepEqual(
    turns.map((t) => t.state.secrets.length).filter((n, i, all) => i === 0 || n !== all[i - 1]),
    [0, 1, 2, 3, 4],
  );
  // a won game re-entered says so
  assert.match(begin(state).join(" "), /every secret is found and the stamp is yours/);
});

test("inventory, help, quit, restart, look at things, and anything else", () => {
  assert.deepEqual(step(fresh(), "inventory").lines, ["your pockets are empty.", "secrets: 0 of 4."]);
  const mid = play(WIN.slice(0, 9)).state;
  assert.deepEqual(step(mid, "i").lines, [
    "you carry an index lantern, a rolled-up schema, v3, a brass key stamped RETRY.",
    "secrets: 1 of 4.",
    "found: the clean load.",
  ]);
  assert.equal(step(fresh(), "help").lines, HELP);
  for (const verb of ["look", "go", "take", "use", "inventory", "quit"]) assert.ok(HELP.some((l) => l.startsWith(verb)), verb);

  for (const q of ["quit", "q", "exit", "leave"]) {
    const turn = step(mid, q);
    assert.equal(turn.quit, true, q);
    assert.equal(turn.state, mid, "quitting keeps the walk");
    assert.match(text(turn), /secrets: 1 of 4; type adventure to come back/);
  }
  const restarted = step(mid, "restart");
  assert.deepEqual(restarted.state, fresh());
  assert.ok(restarted.lines.includes("== The Warehouse =="));

  assert.deepEqual(step(fresh(), "look").lines, describe(fresh()));
  assert.deepEqual(step(fresh(), "look at the lantern").lines, ["an index lantern: it lights whatever it is pointed at, eventually."]);
  assert.match(text(step(fresh(), "x crates")), /fact_orders_final_REAL/);
  assert.deepEqual(step(fresh(), "look net").lines, ["you see no net here."]);
  // a word that is a property of every object is still just a word
  assert.deepEqual(step(fresh(), "look constructor").lines, ["you see no constructor here."]);
  assert.deepEqual(step(fresh(), "take toString").lines, ["there is no tostring here to take."]);
  assert.deepEqual(step(fresh(), "dance").lines, ['"dance" means nothing here. type help.']);
  assert.deepEqual(step(fresh(), "   ").lines, []);
});

test("the palette offers look, the exits, what lies here, what is carried, and each line does something", () => {
  const lines = (s: AdventureState, q = "") => moves(s, q).map((m) => m.line);
  assert.deepEqual(lines(fresh()), ["look", "go north", "go south", "go east", "go west", "take lantern", "inventory", "help", "quit"]);
  const held = step(fresh(), "take lantern").state;
  assert.ok(lines(held).includes("use lantern") && !lines(held).includes("take lantern"));
  assert.deepEqual(lines(fresh(), "go"), ["go north", "go south", "go east", "go west"]);
  assert.deepEqual(lines(fresh(), "TAKE"), ["take lantern"]);
  assert.equal(moves(fresh()).find((m) => m.line === "go north")?.hint, "The Lake");
  let state = fresh();
  for (const line of WIN) {
    for (const m of moves(state)) assert.doesNotMatch(text(step(state, m.line)), /means nothing|not a direction|no way/, m.line);
    state = step(state, line).state;
  }
});

test("progress saves and loads back, mid-walk, and a kept walk is welcomed back", () => {
  const storage = memory();
  const mid = play(WIN.slice(0, 11)).state;
  assert.deepEqual(saveProgress(storage, mid), { saved: true, stamp: false });
  assert.ok(storage.data.has(ADVENTURE_KEY));
  assert.ok(!storage.data.has(STAMPS_KEY), "no stamp before the last secret");
  const loaded = loadProgress(storage);
  assert.deepEqual(loaded, mid);
  assert.match(begin(loaded).join("\n"), /welcome back\. secrets: 2 of 4\.\n== The Broken DAG ==/);
  // the walk carries on from where it was kept
  assert.ok(complete(play(WIN.slice(11), loaded).state));
  assert.deepEqual(loadProgress(memory()), fresh());
});

test("winning puts the stamp in the terminal's list once, beside stamps already there, and `stamps` shows it", () => {
  const storage = memory({ [STAMPS_KEY]: JSON.stringify(["Old Stamp"]) });
  const won = play(WIN).state;
  assert.deepEqual(saveProgress(storage, won), { saved: true, stamp: true });
  assert.deepEqual(saveProgress(storage, step(won, "look").state), { saved: true, stamp: true });
  const stamps = parseStamps(storage.data.get(STAMPS_KEY));
  assert.deepEqual(stamps, ["Old Stamp", STAMP]);
  const state: TerminalState = { theme: "light", sound: false, season: "auto", stamps, appearance: { printRun: "house", lab: null } };
  assert.deepEqual(run("stamps", state).lines, ["stamps (2):", "  [*] Old Stamp", `  [*] ${STAMP}`]);
  // a restart after winning starts the walk over and keeps the stamp
  saveProgress(storage, step(won, "restart").state);
  assert.deepEqual(loadProgress(storage), fresh());
  assert.deepEqual(parseStamps(storage.data.get(STAMPS_KEY)), ["Old Stamp", STAMP]);
});

test("private mode: storage that throws on every call never breaks the game, which still runs to a win", () => {
  assert.deepEqual(loadProgress(blocked), fresh());
  assert.deepEqual(loadProgress(null), fresh());
  let state = loadProgress(blocked);
  for (const line of WIN) {
    const turn = step(state, line);
    assert.deepEqual(saveProgress(blocked, turn.state), { saved: false, stamp: false }, line);
    state = turn.state;
  }
  assert.ok(complete(state));
  assert.deepEqual(saveProgress(null, state), { saved: false, stamp: false });
  assert.deepEqual(saveProgress(undefined, state), { saved: false, stamp: false });
  // the walk saves but the stamp list cannot be read: the walk is still kept
  const half: StoreLike = { getItem: () => { throw new Error("no"); }, setItem: () => {} };
  assert.deepEqual(saveProgress(half, state), { saved: true, stamp: false });
  assert.match(UNSAVED, /until the page reloads/);
});

test("stored progress decodes strictly: garbage, unknown rooms, things and secrets are dropped", () => {
  const won = play(WIN).state;
  assert.deepEqual(decode(encode(won)), won);
  for (const bad of [null, undefined, "", "{", "42", "null", "[]", '"x"']) assert.deepEqual(decode(bad), fresh(), String(bad));
  assert.deepEqual(
    decode(JSON.stringify({ room: "moon", inventory: ["net", "net", "sword", 3], secrets: ["green-dag", "hack", "green-dag"] })),
    { room: START, inventory: ["net"], secrets: ["green-dag"] },
  );
  assert.deepEqual(decode(JSON.stringify({ room: "lake", inventory: "net", secrets: {} })), { room: "lake", inventory: [], secrets: [] });
});

test("the terminal's adventure command hands over to the game, and the lazy terminal wires it to storage", () => {
  assert.deepEqual(run("adventure", { theme: "light", sound: false, season: "auto", stamps: [], appearance: { printRun: "house", lab: null } }), { lines: [], effect: { kind: "adventure" } });
  const terminal = read("components/pocket-terminal.tsx");
  assert.match(terminal, /from "@\/lib\/adventure";/);
  assert.match(terminal, /effect\?\.kind === "adventure"/);
  assert.match(terminal, /loadProgress\(storage\(\)\)/);
  assert.match(terminal, /saveProgress\(storage\(\), state\)/);
  assert.match(terminal, /step\(game, line\)/);
  assert.match(terminal, /turn\.quit \? null : turn\.state/);
  // the game rides the terminal's lazy chunk, never the loader on every page
  assert.doesNotMatch(read("components/pocket-terminal-loader.tsx"), /adventure/);
});
