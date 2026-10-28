// The Ask console's side of the model tier (lib/ask-llm.ts behind /api/ask). The console asks GET /api/ask
// once when it opens: the tier is on only for a 200 whose body has enabled:true, so a site with the switch
// off (404) never sees a POST. When on, a question is one POST /api/ask with {question}; a reply in the
// route's shape, mode llm or offline, prints as sent (an offline one keeps the server's (OFFLINE) line).
// A non-200, a network error, a body that is not that shape or no answer within ASK_TIMEOUT_MS gives null,
// and the console prints answer(index, query) from lib/ask.ts instead, with no error on screen.
// Framework-free and fetch-injected, so lib/ask-tier.test.ts drives it without a browser.
import type { Reply, Source } from "./ask.ts";

export const ASK_API = "/api/ask";
export const ASK_TIMEOUT_MS = 40_000;

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

// The page's fetch, read at call time so a test or a polyfill can stand in.
const pageFetch: Fetch = (input, init) => fetch(input, init);

// A receipt link must stay on this site: a path, not a protocol-relative or absolute URL.
const isSource = (s: unknown): s is Source =>
  typeof s === "object" &&
  s !== null &&
  typeof (s as Source).title === "string" &&
  typeof (s as Source).href === "string" &&
  (s as Source).href.startsWith("/") &&
  !(s as Source).href.startsWith("//");

// The route's answer as a receipt reply, or null when it is not one.
export function usableReply(body: unknown): Reply | null {
  if (typeof body !== "object" || body === null) return null;
  const { mode, intent, lines, sources } = body as { mode?: unknown; intent?: unknown; lines?: unknown; sources?: unknown };
  if (mode !== "llm" && mode !== "offline") return null;
  if (!Array.isArray(lines) || !Array.isArray(sources)) return null;
  if (!lines.every((l) => typeof l === "string") || !lines.some((l) => l.trim())) return null;
  if (!sources.every(isSource)) return null;
  return {
    intent: typeof intent === "string" ? (intent as Reply["intent"]) : "search",
    lines,
    sources: sources.map(({ title, href }) => ({ title, href })),
  };
}

// GET /api/ask: true only for a 200 with enabled:true; anything else, a failure or the timeout is false.
export async function tierEnabled(fetcher: Fetch = pageFetch, timeoutMs = ASK_TIMEOUT_MS): Promise<boolean> {
  try {
    const res = await fetcher(ASK_API, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (res.status !== 200) return false;
    const body: unknown = await res.json();
    return typeof body === "object" && body !== null && (body as { enabled?: unknown }).enabled === true;
  } catch {
    return false;
  }
}

// POST /api/ask: the reply to print, or null for the offline answer. A 429 still carries the server's
// offline reply, so its body is read too.
export async function askModel(question: string, fetcher: Fetch = pageFetch, timeoutMs = ASK_TIMEOUT_MS): Promise<Reply | null> {
  try {
    const res = await fetcher(ASK_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (res.status !== 200 && res.status !== 429) return null;
    return usableReply(await res.json());
  } catch {
    return null;
  }
}
