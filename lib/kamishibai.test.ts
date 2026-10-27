import assert from "node:assert/strict";
import { test } from "node:test";
import { site } from "../content/site.ts";
import { projectStories } from "../content/project-stories.ts";
import { acceptsArrow, advanceCard, selectProject } from "./kamishibai.ts";
test("every directory project has substantive, uniquely identified, source-only ink cards", () => {
  assert.deepEqual(Object.keys(projectStories).sort(), site.projectList.map(p => p.href).sort());
  const ids = new Set<string>();
  for (const p of site.projectList) {
    const s = projectStories[p.href!];
    assert.equal(s.href, p.href); assert.equal(s.title, p.title); assert.ok(s.cards.length >= 3);
    for (const c of s.cards) {
      assert.ok(!ids.has(c.id)); ids.add(c.id);
      assert.match(c.id, /^[a-z][a-z0-9-]+$/); assert.ok(c.title.length > 8);
      assert.ok(c.caption.length > 100); assert.doesNotMatch(c.caption, /<|>|https?:/);
      assert.ok(c.art.length > 0);
      for (const d of c.art) { assert.match(d, /^M[\d\s.,MLQTAZ-]+$/); }
    }
  }
});
test("state is bounded, project selection resets and arrows are scoped", () => {
  assert.equal(advanceCard(0, -1, 3), 0); assert.equal(advanceCard(2, 1, 3), 2);
  assert.equal(advanceCard(0, 1, 3), 1); assert.equal(advanceCard(NaN, 1, 3), 0);
  assert.equal(advanceCard(1, 1, NaN), 0);
  assert.deepEqual(selectProject('/rotor'), { project: '/rotor', card: 0 });
  for (const tagName of ['INPUT','TEXTAREA','SELECT']) assert.equal(acceptsArrow({tagName,blocked:false}, 'ArrowRight'), false);
  assert.equal(acceptsArrow({tagName:'BUTTON',blocked:true}, 'ArrowRight'), false);
  assert.equal(acceptsArrow({tagName:'BUTTON',blocked:false}, 'ArrowRight'), true);
  assert.equal(acceptsArrow({tagName:'BUTTON',blocked:false}, 'Escape'), false);
});
