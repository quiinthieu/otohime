// Pocket's switch for Ryugu-jo's sea sound: a stored, off-by-default preference the console's chip flips, which an
// open palace in another tab hears through the storage event. The palace side (app/(ryugu)/_lib/ambience.test.ts)
// holds its key to this one.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { PALACE_SOUND_KEY, palaceSoundStore, parsePalaceSound, storePalaceSound } from "./palace-sound.ts";
import { SOUND_KEY } from "./sound.ts";

const ROOT = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
}

function target() {
  const handlers = new Set<(e: StorageEvent) => void>();
  return {
    handlers,
    addEventListener: (type: string, h: (e: StorageEvent) => void) => {
      assert.equal(type, "storage");
      handlers.add(h);
    },
    removeEventListener: (type: string, h: (e: StorageEvent) => void) => {
      assert.equal(type, "storage");
      handlers.delete(h);
    },
    fire: (key: string | null, newValue: string | null) => handlers.forEach((h) => h({ key, newValue } as StorageEvent)),
  };
}

const rig = (initial?: Record<string, string>) => {
  const storage = memory(initial);
  const win = target();
  const store = palaceSoundStore(() => storage, () => win as unknown as Window);
  return { storage, win, store };
};

test("its own key, apart from the site's beeps, on only for the exact word on", () => {
  assert.equal(PALACE_SOUND_KEY, "ryugu-sound");
  assert.notEqual(PALACE_SOUND_KEY, SOUND_KEY);
  assert.equal(parsePalaceSound("on"), true);
  for (const v of [null, undefined, "off", "ON", "yes"]) assert.equal(parsePalaceSound(v), false, String(v));
  assert.deepEqual([storePalaceSound(true), storePalaceSound(false)], ["on", "off"]);
});

test("off by default, and off on the server and the first render whatever is stored", () => {
  const fresh = rig();
  fresh.store.subscribe(() => {});
  assert.equal(fresh.store.get(), false);
  const on = rig({ [PALACE_SOUND_KEY]: "on" });
  assert.equal(on.store.getServer(), false);
  on.store.subscribe(() => {});
  assert.equal(on.store.get(), true, "a stored on is read once subscribed");
  // the site's beeps being on does not switch the sea on
  const beeps = rig({ [SOUND_KEY]: "on" });
  beeps.store.subscribe(() => {});
  assert.equal(beeps.store.get(), false);
});

test("the chip's press persists the choice and tells every subscriber", () => {
  const { storage, store } = rig();
  let heard = 0;
  store.subscribe(() => heard++);
  store.set(true);
  assert.equal(storage.data.get(PALACE_SOUND_KEY), "on");
  assert.equal(store.get(), true);
  store.set(false);
  assert.equal(storage.data.get(PALACE_SOUND_KEY), "off", "off is written, so an open palace hears it");
  assert.equal(store.get(), false);
  assert.equal(heard, 2);
});

test("another tab's change is followed; unrelated keys are not", () => {
  const { win, store } = rig();
  let heard = 0;
  const unsubscribe = store.subscribe(() => heard++);
  assert.equal(win.handlers.size, 1);
  win.fire(SOUND_KEY, "on");
  assert.equal(store.get(), false);
  assert.equal(heard, 0);
  win.fire(PALACE_SOUND_KEY, "on");
  assert.equal(store.get(), true);
  win.fire(null, null); // storage cleared
  assert.equal(store.get(), false);
  assert.equal(heard, 2);
  unsubscribe();
  assert.equal(win.handlers.size, 0, "the last subscriber lets the window go");
});

test("blocked storage: off, and a press still holds for this visit without throwing", () => {
  const blocked = palaceSoundStore(
    () => {
      throw new Error("SecurityError");
    },
    () => target() as unknown as Window,
  );
  blocked.subscribe(() => {});
  assert.equal(blocked.get(), false);
  assert.doesNotThrow(() => blocked.set(true));
  assert.equal(blocked.get(), true);
});

test("Pocket's chip flips the sea sound beside Dive, and makes no sound of its own", () => {
  const src = read("components/handheld.tsx");
  assert.match(src, /^import \{ getPalaceSound, getServerPalaceSound, setPalaceSound, subscribePalaceSound \} from "@\/lib\/palace-sound";$/m);
  assert.match(src, /const seaSound = useSyncExternalStore\(subscribePalaceSound, getPalaceSound, getServerPalaceSound\);/);
  assert.match(
    src,
    /\{P\.dive\}\s*<\/a>\s*\{\/\*[^*]*\*\/\}\s*<Chip aria-pressed=\{seaSound\} aria-label=\{P\.seaSoundLabel\} data-pocket-sea-sound="" onClick=\{\(\) => setPalaceSound\(!seaSound\)\}>\s*\{P\.seaSound\}\s*<\/Chip>/,
  );
  assert.doesNotMatch(src, /AudioContext|ryugu-sound/, "the key and the audio live elsewhere");
  const site = read("content/site.ts");
  assert.match(site, /seaSound: "♪ Sea sound",/);
  assert.match(site, /seaSoundLabel: "Sea sound in Ryugu-jo",/);
  assert.doesNotMatch(read("lib/palace-sound.ts").replace(/^\s*\/\/.*$/gm, ""), /AudioContext|createGain|\.resume\(/);
});
