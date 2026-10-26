// Fold-a-Zine: one portrait sheet, eight pages, one cut. This module only knows the imposition (which page sits in
// which cell, turned which way), the paper sizes, and which of the site's words go on which page within a budget.
// No React, no CSS: the /zine page draws what this returns.
//
// The sheet is 2 columns by 4 rows. Read top to bottom, the right column holds 5, 4, 3, 2 turned 90deg
// counter-clockwise and the left column 6, 7, 8, 1 turned 90deg clockwise, so every page's head faces the centre
// line. The cut is the middle half of that centre line; every other cell edge is a fold.

export type Paper = "a4" | "letter";
export type PageNo = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
/** CSS degrees: positive turns clockwise. */
export type Rotation = 90 | -90;
export type Cell = { page: PageNo; col: 0 | 1; row: 0 | 1 | 2 | 3; rotate: Rotation };
export type Size = { width: number; height: number };
export type Rect = Size & { x: number; y: number };
export type Line = { x1: number; y1: number; x2: number; y2: number };

export const PAPERS: Record<Paper, Size & { label: string }> = {
  a4: { label: "A4", width: 210, height: 297 },
  letter: { label: "Letter", width: 215.9, height: 279.4 },
};
export const DEFAULT_PAPER: Paper = "a4";
export const SHEET_COLS = 2;
export const SHEET_ROWS = 4;
export const PAGES: readonly PageNo[] = [1, 2, 3, 4, 5, 6, 7, 8];

const LEFT: readonly PageNo[] = [6, 7, 8, 1];
const RIGHT: readonly PageNo[] = [5, 4, 3, 2];

/** The eight cells in sheet order (row by row, left then right). */
export const CELLS: readonly Cell[] = LEFT.flatMap((left, i) => {
  const row = i as Cell["row"];
  return [
    { page: left, col: 0, row, rotate: 90 },
    { page: RIGHT[i], col: 1, row, rotate: -90 },
  ] satisfies Cell[];
});

export function cellFor(page: PageNo): Cell {
  const cell = CELLS.find((c) => c.page === page);
  if (!cell) throw new Error(`no cell for page ${page}`);
  return cell;
}

/** ?paper= as Next hands it over (a string, a repeated param, or nothing). Anything but a4 or letter is A4. */
export function parsePaper(raw: unknown): Paper {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return DEFAULT_PAPER;
  const key = value.trim().toLowerCase();
  return key === "a4" || key === "letter" ? key : DEFAULT_PAPER;
}

/** One cell as it lies on the sheet, in mm: A4 105 x 74.25, Letter 107.95 x 69.85. */
export function panelSize(paper: Paper): Size {
  const sheet = PAPERS[paper];
  return { width: sheet.width / SHEET_COLS, height: sheet.height / SHEET_ROWS };
}

/** One page the way it is read once folded: the panel turned a quarter, so portrait. */
export function pageSize(paper: Paper): Size {
  const panel = panelSize(paper);
  return { width: panel.height, height: panel.width };
}

export function cellRect(cell: Cell, paper: Paper): Rect {
  const { width, height } = panelSize(paper);
  return { x: cell.col * width, y: cell.row * height, width, height };
}

/** The guides in mm: three full-width folds, the centre fold's two outer quarters, and the cut between them. */
export function guides(paper: Paper): { folds: Line[]; cut: Line } {
  const { width: w, height: h } = PAPERS[paper];
  const x = w / 2;
  return {
    folds: [
      { x1: 0, y1: h / 4, x2: w, y2: h / 4 },
      { x1: 0, y1: h / 2, x2: w, y2: h / 2 },
      { x1: 0, y1: (h * 3) / 4, x2: w, y2: (h * 3) / 4 },
      { x1: x, y1: 0, x2: x, y2: h / 4 },
      { x1: x, y1: (h * 3) / 4, x2: x, y2: h },
    ],
    cut: { x1: x, y1: h / 4, x2: x, y2: (h * 3) / 4 },
  };
}

/** What joins two cells: a fold, the cut, or nothing (not edge neighbours). */
export function edgeBetween(a: Cell, b: Cell): "fold" | "cut" | null {
  if (a.col === b.col && Math.abs(a.row - b.row) === 1) return "fold";
  if (a.row === b.row && a.col !== b.col) return a.row === 1 || a.row === 2 ? "cut" : "fold";
  return null;
}

// Content -----------------------------------------------------------------------------------------------------------

export const ZINE_MASTHEAD = "otohime";
export const ZINE_URL = "otohime.dev";

/** Characters per field, sized for the smaller page (Letter, 69.85 x 107.95 mm) at 8pt with 6 mm margins. */
export const BUDGETS = {
  cover: { title: 16, tagline: 60, issue: 32 },
  bio: { body: 420 },
  project: { title: 24, note: 140, href: 40 },
  sketch: { title: 24, note: 90 },
  back: { title: 48, body: 220 },
} as const;

export type ZineConfig = {
  projects: readonly [string, string, string, string];
  sketch: string;
  issue: string;
};
export type ZineNote = { date: string; title: string; body: string };
export type ZineSource = {
  tagline: string;
  bio: readonly string[];
  projectList: readonly { title: string; note: string; href?: string }[];
  sketches: readonly { src: string; title: string; note: string }[];
  notes: readonly ZineNote[];
  zine: ZineConfig;
};

export type ZinePage =
  | { no: 1; kind: "cover"; title: string; tagline: string; issue: string }
  | { no: 2; kind: "bio"; paragraphs: string[] }
  | { no: 3 | 4 | 5 | 6; kind: "project"; title: string; note: string; href?: string }
  | { no: 7; kind: "sketch"; src: string; title: string; note: string }
  | { no: 8; kind: "back"; note?: ZineNote; url: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The newest note by its ISO date, whatever order the list is in; the first wins a tie, bad dates are skipped. */
export function latestNote<N extends { date: string }>(notes: readonly N[]): N | undefined {
  let best: N | undefined;
  for (const note of notes) {
    if (!ISO_DATE.test(note.date) || Number.isNaN(Date.parse(note.date))) continue;
    if (!best || note.date > best.date) best = note;
  }
  return best;
}

/** Text cut to at most max characters: on a word boundary when there is one, with an ellipsis when cut. */
export function fit(text: string, max: number): string {
  const chars = Array.from(text.trim());
  if (chars.length <= max) return chars.join("");
  const head = chars.slice(0, max - 1).join("");
  const space = head.lastIndexOf(" ");
  const cut = (space > 0 ? head.slice(0, space) : head).replace(/[\s.,;:!?–—-]+$/, "");
  return `${cut}…`;
}

/** Whole paragraphs while they fit; the first one is cut down if even it is too long. */
function fitParagraphs(paragraphs: readonly string[], max: number): string[] {
  const out: string[] = [];
  let used = 0;
  for (const p of paragraphs) {
    const text = p.trim();
    const len = Array.from(text).length;
    if (used + len > max) break;
    out.push(text);
    used += len;
  }
  return out.length > 0 || paragraphs.length === 0 ? out : [fit(paragraphs[0], max)];
}

/** The eight pages in reading order. Throws if site.zine names a project or sketch the site does not have. */
export function zinePages(src: ZineSource): ZinePage[] {
  const { zine } = src;
  if (zine.projects.length !== 4) throw new Error(`site.zine needs 4 projects, got ${zine.projects.length}`);
  const projects = zine.projects.map((title) => {
    const project = src.projectList.find((p) => p.title === title);
    if (!project) throw new Error(`site.zine names an unknown project: ${title}`);
    return project;
  });
  const sketch = src.sketches.find((s) => s.title === zine.sketch);
  if (!sketch) throw new Error(`site.zine names an unknown sketch: ${zine.sketch}`);
  const note = latestNote(src.notes);
  const b = BUDGETS;

  return [
    {
      no: 1,
      kind: "cover",
      title: fit(ZINE_MASTHEAD, b.cover.title),
      tagline: fit(src.tagline, b.cover.tagline),
      issue: fit(zine.issue, b.cover.issue),
    },
    { no: 2, kind: "bio", paragraphs: fitParagraphs(src.bio, b.bio.body) },
    ...projects.map((p, i) => ({
      no: (i + 3) as 3 | 4 | 5 | 6,
      kind: "project" as const,
      title: fit(p.title, b.project.title),
      note: fit(p.note, b.project.note),
      ...(p.href ? { href: fit(`${ZINE_URL}${p.href}`, b.project.href) } : {}),
    })),
    {
      no: 7,
      kind: "sketch",
      src: sketch.src,
      title: fit(sketch.title, b.sketch.title),
      note: fit(sketch.note, b.sketch.note),
    },
    {
      no: 8,
      kind: "back",
      url: ZINE_URL,
      ...(note ? { note: { date: note.date, title: fit(note.title, b.back.title), body: fit(note.body, b.back.body) } } : {}),
    },
  ];
}
