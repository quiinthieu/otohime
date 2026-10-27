import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { CONSOLE_MENU, PUBLIC_PAGES } from "./pages.ts";
import { createAppearanceStore, normalizeLab } from "./ink-lab.ts";
import { PRINT_RUN_IDS, PRINT_RUNS } from "./print-runs.ts";
import {
  findPlace,
  HELP,
  moveActive,
  printRunStatus,
  opensTerminal,
  parseSeasonChoice,
  parseStamps,
  PLACES,
  run,
  suggest,
  SUGGESTIONS,
  type TerminalState,
} from "./terminal.ts";

const ROOT = resolve(import.meta.dirname, "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

const STATE: TerminalState = { theme: "light", sound: false, season: "auto", stamps: [], appearance: { printRun: "house", lab: null } };
const key = (k: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean }> = {}) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...mods,
});

test("the places are every public page including Lab, then ask and postcard, each once", () => {
  assert.deepEqual(
    PLACES.slice(0, PUBLIC_PAGES.length).map((p) => p.href),
    PUBLIC_PAGES.map((p) => p.href),
  );
  assert.deepEqual(PLACES.map((p) => p.name), ["home", "work", "play", "notes", "music", "projects", "sketches", "lab", "ask", "postcard"]);
  assert.equal(new Set(PLACES.map((p) => p.name)).size, PLACES.length);
  assert.equal(findPlace("ask"), PLACES.find((p) => p.name === "ask"));
  assert.equal((findPlace("ask") as { href: string }).href, "/");
  assert.equal((findPlace("postcard") as { href: string }).href, "/postcard");
  assert.equal((findPlace("play") as { href: string }).href, "/play");
});

test("print run reports the effective appearance, including an applied Lab", () => {
  for (const id of PRINT_RUN_IDS) {
    const appearance = { printRun: id, lab: null };
    assert.deepEqual(run("print run", { ...STATE, appearance }), { lines: [`print run: ${PRINT_RUNS[id].label} (${id})`] });
  }
  const appearance = { printRun: "sumi" as const, lab: normalizeLab({ printRun: "indigo" }) };
  assert.deepEqual(run("print run", { ...STATE, appearance }), { lines: ["print run: Indigo night (indigo); Ink Lab override active"] });
});

test("print run selects only exact validated ids; malformed commands have no effect", () => {
  for (const id of PRINT_RUN_IDS) {
    assert.deepEqual(run(`  PRINT   RUN  ${id.toUpperCase()}  `, STATE), { lines: [], effect: { kind: "print-run", printRun: id } });
  }
  const before = structuredClone(STATE);
  for (const line of ["print", "print riso", "print run purple", "print run ris", "print run riso extra", "print run __proto__", "print run <script>"]) {
    const reply = run(line, STATE);
    assert.equal(reply.effect, undefined, line);
    assert.match(reply.lines.join(" "), /print run.*house.*sumi.*riso.*indigo/, line);
  }
  assert.deepEqual(STATE, before);
});

test("preset results report effective choice and disclose either storage failure", () => {
  const memory = () => ({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const denied = () => { throw new Error("denied"); };
  for (const ports of [{ local: memory, session: denied }, { local: denied, session: memory }, { local: denied, session: denied }]) {
    const store = createAppearanceStore(ports);
    store.applyLab(normalizeLab({ printRun: "indigo" }));
    const result = store.setPrintRun("riso");
    assert.equal(result.snapshot.lab, null);
    assert.equal(result.snapshot.printRun, "riso");
    assert.equal(printRunStatus(result), "print run: Riso pink + mint (riso). Storage is blocked; active on this page only. Reload may not retain this choice.");
  }
  const store = createAppearanceStore({ local: memory, session: memory });
  assert.equal(printRunStatus(store.setPrintRun("house")), "print run: House (house). Saved for reload; Ink Lab override cleared.");
});

test("lab navigation and print run choices appear in help and suggestions without changing the LCD", () => {
  for (const line of ["lab", "go lab", "go /lab"]) assert.deepEqual(run(line, STATE).effect, { kind: "go", href: "/lab" });
  assert.ok(HELP.some((line) => line.startsWith("print run")));
  assert.ok(HELP.some((line) => line.startsWith("lab")));
  assert.deepEqual(suggest("print run").map((s) => s.line), ["print run", ...PRINT_RUN_IDS.map((id) => `print run ${id}`)]);
  assert.ok(suggest("lab").some((s) => s.line === "go lab"));
  assert.equal(CONSOLE_MENU.length, 7);
  assert.ok(CONSOLE_MENU.every((p) => String(p.href) !== "/lab"));
});

test("go opens a page by name, path or a prefix only one page has", () => {
  for (const [typed, href] of [
    ["go notes", "/notes"],
    ["go /notes", "/notes"],
    ["GO NOTES", "/notes"],
    ["go no", "/notes"],
    ["go m", "/music"],
    ["go /", "/"],
    ["go home", "/"],
    ["go pos", "/postcard"],
    ["cd work", "/work"],
    ["open sketches", "/sketches"],
  ] as const) {
    const reply = run(typed, STATE);
    assert.deepEqual(reply.effect, { kind: "go", href }, typed);
    assert.match(reply.lines[0], /^opening /, typed);
  }
});

test("a bare page name or prefix is a go; an exact name beats a longer one", () => {
  assert.deepEqual(run("notes", STATE).effect, { kind: "go", href: "/notes" });
  assert.deepEqual(run("mu", STATE).effect, { kind: "go", href: "/music" });
  assert.deepEqual(run("play", STATE).effect, { kind: "go", href: "/play" });
  assert.deepEqual(run("Sketches", STATE).effect, { kind: "go", href: "/sketches" });
  assert.deepEqual(run("ask", STATE).effect, { kind: "go", href: "/" });
  assert.deepEqual(run("postcard", STATE).effect, { kind: "go", href: "/postcard" });
});

test("a prefix several pages share lists them and goes nowhere", () => {
  const reply = run("p", STATE);
  assert.equal(reply.effect, undefined);
  assert.equal(reply.lines[0], `"p" could be play, projects, postcard`);
  assert.equal(run("go pro", STATE).effect?.kind, "go");
  assert.equal(run("go pr", STATE).effect?.kind, "go"); // projects alone starts with "pr"
  assert.equal(run("go p", STATE).effect, undefined);
});

test("an unknown page or command says so and has no effect", () => {
  const page = run("go nowhere", STATE);
  assert.equal(page.effect, undefined);
  assert.match(page.lines[0], /^no page called "nowhere"/);
  const cmd = run("rm -rf /", STATE);
  assert.equal(cmd.effect, undefined);
  assert.equal(cmd.lines[0], "unknown command: rm. type help");
  // two words are never a bare go, even when the first is a page
  assert.equal(run("notes please", STATE).effect, undefined);
  assert.match(run("go", STATE).lines[0], /^go where\? home, work/);
});

test("an empty line prints nothing and does nothing", () => {
  assert.deepEqual(run("", STATE), { lines: [] });
  assert.deepEqual(run("   ", STATE), { lines: [] });
});

test("help lists every command", () => {
  const reply = run("help", STATE);
  assert.equal(reply.lines, HELP);
  assert.deepEqual(run("?", STATE).lines, HELP);
  for (const cmd of ["help", "go", "theme", "sound", "season", "stamps", "adventure", "clear", "exit"]) {
    assert.ok(HELP.some((l) => l.startsWith(cmd)), cmd);
  }
});

test("theme flips what is showing, or pins light or dark", () => {
  assert.deepEqual(run("theme", STATE).effect, { kind: "theme", theme: "dark" });
  assert.deepEqual(run("theme", { ...STATE, theme: "dark" }).effect, { kind: "theme", theme: "light" });
  assert.deepEqual(run("theme toggle", STATE).effect, { kind: "theme", theme: "dark" });
  assert.deepEqual(run("theme light", { ...STATE, theme: "light" }).effect, { kind: "theme", theme: "light" });
  assert.deepEqual(run("Theme DARK", STATE), { lines: ["theme: dark"], effect: { kind: "theme", theme: "dark" } });
  assert.equal(run("theme purple", STATE).effect, undefined);
});

test("sound flips the switch, or sets it on or off", () => {
  assert.deepEqual(run("sound", STATE), { lines: ["sound: on"], effect: { kind: "sound", on: true } });
  assert.deepEqual(run("sound", { ...STATE, sound: true }).effect, { kind: "sound", on: false });
  assert.deepEqual(run("sound off", { ...STATE, sound: true }).effect, { kind: "sound", on: false });
  assert.deepEqual(run("sound on", { ...STATE, sound: true }).effect, { kind: "sound", on: true });
  assert.equal(run("sound loud", STATE).effect, undefined);
});

test("season pins a season or auto; bare, it reports the choice", () => {
  for (const s of ["auto", "spring", "summer", "autumn", "winter"] as const) {
    assert.deepEqual(run(`season ${s}`, STATE), { lines: [`season: ${s}`], effect: { kind: "season", season: s } });
  }
  const bare = run("season", { ...STATE, season: "winter" });
  assert.equal(bare.effect, undefined);
  assert.match(bare.lines[0], /^season: winter\. pick auto, spring, summer, autumn, winter$/);
  assert.equal(run("season monsoon", STATE).effect, undefined);
  assert.equal(parseSeasonChoice("summer"), "summer");
  assert.equal(parseSeasonChoice(null), "auto");
  assert.equal(parseSeasonChoice("fall"), "auto");
});

test("stamps lists what is won, or says there are none", () => {
  assert.deepEqual(run("stamps", STATE), { lines: ["no stamps yet. the adventure hides one."] });
  const won = run("stamps", { ...STATE, stamps: ["The Lake", "The Broken DAG"] });
  assert.deepEqual(won.lines, ["stamps (2):", "  [*] The Lake", "  [*] The Broken DAG"]);
  assert.equal(won.effect, undefined);
});

test("stored stamps parse from a JSON array of names, and anything else is none", () => {
  assert.deepEqual(parseStamps('["a","b"]'), ["a", "b"]);
  assert.deepEqual(parseStamps('["a",1,null,"",{}]'), ["a"]);
  for (const bad of [null, undefined, "", "{", '{"a":1}', "42"]) assert.deepEqual(parseStamps(bad), [], String(bad));
});

test("clear, exit and adventure, which hands the prompt to lib/adventure.ts", () => {
  assert.deepEqual(run("clear", STATE), { lines: [], effect: { kind: "clear" } });
  assert.deepEqual(run("cls", STATE).effect, { kind: "clear" });
  for (const c of ["exit", "quit", "close", "q"]) assert.deepEqual(run(c, STATE).effect, { kind: "close" }, c);
  assert.deepEqual(run("Adventure", STATE), { lines: [], effect: { kind: "adventure" } });
});

test("the palette shows everything when empty, and filters by line start first, then by word", () => {
  assert.deepEqual(suggest(""), SUGGESTIONS);
  assert.deepEqual(suggest("  "), SUGGESTIONS);
  assert.deepEqual(suggest("go no").map((s) => s.line), ["go notes"]);
  assert.deepEqual(suggest("them").map((s) => s.line), ["theme"]);
  // "th" starts the theme line, then the word "the" in "Ask the console"
  assert.deepEqual(suggest("th").map((s) => s.line), ["theme", "go ask"]);
  // "s" starts sound, the seasons, stamps; then go sketches by its name and the season labels by word
  const s = suggest("s").map((x) => x.line);
  assert.deepEqual(s.slice(0, 7), ["sound", "season auto", "season spring", "season summer", "season autumn", "season winter", "stamps"]);
  assert.ok(s.includes("go sketches"));
  assert.deepEqual(suggest("MUS").map((x) => x.line), ["go music"]);
  assert.deepEqual(suggest("zzz"), []);
  // every suggestion runs to something other than "unknown command"
  for (const item of SUGGESTIONS) assert.doesNotMatch(run(item.line, STATE).lines.join(" "), /unknown command/, item.line);
});

test("arrows move through the palette and wrap through the prompt", () => {
  assert.equal(moveActive(-1, 3, 1), 0);
  assert.equal(moveActive(0, 3, 1), 1);
  assert.equal(moveActive(2, 3, 1), -1);
  assert.equal(moveActive(-1, 3, -1), 2);
  assert.equal(moveActive(0, 3, -1), -1);
  assert.equal(moveActive(-1, 0, 1), -1);
  assert.equal(moveActive(-1, 0, -1), -1);
});

test("Cmd/Ctrl-K always opens; / opens only outside a field and without Cmd, Ctrl or Alt", () => {
  assert.ok(opensTerminal(key("k", { metaKey: true }), false));
  assert.ok(opensTerminal(key("k", { ctrlKey: true }), false));
  assert.ok(opensTerminal(key("K", { ctrlKey: true }), true), "Ctrl-K opens even from a field");
  assert.ok(!opensTerminal(key("k"), false));
  assert.ok(!opensTerminal(key("k", { ctrlKey: true, altKey: true }), false));
  assert.ok(opensTerminal(key("/"), false));
  assert.ok(!opensTerminal(key("/"), true), "/ in a field types a slash");
  for (const mod of ["metaKey", "ctrlKey", "altKey"] as const) assert.ok(!opensTerminal(key("/", { [mod]: true }), false), mod);
  assert.ok(!opensTerminal(key("?"), false));
  assert.ok(!opensTerminal(key("Enter"), false));
});

// The wiring, read as text: the browser e2e for the dialog comes with a later task.
test("the loader is tiny, mounted in the site layout before the pages, and only import()s the terminal", () => {
  const loader = read("components/pocket-terminal-loader.tsx");
  assert.ok(statSync(join(ROOT, "components/pocket-terminal-loader.tsx")).size < 4096);
  assert.match(loader, /import\("@\/components\/pocket-terminal"\)/);
  assert.doesNotMatch(loader, /^import (?!type )[^;]*["']@\/components\/pocket-terminal["']/m, "a static import would put the terminal in every page");
  // its only runtime import from lib/ is the key test, which itself imports nothing, so the parser stays lazy
  assert.deepEqual([...loader.matchAll(/^import (?!type )[^;]*from "(@\/lib\/[^"]+)";$/gm)].map((m) => m[1]), ["@/lib/terminal-keys"]);
  assert.doesNotMatch(read("lib/terminal-keys.ts"), /^import /m);
  assert.match(loader, /addEventListener\("keydown", onKey, true\)/, "keys are taken in the capture phase");
  assert.match(loader, /stopPropagation\(\)/);
  assert.match(loader, /input, textarea, select, \[contenteditable\]/);
  const layout = read("app/(site)/layout.tsx");
  assert.match(layout, /import \{ PocketTerminalLoader \} from "@\/components\/pocket-terminal-loader";/);
  assert.ok(layout.indexOf("<PocketTerminalLoader />") > 0 && layout.indexOf("<PocketTerminalLoader />") < layout.indexOf("{children}"), "mounted ahead of the pages, so its capture listener runs before the handheld's");
});

test("the terminal is an accessible modal: a dialog with a combobox prompt, a listbox palette and a live log", () => {
  const terminal = read("components/pocket-terminal.tsx");
  assert.match(terminal, /<dialog[\s\S]*?aria-labelledby="pt-title"/);
  assert.match(terminal, /showModal\(\)/);
  assert.match(terminal, /role="combobox"/);
  assert.match(terminal, /aria-activedescendant=/);
  assert.match(terminal, /role="listbox"/);
  assert.match(terminal, /role="option"/);
  assert.match(terminal, /role="log"[\s\S]*?aria-live="polite"/);
  assert.match(terminal, /import "\.\/pocket-terminal\.css";/);
});

test("Lab has one terminal destination after joining public navigation", () => {
  assert.equal(PLACES.filter(place => place.href === "/lab").length, 1);
});
