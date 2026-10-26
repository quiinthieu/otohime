// A node:test reporter for GitHub Actions, added beside the default one by scripts/e2e.mjs when GITHUB_ACTIONS is set.
// The job log needs a token to read, but a check run's annotations and the run's step summary do not: each failed
// test becomes an ::error annotation (file, line, test name, the first lines of its error) and a section of
// $GITHUB_STEP_SUMMARY (the whole error, bounded), so a red E2E step says which assertion failed to anyone.
import { appendFileSync } from "node:fs";
import path from "node:path";

const ANNOTATION_CHARS = 3000;
const SUMMARY_CHARS = 8000;

// Workflow command escaping: the message keeps its lines as %0A, a property may not hold : or , either.
export const escapeData = (s) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProperty = (s) => escapeData(s).replace(/:/g, "%3A").replace(/,/g, "%2C");
const clip = (s, n) => (s.length > n ? `${s.slice(0, n)}\n… (${s.length - n} more characters)` : s);

// The assertion under node:test's wrapper: a failing test's error is ERR_TEST_FAILURE with the thrown one as cause.
function describe(error) {
  const cause = error?.code === "ERR_TEST_FAILURE" && error.cause ? error.cause : error;
  if (cause instanceof Error) return cause.stack || `${cause.name}: ${cause.message}`;
  return String(cause);
}

export function annotation({ name, file, line }, error, label = "E2E") {
  const props = [];
  if (file) props.push(`file=${escapeProperty(path.relative(process.cwd(), file.replace(/^file:\/\//, "")))}`);
  if (file && line) props.push(`line=${line}`);
  props.push(`title=${escapeProperty(`${label} failed: ${name}`)}`);
  return `::error ${props.join(",")}::${escapeData(clip(describe(error), ANNOTATION_CHARS))}\n`;
}

export function summary({ name, file, line }, error) {
  const where = file ? `${path.relative(process.cwd(), file.replace(/^file:\/\//, ""))}${line ? `:${line}` : ""}` : "";
  const body = clip(describe(error), SUMMARY_CHARS).replace(/```/g, "ˋˋˋ");
  return `### ✗ ${name}\n\n${where ? `\`${where}\`\n\n` : ""}\`\`\`\n${body}\n\`\`\`\n\n`;
}

export default async function* annotate(source) {
  let failed = 0;
  for await (const event of source) {
    if (event.type !== "test:fail") continue;
    const { data } = event;
    // A parent failing only because a test inside it failed adds nothing; a file's own failure (a throw outside any
    // test, a failed hook) does, and arrives named after the file.
    if (data.details?.error?.failureType === "subtestsFailed") continue;
    failed++;
    yield `\n${annotation(data, data.details?.error)}`;
    if (process.env.GITHUB_STEP_SUMMARY) {
      try {
        if (failed === 1) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "## E2E failures\n\n");
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(data, data.details?.error));
      } catch {}
    }
  }
}
