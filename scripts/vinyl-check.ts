// Checks Vinyl's records.json: the schema first, then whether YouTube will
// embed each distinct video id, asked of its oEmbed endpoint.
//   npm run vinyl:check               validate and ask YouTube
//   npm run vinyl:check -- --offline  validate only
// Exit 1: an invalid record, or a video that is malformed, not embeddable or gone.
// Exit 2: only network failures, so nothing is known to be dead. Exit 0: all good.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classify, exitCode, oembedUrl, type Verdict } from "../app/(vinyl)/_lib/oembed.ts";
import { validateRecords, videoIds, type VinylRecord } from "../app/(vinyl)/_lib/records.ts";

const FILE = join(import.meta.dirname, "../app/(vinyl)/_lib/records.json");
const CONCURRENCY = 4;
const TIMEOUT_MS = 8000;
const offline = process.argv.includes("--offline");

const raw: unknown = JSON.parse(readFileSync(FILE, "utf8"));
const { errors, warnings } = validateRecords(raw);
for (const e of errors) console.log(`error: ${e}`);
for (const w of warnings) console.log(`warning: ${w}`);
const count = Array.isArray(raw) ? raw.length : 0;
console.log(`${count} records, ${errors.length} errors, ${warnings.length} warnings`);

async function status(videoId: string): Promise<number | null> {
  try {
    const res = await fetch(oembedUrl(videoId), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    await res.body?.cancel();
    return res.status;
  } catch {
    return null;
  }
}

// Runs fn over items, at most `limit` at a time, keeping the order.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function main(): Promise<number> {
  if (offline || errors.length || !Array.isArray(raw)) {
    if (offline) console.log("offline: video ids not checked");
    return exitCode(errors.length, []);
  }
  const records = raw as VinylRecord[];
  const rows = records.flatMap((r) => videoIds(r).map((videoId) => ({ record: r.id, videoId })));
  const distinct = [...new Set(rows.map((r) => r.videoId))];
  const statuses = new Map<string, number | null>();
  const results = await pool(distinct, CONCURRENCY, status);
  distinct.forEach((id, i) => statuses.set(id, results[i]));

  const table = rows.map(({ record, videoId }) => {
    const s = statuses.get(videoId) ?? null;
    return [record, videoId, s === null ? "-" : String(s), classify(s)];
  });
  const head = ["record", "videoId", "status", "verdict"];
  const widths = head.map((h, c) => Math.max(h.length, ...table.map((row) => row[c].length)));
  const line = (cells: string[]) => cells.map((cell, c) => cell.padEnd(widths[c])).join(" · ").trimEnd();
  console.log("");
  console.log(line(head));
  for (const row of table) console.log(line(row));

  const verdicts = distinct.map((id) => classify(statuses.get(id) ?? null));
  const tally = new Map<Verdict, number>();
  for (const v of verdicts) tally.set(v, (tally.get(v) ?? 0) + 1);
  console.log(`\n${distinct.length} distinct videos: ${[...tally].map(([v, n]) => `${n} ${v}`).join(", ")}`);
  return exitCode(errors.length, verdicts);
}

process.exitCode = await main();
