// Post-process non-TAP probes after bash captures their status under pipefail:
// node scripts/ci-probe-annotate.mjs "Step name" "$status" "$RUNNER_TEMP/probe.log"
// Reporting never replaces the probe's exit code; raw output remains in tee's log.
import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { escapeData } from "./e2e-annotate.mjs";

const escapeProperty = (s) => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
const clip = (s, n) => s.length > n ? `${s.slice(0, n)}\n… (truncated)` : s;
const tail = (s, lines, chars) => s.trimEnd().split("\n").slice(-lines).join("\n").slice(-chars);
const markdown = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/```/g, "ˋˋˋ");
function read(file, missing) {
  try { return readFileSync(file, "utf8"); } catch { return missing; }
}

const [step, rawStatus, log] = process.argv.slice(2);
const status = Number(rawStatus);
if (!step || !log || !/^\d+$/.test(rawStatus ?? "") || status > 255) {
  console.error('Usage: node scripts/ci-probe-annotate.mjs "Step name" status probe.log');
  process.exitCode = 2;
} else {
  process.exitCode = status;
  if (status !== 0) {
    const output = read(log, `${log} unavailable`);
    // Camera's wrapper also forwards nested TAP; retain its failed test name even if later checks pass.
    const assertions = output.split("\n").filter((line) => /^\s*(?:#\s*)?(?:not ok(?: \d+)? -|probe:)/.test(line)).join("\n");
    const diagnostic = assertions || tail(output, 80, 8000);
    const server = tail(read(join(process.env.RUNNER_TEMP || ".", "next-start.log"), "next-start.log unavailable"), 80, 8000);
    const context = `Commit ${process.env.GITHUB_SHA || "unknown"}; probe exit ${status}`;
    console.log(`::error title=${escapeProperty(step)}::${escapeData(`${context}\n${clip(diagnostic, 3000)}\nnext start, last 80 lines (bounded):\n${tail(server, 80, 2000)}`)}`);
    if (process.env.GITHUB_STEP_SUMMARY) {
      try {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY,
          `## ${markdown(clip(step, 200)).replace(/[\r\n]/g, " ")} failure\n\n${markdown(context)}\n\n` +
          `\`\`\`\n${markdown(clip(diagnostic, 8000))}\n\`\`\`\n\n### next start, last 80 lines (bounded)\n\n\`\`\`\n${markdown(server)}\n\`\`\`\n`);
      } catch (error) { console.error(`CI probe summary unavailable: ${error.message}`); }
    }
  }
}
