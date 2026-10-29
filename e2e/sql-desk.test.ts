import assert from "node:assert/strict";
import { test } from "node:test";
import { BASE, open, shot, noOverflow } from "./paper-experiments-helpers.ts";

test("SQL desk defers WASM, runs real DuckDB joins and saved queries, bounds output and rejects unsafe SQL", { timeout: 120000 }, async () => {
  const { page, context, errors } = await open("/ledger/sql");
  try {
    assert.equal(await page.evaluate(() => performance.getEntriesByType("resource").filter(r => /duckdb.*\.(wasm|worker\.js)/.test(r.name)).length), 0);
    const network: string[] = []; page.on("request", r => { if (!r.url().startsWith(BASE)) network.push(r.url()); });
    await page.getByRole("button", { name: "Open DuckDB", exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-sql-state="ready"]') || document.querySelector(".sql-error"), undefined, { timeout: 60000 });
    assert.equal(await page.locator(".sql-desk").getAttribute("data-sql-state"), "ready", (await page.locator(".sql-error").allTextContents()).join("\n"));
    const query = page.getByLabel("Write a query", { exact: true });
    await query.fill("SELECT n.title, count(p.title) AS projects FROM notes n CROSS JOIN projects p GROUP BY n.title ORDER BY n.title");
    await page.getByRole("button", { name: "Run SQL" }).click();
    await page.getByRole("status").filter({ hasText: "DuckDB receipt" }).waitFor();
    assert.equal(await page.locator(".sql-results tbody tr").count(), 3);
    await page.getByRole("button", { name: "Sketchbook census" }).click();
    await page.getByRole("status").filter({ hasText: "DuckDB receipt" }).waitFor();
    assert.ok(await page.locator(".sql-chart path").count() > 1);
    await shot(page, "sql-desktop");
    await query.fill("SELECT * FROM range(500)"); await query.press("Control+Enter");
    await page.getByRole("status").filter({ hasText: "display capped" }).waitFor();
    assert.equal(await page.locator(".sql-results tbody tr").count(), 200);
    await query.fill("SELECT * FROM read_json('https://example.com/private')");
    await page.getByRole("button", { name: "Run SQL" }).click();
    await page.getByRole("alert").filter({ hasText: "read-only SELECT" }).waitFor();
    await query.fill("SELECT current_setting('enable_external_access') AS external_access");
    await page.getByRole("button", { name: "Run SQL" }).click();
    await page.waitForFunction(() => document.querySelector(".sql-results tbody td")?.textContent === "false");
    assert.deepEqual(network, [], "SQL desk uses only same-origin resources");
    await query.fill("WITH RECURSIVE forever(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM forever) SELECT sum(n) FROM forever");
    await page.getByRole("button", { name: "Run SQL" }).click();
    await page.getByRole("alert").filter({ hasText: "time limit" }).waitFor({ timeout: 15000 });
    await page.locator('[data-sql-state="closed"]').waitFor();
    await page.getByRole("button", { name: "Open DuckDB", exact: true }).click();
    await page.locator('[data-sql-state="ready"]').waitFor({ timeout: 60000 });
    await query.fill("SELECT count(*) AS notes FROM notes");
    await page.getByRole("button", { name: "Run SQL" }).click();
    await page.waitForFunction(() => document.querySelector(".sql-results tbody td")?.textContent === "3");
    await query.fill("WITH RECURSIVE forever(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM forever) SELECT sum(n) FROM forever");
    await page.getByRole("button", { name: "Run SQL" }).click();
    await page.getByRole("button", { name: "Cancel query", exact: true }).click();
    await page.getByRole("button", { name: "Open DuckDB", exact: true }).click();
    await page.locator('[data-sql-state="ready"]').waitFor({ timeout: 60000 });
    await query.fill("SELECT 'new session' AS receipt");
    await page.getByRole("button", { name: "Run SQL" }).click();
    await page.waitForFunction(() => document.querySelector(".sql-results tbody td")?.textContent === "new session");
    // Observe past the cancelled query's real six-second deadline: it must not overwrite the new session.
    await page.waitForTimeout(6500);
    assert.equal(await page.locator(".sql-desk").getAttribute("data-sql-state"), "ready");
    const alerts = page.getByRole("region", { name: "SQL desk", exact: true }).getByRole("alert");
    assert.equal(await alerts.count(), 0, (await alerts.allTextContents()).join("\n"));
    assert.equal(await page.locator(".sql-results tbody td").textContent(), "new session");
    assert.deepEqual(errors.unexpected, []);
  } finally { await context.close(); }
});

test("SQL saved receipts work offline or without JS and the page fits a phone", { timeout: 60000 }, async () => {
  const { page, context, errors } = await open("/ledger/sql", { phone: true, reduced: true });
  try {
    await page.getByRole("button", { name: "Projects on the shelf" }).click();
    assert.match(await page.locator(".sql-results").innerText(), /live/);
    assert.ok(await noOverflow(page)); await shot(page, "sql-phone");
    assert.deepEqual(errors.unexpected, []);
    await page.route("**/vendor/duckdb/**", route => route.abort());
    await page.getByRole("button", { name: "Open DuckDB", exact: true }).click();
    await page.locator('[data-sql-state="closed"]').waitFor({ timeout: 40000 });
    await page.getByRole("button", { name: "Notes by month" }).click();
    assert.equal(await page.locator(".sql-results tbody tr").count(), 2);
    // Failed worker fetches are deliberate in this negative control; happy paths above require a clean console.
  } finally { await context.close(); }
  const nojs = await open("/ledger/sql", { js: false });
  try { assert.equal(await nojs.page.locator(".sql-results tbody tr").count(), 2); assert.deepEqual(nojs.errors.unexpected, []); } finally { await nojs.context.close(); }
});
