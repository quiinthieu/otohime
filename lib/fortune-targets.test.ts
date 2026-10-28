import assert from "node:assert/strict";
import test from "node:test";
import { buildFortuneTargets, noteTargetId, sketchTargetId, songTargetId, projectTargetId } from "./fortune-targets.ts";
import { site } from "../content/site.ts";

test("stable ids use source identities, not list positions", () => {
  assert.equal(noteTargetId("2026-10-12"), "fortune-note-323032362d31302d3132");
  assert.equal(songTargetId("IXA6bQsVNjs"), "fortune-song-49584136625173564e6a73");
  assert.notEqual(sketchTargetId("/a/b.png"), sketchTargetId("/a-b.png"));
  assert.notEqual(projectTargetId("A/B"), projectTargetId("A-B"));
});

test("pool includes each live source kind and owner songs", () => {
  const input = { projects: [{ title: "Shore", href: "/shore" }, { title: "Future" }], notes: [{ date: "2026-10-12", title: "Margin" }], sketches: [{ src: "/lake.png", title: "Lake" }], songs: [{ video: "IXA6bQsVNjs", title: "Song" }], ownerSongs: [{ video: "agneRtEe-t8", title: "Added" }], articles: [{ slug: "tides", headline: "Tides" }] };
  const pool = buildFortuneTargets(input);
  assert.deepEqual(pool.map((x) => x.kind), ["project", "project", "note", "sketch", "song", "song", "article"]);
  assert.deepEqual(pool.map((x) => x.href), ["/shore", `/projects#${projectTargetId("Future")}`, `/notes#${noteTargetId("2026-10-12")}`, `/sketches#${sketchTargetId("/lake.png")}`, `/music#${songTargetId("IXA6bQsVNjs")}`, `/music#${songTargetId("agneRtEe-t8")}`, "/articles/tides"]);
  assert.equal(pool[5].label, "Added");
});

test("invalid identities and unsafe URLs are excluded; collisions dedupe", () => {
  const pool = buildFortuneTargets({ projects: [{ title: "Bad", href: "https://evil.test" }, { title: "Safe", href: "/safe" }, { title: "Safe", href: "/safe" }, { title: "Trick", href: "/%2f%2fevil" }], notes: [{ date: "2026-10-12", title: "A" }, { date: "2026-10-12", title: "B" }, { date: "bogus", title: "No" }], sketches: [{ src: "/a", title: "A" }, { src: "/a", title: "B" }], songs: [{ video: "IXA6bQsVNjs", title: "A" }, { video: "IXA6bQsVNjs", title: "B" }, { video: "javascript:1", title: "Bad" }], articles: [{ slug: "good-slug", headline: "Good" }, { slug: "../bad", headline: "Bad" }] });
  assert.deepEqual(pool.map((x) => x.label), ["Safe", "A", "A", "A", "Good"]);
  for (const target of pool) assert.match(target.href, /^\/(?!\/)[^\\\s]*$/);
  assert.deepEqual(buildFortuneTargets({}), []);
});

test("current site sources produce a safe pool with stable identities", () => {
  const pool = buildFortuneTargets({ projects: site.projectList, notes: site.notes, sketches: site.sketches, songs: site.songs });
  assert.ok(pool.length >= site.projectList.length + site.notes.length + site.sketches.length + site.songs.length);
  assert.equal(new Set(pool.map((target) => target.id)).size, pool.length);
  assert.ok(pool.every((target) => target.href.startsWith("/") && !target.href.startsWith("//")));
  const reversed = buildFortuneTargets({ notes: [...site.notes].reverse() });
  assert.deepEqual(new Set(reversed.map((target) => target.id)), new Set(buildFortuneTargets({ notes: site.notes }).map((target) => target.id)));
});
