// Does a deployed bundle carry the Ask console's call to the model tier (GET/POST /api/ask, lib/ask-tier.ts)?
// Read-only: scripts/probe-ask-deploy.sh fetches / and its chunks and asks bundleCarriesAskCall. A stale deploy
// built before the console called the tier has no chunk with the path; a current one has exactly one.
//
// The console is a dynamic import (components/ask-console-loader.tsx), so the call is in a lazy chunk that the
// HTML of / never names: a chunk the HTML links refers to it as "static/chunks/<name>.js". collectChunks follows
// those references too, so a lazy chunk reachable from / counts as linked from /.

// The literal path api/ask as a whole segment: not api/ask-old, api/asker or xapi/ask.
const ASK_CALL = /(?<![\w-])api\/ask(?![\w-])/;
// A chunk path in HTML (/_next/static/chunks/a.js) or in a chunk's loader table (static/chunks/a.js).
const CHUNK_PATH = /(?:\/_next\/)?static\/chunks\/([\w\-.~]+(?:\/[\w\-.~]+)*\.js)/g;

export function chunkCarriesAskCall(text: string): boolean {
  return ASK_CALL.test(text);
}

export function bundleCarriesAskCall(chunks: string[]): boolean {
  return chunks.some(chunkCarriesAskCall);
}

// Every /_next/static/chunks/*.js path named in `text`, deduplicated, in first-seen order.
export function chunkLinks(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(CHUNK_PATH)) seen.add(`/_next/static/chunks/${m[1]}`);
  return [...seen];
}

export type Fetched = { status: number; text: string };
export type FetchText = (url: string) => Promise<Fetched>;

export type ChunkCrawl = {
  linked: number; // chunks the HTML of / names
  checked: number; // chunks fetched with a 200, linked or reached through another chunk
  carrying: number; // of those, chunks with the console's call
  failed: string[]; // chunk paths that did not answer 200
  truncated: boolean; // stopped at `limit` with chunks left unread
  chunks: string[]; // the text of each checked chunk
};

// Fetch the page at baseUrl, then every chunk it links and every chunk those name, up to `limit` chunks.
export async function collectChunks(baseUrl: string, fetchText: FetchText, limit = 400): Promise<ChunkCrawl> {
  const base = baseUrl.replace(/\/+$/, "");
  const page = await fetchText(`${base}/`);
  if (page.status !== 200) throw new Error(`GET ${base}/ answered ${page.status}`);
  const queue = chunkLinks(page.text);
  const linked = queue.length;
  const seen = new Set(queue);
  const chunks: string[] = [];
  const failed: string[] = [];
  let fetched = 0;
  while (queue.length > 0 && fetched < limit) {
    const path = queue.shift() as string;
    fetched++;
    const res = await fetchText(`${base}${path}`);
    if (res.status !== 200) {
      failed.push(path);
      continue;
    }
    chunks.push(res.text);
    for (const next of chunkLinks(res.text)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return {
    linked,
    checked: chunks.length,
    carrying: chunks.filter(chunkCarriesAskCall).length,
    failed,
    truncated: queue.length > 0,
    chunks,
  };
}
