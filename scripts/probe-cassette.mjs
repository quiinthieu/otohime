// Drives headless Chromium over Music's Now playing shelf. Run by scripts/probe-cassette.sh, which installs
// Playwright into PW_PREFIX and passes BASE_URL and FACE.
//
//   FACE=quiet  the server has no provider configured: both labels are the quiet face.
//   FACE=live   the server reads loopback fakes (probe-cassette.sh starts them) that answer the longest track and
//               game the parsers let through, with the track playing: the reels turn, unless motion is reduced.
//   SENTINELS   comma-separated secrets the server was given; no response the browser receives may contain one.
//
// Real: Chromium's layout, fonts, colours, media queries, keyboard focus and a JavaScript-off load. Fake (FACE=live
// only): the providers, which are loopback servers. Long text is the cap from lib/now-playing-data.ts. What is read
// back is what a visitor meets: the label's box and its words' boxes, computed colours, the focus ring, the reels'
// running animations and the HTML and scripts the page loaded.
//
// Negative controls, each on the same assertion it guards: labels forced to one unbroken line overflow; the label's
// text greyed out fails contrast; removing data-spin stops the reels. Each is undone and the check passes again.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { LIMITS } from "../lib/now-playing-data.ts";


const BASE_URL = process.env.BASE_URL;
const FACE = ["live", "brainz", "last", "lanyard"].includes(process.env.FACE) ? process.env.FACE : "quiet";
const SHOTS_DIR = process.env.SHOTS_DIR || "";
const SENTINELS = (process.env.SENTINELS || "").split(",").filter(Boolean);
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
// The fakes' longest answers (probe-cassette.sh): exactly at the caps, so the label is at its fullest.
const LONG_TITLE = `${"W".repeat(LIMITS.title - 1)}…`;
const LONG_GAME = `${"M".repeat(LIMITS.game - 1)}…`;

let ok = 0;
let failed = 0;
function check(name, pass, detail = "") {
  if (pass) {
    ok++;
    console.log(`ok - ${name}`);
  } else {
    failed++;
    console.log(`not ok - ${name}${detail ? `: ${detail}` : ""}`);
  }
}

const errors = [];
const bodies = [];

async function open(browser, { viewport = DESKTOP, dark = false, reduced = false, js = true } = {}) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({
    viewport,
    isMobile: phone,
    hasTouch: phone,
    colorScheme: dark ? "dark" : "light",
    reducedMotion: reduced ? "reduce" : "no-preference",
    javaScriptEnabled: js,
  });
  // Nothing leaves the machine: a third-party request (YouTube's player API for the television) gets an empty 200.
  const origin = new URL(BASE_URL).origin;
  await context.route(
    (url) => url.origin !== origin,
    (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console ${page.url()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  page.on("response", async (res) => {
    const type = res.headers()["content-type"] || "";
    if (!/html|javascript|json|text\/x-component|css/.test(type)) return;
    try {
      bodies.push({ url: res.url(), text: await res.text() });
    } catch {
      // a redirect or an aborted request has no body to scan
    }
  });
  await page.goto(`${BASE_URL}/music`, { waitUntil: "load" });
  return { context, page };
}

async function shot(page, name) {
  if (!SHOTS_DIR) return;
  mkdirSync(SHOTS_DIR, { recursive: true });
  await page.locator("[data-now-playing]").screenshot({ path: path.join(SHOTS_DIR, `${name}.png`) });
}

// Everything the checks read, in one pass in the page.
async function measure(page) {
  return page.evaluate(() => {
    const parse = (c) => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(c);
      if (m) return { rgb: [+m[1], +m[2], +m[3]], a: m[4] === undefined ? 1 : +m[4] };
      const s = /color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)/.exec(c);
      if (s) return { rgb: [s[1] * 255, s[2] * 255, s[3] * 255], a: s[4] === undefined ? 1 : +s[4] };
      return null;
    };
    const lum = ([r, g, b]) => {
      const f = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a, b) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
      return (x + 0.05) / (y + 0.05);
    };
    const background = (el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.5) return c.rgb;
      }
      return [255, 255, 255];
    };
    const contrast = (el) => {
      const c = parse(getComputedStyle(el).color);
      return c ? ratio(c.rgb, background(el)) : 0;
    };
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const section = document.querySelector("[data-now-playing]");
    const labels = [...document.querySelectorAll(".np-label")].map((label) => {
      const outer = box(label);
      const parts = [...label.children].map((el) => ({ cls: el.className, text: el.textContent, ...box(el), contrast: contrast(el) }));
      return {
        cls: label.className,
        ...outer,
        clipped: label.scrollHeight > label.clientHeight + 1 || label.scrollWidth > label.clientWidth + 1,
        spill: parts.filter((p) => p.right > outer.right + 0.5 || p.bottom > outer.bottom + 0.5 || p.left < outer.left - 0.5).map((p) => p.cls),
        minContrast: Math.min(...parts.map((p) => p.contrast)),
        parts,
      };
    });
    const credit = document.querySelector("[data-now-playing-credit]");
    const reels = [...document.querySelectorAll(".reel")];
    return {
      present: Boolean(section),
      visible: section ? section.getBoundingClientRect().height > 0 && getComputedStyle(section).visibility !== "hidden" : false,
      face: document.querySelector(".tape")?.dataset.face,
      cart: document.querySelector(".game-cart")?.dataset.face,
      spin: document.querySelector(".tape")?.hasAttribute("data-spin"),
      text: section?.innerText ?? "",
      creditLinks: [...credit.querySelectorAll("a")].map(a => a.href),
      gameSide: document.querySelector(".game-cart .np-side")?.textContent ?? "",
      overflowX: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth,
      labels,
      creditContrast: credit ? Math.min(...[credit, ...credit.querySelectorAll("a, time")].map(contrast)) : 0,
      running: reels.flatMap((r) => r.getAnimations()).filter((a) => a.playState === "running").length,
      links: [...section.querySelectorAll(".np-link")].map((a) => ({ href: a.href, ...box(a) })),
    };
  });
}

const fits = (m) => m.labels.length === 2 && m.labels.every((l) => !l.clipped && l.spill.length === 0) && m.overflowX <= 0;
const legible = (m) => m.labels.every((l) => l.minContrast >= 4.5) && m.creditContrast >= 4.5;
const fitDetail = (m) =>
  JSON.stringify({ overflowX: m.overflowX, labels: m.labels.map((l) => ({ cls: l.cls, h: l.height, clipped: l.clipped, spill: l.spill })) });

// Fills both labels to their caps in the DOM (the words a provider could put there at most), to show the reserved
// space holds them. FACE=live gets these from the fakes, through the parsers, instead.
async function fillToCaps(page) {
  await page.evaluate(
    ({ title, game }) => {
      const set = (sel, text) => document.querySelectorAll(sel).forEach((el) => (el.textContent = text));
      set('.tape [data-label="title"]', title);
      set('.tape [data-label="sub"]', `${"A".repeat(62)}…`);
      set('.game-cart [data-label="game"]', game);
    },
    { title: LONG_TITLE, game: LONG_GAME },
  );
}

async function viewing(browser, name, opts) {
  const { context, page } = await open(browser, opts);
  await page.locator("[data-now-playing]").scrollIntoViewIfNeeded();
  const m = await measure(page);
  check(`${name}: the shelf is on the page`, m.present && m.visible);
  if (FACE === "quiet") {
    check(`${name}: quiet cassette and quiet cartridge`, m.face === "quiet" && m.cart === "quiet" && !m.spin, `${m.face}/${m.cart}`);
    check(`${name}: the quiet words`, /Nothing on the deck right now\./.test(m.text) && /Quiet/.test(m.text), m.text.slice(0, 160));
  } else {
    check(`${name}: the fixture track and game`, m.face === "track" && m.cart === "game" && m.spin === (FACE !== "last"), `${m.face}/${m.cart}/${m.spin}`);
    check(`${name}: the long labels arrive capped`, m.text.includes(LONG_TITLE) && m.text.includes(LONG_GAME), m.text.slice(0, 200));
  }
  if (FACE === "brainz" || FACE === "last") {
    check(`${name}: fixture source and credit`, m.text.includes("ListenBrainz") && /fixture/i.test(m.text));
    if (FACE === "last") check(`${name}: full old UTC timestamp, still reels`, m.text.includes("2000-01-01 · 00:00:00 UTC") && !m.spin && m.running === 0);
  }
  if (FACE === "lanyard") {
    check(`${name}: Lanyard fixture credit, no store or Discord identity link`, m.gameSide === "Cartridge · Lanyard · fixture" && m.creditLinks.includes("https://github.com/Phineas/lanyard") && m.text.includes("game presence from Lanyard / Discord") && m.links.every(l => !/steam|discord/.test(l.href)), JSON.stringify({gameSide:m.gameSide,text:m.text,links:m.links}));
    const api = await (await page.request.get(`${BASE_URL}/api/now-playing`)).json();
    check(`${name}: API and rendered game agree`, api.play.source === "lanyard" && api.play.state === "fixture" && api.game?.title === LONG_GAME && api.game.url === null && m.text.includes(api.game.title));
  }
  check(`${name}: labels fit, nothing scrolls sideways`, fits(m), fitDetail(m));
  check(`${name}: label and credit text at least 4.5:1`, legible(m), JSON.stringify({ labels: m.labels.map((l) => l.minContrast.toFixed(2)), credit: m.creditContrast.toFixed(2) }));
  check(`${name}: links are at least 24 px tall`, m.links.length >= 1 && m.links.every((l) => l.height >= 24), JSON.stringify(m.links.map((l) => l.height)));
  if (FACE === "quiet") {
    const before = m.labels.map((l) => Math.round(l.height));
    await fillToCaps(page);
    const full = await measure(page);
    check(`${name}: capped labels fit the reserved space`, fits(full), fitDetail(full));
    check(
      `${name}: the label keeps its height when full`,
      full.labels.every((l, i) => Math.abs(l.height - before[i]) <= 1),
      JSON.stringify({ before, after: full.labels.map((l) => Math.round(l.height)) }),
    );
  }
  await shot(page, name);
  await context.close();
}

async function controls(browser) {
  const { context, page } = await open(browser, { viewport: PHONE });
  await page.locator("[data-now-playing]").scrollIntoViewIfNeeded();
  await fillToCaps(page);
  // Negative control: one unbroken line per label must overflow, and the fit check must say so.
  await page.addStyleTag({ content: ".np-label{overflow-wrap:normal!important;white-space:nowrap!important;min-height:0!important}" }).then((h) => h.evaluate((el) => (el.id = "nowrap")));
  check("control: an unbroken label is caught overflowing", !fits(await measure(page)));
  await page.evaluate(() => document.getElementById("nowrap")?.remove());
  check("control: undone, the labels fit again", fits(await measure(page)), fitDetail(await measure(page)));
  // Negative control: grey label text must fail the contrast check.
  await page.addStyleTag({ content: ".np-label>*{color:#bdb6a6!important}" }).then((h) => h.evaluate((el) => (el.id = "grey")));
  check("control: grey label text is caught below 4.5:1", !legible(await measure(page)));
  await page.evaluate(() => document.getElementById("grey")?.remove());
  check("control: undone, the label text is legible again", legible(await measure(page)));
  await context.close();
}

// The reels: turning only for a playing track, still under reduced motion at load and when it is switched on.
async function reels(browser) {
  {
    const { context, page } = await open(browser);
    const spinning = FACE === "live" || FACE === "brainz" || FACE === "lanyard";
    if (FACE === "last") check("last listen: reels naturally still", (await measure(page)).running === 0);
    if (!spinning) await page.evaluate(() => document.querySelector(".tape").setAttribute("data-spin", ""));
    let m = await measure(page);
    check("reels: a playing tape's reels turn", m.running === 2, `running ${m.running}`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    m = await measure(page);
    check("reels: reduced motion switched on mid-play stops them", m.running === 0, `running ${m.running}`);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    m = await measure(page);
    check("reels: and switched off, they turn again", m.running === 2, `running ${m.running}`);
    // Negative control: without data-spin (nothing playing) the same count is zero.
    await page.evaluate(() => document.querySelector(".tape").removeAttribute("data-spin"));
    m = await measure(page);
    check("control: a tape that is not playing stands still", m.running === 0, `running ${m.running}`);
    await context.close();
  }
  {
    const { context, page } = await open(browser, { reduced: true });
    if (FACE !== "live" && FACE !== "brainz" && FACE !== "lanyard") await page.evaluate(() => document.querySelector(".tape").setAttribute("data-spin", ""));
    const m = await measure(page);
    check("reels: under reduced motion from the start they stand still", m.running === 0, `running ${m.running}`);
    await context.close();
  }
}

// Keyboard: Tab reaches the cassette's link, and the ring shows against the paper label.
async function keyboard(browser) {
  for (const dark of [false, true]) {
    const { context, page } = await open(browser, { dark });
    let found = null;
    for (let i = 0; i < 120 && !found; i++) {
      await page.keyboard.press("Tab");
      found = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a?.classList.contains("np-link") || !a.closest(".tape")) return null;
        const s = getComputedStyle(a);
        return { visible: a.matches(":focus-visible"), style: s.outlineStyle, width: parseFloat(s.outlineWidth), color: s.outlineColor };
      });
    }
    const theme = dark ? "dark" : "light";
    check(`keyboard ${theme}: Tab reaches the cassette's link`, Boolean(found));
    check(
      `keyboard ${theme}: its focus ring is drawn in label ink`,
      found && found.visible && found.style !== "none" && found.width >= 2 && /\(35, 30, 22\)/.test(found.color),
      JSON.stringify(found),
    );
    await context.close();
  }
}

// JavaScript off: the first HTML is the whole shelf, with the same face.
async function noJs(browser) {
  const { context, page } = await open(browser, { js: false });
  const m = await measure(page);
  check("no-JS: the shelf is there and visible", m.present && m.visible);
  if (FACE === "quiet") check("no-JS: the quiet face", m.face === "quiet" && /Nothing on the deck right now\./.test(m.text), m.text.slice(0, 160));
  else check("no-JS: the fixture reading, not a fallback", m.face === "track" && m.text.includes(LONG_TITLE) && m.text.includes(LONG_GAME), m.text.slice(0, 160));
  if (FACE === "lanyard") check("no-JS: credited Lanyard game without store link", m.cart === "game" && m.text.includes("Lanyard") && m.links.every(l => !/steam|discord/.test(l.href)));
  if (FACE === "last") check("no-JS: last UTC date and stationary reels", m.text.includes("2000-01-01 · 00:00:00 UTC") && !m.spin);
  check("no-JS: a read stamp only when read", FACE !== "quiet" ? /Read \d\d:\d\d UTC/.test(m.text) : /Not read live/.test(m.text), m.text.slice(-200));
  await context.close();
}

async function probe() {
  const { chromium } = createRequire(path.join(process.env.PW_PREFIX, "package.json"))("playwright");
  const browser = await chromium.launch();
  try {
    const runs = [];
    for (const [vp, label] of [
      [DESKTOP, "desktop"],
      [PHONE, "phone"],
    ])
      for (const dark of [false, true]) runs.push([`${label} ${dark ? "dark" : "light"}`, (b) => viewing(b, `${label} ${dark ? "dark" : "light"}`, { viewport: vp, dark })]);
    runs.push(["controls", controls], ["reels", reels], ["keyboard", keyboard], ["no-JS", noJs]);
    for (const [name, run] of runs) {
      try {
        await run(browser);
      } catch (e) {
        check(`${name}: ran to the end`, false, e.message.split("\n")[0]);
      }
    }
  } finally {
    await browser.close();
  }

  const leaks = SENTINELS.flatMap((s) => bodies.filter((b) => b.text.includes(s)).map((b) => b.url));
  if (SENTINELS.length) check(`no secret in any of the ${bodies.length} responses the browser received`, leaks.length === 0, leaks.slice(0, 3).join(" "));
  check("scripts were scanned", bodies.some((b) => /\.js(\?|$)/.test(b.url)), `${bodies.length} bodies`);
  check("no console or page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
  console.log(`probe: ${ok} ok, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

// node scripts/probe-cassette.mjs fake: the loopback providers for this probe and scripts/walk-now-playing.sh. Three
// servers, Spotify's accounts host (FAKE_TOKEN_PORT), its API (FAKE_API_PORT) and Steam's (FAKE_STEAM_PORT), each
// answering what $FAKE_DIR/mode.json says, read per request. They check the credentials the app must send (the same
// SPOTIFY_* and STEAM_* values the server was given) and answer 401 to anything else. Every request is one line in
// $FAKE_DIR/requests.log, "<role> <method> <path> auth=<ok|bad>", never a credential. $FAKE_DIR/ready appears
// once all three listen.
//   token: ok | 401 | malformed | slow
//   track: ok | paused | long | 204 | 401 | 429 | malformed | private | slow   (title: the ok track's name)
//   steam: ok | long | idle | private | malformed | 500 | slow                  (game: the ok game's name)
async function fakeProviders() {
  const dir = process.env.FAKE_DIR;
  const env = process.env;
  const ACCESS = "FakeAccessToken0123456789abcdef";
  const basic = `Basic ${Buffer.from(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`).toString("base64")}`;
  const mode = () => {
    try {
      return JSON.parse(readFileSync(path.join(dir, "mode.json"), "utf8"));
    } catch {
      return {};
    }
  };
  const send = (res, status, body, type = "application/json") => {
    if (res.destroyed) return;
    res.writeHead(status, body === null ? {} : { "content-type": type });
    res.end(body === null ? undefined : typeof body === "string" ? body : JSON.stringify(body));
  };
  const later = (ms, fn) => setTimeout(fn, ms);
  const track = (m) => ({
    timestamp: 1761400000000,
    progress_ms: 1234,
    context: { type: "playlist", uri: "spotify:playlist:fixture" },
    currently_playing_type: "track",
    is_playing: m.track !== "paused",
    item: {
      type: "track",
      name: m.track === "long" ? "W".repeat(300) : (m.title ?? "Fixture Track One"),
      artists:
        m.track === "long"
          ? Array.from({ length: 30 }, (_, i) => ({ name: `Fixture Artist ${i}` }))
          : [{ name: "Fixture Artist", id: "fixtureartist" }],
      album: { name: "Fixture Album", images: [{ url: "https://i.scdn.co/image/fixture" }] },
      external_urls: { spotify: "https://open.spotify.com/track/FixtureTrack0001?si=fixture" },
      is_local: false,
      popularity: 1,
      preview_url: "https://p.scdn.co/mp3-preview/fixture",
    },
  });
  const player = (m) => {
    const p = {
      steamid: env.STEAM_ID,
      communityvisibilitystate: m.steam === "private" ? 1 : 3,
      personaname: "fixture-persona",
      realname: "Fixture Real Name",
      avatar: "https://avatars.steamstatic.com/fixture.jpg",
      loccountrycode: "VN",
    };
    if (m.steam !== "idle" && m.steam !== "private") {
      p.gameextrainfo = m.steam === "long" ? "M".repeat(200) : (m.game ?? "Fixture Game");
      p.gameid = "1145350";
    }
    return { response: { players: [p] } };
  };
  const brainzFixtures = JSON.parse(readFileSync(new URL("../lib/fixtures/listenbrainz.json", import.meta.url), "utf8"));
  const lanyardFixtures = JSON.parse(readFileSync(new URL("../lib/fixtures/lanyard.json", import.meta.url), "utf8"));
  const roles = {
    lanyard: (req, res) => {
      const ok = req.method === "GET" && req.url === "/v1/users/123456789012345678"
        && req.headers["user-agent"] === "otohime.dev/1.0 (+https://otohime.dev)" && req.headers.accept === "application/json" && !req.headers.authorization;
      if (!ok) return [false, () => send(res, 400, {error:"invalid request"})];
      const value = mode().lanyard ?? "game";
      if (["429", "500"].includes(value)) return [true, () => send(res, +value, {success:false})];
      if (value === "html") return [true, () => send(res, 200, "<html>challenge</html>", "text/html")];
      if (value === "bad-json") return [true, () => send(res, 200, "{not json")];
      if (value === "malformed") return [true, () => send(res, 200, {success:true,data:{activities:null}})];
      if (value === "redirect") return [true, () => {res.writeHead(302, {location:"http://127.0.0.1:9/forbidden"});res.end();}];
      const body = structuredClone(lanyardFixtures[value] ?? lanyardFixtures.game);
      if (value === "long") body.data.activities = [{type:0,name:"\u0000" + "M".repeat(200)}];
      const answer = () => send(res, 200, body);
      return [true, value === "slow" ? () => later(10_000, answer) : answer];
    },
    listenbrainz: (req, res) => {
      const now = req.url.endsWith("/playing-now");
      const ok = req.method === "GET" && ["/1/user/Fixture%20Owner/playing-now", "/1/user/Fixture%20Owner/listens?count=1"].includes(req.url)
        && req.headers["user-agent"] === "otohime.dev/1.0 (+https://otohime.dev)" && req.headers.accept === "application/json" && !req.headers.authorization;
      const m = mode();
      if (!ok) return [false, () => send(res, 400, {error:"invalid request"})];
      const value = (now ? m.lbNow : m.lbLast) ?? "ok";
      if (["404", "429", "500"].includes(value)) return [true, () => send(res, +value, {code:+value,error:"fixture failure"})];
      if (value === "html") return [true, () => send(res, 200, "<html>Verifying your browser</html>", "text/html")];
      if (value === "bad-json") return [true, () => send(res, 200, "{not json")];
      if (value === "error") return [true, () => send(res, 200, {error:"fixture"})];
      if (value === "redirect") return [true, () => {res.writeHead(302, {location:"http://127.0.0.1:9/forbidden"});res.end();}];
      let body = structuredClone(brainzFixtures[value === "empty" ? (now ? "emptyCurrent" : "emptyLast") : now ? "current" : "last"]);
      if (value === "long" || value === "old") {
        const listen = body.payload.listens[0];
        listen.track_metadata.track_name = "W".repeat(300);
        listen.track_metadata.artist_name = "A".repeat(300);
        if (!now) listen.listened_at = 946684800;
      }
      if (value === "unsafe") body.payload.listens[0].track_metadata.additional_info = {spotify_id:"javascript:alert(1)",origin_url:"https://evil.example/track"};
      const answer = () => send(res, 200, body);
      return [true, value === "slow" ? () => later(10_000, answer) : answer];
    },
    token: (req, res, body) => {
      const params = new URLSearchParams(body);
      const ok =
        req.method === "POST" &&
        req.headers.authorization === basic &&
        params.get("grant_type") === "refresh_token" &&
        params.get("refresh_token") === env.SPOTIFY_REFRESH_TOKEN;
      const m = mode();
      if (!ok) return [false, () => send(res, 401, { error: "invalid_client" })];
      if (m.token === "401") return [true, () => send(res, 401, { error: "invalid_grant", error_description: "Refresh token revoked" })];
      if (m.token === "malformed") return [true, () => send(res, 200, "<html>oops</html>", "text/html")];
      const answer = () => send(res, 200, { access_token: ACCESS, token_type: "Bearer", expires_in: 3600, scope: "user-read-currently-playing" });
      return [true, m.token === "slow" ? () => later(10_000, answer) : answer];
    },
    api: (req, res) => {
      const ok = req.headers.authorization === `Bearer ${ACCESS}` && req.url.startsWith("/v1/me/player/currently-playing");
      const m = mode();
      if (!ok) return [false, () => send(res, 401, { error: { status: 401, message: "Invalid access token" } })];
      const t = m.track ?? "ok";
      if (t === "204") return [true, () => send(res, 204, null)];
      if (t === "401") return [true, () => send(res, 401, { error: { status: 401, message: "The access token expired" } })];
      if (t === "429") return [true, () => send(res, 429, { error: { status: 429, message: "API rate limit exceeded" } })];
      if (t === "malformed") return [true, () => send(res, 200, "{not json")];
      if (t === "private")
        return [true, () => send(res, 200, { is_playing: true, currently_playing_type: "unknown", item: null, device: { is_private_session: true } })];
      const answer = () => send(res, 200, track(m));
      return [true, t === "slow" ? () => later(10_000, answer) : answer];
    },
    steam: (req, res) => {
      const u = new URL(req.url, "http://fake");
      const ok =
        u.pathname === "/ISteamUser/GetPlayerSummaries/v0002/" &&
        u.searchParams.get("key") === env.STEAM_API_KEY &&
        u.searchParams.get("steamids") === env.STEAM_ID;
      const m = mode();
      if (!ok) return [false, () => send(res, 403, "<html>Forbidden</html>", "text/html")];
      const s = m.steam ?? "ok";
      if (s === "malformed") return [true, () => send(res, 200, "<html>not json</html>", "text/html")];
      if (s === "500") return [true, () => send(res, 500, "<html>Internal Server Error</html>", "text/html")];
      const answer = () => send(res, 200, player(m));
      return [true, s === "slow" ? () => later(10_000, answer) : answer];
    },
  };
  const ports = { lanyard: env.FAKE_LANYARD_PORT ?? String(Number(env.FAKE_STEAM_PORT) + 2), token: env.FAKE_TOKEN_PORT, api: env.FAKE_API_PORT, steam: env.FAKE_STEAM_PORT, listenbrainz: env.FAKE_LISTENBRAINZ_PORT ?? String(Number(env.FAKE_STEAM_PORT) + 1) };
  await Promise.all(
    Object.entries(ports).map(
      ([role, port]) =>
        new Promise((resolve, reject) => {
          const server = http.createServer((req, res) => {
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", () => {
              const [ok, answer] = roles[role](req, res, body);
              appendFileSync(path.join(dir, "requests.log"), `${role} ${req.method} ${new URL(req.url, "http://fake").pathname} auth=${ok ? "ok" : "bad"}\n`);
              answer();
            });
          });
          server.on("error", reject);
          server.listen(Number(port), "127.0.0.1", resolve);
        }),
    ),
  );
  writeFileSync(path.join(dir, "ready"), "");
}

if (process.argv[2] === "fake") await fakeProviders();
else await probe();
