// Writes content/ledger.json, the Stamp Ledger's year of activity, at build time
// (the prebuild step in package.json). Plain Node, no dependencies.
//
// Commits and releases come from GitHub's GraphQL API as the GITHUB_TOKEN's
// owner (`viewer`): commit counts per UTC day from public repositories only, and
// the names of public, non-draft releases. Notes come from the dates in
// content/site.ts, sketches from the review dates in content/portraits.json.
// Only counts and public release names are written: no commit messages, no
// private repository names.
//
// Never fatal: with no token, or on any failure (network, HTTP, GraphQL error,
// malformed reply, unreadable content), the committed content/ledger.json is
// left exactly as it is and the script exits 0. lib/ledger-data.test.ts drives
// run() with a fake fetch.

import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ENDPOINT = "https://api.github.com/graphql";
// The calendar covers the WINDOW_DAYS UTC days ending today.
export const WINDOW_DAYS = 365;
// contributionsCollection is asked a slice at a time, so no repository can have
// more contribution days in one slice than the 100 nodes a page returns.
export const SLICE_DAYS = 90;
export const TIMEOUT_MS = 15_000;
const RELEASE_NAME = 64;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAY_MS = 86_400_000;

/** @param {Date} d */
export const utcDay = (d) => d.toISOString().slice(0, 10);

/** @param {string} day @param {number} n */
const addDays = (day, n) => utcDay(new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS));

// The first and last UTC day of the window ending on `now`'s day.
/** @param {Date} now */
export function yearWindow(now) {
  const to = utcDay(now);
  return { from: addDays(to, -(WINDOW_DAYS - 1)), to };
}

// [from, to] cut into consecutive slices of at most SLICE_DAYS days.
/** @param {string} from @param {string} to */
export function slices(from, to) {
  const out = [];
  for (let start = from; start <= to; start = addDays(start, SLICE_DAYS)) {
    const end = addDays(start, SLICE_DAYS - 1);
    out.push({ from: start, to: end < to ? end : to });
  }
  return out;
}

const isRecord = (/** @type {unknown} */ v) => typeof v === "object" && v !== null && !Array.isArray(v);

// The UTC day of an ISO timestamp or YYYY-MM-DD, or null.
/** @param {unknown} v */
function dayOf(v) {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : utcDay(new Date(t));
}

/** @param {unknown} v */
function clip(v) {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  const chars = Array.from(s);
  return chars.length <= RELEASE_NAME ? s : `${chars.slice(0, RELEASE_NAME - 1).join("").trimEnd()}…`;
}

// The note dates in content/site.ts's `notes: [...]` list. Throws when the list
// is not there, so a moved list keeps the old file rather than losing every note.
/** @param {string} source */
export function noteDates(source) {
  const start = source.search(/\n\s*notes:\s*\[/);
  if (start < 0) throw new Error("content/site.ts: no notes list");
  const open = source.indexOf("[", start);
  let depth = 0;
  let quote = "";
  let end = -1;
  for (let i = open; i < source.length && end < 0; i++) {
    const c = source[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
    } else if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "[") depth++;
    else if (c === "]" && --depth === 0) end = i;
  }
  if (end < 0) throw new Error("content/site.ts: unterminated notes list");
  return [...source.slice(open, end).matchAll(/\bdate:\s*["'](\d{4}-\d{2}-\d{2})["']/g)].map((m) => m[1]);
}

// The days the published portraits were reviewed, from content/portraits.json
// (a list of records, or { records }). The base sketches carry no date.
/** @param {unknown} manifest */
export function sketchDates(manifest) {
  const records = Array.isArray(manifest) ? manifest : isRecord(manifest) && Array.isArray(manifest.records) ? manifest.records : [];
  return records.map((r) => (isRecord(r) && isRecord(r.review) ? dayOf(r.review.reviewedAt) : null)).filter((d) => d !== null);
}

const COMMITS_QUERY = `query($from: DateTime!, $to: DateTime!) {
  viewer {
    contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository { isPrivate }
        contributions(first: 100) { nodes { occurredAt commitCount } }
      }
    }
  }
}`;

const RELEASES_QUERY = `query {
  viewer {
    repositories(first: 100, privacy: PUBLIC, ownerAffiliations: OWNER, orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes {
        name
        isPrivate
        releases(first: 20, orderBy: { field: CREATED_AT, direction: DESC }) {
          nodes { name tagName publishedAt isDraft }
        }
      }
    }
  }
}`;

// One GraphQL call. Throws on a transport error, a non-2xx status, an errors
// list or a reply without data.
/** @param {typeof fetch} fetchImpl @param {string} token @param {string} query @param {Record<string, unknown>} [variables] */
async function graphql(fetchImpl, token, query, variables = {}) {
  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": "otohime-ledger" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL: HTTP ${res.status}`);
  const body = await res.json();
  if (!isRecord(body)) throw new Error("GitHub GraphQL: reply is not an object");
  if (Array.isArray(body.errors) && body.errors.length > 0) throw new Error("GitHub GraphQL: errors in reply");
  if (!isRecord(body.data) || !isRecord(body.data.viewer)) throw new Error("GitHub GraphQL: no viewer in reply");
  return body.data.viewer;
}

// Public commit counts per UTC day, and public release names per UTC day,
// within [from, to]. Throws on anything unexpected.
/** @param {typeof fetch} fetchImpl @param {string} token @param {{ from: string, to: string }} window */
export async function fetchGithub(fetchImpl, token, { from, to }) {
  /** @type {Record<string, number>} */
  const commits = {};
  for (const slice of slices(from, to)) {
    const viewer = await graphql(fetchImpl, token, COMMITS_QUERY, { from: `${slice.from}T00:00:00Z`, to: `${slice.to}T23:59:59Z` });
    const byRepo = viewer.contributionsCollection?.commitContributionsByRepository;
    if (!Array.isArray(byRepo)) throw new Error("GitHub GraphQL: no commitContributionsByRepository");
    for (const entry of byRepo) {
      if (!isRecord(entry) || !isRecord(entry.repository) || entry.repository.isPrivate !== false) continue;
      const nodes = entry.contributions?.nodes;
      if (!Array.isArray(nodes)) throw new Error("GitHub GraphQL: no contribution nodes");
      for (const node of nodes) {
        const day = isRecord(node) ? dayOf(node.occurredAt) : null;
        const n = isRecord(node) ? node.commitCount : null;
        if (!day || day < from || day > to || typeof n !== "number" || !Number.isInteger(n) || n < 0) continue;
        commits[day] = (commits[day] ?? 0) + n;
      }
    }
  }

  /** @type {Record<string, string[]>} */
  const releases = {};
  const viewer = await graphql(fetchImpl, token, RELEASES_QUERY);
  const repos = viewer.repositories?.nodes;
  if (!Array.isArray(repos)) throw new Error("GitHub GraphQL: no repositories");
  for (const repo of repos) {
    if (!isRecord(repo) || repo.isPrivate !== false || !Array.isArray(repo.releases?.nodes)) continue;
    for (const rel of repo.releases.nodes) {
      if (!isRecord(rel) || rel.isDraft !== false) continue;
      const day = dayOf(rel.publishedAt);
      const name = clip(`${repo.name} ${clip(rel.name) ?? clip(rel.tagName) ?? ""}`);
      if (!day || day < from || day > to || !name) continue;
      (releases[day] ??= []).push(name);
    }
  }
  return { commits, releases };
}

// The file's contents: only days with something on them, in date order.
/** @param {{ now: Date, window: { from: string, to: string }, commits: Record<string, number>, releases: Record<string, string[]>, notes: string[], sketches: string[] }} input */
export function buildLedger({ now, window, commits, releases, notes, sketches }) {
  /** @type {Record<string, { commits: number, notes: number, sketches: number, releases: string[] }>} */
  const days = {};
  const at = (/** @type {string} */ day) => (days[day] ??= { commits: 0, notes: 0, sketches: 0, releases: [] });
  const inWindow = (/** @type {string} */ day) => day >= window.from && day <= window.to;
  for (const [day, n] of Object.entries(commits)) if (inWindow(day) && n > 0) at(day).commits += n;
  for (const [day, names] of Object.entries(releases)) if (inWindow(day) && names.length > 0) at(day).releases.push(...names);
  for (const day of notes) if (inWindow(day)) at(day).notes++;
  for (const day of sketches) if (inWindow(day)) at(day).sketches++;
  const sorted = Object.fromEntries(Object.keys(days).sort().map((day) => [day, days[day]]));
  return { generated: now.toISOString(), days: sorted };
}

// Fetches, merges and writes. Resolves to what happened; never rejects.
/** @param {{ fetch?: typeof fetch, env?: Record<string, string | undefined>, root?: string, now?: Date, log?: (msg: string) => void }} [options] */
export async function run({ fetch: fetchImpl = globalThis.fetch, env = process.env, root = ROOT, now = new Date(), log = console.log } = {}) {
  const file = path.join(root, "content", "ledger.json");
  const keep = (/** @type {string} */ reason) => {
    log(`ledger: kept content/ledger.json (${reason})`);
    return { status: "kept", reason };
  };
  const token = env.GITHUB_TOKEN?.trim();
  if (!token) return keep("no GITHUB_TOKEN");
  try {
    const window = yearWindow(now);
    const notes = noteDates(await readFile(path.join(root, "content", "site.ts"), "utf8"));
    const sketches = sketchDates(JSON.parse(await readFile(path.join(root, "content", "portraits.json"), "utf8")));
    const { commits, releases } = await fetchGithub(fetchImpl, token, window);
    const ledger = buildLedger({ now, window, commits, releases, notes, sketches });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, `${JSON.stringify(ledger, null, 2)}\n`);
    await rename(tmp, file);
    const total = Object.keys(ledger.days).length;
    log(`ledger: wrote content/ledger.json (${total} days, ${window.from}..${window.to})`);
    return { status: "written", reason: `${total} days` };
  } catch (err) {
    return keep(err instanceof Error ? err.message : String(err));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await run().catch((err) => console.log(`ledger: kept content/ledger.json (${err})`));
  process.exitCode = 0;
}
