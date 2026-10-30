import { readFileSync } from "node:fs";
import path from "node:path";
export const REQUIRED_INK_TESTS = [
  "ink bonsai seasons pruning regrowth and postcard are usable",
  "ink bonsai weekly images are deterministic and invalid weeks fail safely",
  "ink experiments reduced motion keeps pruning and paper puppets static",
  "shadow puppets move by mouse touch and keyboard without camera consent",
  "shadow camera denial and model failure leave usable paper puppets",
  "shadow real local model constructs on CPU and detects without outbound requests",
  "shadow opt in camera stops on Stop visibility and route exit",
  "shadow four fixture poses carry working links through the camera stage",
];
export function checkInkTests(source) {
  const names = [...source.matchAll(/\btest\("([^"\n]+)"\s*,/g)].map(m => m[1]);
  const missing = REQUIRED_INK_TESTS.filter(name => !names.includes(name));
  if (missing.length) throw new Error(`Missing required ink experiment tests: ${missing.join(", ")}`);
}
export function checkInkWiring(root = process.cwd()) {
  checkInkTests(readFileSync(path.join(root, "e2e/ink-experiments.test.ts"), "utf8"));
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  if (!pkg.scripts["test:e2e"].includes("e2e/**/*.test.ts")) throw new Error("Ink browser tests are not in the CI suite");
  const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  if (!ci.includes("npm run test:e2e")) throw new Error("CI must run the ink browser tests");
}
