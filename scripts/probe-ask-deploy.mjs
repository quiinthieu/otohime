// Read-only check that the bundle served at BASE_URL carries the Ask console's call to /api/ask. Run by
// scripts/probe-ask-deploy.sh (node --experimental-strip-types, so lib/ask-deploy.ts imports as is).
//
// Fetches BASE_URL/ (default http://127.0.0.1:3000), every /_next/static/chunks/*.js the HTML links and every
// chunk those name in their lazy-load tables (the console is a dynamic import, so its chunk is never in the
// HTML), then prints the count of chunks checked and of chunks carrying the call. Exit 0 only when
// bundleCarriesAskCall is true; 1 when no chunk carries it (a stale deploy) or / did not answer 200.
import { bundleCarriesAskCall, collectChunks } from "../lib/ask-deploy.ts";

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "user-agent": "probe-ask-deploy" } });
  return { status: res.status, text: await res.text() };
}

let crawl;
try {
  crawl = await collectChunks(BASE_URL, fetchText);
} catch (err) {
  console.log(`not ok - ask deploy: ${BASE_URL}/ could not be read: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

console.log(`chunks linked from /: ${crawl.linked}`);
console.log(`chunks checked: ${crawl.checked}`);
console.log(`chunks carrying api/ask: ${crawl.carrying}`);
if (crawl.failed.length > 0) console.log(`chunks not 200: ${crawl.failed.length} (${crawl.failed.slice(0, 5).join(", ")})`);
if (crawl.truncated) console.log("note: stopped at the chunk limit with chunks left unread");

if (bundleCarriesAskCall(crawl.chunks)) {
  console.log(`ok - ask deploy: ${BASE_URL} serves the console's api/ask call`);
  process.exit(0);
}
console.log(`not ok - ask deploy: no chunk reachable from ${BASE_URL}/ carries api/ask (stale deploy or missing call)`);
process.exit(1);
