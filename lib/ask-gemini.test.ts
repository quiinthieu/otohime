import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { AskIndex } from "./ask.ts";
import { completeGemini } from "./ask-gemini.ts";
import { AskProviderError, ASK_LIMITS, GEMINI_MODEL, MODEL, buildPrompt, handleGet, handlePost, llmEnabled, providerFor, topPassages, type AskEnv } from "./ask-llm.ts";

const index: AskIndex = JSON.parse(readFileSync(new URL("../public/ask-index.json", import.meta.url), "utf8"));
const origin = "https://otohime.dev";
const env: AskEnv = { ASK_LLM: "1", ASK_PROVIDER: "gemini", GEMINI_API_KEY: "test-key", BETTER_AUTH_URL: origin };
const params = buildPrompt("work", topPassages(index, "work"), GEMINI_MODEL);
const output = JSON.stringify({ lines: ["I build data pipelines."], cited: ["work"] });
const response = (text = output, finishReason = "STOP") => Response.json({
  candidates: [{ finishReason, content: { parts: [{ thought: true, text: "private thought" }, { text }] } }],
});

function request() {
  return new Request(`${origin}/api/ask`, { method: "POST", headers: { origin }, body: JSON.stringify({ question: "what stack do you use at work" }) });
}

function deps(fetcher: typeof fetch, config = env) {
  const counts = new Map<string, number>();
  return {
    env: config, index,
    store: { async hit(bucket: string) { const n = (counts.get(bucket) ?? 0) + 1; counts.set(bucket, n); return n; } },
    complete: (p: typeof params) => completeGemini(p, config.GEMINI_API_KEY!, fetcher),
  };
}

test("Gemini requires its selected provider, key and opt-in; existing Anthropic config still works", () => {
  assert.equal(providerFor({}), "anthropic");
  assert.equal(llmEnabled({ ASK_LLM: "1", ANTHROPIC_API_KEY: "a" }), true);
  assert.equal(llmEnabled(env), true);
  for (const config of [
    { ...env, ASK_LLM: undefined }, { ...env, GEMINI_API_KEY: undefined, ANTHROPIC_API_KEY: "a" },
    { ...env, ASK_PROVIDER: "unknown" }, { ...env, GEMINI_API_KEY: " " },
    { ASK_LLM: "1", GEMINI_API_KEY: "g" },
  ]) assert.equal(llmEnabled(config), false);
  assert.equal(handleGet({ env }).status, 200);
  assert.equal(buildPrompt("work", []).model, MODEL);
});

test("Gemini sends only the scoped prompt, schema and bounded output to a fixed Google endpoint", async () => {
  const message = await completeGemini(params, "test-key", async (url, init) => {
    assert.equal(url, `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`);
    assert.ok(!String(url).includes("test-key"));
    assert.equal(new Headers(init?.headers).get("x-goog-api-key"), "test-key");
    assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body));
    assert.deepEqual(body.systemInstruction, { parts: [{ text: params.system }] });
    assert.deepEqual(body.contents, [{ role: "user", parts: [{ text: params.messages[0].content }] }]);
    assert.equal(body.generationConfig.maxOutputTokens, params.max_tokens);
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.deepEqual(body.generationConfig.responseJsonSchema, params.output_config?.format?.schema);
    assert.ok(!body.tools && !body.cachedContent);
    return response();
  });
  assert.equal(message.stop_reason, "end_turn");
  assert.equal(message.content[0].text, output, "thought parts never reach the answer parser");
});

test("Gemini route maps citations and enforces the same hourly budget before calling Google", async () => {
  let calls = 0;
  const d = deps(async () => { calls++; return response(); });
  for (let i = 0; i < ASK_LIMITS.hour; i++) {
    const res = await handlePost(request(), d);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.mode, "llm");
    assert.deepEqual(body.sources, [{ title: "Work", href: "/work" }]);
  }
  const limited = await handlePost(request(), d);
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).mode, "offline");
  assert.equal(calls, ASK_LIMITS.hour);
});

test("Gemini failures, blocked or truncated output and unsupported citations fall back", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    for (const fetcher of [
      async () => new Response("sensitive upstream error", { status: 429 }),
      async () => new Response("unavailable", { status: 503 }),
      async () => { throw new Error("network error with test-key"); },
      async () => { throw new DOMException("timeout", "TimeoutError"); },
      async () => new Response("not JSON"),
      async () => Response.json({ promptFeedback: { blockReason: "SAFETY" } }),
      async () => response(output, "MAX_TOKENS"),
      async () => response(output, "SAFETY"),
      async () => response("not JSON"),
      async () => response(JSON.stringify({ lines: ["Unsupported."], cited: ["invented-id"] })),
    ]) {
      const body = await (await handlePost(request(), deps(fetcher))).json();
      assert.equal(body.mode, "offline");
      assert.equal(body.lines[0], "(OFFLINE)");
    }
    await assert.rejects(completeGemini(params, "test-key", async () => { throw new Error("test-key"); }),
      (error: unknown) => error instanceof AskProviderError && !error.message.includes("test-key"));
  } finally { console.error = original; }
});

test("ASK_MODEL overrides the Gemini default without sending an untrusted URL", async () => {
  const d = deps(async (url) => {
    assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/custom-model:generateContent");
    return response();
  }, { ...env, ASK_MODEL: "custom-model" });
  assert.equal((await (await handlePost(request(), d)).json()).mode, "llm");
});
