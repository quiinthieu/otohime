import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { after, before, test } from "node:test";
import pg from "pg";
import { chromium, type Browser } from "playwright-core";
import { site } from "../content/site.ts";
import { buildFortuneTargets } from "../lib/fortune-targets.ts";

const base = process.env.BASE_URL ?? "http://localhost:4000";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const marker = randomUUID().slice(0, 8);
const temp = mkdtempSync("/tmp/guestbook-fortune-");
let browser: Browser;
let entryId = "";
let userId = "";

before(async () => { browser = await chromium.launch({ channel: "chrome", env: { ...process.env, TMPDIR: temp } }); });
after(async () => {
  await browser?.close();
  if (entryId) await pool.query("delete from guestbook_entry where id=$1", [entryId]);
  if (userId) await pool.query('delete from "user" where id=$1', [userId]);
  await pool.end();
  rmSync(temp, { recursive: true, force: true });
});

test("visitor drawing waits for owner approval and appears as replayable vector art", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const response = await page.goto(`${base}/guestbook`);
  assert.equal(response?.status(), 200);
  await page.getByLabel("Name (optional)").fill(`Ink QA ${marker}`);
  await page.getByLabel("One-line note (optional)").fill("A small wave");
  const box = await page.locator(".guestbook-canvas").boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + 35, box.y + 50);
  await page.mouse.down();
  await page.mouse.move(box.x + 90, box.y + 80, { steps: 8 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Pin for review" }).click();
  await page.getByRole("status").getByText(/waiting for the owner/).waitFor();
  const row = await pool.query<{ id: string; status: string; strokes: unknown }>("select id,status,strokes from guestbook_entry where name=$1", [`Ink QA ${marker}`]);
  assert.equal(row.rows.length, 1);
  entryId = row.rows[0].id;
  assert.equal(row.rows[0].status, "pending");
  assert.ok(Array.isArray(row.rows[0].strokes));
  const hidden = await (await fetch(`${base}/api/guestbook`)).json();
  assert.ok(!hidden.entries.some((entry: { id: string }) => entry.id === entryId));

  const signUp = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST", headers: { origin: base, "content-type": "application/json" },
    body: JSON.stringify({ name: "Ink owner", email: `pm273-${marker}@guestbook.test`, password: `test-password-${marker}` }),
  });
  assert.equal(signUp.status, 200, await signUp.clone().text());
  userId = (await signUp.json()).user.id;
  await pool.query('update "user" set role=$2 where id=$1', [userId, "owner"]);
  const cookie = signUp.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  const denied = await fetch(`${base}/api/admin/guestbook/${entryId}`, { method: "PATCH", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ status: "approved" }) });
  assert.equal(denied.status, 401);
  assert.ok(cookie);
  await page.context().addCookies(cookie.split("; ").map((pair) => {
    const at = pair.indexOf("=");
    return { name: pair.slice(0, at), value: pair.slice(at + 1), url: base };
  }));
  await page.goto(`${base}/admin/guestbook`);
  const review = page.locator(`[data-guestbook-id="${entryId}"]`);
  await review.getByRole("button", { name: "Approve" }).click();
  await review.waitFor({ state: "detached" });
  assert.equal((await pool.query("select status from guestbook_entry where id=$1", [entryId])).rows[0].status, "approved");
  await page.goto(`${base}/guestbook`);
  await page.getByText(`Ink QA ${marker}`).waitFor();
  const publicCard = page.locator(".guestbook-wall .guestbook-card").filter({ hasText: `Ink QA ${marker}` });
  assert.ok(await publicCard.locator("svg path").count() > 0);
  await publicCard.focus();
  assert.equal(await publicCard.evaluate((element) => getComputedStyle(element.querySelector("path")!).animationName), "guestbook-draw");
  await page.close();
});

test("fortune completes by keyboard and its revealed link resolves", async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const response = await page.goto(`${base}/fortune`);
  assert.equal(response?.status(), 200);
  await page.getByRole("button", { name: "Pinch the paper open or closed" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "coral" }).click();
  await page.getByRole("button", { name: "Finish counting" }).click();
  await page.getByRole("group", { name: "Choose a number" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Finish counting" }).click();
  await page.getByRole("group", { name: "Choose a number" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Lift the flap" }).click();
  const link = page.getByRole("link", { name: /^Visit / });
  const href = await link.getAttribute("href");
  if (!href || !href.startsWith("/")) throw Error("Fortune did not reveal a local link");
  await link.click();
  await page.waitForURL((url) => url.pathname === new URL(href, base).pathname);
  if (href.includes("#")) assert.equal(await page.locator(`#${href.split("#")[1]}`).count(), 1);
  await page.close();
});

test("every fortune content kind has a live destination, including reduced motion", async () => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const kind of ["project", "note", "sketch", "song"] as const) {
    const target = buildFortuneTargets({ projects: site.projectList, notes: site.notes, sketches: site.sketches, songs: site.songs }).find((item) => item.kind === kind);
    assert.ok(target, kind);
    const response = await page.goto(new URL(target.href, base).toString());
    assert.equal(response?.status(), 200, target.href);
    if (target.href.includes("#")) await page.locator(`[id="${target.href.split("#")[1]}"]`).waitFor();
  }
  await page.goto(`${base}/fortune`);
  await page.getByRole("button", { name: "blue" }).click();
  await page.getByRole("group", { name: "Choose a number" }).getByRole("button").first().waitFor();
  assert.equal(await page.getByRole("button", { name: "Finish counting" }).count(), 0);
  await context.close();
});
