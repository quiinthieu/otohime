// The print run's browser boundary (lib/appearance-client.ts) without a browser: the pre-paint script run in a vm
// against the store over the same fake storage, the generated per-root aliases against each root's own sheet, the
// root-layout inventory, the browser store's events, and the SVG adapters' scale and exact restore. What a real
// browser paints, persists and navigates is e2e/print-runs.test.ts.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import {
  APPEARANCE_ROOTS, APPEARANCE_VARS, appearanceBootScript, appearancePlan, appearanceStyle, appearanceTags, applyPlan,
  createBrowserAppearanceStore, createFilterRuntime, filterScale, FREQUENCY_TAG, HOUSE_SNAPSHOT, IDENTITY_SCALE,
  isIdentityScale, ROOT_APPEARANCE, SCALE_TAG, scaleValues, SEED_TAG, shiftSeed, writeFilter,
  type AppearanceWindow, type FilterScale,
} from "./appearance-client.ts";
import {
  createAppearanceStore, encodeLab, INK_LAB_KEY, LAB_RANGES, labDefaults, normalizeLab, PRINT_RUN_KEY, readStoredLab,
  type AppearanceStorage, type AppearanceStoragePorts,
} from "./ink-lab.ts";
import { HANDS, inkFilter, MATERIALS } from "./ink-modes.ts";
import { PRINT_RUN_IDS, PRINT_RUNS } from "./print-runs.ts";

const ROOT = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

class MemoryStorage implements AppearanceStorage {
  map = new Map<string, string>();
  constructor(entries: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(entries)) this.map.set(k, v);
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

class DeniedStorage implements AppearanceStorage {
  getItem(): string | null {
    throw new Error("SecurityError");
  }
  setItem() {
    throw new Error("QuotaExceededError");
  }
  removeItem() {
    throw new Error("SecurityError");
  }
}

function fakeRoot() {
  const attrs = new Map<string, string>();
  const props = new Map<string, string>();
  return {
    attrs,
    props,
    setAttribute: (name: string, value: string) => void attrs.set(name, String(value)),
    removeAttribute: (name: string) => void attrs.delete(name),
    style: {
      setProperty: (name: string, value: string) => void props.set(name, String(value)),
      removeProperty: (name: string) => props.delete(name),
    },
  };
}
const state = (root: ReturnType<typeof fakeRoot>) => ({
  attrs: Object.fromEntries([...root.attrs].sort()),
  props: Object.fromEntries([...root.props].sort()),
});

type Store = AppearanceStorage | "throw";

// The boot script in a fresh global, as a browser would run it from <head>. "throw" makes the storage getter itself
// throw, as a sandboxed iframe's does.
function boot(local: Store, session: Store) {
  const root = fakeRoot();
  const context: Record<string, unknown> = { document: { documentElement: root } };
  for (const [name, store] of [["localStorage", local], ["sessionStorage", session]] as const) {
    Object.defineProperty(context, name, {
      get() {
        if (store === "throw") throw new Error("SecurityError");
        return store;
      },
    });
  }
  runInNewContext(appearanceBootScript, context);
  return state(root);
}

// What the store reads from the same storage, applied by the runtime's applyPlan.
function viaStore(local: Store, session: Store) {
  const port = (s: Store) => () => {
    if (s === "throw") throw new Error("SecurityError");
    return s;
  };
  const snapshot = createAppearanceStore({ local: port(local), session: port(session) }).getSnapshot();
  const root = fakeRoot();
  applyPlan(root, appearancePlan(snapshot));
  return state(root);
}

function agree(local: Store, session: Store, label: string) {
  const booted = boot(local, session);
  assert.deepEqual(booted, viaStore(local, session), label);
  return booted;
}

// A small deterministic generator, so the parity sweep is the same on every run.
function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (r: () => number) => `#${Math.floor(r() * 0xffffff).toString(16).padStart(6, "0")}`;

function randomLab(r: () => number) {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const span = (k: keyof typeof LAB_RANGES) => LAB_RANGES[k].min - 0.2 * LAB_RANGES[k].max + r() * 1.4 * LAB_RANGES[k].max;
  return normalizeLab({
    version: 1, printRun: pick(PRINT_RUN_IDS),
    settings: {
      turbulence: span("turbulence"), displacement: span("displacement"), wobble: span("wobble"), grain: span("grain"),
      transitionMs: span("transitionMs"), plates: [hex(r), hex(r), hex(r)], plateCount: pick([2, 3]),
      hand: pick(HANDS), halftone: r() < 0.5,
    },
  });
}

test("the boot script marks <html> exactly as the store and applyPlan would, for every run and stored Lab", () => {
  assert.deepEqual(agree(new MemoryStorage(), new MemoryStorage(), "unset"), { attrs: {}, props: {} }, "House adds nothing");
  for (const id of PRINT_RUN_IDS) {
    const booted = agree(new MemoryStorage({ [PRINT_RUN_KEY]: id }), new MemoryStorage(), id);
    assert.equal(booted.attrs["data-print-run"], id === "house" ? undefined : id);
  }
  const r = mulberry(268);
  for (let i = 0; i < 400; i++) {
    const lab = randomLab(r);
    const stored = encodeLab(lab);
    assert.ok(readStoredLab(stored), "a canonical query restores");
    const run = PRINT_RUN_IDS[i % 4];
    const booted = agree(new MemoryStorage({ [PRINT_RUN_KEY]: run }), new MemoryStorage({ [INK_LAB_KEY]: stored }), stored);
    assert.equal(booted.attrs["data-ink-lab"], "", stored);
    assert.equal(booted.props["--ap-grain"], String(lab.settings.grain));
    assert.equal(booted.attrs["data-print-run"], lab.printRun === "house" ? undefined : lab.printRun, "the applied Lab's run wins");
  }
});

test("corrupt, partial, noncanonical and hostile stored values fall back exactly as the store does", () => {
  const canonical = encodeLab(labDefaults("riso"));
  const variants = [
    "", "v=1", canonical.toUpperCase(), canonical.replace("t=0.039", "t=0.0390"), canonical.replace("t=0.039", "t=0.5"),
    canonical.replace("t=0.039", "t=.039"), canonical.replace("t=0.039", "t=3.9e-2"), canonical.replace("d=4", "d=-4"),
    canonical.replace("g=0.04", "g=0.07"), canonical.replace("m=420", "m=425"), canonical.replace("n=3", "n=4"),
    canonical.replace("h=ink", "h=marker"), canonical.replace("o=0", "o=true"), canonical.replace("v=1", "v=2"),
    canonical.replace("292522", "29252G"), canonical.replace("%2C", ","), `${canonical}&x=1`, `${canonical}&t=0.04`,
    canonical.replace("r=riso", "r=__proto__"), `${canonical}#`, `x${canonical}`, canonical + " ".repeat(2048),
    `v=1&r=riso</script><script>alert(1)</script>`, `v=1&r=riso&p=ff0000;}body{display:none`,
  ];
  for (const raw of variants) {
    for (const run of ["riso", "constructor", "</style>", "HOUSE", ""]) {
      const booted = agree(new MemoryStorage({ [PRINT_RUN_KEY]: run }), new MemoryStorage({ [INK_LAB_KEY]: raw }), `${run} ${raw}`);
      if (raw !== canonical) assert.equal(booted.attrs["data-ink-lab"], undefined, raw);
      for (const value of [...Object.values(booted.attrs), ...Object.values(booted.props)]) {
        assert.match(value, /^(?:|sumi|riso|indigo|#[0-9a-f]{6}|\d+(?:\.\d+)?(?:ms)?)$/, `only validated values reach the DOM: ${value}`);
      }
    }
  }
});

test("denied storage, at the getter or at the call, boots House and never throws", () => {
  const lab = encodeLab(labDefaults("indigo"));
  assert.deepEqual(agree("throw", "throw", "both getters throw"), { attrs: {}, props: {} });
  assert.deepEqual(agree(new DeniedStorage(), new DeniedStorage(), "both calls throw"), { attrs: {}, props: {} });
  assert.equal(agree(new MemoryStorage({ [PRINT_RUN_KEY]: "sumi" }), "throw", "session denied").attrs["data-print-run"], "sumi");
  assert.equal(agree("throw", new MemoryStorage({ [INK_LAB_KEY]: lab }), "local denied").attrs["data-print-run"], "indigo");
});

test("the boot script and generated style carry only trusted text: no closing tag, no storage text", () => {
  assert.doesNotMatch(appearanceBootScript, /<\/|<!--/);
  for (const id of APPEARANCE_ROOTS) {
    const css = appearanceStyle(id);
    assert.doesNotMatch(css, /<\/|<!--|url\(|expression|javascript:/i, id);
  }
  // The script names the two keys, the schema's ranges and the preset ids, and nothing it read can change its text.
  for (const piece of [PRINT_RUN_KEY, INK_LAB_KEY, ...PRINT_RUN_IDS, ...HANDS]) assert.ok(appearanceBootScript.includes(piece), piece);
});

test("applyPlan resets completely: House removes every attribute and inline property a Lab set", () => {
  const root = fakeRoot();
  root.style.setProperty("--pond-print", "kept");
  root.setAttribute("data-season", "winter");
  root.setAttribute("data-theme", "dark");
  const lab = normalizeLab({ ...labDefaults("riso"), settings: { ...labDefaults("riso").settings, halftone: true } });
  applyPlan(root, appearancePlan({ printRun: "sumi", lab }));
  assert.equal(root.attrs.get("data-print-run"), "riso");
  assert.equal(root.attrs.get("data-ap-halftone"), "");
  assert.deepEqual([...root.props.keys()].sort(), ["--pond-print", ...APPEARANCE_VARS].sort());
  applyPlan(root, appearancePlan(HOUSE_SNAPSHOT));
  assert.deepEqual(state(root), { attrs: { "data-season": "winter", "data-theme": "dark" }, props: { "--pond-print": "kept" } }, "season, theme and other inline state survive");
});

// --- Roots ------------------------------------------------------------------------------------------------------

const ROOT_LAYOUTS = readdirSync(join(ROOT, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name))
  .map((e) => e.name.slice(1, -1))
  .filter((g) => {
    try {
      return Boolean(read(`app/(${g})/layout.tsx`));
    } catch {
      return false;
    }
  })
  .sort();

test("every root layout under app/ is inventoried and mounts the boundary once: boot in <head>, runtime in <body>", () => {
  assert.deepEqual(ROOT_LAYOUTS, [...APPEARANCE_ROOTS].sort());
  const documents = [...ROOT_LAYOUTS.map((g) => [`app/(${g})/layout.tsx`, g] as const), ["app/global-not-found.tsx", "site"] as const];
  for (const [file, id] of documents) {
    const text = read(file);
    const head = text.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? "";
    const body = text.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? "";
    assert.equal(head.match(/<AppearanceBoot /g)?.length, 1, `${file}: one boot`);
    assert.match(head, new RegExp(`<AppearanceBoot root="${id}" />`), file);
    assert.equal(body.match(/<AppearanceRuntime \/>/g)?.length, 1, `${file}: one runtime`);
    assert.equal(text.match(/<AppearanceBoot |<AppearanceRuntime /g)?.length, 2, `${file}: nowhere else`);
    assert.match(text, /<html [^>]*suppressHydrationWarning/, `${file}: the boot script marks <html> before hydration`);
    assert.doesNotMatch(text, /appearance\.css|@\/lib\/appearance-client/, `${file}: only through the two components`);
  }
  // Negative control: the inventory would see a root it does not know.
  assert.notDeepEqual([...ROOT_LAYOUTS, "lab"].sort(), [...APPEARANCE_ROOTS].sort());
});

test("no other file mounts the boundary, so there is one texture layer and one runtime per document", () => {
  const files = (dir: string): string[] =>
    readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? (e.name === "node_modules" ? [] : files(join(dir, e.name))) : /\.tsx?$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [join(dir, e.name)] : [],
    );
  const mounting = [...files("app"), ...files("components")].filter((f) => /<Appearance(?:Boot|Runtime)\b/.test(read(f)));
  assert.deepEqual(mounting.sort(), [...ROOT_LAYOUTS.map((g) => join("app", `(${g})`, "layout.tsx")), join("app", "global-not-found.tsx")].sort());
  const css = read("components/appearance.css");
  assert.equal(css.match(/position:\s*fixed/g)?.length, 1, "one fixed layer");
  assert.doesNotMatch(css, /content:\s*""/, "the shared sheet never shows the layer by itself");
});

test("the boundary imports only the appearance modules: no site globals, Tailwind or project code", () => {
  const imports = (file: string) => [...read(file).matchAll(/(?:\bfrom|^import)\s*["']([^"']+)["']/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports("components/appearance-boot.tsx"), ["./appearance.css", "@/lib/appearance-client"]);
  assert.deepEqual(imports("components/appearance-runtime.tsx"), ["@/lib/appearance-client", "@/lib/ink-lab", "react"]);
  assert.deepEqual(imports("lib/appearance-client.ts"), ["./ink-lab.ts", "./ink-modes.ts", "./print-runs.ts"]);
  assert.doesNotMatch(read("components/appearance.css"), /@import|tailwind/);
  assert.match(read("components/appearance-runtime.tsx"), /^"use client";/);
  assert.doesNotMatch(read("components/appearance-boot.tsx"), /use client/);
});

const declares = (sheet: string, name: string) => new RegExp(`(?:^|[\\s{;])${name.replace(/[-]/g, "\\-")}\\s*:`, "m").test(sheet);

test("every alias is a property its root's own sheet declares, and each root's scheme matches its sheet", () => {
  for (const id of APPEARANCE_ROOTS) {
    const root = ROOT_APPEARANCE[id];
    const sheet = read(root.sheet);
    assert.ok(root.aliases.paper?.length && root.aliases.ink?.length, `${id} maps paper and ink`);
    for (const names of Object.values(root.aliases)) for (const name of names) assert.ok(declares(sheet, name), `${root.sheet} declares ${name}`);
    const themed = /data-theme="dark"/.test(sheet) || /light-dark\(/.test(sheet);
    assert.equal(root.scheme === "both", themed, `${id}: ${root.scheme}`);
  }
  assert.ok(!declares(read("app/(shore)/shore.css"), "--panel"), "negative control: the check sees a missing property");
});

// The declarations of a sheet's first top-level block with exactly this selector.
function block(sheet: string, selector: string): Record<string, string> {
  const at = sheet.search(new RegExp(`^${selector.replace(/[[\]()".:]/g, "\\$&")}\\s*\\{`, "m"));
  if (at < 0) return {};
  const body = sheet.slice(sheet.indexOf("{", at) + 1, sheet.indexOf("}", at));
  return Object.fromEntries(
    body.replace(/\/\*[\s\S]*?\*\//g, "").split(";").map((d) => d.trim()).filter((d) => d.startsWith("--"))
      .map((d) => [d.slice(0, d.indexOf(":")).trim(), d.slice(d.indexOf(":") + 1).trim()]),
  );
}

test("a night run carries each themed root's own dark values for every token it does not alias", () => {
  for (const id of APPEARANCE_ROOTS) {
    const root = ROOT_APPEARANCE[id];
    const dark = block(read(root.sheet), ':root[data-theme="dark"]');
    if (root.scheme !== "both" || id === "site") {
      assert.equal(root.darkTokens, undefined, `${id}: nothing to carry (the site's tokens are light-dark())`);
      continue;
    }
    assert.ok(Object.keys(dark).length > 3, `${id}: the dark block is read`);
    const aliased = new Set(Object.values(root.aliases).flat());
    const off = (name: string) => (root.houseTexture?.html ?? "").startsWith(`${name}:`);
    const expected = Object.fromEntries(Object.entries(dark).filter(([name]) => !aliased.has(name) && !off(name)));
    assert.deepEqual({ ...root.darkTokens }, expected, `${id}: darkTokens are the sheet's own dark values`);
    const indigo = rule(appearanceStyle(id), 'html:root[data-print-run="indigo"]');
    for (const [name, value] of Object.entries(expected)) assert.equal(indigo[name], value, `${id} indigo ${name}`);
    assert.equal(rule(appearanceStyle(id), 'html:root[data-print-run="riso"]')[Object.keys(expected)[0] ?? "--none"], undefined, "a light run leaves them to the theme");
  }
  // Negative control: a drifted value would be seen.
  assert.notEqual(block(read("app/(rotor)/rotor.css"), ':root[data-theme="dark"]')["--glass"], "#2f2824");
});

test("scene surfaces name selectors their root's sheet styles, and only a colored run reaches them", () => {
  for (const id of APPEARANCE_ROOTS) {
    const root = ROOT_APPEARANCE[id];
    const sheet = read(root.sheet);
    for (const surface of root.surfaces ?? []) {
      const last = surface.selector.split(" ").at(-1)!.replace(":not(.dark-scene)", "");
      assert.ok(sheet.includes(last), `${root.sheet} styles ${last}`);
      const css = appearanceStyle(id);
      const scope = surface.night ? 'html:root:is([data-print-run="indigo"])' : "html:root[data-print-run]";
      assert.ok(css.includes(`${scope} ${surface.selector}{${surface.body}}`), `${id} ${surface.selector}`);
      for (const [hex] of surface.body.matchAll(/#[0-9a-f]{3,8}\b/gi)) assert.ok(sheet.includes(hex), `${id}: ${hex} is the root's own value, not a new one`);
    }
  }
});

// The declarations of one generated rule, by selector and media.
function rule(css: string, selector: string, media = "screen") {
  const at = css.indexOf(`@media ${media}{${selector}{`);
  assert.ok(at >= 0, `${media} ${selector}`);
  const body = css.slice(at + `@media ${media}{${selector}{`.length, css.indexOf("}", at + media.length + selector.length + 9));
  return Object.fromEntries(body.split(";").map((d) => [d.slice(0, d.indexOf(":")), d.slice(d.indexOf(":") + 1)]));
}

test("generated aliases carry the presets' colors per scheme; House and unset contribute no rule", () => {
  for (const id of APPEARANCE_ROOTS) {
    const root = ROOT_APPEARANCE[id];
    const css = appearanceStyle(id);
    for (const block of css.split("@media ").slice(1)) assert.match(block, /\[data-print-run|\[data-ink-lab/, `${id}: ${block}`);
    assert.doesNotMatch(css, /data-print-run="house"/);
    for (const runId of ["sumi", "riso", "indigo"] as const) {
      const preset = PRINT_RUNS[runId];
      const base = `html:root[data-print-run="${runId}"]`;
      const light = preset.colorScheme === "dark" || root.scheme === "dark" ? "dark" : "light";
      const decls = rule(css, base);
      for (const [key, names] of Object.entries(root.aliases)) {
        for (const name of names) assert.equal(decls[name], preset.colors![light][key as "ink"], `${id} ${runId} ${name}`);
      }
      assert.equal(decls["--ap-plate-1"], preset.colors![light].ink, "the anchor plate is the readable ink");
      if (root.scheme === "both" && preset.colorScheme !== "dark") {
        assert.equal(rule(css, `${base}[data-theme="dark"]`)[root.aliases.ink![0]], preset.colors!.dark.ink);
        assert.equal(rule(css, `${base}:not([data-theme="light"])`, "screen and (prefers-color-scheme:dark)")[root.aliases.paper![0]], preset.colors!.dark.paper);
      }
      if (preset.colorScheme === "dark") assert.equal(decls["color-scheme"], "dark", "Indigo is a night print everywhere");
    }
    const active = "html:root:is([data-print-run],[data-ink-lab])";
    if (root.texture) {
      assert.equal(rule(css, `${active}::before`).content, '""');
      assert.equal(rule(css, active)["background-color"], `var(${root.aliases.paper![0]})`);
    } else assert.ok(!css.includes("::before"), `${id} shows no texture`);
  }
  assert.equal(rule(appearanceStyle("articles"), "html:root:is([data-print-run],[data-ink-lab])")["--grain"], "none", "the Gazette's own grain gives way");
  assert.equal(rule(appearanceStyle("capsule"), "html:root:is([data-print-run],[data-ink-lab]) body")["background-image"], "none");
});

test("the texture stays within 0.06 total alpha, behind the page, pointer transparent and off in forced colors", () => {
  for (const id of PRINT_RUN_IDS) assert.ok(PRINT_RUNS[id].grain <= 0.06, id);
  assert.ok(LAB_RANGES.grain.max <= 0.06);
  const css = read("components/appearance.css");
  const layer = css.match(/html::before\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(layer, /position:\s*fixed/);
  assert.match(layer, /z-index:\s*-1/);
  assert.match(layer, /pointer-events:\s*none/);
  assert.match(layer, /opacity:\s*var\(--ap-grain, 0\)/, "the layer's opacity is the run's whole grain budget");
  assert.doesNotMatch(css, /animation|(?<!-)transition\s*:/, "static");
  assert.match(css, /@media \(forced-colors: active\), print \{\s*html::before \{\s*content: none !important;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*:root \{\s*--ap-transition: 0ms !important;/);
});

// --- Store ------------------------------------------------------------------------------------------------------

type Listener = (event: never) => void;
function fakeWindow(local: AppearanceStorage | "throw", session: AppearanceStorage | "throw") {
  const listeners = new Map<string, Set<Listener>>();
  const win = {
    listeners,
    get localStorage() {
      if (local === "throw") throw new Error("SecurityError");
      return local;
    },
    get sessionStorage() {
      if (session === "throw") throw new Error("SecurityError");
      return session;
    },
    addEventListener(type: string, listener: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
    fire(type: string, event: unknown) {
      for (const l of listeners.get(type) ?? []) (l as (e: unknown) => void)(event);
    },
  };
  return win satisfies AppearanceWindow;
}

test("same-tab changes notify subscribers once; reads and writes persist through the real keys", () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  const store = createBrowserAppearanceStore(fakeWindow(local, session));
  let calls = 0;
  const off = store.subscribe(() => calls++);
  assert.equal(store.setPrintRun("riso").persisted, true);
  assert.equal(local.getItem(PRINT_RUN_KEY), "riso");
  assert.equal(calls, 1);
  store.setPrintRun("riso");
  assert.equal(calls, 1, "no change, no notification");
  store.applyLab(labDefaults("indigo"));
  assert.equal(session.getItem(INK_LAB_KEY), encodeLab(labDefaults("indigo")));
  assert.equal(store.getSnapshot().printRun, "riso");
  store.resetHouse();
  assert.equal(local.getItem(PRINT_RUN_KEY), null);
  assert.equal(session.getItem(INK_LAB_KEY), null);
  assert.deepEqual(store.getSnapshot(), HOUSE_SNAPSHOT);
  assert.equal(calls, 3);
  off();
});

test("another tab's run (or reset) clears this tab's applied Lab; a Lab event or bfcache restore re-reads", () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage({ [INK_LAB_KEY]: encodeLab(labDefaults("riso")) });
  const win = fakeWindow(local, session);
  const store = createBrowserAppearanceStore(win);
  assert.equal(store.getSnapshot().lab?.printRun, "riso");
  let calls = 0;
  const off = store.subscribe(() => calls++);
  assert.equal(win.listeners.get("storage")?.size, 1, "listening while subscribed");
  local.setItem(PRINT_RUN_KEY, "sumi");
  win.fire("storage", { key: PRINT_RUN_KEY, storageArea: local, newValue: "sumi" });
  assert.deepEqual(store.getSnapshot(), { printRun: "sumi", lab: null });
  assert.equal(session.getItem(INK_LAB_KEY), null, "the stale Lab is gone from this tab's session");
  assert.equal(calls, 1);
  local.map.clear();
  win.fire("storage", { key: null, storageArea: local });
  assert.deepEqual(store.getSnapshot(), HOUSE_SNAPSHOT, "localStorage.clear() elsewhere is a reset");
  session.setItem(INK_LAB_KEY, encodeLab(labDefaults("indigo")));
  win.fire("pageshow", { persisted: false });
  assert.equal(store.getSnapshot().lab, null, "an ordinary pageshow does not re-read");
  win.fire("pageshow", { persisted: true });
  assert.equal(store.getSnapshot().lab?.printRun, "indigo", "a bfcache restore does");
  session.setItem(INK_LAB_KEY, "corrupt");
  win.fire("storage", { key: INK_LAB_KEY, storageArea: session });
  assert.equal(store.getSnapshot().lab, null, "a corrupt Lab is no override");
  win.fire("storage", { key: "theme", storageArea: local, newValue: "dark" });
  assert.equal(calls, 4, "other keys are ignored");
  off();
  assert.equal(win.listeners.get("storage")?.size, 0, "and stops listening with the last subscriber");
  assert.equal(win.listeners.get("pageshow")?.size, 0);
});

test("denied storage works for the page in memory and says it did not persist", () => {
  for (const [local, session] of [["throw", "throw"], [new DeniedStorage(), new DeniedStorage()]] as const) {
    const win = fakeWindow(local, session);
    const store = createBrowserAppearanceStore(win);
    assert.deepEqual(store.getSnapshot(), HOUSE_SNAPSHOT);
    const result = store.setPrintRun("indigo");
    assert.equal(result.persisted, false);
    assert.deepEqual([...result.failedKeys].sort(), [INK_LAB_KEY, PRINT_RUN_KEY].sort());
    assert.equal(store.getSnapshot().printRun, "indigo");
    const off = store.subscribe(() => {});
    win.fire("storage", { key: PRINT_RUN_KEY, storageArea: null });
    off();
    const reset = store.resetHouse();
    assert.equal(reset.persisted, false, "a blocked reset cannot claim removal");
  }
});

// --- SVG adapters -----------------------------------------------------------------------------------------------

test("filter scales: House and default Lab are identity; presets multiply; Lab values are multiples of the hand", () => {
  assert.deepEqual(filterScale(HOUSE_SNAPSHOT), IDENTITY_SCALE);
  assert.ok(isIdentityScale(filterScale({ printRun: "house", lab: labDefaults("house") })));
  for (const id of PRINT_RUN_IDS) {
    const s = filterScale({ printRun: id, lab: null });
    assert.equal(s.turbulence, PRINT_RUNS[id].turbulenceMultiplier);
    assert.equal(s.displacement, PRINT_RUNS[id].displacementMultiplier);
    assert.equal(s.wobble, 0);
  }
  for (const hand of HANDS) {
    const s = filterScale({ printRun: "house", lab: labDefaults("house", hand) });
    assert.equal(s.turbulence, 1, hand);
    assert.ok(Math.abs(s.displacement - 1) < 0.03, `${hand}: quantized to the slider's 0.1 step`);
  }
  const lab = normalizeLab({ version: 1, printRun: "house", settings: { turbulence: 0.07, displacement: 0, wobble: 2, hand: "ink" } });
  assert.deepEqual(filterScale({ printRun: "riso", lab }), { turbulence: 2, displacement: 0, wobble: 2 });
});

function fakeElement(attrs: Record<string, string | number>) {
  const map = new Map(Object.entries(attrs).map(([k, v]) => [k, String(v)]));
  return {
    map,
    getAttribute: (n: string) => (map.has(n) ? map.get(n)! : null),
    setAttribute: (n: string, v: string) => void map.set(n, v),
  };
}

test("tagged primitives rescale the warp only, keep seeds and amplitude, and restore their exact source text", () => {
  for (const hand of HANDS) {
    for (const [seed, wobble] of [[0, 3.5], [41, 8], [88, 0]]) {
      const primitives = inkFilter(hand, seed, wobble);
      const tagged = primitives.filter((p) => Object.keys(appearanceTags(p)).length);
      assert.equal(tagged.length, 2, `${hand}: the warp turbulence and its displacement`);
      for (const p of primitives) {
        if (p.tag === "feMerge") continue;
        const el = fakeElement({ ...p.attrs, ...appearanceTags(p) });
        const source = new Map(el.map);
        const k: FilterScale = { turbulence: 1.1, displacement: 1.15, wobble: 0 };
        writeFilter(el, k, 0);
        if (p.tag === "feTurbulence" && p.attrs.result === "warp") {
          assert.equal(el.getAttribute("baseFrequency"), String(Math.round(Number(p.attrs.baseFrequency) * 1.1 * 1e5) / 1e5));
          assert.equal(el.getAttribute("seed"), String(p.attrs.seed), "the source seed");
        } else if (p.tag === "feDisplacementMap" && p.attrs.in2 === "warp") {
          assert.equal(el.getAttribute("scale"), String(Math.round(Number(p.attrs.scale) * 1.15 * 100) / 100), "the interaction's amplitude, scaled");
        } else assert.deepEqual(el.map, source, `${p.tag} ${String(p.attrs.result)} untouched`);
        writeFilter(el, IDENTITY_SCALE, 0);
        assert.deepEqual(el.map, source, "House restores the exact source text");
      }
    }
  }
  assert.equal(MATERIALS.ink.warp.frequency, 0.035);
});

test("value lists, seeds and bad sources", () => {
  assert.equal(scaleValues("0.009 0.016", 1.1, 5), "0.0099 0.0176");
  assert.equal(scaleValues("0.009 0.016", 1, 5), "0.009 0.016");
  assert.equal(scaleValues("14", 0.8, 2), "11.2");
  assert.equal(scaleValues("14", 0, 2), "0");
  assert.equal(scaleValues("var(--x)", 2, 2), "var(--x)", "anything not numeric is left alone");
  assert.equal(scaleValues("", 2, 2), "");
  assert.equal(shiftSeed("7", 0), "7");
  assert.equal(shiftSeed("7", 3), "10");
  assert.equal(shiftSeed("7", 89 + 3), "10", "seeds stay on the ring's span");
  const el = fakeElement({ baseFrequency: "0.85", [FREQUENCY_TAG]: "0.85", [SEED_TAG]: "4", seed: "4", [SCALE_TAG]: "14", scale: "14" });
  writeFilter(el, { turbulence: 0.9, displacement: 0.9, wobble: 2 }, 5);
  assert.deepEqual([el.getAttribute("baseFrequency"), el.getAttribute("scale"), el.getAttribute("seed")], ["0.765", "12.6", "9"]);
});

test("each named SVG keeps its id, region and seed, is tagged with its rendered value, and never takes var()", () => {
  const sources: [string, RegExp][] = [
    ["app/(site)/(app)/play/loom/loom.tsx", /createElement\(p\.tag, \{ key: i, \.\.\.p\.attrs, \.\.\.appearanceTags\(p\) \}\)/],
    ["components/figures.tsx", /createElement\(p\.tag, \{ key: i, \.\.\.p\.attrs, \.\.\.appearanceTags\(p\) \}\)/],
    ["components/season-layer.tsx", /createElement\(p\.tag, \{ key: i, \.\.\.p\.attrs, \.\.\.appearanceTags\(p\) \}\)/],
    ["components/ink-press.tsx", /createElement\(p\.tag, \{ key: i, \.\.\.p\.attrs, \.\.\.appearanceTags\(p\) \}\)/],
    ["app/(site)/(app)/ledger/_components/stamp-calendar.tsx", /createElement\(p\.tag, \{ key: k, \.\.\.p\.attrs, \.\.\.appearanceTags\(p\) \}\)/],
    ["components/ink-radio.tsx", /<filter id=\{`\$\{id\}-hiss`\} x="0" y="0" width="100%" height="100%">\s*\{[^}]*\}\s*<feTurbulence type="fractalNoise" baseFrequency="0\.85" data-ap-frequency="0\.85" numOctaves=\{1\} seed=\{seedOf\(station\.id\) % 997\} \/>/],
    ["app/(site)/not-found.tsx", /<filter id="lost-crumple" x="-10%" y="-10%" width="120%" height="120%">[\s\S]*?baseFrequency="0\.03" data-ap-frequency="0\.03" numOctaves="2" seed="4"[\s\S]*?scale=\{CRUMPLE_SCALE\} data-ap-scale=\{CRUMPLE_SCALE\}/],
    ["app/(ryugu)/_components/sea.tsx", /<filter id="ryugu-caustic" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">[\s\S]*?baseFrequency="0\.009 0\.016" data-ap-frequency="0\.009 0\.016" numOctaves=\{2\} seed=\{7\}/],
  ];
  for (const [file, pattern] of sources) {
    const text = read(file);
    assert.match(text, pattern, file);
    assert.doesNotMatch(text, /(?:baseFrequency|scale|seed|stdDeviation)=\{?["'`]?var\(/, `${file}: no var() in an SVG number`);
    for (const [, value, tag] of text.matchAll(/baseFrequency="([^"]+)" data-ap-frequency="([^"]+)"/g)) assert.equal(tag, value, file);
  }
  // The isolated sea is tagged, not wired: it imports nothing for it.
  assert.doesNotMatch(read("app/(ryugu)/_components/sea.tsx"), /from "@\//);
});

// --- Filter runtime: one clock, only when needed --------------------------------------------------------------

test("the filter runtime keeps at most one clock, none under reduced motion or a hidden tab, and tears down", () => {
  const frames = new Map<number, (t: number) => void>();
  let nextFrame = 1;
  const media = { matches: false, listeners: new Set<() => void>(), addEventListener: (_: string, l: () => void) => void media.listeners.add(l), removeEventListener: (_: string, l: () => void) => void media.listeners.delete(l) };
  const docListeners = new Set<() => void>();
  const seedEl = fakeElement({ seed: "3", [SEED_TAG]: "3", baseFrequency: "0.035", [FREQUENCY_TAG]: "0.035" });
  const doc = {
    hidden: false,
    documentElement: {},
    querySelectorAll: () => [seedEl],
    querySelector: () => seedEl,
    addEventListener: (_: string, l: () => void) => void docListeners.add(l),
    removeEventListener: (_: string, l: () => void) => void docListeners.delete(l),
  };
  const win = {
    matchMedia: () => media,
    requestAnimationFrame: (cb: (t: number) => void) => (frames.set(nextFrame, cb), nextFrame++),
    cancelAnimationFrame: (id: number) => void frames.delete(id),
  };
  const observed: string[] = [];
  const g = globalThis as { MutationObserver?: unknown };
  const saved = g.MutationObserver;
  g.MutationObserver = class {
    observe() { observed.push("observe"); }
    disconnect() { observed.push("disconnect"); }
  };
  try {
    const runtime = createFilterRuntime(doc as unknown as Document, win as unknown as Window);
    runtime.update(IDENTITY_SCALE);
    assert.equal(seedEl.getAttribute("baseFrequency"), "0.035");
    assert.equal(frames.size, 0, "House: no clock");
    assert.deepEqual(observed, [], "and no observer");
    runtime.update({ turbulence: 1.1, displacement: 1, wobble: 0 });
    assert.equal(seedEl.getAttribute("baseFrequency"), "0.0385");
    assert.equal(frames.size, 0, "no wobble, no clock");
    runtime.update({ turbulence: 1.1, displacement: 1, wobble: 6 });
    runtime.update({ turbulence: 1.2, displacement: 1, wobble: 6 });
    assert.equal(frames.size, 1, "one clock, however often it updates");
    const run = (t: number) => { const [id, cb] = [...frames][0]; frames.delete(id); cb(t); };
    run(0);
    run(1000);
    assert.equal(seedEl.getAttribute("seed"), "9", "six seed changes in a second");
    doc.hidden = true;
    for (const l of docListeners) l();
    assert.equal(frames.size, 0, "a hidden tab stops it");
    assert.equal(seedEl.getAttribute("seed"), "3", "and the source seed is back");
    doc.hidden = false;
    for (const l of docListeners) l();
    assert.equal(frames.size, 1);
    media.matches = true;
    for (const l of media.listeners) l();
    assert.equal(frames.size, 0, "reduced motion stops it");
    media.matches = false;
    for (const l of media.listeners) l();
    runtime.update(IDENTITY_SCALE);
    assert.equal(frames.size, 0);
    assert.deepEqual([seedEl.getAttribute("baseFrequency"), seedEl.getAttribute("seed")], ["0.035", "3"], "House restores");
    assert.deepEqual(observed, ["observe", "disconnect"]);
    runtime.update({ turbulence: 1, displacement: 1, wobble: 3 });
    runtime.dispose();
    assert.equal(frames.size, 0, "teardown cancels the frame");
    assert.equal(docListeners.size, 0, "and removes its listeners");
    assert.equal(media.listeners.size, 0);
    assert.equal(observed.at(-1), "disconnect");
  } finally {
    g.MutationObserver = saved;
  }
});

test("ports stay pure: the module touches no browser global when imported", () => {
  const text = read("lib/appearance-client.ts");
  const topLevel = text.split("\n").filter((line) => /^(?:const|let|export const|export let)\b/.test(line));
  for (const line of topLevel) assert.doesNotMatch(line, /\b(?:window|document|localStorage|sessionStorage|matchMedia)\b/, line);
  const ports: AppearanceStoragePorts = { local: () => new MemoryStorage(), session: () => new MemoryStorage() };
  assert.deepEqual(createAppearanceStore(ports).getSnapshot(), HOUSE_SNAPSHOT);
});
