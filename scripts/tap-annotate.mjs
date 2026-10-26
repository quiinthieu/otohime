// CI's `npm test` step keeps its TAP output in a file. When that step fails, this turns each failed test in the file
// into an ::error annotation and a step summary section, as scripts/e2e-annotate.mjs does for E2E: the job log needs
// a token to read, annotations and the summary do not. A parent that failed only because a subtest failed adds
// nothing and is left out. A red run with no `not ok` in it (a crash, a kill) still gets one annotation with the
// output's last lines. Reporting never changes the verdict: the npm test step has already failed, and this exits 0.
//
//   node scripts/tap-annotate.mjs <tap-file>
import { appendFileSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { annotation, escapeData, summary } from "./e2e-annotate.mjs";

const TAIL_LINES = 40;

// Failed tests in node:test TAP output, at any nesting depth: name, file, line and the diagnostic YAML block.
export function failures(tap) {
  const lines = tap.split("\n");
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^( *)not ok \d+ - (.*)$/.exec(lines[i]);
    if (!m) continue;
    const pad = `${m[1]}  `;
    const body = [];
    if (lines[i + 1] === `${pad}---`) {
      for (let j = i + 2; j < lines.length && lines[j] !== `${pad}...`; j++) body.push(lines[j].slice(pad.length));
    }
    const yaml = body.join("\n");
    if (/^failureType: 'subtestsFailed'$/m.test(yaml)) continue;
    const where = /^location: '(.*):(\d+):\d+'$/m.exec(yaml);
    const text = body.filter((l) => !/^(duration_ms|type|location): /.test(l)).join("\n").trim();
    found.push({ name: m[2], file: where?.[1] ?? null, line: where ? Number(where[2]) : null, text: text || "(no diagnostics)" });
  }
  return found;
}

export function report(tap, summaryFile) {
  const failed = failures(tap);
  const tail = tap.trimEnd().split("\n").slice(-TAIL_LINES).join("\n");
  let out = failed.map((f) => annotation(f, f.text, "npm test")).join("");
  if (failed.length === 0) out += `::error title=npm test failed with no failed test in its output::${escapeData(tail)}\n`;
  if (summaryFile) {
    const sections = failed.length ? failed.map((f) => summary(f, f.text)).join("") : summary({ name: "no failed test; last lines" }, tail);
    try {
      appendFileSync(summaryFile, `## npm test failures\n\n${sections}`);
    } catch {}
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  let tap = "";
  try {
    tap = readFileSync(process.argv[2], "utf8");
  } catch (error) {
    process.stdout.write(`::error title=npm test output unavailable::${escapeData(String(error))}\n`);
    process.exit(0);
  }
  process.stdout.write(report(tap, process.env.GITHUB_STEP_SUMMARY));
}
