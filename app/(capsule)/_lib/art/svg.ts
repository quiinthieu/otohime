// Drawings to SVG markup, as plain strings: the page's cards and the art sheet
// (npm run capsule:sheet) draw from the same functions, so the sheet is what
// the page shows. Everything here is our own data, escaped where it is text.
//
// A card is printed, not stickered: each shape is a flat fill (the card colour
// mixed toward paper) under one thin rough ink outline, shade is rough
// hachure, and the frame is a numbered double rule with a serif name plate.
// The inner rule is the tier edge: ink, slate, or gold with corner ornaments.
import { CARDS, type Card, type CardId, type Tier } from "../cards.ts";
import { ART } from "./index.ts";
import { inkEllipse, inkLine, inkPath, type InkOptions, type InkPath } from "./ink.ts";
import { type Drawing, PALETTE, type Role, type Shape, STROKE, VIEW_H, VIEW_W } from "./types.ts";

// The tier edges, and the machine's coral that only the card back uses.
export const EDGE: Record<Tier, string> = { common: PALETTE.ink, rare: "#6b7f9e", legend: "#b8862b" };
export const CORAL = "#c9684f";
const RULE = "#d8ccb4"; // the card's cut edge, a shade darker than paper
const SERIF = "Fraunces, Georgia, serif";

export const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
const rgb = (c: string) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

// a toward b by t (0..1), as #rrggbb
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return "#" + x.map((v, i) => hex(v + (y[i] - v) * t)).join("");
}

// The card's shade darkened 25 %: the hatch ink.
export const hatchColour = (card: Card) => mix(card.shade, "#000000", 0.25);

export function fillFor(role: Role, card: Card): string {
  if (role === "none") return "none";
  if (role === "main") return mix(card.colour, PALETTE.paper, 0.12);
  if (role === "hatch") return hatchColour(card);
  return PALETTE[role];
}

const pathEl = (p: InkPath) =>
  p.fill
    ? `<path d="${p.d}" fill="${p.fill}"/>`
    : `<path d="${p.d}" fill="none" stroke="${p.stroke}" stroke-width="${p.strokeWidth}"/>`;
const ink = (paths: InkPath[]) => paths.map(pathEl).join("");

// A hatched area: rough hachure only, no outline.
const hatch = (d: string, colour: string, o: InkOptions) =>
  ink(inkPath(d, { stroke: "none", fill: colour, fillStyle: "hachure", ...o }));

// Shade hatching at card scale, and the lighter pink a cheek mark gets.
const SHADE_HATCH = { hachureGap: 2.4, hachureAngle: -48, fillWeight: 0.9, roughness: 0.7 };
const CHEEK_HATCH = { hachureGap: 1.7, hachureAngle: -48, fillWeight: 0.8, roughness: 0.6 };

// Whether a shape gets an ink outline: everything but hatch, unless told not to.
export const isOutlined = (s: Shape) => s.stroke !== false && s.fill !== "hatch";

function shapeSvg(shape: Shape, card: Card, seed: string): string {
  if (shape.fill === "hatch") return hatch(shape.d, hatchColour(card), { ...SHADE_HATCH, seed });
  if (shape.fill === "blush" && shape.stroke === false) return hatch(shape.d, PALETTE.blush, { ...CHEEK_HATCH, seed });
  const fill = fillFor(shape.fill, card);
  const flat = fill === "none" ? "" : `<path d="${shape.d}" fill="${fill}"/>`;
  if (!isOutlined(shape)) return flat;
  const width = shape.weight === "fine" ? STROKE.fine : STROKE.normal;
  return flat + ink(inkPath(shape.d, { seed, strokeWidth: width }));
}

// The drawing alone, in the card's colours, in the drawing's own 0 0 120 160
// space: per shape, its flat fill, then its hatch or its one outline.
export const drawingToSvg = (card: Card, drawing: Drawing): string =>
  drawing.shapes.map((s, i) => shapeSvg(s, card, `${card.id}:${i}`)).join("");

// The album number of a card, 1 to 12.
export function slotNumber(id: CardId): number {
  return CARDS.findIndex((c) => c.id === id) + 1;
}

const no = (n: number) => `No. ${String(n).padStart(2, "0")}`;
const tierName = (tier: Tier) => tier[0].toUpperCase() + tier.slice(1);

function text(s: string, x: number, y: number, size: number, extra = ""): string {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${PALETTE.ink}" font-family="${SERIF}"${extra}>${escapeXml(s)}</text>`;
}

// The card stock and the outer rule, shared by faces and backs.
const STOCK =
  `<rect x="1" y="1" width="${VIEW_W - 2}" height="${VIEW_H - 2}" rx="4" fill="${PALETTE.paper}" stroke="${RULE}" stroke-width="0.8"/>` +
  `<rect x="4.5" y="4.5" width="${VIEW_W - 9}" height="${VIEW_H - 9}" fill="none" stroke="${PALETTE.ink}" stroke-width="1.6"/>`;

const INNER = { x: 8, y: 8, w: VIEW_W - 16, h: VIEW_H - 16 };

// Gold corner fans for a legend, hatched, one per inner corner.
function ornaments(seed: string): string {
  const { x, y, w, h } = INNER;
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  return corners
    .map(([cx, cy, sx, sy], i) => {
      const r = 11;
      const d = `M ${cx} ${cy} L ${cx + sx * r} ${cy} Q ${cx + sx * r * 0.62} ${cy + sy * r * 0.62} ${cx} ${cy + sy * r} Z`;
      const fan = hatch(d, EDGE.legend, { hachureGap: 1.6, hachureAngle: 45, fillWeight: 0.7, roughness: 0.5, seed: `${seed}:fan${i}` });
      const edge = ink(inkPath(`M ${cx + sx * r} ${cy} Q ${cx + sx * r * 0.62} ${cy + sy * r * 0.62} ${cx} ${cy + sy * r}`, { seed: `${seed}:arc${i}`, stroke: EDGE.legend, strokeWidth: 1 }));
      return fan + edge;
    })
    .join("");
}

// The inner rule in the tier's colour: hairline ink, slate, or heavy gold.
function edgeSvg(tier: Tier, seed: string): string {
  const { x, y, w, h } = INNER;
  const width = tier === "legend" ? 2.2 : tier === "rare" ? 1.1 : 0.8;
  const rule = `<rect data-edge="${tier}" x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${EDGE[tier]}" stroke-width="${width}"/>`;
  return rule + (tier === "legend" ? ornaments(seed) : "");
}

// Art sits in the frame above the plate.
const ART_FIT = "translate(13.2 12.5) scale(0.78)";

const faces = new Map<CardId, string>();

// The face without grain, memoised: rough.js runs once per card per page load.
function face(card: Card): string {
  const hit = faces.get(card.id);
  if (hit) return hit;
  const drawing = ART[card.id];
  const art = drawing
    ? `<g transform="${ART_FIT}" stroke-linejoin="round" stroke-linecap="round">${drawingToSvg(card, drawing)}</g>`
    : text(card.name, 60, 70, 12, ` text-anchor="middle"`);
  const out =
    STOCK +
    edgeSvg(card.tier, card.id) +
    text(no(slotNumber(card.id)), 104, 18, 6, ` text-anchor="end" letter-spacing="0.3"`) +
    art +
    `<path d="M 15 122.5 H 105 M 15 124.5 H 105" fill="none" stroke="${PALETTE.ink}" stroke-width="0.5"/>` +
    text(card.name, 60, 136.5, 11.5, ` class="plate" text-anchor="middle"`) +
    text(`${card.film} · ${card.year}`, 60, 145.5, card.film.length > 28 ? 4.6 : 5.4, ` text-anchor="middle" font-style="italic" fill-opacity="0.8"`);
  faces.set(card.id, out);
  return out;
}

// A paper grain over the whole card, about 7 %: id must be unique in the document.
function grainSvg(id: string): string {
  return (
    `<filter id="${id}" x="0" y="0" width="100%" height="100%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" stitchTiles="stitch"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.17 0 0 0 0 0.14 0 0 0 0 0.13 0 0 0 1.6 -0.4"/>` +
    `</filter>` +
    `<rect x="1" y="1" width="${VIEW_W - 2}" height="${VIEW_H - 2}" rx="4" filter="url(#${id})" opacity="0.07" pointer-events="none"/>`
  );
}

// A whole card face for a 0 0 120 160 viewBox: stock, tier edge, number, the
// drawing from ART, the name plate, and grain when a filter id is given.
export function cardFaceSvg(card: Card, o: { grain?: string } = {}): string {
  return face(card) + (o.grain ? grainSvg(o.grain) : "");
}

let backCore: string | null = null;

// The one back every card shares: a capsule-and-crank device in a paper
// medallion on a hatched coral field. It says nothing about the card.
function back(): string {
  if (backCore) return backCore;
  const { x, y, w, h } = INNER;
  const field = hatch(`M ${x + 3} ${y + 3} H ${x + w - 3} V ${y + h - 3} H ${x + 3} Z`, CORAL, {
    hachureGap: 3.2,
    hachureAngle: -48,
    fillWeight: 0.6,
    roughness: 0.5,
    seed: "back:field",
  });
  const cx = 60;
  const cy = 74;
  const medallion =
    `<ellipse cx="${cx}" cy="${cy}" rx="31" ry="37" fill="${PALETTE.paper}"/>` +
    ink(inkEllipse(cx, cy, 62, 74, { seed: "back:ring", strokeWidth: 1.4 })) +
    ink(inkEllipse(cx, cy, 55, 67, { seed: "back:ring2", strokeWidth: 0.6 }));
  const top = `M 43 68 C 43 57 50.6 50 60 50 C 69.4 50 77 57 77 68 Z`;
  const bottom = `M 43 68 H 77 C 77 79 69.4 86 60 86 C 50.6 86 43 79 43 68 Z`;
  const capsule =
    `<path d="${top}" fill="${mix(CORAL, PALETTE.paper, 0.12)}"/>` +
    hatch(`M 66 54 C 71.5 56 75 61 75.5 67 L 68.5 67 C 68.5 62 68 58 66 54 Z`, mix(CORAL, "#000000", 0.3), { ...SHADE_HATCH, hachureGap: 1.8, seed: "back:shine" }) +
    `<path d="${bottom}" fill="${PALETTE.white}"/>` +
    ink(inkPath(`${top} ${bottom}`, { seed: "back:capsule", strokeWidth: 1.5 })) +
    ink(inkLine(42, 68, 78, 68, { seed: "back:seam", strokeWidth: 1.1 }));
  const crank =
    ink(inkLine(60, 100, 74, 93, { seed: "back:arm", strokeWidth: 1.6 })) +
    `<circle cx="60" cy="100" r="4.4" fill="${PALETTE.paper}"/>` +
    ink(inkEllipse(60, 100, 8.8, 8.8, { seed: "back:hub", strokeWidth: 1.3 })) +
    `<circle cx="74.6" cy="92.7" r="2.8" fill="${PALETTE.ink}"/>`;
  backCore =
    STOCK +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${mix(CORAL, PALETTE.paper, 0.86)}"/>` +
    field +
    medallion +
    `<g stroke-linejoin="round" stroke-linecap="round">${capsule}${crank}</g>`;
  return backCore;
}

// The card back for a 0 0 120 160 viewBox. number prints an album slot's No.;
// edge draws a tier's inner rule (the reveal's last step); grain as on a face.
export function cardBackSvg(o: { number?: number; edge?: Tier; grain?: string } = {}): string {
  const { x, y, w, h } = INNER;
  const rule = o.edge
    ? edgeSvg(o.edge, "back")
    : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${CORAL}" stroke-width="0.8"/>`;
  const plate =
    o.number === undefined
      ? ""
      : `<rect x="40" y="123" width="40" height="15" fill="${PALETTE.paper}"/>` +
        `<path d="M 40 123 H 80 V 138 H 40 Z" fill="none" stroke="${PALETTE.ink}" stroke-width="0.7"/>` +
        text(no(o.number), 60, 133.4, 7.5, ` class="plate" text-anchor="middle" letter-spacing="0.4"`);
  return back() + rule + plate + (o.grain ? grainSvg(o.grain) : "");
}

// One standalone SVG with every drawn card and the back in a grid, captioned, for review.
export function sheetSvg(cards: readonly Card[]): string {
  const drawn = cards.filter((c) => ART[c.id]);
  const cols = 4;
  const cellW = VIEW_W + 30;
  const cellH = VIEW_H + 40;
  const total = drawn.length + 1;
  const rows = Math.max(1, Math.ceil(total / cols));
  const w = cols * cellW;
  const h = rows * cellH;
  const cell = (i: number, svg: string, caption: string) => {
    const x = (i % cols) * cellW + 15;
    const y = Math.floor(i / cols) * cellH + 12;
    const size = Math.min(7, Math.round((280 / caption.length) * 10) / 10); // a long title still fits its cell
    return (
      `<g transform="translate(${x} ${y})">` +
      svg +
      `<text x="${VIEW_W / 2}" y="${VIEW_H + 16}" text-anchor="middle" font-family="${SERIF}" font-size="${size}" fill="${PALETTE.ink}">${escapeXml(caption)}</text>` +
      `</g>`
    );
  };
  const cells = drawn.map((card, i) =>
    cell(i, cardFaceSvg(card, { grain: `grain-${card.id}` }), `${card.film} (${card.year}) · ${tierName(card.tier)}`),
  );
  cells.push(cell(drawn.length, cardBackSvg({ grain: "grain-back" }), "Card back"));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#e9e1cf"/>` +
    cells.join("") +
    `</svg>\n`
  );
}
