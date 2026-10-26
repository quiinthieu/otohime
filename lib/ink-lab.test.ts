import assert from "node:assert/strict";
import { test } from "node:test";
import { HANDS, MATERIALS } from "./ink-modes.ts";
import { PRINT_RUN_IDS, HOUSE_COLORS } from "./print-runs.ts";
import {
  LAB_RANGES, MAX_LAB_QUERY_LENGTH, PRINT_RUN_KEY, INK_LAB_KEY,
  labDefaults, normalizeLab, encodeLab, decodeLab, readStoredLab,
  createAppearanceStore, resolveAppearance,
  type AppearanceStorage, type AppearanceStoragePorts, type AppearanceStore,
} from "./ink-lab.ts";

test("versioned canonical queries round-trip every preset and hand", () => {
  for (const run of PRINT_RUN_IDS) for (const hand of HANDS) {
    const snapshot = normalizeLab({ ...labDefaults(run), settings: { ...labDefaults(run).settings, hand, turbulence: 0.057, displacement: 4.3, plates: ["#ABCDEF", "#123456", "#fedcba"], halftone: true } });
    const encoded = encodeLab(snapshot);
    assert.match(encoded, /^v=1&r=/);
    assert.deepEqual(decodeLab(encoded).snapshot, snapshot);
    assert.equal(encodeLab(decodeLab(`?${encoded}`).snapshot), encoded);
    assert.equal(encoded.includes("ABCDEF"), false);
    assert.deepEqual([...new URLSearchParams(encoded).keys()], ["v", "r", "t", "d", "w", "g", "p", "n", "m", "h", "o"]);
  }
});

test("preset and hand defaults derive from existing materials and bounded multipliers", () => {
  assert.equal(labDefaults("sumi").settings.turbulence, 0.03);
  assert.equal(labDefaults("sumi").settings.displacement, 2.8);
  assert.equal(labDefaults("riso").settings.turbulence, 0.039);
  assert.equal(labDefaults("riso").settings.displacement, 4);
  for (const hand of HANDS) {
    const decoded = decodeLab(`v=1&h=${hand}`).snapshot.settings;
    assert.equal(decoded.hand, hand);
    assert.equal(decoded.turbulence, MATERIALS[hand].warp.frequency);
    assert.equal(decoded.displacement, Math.round(3.5 * MATERIALS[hand].warp.scale * 10) / 10);
  }
});

const numericKeys = { turbulence: "t", displacement: "d", wobble: "w", grain: "g", transitionMs: "m" } as const;
for (const field of Object.keys(numericKeys) as (keyof typeof numericKeys)[]) {
  test(`${field}: clamps both boundaries, quantizes, rejects non-finite and malformed values`, () => {
    const { min, max, step } = LAB_RANGES[field];
    const key = numericKeys[field];
    for (const [raw, expected] of [[min - 100, min], [min, min], [max, max], [max + 100, max], [min + step * 0.49, min], [min + step * 0.51, Number((min + step).toFixed(3))]]) {
      assert.equal(decodeLab(`v=1&${key}=${raw}`).snapshot.settings[field], expected);
    }
    for (const raw of ["NaN", "Infinity", "-Infinity", "1e999", "", " ", "0x12", "12px", "<script>alert(1)</script>"]) {
      assert.equal(decodeLab(`v=1&${key}=${encodeURIComponent(raw)}`).snapshot.settings[field], labDefaults().settings[field], raw);
    }
    assert.equal(normalizeLab({ settings: { [field]: NaN } }).settings[field], labDefaults().settings[field]);
    assert.equal(normalizeLab({ settings: { [field]: Infinity } }).settings[field], labDefaults().settings[field]);
  });
}

test("first duplicate wins and unknown parameters never become settings", () => {
  const query = "v=1&v=99&r=riso&r=indigo&d=bad&d=12&g=0.02&g=0&unknown=evil&__proto__=x&constructor=x";
  const decoded = decodeLab(query).snapshot;
  assert.equal(decoded.printRun, "riso");
  assert.equal(decoded.settings.displacement, labDefaults("riso").settings.displacement);
  assert.equal(decoded.settings.grain, 0.02);
  assert.equal(encodeLab(decoded).includes("unknown"), false);
  assert.equal(decodeLab("v=2&v=1&r=riso").reason, "unsupported_version");
});

test("invalid hex, hand, plate count, boolean and ids use field defaults", () => {
  for (const p of ["fff,000,fff", "#123456,123456,123456", "123456,abcdef", "123456,abcdef,123456,000000", "zzzzzz,abcdef,123456", "url(javascript:alert(1))", "</style><script>alert(1)</script>"]) {
    const snapshot = decodeLab(`v=1&r=riso&p=${encodeURIComponent(p)}&h=__proto__&n=2.5&o=true`).snapshot;
    assert.deepEqual(snapshot.settings.plates, labDefaults("riso").settings.plates);
    assert.equal(snapshot.settings.hand, "ink");
    assert.equal(snapshot.settings.plateCount, 3);
    assert.equal(snapshot.settings.halftone, false);
  }
  assert.equal(decodeLab("v=1&r=constructor").snapshot.printRun, "house");
  assert.equal(decodeLab("v=1&n=2&o=1").snapshot.settings.plateCount, 2);
  assert.equal(decodeLab("v=1&n=2&o=1").snapshot.settings.halftone, true);
});

test("unsupported version, oversized or malformed input returns a safe explained house preview", () => {
  assert.equal(MAX_LAB_QUERY_LENGTH, 2048);
  for (const input of [null, {}, 42, "v=2&r=riso", "v=NaN&r=riso", "v=1.0&r=riso", "v=1&r=riso&x=" + "a".repeat(2048)]) {
    const result = decodeLab(input);
    assert.deepEqual(result.snapshot, labDefaults());
    assert.ok(result.reason);
    assert.ok(result.message.length > 0);
  }
  assert.equal(decodeLab("v=1&x=" + "a".repeat(2042)).reason, null);
  assert.equal(decodeLab("v=1&x=" + "a".repeat(2043)).reason, "too_long");
  assert.deepEqual(decodeLab("v=1&p=%E0%A4%A&t=%ZZ&r=%00<script>").snapshot, labDefaults());
  assert.equal(decodeLab("").reason, null);
  assert.equal(decodeLab("r=riso").snapshot.printRun, "riso");
});

test("stored Lab requires a complete versioned canonical snapshot; corruption means no override", () => {
  const snapshot = labDefaults("riso");
  assert.deepEqual(readStoredLab(encodeLab(snapshot)), snapshot);
  for (const stored of [null, "", "v=1&r=riso", "v=1&d=NaN", "<script>", "{}", "v=999", "a".repeat(2049), encodeLab(snapshot).replace("d=4", "d=oops")]) {
    assert.equal(readStoredLab(stored), null, String(stored));
  }
});

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const blocked = new Set<string>();
  const storage: AppearanceStorage = {
    getItem(key) { if (blocked.has("read")) throw Error("blocked"); return data.get(key) ?? null; },
    setItem(key, value) { if (blocked.has("write")) throw Error("quota"); data.set(key, value); },
    removeItem(key) { if (blocked.has("remove")) throw Error("blocked"); data.delete(key); },
  };
  return { data, blocked, storage };
}
function fixture() {
  const local = fakeStorage({ theme: "dark", season: "winter", drawing: "keep" });
  const session = fakeStorage({ audio: "keep" });
  const ports: AppearanceStoragePorts = { local: () => local.storage, session: () => session.storage };
  const store: AppearanceStore = createAppearanceStore(ports);
  return { local, session, ports, store };
}

test("store subscribers observe stable immutable snapshots; preset clears Lab, reset preserves other data", () => {
  const { local, session, store, ports } = fixture();
  assert.equal(PRINT_RUN_KEY, "otohime:print-run:v1");
  assert.equal(INK_LAB_KEY, "otohime:ink-lab:v1");
  assert.equal(store.getSnapshot(), store.getSnapshot());
  let calls = 0;
  const unsubscribe = store.subscribe(() => { calls++; assert.equal(Object.isFrozen(store.getSnapshot()), true); });
  assert.equal(store.setPrintRun("sumi").persisted, true);
  assert.equal(store.applyLab(labDefaults("riso")).persisted, true);
  assert.equal(store.getSnapshot().printRun, "sumi");
  assert.equal(store.getSnapshot().lab?.printRun, "riso");
  assert.deepEqual(createAppearanceStore(ports).getSnapshot(), store.getSnapshot());
  assert.equal(store.setPrintRun("indigo").persisted, true);
  assert.equal(store.getSnapshot().lab, null);
  assert.equal(session.data.has(INK_LAB_KEY), false);
  assert.equal(calls, 3);
  unsubscribe();
  store.resetHouse();
  assert.equal(calls, 3);
  assert.deepEqual(store.getSnapshot(), { printRun: "house", lab: null });
  assert.deepEqual(Object.fromEntries(local.data), { theme: "dark", season: "winter", drawing: "keep" });
  assert.deepEqual(Object.fromEntries(session.data), { audio: "keep" });
  assert.throws(() => store.setPrintRun("<script>" as "house"), TypeError);
});

test("denied storage getters, reads, writes and removals retain in-memory behavior and truthful failure keys", () => {
  const denied = () => { throw Error("getter denied"); };
  const store = createAppearanceStore({ local: denied, session: denied });
  assert.deepEqual(store.getSnapshot(), { printRun: "house", lab: null });
  assert.deepEqual(store.setPrintRun("riso").failedKeys, [PRINT_RUN_KEY, INK_LAB_KEY]);
  assert.equal(store.getSnapshot().printRun, "riso");
  assert.equal(store.applyLab(labDefaults("indigo")).persisted, false);
  assert.deepEqual(store.resetHouse().failedKeys, [PRINT_RUN_KEY, INK_LAB_KEY]);
  assert.deepEqual(store.getSnapshot(), { printRun: "house", lab: null });
  const f = fixture();
  f.local.blocked.add("read"); f.session.blocked.add("read");
  assert.deepEqual(createAppearanceStore(f.ports).getSnapshot(), { printRun: "house", lab: null });
  f.local.blocked.clear(); f.session.blocked.clear();
  f.store.setPrintRun("riso"); f.store.applyLab(labDefaults());
  f.local.blocked.add("write"); f.session.blocked.add("remove");
  const result = f.store.setPrintRun("sumi");
  assert.equal(result.persisted, false);
  assert.deepEqual(result.failedKeys, [PRINT_RUN_KEY, INK_LAB_KEY]);
  assert.deepEqual(f.store.getSnapshot(), { printRun: "sumi", lab: null });
  f.local.blocked.add("remove");
  assert.equal(f.store.resetHouse().persisted, false);
});

test("corrupt storage is ignored and a fresh session does not inherit Lab", () => {
  const local = fakeStorage({ [PRINT_RUN_KEY]: "constructor" });
  const session = fakeStorage({ [INK_LAB_KEY]: "v=1&p=<script>" });
  assert.deepEqual(createAppearanceStore({ local: () => local.storage, session: () => session.storage }).getSnapshot(), { printRun: "house", lab: null });
  const f = fixture(); f.store.setPrintRun("sumi"); f.store.applyLab(labDefaults("indigo"));
  assert.deepEqual(createAppearanceStore({ ...f.ports, session: () => fakeStorage().storage }).getSnapshot(), { printRun: "sumi", lab: null });
});

test("Lab is independent until Apply, overrides the preset, and editable ghosts never alter readable body ink", () => {
  const { store } = fixture();
  store.setPrintRun("sumi");
  const preview = normalizeLab({ ...labDefaults("indigo"), settings: { ...labDefaults("indigo").settings, plates: ["#ffffff", "#ffffff", "#ffffff"] } });
  const context = { theme: "light" as const, season: "summer" as const, house: HOUSE_COLORS.light };
  assert.equal(resolveAppearance(store.getSnapshot(), context).preset.id, "sumi");
  store.applyLab(preview);
  const resolved = resolveAppearance(store.getSnapshot(), context);
  assert.equal(resolved.preset.id, "indigo");
  assert.equal(resolved.colorScheme, "dark");
  assert.equal(resolved.colors.ink, "#f2edff");
  assert.deepEqual(resolved.settings.plates, ["#ffffff", "#ffffff", "#ffffff"]);
  assert.equal(Object.isFrozen(resolved.settings.plates), true);
  assert.throws(() => { Object.assign(resolved.settings.plates, { 0: "#000000" }); }, TypeError);
  store.resetHouse();
  assert.equal(resolveAppearance(store.getSnapshot(), context).colorScheme, "light");
  assert.equal(resolveAppearance(store.getSnapshot(), context).overrides, null);
});

test("unapplied presets resolve scheme-aware plates with the current readable anchor", () => {
  for (const printRun of PRINT_RUN_IDS) {
    const context = { theme: "dark" as const, season: "winter" as const, house: { ...HOUSE_COLORS.dark, ink: "#e3e8ee" as const } };
    const result = resolveAppearance({ printRun, lab: null }, context);
    assert.equal(result.settings.plates[0], result.colors.ink);
    assert.deepEqual(result.settings.plates, result.plates);
  }
});
