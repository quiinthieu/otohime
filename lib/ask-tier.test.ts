import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ASK_API, ASK_TIMEOUT_MS, askModel, tierEnabled, usableReply } from "./ask-tier.ts";
import { OFFLINE } from "./ask-llm.ts";

const ROOT = join(import.meta.dirname, "..");

type Call = { url: string; init?: RequestInit };

// A fetch that records each call and answers from `reply`; "hang" never answers until its signal aborts.
// Node unrefs AbortSignal.timeout's timer, so the hang holds a timer of its own to keep the test alive.
function fakeFetch(reply: Response | Error | "hang") {
  const calls: Call[] = [];
  const fetcher = (url: string, init?: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    if (reply === "hang") {
      return new Promise((_, reject) => {
        const signal = init?.signal;
        if (!signal) return;
        const alive = setTimeout(() => {}, 60_000);
        signal.addEventListener("abort", () => {
          clearTimeout(alive);
          reject(signal.reason);
        });
      });
    }
    return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply.clone());
  };
  return { calls, fetcher };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const LLM = {
  mode: "llm",
  intent: "search",
  lines: ["I BUILD DATA PIPELINES.", "SEE WORK."],
  sources: [{ title: "Work", href: "/work" }],
};

test("tierEnabled: on only for a 200 whose body has enabled:true", async () => {
  const on = fakeFetch(json({ enabled: true, limits: { hour: 10, day: 150 } }));
  assert.equal(await tierEnabled(on.fetcher), true);
  assert.equal(on.calls.length, 1);
  assert.equal(on.calls[0].url, ASK_API);
  assert.equal(on.calls[0].init?.method ?? "GET", "GET");
  assert.ok(on.calls[0].init?.signal, "the GET carries an abort signal");

  for (const reply of [
    new Response("Not Found", { status: 404 }),
    json({ enabled: true }, 500),
    json({ enabled: false }),
    json({ enabled: "true" }),
    json(null),
    new Response("<html>not json</html>", { status: 200 }),
    new TypeError("Failed to fetch"),
  ]) {
    const off = fakeFetch(reply);
    assert.equal(await tierEnabled(off.fetcher), false, String(reply instanceof Response ? reply.status : reply));
  }
});

test("tierEnabled: a GET with no answer is off after the timeout", async () => {
  const hang = fakeFetch("hang");
  const started = performance.now();
  assert.equal(await tierEnabled(hang.fetcher, 50), false);
  assert.ok(performance.now() - started >= 40);
});

test("askModel: one POST of {question} as JSON; an llm reply comes back as lines and receipt links", async () => {
  const { calls, fetcher } = fakeFetch(json(LLM));
  const reply = await askModel("what do you build?", fetcher);
  assert.deepEqual(reply, { intent: "search", lines: LLM.lines, sources: LLM.sources });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ASK_API);
  assert.equal(calls[0].init?.method, "POST");
  assert.equal(new Headers(calls[0].init?.headers).get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { question: "what do you build?" });
  assert.ok(calls[0].init?.signal);
});

test("askModel: the server's offline reply keeps its (OFFLINE) line, also on a 429", async () => {
  const body = { mode: "offline", intent: "search", lines: [OFFLINE, "SHORE IS A TIDE TOY."], sources: [{ title: "Shore", href: "/shore" }] };
  for (const status of [200, 429]) {
    const reply = await askModel("shore", fakeFetch(json(body, status)).fetcher);
    assert.equal(reply?.lines[0], OFFLINE, String(status));
    assert.deepEqual(reply?.sources, body.sources);
  }
});

test("askModel: null (the offline canned answer) on a failed POST, a bad status or an unusable body", async () => {
  const cases: [string, Response | Error][] = [
    ["network error", new TypeError("Failed to fetch")],
    ["404", new Response("Not Found", { status: 404 })],
    ["403", json({ error: "origin" }, 403)],
    ["500", json(LLM, 500)],
    ["non-JSON", new Response("<html>oops</html>", { status: 200 })],
    ["no mode", json({ ...LLM, mode: undefined })],
    ["unknown mode", json({ ...LLM, mode: "stream" })],
    ["no lines", json({ ...LLM, lines: [] })],
    ["blank lines", json({ ...LLM, lines: ["  "] })],
    ["a line that is not text", json({ ...LLM, lines: ["ok", 3] })],
    ["sources not a list", json({ ...LLM, sources: "/work" })],
    ["an absolute link", json({ ...LLM, sources: [{ title: "X", href: "https://evil.example/" }] })],
    ["a protocol-relative link", json({ ...LLM, sources: [{ title: "X", href: "//evil.example/" }] })],
    ["a link with no title", json({ ...LLM, sources: [{ href: "/work" }] })],
  ];
  for (const [name, reply] of cases) {
    assert.equal(await askModel("work", fakeFetch(reply).fetcher), null, name);
  }
});

test("askModel: a POST with no answer gives up after the timeout, 40 s by default", async () => {
  assert.equal(ASK_TIMEOUT_MS, 40_000);
  const hang = fakeFetch("hang");
  const started = performance.now();
  assert.equal(await askModel("work", hang.fetcher, 50), null);
  const took = performance.now() - started;
  assert.ok(took >= 40 && took < 2000, `${took} ms`);
  assert.equal(hang.calls.length, 1);
});

test("usableReply: copies only title and href from each source", () => {
  const reply = usableReply({ ...LLM, sources: [{ title: "Work", href: "/work", extra: "<script>" }] });
  assert.deepEqual(reply?.sources, [{ title: "Work", href: "/work" }]);
  assert.equal(usableReply("not an object"), null);
  assert.equal(usableReply(null), null);
});

test("components/ask-console.tsx asks GET once per mount and falls back to lib/ask.ts", () => {
  const src = readFileSync(join(ROOT, "components/ask-console.tsx"), "utf8");
  assert.match(src, /import \{ askModel, tierEnabled \} from "@\/lib\/ask-tier";/);
  assert.match(src, /useEffect\(\(\) => \{\s*tier\.current \?\?= tierEnabled\(\);\s*\}, \[\]\);/);
  assert.match(src, /\(await tier\.current\) \? await askModel\(query\) : null/);
  assert.match(src, /if \(!reply\) \{\s*try \{\s*reply = answer\(await index, query\);/);
  // the console never talks to the model's API by URL on its own
  assert.doesNotMatch(src, /fetch\(/);
});
