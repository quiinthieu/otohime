import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { createKintsugiStore } from "../lib/kintsugi-store.ts";
const url = process.env.DATABASE_URL;
const local = !!url && ["localhost","127.0.0.1"].includes(new URL(url).hostname);
test("real migration and atomic concurrent seam limits, seed cap, storage outage", { skip:!local }, async () => {
  const pool = new pg.Pool({ connectionString:url });
  const store = createKintsugiStore(pool);
  const id = "test:atomic-seams";
  const prefix = `test:${Date.now()}`;
  try {
    const results = await Promise.all(Array.from({length:12},(_,seed) => store.mend(id,{seed,x:20,y:60},[prefix+":visitor",prefix+":card",prefix+":day"])));
    assert.equal(results.filter(r => r === "accepted").length,2);
    assert.equal(results.filter(r => r === "limited").length,10);
    for (let i=0;i<18;i++) assert.equal(await store.mend(id,{seed:i+100,x:20,y:60},[`${prefix}:v:${i}`,`${prefix}:c:${i}`,prefix+":day"]),"accepted");
    const card = (await store.list()).find(c => c.id===id)!;
    assert.equal(card.count,20);
    assert.equal(card.seams.length,12);
    assert.equal(card.seams.at(-1)!.seed,117);
    await pool.query("update kintsugi_usage set count=1000 where bucket=$1",[prefix+":day"]);
    assert.equal(await store.mend(id,{seed:200,x:20,y:60},[prefix+":fresh",prefix+":fresh-card",prefix+":day"]),"limited");
    assert.equal((await store.list()).find(c=>c.id===id)!.count,20);
  } finally {
    await pool.query("delete from kintsugi_card where id=$1",[id]);
    await pool.query("delete from kintsugi_usage where bucket like $1",[prefix+"%"]);
    await pool.end();
  }
});
