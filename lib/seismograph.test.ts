import test from "node:test";
import assert from "node:assert/strict";
import { inkTimeRange, magnitude, parseInkEvents, stripSvg, tracePath, WINDOW_MS, type InkEvent } from "./seismograph.ts";
const sample: InkEvent = { id:"pipeline:1", at:"2026-10-29T06:00:00Z", kind:"pipeline", label:"A <failed> & job", url:"https://github.com/quiinthieu/otohime/actions/runs/1", failed:true, durationMs:32000, rows:0 };
test("trace time bounds follow refreshed events and retain a valid empty archive", () => {
  const generated = sample.at, latest = Date.parse(generated);
  assert.deepEqual(inkTimeRange([],generated),{latest,minEnd:latest,maxEnd:latest+WINDOW_MS/4});
  const older = {...sample,id:"older",at:"2026-10-28T06:00:00Z"};
  assert.equal(inkTimeRange([older,sample],generated).minEnd,Date.parse(older.at)+WINDOW_MS);
  const shifted = {...sample,at:"2026-11-12T06:00:00Z"};
  const next = inkTimeRange([shifted],generated);
  assert.equal(next.latest,Date.parse(shifted.at));
  assert.ok(next.minEnd>latest,"an old cursor can fall outside the live domain after refresh");
});
test("event parser rejects unsafe sources and invalid magnitudes, deduplicates and orders", () => {
  const parsed = parseInkEvents([sample, sample, {...sample,id:"bad",durationMs:Infinity}, {...sample,id:"url",url:"javascript:alert(1)"}, {...sample,id:"time",at:"invalid"}, {...sample,id:"old",at:"2026-10-28T06:00:00Z"}]);
  assert.deepEqual(parsed.map(e => e.id), ["old","pipeline:1"]);
});
test("larger real jobs make larger bounded tremors", () => {
  assert.ok(magnitude({...sample,durationMs:1000000}) > magnitude(sample));
  assert.ok(magnitude({...sample,rows:100000}) > magnitude(sample));
  assert.ok(magnitude({...sample,rows:1e12,durationMs:1e12}) <= 76);
});
test("static trace and printable export preserve a selected window and escape labels", () => {
  const end = Date.parse(sample.at)+60000;
  assert.equal(tracePath([sample],end), tracePath([sample],end));
  assert.notEqual(tracePath([sample],end), tracePath([],end));
  assert.ok(!tracePath([sample],end).includes("NaN"));
  const svg = stripSvg([sample],end);
  assert.ok(svg.includes('xmlns="http://www.w3.org/2000/svg"'));
  assert.ok(svg.includes("&lt;failed&gt; &amp; job"));
  assert.ok(svg.includes('fill="#a33e32"'));
  assert.ok(!stripSvg([sample],end+WINDOW_MS).includes("&lt;failed&gt;"));
});
