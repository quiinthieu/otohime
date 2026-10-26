// The fold zine's model: eight cells, each page once, spreads that meet across a fold (never the cut) and read left
// to right, heads facing the centre line, exact panel sizes, a paper parser that shrugs off junk, the newest note
// from an unsorted list, and every word inside its page's budget.
import assert from "node:assert/strict";
import { test } from "node:test";
import { site } from "../content/site.ts";
import {
  BUDGETS,
  CELLS,
  PAGES,
  PAPERS,
  ZINE_MASTHEAD,
  cellFor,
  cellRect,
  edgeBetween,
  fit,
  guides,
  latestNote,
  pageSize,
  panelSize,
  parsePaper,
  zinePages,
  type Cell,
  type PageNo,
  type ZineSource,
} from "./zine.ts";

/** A unit vector turned by CSS degrees (clockwise, y down). */
function turn([x, y]: [number, number], deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  const c = Math.round(Math.cos(r));
  const s = Math.round(Math.sin(r));
  return [x * c - y * s, x * s + y * c];
}
const centre = (c: Cell): [number, number] => [c.col + 0.5, c.row + 0.5];
const len = (s: string) => Array.from(s).length;

test("the sheet has 8 cells, one per page, filling the 2x4 grid once", () => {
  assert.equal(CELLS.length, 8);
  assert.deepEqual([...new Set(CELLS.map((c) => c.page))].sort(), [...PAGES]);
  assert.equal(new Set(CELLS.map((c) => `${c.col},${c.row}`)).size, 8);
  for (const c of CELLS) assert.ok(c.col >= 0 && c.col < 2 && c.row >= 0 && c.row < 4);
});

test("right column reads 5,4,3,2 turned CCW; left column 6,7,8,1 turned CW", () => {
  const column = (col: 0 | 1) => CELLS.filter((c) => c.col === col).sort((a, b) => a.row - b.row);
  assert.deepEqual(column(1).map((c) => c.page), [5, 4, 3, 2]);
  assert.deepEqual(column(0).map((c) => c.page), [6, 7, 8, 1]);
  for (const c of column(1)) assert.equal(c.rotate, -90, `page ${c.page}`);
  for (const c of column(0)) assert.equal(c.rotate, 90, `page ${c.page}`);
  for (const p of PAGES) assert.equal(cellFor(p).page, p);
});

test("every page's head faces the centre line", () => {
  for (const c of CELLS) {
    const [hx] = turn([0, -1], c.rotate);
    assert.equal(hx, c.col === 0 ? 1 : -1, `page ${c.page} head points ${hx}`);
  }
});

test("spreads 2|3, 4|5, 6|7 and the cover 8|1 meet across a fold and read left to right", () => {
  const spreads: [PageNo, PageNo][] = [
    [2, 3],
    [4, 5],
    [6, 7],
    [8, 1],
  ];
  for (const [l, r] of spreads) {
    const a = cellFor(l);
    const b = cellFor(r);
    assert.equal(edgeBetween(a, b), "fold", `${l}|${r}`);
    // Facing pages share a rotation, and the right page lies in the left page's reading direction.
    assert.equal(a.rotate, b.rotate, `${l}|${r} rotation`);
    const [ax, ay] = centre(a);
    const [bx, by] = centre(b);
    assert.deepEqual([bx - ax, by - ay], turn([1, 0], a.rotate), `${r} is right of ${l}`);
  }
});

test("the cut is exactly the edges between the middle rows, and those never join a spread", () => {
  const cutPairs = [];
  for (const a of CELLS) for (const b of CELLS) if (a.page < b.page && edgeBetween(a, b) === "cut") cutPairs.push([a.page, b.page]);
  // Negative control: the cut exists and parts 4|7 and 3|8 (rows 1 and 2), which are not spreads.
  assert.deepEqual(cutPairs.sort(), [
    [3, 8],
    [4, 7],
  ]);
  assert.equal(edgeBetween(cellFor(1), cellFor(5)), null, "not neighbours");
  assert.equal(edgeBetween(cellFor(1), cellFor(2)), "fold", "bottom row joins at a fold");
  assert.equal(edgeBetween(cellFor(5), cellFor(6)), "fold", "top row joins at a fold");
});

test("the guides: three across, the centre fold's outer quarters, and the cut in its middle half", () => {
  for (const paper of ["a4", "letter"] as const) {
    const { width: w, height: h } = PAPERS[paper];
    const { folds, cut } = guides(paper);
    assert.deepEqual(cut, { x1: w / 2, y1: h / 4, x2: w / 2, y2: (h * 3) / 4 });
    assert.equal(folds.length, 5);
    const vertical = folds.filter((f) => f.x1 === f.x2);
    const covered = vertical.reduce((sum, f) => sum + Math.abs(f.y2 - f.y1), 0) + (cut.y2 - cut.y1);
    assert.equal(covered, h, "folds and cut cover the centre line once");
    for (const f of vertical) assert.ok(f.y2 <= cut.y1 || f.y1 >= cut.y2, "no fold overlaps the cut");
  }
});

test("panels are exactly A4 105 x 74.25 mm and Letter 107.95 x 69.85 mm", () => {
  assert.deepEqual(PAPERS.a4, { label: "A4", width: 210, height: 297 });
  assert.deepEqual(PAPERS.letter, { label: "Letter", width: 215.9, height: 279.4 });
  assert.deepEqual(panelSize("a4"), { width: 105, height: 74.25 });
  assert.deepEqual(panelSize("letter"), { width: 107.95, height: 69.85 });
  assert.deepEqual(pageSize("a4"), { width: 74.25, height: 105 });
  assert.deepEqual(pageSize("letter"), { width: 69.85, height: 107.95 });
  assert.deepEqual(cellRect(cellFor(1), "a4"), { x: 0, y: 222.75, width: 105, height: 74.25 });
  assert.deepEqual(cellRect(cellFor(5), "letter"), { x: 107.95, y: 0, width: 107.95, height: 69.85 });
});

test("the paper parser takes a4 or letter and falls back to A4 for anything else", () => {
  assert.equal(parsePaper("a4"), "a4");
  assert.equal(parsePaper("letter"), "letter");
  assert.equal(parsePaper(" Letter "), "letter");
  assert.equal(parsePaper(["letter", "a4"]), "letter");
  for (const junk of [undefined, null, "", "a5", "legal", "letters", "a4;drop", 4, {}, [], ["a3"], "letter."]) {
    assert.equal(parsePaper(junk), "a4", JSON.stringify(junk));
  }
});

test("latestNote picks the newest from unsorted input, skips bad dates, and keeps the first of a tie", () => {
  const notes = [
    { date: "2026-03-01", title: "b" },
    { date: "2026-11-02", title: "newest" },
    { date: "not a date", title: "junk" },
    { date: "2026-13-45", title: "impossible" },
    { date: "2026-11-02", title: "tie" },
    { date: "2025-12-31", title: "a" },
  ];
  assert.equal(latestNote(notes)?.title, "newest");
  assert.equal(latestNote([...notes].reverse())?.title, "tie");
  assert.equal(latestNote([]), undefined);
  assert.equal(latestNote([{ date: "9999", title: "x" }]), undefined);
  // The site's own notes, shuffled: still the newest.
  const newest = [...site.notes].sort((a, b) => b.date.localeCompare(a.date))[0];
  assert.equal(latestNote([...site.notes].reverse()), newest);
});

test("fit keeps short text, cuts long text on a word with an ellipsis, and hard-cuts one long word", () => {
  assert.equal(fit("  short  ", 10), "short");
  assert.equal(fit("exactly ten", 11), "exactly ten");
  assert.equal(fit("one two three four", 12), "one two…");
  assert.equal(fit("one, two, three", 10), "one…");
  assert.equal(fit("abcdefghijklmnop", 8), "abcdefg…");
  for (const max of [5, 9, 20]) assert.ok(len(fit("The quick brown fox jumps over the lazy dog", max)) <= max);
  assert.equal(len(fit("🖋".repeat(10), 5)), 5, "counts code points, never splits a surrogate pair");
});

test("site.zine names four real projects and a real sketch", () => {
  assert.equal(site.zine.projects.length, 4);
  assert.equal(new Set(site.zine.projects).size, 4);
  for (const title of site.zine.projects) {
    assert.ok(site.projectList.some((p) => p.title === title), `unknown project ${title}`);
  }
  assert.ok(site.sketches.some((s) => s.title === site.zine.sketch), `unknown sketch ${site.zine.sketch}`);
  assert.ok(site.zine.issue.trim().length > 0);
});

test("zinePages lays the site out in reading order with the right picks", () => {
  const pages = zinePages(site);
  assert.deepEqual(pages.map((p) => p.no), [...PAGES]);
  assert.deepEqual(pages.map((p) => p.kind), ["cover", "bio", "project", "project", "project", "project", "sketch", "back"]);
  const [cover, bio, , , , , sketch, back] = pages;
  assert.ok(cover.kind === "cover" && cover.title === ZINE_MASTHEAD && cover.tagline === site.tagline && cover.issue === site.zine.issue);
  assert.ok(bio.kind === "bio");
  assert.deepEqual(bio.paragraphs, site.bio, "the whole bio fits its page");
  const projects = pages.filter((p) => p.kind === "project");
  assert.deepEqual(projects.map((p) => p.title), [...site.zine.projects]);
  for (const p of projects) {
    const real = site.projectList.find((q) => q.title === p.title)!;
    assert.equal(p.note, real.note);
    assert.equal(p.href, `otohime.dev${real.href}`);
  }
  const real = site.sketches.find((s) => s.title === site.zine.sketch)!;
  assert.ok(sketch.kind === "sketch" && sketch.src === real.src && sketch.note === real.note);
  assert.ok(back.kind === "back" && back.note?.date === latestNote(site.notes)?.date);
});

test("every page stays inside its budget, even with oversized content", () => {
  const long = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
  const huge: ZineSource = {
    tagline: long(80),
    bio: [long(100), long(10), long(10)],
    projectList: ["A", "B", "C", "D"].map((t) => ({ title: t + long(10), note: long(60), href: `/${"x".repeat(80)}` })),
    sketches: [{ src: "/s.jpg", title: long(10), note: long(40) }],
    notes: [{ date: "2026-01-01", title: long(20), body: long(100) }],
    zine: { projects: ["A", "B", "C", "D"].map((t) => t + long(10)) as unknown as ZineSource["zine"]["projects"], sketch: long(10), issue: long(20) },
  };
  for (const src of [site, huge]) {
    for (const p of zinePages(src)) {
      if (p.kind === "cover") {
        assert.ok(len(p.title) <= BUDGETS.cover.title && len(p.tagline) <= BUDGETS.cover.tagline && len(p.issue) <= BUDGETS.cover.issue);
      } else if (p.kind === "bio") {
        assert.ok(p.paragraphs.length > 0);
        assert.ok(p.paragraphs.reduce((n, s) => n + len(s), 0) <= BUDGETS.bio.body);
      } else if (p.kind === "project") {
        assert.ok(len(p.title) <= BUDGETS.project.title && len(p.note) <= BUDGETS.project.note);
        assert.ok(!p.href || len(p.href) <= BUDGETS.project.href);
      } else if (p.kind === "sketch") {
        assert.ok(len(p.title) <= BUDGETS.sketch.title && len(p.note) <= BUDGETS.sketch.note);
      } else {
        assert.ok(p.note && len(p.note.title) <= BUDGETS.back.title && len(p.note.body) <= BUDGETS.back.body);
      }
    }
  }
  // The oversized bio drops whole paragraphs, and cuts the first one only when it alone is too long.
  const bio = zinePages(huge)[1];
  assert.ok(bio.kind === "bio" && bio.paragraphs.length === 1 && bio.paragraphs[0].endsWith("…"));
});

test("zinePages refuses a site.zine that names something the site does not have", () => {
  const bad = (zine: Partial<ZineSource["zine"]>) => zinePages({ ...site, zine: { ...site.zine, ...zine } });
  assert.throws(() => bad({ projects: ["Shore", "Orrery", "Rotor", "Nope"] }), /unknown project: Nope/);
  assert.throws(() => bad({ sketch: "Nope" }), /unknown sketch: Nope/);
  assert.throws(() => bad({ projects: ["Shore"] as unknown as ZineSource["zine"]["projects"] }), /needs 4 projects/);
  const noNotes = zinePages({ ...site, notes: [] })[7];
  assert.ok(noNotes.kind === "back" && noNotes.note === undefined);
});
