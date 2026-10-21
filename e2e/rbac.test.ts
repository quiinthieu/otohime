// RBAC and session revocation over HTTP, against a running production server.
//   BASE_URL      the server, started with BETTER_AUTH_URL=BASE_URL (and not NODE_ENV=test,
//                 which turns Better Auth's origin checks off)
//   DATABASE_URL  the same database the server uses; the test promotes its owner with SQL
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
// node --test runs each file in its own process at once: a bare timestamp can collide across files.
const run = `r${Date.now().toString(36)}${process.pid.toString(36)}`;
const mail = (who: string) => `${who}-${run}@e2e.test`;
const pw = (who: string) => `pw-${run}-${who}`;
const users: Record<string, { id: string; cookie: string }> = {};

// Cookie-bearing POSTs need a trusted Origin, like a browser sends.
async function api(path: string, cookie = "", body?: unknown): Promise<Response> {
  const res = await fetch(`${BASE}/api/auth${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      origin: BASE,
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status !== 429) return res;
  // ponytail: production rate limits sign-up and sign-in to 3 per 10s; wait it out
  const wait = Number(res.headers.get("x-retry-after") ?? 10);
  await new Promise((resolve) => setTimeout(resolve, 1000 * wait));
  return api(path, cookie, body);
}

const page = (path: string, cookie = "") =>
  fetch(BASE + path, { headers: { cookie }, redirect: "manual" });
const sessionOf = async (cookie: string) => (await api("/get-session", cookie)).json();

before(async () => {
  for (const who of ["owner", "admin", "plain", "victim"]) {
    const res = await api("/sign-up/email", "", { name: who, email: mail(who), password: pw(who) });
    assert.equal(res.status, 200, await res.clone().text());
    users[who] = {
      id: (await res.json()).user.id,
      cookie: res.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    };
  }
  // The README's owner bootstrap: owners only ever come from SQL.
  await db.query(`UPDATE "user" SET role = 'owner' WHERE id = $1`, [users.owner.id]);
});

after(async () => {
  await db.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%-${run}@e2e.test`]);
  await db.end();
});

test("signed-out visitors are redirected before anything streams", async () => {
  for (const path of ["/dashboard", "/admin/users", "/admin/roles", "/account"]) {
    const res = await page(path);
    assert.equal(res.status, 307, path);
    assert.equal(
      new URL(res.headers.get("location") ?? "", BASE).search,
      `?next=${encodeURIComponent(path)}`,
      path,
    );
  }
});

test("the public pages are open to everyone", async () => {
  for (const path of ["/", "/work", "/play", "/notes", "/music", "/projects"]) {
    assert.equal((await page(path)).status, 200, path);
  }
});

test("the front page is an entrance, without the sidebar", async () => {
  assert.doesNotMatch(await (await page("/")).text(), /aria-label="Main"/);
  assert.match(await (await page("/work")).text(), /aria-label="Main"/);
});

test("the projects page sits in the sidebar and lists Shore, Capsule, Orrery, Elements, Vinyl, Rotor, Planisphere, Barometer and Gazette", async () => {
  const html = await (await page("/projects")).text();
  assert.match(html, /aria-label="Main"/);
  assert.match(html, /href="\/shore"/);
  assert.match(html, /href="\/capsule"/);
  assert.match(html, /href="\/orrery"/);
  assert.doesNotMatch(html, /href="\/sun"/);
  assert.match(html, /href="\/elements"/);
  assert.match(html, /href="\/vinyl"/);
  assert.match(html, /href="\/rotor"/);
  assert.match(html, /href="\/planisphere"/);
  assert.match(html, /href="\/barometer"/);
  assert.match(html, /href="\/articles"/);
});

test("Shore is its own page, without the site's sidebar", async () => {
  const res = await page("/shore");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /aria-label="Main"/);
  assert.match(html, /href="\/projects"/);
});

test("Capsule is its own page, without the site's sidebar", async () => {
  const res = await page("/capsule");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /aria-label="Main"/);
  assert.match(html, /href="\/projects"/);
});

test("Orrery is its own page, without the site's sidebar", async () => {
  const res = await page("/orrery");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /aria-label="Main"/);
  assert.match(html, /href="\/projects"/);
});

test("/sun is a permanent redirect to the Sun's poster", async () => {
  const res = await fetch(BASE + "/sun", { redirect: "manual" });
  assert.equal(res.status, 308);
  assert.match(res.headers.get("location") ?? "", /\/orrery\/sun$/);
});

test("Elements is its own page, without the site's sidebar", async () => {
  const res = await page("/elements");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /aria-label="Main"/);
  assert.match(html, /href="\/projects"/);
});

test("Vinyl is its own page, without the site's sidebar", async () => {
  const res = await page("/vinyl");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /aria-label="Main"/);
  assert.match(html, /href="\/projects"/);
});

test("Rotor is its own page, without the site's sidebar", async () => {
  const res = await page("/rotor");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /aria-label="Main"/);
  assert.match(html, /href="\/projects"/);
});

test("Planisphere is its own page, without the site's sidebar", async () => {
  const res = await page("/planisphere");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /aria-label="Main"/);
  assert.match(html, /href="\/projects"/);
});

test("Barometer is its own page, without the site's sidebar", async () => {
  const res = await page("/barometer");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /aria-label="Main"/);
  assert.match(html, /href="\/projects"/);
  assert.equal(html.match(/data-face="/g)?.length, 1);
  assert.match(html, /href="https:\/\/open-meteo\.com\/"/);
});

test("The Gazette is its own page, without the site's sidebar", async () => {
  const res = await page("/articles");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.doesNotMatch(html, /aria-label="Main"/);
  assert.match(html, /href="\/projects"/);
  assert.equal(html.match(/data-article="/g)?.length, 6);
});

test("a plain user can't list users or raise their own role", async () => {
  assert.equal((await api("/admin/list-users", users.plain.cookie)).status, 403);
  assert.equal((await api("/update-user", users.plain.cookie, { role: "owner" })).status, 400);

  const html = await (await page("/admin/users", users.plain.cookie)).text();
  assert.match(html, /<meta name="robots" content="noindex"/); // the 403 screen
  for (const who of ["owner", "admin", "victim"]) assert.ok(!html.includes(mail(who)), who);
});

test("the owner lists users and makes an admin", async () => {
  const res = await api(
    `/admin/list-users?searchValue=${run}&searchField=email&searchOperator=contains`,
    users.owner.cookie,
  );
  assert.equal((await res.json()).total, 4);
  assert.equal(
    (await api("/admin/set-role", users.owner.cookie, { userId: users.admin.id, role: "admin" }))
      .status,
    200,
  );
  // Positive control for the no-leak check above: the same page shows emails to an admin.
  const html = await (await page("/admin/users", users.admin.cookie)).text();
  assert.ok(html.includes(mail("victim")));
});

// The roles page draws one <tbody> per resource: a rowgroup header, then a row per action whose
// cells run owner, admin, user and say "Allowed" or "Not allowed" for screen readers.
function grants(html: string, resource: string) {
  const group = html.split("<tbody>").find((t) => t.includes(`>${resource}</th>`));
  assert.ok(group, `a ${resource} row on /admin/roles`);
  const rows = [...group.matchAll(/<th scope="row"[^>]*>([^<]+)<\/th>(.*?)<\/tr>/g)];
  return Object.fromEntries(
    rows.map(([, action, cells]) => [
      action,
      [...cells.matchAll(/(Not allowed|Allowed)</g)].map((m) => m[1] === "Allowed"),
    ]),
  );
}

test("song create and delete are owner-only on /admin/roles", async () => {
  for (const who of ["owner", "admin"]) {
    const res = await page("/admin/roles", users[who].cookie);
    assert.equal(res.status, 200, who);
    // [owner, admin, user]
    assert.deepEqual(
      grants(await res.text(), "song"),
      { create: [true, false, false], delete: [true, false, false] },
      who,
    );
  }
});

test("an admin can't escalate or touch the owner", async () => {
  const { rows } = await db.query(`SELECT token FROM session WHERE user_id = $1 LIMIT 1`, [
    users.owner.id,
  ]);
  const attempts: [string, unknown][] = [
    ["/admin/set-role", { userId: users.admin.id, role: "owner" }], // self-promotion
    ["/admin/set-role", { userId: users.plain.id, role: "admin" }], // granting own rank
    ["/admin/update-user", { userId: users.plain.id, data: { role: "admin" } }],
    ["/admin/create-user", { email: mail("made"), password: pw("made"), name: "made", role: "admin" }],
    ["/admin/ban-user", { userId: users.owner.id }],
    ["/admin/list-user-sessions", { userId: users.owner.id }], // would expose tokens
    ["/admin/revoke-user-session", { sessionToken: rows[0].token }],
    ["/admin/impersonate-user", { userId: users.owner.id }],
    ["/admin/remove-user", { userId: users.owner.id }],
  ];
  for (const [path, body] of attempts) {
    assert.equal((await api(path, users.admin.cookie, body)).status, 403, path);
  }
  assert.ok(await sessionOf(users.owner.cookie), "owner still signed in");
});

test("a ban signs the target out everywhere and blocks sign-in", async () => {
  const res = await api("/admin/ban-user", users.admin.cookie, {
    userId: users.victim.id,
    banReason: "e2e",
  });
  assert.equal(res.status, 200);
  assert.equal(await sessionOf(users.victim.cookie), null);
  const signIn = await api("/sign-in/email", "", { email: mail("victim"), password: pw("victim") });
  assert.equal(signIn.status, 403);
});

test("a password reset signs every device out", async () => {
  const req = await api("/request-password-reset", "", {
    email: mail("plain"),
    redirectTo: "/reset-password",
  });
  assert.equal(req.status, 200);
  // Better Auth stores the token in the verification identifier (plain by default).
  const { rows } = await db.query(
    `SELECT identifier FROM verification WHERE value = $1 AND identifier LIKE 'reset-password:%'`,
    [users.plain.id],
  );
  const token = rows[0].identifier.slice("reset-password:".length);
  assert.equal((await api("/reset-password", "", { token, newPassword: pw("new") })).status, 200);
  assert.equal(await sessionOf(users.plain.cookie), null);
});
