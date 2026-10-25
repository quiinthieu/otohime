// Node-only smoke for the paper almanac: resolveSeason for a fixed clock,
// with no browser and no server. Each check prints one line; any mismatch
// exits 1. Later season tasks add their checks to CHECKS.
//
//   node --experimental-strip-types --disable-warning=ExperimentalWarning \
//     --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/probe-seasons.mjs
import { hemisphereFromZone, resolveSeason, SEASON_ATTR, seasonScript } from "../lib/seasons.ts";

// Mid-January, noon UTC: high summer in Sydney, deep winter in London.
const CLOCK = new Date("2026-01-15T12:00:00Z");
// Late on 28 February in UTC is already 1 March in Auckland: autumn there, by its own wall clock.
const TURN = new Date("2026-02-28T23:30:00Z");

// The layouts' pre-paint script (lib/seasons.ts seasonScript), run as the browser would but with this clock,
// zone and stored value: it returns the data-season it set on <html>.
function prePaint(script, now, zone, stored) {
  const attrs = {};
  const document = { documentElement: { setAttribute: (k, v) => void (attrs[k] = v) } };
  const localStorage = {
    getItem() {
      if (stored instanceof Error) throw stored;
      return stored;
    },
  };
  const FixedDate = class extends Date {
    constructor() {
      super(now.getTime());
    }
  };
  function DateTimeFormat(locale, options) {
    return options ? new Intl.DateTimeFormat(locale, options) : { resolvedOptions: () => ({ timeZone: zone }) };
  }
  new Function("document", "localStorage", "Date", "Intl", script)(document, localStorage, FixedDate, { DateTimeFormat });
  return attrs[SEASON_ATTR];
}

// The script against resolveSeason itself: "same" when they agree, else both answers.
const same = (script, now, zone, stored) => {
  const a = prePaint(script, now, zone, stored);
  const b = resolveSeason(stored instanceof Error ? null : stored, now, zone);
  return a === b ? `same ${a}` : `script ${a}, resolveSeason ${b}`;
};
// Negative control: the script with its hemisphere stuck on north must be told apart.
const northOnly = seasonScript.replace(/south=[^;]+;/, "south=false;").replace(/south=true/, "south=false");

const CHECKS = [
  ["hemisphere Australia/Sydney", () => hemisphereFromZone("Australia/Sydney"), "south"],
  ["season Australia/Sydney", () => resolveSeason(null, CLOCK, "Australia/Sydney"), "summer"],
  ["season Europe/London", () => resolveSeason(null, CLOCK, "Europe/London"), "winter"],
  ["season no zone", () => resolveSeason(null, CLOCK, ""), "winter"],
  ["manual autumn in Sydney", () => resolveSeason("autumn", CLOCK, "Australia/Sydney"), "autumn"],
  ["pre-paint Australia/Sydney", () => same(seasonScript, CLOCK, "Australia/Sydney", null), "same summer"],
  ["pre-paint Europe/London", () => same(seasonScript, CLOCK, "Europe/London", null), "same winter"],
  ["pre-paint no zone", () => same(seasonScript, CLOCK, undefined, null), "same winter"],
  ["pre-paint unknown zone", () => same(seasonScript, CLOCK, "Not/AZone", null), "same winter"],
  ["pre-paint Pacific/Auckland at the month's turn", () => same(seasonScript, TURN, "Pacific/Auckland", null), "same autumn"],
  ["pre-paint stored autumn in Sydney", () => same(seasonScript, CLOCK, "Australia/Sydney", "autumn"), "same autumn"],
  ["pre-paint stored nonsense", () => same(seasonScript, CLOCK, "Australia/Sydney", "monsoon"), "same summer"],
  ["pre-paint storage throws", () => same(seasonScript, CLOCK, "Australia/Sydney", new Error("SecurityError")), "same summer"],
  ["negative control: north-only script", () => same(northOnly, CLOCK, "Australia/Sydney", null), "script winter, resolveSeason summer"],
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
