// The page's words as data. Plain text only (no HTML, no markdown, no links
// in the prose), so the tests can read it: 180 to 350 words at a reading
// grade of 8 or under, in short sentences, with the everyday picture first
// ("pot", "part", "face", "the gap", "the spot colour") and no heavy jargon.
// Every number is the engine's, written from its constants, and every source
// is https on the allowlist.
import { PARTS, PATTERNS, POTS } from "./board.ts";
import { CREAMS, INK_COUNT, PAPER_COUNT, SIBLINGS } from "./siblings.ts";

export type Source = { label: string; url: string };
export type Link = { label: string; href: string };
export type Parts = {
  what: readonly string[]; // What it is
  turn: readonly string[]; // Turn a knob
  where: readonly string[]; // Where you meet it
  trap: readonly string[]; // Watch out for
};
export type Figure = "box" | "board" | "follow" | "here";

export const PART_TITLES: Record<keyof Parts, string> = {
  what: "What it is",
  turn: "Turn a knob",
  where: "Where you meet it",
  trap: "Watch out for",
};

// https only, on exactly these hosts: places a reader can check us.
export const SOURCE_HOSTS = [
  "en.wikipedia.org",
  "design-system.service.gov.uk",
  "m3.material.io",
  "developer.apple.com",
  "developer.mozilla.org",
  "www.w3.org",
] as const;

export function allowedSource(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.protocol === "https:" && (SOURCE_HOSTS as readonly string[]).includes(u.hostname);
}

const POT_COUNT = POTS.length;
const PART_COUNT = PARTS.length;
const PATTERN_COUNT = PATTERNS.length;
const SHEETS = SIBLINGS.length;

export const title = "Design system";
export const deck = "A box of decisions made once, drawn so you can turn the knobs.";

export const parts: Parts = {
  what: [
    "A design system is a box of decisions made once. Which paper and which ink. Which spot colour. How round the corners are, how wide the gap is, how big the words are, how fast things move and which face the letters use.",
    "Each decision gets a name, like a pot of paint with a label on it. Parts, such as a card, a button or a field, are built only from those pots. Patterns, such as a form or a list, are built from parts. On the lid sits a rulebook that says what is allowed.",
  ],
  turn: [
    `The board above has ${POT_COUNT} pots and ${PART_COUNT} parts. Turn the spot colour from blue to coral, and all ${PART_COUNT} parts change at once. None of them owns a colour. Each one just says: use the spot.`,
    `Now flip the No system switch. Every part keeps its own values: three blues, a stray coral, corners that do not match. Turn a knob again and 0 parts follow. That leaves ${PART_COUNT} to fix by hand.`,
    "The rule line checks the contrast. Coral on cream fails, because it is too pale to see well.",
  ],
  where: [
    "Big teams build a system so that many pages feel like one thing. The UK government uses one for hundreds of its online services. Google has Material, and Apple writes rules for its own screens.",
    `This site has none, on purpose. It has ${SHEETS} other style sheets. ${PAPER_COUNT} of them name a paper, all ${INK_COUNT} name an ink, and they pick ${CREAMS} different creams. Each project here is its own object.`,
  ],
  trap: [
    "A system needs someone to look after it. Left alone, it drifts. People copy old parts, mix in their own blues and stop using the pots.",
    "A system that is too tight gets ignored, because real pages need the odd exception. And it is never finished. Treat it as a thing with an owner, not a job with an end.",
  ],
};

export const captions: Record<Figure, string> = {
  box: `${POT_COUNT} pots, ${PART_COUNT} parts, ${PATTERN_COUNT} patterns and a rulebook. Change a pot and all below it follows.`,
  board: "Turn a knob and every part built from that pot follows.",
  follow: `With a system, 1 knob moves ${PART_COUNT} parts; without one, ${PART_COUNT} parts need ${PART_COUNT} hands.`,
  here: "Otohime has no design system, on purpose: every project is its own object. A system is the tool for when pages must feel like one thing.",
};

export const sources: readonly Source[] = [
  { label: "Wikipedia: Design system", url: "https://en.wikipedia.org/wiki/Design_system" },
  { label: "GOV.UK Design System", url: "https://design-system.service.gov.uk/" },
  { label: "Material Design 3", url: "https://m3.material.io/" },
  { label: "Apple: Human Interface Guidelines", url: "https://developer.apple.com/design/human-interface-guidelines/" },
  { label: "MDN: Using CSS custom properties", url: "https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties" },
  { label: "W3C: Understanding contrast (minimum)", url: "https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html" },
];

export const colophon: readonly Link[] = [
  { label: "Next door: Structures", href: "/structures" },
  { label: "The Gazette", href: "/articles" },
];

/** All four parts, in order, as one run of paragraphs. */
export const body = () => [...parts.what, ...parts.turn, ...parts.where, ...parts.trap];
