// Builds content/mould-graph.json from project routes and the Work pipeline.
// Throughput weights are illustrative. A shallow clone keeps the committed file.
//   node --experimental-strip-types scripts/mould-graph.ts
//   node --experimental-strip-types scripts/mould-graph.ts --check

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { site } from "../content/site.ts";
import { buildMouldGraph, parseMouldGraph, serializeMouldGraph, type MouldGraphData } from "../lib/mould.ts";

const ROOT = resolve(import.meta.dirname, "..");
const DEFAULT_FILE = join(ROOT, "content/mould-graph.json");
export const MAX_LAG = 50;

type Git = (args: string[]) => string | null;

function gitRunner(repo: string): Git {
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

export function prefixesFor(href: string): string[] {
  const slug = href.replace(/^\//, "");
  return [`app/(${slug})/`, `app/(site)/(app)/${slug}/`];
}

export function countTouches(log: string, projects: readonly { href: string }[]): number[] {
  const counts = projects.map(() => 0);
  let files: string[] = [];
  let open = false;
  const flush = () => {
    if (!open) return;
    projects.forEach((project, i) => {
      const prefixes = prefixesFor(project.href);
      if (files.some((file) => prefixes.some((prefix) => file.startsWith(prefix)))) counts[i] += 1;
    });
  };
  for (const line of log.split("\n")) {
    if (line.startsWith("---")) {
      flush();
      open = true;
      files = [];
    } else if (line.trim()) files.push(line.trim());
  }
  flush();
  return counts;
}

function readText(file: string) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

export function indexAt(git: Git, rev: string): MouldGraphData | null {
  const head = sha(git, rev);
  if (!head) return null;
  const log = git(["log", "--no-merges", "--name-only", "--pretty=format:---%H", head]);
  if (log === null) return null;
  const projects = site.projectList.filter((project) => project.href);
  const counts = countTouches(log, projects.map((project) => ({ href: project.href! })));
  const generatedAt = git(["log", "-1", "--format=%aI", head])?.trim() || "1970-01-01T00:00:00Z";
  return buildMouldGraph({
    generatedAt,
    head,
    projects: projects.map((project, i) => ({
      title: project.title,
      href: project.href,
      colour: project.colour,
      commits: counts[i] ?? 0,
    })),
    stack: site.stack.map((item) => ({ what: item.what, tools: item.tools })),
  });
}

export function main(argv: string[], git: Git = gitRunner(ROOT)): number {
  const check = argv.includes("--check");
  const state = gitState(git);
  const text = readText(DEFAULT_FILE);

  if (state !== "full") {
    let parsed: MouldGraphData | null = null;
    try {
      parsed = parseMouldGraph(text ? JSON.parse(text) : null);
    } catch {
      parsed = null;
    }
    if (!parsed) {
      console.error("mould-graph: committed content/mould-graph.json is missing or malformed, and git history is unavailable");
      return 1;
    }
    console.log(`mould-graph: ${check ? "check ok" : "left the committed file"} (${state} git history)`);
    return 0;
  }

  if (check) {
    let parsed: MouldGraphData | null = null;
    try {
      parsed = parseMouldGraph(text ? JSON.parse(text) : null);
    } catch {
      parsed = null;
    }
    if (!parsed?.head) {
      console.error("mould-graph: check failed: content/mould-graph.json is missing or has no head");
      return 1;
    }
    const built = indexAt(git, parsed.head);
    if (!built || serializeMouldGraph(built) !== text) {
      console.error("mould-graph: check failed: content/mould-graph.json does not match git at its head");
      return 1;
    }
    const lag = Number(git(["rev-list", "--count", `${parsed.head}..HEAD`])?.trim());
    if (!Number.isInteger(lag) || lag > MAX_LAG) {
      console.error(`mould-graph: check failed: ${lag} commits behind HEAD (at most ${MAX_LAG})`);
      return 1;
    }
    console.log(`mould-graph: check ok, trails HEAD by ${lag}`);
    return 0;
  }

  const built = indexAt(git, "HEAD");
  if (!built) {
    console.error("mould-graph: could not read HEAD");
    return 1;
  }
  writeFileSync(DEFAULT_FILE, serializeMouldGraph(built));
  console.log(`mould-graph: wrote ${DEFAULT_FILE}`);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv.slice(2)));
}
