// Drives headless Chromium through the sign-in and the full-load hops into the signed-in rooms. Run by
// scripts/probe-motion-signed-in.sh, which finds or starts the database and the server, installs Playwright into
// PW_PREFIX and passes BASE_URL, DATABASE_URL and PROBE_RUN.
//
// A sign-in is a full page load (Better Auth's client follows callbackURL), and so is a location.assign from a
// project. Each lands on a page whose Suspense boundaries stream in after the hop's transition has started; React's
// inline reveal script would start a second view transition while the hop is still active, which Chromium skips
// with an uncaught "Transition was skipped. Navigation transition active". The root layout's pagereveal guard
// hands the hop to React as document.__reactViewTransition, so the reveal waits for it. Every landing is watched
// until the hop has finished, no Suspense template is left and no transition is in flight.
import { createRequire } from "node:module";
import path from "node:path";
import pg from "pg";

const require = createRequire(path.join(process.env.PW_PREFIX, "package.json"));
const { chromium } = require("playwright");

const BASE_URL = process.env.BASE_URL;
const RUN = process.env.PROBE_RUN;
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1366, height: 768 };
const mail = (who) => `${who}-${RUN}@probe.test`;
const pw = (who) => `pw-${RUN}-${who}`;
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Better Auth limits sign-in and sign-up to 3 per 10 s, counted until 10 s pass with none. A 429 on the form
// would log a console error of its own, so the probe spaces its sign-ins: three, then a quiet 10.5 s.
const auth = { count: 0, last: 0 };
async function pace() {
  if (Date.now() - auth.last > 10_500) auth.count = 0;
  if (auth.count >= 3) {
    await sleep(auth.last + 10_500 - Date.now());
    auth.count = 0;
  }
  auth.count++;
  auth.last = Date.now();
}

// A sign-up over HTTP with a trusted Origin, like a browser sends; a 429 left by an earlier run is waited out.
async function signUp(who) {
  for (;;) {
    await pace();
    const res = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { origin: BASE_URL, "content-type": "application/json" },
      body: JSON.stringify({ name: who, email: mail(who), password: pw(who) }),
    });
    if (res.status === 429) {
      await sleep(1000 * Number(res.headers.get("x-retry-after") ?? 10));
      continue;
    }
    if (res.status !== 200) throw new Error(`sign-up ${who}: ${res.status} ${await res.text()}`);
    const cookies = res.headers.getSetCookie().map((c) => {
      const [pair] = c.split(";");
      const at = pair.indexOf("=");
      return { name: pair.slice(0, at), value: pair.slice(at + 1), url: BASE_URL };
    });
    return { id: (await res.json()).user.id, cookies };
  }
}

function watchHops() {
  addEventListener("pagereveal", (e) => {
    const vt = e.viewTransition;
    window.__probe = { reveal: vt !== null, types: vt ? [...vt.types] : [], anims: [], done: vt === null };
    if (!vt) return;
    // The hop's own root fade, read once it is ready; each animation reports whether it ran to its end.
    vt.ready
      .then(() => {
        for (const a of document.documentElement.getAnimations({ subtree: true })) {
          const pseudo = a.effect?.pseudoElement ?? "";
          if (!/^::view-transition-(?:old|new)\(root\)$/.test(pseudo)) continue;
          const t = a.effect.getComputedTiming();
          const seen = { pseudo, name: a.animationName ?? "", duration: Number(t.duration), delay: t.delay, ended: false };
          window.__probe.anims.push(seen);
          a.finished.then(() => void (seen.ended = true), () => {});
        }
      })
      .catch(() => {});
    const done = () => void (window.__probe.done = true);
    vt.finished.then(done, done);
  });
}

async function open(browser, { viewport, reduced, cookies = [] }) {
  const phone = viewport === PHONE;
  const context = await browser.newContext({ viewport, isMobile: phone, hasTouch: phone, reducedMotion: reduced ? "reduce" : "no-preference" });
  if (cookies.length) await context.addCookies(cookies);
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const from = m.location().url;
    errors.push(`console ${page.url()}: ${m.text()}${from && from !== page.url() ? ` (${from})` : ""}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()}: ${e.message}`));
  await page.addInitScript(watchHops);
  return { context, page, errors };
}

// The landing has settled: the hop's transition has finished, every Suspense boundary has revealed, no transition
// of React's is in flight and every finite animation is done. Then a beat, so a late rejection still surfaces.
async function settle(page) {
  const settled = await page
    .waitForFunction(
      () =>
        window.__probe?.done === true &&
        !document.querySelector('template[id^="B:"]') &&
        !document.__reactViewTransition &&
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .every((a) => a.playState === "finished" || a.playState === "idle"),
      null,
      { timeout: 10_000 },
    )
    .then(
      () => true,
      () => false,
    );
  await page.waitForTimeout(300);
  return settled;
}

const probeOf = (page) => page.evaluate(() => window.__probe ?? null);
const loadAnimations = (page) =>
  page.evaluate(() =>
    document
      .getAnimations()
      .filter((a) => !(a.animationName ?? "").startsWith("-ua-"))
      .map((a) => ({ name: a.animationName ?? a.transitionProperty ?? a.constructor.name, duration: Number(a.effect?.getComputedTiming().duration), state: a.playState })),
  );
const still = (anims) => anims.filter((a) => !(a.duration <= 1 || a.state === "finished"));
const show = (anims) => anims.slice(0, 6).map((a) => `${a.name} ${a.duration}ms ${a.state}`).join(", ");

// Fills the /sign-in form and submits it; resolves once the full load has reached `landing`.
async function signIn(page, who, query, landing) {
  await page.goto(`${BASE_URL}/sign-in${query}`, { waitUntil: "load" });
  await page.locator('input[name="email"]').fill(mail(who));
  await page.locator('input[name="password"]').fill(pw(who));
  await pace();
  await Promise.all([
    page.waitForURL((u) => u.pathname === landing, { waitUntil: "load", timeout: 15_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
}

// The checks every landing gets: the hop's transition (motion on), no error, and stillness under reduced motion.
async function landed(label, page, errors, from, reduced, landing) {
  const settledOk = await settle(page);
  const probe = await probeOf(page);
  check(`${label}: lands on ${landing}`, new URL(page.url()).pathname === landing, page.url());
  if (!reduced) {
    check(`${label}: pagereveal carries the hop's view transition`, probe?.reveal === true && probe.types.includes("hop"), JSON.stringify(probe));
    const anims = probe?.anims ?? [];
    const old = anims.find((a) => a.pseudo === "::view-transition-old(root)" && /fade-out$/.test(a.name));
    const now = anims.find((a) => a.pseudo === "::view-transition-new(root)" && /fade-in$/.test(a.name));
    check(
      `${label}: the hop's root fades out (150 ms) and in (210 ms after 150 ms), each to its end`,
      old?.duration === 150 && old.ended && now?.duration === 210 && now.delay === 150 && now.ended,
      JSON.stringify(anims),
    );
  }
  check(`${label}: the hop and every streamed reveal settle`, settledOk, JSON.stringify(probe));
  const mine = errors.slice(from);
  check(`${label}: no page error and no console error`, mine.length === 0, mine.slice(0, 3).join(" | "));
  if (reduced) {
    const anims = await loadAnimations(page);
    check(`${label}: every animation at load lasts <= 1 ms or has finished`, still(anims).length === 0, show(still(anims)));
  }
}

// From a project, a script navigation into a site page: the full load a "back to the site" link makes.
async function hopInto(page, to, landing) {
  await page.goto(`${BASE_URL}/shore`, { waitUntil: "load" });
  // A page that has not painted yet has nothing to capture, and its hop cuts (a cached page can fire load before
  // its first frame); a visitor never leaves that fast.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await Promise.all([page.waitForURL((u) => u.pathname === landing, { waitUntil: "load", timeout: 15_000 }), page.evaluate((t) => location.assign(t), to)]);
}

const users = {};
const browser = await chromium.launch();
try {
  for (const who of ["owner", "plain"]) users[who] = await signUp(who);
  // The README's owner bootstrap: owners only ever come from SQL.
  await db.query(`UPDATE "user" SET role = 'owner' WHERE id = $1`, [users.owner.id]);

  const HOPS = {
    owner: [
      ["/dashboard", "/dashboard"],
      ["/account", "/account"],
      ["/admin", "/admin/users"],
      ["/admin/users", "/admin/users"],
      [`/admin/users/${users.plain.id}`, `/admin/users/${users.plain.id}`],
      ["/admin/roles", "/admin/roles"],
      ["/work", "/work"],
      ["/", "/"],
      ["/projects", "/projects"],
    ],
    plain: [
      ["/dashboard", "/dashboard"],
      ["/account", "/account"],
      ["/admin/roles", "/admin/roles"],
    ],
  };

  for (const [size, viewport] of [["1366x768", DESKTOP], ["390x844", PHONE]]) {
    for (const reduced of [false, true]) {
      const mode = `${size}${reduced ? " reduced motion" : ""}`;

      // The sign-in form, as a visitor uses it: to /dashboard, and back to the room ?next names.
      for (const [who, query, landing] of [["owner", "", "/dashboard"], ["plain", "?next=/account", "/account"]]) {
        const { context, page, errors } = await open(browser, { viewport, reduced });
        const label = `${mode} sign-in${query} as ${who}`;
        try {
          await signIn(page, who, query, landing);
          await landed(label, page, errors, 0, reduced, landing);
        } catch (e) {
          check(`${label}: completes`, false, e.message.split("\n")[0]);
        } finally {
          await context.close();
        }
      }

      // Full loads from a project into the rooms, the admin pages, the 403, the sidebar pages and Home.
      for (const who of ["owner", "plain"]) {
        const { context, page, errors } = await open(browser, { viewport, reduced, cookies: users[who].cookies });
        try {
          for (const [to, landing] of HOPS[who]) {
            const label = `${mode} ${who} /shore -> ${to.replace(users.plain.id, "<plain id>")} (location.assign)`;
            const from = errors.length;
            try {
              await hopInto(page, to, landing);
              await landed(label, page, errors, from, reduced, landing);
            } catch (e) {
              check(`${label}: completes`, false, e.message.split("\n")[0]);
            }
            if (who === "plain" && to === "/admin/roles") {
              const robots = await page.evaluate(() => [...document.querySelectorAll('meta[name="robots"]')].map((m) => m.content));
              check(`${label}: shows the 403`, robots.includes("noindex"), robots.join(", ") || "no robots meta");
            }
          }
        } finally {
          await context.close();
        }
      }
    }
  }

  // Negative: strip the pagereveal guard from the /dashboard HTML, and a sign-in must log the skipped transition.
  // The collision depends on the reveal landing inside the hop, so up to three sign-ins are tried.
  {
    let stripped = 0;
    let seen = [];
    const tries = [];
    for (let i = 0; i < 3 && seen.length === 0; i++) {
      const { context, page, errors } = await open(browser, { viewport: DESKTOP, reduced: false });
      try {
        await page.route(/./, async (route) => {
          const request = route.request();
          if (request.resourceType() !== "document" || new URL(request.url()).pathname !== "/dashboard") return route.continue();
          const response = await route.fetch();
          const body = (await response.text()).replace(/<script>addEventListener\("pagereveal"[\s\S]*?<\/script>/g, () => (stripped++, ""));
          await route.fulfill({ response, body });
        });
        await signIn(page, "owner", "", "/dashboard");
        await settle(page);
        seen = errors.filter((e) => /^pageerror .*Transition was skipped/.test(e));
        tries.push(`${errors.length} errors`);
      } catch (e) {
        tries.push(e.message.split("\n")[0]);
      } finally {
        await context.close();
      }
    }
    check("negative: the probe stripped the pagereveal guard from /dashboard's HTML", stripped >= 1, `${stripped} scripts stripped`);
    check('negative: without the guard a sign-in logs "Transition was skipped"', seen.length > 0, tries.join("; "));
  }
} catch (e) {
  check("the probe runs to the end", false, e.stack ?? String(e));
} finally {
  await browser.close();
  const gone = await db.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%-${RUN}@probe.test`]).catch((e) => e);
  check(`the probe's accounts (*-${RUN}@probe.test) are deleted`, !(gone instanceof Error) && gone.rowCount === Object.keys(users).length, gone instanceof Error ? gone.message : `${gone.rowCount} deleted`);
  await db.end();
}

console.log(`probe: ${ok} ok, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
