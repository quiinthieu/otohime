import { isHand, MATERIALS, type Hand } from "./ink-modes.ts";
import {
  isPrintRunId, PRINT_RUNS, resolvePrintRun,
  type AppearanceContext, type PlateColors, type PrintRunId, type ResolvedPrintRun,
} from "./print-runs.ts";

export interface InkLabSettings {
  readonly turbulence: number;
  readonly displacement: number;
  readonly wobble: number;
  readonly grain: number;
  readonly plates: PlateColors;
  readonly plateCount: 2 | 3;
  readonly transitionMs: number;
  readonly hand: Hand;
  readonly halftone: boolean;
}

export interface LabSnapshot {
  readonly version: 1;
  readonly printRun: PrintRunId;
  readonly settings: InkLabSettings;
}

export interface AppearanceSnapshot {
  readonly printRun: PrintRunId;
  readonly lab: LabSnapshot | null;
}

export interface AppearanceWriteResult {
  readonly snapshot: AppearanceSnapshot;
  readonly persisted: boolean;
  readonly failedKeys: readonly string[];
}

export interface AppearanceStore {
  getSnapshot(): AppearanceSnapshot;
  subscribe(listener: () => void): () => void;
  setPrintRun(id: PrintRunId): AppearanceWriteResult;
  applyLab(snapshot: LabSnapshot): AppearanceWriteResult;
  resetHouse(): AppearanceWriteResult;
}

// Factories guard access to the storage object itself as well as its methods.
export interface AppearanceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AppearanceStoragePorts {
  readonly local: () => AppearanceStorage;
  readonly session: () => AppearanceStorage;
}

export interface LabDecodeResult {
  readonly snapshot: LabSnapshot;
  readonly reason: "invalid_input" | "too_long" | "unsupported_version" | null;
  readonly message: string;
}

export interface ResolvedAppearance extends ResolvedPrintRun {
  readonly settings: InkLabSettings;
  readonly source: "preset" | "lab";
}

export const PRINT_RUN_KEY = "otohime:print-run:v1";
export const INK_LAB_KEY = "otohime:ink-lab:v1";
export const MAX_LAB_QUERY_LENGTH = 2048;
export const LAB_VERSION = 1;
export const LAB_RANGES = Object.freeze({
  turbulence: Object.freeze({ min: 0.005, max: 0.12, step: 0.001 }),
  displacement: Object.freeze({ min: 0, max: 12, step: 0.1 }),
  wobble: Object.freeze({ min: 0, max: 6, step: 0.1 }),
  grain: Object.freeze({ min: 0, max: 0.06, step: 0.005 }),
  transitionMs: Object.freeze({ min: 0, max: 1200, step: 10 }),
});

type NumericField = keyof typeof LAB_RANGES;
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const HEX = /^#[0-9a-f]{6}$/i;
const QUERY_PLATES = /^[0-9a-f]{6},[0-9a-f]{6},[0-9a-f]{6}$/i;

function numeric(value: unknown, field: NumericField, fallback: number): number {
  const number = typeof value === "number" ? value : typeof value === "string" && NUMBER.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(number)) return fallback;
  const { min, max, step } = LAB_RANGES[field];
  const bounded = Math.max(min, Math.min(max, number));
  return Number((Math.round((bounded + Number.EPSILON) / step) * step).toFixed(3));
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function labDefaults(printRun: PrintRunId = "house", hand: Hand = "ink"): LabSnapshot {
  const id = isPrintRunId(printRun) ? printRun : "house";
  const style = isHand(hand) ? hand : "ink";
  const preset = PRINT_RUNS[id];
  const material = MATERIALS[style];
  return Object.freeze({
    version: LAB_VERSION, printRun: id,
    settings: Object.freeze({
      turbulence: numeric(material.warp.frequency * preset.turbulenceMultiplier, "turbulence", 0.035),
      displacement: numeric(3.5 * material.warp.scale * preset.displacementMultiplier, "displacement", 3.5),
      wobble: 0, grain: preset.grain, plates: preset.plates.light,
      plateCount: preset.plateCount, transitionMs: 420, hand: style, halftone: preset.halftone,
    }),
  });
}

// The same bounded normalizer handles controls, URLs and explicit Apply. Never
// spread untrusted fields into an output consumed by CSS/SVG adapters.
export function normalizeLab(value: unknown): LabSnapshot {
  const input = record(value);
  if (input.version !== undefined && input.version !== LAB_VERSION) return labDefaults();
  const printRun = isPrintRunId(input.printRun) ? input.printRun : "house";
  const settings = record(input.settings);
  const hand = isHand(settings.hand) ? settings.hand : "ink";
  const defaults = labDefaults(printRun, hand).settings;
  const rawPlates = settings.plates;
  const plates = Array.isArray(rawPlates) && rawPlates.length === 3 && rawPlates.every(p => typeof p === "string" && HEX.test(p))
    ? Object.freeze(rawPlates.map(p => p.toLowerCase())) as PlateColors : defaults.plates;
  return Object.freeze({
    version: LAB_VERSION, printRun,
    settings: Object.freeze({
      turbulence: numeric(settings.turbulence, "turbulence", defaults.turbulence),
      displacement: numeric(settings.displacement, "displacement", defaults.displacement),
      wobble: numeric(settings.wobble, "wobble", defaults.wobble),
      grain: numeric(settings.grain, "grain", defaults.grain),
      plates, plateCount: settings.plateCount === 2 || settings.plateCount === 3 ? settings.plateCount : defaults.plateCount,
      transitionMs: numeric(settings.transitionMs, "transitionMs", defaults.transitionMs),
      hand, halftone: typeof settings.halftone === "boolean" ? settings.halftone : defaults.halftone,
    }),
  });
}

// No leading '?' or pathname. Always all fields, in this order, with lowercase
// hex and shortest decimal numbers. Thus sharing is independent of defaults.
export function encodeLab(value: LabSnapshot): string {
  const { printRun, settings: s } = normalizeLab(value);
  return new URLSearchParams([
    ["v", "1"], ["r", printRun], ["t", String(s.turbulence)], ["d", String(s.displacement)],
    ["w", String(s.wobble)], ["g", String(s.grain)], ["p", s.plates.map(p => p.slice(1)).join(",")],
    ["n", String(s.plateCount)], ["m", String(s.transitionMs)], ["h", s.hand], ["o", s.halftone ? "1" : "0"],
  ]).toString();
}

export function decodeLab(query: unknown): LabDecodeResult {
  const fallback = (reason: Exclude<LabDecodeResult["reason"], null>, message: string): LabDecodeResult =>
    Object.freeze({ snapshot: labDefaults(), reason, message });
  if (typeof query !== "string") return fallback("invalid_input", "This Lab link could not be read. Showing House style.");
  const raw = query.startsWith("?") ? query.slice(1) : query;
  if (raw.length > MAX_LAB_QUERY_LENGTH) return fallback("too_long", "This Lab link is too long. Showing House style.");
  const params = new URLSearchParams(raw);
  const version = params.get("v");
  if (version !== null && version !== "1") return fallback("unsupported_version", "This Lab link uses an unsupported version. Showing House style.");
  // URLSearchParams.get deliberately returns the FIRST duplicate occurrence.
  const p = params.get("p");
  const snapshot = normalizeLab({
    version: LAB_VERSION, printRun: params.get("r"), settings: {
      turbulence: params.get("t"), displacement: params.get("d"), wobble: params.get("w"), grain: params.get("g"),
      plates: p && QUERY_PLATES.test(p) ? p.split(",").map(hex => `#${hex}`) : undefined,
      plateCount: params.get("n") === "2" ? 2 : params.get("n") === "3" ? 3 : undefined,
      transitionMs: params.get("m"), hand: params.get("h"),
      halftone: params.get("o") === "1" ? true : params.get("o") === "0" ? false : undefined,
    },
  });
  return Object.freeze({ snapshot, reason: null, message: "" });
}

// A persisted override must be complete and already sanitized. Partial, corrupt
// or older values cannot silently mask a valid preset with a House override.
export function readStoredLab(value: unknown): LabSnapshot | null {
  if (typeof value !== "string" || !value || value.length > MAX_LAB_QUERY_LENGTH) return null;
  const result = decodeLab(value);
  return result.reason === null && encodeLab(result.snapshot) === value ? result.snapshot : null;
}

export function resolveAppearance(snapshot: AppearanceSnapshot, context: AppearanceContext): ResolvedAppearance {
  const lab = snapshot.lab ? normalizeLab(snapshot.lab) : null;
  const resolved = resolvePrintRun(lab?.printRun ?? snapshot.printRun, context);
  const settings = lab?.settings ?? Object.freeze({ ...labDefaults(resolved.preset.id).settings, plates: resolved.plates });
  return Object.freeze({ ...resolved, settings, source: lab ? "lab" : "preset" });
}

export function createAppearanceStore(ports: AppearanceStoragePorts): AppearanceStore {
  const read = (get: () => AppearanceStorage, key: string) => {
    try { return get().getItem(key); } catch { return null; }
  };
  const storedRun = read(ports.local, PRINT_RUN_KEY);
  let snapshot: AppearanceSnapshot = Object.freeze({
    printRun: isPrintRunId(storedRun) ? storedRun : "house", lab: readStoredLab(read(ports.session, INK_LAB_KEY)),
  });
  const listeners = new Set<() => void>();
  const update = (next: AppearanceSnapshot, operations: readonly [() => AppearanceStorage, string, string | null][]): AppearanceWriteResult => {
    const failedKeys: string[] = [];
    for (const [get, key, value] of operations) {
      try {
        const storage = get();
        if (value === null) storage.removeItem(key); else storage.setItem(key, value);
      } catch { failedKeys.push(key); }
    }
    const changed = JSON.stringify(next) !== JSON.stringify(snapshot);
    if (changed) snapshot = Object.freeze(next);
    if (changed) for (const listener of listeners) listener();
    return Object.freeze({ snapshot, persisted: failedKeys.length === 0, failedKeys: Object.freeze(failedKeys) });
  };
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setPrintRun(id: PrintRunId) {
      if (!isPrintRunId(id)) throw new TypeError("Invalid print run");
      return update({ printRun: id, lab: null }, [[ports.local, PRINT_RUN_KEY, id], [ports.session, INK_LAB_KEY, null]]);
    },
    applyLab(value: LabSnapshot) {
      const lab = normalizeLab(value);
      return update({ printRun: snapshot.printRun, lab }, [[ports.session, INK_LAB_KEY, encodeLab(lab)]]);
    },
    resetHouse() {
      return update({ printRun: "house", lab: null }, [[ports.local, PRINT_RUN_KEY, null], [ports.session, INK_LAB_KEY, null]]);
    },
  });
}
