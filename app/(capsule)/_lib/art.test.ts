// The drawings are data, so the brief is checked here: every drawing belongs to
// a card, paths are absolute commands inside the 0 0 120 160 card face, fills
// are palette roles, the printed-ink look holds (hatched shade, one outline per
// stroked shape, no cheek blush where it does not belong), card backs give
// nothing away, and the sheet carries no raster, gradient or link.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ART } from "./art/index.ts";
import { EDGE, cardBackSvg, cardFaceSvg, drawingToSvg, isOutlined, sheetSvg, slotNumber } from "./art/svg.ts";
import { PALETTE, ROLES, VIEW_H, VIEW_W } from "./art/types.ts";
import { CARDS, type CardId } from "./cards.ts";

// A changed value means Totoro was redrawn: rough.js moved, or the renderer, the
// frame or his drawing did. Update it only on purpose, after looking at the sheet.
const TOTORO_FACE_SHA256 = "eb0a983e8255e48f33e1ee5c3c23196024e5423f56d75935bb9f2c6558c172ed";

// How many numbers each command takes, and which of them are x (0) or y (1).
const AXES: Record<string, number[]> = {
  M: [0, 1],
  L: [0, 1],
  T: [0, 1],
  H: [0],
  V: [1],
  C: [0, 1, 0, 1, 0, 1],
  S: [0, 1, 0, 1],
  Q: [0, 1, 0, 1],
  Z: [],
};

// Splits d into commands and their numbers; throws on anything else.
function parse(d: string): { cmd: string; args: number[] }[] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|\S/g) ?? [];
  const out: { cmd: string; args: number[] }[] = [];
  for (const t of tokens) {
    if (/^[A-Za-z]$/.test(t)) {
      out.push({ cmd: t, args: [] });
    } else {
      const n = Number(t);
      if (!Number.isFinite(n) || out.length === 0) throw new Error(`stray token ${t}`);
      out[out.length - 1].args.push(n);
    }
  }
  return out;
}

// Problems with one path, or [] when it keeps the rules.
function pathProblems(d: string): string[] {
  const problems: string[] = [];
  let cmds: { cmd: string; args: number[] }[];
  try {
    cmds = parse(d);
  } catch (e) {
    return [(e as Error).message];
  }
  if (cmds[0]?.cmd !== "M") problems.push("does not start with M");
  for (const { cmd, args } of cmds) {
    const axes = AXES[cmd];
    if (!axes) {
      problems.push(`command ${cmd} is not one of M L H V C S Q T Z`);
      continue;
    }
    if (axes.length === 0 ? args.length > 0 : args.length === 0 || args.length % axes.length !== 0) {
      problems.push(`${cmd} has ${args.length} numbers`);
      continue;
    }
    args.forEach((v, i) => {
      const max = axes[i % axes.length] === 0 ? VIEW_W : VIEW_H;
      if (v < 0 || v > max) problems.push(`${cmd} ${axes[i % axes.length] === 0 ? "x" : "y"}=${v} outside 0..${max}`);
    });
  }
  return problems;
}

const ids = new Set<string>(CARDS.map((c) => c.id));

test("every card is drawn, and every drawing is for a card", () => {
  for (const id of Object.keys(ART)) assert.ok(ids.has(id), `${id} is not a card`);
  assert.deepEqual(Object.keys(ART), CARDS.map((c) => c.id)); // in album order, so the sheet reads like the album
});

test("paths use absolute M L H V C S Q T Z inside the card face", () => {
  for (const [id, drawing] of Object.entries(ART)) {
    assert.ok(drawing.shapes.length > 0, `${id} has no shapes`);
    drawing.shapes.forEach((s, i) => assert.deepEqual(pathProblems(s.d), [], `${id} shape ${i}: ${s.d}`));
  }
});

test("fills are palette roles and each drawing has an ink outline", () => {
  for (const [id, drawing] of Object.entries(ART)) {
    for (const s of drawing.shapes) assert.ok(ROLES.includes(s.fill), `${id}: unknown fill ${s.fill}`);
    assert.ok(drawing.shapes.some((s) => s.stroke !== false), `${id} has no stroked shape`);
  }
});

test("the path checker flags what it should", () => {
  assert.deepEqual(pathProblems("M 0 0 L 120 160 Z"), []);
  assert.deepEqual(pathProblems("M 10 10 H 20 V 30 C 1 2 3 4 5 6 S 1 2 3 4 Q 1 2 3 4 T 5 6 Z"), []);
  assert.notDeepEqual(pathProblems("M 10 10 l 5 5"), []); // relative
  assert.notDeepEqual(pathProblems("M 10 10 A 5 5 0 0 1 20 20"), []); // arc
  assert.notDeepEqual(pathProblems("M 10 10 L 121 50"), []); // x outside
  assert.notDeepEqual(pathProblems("M 10 10 V 161"), []); // y outside
  assert.notDeepEqual(pathProblems("M 10 10 H -1"), []);
  assert.notDeepEqual(pathProblems("M 10 10 C 1 2 3"), []); // short
  assert.notDeepEqual(pathProblems("L 10 10"), []); // no M
});

test("the sheet is one balanced SVG with no raster, gradient or link", () => {
  const svg = sheetSvg(CARDS);
  assert.ok(svg.startsWith("<svg "));
  const opens = svg.match(/<svg\b/g)?.length ?? 0;
  const closes = svg.match(/<\/svg>/g)?.length ?? 0;
  assert.equal(opens, 1);
  assert.equal(closes, 1);
  for (const bad of ["<image", "gradient", "href="]) assert.ok(!svg.toLowerCase().includes(bad.toLowerCase()), bad);
  for (const id of Object.keys(ART)) assert.ok(svg.includes(`grain-${id}`), `${id} not on the sheet`);
  assert.ok(svg.includes(`grain-back`), "the card back is not on the sheet");
  assert.equal(svg.match(/<filter id="grain-/g)?.length, CARDS.length + 1);
  assert.ok(!svg.includes("feDisplacementMap"), "the old wobble is gone");
});

const card = (id: CardId) => CARDS.find((c) => c.id === id)!;
const drawn = Object.entries(ART).map(([id, drawing]) => ({ card: card(id as CardId), drawing }));

test("shade is hatched: no shade role, and every card has a hatch shape", () => {
  assert.ok(!(ROLES as readonly string[]).includes("shade"));
  assert.ok(ROLES.includes("hatch"));
  for (const { card, drawing } of drawn) {
    assert.ok(drawing.shapes.some((s) => s.fill === "hatch"), `${card.id} has no hatch`);
  }
});

test("Totoro, No-Face and Calcifer wear no blush", () => {
  for (const id of ["totoro", "no-face", "calcifer"] as const) {
    const shapes = ART[id]!.shapes;
    assert.deepEqual(shapes.filter((s) => s.fill === "blush"), [], id);
  }
});

test("a face is the same every time and has no NaN or undefined", () => {
  for (const { card } of drawn) {
    const a = cardFaceSvg(card);
    assert.equal(a, cardFaceSvg(card), card.id);
    assert.ok(!/NaN|undefined/.test(a), `${card.id} face has NaN or undefined`);
    assert.ok(a.includes(card.name), `${card.id} face lacks its name`);
    assert.ok(a.includes(`No. ${String(slotNumber(card.id)).padStart(2, "0")}`), `${card.id} face lacks its number`);
    assert.ok(a.includes('class="plate"') && a.includes('font-family="Fraunces, Georgia, serif"'), `${card.id} plate`);
    assert.ok(a.includes(`data-edge="${card.tier}"`) && a.includes(`stroke="${EDGE[card.tier]}"`), `${card.id} edge`);
    const grained = cardFaceSvg(card, { grain: "g1" });
    assert.ok(grained.startsWith(a) && grained.includes('<filter id="g1"') && grained.includes("feTurbulence"));
  }
});

test("each stroked shape gets exactly one ink outline", () => {
  for (const { card, drawing } of drawn) {
    const svg = drawingToSvg(card, drawing);
    const outlines = svg.match(new RegExp(`fill="none" stroke="${PALETTE.ink}"`, "g"))?.length ?? 0;
    const stroked = drawing.shapes.filter(isOutlined).length;
    assert.ok(stroked > 0, `${card.id} has no outlined shape`);
    assert.equal(outlines, stroked, card.id);
  }
});

test("Totoro's face is pinned", () => {
  const hash = createHash("sha256").update(cardFaceSvg(card("totoro"))).digest("hex");
  assert.equal(hash, TOTORO_FACE_SHA256);
});

test("a card back names no card, numbers nothing and shows no tier", () => {
  const back = cardBackSvg();
  for (const c of CARDS) assert.ok(!back.includes(c.name), c.name);
  assert.ok(!back.includes("No."));
  for (const tier of ["rare", "legend"] as const) assert.ok(!back.toLowerCase().includes(EDGE[tier]), tier);
  assert.ok(!/data-edge|common|rare|legend/i.test(back));
  assert.equal(back, cardBackSvg());
  assert.ok(!/NaN|undefined/.test(back));
});

test("an album back carries its number, and an edge carries its tier", () => {
  assert.ok(cardBackSvg({ number: 7 }).includes("No. 07"));
  assert.ok(cardBackSvg({ number: 12 }).includes("No. 12"));
  assert.ok(cardBackSvg({ edge: "legend" }).includes(EDGE.legend));
  assert.equal(EDGE.legend, "#b8862b");
  assert.ok(cardBackSvg({ edge: "rare" }).includes(EDGE.rare));
});

test("slots are numbered 1 to 12 in album order", () => {
  assert.deepEqual(CARDS.map((c) => slotNumber(c.id)), CARDS.map((_, i) => i + 1));
});

test("art/ink.ts never touches the DOM", () => {
  const src = readFileSync(new URL("./art/ink.ts", import.meta.url), "utf8");
  assert.ok(!/\bdocument\b/.test(src), "document");
  assert.ok(!/\bwindow\b/.test(src), "window");
});
