// The fake-model Ask probe: the console driven through the model tier against a fake Anthropic server. Run by
// scripts/probe-ask-llm-fake.sh, which starts every piece and passes the URLs in. Two entry points:
//
//   node probe-ask-llm-fake.mjs fake-anthropic <portfile>   # the fake model, until killed
//   node --experimental-strip-types probe-ask-llm-fake.mjs on|off   # Chromium over the console
//
// The fake answers POST /v1/messages the way the SDK expects: in mode "json" a message whose text is FAKE_REPLY,
// in mode "nonjson" an HTTP 200 text/html page, in mode "badtext" a well-formed message whose text is not JSON.
// It records every request (key, model, the passage ids in the prompt, the question); GET /__probe/requests reads
// that log and POST /__probe/mode?m=<mode> switches the mode. It never calls out.
//
// on (ASK_LLM=1): at 1366x768 and 390x844 (touch) the console asks GET /api/ask once, sends exactly one POST per
// question, and the fake's lines print with a link to /work that answers 200; the fake saw exactly one request
// per question, with the fake key, the Haiku model and the Work passage in the prompt. Negative controls: a
// non-JSON fake reply (and, at 1366, a non-JSON model text) prints the offline answer from lib/ask.ts under the
// server's (OFFLINE) line, with no error shown; a cross-origin POST is 403 and reaches no model, while the same
// POST from the site's origin is 200. on also checks the usage store wrote to the throwaway Postgres.
// off (ASK_LLM unset, key still set): GET /api/ask is 404, a question at each width sends no POST, the
// local canned answer prints, and the fake sees nothing.
// Chromium logs a 404 or aborted fetch as a console error ("Failed to load resource"); for /api/ask in the off
// run that is the switch working, so only those lines are left out of the error check.
import http from "node:http";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const QUESTION = "what do you build?";
export const WORK_ID = "work";
export const FAKE_LINES = ["FAKE MODEL: I BUILD BATCH AND STREAM PIPELINES.", "FAKE MODEL: SEE THE WORK PAGE."];
const FAKE_REPLY = { lines: FAKE_LINES, cited: [WORK_ID] };
const MODEL = "claude-haiku-5-5";

const mode = process.argv[2];
if (mode === "fake-anthropic") fakeAnthropic(process.argv[3]);
else if (mode === "on" || mode === "off") await probe(mode);
else {
  console.error("usage: probe-ask-llm-fake.mjs fake-anthropic <portfile> | on | off");
  process.exit(2);
}

function fakeAnthropic(portfile) {
  const log = [];
  let replyMode = "json";
  const message = (text) => ({
    id: `msg_probe_${log.length}`,
    type: "message",
    role: "assistant",
    model: MODEL,
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  });
  const send = (res, status, type, body) => {
    res.writeHead(status, { "content-type": type });
    res.end(body);
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://fake");
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      if (req.method === "GET" && url.pathname === "/__probe/requests") return send(res, 200, "application/json", JSON.stringify(log));
      if (req.method === "POST" && url.pathname === "/__probe/mode") {
        replyMode = url.searchParams.get("m") ?? "json";
        return send(res, 200, "application/json", JSON.stringify({ mode: replyMode }));
      }
      if (req.method !== "POST" || url.pathname !== "/v1/messages") return send(res, 404, "text/plain", "not found");
      let body = {};
      try {
        body = JSON.parse(raw);
      } catch {
        // recorded as an empty body
      }
      const user = typeof body.messages?.[0]?.content === "string" ? body.messages[0].content : "";
      const bearer = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      log.push({
        mode: replyMode,
        key: req.headers["x-api-key"] ?? bearer,
        model: body.model ?? null,
        ids: [...user.matchAll(/<passage id="([^"]*)"/g)].map((m) => m[1]),
        question: user.match(/<question>([\s\S]*)<\/question>/)?.[1] ?? null,
      });
      if (replyMode === "nonjson") return send(res, 200, "text/html", "<html><body>not json</body></html>");
      if (replyMode === "badtext") return send(res, 200, "application/json", JSON.stringify(message("I am not JSON at all.")));
      return send(res, 200, "application/json", JSON.stringify(message(JSON.stringify(FAKE_REPLY))));
    });
  });
  server.listen(0, "127.0.0.1", () => fs.writeFileSync(portfile, String(server.address().port)));
  for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => server.close(() => process.exit(0)));
}

async function probe(phase) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
  const { chromium } = require("playwright");
  // The offline answer the route and the console both fall back to, computed here from the same source.
  const { answer } = await import(path.join(ROOT, "lib/ask.ts"));

  const BASE_URL = process.env.BASE_URL;
  const FAKE_URL = process.env.FAKE_URL;
  const FAKE_KEY = process.env.FAKE_KEY;
  const DATABASE_URL = process.env.DATABASE_URL;
  const PHONE = { width: 390, height: 844 };
  const DESKTOP = { width: 1366, height: 768 };
  const DIALOG = "dialog.ask-console";
  const OUT = `${DIALOG} .ask-out`;
  const API = "/api/ask";
  const SCOPE = new Set(["/work", "/projects", "/notes"]);

  let ok = 0;
  let failed = 0;
  const check = (name, pass, detail = "") => {
    if (pass) {
      ok++;
      console.log(`ok - ${phase}: ${name}`);
    } else {
      failed++;
      console.log(`not ok - ${phase}: ${name}${detail ? `: ${detail}` : ""}`);
    }
  };
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const squash = (s) => s.replace(/\s+/g, "");
  const same = (a, b) => JSON.stringify(a.map(squash)) === JSON.stringify(b.map(squash));
  const looksLikeError = (text) => /error|fail|did not load|went wrong|try again/i.test(text);

  const fakeLog = async () => (await fetch(`${FAKE_URL}/__probe/requests`)).json();
  const fakeMode = async (m) => {
    const r = await fetch(`${FAKE_URL}/__probe/mode?m=${m}`, { method: "POST" });
    if (!r.ok) throw new Error(`fake mode ${m}: ${r.status}`);
  };

  // A POST to the app with any Origin header (fetch would not let us forge one).
  const post = (origin, body) =>
    new Promise((resolve, reject) => {
      const req = http.request(`${BASE_URL}${API}`, { method: "POST", headers: { origin, "content-type": "application/json" } }, (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ status: res.statusCode, text }));
      });
      req.on("error", reject);
      req.end(body);
    });

  const index = await (await fetch(`${BASE_URL}/ask-index.json`)).json();
  const canned = answer(index, QUESTION);

  const errors = [];
  const browser = await chromium.launch();

  // One page: open the chip, ask QUESTION, wait for the receipt to finish typing, report what printed and sent.
  async function ask(viewport, { reduced }) {
    const phone = viewport === PHONE;
    const context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, reducedMotion: reduced ? "reduce" : "no-preference" });
    const page = await context.newPage();
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      const at = m.location()?.url ?? "";
      const api = at.startsWith("http") && new URL(at).pathname === API;
      if (phase === "off" && api && m.text().startsWith("Failed to load resource")) return;
      errors.push(`console ${page.url()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
    const net = { get: [], post: [] };
    page.on("response", async (r) => {
      if (new URL(r.url()).pathname !== API) return;
      const entry = { status: r.status(), body: await r.text().catch(() => ""), sent: r.request().postData() };
      (r.request().method() === "POST" ? net.post : net.get).push(entry);
    });
    try {
      await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
      const chip = page.getByRole("button", { name: "Ask the console" });
      if (phone) await chip.tap();
      else await chip.click();
      await page.waitForSelector(`${DIALOG}[open]`, { timeout: 10000 });
      // The tier's GET is answered before the question goes, so the question takes the path under test.
      for (let i = 0; i < 50 && net.get.length === 0; i++) await sleep(100);
      await page.locator("#ask-q").fill(QUESTION);
      await page.locator("#ask-q").press("Enter");
      let state = null;
      for (let t = 0; t < 25000; t += 100) {
        await sleep(100);
        state = await page.evaluate((out) => {
          const receipt = document.querySelector(`${out} .ask-receipt`);
          const rows = [...document.querySelectorAll(`${out} .ask-row`)];
          return {
            total: Number(receipt?.dataset.total ?? -1),
            chars: rows.reduce((n, r) => n + r.textContent.length, 0),
            short: rows.filter((r) => r.textContent.length < Number(r.dataset.n)).length,
          };
        }, OUT);
        if (state.total > 0 && state.chars === state.total && state.short === 0) break;
      }
      await sleep(300);
      const lines = await page.evaluate((out) => [...document.querySelectorAll(`${out} .ask-receipt > p:not(.ask-echo)`)].map((p) => p.textContent), OUT);
      const hrefs = await page.locator(`${OUT} a[href]`).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
      const text = (await page.locator(DIALOG).textContent()) ?? "";
      let opened = null;
      if (hrefs.length > 0) {
        const link = page.locator(`${OUT} a[href]`).first();
        if (phone) await link.tap();
        else await link.click();
        await page.waitForURL((u) => u.pathname === hrefs[0], { timeout: 10000 }).catch(() => {});
        opened = new URL(page.url()).pathname;
      }
      return { state, lines, hrefs, text, net, opened };
    } finally {
      await context.close();
    }
  }

  try {
    const before = await fakeLog();
    if (phase === "on") {
      const get = await fetch(`${BASE_URL}${API}`);
      const getBody = await get.text();
      check("GET /api/ask is 200 enabled:true (ASK_LLM=1, fake key)", get.status === 200 && getBody.includes('"enabled":true'), `${get.status} ${getBody}`);

      let seen = before.length;
      for (const viewport of [DESKTOP, PHONE]) {
        const size = viewport === PHONE ? "390x844 touch" : "1366x768";

        // Positive: the fake model's answer, through console, route and SDK.
        await fakeMode("json");
        const r = await ask(viewport, { reduced: false });
        const log = await fakeLog();
        const fresh = log.slice(seen);
        seen = log.length;
        const llm = (() => {
          try {
            return JSON.parse(r.net.post[0]?.body ?? "");
          } catch {
            return null;
          }
        })();
        check(`${size}: the console asks GET /api/ask once`, r.net.get.length === 1 && r.net.get[0].status === 200, JSON.stringify(r.net.get));
        check(`${size}: one question sends exactly one POST /api/ask with {question}`, r.net.post.length === 1 && r.net.post[0].sent === JSON.stringify({ question: QUESTION }), JSON.stringify(r.net.post));
        check(`${size}: the route answers 200 in mode llm`, r.net.post[0]?.status === 200 && llm?.mode === "llm", r.net.post[0]?.body);
        check(`${size}: the fake model got exactly one request for it`, fresh.length === 1 && fresh[0].mode === "json", JSON.stringify(fresh));
        check(
          `${size}: that request carried the fake key, the Haiku model, the question and the Work passage`,
          fresh.length === 1 && fresh[0].key === FAKE_KEY && fresh[0].model === MODEL && fresh[0].question === QUESTION && fresh[0].ids.includes(WORK_ID),
          JSON.stringify(fresh),
        );
        check(`${size}: the receipt prints the fake model's lines, and only those`, same(r.lines, FAKE_LINES), JSON.stringify(r.lines));
        check(`${size}: the citation is one link, to /work, /projects or /notes`, r.hrefs.length === 1 && SCOPE.has(r.hrefs[0]) && r.hrefs[0] === "/work", JSON.stringify(r.hrefs));
        const linked = r.hrefs[0] ? (await fetch(`${BASE_URL}${r.hrefs[0]}`)).status : null;
        check(`${size}: the cited page answers 200`, linked === 200, String(linked));
        check(`${size}: the citation link opens its page`, r.opened === r.hrefs[0], String(r.opened));
        check(`${size}: control: the fake model's lines fail the offline-answer check`, !same(r.lines, ["(OFFLINE)", ...canned.lines]), JSON.stringify(r.lines));

        // Negative control: the fake returns a non-JSON body; the console prints the offline answer, no error.
        const variants = [["a non-JSON fake reply", "nonjson"]];
        if (viewport === DESKTOP) variants.push(["a fake message whose text is not JSON", "badtext"]);
        for (const [name, m] of variants) {
          await fakeMode(m);
          const n = await ask(viewport, { reduced: true });
          const nlog = await fakeLog();
          const nfresh = nlog.slice(seen);
          seen = nlog.length;
          const body = (() => {
            try {
              return JSON.parse(n.net.post[0]?.body ?? "");
            } catch {
              return null;
            }
          })();
          check(`${size}, ${name}: one POST, and the fake model was asked once`, n.net.post.length === 1 && nfresh.length === 1 && nfresh[0].mode === m, JSON.stringify({ post: n.net.post.length, fresh: nfresh }));
          check(`${size}, ${name}: the route answers 200 in mode offline`, n.net.post[0]?.status === 200 && body?.mode === "offline", n.net.post[0]?.body);
          check(`${size}, ${name}: the receipt prints the offline answer under (OFFLINE)`, same(n.lines, ["(OFFLINE)", ...canned.lines]), JSON.stringify({ got: n.lines, want: canned.lines }));
          check(`${size}, ${name}: its links are the offline answer's pages`, JSON.stringify(n.hrefs) === JSON.stringify(canned.sources.map((s) => s.href)), JSON.stringify(n.hrefs));
          check(`${size}, ${name}: no error shows`, !looksLikeError(n.text), n.text.slice(0, 200));
        }
      }
      await fakeMode("json");

      // A cross-origin POST is refused before any budget or model is spent; the same POST from the site is not.
      const q = JSON.stringify({ question: QUESTION });
      const n0 = (await fakeLog()).length;
      const cross = await post("https://evil.example", q);
      const n1 = (await fakeLog()).length;
      check("a cross-origin POST /api/ask is 403", cross.status === 403, `${cross.status} ${cross.text.slice(0, 120)}`);
      check("the cross-origin POST reached no model", n1 === n0, `${n1 - n0} requests`);
      const own = await post(new URL(BASE_URL).origin, q);
      const n2 = (await fakeLog()).length;
      check("control: the same POST from the site's origin is 200 and reaches the fake", own.status === 200 && own.text.includes('"mode":"llm"') && n2 === n1 + 1, `${own.status} ${own.text.slice(0, 120)}`);

      const total = (await fakeLog()).length;
      check("the fake Anthropic server recorded requests", total > 0, `${total}`);

      // The rate-limit buckets live in the throwaway Postgres: the route really used it.
      const { Client } = createRequire(path.join(ROOT, "package.json"))("pg");
      const db = new Client({ connectionString: DATABASE_URL });
      await db.connect();
      const { rows } = await db.query("select bucket, count from ask_usage order by bucket");
      await db.end();
      const day = rows.find((row) => row.bucket.startsWith("day:"));
      check("the usage store counted every model-tier POST in the throwaway Postgres", day?.count === 6, JSON.stringify(rows));
    } else {
      const get = await fetch(`${BASE_URL}${API}`);
      check("GET /api/ask is 404 (ASK_LLM unset, key still set)", get.status === 404, String(get.status));
      for (const viewport of [DESKTOP, PHONE]) {
        const size = viewport === PHONE ? "390x844 touch" : "1366x768";
        const r = await ask(viewport, { reduced: true });
        check(`${size}: the console asks GET /api/ask once and gets 404`, r.net.get.length === 1 && r.net.get[0].status === 404, JSON.stringify(r.net.get));
        check(`${size}: the console sends no POST /api/ask`, r.net.post.length === 0, `${r.net.post.length} POSTs`);
        check(`${size}: the receipt prints the local canned answer`, same(r.lines, canned.lines), JSON.stringify(r.lines));
        check(`${size}: no error shows`, !looksLikeError(r.text), r.text.slice(0, 200));
      }
      const after = await fakeLog();
      check("the fake Anthropic server saw no request while the switch was off", after.length === before.length, `${after.length - before.length} requests`);
    }
    check("no console errors or page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  } catch (error) {
    check("probe ran to the end", false, error?.stack ?? String(error));
  } finally {
    await browser.close();
  }

  console.log(`probe ${phase}: ${ok} ok, ${failed} failed`);
  process.exit(failed === 0 && ok > 0 ? 0 : 1);
}
