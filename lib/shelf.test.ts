import assert from "node:assert/strict";
import test from "node:test";
import type { Note, Project } from "../content/site.ts";
import { site } from "../content/site.ts";
import {
  buildShelfBooks, projectBookScreenRect, shelfBookExtent, shelfRowCount,
  SHELF_WIDTH, SHELF_MARGIN, SHELF_BOOK_GAP, SHELF_ROW_GAP,
} from "./shelf.ts";

function projects(count: number): Project[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Project ${i}`, href: `/project-${i}`, note: "long".repeat(i * 100),
    colour: "mint", status: "live", shipped: `2026-10-${String(i % 28 + 1).padStart(2, "0")}`,
  }));
}
const note: Note = { slug: "field-notes", title: "Field notes", body: "Some words.", date: "2026-10-29", tags: ["ink"] };

test("all current linked projects and notes become books with correct routes and newest-left order", () => {
  const books = buildShelfBooks(site.projectList, site.notes);
  assert.equal(books.length, site.projectList.filter((p) => p.href).length + site.notes.length);
  assert.deepEqual(new Set(books.map((b) => b.href)), new Set([
    ...site.projectList.flatMap((p) => p.href ? [p.href] : []), ...site.notes.map((n) => `/notes/${n.slug}`),
  ]));
  for (let i = 1; i < books.length; i++) assert.ok(books[i - 1].date >= books[i].date);
  const combined = buildShelfBooks(projects(2), [note]);
  assert.equal(combined[0].id, "note-field-notes");
  assert.equal(combined[0].href, "/notes/field-notes");
  assert.equal(combined[0].subtitle, note.body);
});

test("packing fits tilted book extents within 3–4 planks with no overlap, including maximum thickness", () => {
  for (const count of [0, 1, 2, 3, 14, 29, 30, 31, 39, 40, 100]) {
    const books = buildShelfBooks(projects(count), []);
    const rows = shelfRowCount(books.length);
    assert.equal(rows, books.length > 30 ? 4 : 3);
    for (let row = 0; row < rows; row++) {
      const packed = books.filter((b) => b.row === row);
      let right = -SHELF_WIDTH / 2 + SHELF_MARGIN;
      for (const book of packed) {
        const extent = shelfBookExtent(book);
        assert.ok(book.x - extent.width / 2 >= right - 1e-9);
        right = book.x + extent.width / 2;
        assert.ok(right <= SHELF_WIDTH / 2 - SHELF_MARGIN);
        right += SHELF_BOOK_GAP;
        assert.ok(extent.height < SHELF_ROW_GAP);
        assert.ok(Math.abs(book.y - extent.height / 2 + row * SHELF_ROW_GAP) < 1e-9);
        assert.equal(book.z, 0);
      }
    }
    assert.ok(books.every((b) => b.row >= 0 && b.row <= 3));
    if (books.length >= 3) assert.equal(new Set(books.map((b) => b.row)).size, rows);
  }
});

test("dimensions and tilt are deterministic, input-order independent, content-sensitive and immutable", () => {
  const input = projects(15);
  const before = structuredClone(input);
  const first = buildShelfBooks(input, [note]);
  assert.deepEqual(first, buildShelfBooks([...input].reverse(), [note]));
  assert.deepEqual(input, before);
  assert.ok(new Set(first.map((b) => b.tiltRad)).size > 2);
  assert.ok(first.every((b) => b.thickness >= 0.46 && b.thickness <= 0.78 && Math.abs(b.tiltRad) <= 0.045));
  const short = buildShelfBooks([], [note])[0];
  const long = buildShelfBooks([], [{ ...note, body: note.body.repeat(20), tags: ["ink", "paper"] }])[0];
  assert.ok(long.thickness > short.thickness);
  assert.equal(long.tiltRad, short.tiltRad);
  assert.equal(long.height, short.height);
});

test("caps at 40, respects smaller caps, omits unlinked projects and deduplicates identities across input", () => {
  assert.equal(buildShelfBooks(projects(50), [note]).length, 40);
  assert.equal(buildShelfBooks(projects(50), [note], 100).length, 40);
  for (const cap of [0, -1, NaN]) assert.equal(buildShelfBooks(projects(3), [note], cap).length, 0);
  assert.equal(buildShelfBooks(projects(9), [note], 4.9).length, 4);
  const project = { ...projects(1)[0], href: "/field-notes" };
  const books = buildShelfBooks([project, project, { ...project, href: undefined }], [note, note]);
  assert.equal(books.length, 2);
  assert.deepEqual(new Set(books.map((b) => b.viewTransitionName)), new Set(["project-field-notes", "note-field-notes"]));
  const many = buildShelfBooks(projects(40), [note]);
  assert.equal(new Set(many.map((b) => b.viewTransitionName)).size, many.length);
});

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
// 90-degree vertical FOV, aspect=1, near=1, far=10, looks down -Z.
const perspective = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -11 / 9, -1, 0, 0, -20 / 9, 0];
const bounds = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => ({ min: { x: x0, y: y0, z: z0 }, max: { x: x1, y: y1, z: z1 } });
const viewport = { width: 800, height: 600 };
function close(actual: number, expected: number) { assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`); }

test("orthographic projection maps all corners to CSS pixels with inverted Y and optional viewport offset", () => {
  assert.deepEqual(projectBookScreenRect(bounds(-0.5, -0.25, -0.5, 0.5, 0.75, 0.5), identity, viewport), {
    left: 200, top: 75, width: 400, height: 300, visible: true,
  });
  const translated = [...identity]; translated[12] = 0.25;
  const rect = projectBookScreenRect(bounds(-0.5, -0.5, 0, 0.5, 0.5, 0.5), translated, { ...viewport, left: 10, top: 20 });
  assert.deepEqual(rect, { left: 310, top: 170, width: 400, height: 300, visible: true });
});

test("perspective projection uses the nearest corners and clips near-plane crossings before division", () => {
  const front = projectBookScreenRect(bounds(-0.5, -0.5, -3, 0.5, 0.5, -2), perspective, viewport);
  close(front.left, 300); close(front.top, 225); close(front.width, 200); close(front.height, 150);
  assert.equal(front.visible, true);
  const crossing = projectBookScreenRect(bounds(-0.5, -0.5, -2, 0.5, 0.5, 0.5), perspective, viewport);
  close(crossing.left, 200); close(crossing.top, 150); close(crossing.width, 400); close(crossing.height, 300);
  assert.equal(crossing.visible, true);
});

test("a rotated MVP includes extremal corners beyond the box diagonal endpoints", () => {
  const c = Math.SQRT1_2;
  const rotated = [c, c, 0, 0, -c, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const rect = projectBookScreenRect(bounds(-0.5, -0.5, -0.5, 0.5, 0.5, 0.5), rotated, viewport);
  close(rect.left, (1 - c) * 400); close(rect.top, (1 - c) * 300);
  close(rect.width, c * 800); close(rect.height, c * 600);
  assert.equal(rect.visible, true);
});

test("clamps partial books, handles enclosing frusta and rejects offscreen, behind-camera and far-clipped books", () => {
  assert.deepEqual(projectBookScreenRect(bounds(0.5, -2, -0.5, 2, 2, 0.5), identity, viewport), {
    left: 600, top: 0, width: 200, height: 600, visible: true,
  });
  assert.deepEqual(projectBookScreenRect(bounds(-100, -100, -100, 100, 100, 100), perspective, viewport), {
    left: 0, top: 0, width: 800, height: 600, visible: true,
  });
  for (const [box, matrix] of [
    [bounds(2, 0, 0, 3, 1, 1), identity],
    [bounds(-1, -1, 1, 1, 1, 3), perspective],
    [bounds(-1, -1, -20, 1, 1, -11), perspective],
    [bounds(-0.1, -0.1, -0.9, 0.1, 0.1, -0.2), perspective],
  ] as const) {
    const rect = projectBookScreenRect(box, matrix, viewport);
    assert.equal(rect.visible, false); assert.equal(rect.width, 0); assert.equal(rect.height, 0);
  }
});

test("invalid viewport, matrix and bounds return a finite invisible box", () => {
  const box = bounds(-1, -1, -1, 1, 1, 1);
  assert.equal(projectBookScreenRect(box, identity, { width: 0, height: 600 }).visible, false);
  assert.equal(projectBookScreenRect(box, [NaN, ...identity.slice(1)], viewport).visible, false);
  assert.equal(projectBookScreenRect(box, [], viewport).visible, false);
  assert.equal(projectBookScreenRect(bounds(1, 1, 1, -1, -1, -1), identity, viewport).visible, false);
});
