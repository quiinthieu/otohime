// Browser-free policy. Elapsed time and local calendar time deliberately have separate clocks.
export const KAME_KEY = "kame:v1";
export const IDLE_MS = 45_000;
export const PET_MS = 500;
export type KameState = "swim" | "nap" | "follow" | "fetch" | "pet" | "shell";
export type KameMemory = { name: string; lastVisit: string; streak: number; dismissed: boolean };
export type Point = { x: number; y: number };
export type FetchCommand = { type: "fetch"; target: Point; id?: string } | { type: "cancel" };
export type KameStorage = { getItem(key: string): string | null; setItem(key: string, value: string): unknown };
export const trimName = (value: unknown) => typeof value === "string" ? [...value.trim()].slice(0, 24).join("").trim() || "Kame" : "Kame";
export const localDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const moodAt = (hour: number) => hour < 6 ? "sleepy" : hour < 12 ? "bright" : hour < 19 ? "calm" : "drowsy";

function dayNumber(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? parsed.getTime() / 86_400_000 : null;
}

export function createKame({ now, calendar, storage }: { now: () => number; calendar: () => Date; storage?: KameStorage }) {
  const today = localDay(calendar());
  let record: Partial<KameMemory> = {};
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(KAME_KEY) ?? "null");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) record = parsed;
  } catch { /* memory-only when storage is blocked */ }
  const previous = dayNumber(record.lastVisit);
  const gap = previous === null ? Infinity : dayNumber(today)! - previous;
  const valid = Number.isSafeInteger(record.streak) && record.streak! > 0 && record.streak! < 100_000;
  const memory: KameMemory = { name: trimName(record.name), lastVisit: today,
    streak: valid && gap === 0 ? record.streak! : valid && gap === 1 ? record.streak! + 1 : 1,
    dismissed: record.dismissed === true };
  const save = () => { try { storage?.setItem(KAME_KEY, JSON.stringify(memory)); } catch { /* keep session usable */ } };
  save();
  let mode: KameState = "swim";
  let last = now();
  let reduced = false;
  let paused = false;
  let target: Point | null = null;
  const wake = () => { last = now(); mode = "swim"; target = null; };
  const state = (): KameState => memory.dismissed ? "shell" : reduced || paused ? "nap" : mode;
  return {
    state,
    memory: (): Readonly<KameMemory> => ({ ...memory }),
    mood: () => moodAt(calendar().getHours()),
    friendly: () => memory.streak >= 3,
    target: () => target,
    idleIn: () => Math.max(0, IDLE_MS - (now() - last)),
    tick: () => { if (mode !== "pet" && mode !== "fetch" && now() - last >= IDLE_MS) mode = "nap"; },
    activity: () => { if (mode === "nap") mode = "swim"; last = now(); },
    call: () => { if (!memory.dismissed && !paused) { wake(); mode = "follow"; } },
    pet: (held: boolean) => { if (memory.dismissed || paused) return; wake(); if (held) mode = "pet"; },
    dismiss: (dismissed: boolean) => { memory.dismissed = dismissed; wake(); save(); },
    name: (name: string) => { memory.name = trimName(name); save(); },
    reduced: (next: boolean) => { reduced = next; wake(); },
    pause: (next: boolean) => { paused = next; wake(); },
    fetch: (command: FetchCommand): boolean => {
      if (command.type === "cancel") { wake(); return true; }
      if (reduced || paused || memory.dismissed || mode === "pet" || !Number.isFinite(command.target.x) || !Number.isFinite(command.target.y)) return false;
      last = now(); mode = "fetch"; target = { ...command.target }; return true;
    },
  };
}
export type Kame = ReturnType<typeof createKame>;
