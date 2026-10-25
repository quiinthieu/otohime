// Node-only smoke for the paper almanac: resolveSeason for a fixed clock,
// with no browser and no server. Each check prints one line; any mismatch
// exits 1. Later season tasks add their checks to CHECKS.
//
//   node --experimental-strip-types --disable-warning=ExperimentalWarning \
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/probe-seasons.mjs
import { hemisphereFromZone, resolveSeason } from "../lib/seasons.ts";

// Mid-January, noon UTC: high summer in Sydney, deep winter in London.
const CLOCK = new Date("2026-01-15T12:00:00Z");

const CHECKS = [
  ["hemisphere Australia/Sydney", () => hemisphereFromZone("Australia/Sydney"), "south"],
  ["season Australia/Sydney", () => resolveSeason(null, CLOCK, "Australia/Sydney"), "summer"],
  ["season Europe/London", () => resolveSeason(null, CLOCK, "Europe/London"), "winter"],
  ["season no zone", () => resolveSeason(null, CLOCK, ""), "winter"],
  ["manual autumn in Sydney", () => resolveSeason("autumn", CLOCK, "Australia/Sydney"), "autumn"],
];

let failed = 0;
for (const [name, run, want] of CHECKS) {
  const got = run();
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${got}${ok ? "" : ` (want ${want})`}`);
}
console.log(`clock ${CLOCK.toISOString()}: ${CHECKS.length - failed}/${CHECKS.length} checks pass`);
process.exit(failed ? 1 : 0);
