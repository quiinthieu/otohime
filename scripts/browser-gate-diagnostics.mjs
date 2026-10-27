// EXIT fallback for browser gates, including readiness and pre-reporter crashes.
// Full combined output stays in tee's log; only bounded tails become public.
// Usage: node scripts/browser-gate-diagnostics.mjs "Gate" status combined.log
import { appendFileSync, closeSync, fstatSync, openSync, readSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { escapeData } from "./e2e-annotate.mjs";

const clean = (s) => stripVTControlCharacters(s).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
const property = (s) => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
const markdown = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/`/g, "ˋ");
const tail = (s, chars) => clean(s).trimEnd().split("\n").slice(-80).join("\n").slice(-chars);

// Read only the end, even for very large logs. Never print paths or filesystem errors.
function readTail(file, label, chars = 8000) {
  let fd;
  try {
    fd = openSync(file, "r");
    const size = fstatSync(fd).size;
    const buffer = Buffer.alloc(Math.min(size, 64 * 1024));
    const bytes = readSync(fd, buffer, 0, buffer.length, size - buffer.length);
    return tail(buffer.subarray(0, bytes).toString("utf8"), chars) || `${label} empty (no output captured)`;
  } catch {
    return `${label} unavailable (no output captured)`;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function version(command, args) {
  try {
    return clean(execFileSync(command, args, { encoding: "utf8", timeout: 2000, maxBuffer: 4096, stdio: ["ignore", "pipe", "ignore"] })).trim().slice(0, 300) || "unavailable";
  } catch { return "unavailable"; }
}

const [step, rawStatus, log] = process.argv.slice(2);
if (!step || !log || !/^\d+$/.test(rawStatus ?? "") || Number(rawStatus) > 255) {
  console.error('Usage: node scripts/browser-gate-diagnostics.mjs "Gate" status combined.log');
  process.exitCode = 2;
} else {
  const status = Number(rawStatus);
  process.exitCode = status;
  if (status !== 0) {
    // Explicit allowlist: no environment dump, connection strings or provider credentials.
    const identity = [
      `Gate: ${clean(step).slice(0, 200)}; exit ${status}`,
      `Commit: ${clean(process.env.GITHUB_SHA || version("git", ["rev-parse", "HEAD"])).slice(0, 200)}`,
      `Build: ${readTail(".next/BUILD_ID", "BUILD_ID", 300)}`,
      `Node: ${process.version}`,
      `Chrome: ${version("google-chrome", ["--version"])}`,
    ].join("\n");
    const output = readTail(log, "command log");
    const server = readTail(join(process.env.RUNNER_TEMP || ".", "next-start.log"), "next-start.log");
    const annotation = `${identity}\nCommand, last 80 lines (bounded):\n${tail(output, 3000)}\nnext start, last 80 lines (bounded):\n${tail(server, 2000)}`;
    console.log(`::error title=${property(clean(step).slice(0, 200))}::${escapeData(annotation)}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      try {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY,
          `## Browser gate failure\n\n\`\`\`text\n${markdown(identity)}\n\`\`\`\n\n` +
          `### Command, last 80 lines (bounded)\n\n\`\`\`text\n${markdown(output)}\n\`\`\`\n\n` +
          `### next start, last 80 lines (bounded)\n\n\`\`\`text\n${markdown(server)}\n\`\`\`\n`);
      } catch { console.error("Browser gate summary unavailable; annotation retained"); }
    }
  }
}
