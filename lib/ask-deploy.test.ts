import assert from "node:assert/strict";
import { test } from "node:test";
import { bundleCarriesAskCall, chunkCarriesAskCall, chunkLinks, collectChunks, type Fetched } from "./ask-deploy.ts";

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
