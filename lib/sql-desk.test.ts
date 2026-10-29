import assert from "node:assert/strict";
import { test } from "node:test";
import { boundedSql, savedRows } from "./sql-desk.ts";
import { publicSqlData } from "./sql-data.ts";
test("public export uses explicit fields and keeps private listening events empty", () => {
  const data = publicSqlData();
  assert.equal(data.tables.music_plays.length, 0);
  assert.ok(data.tables.commits.length > 0);
  assert.ok(data.tables.projects.every(p => Object.keys(p).join(",") === "title,note,status,href,started,shipped"));
  assert.doesNotMatch(JSON.stringify(data), /password|access_token|session_id/i);
  assert.equal(savedRows(data, "notes").reduce((n, r) => n + Number(r.notes), 0), data.tables.notes.length);
});
test("SQL accepts joins, CTEs, comments and quoted punctuation, with a result bound", () => {
  for (const query of ["SELECT * FROM notes;", "WITH n AS (SELECT count(*) FROM notes) SELECT * FROM n", "SELECT 'a; drop table notes' AS text", "/* nested /* comment */ ok */ SELECT 1 -- done"]) assert.match(boundedSql(query), /LIMIT 201$/);
});
test("SQL rejects mutation, file access, multiple statements and malformed input", () => {
  for (const query of ["", "DELETE FROM notes", "SELECT 1; DROP TABLE notes", "SELECT * FROM read_json('https://example.com')", "SELECT * FROM query('SELECT 1')", "WITH n AS (DELETE FROM notes) SELECT * FROM n", "SELECT 'unclosed", "/* unclosed", "SELECT " + "1".repeat(8001)]) assert.throws(() => boundedSql(query));
});
