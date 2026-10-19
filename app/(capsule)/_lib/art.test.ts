// The drawings are data, so the brief is checked here: every drawing belongs to
// a card, paths are absolute commands inside the 0 0 120 160 card face, fills
// are palette roles, and the sheet carries no raster, gradient or link.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ART } from "./art/index.ts";
import { sheetSvg } from "./art/svg.ts";
import { ROLES, VIEW_H, VIEW_W } from "./art/types.ts";
import { CARDS } from "./cards.ts";

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

test("every drawing is for a card, and the first four are drawn", () => {
  for (const id of Object.keys(ART)) assert.ok(ids.has(id), `${id} is not a card`);
  for (const id of ["soot-sprite", "jiji", "totoro", "no-face"] as const) assert.ok(ART[id], `${id} is not drawn`);
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
  for (const id of Object.keys(ART)) assert.ok(svg.includes(`wobble-${id}`), `${id} not on the sheet`);
});
