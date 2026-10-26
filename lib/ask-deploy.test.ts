import assert from "node:assert/strict";
import { test } from "node:test";
import {
  bundleCarriesAskCall,
  checkTierGet,
  checkTierPost,
  chunkCarriesAskCall,
  chunkLinks,
  collectChunks,
  inTierScope,
  tierOrigin,
  type Fetched,
} from "./ask-deploy.ts";

// Shaped like the minified chunk lib/ask-tier.ts lands in.
const ASK_CHUNK = 'let a="/api/ask",s=(e,t)=>fetch(a,{method:"POST",body:JSON.stringify({question:e}),signal:t});';
const PLAIN_CHUNK = 'e.v(t=>t("ink"));let o="/api/health";';

test("a chunk containing /api/ask carries the console call", () => {
  assert.equal(chunkCarriesAskCall(ASK_CHUNK), true);
  assert.equal(chunkCarriesAskCall("fetch('/api/ask?x=1')"), true);
  assert.equal(chunkCarriesAskCall('"api/ask"'), true);
  assert.equal(bundleCarriesAskCall([PLAIN_CHUNK, ASK_CHUNK]), true);
});

test("a chunk without /api/ask does not carry it", () => {
  assert.equal(chunkCarriesAskCall(PLAIN_CHUNK), false);
  assert.equal(chunkCarriesAskCall(""), false);
  assert.equal(bundleCarriesAskCall([PLAIN_CHUNK]), false);
});

test("an empty bundle does not carry the call", () => {
  assert.equal(bundleCarriesAskCall([]), false);
});

test("api/ask-old and other look-alikes are not the console call", () => {
  assert.equal(chunkCarriesAskCall('fetch("/api/ask-old")'), false);
  assert.equal(chunkCarriesAskCall('fetch("/api/asker")'), false);
  assert.equal(chunkCarriesAskCall('fetch("/xapi/ask")'), false);
  assert.equal(chunkCarriesAskCall('fetch("/api/ask_v2")'), false);
  assert.equal(bundleCarriesAskCall(['fetch("/api/ask-old")']), false);
});

test("chunkLinks reads HTML script links and a chunk's lazy-load table, deduplicated", () => {
  const html =
    '<script src="/_next/static/chunks/0a-b_c.js" async></script><link rel="preload" href="/_next/static/chunks/0a-b_c.js"/>' +
    '<script>self.__next_f.push([1,"\\"/_next/static/chunks/34u4x.js\\""])</script><link href="/_next/static/css/x.css"/>';
  assert.deepEqual(chunkLinks(html), ["/_next/static/chunks/0a-b_c.js", "/_next/static/chunks/34u4x.js"]);
  const lazy = 'e.v(t=>Promise.all(["static/chunks/28ruv.js"].map(t=>e.l(t))).then(()=>t(8169)))';
  assert.deepEqual(chunkLinks(lazy), ["/_next/static/chunks/28ruv.js"]);
});

// A site served from a map of path -> body; anything else is a 404. Records each URL fetched.
function fakeSite(files: Record<string, string>) {
  const urls: string[] = [];
  const fetchText = async (url: string): Promise<Fetched> => {
    urls.push(url);
    const path = new URL(url).pathname;
    return path in files ? { status: 200, text: files[path] } : { status: 404, text: "" };
  };
  return { urls, fetchText };
}

const HOME = '<script src="/_next/static/chunks/main.js"></script><script src="/_next/static/chunks/page.js"></script>';

test("collectChunks finds the call in a lazy chunk named only by a linked chunk", async () => {
  const site = fakeSite({
    "/": HOME,
    "/_next/static/chunks/main.js": PLAIN_CHUNK,
    "/_next/static/chunks/page.js": 'e.l("static/chunks/ask.js");e.l("static/chunks/main.js")',
    "/_next/static/chunks/ask.js": ASK_CHUNK,
  });
  const crawl = await collectChunks("http://127.0.0.1:3000/", site.fetchText);
  assert.equal(crawl.linked, 2);
  assert.equal(crawl.checked, 3);
  assert.equal(crawl.carrying, 1);
  assert.deepEqual(crawl.failed, []);
  assert.equal(crawl.truncated, false);
  assert.equal(bundleCarriesAskCall(crawl.chunks), true);
  // Each chunk is fetched once, even when named twice.
  assert.equal(site.urls.filter((u) => u.endsWith("/main.js")).length, 1);
  assert.equal(site.urls[0], "http://127.0.0.1:3000/");
});

test("collectChunks on a stale bundle (no chunk with the call) is false", async () => {
  const site = fakeSite({
    "/": HOME,
    "/_next/static/chunks/main.js": PLAIN_CHUNK,
    "/_next/static/chunks/page.js": 'fetch("/api/ask-old")',
  });
  const crawl = await collectChunks("http://127.0.0.1:3000", site.fetchText);
  assert.equal(crawl.checked, 2);
  assert.equal(crawl.carrying, 0);
  assert.equal(bundleCarriesAskCall(crawl.chunks), false);
});

test("collectChunks reports chunks that fail, stops at its limit and refuses a page that is not 200", async () => {
  const site = fakeSite({ "/": HOME, "/_next/static/chunks/main.js": 'e.l("static/chunks/more.js")' });
  const crawl = await collectChunks("http://h", site.fetchText);
  assert.deepEqual(crawl.failed, ["/_next/static/chunks/page.js", "/_next/static/chunks/more.js"]);
  assert.equal(crawl.checked, 1);

  const capped = await collectChunks("http://h", fakeSite({ "/": HOME }).fetchText, 1);
  assert.equal(capped.truncated, true);

  await assert.rejects(collectChunks("http://h", fakeSite({}).fetchText), /answered 404/);
});

const LLM = { mode: "llm", intent: "search", lines: ["I BUILD PIPELINES.", "SEE WORK."], sources: [{ title: "Work", href: "/work" }] };

test("the tier GET passes only for a 200 whose body has enabled:true", () => {
  assert.equal(checkTierGet(200, JSON.stringify({ enabled: true, limits: { hour: 10, day: 150 } })).ok, true);
  assert.equal(checkTierGet(404, "Not Found").ok, false);
  assert.equal(checkTierGet(200, JSON.stringify({ enabled: false })).ok, false);
  assert.equal(checkTierGet(200, JSON.stringify({ enabled: "true" })).ok, false);
  assert.equal(checkTierGet(200, "<html>enabled:true</html>").ok, false);
  assert.equal(checkTierGet(503, JSON.stringify({ enabled: true })).ok, false);
});

test("the tier POST passes for model lines that cite /work, /projects or /notes", () => {
  const r = checkTierPost(200, JSON.stringify(LLM));
  assert.equal(r.ok, true, r.detail);
  assert.equal(r.lines, 2);
  assert.deepEqual(r.cited, ["/work"]);
  const many = { ...LLM, sources: [{ title: "P", href: "/projects/shore" }, { title: "N", href: "/notes#ink" }] };
  assert.equal(checkTierPost(200, JSON.stringify(many)).ok, true);
});

test("the tier POST misses on an offline reply, a refusal, no lines, no citation or an off-scope link", () => {
  const offline = { ...LLM, mode: "offline", lines: ["(OFFLINE)", "SHORE."] };
  assert.equal(checkTierPost(200, JSON.stringify(offline)).ok, false);
  assert.equal(checkTierPost(429, JSON.stringify(offline)).ok, false);
  assert.equal(checkTierPost(200, JSON.stringify({ ...LLM, lines: ["(OFFLINE)"] })).ok, false);
  assert.equal(checkTierPost(429, JSON.stringify(LLM)).ok, false);
  assert.equal(checkTierPost(403, JSON.stringify({ error: "origin" })).ok, false);
  assert.equal(checkTierPost(404, "Not Found").ok, false);
  assert.equal(checkTierPost(200, "not json").ok, false);
  assert.equal(checkTierPost(200, JSON.stringify({ ...LLM, lines: [" ", ""] })).ok, false);
  assert.equal(checkTierPost(200, JSON.stringify({ ...LLM, sources: [] })).ok, false);
  for (const href of ["/shore", "/workshop", "https://otohime.dev/work", "//evil.example/work"]) {
    const r = checkTierPost(200, JSON.stringify({ ...LLM, sources: [{ title: "X", href }] }));
    assert.equal(r.ok, false, href);
    assert.match(r.detail, /outside/);
  }
  assert.equal(checkTierPost(200, JSON.stringify({ ...LLM, sources: [{ title: "W", href: "/work" }, { title: "S", href: "/shore" }] })).ok, false);
});

test("the probe's Origin is the site's own origin, as the route compares it", () => {
  assert.equal(tierOrigin("https://otohime.dev"), "https://otohime.dev");
  assert.equal(tierOrigin("https://otohime.dev/"), "https://otohime.dev");
  assert.equal(tierOrigin("http://localhost:4091/x"), "http://localhost:4091");
  assert.equal(inTierScope("/work"), true);
  assert.equal(inTierScope("/notes/ink"), true);
  assert.equal(inTierScope("/"), false);
});
