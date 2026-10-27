import assert from "node:assert/strict";
import { test } from "node:test";
import { GHOSTS_KEY, ghostsPreferenceStore, parseGhostsHidden, storeGhostsHidden } from "./pref.ts";

function harness(initial: string | null = null) {
  let value = initial, denied = false, readsDenied = false, writesDenied = false;
  const events = new EventTarget();
  let attached = 0;
  const storage = {
    getItem(key: string) { assert.equal(key, "ghosts"); if (readsDenied) throw Error("blocked"); return value; },
    setItem(key: string, next: string) { assert.equal(key, "ghosts"); if (writesDenied) throw Error("quota"); value = next; },
    removeItem(key: string) { assert.equal(key, "ghosts"); if (writesDenied) throw Error("quota"); value = null; },
  };
  const target = {
    addEventListener(type: string, listener: EventListener) { attached++; events.addEventListener(type, listener); },
    removeEventListener(type: string, listener: EventListener) { attached--; events.removeEventListener(type, listener); },
  };
  const make = () => ghostsPreferenceStore(() => { if (denied) throw Error("denied getter"); return storage; }, () => target);
  const store = make();
  return {
    store, make, storage,
    get value() { return value; }, get attached() { return attached; },
    deny() { denied = true; }, denyReads() { readsDenied = true; }, denyWrites() { writesDenied = true; },
    external(next: string | null, key: string | null = GHOSTS_KEY, area: unknown = storage) {
      if (area === storage && (key === GHOSTS_KEY || key === null)) value = next;
      events.dispatchEvent(Object.assign(new Event("storage"), { key, newValue: next, storageArea: area }));
    },
  };
}

test("ghost preference parses only hidden and keeps the server snapshot suppressed", () => {
  for (const value of [null, undefined, "", "true", "false", "Hidden", '"hidden"', "visible", "garbage"]) {
    assert.equal(parseGhostsHidden(value), false);
  }
  assert.equal(parseGhostsHidden("hidden"), true);
  assert.equal(storeGhostsHidden(true), "hidden"); assert.equal(storeGhostsHidden(false), null);
  const h = harness();
  assert.equal(h.store.getServer(), true); assert.equal(h.store.get(), false);
  assert.equal(h.store.getServer(), true);
  assert.equal(harness("hidden").store.get(), true);
});

test("same-tab preference subscribers run synchronously, persist reloads and share one removable listener", () => {
  const h = harness(); const seen: boolean[] = [];
  const a = h.store.subscribe(() => seen.push(h.store.get()));
  const b = h.store.subscribe(() => seen.push(h.store.get()));
  assert.equal(h.attached, 1);
  h.store.set(true); assert.deepEqual(seen, [true, true]);
  assert.equal(h.value, "hidden"); assert.equal(h.make().get(), true);
  h.store.set(false); assert.equal(h.value, null); assert.equal(h.make().get(), false);
  a(); assert.equal(h.attached, 1); b(); assert.equal(h.attached, 0);
});

test("cross-tab preference changes and clear synchronize; unrelated keys and session storage are ignored", () => {
  const h = harness(); let calls = 0;
  const unsubscribe = h.store.subscribe(() => calls++);
  h.external("hidden"); assert.equal(h.store.get(), true); assert.equal(calls, 1);
  h.external(null, "ryugu-sound"); assert.equal(h.store.get(), true); assert.equal(calls, 1);
  h.external(null, "ghosts", {}); assert.equal(h.store.get(), true); assert.equal(calls, 1);
  h.external("corrupt"); assert.equal(h.store.get(), false);
  h.external("hidden"); h.external(null, null); assert.equal(h.store.get(), false);
  unsubscribe(); h.external("hidden");
  const again = h.store.subscribe(() => calls++);
  assert.equal(h.store.get(), true, "resubscribe catches changes missed with no listeners");
  again(); assert.equal(h.attached, 0);
});

test("blocked getters, absent storage and failed writes keep a usable in-memory choice", () => {
  for (const mode of ["getter", "reads", "writes", "absent"]) {
    const h = harness();
    if (mode === "getter") h.deny();
    if (mode === "reads") h.denyReads();
    if (mode === "writes") h.denyWrites();
    const store = mode === "absent" ? ghostsPreferenceStore(() => null, () => new EventTarget()) : h.store;
    assert.equal(store.get(), false);
    const off = store.subscribe(() => {});
    store.set(true); assert.equal(store.get(), true); off();
    const again = store.subscribe(() => {});
    assert.equal(store.get(), true, "resubscribe must not overwrite memory with stale storage");
    store.set(false); assert.equal(store.get(), false); again();
  }
});
