export type ActivityWeek = { week: string; count: number };
export type Season = "spring" | "summer" | "autumn" | "winter";
export type Branch = { id: string; parent: string | null; week: string; x: number; y: number; x2: number; y2: number; width: number; leaf: boolean };
export const MAX_BRANCHES = 1800;

export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const year = d.getUTCFullYear();
  const n = Math.ceil(((+d - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(n).padStart(2, "0")}`;
}
export function weekDate(week: string): Date | null {
  if (!/^20\d{2}-W\d{2}$/.test(week)) return null;
  const year = Number(week.slice(0, 4)), n = Number(week.slice(6));
  const d = new Date(Date.UTC(year, 0, 4));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + (n - 1) * 7);
  return isoWeek(d) === week ? d : null;
}
export function seasonForWeek(week: string): Season {
  const month = weekDate(week)?.getUTCMonth() ?? 0;
  return month >= 2 && month <= 4 ? "spring" : month >= 5 && month <= 7 ? "summer" : month >= 8 && month <= 10 ? "autumn" : "winter";
}
export function isSeason(value: unknown): value is Season {
  return ["spring", "summer", "autumn", "winter"].includes(value as string);
}
function random(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6d2b79f5; let t = Math.imul(h ^ (h >>> 15), h | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A bounded bracketed L-system. Each week owns a persistent side shoot.
 * X -> F[+X][-X]X; a quiet week draws F without foliage. No random global state. */
export function growBonsai(weeks: readonly ActivityWeek[], selected: string): Branch[] {
  if (!weekDate(selected)) throw new Error("Invalid ISO week");
  const history = weeks.filter(w => w.week <= selected).slice(-53);
  const result: Branch[] = [];
  let trunkX = 310, trunkY = 438;
  for (const [index, w] of history.entries()) {
    if (!weekDate(w.week) || !Number.isSafeInteger(w.count) || w.count < 0 || w.count > 100000) throw new Error("Invalid activity");
    const rand = random(`${w.week}:${w.count}`);
    const oldX = trunkX, oldY = trunkY;
    trunkY -= 5.3;
    trunkX += Math.sin(index * 0.28) * 1.65;
    const trunk = `trunk-${w.week}`;
    result.push({ id: trunk, parent: null, week: w.week, x: oldX, y: oldY, x2: trunkX, y2: trunkY, width: Math.max(2, 12 - index * 0.18), leaf: false });
    const depth = w.count === 0 ? 0 : Math.min(3, 1 + Math.floor(Math.log2(w.count + 1) / 3));
    let word = "X";
    for (let i = 0; i < depth; i++) word = word.replaceAll("X", "F[+X][-X]X");
    let x = trunkX, y = trunkY, angle = (index % 2 ? -2.5 : -0.65) + (rand() - 0.5) * 0.4;
    let parent = trunk, level = 0;
    const stack: { x: number; y: number; angle: number; parent: string; level: number }[] = [];
    let segment = 0;
    for (const c of word) {
      if (result.length >= MAX_BRANCHES || segment >= 32) break;
      if (c === "[") { stack.push({ x, y, angle, parent, level }); level++; }
      else if (c === "]") { const state = stack.pop()!; ({ x, y, angle, parent, level } = state); }
      else if (c === "+") angle += 0.55 + rand() * 0.3;
      else if (c === "-") angle -= 0.55 + rand() * 0.3;
      else {
        const length = (9 + rand() * 8 + Math.min(13, Math.log2(w.count + 1) * 2)) * Math.pow(0.72, level);
        const x2 = x + Math.cos(angle) * length, y2 = y + Math.sin(angle) * length;
        const id = `${w.week}-${segment++}`;
        result.push({ id, parent, week: w.week, x, y, x2, y2, width: Math.max(0.8, 3.2 - level * 0.8), leaf: c === "X" && w.count > 0 });
        x = x2; y = y2; parent = id;
      }
    }
  }
  return result;
}
export function visibleBranches(branches: readonly Branch[], cuts: ReadonlySet<string>): Branch[] {
  const hidden = new Set(cuts);
  return branches.filter(b => { if (b.parent && hidden.has(b.parent)) hidden.add(b.id); return !hidden.has(b.id); });
}
