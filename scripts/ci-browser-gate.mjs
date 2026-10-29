// Skip the Chrome circuit when a push or PR only touches task reports and Markdown.
// An unknown diff runs the suite: missing coverage is the failure to avoid.
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function isReportOnly(file) {
  return file.startsWith("projects/") || file.endsWith(".md");
}

// null means the diff is unknown. An empty list skips the suite.
export function needsBrowser(files) {
  if (files == null) return true;
  return files.some((file) => !isReportOnly(file));
}

function diffFiles(...refs) {
  return execFileSync("git", ["diff", "--name-only", ...refs], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function filesForEvent() {
  const name = process.env.GITHUB_EVENT_NAME ?? "";
  if (name !== "push" && name !== "pull_request") return null;
  const payload = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  if (name === "push") {
    const before = payload.before ?? "";
    const after = process.env.GITHUB_SHA ?? "";
    if (!before || /^0+$/.test(before) || !after) return null;
    return diffFiles(before, after);
  }
  const base = payload.pull_request?.base?.sha;
  const head = payload.pull_request?.head?.sha || process.env.GITHUB_SHA;
  if (!base || !head) return null;
  return diffFiles(`${base}...${head}`);
}

function publish(browser, files) {
  const value = browser ? "true" : "false";
  if (browser) {
    const forcing = (files ?? []).filter((file) => !isReportOnly(file)).slice(0, 8);
    console.log(forcing.length ? `browser coverage: required by ${forcing.join(", ")}` : "browser coverage: required");
  } else {
    console.log(`browser coverage: skipped (${files.length} report-only paths)`);
  }
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `browser=${value}\n`);
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) {
  try {
    const files = filesForEvent();
    publish(needsBrowser(files), files);
  } catch (error) {
    console.error(`browser coverage: ${error.message}; running the browser suite`);
    publish(true, null);
  }
}
