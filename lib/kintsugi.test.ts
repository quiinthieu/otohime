import test from "node:test";
import assert from "node:assert/strict";
import { fractures, rageClick, validSeam } from "./kintsugi.ts";
import { kintsugiGet, kintsugiPost, seamBuckets } from "./kintsugi-http.ts";

test("fractures are deterministic, originate at contact and remain bounded", () => {
  const seam = { seed: 42, x: 27, y: 61 };
  assert.deepEqual(fractures(seam), fractures(seam));
  assert.notDeepEqual(fractures(seam), fractures({ ...seam, seed: 43 }));
  for (const line of fractures(seam)) {
    assert.ok(line.startsWith("M27.00,61.00"));
    assert.ok(line.match(/\d+\.\d+/g)!.map(Number).every(n => n >= 0 && n <= 100));
  }
  for (const value of [null, {}, { ...seam, seed: -1 }, { ...seam, x: NaN }, { ...seam, y: 101 }]) assert.equal(validSeam(value), false);
});
test("rage-click requires four clustered recent clicks", () => {
  let hits: { at:number;x:number;y:number }[] = [];
  for (let i = 0; i < 4; i++) { const r = rageClick(hits, { at: i * 100, x: 20, y: 20 }); hits = r.hits; assert.equal(r.triggered, i === 3); }
  assert.equal(rageClick(hits, { at: 2000, x: 20, y: 20 }).triggered, false);
  assert.equal(rageClick(hits, { at: 400, x: 100, y: 20 }).triggered, false);
});
test("API bounds untrusted bodies and distinguishes unavailable and limited storage", async () => {
  const seam = { seed: 42, x: 27, y: 61 };
  let writes = 0;
  const store = { list: async () => [], mend: async () => { writes++; return "accepted" as const; } };
  const req = (body: unknown, origin = "https://otohime.dev") => new Request("https://otohime.dev/api/kintsugi", { method: "POST", headers: { origin, "content-type":"application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  assert.equal((await kintsugiPost(req({ id:"demo:golden-paper", seam }), store, "secret")).status, 201);
  assert.equal((await kintsugiPost(req({ id:"invented", seam }), store, "secret")).status, 400);
  assert.equal((await kintsugiPost(req("{"), store, "secret")).status, 400);
  assert.equal((await kintsugiPost(req(" ".repeat(513)), store, "secret")).status, 413);
  assert.equal((await kintsugiPost(req({ seam }, "https://foreign.test"), store, "secret")).status, 403);
  assert.equal(writes, 1);
  assert.equal((await kintsugiPost(req({ id:"demo:golden-paper", seam }), { ...store, mend: async () => "limited" }, "secret")).status, 429);
  assert.equal((await kintsugiPost(req({ seam }), undefined, "secret")).status, 503);
  assert.equal((await kintsugiGet({ ...store, list: async () => { throw Error("offline"); } })).status, 503);
  const keys = seamBuckets("private-ip", "demo:golden-paper", "secret", new Date("2026-10-29T06:00Z"));
  assert.ok(keys.every(k => !k.includes("private-ip")));
});
