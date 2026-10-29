import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { parseContributions, refresh } from "./fetch-contributions.mjs";
const html = (dates) => dates.map(([date, count], i) => `<td id="d${i}" data-date="${date}"></td><tool-tip for="d${i}">${count || "No"} contributions on October.</tool-tip>`).join("");
test("public activity parser includes quiet and incomplete weeks", () => {
  const result = parseContributions(html([["2026-10-25", 0], ["2026-10-26", 2]]), new Date("2026-10-26"));
  assert.deepEqual(result.weeks, [{ week: "2026-W43", count: 0 }, { week: "2026-W44", count: 2 }]);
  assert.equal(result.through, "2026-10-26");
  assert.throws(() => parseContributions("<html>rate limited</html>"));
  assert.throws(() => parseContributions(html([["2026-10-23", 1], ["2026-10-25", 2]])));
});
test("contribution refresh failures preserve the committed snapshot", async () => {
  const dir = await mkdtemp(`${tmpdir()}/bonsai-data-`);
  const destination = pathToFileURL(`${dir}/snapshot.json`);
  await writeFile(destination, "baseline");
  try {
    for (const fetcher of [async () => { throw new Error("offline"); }, async () => new Response("bad html"), async () => new Response("denied", { status: 403 })]) {
      await assert.rejects(refresh({ destination, fetcher }));
      assert.equal(await readFile(destination, "utf8"), "baseline");
    }
    const now = new Date("2026-10-29");
    const days = Array.from({ length: 365 }, (_, i) => [new Date(+now - (364 - i) * 86400000).toISOString().slice(0, 10), i % 3]);
    await refresh({ destination, now, fetcher: async () => new Response(html(days)) });
    assert.equal(JSON.parse(await readFile(destination, "utf8")).through, "2026-10-29");
  } finally { await rm(dir, { recursive: true, force: true }); }
});
