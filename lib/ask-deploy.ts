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

// The live tier, as scripts/probe-ask-tier.sh sees it once ASK_LLM and the key are set: GET /api/ask is 200 with
// enabled:true, and one POST answers in mode llm with model lines and at least one citation, every one a
// /work, /projects or /notes page. An (OFFLINE) reply, a 404 or a 429 is the tier not answering, so a miss.
export const TIER_SCOPE = ["/work", "/projects", "/notes"] as const;
export const TIER_QUESTION = "what data pipelines have you built?";

export type TierCheck = { ok: boolean; detail: string };
export type TierPostCheck = TierCheck & { lines: number; cited: string[] };

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

// A site path in the tier's scope: /work, /work/x or /work#y, never /workshop or an absolute URL.
export function inTierScope(href: string): boolean {
  return TIER_SCOPE.some((p) => href === p || href.startsWith(`${p}/`) || href.startsWith(`${p}#`) || href.startsWith(`${p}?`));
}

// The Origin header the route accepts: the site's own origin (lib/ask-llm.ts compares it to BETTER_AUTH_URL's).
export function tierOrigin(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

export function checkTierGet(status: number, text: string): TierCheck {
  const body = parseJson(text);
  const enabled = typeof body === "object" && body !== null && (body as { enabled?: unknown }).enabled === true;
  return { ok: status === 200 && enabled, detail: `${status} ${text.slice(0, 120)}` };
}

export function checkTierPost(status: number, text: string): TierPostCheck {
  const body = parseJson(text) as { mode?: unknown; lines?: unknown; sources?: unknown } | null;
  const lines = Array.isArray(body?.lines) ? body.lines.filter((l): l is string => typeof l === "string" && l.trim() !== "") : [];
  const sources = Array.isArray(body?.sources) ? body.sources : [];
  const cited = sources.map((s) => (typeof s === "object" && s !== null && typeof s.href === "string" ? s.href : ""));
  const miss =
    status !== 200
      ? `status ${status}`
      : body?.mode !== "llm"
        ? `mode ${JSON.stringify(body?.mode ?? null)}`
        : lines.length === 0
          ? "no model lines"
          : lines[0] === "(OFFLINE)"
            ? "an (OFFLINE) reply"
            : cited.length === 0
              ? "no citation"
              : cited.some((h) => !inTierScope(h))
                ? `a citation outside ${TIER_SCOPE.join(", ")}: ${cited.filter((h) => !inTierScope(h)).join(", ")}`
                : "";
  return { ok: miss === "", lines: lines.length, cited, detail: miss || `${lines.length} line(s), cites ${cited.join(", ")}` };
}
