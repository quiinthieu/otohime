// Owner channels on /music over HTTP, against a running production server.
//   BASE_URL      the server, started with BETTER_AUTH_URL=BASE_URL (and not NODE_ENV=test)
//   DATABASE_URL  the same database the server uses; the test promotes its owner with SQL
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import pg from "pg";

const BASE = process.env.BASE_URL ?? "http://localhost:4000";
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const run = Date.now().toString(36);
const mail = (who: string) => `${who}-${run}@e2e.test`;
const pw = (who: string) => `pw-${run}-${who}`;
const users: Record<string, { id: string; cookie: string }> = {};
const SQL_VIDEO = "e2eSqlVid01";
const FORM_VIDEO = "e2eFormVd02";

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
  const wait = Number(res.headers.get("x-retry-after") ?? 10);
  await new Promise((resolve) => setTimeout(resolve, 1000 * wait));
  return api(path, cookie, body);
}

const music = async (cookie = "") =>
  (await fetch(`${BASE}/music`, { headers: { cookie }, redirect: "manual" })).text();
const songCount = async () => Number((await db.query(`SELECT count(*) FROM song`)).rows[0].count);
const rowsFor = async (title: string) =>
  (await db.query(`SELECT * FROM song WHERE title = $1`, [title])).rows;
const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

// The hidden inputs React renders inside the <form> that holds `marker`: the action reference a
// no-JS browser posts back.
function hiddenInputs(html: string, marker: string): [string, string][] {
  const form = html
    .split("<form")
    .slice(1)
    .map((f) => f.split("</form>")[0])
    .find((f) => f.includes(marker));
  assert.ok(form, `a form containing ${marker}`);
  const out: [string, string][] = [];
  for (const [tag] of form.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = /name="([^"]*)"/.exec(tag)?.[1];
    const value = /value="([^"]*)"/.exec(tag)?.[1] ?? "";
    if (name) out.push([decode(name), decode(value)]);
  }
  return out;
}

async function post(cookie: string, fields: [string, string][]) {
  const body = new FormData();
  for (const [k, v] of fields) body.append(k, v);
  return fetch(`${BASE}/music`, {
    method: "POST",
    headers: { cookie, origin: BASE },
    body,
    redirect: "manual",
  });
}

const addFields = (
  hidden: [string, string][],
  title: string,
  video = FORM_VIDEO,
): [string, string][] => [
  ...hidden,
  ["video", `https://youtu.be/${video}?si=e2e`],
  ["title", title],
  ["artist", "e2e artist"],
  ["note", "added by the e2e test"],
  ["colour", "mint"],
];

before(async () => {
  for (const who of ["owner", "admin", "plain"]) {
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
  await db.query(`UPDATE "user" SET role = 'owner' WHERE id = $1`, [users.owner.id]);
  await db.query(`UPDATE "user" SET role = 'admin' WHERE id = $1`, [users.admin.id]);
});

after(async () => {
  await db.query(`DELETE FROM song WHERE title LIKE $1`, [`e2e-${run}%`]);
  await db.query(`DELETE FROM "user" WHERE email LIKE $1`, [`%-${run}@e2e.test`]);
  await db.end();
});

test("the add form is visible to the owner only", async () => {
  const anon = await music();
  assert.match(anon, /CH 01/);
  assert.ok(!anon.includes('name="video"'), "anonymous");
  assert.ok(!anon.includes("Add a channel"), "anonymous");
  assert.ok((await music(users.owner.cookie)).includes('name="video"'), "owner");
  assert.ok((await music(users.owner.cookie)).includes("Add a channel"), "owner");
  assert.ok(!(await music(users.admin.cookie)).includes('name="video"'), "admin");
  assert.ok(!(await music(users.plain.cookie)).includes('name="video"'), "plain user");
});

test("a song inserted by SQL shows up for anonymous visitors with its channel number", async () => {
  const before = await songCount();
  await db.query(
    `INSERT INTO song (id, title, artist, note, colour, video, position, created_by)
     VALUES ($1, $2, 'e2e artist', '', 'blue', $3, $4, $5)`,
    [crypto.randomUUID(), `e2e-${run}-sql`, SQL_VIDEO, before + 1000, users.owner.id],
  );
  const html = await music();
  assert.ok(html.includes(`e2e-${run}-sql`));
  const nn = String(3 + (await songCount())).padStart(2, "0");
  assert.match(html, new RegExp(`CH ${nn}`));
});

let formId = "";

test("an owner adds a channel with a plain form post, and every visitor sees it", async () => {
  const hidden = hiddenInputs(await music(users.owner.cookie), 'name="video"');
  assert.ok(hidden.length > 0, "React renders the action reference as hidden inputs");
  const res = await post(users.owner.cookie, addFields(hidden, `e2e-${run}-form`));
  assert.ok(res.status < 400, `status ${res.status}`);
  const rows = await rowsFor(`e2e-${run}-form`);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].created_by, users.owner.id);
  assert.equal(rows[0].video, FORM_VIDEO);
  formId = rows[0].id;
  assert.ok((await music()).includes(`e2e-${run}-form`));
});

test("replayed adds from a plain user and an admin, and a replayed remove, change nothing", async () => {
  const ownerHtml = await music(users.owner.cookie);
  const addHidden = hiddenInputs(ownerHtml, 'name="video"');
  const removeHidden = hiddenInputs(ownerHtml, formId);
  const total = await songCount();

  for (const who of ["plain", "admin"]) {
    await post(users[who].cookie, addFields(addHidden, `e2e-${run}-${who}`, "e2eGateVid03"));
    assert.equal((await rowsFor(`e2e-${run}-${who}`)).length, 0, `${who} add`);
  }
  await post("", addFields(addHidden, `e2e-${run}-anon`, "e2eGateVid03"));
  assert.equal((await rowsFor(`e2e-${run}-anon`)).length, 0, "anonymous add");

  for (const who of ["plain", "admin"]) {
    await post(users[who].cookie, removeHidden);
    assert.equal((await rowsFor(`e2e-${run}-form`)).length, 1, `${who} remove`);
  }
  assert.equal(await songCount(), total);
});

test("duplicate videos and non-YouTube links add no row", async () => {
  const hidden = hiddenInputs(await music(users.owner.cookie), 'name="video"');
  const total = await songCount();
  await post(users.owner.cookie, addFields(hidden, `e2e-${run}-dup`)); // FORM_VIDEO is on the TV
  await post(users.owner.cookie, addFields(hidden, `e2e-${run}-dup2`, "IXA6bQsVNjs")); // a starter
  const evil = addFields(hidden, `e2e-${run}-evil`).map(([k, v]): [string, string] =>
    k === "video" ? [k, "https://evil.com/watch?v=e2eEvilVid04"] : [k, v],
  );
  await post(users.owner.cookie, evil);
  assert.equal(await songCount(), total);
});

test("an owner removes the channel and it leaves every page", async () => {
  const removeHidden = hiddenInputs(await music(users.owner.cookie), formId);
  await post(users.owner.cookie, removeHidden);
  assert.equal((await rowsFor(`e2e-${run}-form`)).length, 0);
  assert.ok(!(await music()).includes(`e2e-${run}-form`));
});
