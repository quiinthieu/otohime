// Drawings to SVG markup, as plain strings: the page's cards and the art sheet
// (npm run capsule:sheet) draw from the same functions, so the sheet is what
// the page shows. Everything here is our own data, escaped where it is text.
import type { Card, Tier } from "../cards.ts";
import { ART } from "./index.ts";
import { type Drawing, PALETTE, type Role, type Shape, STROKE_WIDTH, VIEW_H, VIEW_W } from "./types.ts";

const FOIL = "#c99a3c";
const GHOST = { fill: "#e4ddd0", stroke: "#cfc6b6" }; // an unowned card's silhouette
const FONT = "'Chalkboard SE', 'Comic Neue', 'Comic Sans MS', cursive";

export const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function fillFor(role: Role, card: Card): string {
  if (role === "none") return "none";
  if (role === "main") return card.colour;
  if (role === "shade") return card.shade;
  return PALETTE[role];
}

function pathSvg(shape: Shape, card: Card, ghost: boolean): string {
  const stroked = shape.stroke !== false;
  let fill = fillFor(shape.fill, card);
  if (ghost && fill !== "none") fill = GHOST.fill;
  const ink = ghost ? GHOST.stroke : PALETTE.ink;
  const stroke = stroked
    ? ` stroke="${ink}" stroke-width="${STROKE_WIDTH}" stroke-linejoin="round" stroke-linecap="round"`
    : "";
  return `<path d="${shape.d}" fill="${fill}"${stroke}/>`;
}

// The drawing alone, in the card's colours: one <path> per shape.
export const drawingToSvg = (card: Card, drawing: Drawing, ghost = false): string =>
  drawing.shapes.map((s) => pathSvg(s, card, ghost)).join("");

const tierName = (tier: Tier) => tier[0].toUpperCase() + tier.slice(1);

function tierBand(tier: Tier): string {
  if (tier === "rare") return `<rect x="9.5" y="9.5" width="101" height="141" rx="6" fill="none" stroke="${FOIL}" stroke-width="1.4"/>`;
  if (tier === "legend") return `<rect x="8" y="8" width="104" height="144" rx="7" fill="none" stroke="${FOIL}" stroke-width="5"/>`;
  return "";
}

function label(text: string, y: number, size: number, colour: string): string {
  return `<text x="${VIEW_W / 2}" y="${y}" text-anchor="middle" font-family="${FONT}" font-size="${size}" fill="${colour}">${escapeXml(text)}</text>`;
}

// A whole card face for a 0 0 120 160 viewBox: paper, tier band and art under a
// feTurbulence wobble (filterId must be unique in the document), then the name.
// ghost draws an unowned slot: a grey silhouette with the tier instead of the name.
export function cardFaceSvg(card: Card, filterId: string, ghost = false): string {
  const drawing = ART[card.id];
  const art = drawing
    ? `<g transform="translate(9.6 5) scale(0.84)">${drawingToSvg(card, drawing, ghost)}</g>`
    : ghost
      ? label("?", 86, 40, GHOST.stroke)
      : label(card.name, 80, 13, PALETTE.ink);
  const name = ghost ? label(tierName(card.tier), 148, 9, "#a39886") : label(card.name, 148, 10, PALETTE.ink);
  return (
    `<defs><filter id="${filterId}" x="-4%" y="-4%" width="108%" height="108%">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7" result="noise"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G"/>` +
    `</filter></defs>` +
    `<g filter="url(#${filterId})">` +
    `<rect x="4" y="4" width="${VIEW_W - 8}" height="${VIEW_H - 8}" rx="9" fill="${PALETTE.paper}" stroke="${ghost ? GHOST.stroke : PALETTE.ink}" stroke-width="${STROKE_WIDTH}"/>` +
    (ghost ? "" : tierBand(card.tier)) +
    art +
    `<path d="M 22 136 Q 60 133 98 136" fill="none" stroke="${ghost ? GHOST.stroke : PALETTE.ink}" stroke-width="1.2" stroke-linecap="round"/>` +
    `</g>` +
    name
  );
}

// One standalone SVG with every drawn card in a grid, captioned, for review.
export function sheetSvg(cards: readonly Card[]): string {
  const drawn = cards.filter((c) => ART[c.id]);
  const cols = 4;
  const cellW = VIEW_W + 30;
  const cellH = VIEW_H + 40;
  const rows = Math.max(1, Math.ceil(drawn.length / cols));
  const w = cols * cellW;
  const h = rows * cellH;
  const cells = drawn.map((card, i) => {
    const x = (i % cols) * cellW + 15;
    const y = Math.floor(i / cols) * cellH + 12;
    const caption = `${card.film} (${card.year}) · ${tierName(card.tier)}`;
    const size = Math.min(7, Math.round((280 / caption.length) * 10) / 10); // a long title still fits its cell
    return (
      `<g transform="translate(${x} ${y})">` +
      cardFaceSvg(card, `wobble-${card.id}`) +
      `<text x="${VIEW_W / 2}" y="${VIEW_H + 16}" text-anchor="middle" font-family="${FONT}" font-size="${size}" fill="${PALETTE.ink}">${escapeXml(caption)}</text>` +
      `</g>`
    );
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w * 2}" height="${h * 2}" viewBox="0 0 ${w} ${h}">` +
    `<rect width="${w}" height="${h}" fill="#fffdf8"/>` +
    cells.join("") +
    `</svg>\n`
  );
}
