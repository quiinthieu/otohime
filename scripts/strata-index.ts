// Builds content/strata.json: 52 ISO weeks for 2024–2026.
// Full git history counts commits. A shallow clone keeps the committed file.
//   node --experimental-strip-types scripts/strata-index.ts
//   node --experimental-strip-types scripts/strata-index.ts --check

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { site } from "../content/site.ts";
import {
  STRATA_YEARS,
  buildStrataData,
  parseStrataData,
  serializeStrata,
  type StrataData,
} from "../lib/strata.ts";

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_FILE = join(ROOT, "content/strata.json");
export const MAX_LAG = 50;

type Git = (args: string[]) => string | null;

export function gitRunner(repo: string): Git {
  return (args) => {
    try {
      return execFileSync("git", ["-C", repo, ...args], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch {
      return null;
    }
  };
}

function gitState(git: Git): "full" | "shallow" | "none" {
  const shallow = git(["rev-parse", "--is-shallow-repository"])?.trim();
  if (shallow === "false") return "full";
  if (shallow === "true") return "shallow";
  return "none";
}

function sha(git: Git, rev: string) {
  const value = git(["rev-parse", rev])?.trim() ?? "";
  return /^[0-9a-f]{40}$/.test(value) ? value : null;
}

function readText(file: string) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

type Experience = { date?: string; label?: string; title?: string; note?: string };

function contentOf() {
  const experience = (site as { experience?: readonly Experience[] }).experience ?? [];
  let ledgerNotes: { date: string; notes: number }[] = [];
  try {
    const ledger = JSON.parse(readFileSync(join(ROOT, "content/ledger.json"), "utf8")) as {
      days?: Record<string, { notes?: number }>;
    };
    ledgerNotes = Object.entries(ledger.days ?? {}).map(([date, day]) => ({ date, notes: day.notes ?? 0 }));
  } catch {
    ledgerNotes = [];
  }
  return {
    notes: site.notes.map((note) => ({ date: note.date, title: note.title })),
    projects: site.projectList.map((project) => ({
      title: project.title,
      started: project.started,
      shipped: project.shipped,
      lastActivityAt: project.lastActivityAt,
    })),
    experience: [...experience],
    ledgerNotes,
  };
}

export function indexAt(git: Git, rev: string): StrataData | null {
  const head = sha(git, rev);
  if (!head) return null;
  const dates = git(["log", "--no-merges", "--format=%aI", head])?.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!dates) return null;
  const generatedAt = git(["log", "-1", "--format=%aI", head])?.trim() || dates[0] || "1970-01-01T00:00:00Z";
  return buildStrataData({ generatedAt, head, years: STRATA_YEARS, commits: dates, ...contentOf() });
}

export function main(argv: string[], git: Git = gitRunner(ROOT)): number {
  const file = DEFAULT_FILE;
  const check = argv.includes("--check");
  const state = gitState(git);
  const text = readText(file);

  if (state !== "full") {
    let parsed: StrataData | null = null;
    try {
      parsed = parseStrataData(text ? JSON.parse(text) : null);
    } catch {
      parsed = null;
    }
    if (!parsed) {
      console.error("strata-index: committed content/strata.json is missing or malformed, and git history is unavailable");
      return 1;
    }
    console.log(`strata-index: ${check ? "check ok" : "left the committed file"} (${state} git history)`);
    return 0;
  }

  if (check) {
    let parsed: StrataData | null = null;
    try {
      parsed = parseStrataData(text ? JSON.parse(text) : null);
    } catch {
      parsed = null;
    }
    if (!parsed?.head) {
      console.error("strata-index: check failed: content/strata.json is missing or has no head");
      return 1;
    }
    const built = indexAt(git, parsed.head);
    if (!built || serializeStrata(built) !== text) {
      console.error("strata-index: check failed: content/strata.json does not match git at its head");
      return 1;
    }
    const lag = Number(git(["rev-list", "--count", `${parsed.head}..HEAD`])?.trim());
    if (!Number.isInteger(lag) || lag > MAX_LAG) {
      console.error(`strata-index: check failed: ${lag} commits behind HEAD (at most ${MAX_LAG})`);
      return 1;
    }
    console.log(`strata-index: check ok, trails HEAD by ${lag}`);
    return 0;
  }

  const built = indexAt(git, "HEAD");
  if (!built) {
    console.error("strata-index: could not read HEAD");
    return 1;
  }
  writeFileSync(file, serializeStrata(built));
  console.log(`strata-index: wrote ${file}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
