/** Actual production HTTP + real Postgres; isolated by scripts/e2e.mjs. */
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { chromium, type Browser } from "playwright-core";
import { createPostgresBottleStore } from "../lib/bottles-store.ts";
import { createBottleService, submitterKeys } from "../lib/bottles-service.ts";
import { bottleStoreContract } from "../lib/bottles-store-contract.ts";
const base = process.env.BASE_URL ?? "http://localhost:4000";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const run = randomUUID();
const tmp = mkdtempSync("/tmp/bottle-e2e-");
const fixture = (n: string) => ({
  url: `https://bottle-review.org/${run}/${n}`,
  title: "Paper world",
  note: "A quiet ink discovery.",
  kind: "art" as const,
});
const users: Record<string, { id: string; cookie: string }> = {};
let browser: Browser;
const request = (
  path: string,
  body?: unknown,
  cookie = "",
  headers: Record<string, string> = {},
  method = body === undefined ? "GET" : "POST",
) =>
  fetch(base + path, {
    method,
    headers: {
      origin: base,
      cookie,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
    redirect: "manual",
  });
const suggest = (n: string, headers: Record<string, string> = {}) =>
  request("/api/bottles/suggestions", fixture(n), "", headers);
const publicPool = async () => {
  const r = await request("/api/bottles");
  assert.equal(r.headers.get("cache-control"), "no-store");
  return r.json();
};
const patch = (id: string, status: string, who = "owner") =>
  request(
    `/api/admin/bottles/${id}`,
    { status },
    users[who].cookie,
    {},
    "PATCH",
  );
const reason = async (r: Response, status: number, code: string) => {
  assert.equal(r.status, status, await r.clone().text());
  assert.equal((await r.json()).reason, code);
};
const clearUsage = () => pool.query("delete from bottle_usage");
before(async () => {
  for (const who of ["owner", "admin", "user"]) {
    const r = await request("/api/auth/sign-up/email", {
      name: who,
      email: `${who}-${run}@bottles.test`,
      password: `test-password-${run}`,
    });
    assert.equal(r.status, 200, await r.clone().text());
    users[who] = {
      id: (await r.json()).user.id,
      cookie: r.headers
        .getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; "),
    };
    await pool.query('update "user" set role=$2 where id=$1', [
      users[who].id,
      who,
    ]);
  }
  browser = await chromium.launch({
    channel: "chrome",
    env: { ...process.env, TMPDIR: tmp },
  });
  await clearUsage();
});
after(async () => {
  await browser?.close();
  await pool.query("delete from bottle_suggestion where url like $1", [
    `%/${run}/%`,
  ]);
  await pool.query('delete from "user" where email like $1', [
    `%-${run}@bottles.test`,
  ]);
  await clearUsage();
  await pool.end();
  rmSync(tmp, { recursive: true, force: true });
});

bottleStoreContract("Postgres", async () => {
  // Separate schema/database client so matching contract fixtures cannot touch HTTP state.
  const schema = `bottle_contract_${run.replaceAll("-", "")}`;
  await pool.query(`create schema ${schema}`);
  const db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    options: `-c search_path=${schema}`,
  });
  await db.query(
    'create table "user"(id text primary key,role text,banned boolean default false)',
  );
  for (const who of ["owner", "admin", "user"])
    await db.query('insert into "user"(id,role) values($1,$1)', [who]);
  const migration = readFileSync(
    "db/migrations/0005_magenta_william_stryker.sql",
    "utf8",
  ).replaceAll("--> statement-breakpoint", "\n");
  await db.query(migration);
  return {
    store: createPostgresBottleStore(db),
    close: async () => {
      await db.end();
      await pool.query(`drop schema ${schema} cascade`);
    },
  };
});
test("migration upgrades populated users and songs; fresh database has Bottle tables", async () => {
  const schema = `bottle_upgrade_${run.replaceAll("-", "")}`;
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(`create schema ${schema}`);
    await c.query(`set local search_path to ${schema}`);
    const files = readdirSync("db/migrations")
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const file of files) {
      if (file.startsWith("0005")) {
        await c.query(
          "insert into \"user\"(id,name,email,updated_at) values('sentinel','Old user','sentinel@bottles.test',now())",
        );
        await c.query(
          "insert into song(id,title,artist,note,colour,video,position,created_by) values('sentinel-song','Old song','Artist','','red','abcdefghijk',0,'sentinel')",
        );
      }
      await c.query(
        readFileSync(`db/migrations/${file}`, "utf8")
          .replaceAll('"public"."user"', `"${schema}"."user"`)
          .replaceAll("--> statement-breakpoint", "\n"),
      );
    }
    assert.equal(
      (await c.query("select name from \"user\" where id='sentinel'")).rows[0]
        .name,
      "Old user",
    );
    assert.equal(
      (await c.query("select title from song where id='sentinel-song'")).rows[0]
        .title,
      "Old song",
    );
    assert.equal(
      (await c.query("select count(*)::int as n from bottle_suggestion"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (await c.query("select count(*)::int as n from bottle_usage")).rows[0].n,
      0,
    );
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
});
test("actual HTTP persistence, authorized review, approve/reject and privacy", async () => {
  await clearUsage();
  const r = await suggest("persist");
  assert.equal(r.status, 201, await r.clone().text());
  const { id, status } = await r.json();
  assert.equal(status, "pending");
  const saved = (
    await pool.query("select * from bottle_suggestion where id=$1", [id])
  ).rows[0];
  assert.equal(saved.status, "pending");
  assert.match(saved.submitter_hmac, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(saved).includes("127.0.0.1"));
  assert.equal(
    (await publicPool()).bottles.some((b: { id: string }) => b.id === id),
    false,
  );
  const reconstructed = createBottleService({
    store: createPostgresBottleStore(pool),
    seeds: [],
    secret: process.env.BETTER_AUTH_SECRET!,
  });
  assert.ok(
    (
      await reconstructed.review("pending", null, {
        ...users.owner,
        role: "owner",
      })
    ).suggestions.some((b) => b.id === id),
  );
  await reason(await request("/api/admin/bottles"), 401, "unauthenticated");
  await reason(
    await request(
      `/api/admin/bottles/${id}`,
      { status: "approved" },
      "",
      {},
      "PATCH",
    ),
    401,
    "unauthenticated",
  );
  for (const path of [
    "/api/admin/bottles",
    "/api/admin/bottles?status=approved",
  ])
    await reason(
      await request(path, undefined, users.user.cookie),
      403,
      "forbidden",
    );
  await reason(await patch(id, "approved", "user"), 403, "forbidden");
  await reason(await patch("missing", "approved"), 404, "not_found");
  assert.equal((await patch(id, "approved", "admin")).status, 200);
  const published = await publicPool();
  assert.equal(published.degraded, false);
  const bottle = published.bottles.find((b: { id: string }) => b.id === id);
  assert.ok(bottle);
  assert.deepEqual(Object.keys(bottle).sort(), [
    "id",
    "kind",
    "note",
    "title",
    "url",
  ]);
  assert.equal((await patch(id, "rejected")).status, 200);
  assert.equal(
    (await publicPool()).bottles.some((b: { id: string }) => b.id === id),
    false,
  );
  await reason(await suggest("persist"), 409, "duplicate");
  const seed = JSON.parse(readFileSync("content/bottles.json", "utf8"))[0];
  delete seed.id;
  await reason(
    await request("/api/bottles/suggestions", seed),
    409,
    "duplicate",
  );
});
test("hostile payloads, streamed oversize, unsupported bodies, and forged origins/headers", async () => {
  await clearUsage();
  const count = async () =>
    Number(
      (await pool.query("select count(*)::int as n from bottle_suggestion"))
        .rows[0].n,
    );
  const before = await count();
  for (const url of [
    "https://127.1",
    "https://[::1]/",
    "https://foo.local/",
    "http://unsafe.org/",
    "https://user:pw@unsafe.org/",
    "https://unsafe.org/#frag",
    "https://unsafe.org/?utm_source=x",
    "https://unsafe.org:8443/",
  ])
    await reason(
      await request("/api/bottles/suggestions", { ...fixture("hostile"), url }),
      400,
      "url",
    );
  await reason(
    await request("/api/bottles/suggestions", {
      ...fixture("markup"),
      note: "<img src=x onerror=alert(1)>",
    }),
    400,
    "text",
  );
  await reason(
    await request("/api/bottles/suggestions", {
      ...fixture("huge-title"),
      title: "a".repeat(81),
    }),
    400,
    "text",
  );
  await reason(
    await request("/api/bottles/suggestions", {
      ...fixture("honey"),
      website: "bot",
    }),
    400,
    "honeypot",
  );
  await reason(await request("/api/bottles/suggestions", "{"), 400, "json");
  await reason(
    await request("/api/bottles/suggestions", fixture("text"), "", {
      "content-type": "text/plain",
    }),
    415,
    "unsupported_content",
  );
  for (const origin of ["", "null", "https://evil.dev"])
    await reason(
      await request("/api/bottles/suggestions", fixture("foreign"), "", {
        origin,
        "x-forwarded-host": "evil.dev",
      }),
      403,
      "origin",
    );
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new TextEncoder().encode(JSON.stringify(fixture("large"))));
      c.enqueue(new TextEncoder().encode(" ".repeat(8193)));
      c.close();
    },
  });
  await reason(
    await fetch(base + "/api/bottles/suggestions", {
      method: "POST",
      headers: { origin: base, "content-type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit),
    413,
    "oversized",
  );
  assert.equal(await count(), before);
});
test("concurrent HTTP cap accepts exactly five; spoofed headers cannot reset local bucket", async () => {
  await clearUsage();
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, n) =>
      suggest(`concurrent-${n}`, {
        "x-real-ip": `1.2.3.${n}`,
        "x-forwarded-for": `2.3.4.${n}`,
        "x-vercel-forwarded-for": `3.4.5.${n}`,
      }),
    ),
  );
  assert.equal(results.filter((r) => r.status === 201).length, 5);
  assert.equal(results.filter((r) => r.status === 429).length, 7);
  for (const r of results.filter((r) => r.status === 429)) {
    assert.equal((await r.json()).reason, "rate_limited");
    assert.ok(Number(r.headers.get("retry-after")) > 0);
  }
  const keys = submitterKeys(
    "unknown",
    new Date(),
    process.env.BETTER_AUTH_SECRET!,
  );
  assert.equal(
    (
      await pool.query("select count from bottle_usage where bucket=$1", [
        keys.bucket,
      ])
    ).rows[0].count,
    5,
  );
});
test("bounded cursor pages, approval revalidation and rights recheck at write time", async () => {
  const ids = Array.from({ length: 30 }, () => randomUUID());
  try {
    for (const id of ids)
      await pool.query(
        "insert into bottle_suggestion(id,url,title,note,kind,submitter_hmac) values($1,$2,'Review me','A small test.','toy','opaque')",
        [id, fixture(id).url],
      );
    const seen = new Set<string>();
    let cursor: string | null = null;
    do {
      const r = await request(
        `/api/admin/bottles?status=pending${cursor ? "&cursor=" + cursor : ""}`,
        undefined,
        users.owner.cookie,
      );
      assert.equal(r.status, 200);
      const page = await r.json();
      assert.ok(page.suggestions.length <= 25);
      for (const b of page.suggestions) {
        assert.ok(!seen.has(b.id));
        seen.add(b.id);
        assert.ok(!("submitter_hmac" in b));
      }
      cursor = page.nextCursor;
    } while (cursor);
    for (const id of ids) assert.ok(seen.has(id));
    await reason(
      await request(
        "/api/admin/bottles?cursor=%3Cbad%3E",
        undefined,
        users.owner.cookie,
      ),
      400,
      "cursor",
    );
    await reason(
      await request(
        "/api/admin/bottles?status=all",
        undefined,
        users.owner.cookie,
      ),
      400,
      "status",
    );
    await pool.query(
      "update bottle_suggestion set url='https://localhost/',note='<script>bad</script>' where id=$1",
      [ids[0]],
    );
    await reason(await patch(ids[0], "approved"), 400, "invalid");
    assert.equal((await patch(ids[0], "rejected")).status, 200);
    await pool.query("update \"user\" set role='user' where id=$1", [
      users.admin.id,
    ]);
    await reason(await patch(ids[1], "approved", "admin"), 403, "forbidden");
    // A stale service actor still cannot write: the adapter independently checks the current DB row.
    const service = createBottleService({
      store: createPostgresBottleStore(pool),
      seeds: [],
      secret: "test",
    });
    assert.equal(
      (
        await service.moderate(ids[1], "approved", {
          id: users.admin.id,
          role: "admin",
        })
      ).kind,
      "forbidden",
    );
  } finally {
    await pool.query("delete from bottle_suggestion where id=any($1::text[])", [
      ids,
    ]);
    await pool.query("update \"user\" set role='admin' where id=$1", [
      users.admin.id,
    ]);
  }
});
test("database outage returns all twelve seeds with an explicit degraded flag over HTTP", async () => {
  const c = await pool.connect();
  try {
    await c.query(
      "alter table bottle_suggestion rename to bottle_suggestion_offline",
    );
    const response = await publicPool();
    assert.equal(response.degraded, true);
    assert.equal(response.bottles.length, 12);
    await reason(await suggest("offline"), 503, "unavailable");
  } finally {
    await c.query(
      "alter table if exists bottle_suggestion_offline rename to bottle_suggestion",
    );
    c.release();
  }
});
test("admin browser controls are labelled, plain text, navigable and forbidden to ordinary users", async () => {
  await clearUsage();
  const r = await suggest("browser");
  assert.equal(r.status, 201);
  const { id } = await r.json();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  try {
    for (const cookie of users.owner.cookie.split("; ")) {
      const index = cookie.indexOf("=");
      await context.addCookies([
        {
          name: cookie.slice(0, index),
          value: cookie.slice(index + 1),
          url: base,
        },
      ]);
    }
    const page = await context.newPage();
    const external: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith(base)) external.push(r.url());
    });
    await page.goto(base + "/admin/bottles");
    await page.getByRole("heading", { name: "Bottles", exact: true }).waitFor();
    await page
      .getByRole("link", { name: "Bottles", exact: true })
      .first()
      .waitFor();
    // Browse to the row, retaining the bounded server pagination.
    let card = page.locator(`[data-bottle-id="${id}"]`);
    for (let i = 0; !(await card.count()) && i < 10; i++) {
      await page.getByRole("link", { name: "Next page", exact: true }).click();
      card = page.locator(`[data-bottle-id="${id}"]`);
    }
    assert.equal(await card.count(), 1);
    assert.equal(await card.locator('a[href^="https:"]').count(), 0);
    await card
      .getByRole("button", { name: "Approve Paper world", exact: true })
      .click();
    await page.getByRole("status").filter({ hasText: "Approved" }).waitFor();
    assert.ok(
      (await publicPool()).bottles.some((b: { id: string }) => b.id === id),
    );
    await page.getByRole("link", { name: "Approved", exact: true }).click();
    card = page.locator(`[data-bottle-id="${id}"]`);
    await card
      .getByRole("button", { name: "Reject Paper world", exact: true })
      .click();
    await page.getByRole("status").filter({ hasText: "Rejected" }).waitFor();
    assert.ok(
      !(await publicPool()).bottles.some((b: { id: string }) => b.id === id),
    );
    assert.deepEqual(external, []);
  } finally {
    await context.close();
  }
  const anonymous = await request("/admin/bottles");
  assert.equal(anonymous.status, 307);
  const userPage = await request(
    "/admin/bottles",
    undefined,
    users.user.cookie,
  );
  const html = await userPage.text();
  assert.match(html, /noindex/);
  assert.ok(!html.includes(fixture("browser").url));
  assert.doesNotMatch(html, /Approve Paper world/);
});

test("real handler and Postgres accept data with external fetch disabled (trap negative control)", async () => {
  const { bottlePost } = await import("../lib/bottles-http.ts");
  const seeds = JSON.parse(readFileSync("content/bottles.json", "utf8"));
  const service = createBottleService({
    store: createPostgresBottleStore(pool),
    seeds,
    secret: "integration-trap",
  });
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw Error("network trap");
  };
  try {
    await assert.rejects(
      fetch("https://bottle-review.org/control"),
      /network trap/,
    );
    assert.equal(calls, 1);
    calls = 0;
    const response = await bottlePost(
      new Request(base + "/api/bottles/suggestions", {
        method: "POST",
        headers: { origin: base, "content-type": "application/json" },
        body: JSON.stringify(fixture("no-fetch")),
      }),
      {
        service,
        seeds,
        env: {
          DATABASE_URL: process.env.DATABASE_URL,
          BETTER_AUTH_SECRET: "integration-trap",
          BETTER_AUTH_URL: base,
        },
        actor: async () => null,
      },
    );
    assert.equal(response.status, 201);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = original;
  }
});

test("curated precedence and canonical duplicates remain deterministic over HTTP", async () => {
  await clearUsage();
  const seed = JSON.parse(readFileSync("content/bottles.json", "utf8"))[0];
  const id = randomUUID();
  try {
    await pool.query(
      "insert into bottle_suggestion(id,url,title,note,kind,status,submitter_hmac) values($1,$2,'Duplicate seed','Should never replace the review.','site','approved','opaque')",
      [id, seed.url],
    );
    const result = await publicPool();
    const matching = result.bottles.filter(
      (b: { url: string }) => b.url === seed.url,
    );
    assert.deepEqual(matching, [seed]);
    const one = await suggest("canonical?a=1&b=2");
    assert.equal(one.status, 201);
    await reason(
      await request("/api/bottles/suggestions", {
        ...fixture("canonical?b=2&a=1"),
        url: fixture("canonical?b=2&a=1").url.replace(
          "https://bottle-review.org",
          "https://BOTTLE-REVIEW.ORG:443",
        ),
      }),
      409,
      "duplicate",
    );
  } finally {
    await pool.query("delete from bottle_suggestion where id=$1", [id]);
  }
});
