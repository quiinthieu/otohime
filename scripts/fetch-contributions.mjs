import { readFile, writeFile, rename } from "node:fs/promises";
import { pathToFileURL } from "node:url";
export const OWNER = "quiinthieu";
export const SOURCE = `https://github.com/users/${OWNER}/contributions`;
const output = new URL("../content/contributions.json", import.meta.url);
function weekKey(day) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return `${d.getUTCFullYear()}-W${String(Math.ceil(((+d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7)).padStart(2, "0")}`;
}
export function parseContributions(html, now = new Date()) {
  const tips = new Map();
  for (const match of html.matchAll(/<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/g)) {
    const id = /\bfor="([^"]+)"/.exec(match[1])?.[1];
    const count = /^\s*(No|[\d,]+) contributions? on /.exec(match[2]);
    if (id && count) tips.set(id, count[1] === "No" ? 0 : Number(count[1].replaceAll(",", "")));
  }
  const days = new Map();
  const today = now.toISOString().slice(0, 10);
  for (const match of html.matchAll(/<td\b[^>]*>/g)) {
    const date = /\bdata-date="(\d{4}-\d{2}-\d{2})"/.exec(match[0])?.[1];
    if (!date || date > today) continue;
    const id = /\bid="([^"]+)"/.exec(match[0])?.[1];
    const count = tips.get(id);
    if (!Number.isSafeInteger(count) || count < 0 || count > 100000 || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || days.has(date)) throw new Error("Invalid contribution day");
    days.set(date, count);
  }
  if (!days.size) throw new Error("No public contribution days found");
  const sorted = [...days].sort(([a], [b]) => a.localeCompare(b));
  for (let i = 1; i < sorted.length; i++) if (+new Date(sorted[i][0]) - +new Date(sorted[i - 1][0]) !== 86400000) throw new Error("Incomplete contribution calendar");
  const counts = new Map();
  for (const [day, count] of sorted) counts.set(weekKey(day), (counts.get(weekKey(day)) ?? 0) + count);
  return { owner: OWNER, source: SOURCE, fetchedAt: now.toISOString(), through: sorted.at(-1)[0], weeks: [...counts].map(([week, count]) => ({ week, count })) };
}
export async function refresh({ fetcher = fetch, destination = output, now = new Date() } = {}) {
  const response = await fetcher(SOURCE, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "otohime-bonsai-build" } });
  if (!response.ok) throw new Error(`Contribution fetch failed: ${response.status}`);
  const snapshot = parseContributions(await response.text(), now);
  if (snapshot.weeks.length < 40 || snapshot.through !== now.toISOString().slice(0, 10)) throw new Error("Stale or truncated contribution calendar");
  const temp = new URL(`${destination.href}.${process.pid}.tmp`);
  await writeFile(temp, JSON.stringify(snapshot, null, 2) + "\n");
  await rename(temp, destination);
  console.log(`Bonsai: ${snapshot.weeks.length} public activity weeks through ${snapshot.through}`);
  return snapshot;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await refresh(); }
  catch (error) {
    if (!process.argv.includes("--build")) throw error;
    // Builds may work offline, but never silently invent fresh activity.
    const snapshot = JSON.parse(await readFile(output, "utf8"));
    if (snapshot.owner !== OWNER || !snapshot.weeks?.length) throw error;
    console.warn(`Bonsai refresh unavailable; using snapshot through ${snapshot.through}: ${error.message}`);
  }
}
