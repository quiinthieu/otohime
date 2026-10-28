import assert from "node:assert/strict";
import { test } from "node:test";
import { site } from "../../../../../content/site.ts";
import { noteBySlug } from "./notes.ts";

// These are the original published values; tagging must not rewrite the notes.
const originals = [
  {
    slug: "backfills-are-a-feature",
    date: "2026-10-12",
    title: "Backfills are a feature",
    body: "Two years of events, replayed in an afternoon, because the jobs were idempotent from day one.",
  },
  {
    slug: "on-twos",
    date: "2026-09-28",
    title: "On twos",
    body: "The figures here animate at twelve frames a second, like hand-drawn film. Smoother looked worse.",
  },
  {
    slug: "the-contract-caught-it",
    date: "2026-09-03",
    title: "The contract caught it",
    body: "A data contract stopped a breaking change before anyone opened a dashboard. First time. Worth it.",
  },
];

test("each original note has a stable address and retains its exact copy", () => {
  assert.deepEqual(site.notes.map(({ slug, date, title, body }) => ({ slug, date, title, body })), originals);
  for (const original of originals) {
    const note = noteBySlug(original.slug);
    assert.ok(note);
    assert.equal(note.title, original.title);
    assert.equal(note.date, original.date);
    assert.equal(note.body, original.body);
  }
});

test("published slugs are unique URL segments and each resolves to its own note", () => {
  assert.equal(new Set(site.notes.map(({ slug }) => slug)).size, site.notes.length);
  for (const note of site.notes) {
    assert.match(note.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(noteBySlug(note.slug), note);
  }
});

test("an unknown or near-match slug cannot open a different note", () => {
  for (const slug of ["missing-note", "", "backfills", "Backfills are a feature", "ON-TWOS", "on-twos/", " on-twos", "constructor", "__proto__", "sky"]) {
    assert.equal(noteBySlug(slug), undefined, slug);
  }
});

test("editorial tags describe the text and share the data-engineering topic", () => {
  for (const note of site.notes) {
    assert.ok(note.tags.length > 0);
    assert.equal(new Set(note.tags).size, note.tags.length);
    for (const tag of note.tags) assert.match(tag, /^[a-z]+(?:-[a-z]+)*$/);
  }
  assert.ok(noteBySlug("backfills-are-a-feature")!.tags.includes("data-engineering"));
  assert.ok(noteBySlug("the-contract-caught-it")!.tags.includes("data-engineering"));
  assert.deepEqual(noteBySlug("on-twos")!.tags, ["animation", "hand-drawn"]);
});
