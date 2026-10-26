import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";
import {
  bundleCarriesAskCall,
  checkTierGet,
  checkTierPost,
  chunkCarriesAskCall,
  chunkLinks,
  collectChunks,
  inTierScope,
  probeTierLive,
  tierOrigin,
  TIER_QUESTION,
  type Fetched,
  type TierRequest,
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

// A server shaped like app/api/ask/route.ts with the tier on: GET says enabled, POST answers only the site's own
// Origin (403 otherwise), and pages answer 200. `reply` and `get` override the tier's answers; every call is kept.
function fakeTier(opts: { get?: Fetched; reply?: Fetched; pages?: Record<string, number>; origin?: string } = {}) {
  const calls: { method: string; url: string; origin?: string; body?: string }[] = [];
  const request: TierRequest = async (method, url, o = {}) => {
    calls.push({ method, url, origin: o.origin, body: o.body });
    const path = new URL(url).pathname;
    if (path === "/api/ask" && method === "GET") return opts.get ?? { status: 200, text: JSON.stringify({ enabled: true, limits: { hour: 10, day: 150 } }) };
    if (path === "/api/ask") {
      if (o.origin !== (opts.origin ?? "https://otohime.dev")) return { status: 403, text: JSON.stringify({ error: "origin" }) };
      return opts.reply ?? { status: 200, text: JSON.stringify(LLM) };
    }
    return { status: opts.pages?.[path] ?? 200, text: "<html></html>" };
  };
  return { request, calls, posts: () => calls.filter((c) => c.method === "POST") };
}
const named = (r: { checks: { name: string; ok: boolean }[] }) => r.checks.map((c) => `${c.ok ? "ok" : "not ok"} - ${c.name}`);

test("probeTierLive, tier on: GET, exactly one POST with the site's Origin and the fixed question, then each cited page", async () => {
  const site = fakeTier();
  const r = await probeTierLive("https://otohime.dev/", site.request);
  assert.deepEqual(named(r), [
    "ok - GET /api/ask is 200 with enabled:true",
    "ok - POST /api/ask (Origin https://otohime.dev) answers with cited model lines",
    "ok - the cited page /work answers 200",
  ]);
  assert.deepEqual(site.calls.map((c) => `${c.method} ${c.url}`), [
    "GET https://otohime.dev/api/ask",
    "POST https://otohime.dev/api/ask",
    "GET https://otohime.dev/work",
  ]);
  assert.equal(site.posts().length, 1);
  assert.equal(r.posts, 1);
  assert.equal(site.posts()[0].origin, "https://otohime.dev");
  assert.deepEqual(JSON.parse(site.posts()[0].body ?? ""), { question: TIER_QUESTION });
  assert.equal(r.lines, 2);
  assert.equal(r.cited, 1);

  // Duplicate citations are fetched once; a cited page that 404s is a miss.
  const dup = { ...LLM, sources: [{ title: "W", href: "/work" }, { title: "W2", href: "/work" }, { title: "N", href: "/notes/ink" }] };
  const site2 = fakeTier({ reply: { status: 200, text: JSON.stringify(dup) }, pages: { "/notes/ink": 404 } });
  const r2 = await probeTierLive("https://otohime.dev", site2.request);
  assert.deepEqual(site2.calls.filter((c) => c.method === "GET").map((c) => new URL(c.url).pathname), ["/api/ask", "/work", "/notes/ink"]);
  assert.deepEqual(named(r2).slice(2), ["ok - the cited page /work answers 200", "not ok - the cited page /notes/ink answers 200"]);
  assert.equal(r2.cited, 3);
});

test("probeTierLive, tier off or unreachable: the GET misses and no POST is sent", async () => {
  for (const get of [{ status: 404, text: "Not Found" }, { status: 200, text: JSON.stringify({ enabled: false }) }, { status: 503, text: "{}" }]) {
    const site = fakeTier({ get });
    const r = await probeTierLive("https://otohime.dev", site.request);
    assert.equal(site.posts().length, 0, get.text);
    assert.equal(r.posts, 0);
    assert.deepEqual(named(r), ["not ok - GET /api/ask is 200 with enabled:true", "not ok - POST /api/ask answers with cited model lines"]);
    assert.match(r.checks[1].detail, /^not sent/);
  }
  const down: TierRequest = async () => {
    throw new Error("connect ECONNREFUSED");
  };
  const r = await probeTierLive("https://otohime.dev", down);
  assert.equal(r.checks[0].ok, false);
  assert.match(r.checks[0].detail, /ECONNREFUSED/);
  assert.equal(r.posts, 0);
});

test("probeTierLive misses on an (OFFLINE) reply, an off-site citation, a 429, a wrong Origin or a POST that throws", async () => {
  const offline = { ...LLM, mode: "offline", lines: ["(OFFLINE)", "SHORE."] };
  const cases: [string, Parameters<typeof fakeTier>[0], RegExp][] = [
    ["(OFFLINE)", { reply: { status: 200, text: JSON.stringify(offline) } }, /mode "offline"/],
    ["off-site", { reply: { status: 200, text: JSON.stringify({ ...LLM, sources: [{ title: "X", href: "https://evil.example/work" }] }) } }, /outside/],
    ["429", { reply: { status: 429, text: JSON.stringify(offline) } }, /status 429/],
    ["origin", { origin: "https://www.otohime.dev" }, /status 403/],
  ];
  for (const [name, opts, why] of cases) {
    const site = fakeTier(opts);
    const r = await probeTierLive("https://otohime.dev", site.request);
    assert.equal(site.posts().length, 1, name);
    assert.deepEqual(named(r), ["ok - GET /api/ask is 200 with enabled:true", "not ok - POST /api/ask (Origin https://otohime.dev) answers with cited model lines"], name);
    assert.match(r.checks[1].detail, why, name);
    assert.equal(site.calls.length, 2, `${name}: no cited page is fetched after a miss`);
  }
  const site = fakeTier();
  const throwing: TierRequest = (method, url, o) => (method === "POST" ? Promise.reject(new Error("socket hang up")) : site.request(method, url, o));
  const r = await probeTierLive("https://otohime.dev", throwing);
  assert.equal(r.checks[1].ok, false);
  assert.equal(r.posts, 1);
});

// The scripts run what is tested above, and the checks that gate this task cover these files.
const repo = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("probe-ask-tier runs probeTierLive for its live requests, read-only, from an executable wrapper", () => {
  const mjs = repo("scripts/probe-ask-tier.mjs");
  assert.match(mjs, /import \{[^}]*\bprobeTierLive\b[^}]*\} from "\.\.\/lib\/ask-deploy\.ts"/);
  assert.match(mjs, /probeTierLive\(BASE_URL, request, ORIGIN\)/);
  assert.doesNotMatch(mjs, /request\("POST"/, "the only POST is probeTierLive's");
  assert.match(mjs, /process\.exit\(failed === 0 && ok > 0 \? 0 : 1\)/);
  const sh = repo("scripts/probe-ask-tier.sh");
  assert.ok((statSync(new URL("../scripts/probe-ask-tier.sh", import.meta.url)).mode & 0o111) !== 0, "probe-ask-tier.sh is not executable");
  assert.match(sh, /scripts\/probe-ask-tier\.mjs/);
  const code = (text: string, comment: string) => text.split("\n").filter((l) => !l.trimStart().startsWith(comment)).join("\n");
  for (const text of [code(mjs, "//"), code(sh, "#")]) assert.doesNotMatch(text, /\bvercel\b|ASK_LLM|ANTHROPIC_API_KEY/, "the probe never sets env or deploys");
});

test("probe-ask-llm-fake runs the tier probe on, on with a non-JSON fake, and off, with fixed tallies", () => {
  const sh = repo("scripts/probe-ask-llm-fake.sh");
  for (const phase of ["on", "on-control", "off"]) assert.equal(sh.split(`tier_probe ${phase}\n`).length - 1, 1, phase);
  assert.match(sh, /scripts\/probe-ask-tier\.sh/);
  assert.match(sh, /fake_mode nonjson\n\s*tier_probe on-control/);
  assert.match(sh, /TIER_VERDICTS_WANT=\d+/);
  for (const summary of ["30 ok, 0 failed", "28 ok, 1 failed", "27 ok, 2 failed"]) assert.ok(sh.includes(`"${summary}"`), summary);
});

test("npm test and the typecheck cover lib/ask-deploy.ts and its tests, with nothing skipped", () => {
  const pkg = JSON.parse(repo("package.json")) as { scripts: Record<string, string> };
  assert.ok(pkg.scripts.test.includes("'lib/**/*.test.ts'"), pkg.scripts.test);
  assert.match(pkg.scripts.typecheck, /tsc --noEmit/);
  const ts = JSON.parse(repo("tsconfig.json")) as { compilerOptions: { strict?: boolean }; include: string[]; exclude?: string[] };
  assert.equal(ts.compilerOptions.strict, true);
  assert.ok(ts.include.includes("**/*.ts"));
  // ghosts/worker is the Cloudflare Worker package, typechecked against workerd types by its own `npm run typecheck`.
  assert.deepEqual(ts.exclude ?? [], ["node_modules", "ghosts/worker"]);
  const self = repo("lib/ask-deploy.test.ts");
  const banned = ["test" + ".only(", "test" + ".skip(", "test" + ".todo(", "{ skip" + ":", "{ only" + ":", "@ts-" + "ignore", "@ts-" + "nocheck"];
  for (const file of [self, repo("lib/ask-deploy.ts")]) for (const b of banned) assert.ok(!file.includes(b), b);
});
