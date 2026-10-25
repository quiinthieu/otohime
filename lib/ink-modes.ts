// The hands a figure can be drawn in: the same line work through a different
// SVG filter. Ink is the house look, and its filter is exactly the one Inked
// always drew (pinned in ink-modes.test.ts); the others are bounded variations
// of it. Nothing here blurs the line work: a watercolour wash is a soft copy
// laid *under* the crisp lines.

export const HANDS = ["ink", "pencil", "crayon", "watercolour"] as const;
export type Hand = (typeof HANDS)[number];

export type Material = {
  // the line weight of strokes that don't set their own
  stroke: number;
  // how the line work wobbles: turbulence frequency and octaves, and the
  // displacement as a multiple of the figure's wobble slider
  warp: { frequency: number; octaves: number; scale: number };
  // dark specks where noise runs high: alpha = slope × noise + intercept
  grain: { frequency: number; octaves: number; slope: number; intercept: number };
  // paper tooth: the drawing shows at `floor` everywhere, fully where the
  // grain's noise passes (alpha = slope × noise + intercept)
  tooth?: { slope: number; intercept: number; floor: number };
  // a blurred, wandering copy of the colour under the lines
  wash?: { blur: number; spread: number; opacity: number };
};

export const MATERIALS: Record<Hand, Material> = {
  ink: {
    stroke: 2.4,
    warp: { frequency: 0.035, octaves: 2, scale: 1 },
    grain: { frequency: 0.85, octaves: 1, slope: 1.6, intercept: -0.82 },
  },
  // fine, tight graphite with the paper's tooth showing through
  pencil: {
    stroke: 1.6,
    warp: { frequency: 0.08, octaves: 2, scale: 0.55 },
    grain: { frequency: 1.4, octaves: 2, slope: 1.2, intercept: -0.75 },
    tooth: { slope: 2.5, intercept: -0.45, floor: 0.7 },
  },
  // fat, waxy and lumpy, skipping over the paper
  crayon: {
    stroke: 3.2,
    warp: { frequency: 0.022, octaves: 3, scale: 1.35 },
    grain: { frequency: 0.45, octaves: 2, slope: 1, intercept: -0.72 },
    tooth: { slope: 3, intercept: -0.6, floor: 0.65 },
  },
  // thin lines over colour that has bled past them
  watercolour: {
    stroke: 1.8,
    warp: { frequency: 0.03, octaves: 2, scale: 0.8 },
    grain: { frequency: 0.6, octaves: 1, slope: 1.2, intercept: -0.8 },
    tooth: { slope: 2, intercept: -0.4, floor: 0.7 },
    wash: { blur: 4, spread: 14, opacity: 0.55 },
  },
};

export const isHand = (value: unknown): value is Hand => HANDS.includes(value as Hand);

// Seeds run round a small prime ring, so a figure's filter only ever takes
// one of SEEDS shapes. Seed 0 is the house drawing (turbulence seeds 3 and 8).
export const SEEDS = 89;
const REROLL = 37;
export const wrapSeed = (seed: number) => (((Math.trunc(seed) % SEEDS) + SEEDS) % SEEDS);
// Re-roll jumps to a far seed; a boil steps to the next one.
export const reroll = (seed: number) => wrapSeed(seed + REROLL);
export const boilStep = (seed: number) => wrapSeed(seed + 1);

export type Primitive =
  | { tag: "feMerge"; nodes: string[] }
  | {
      tag: "feTurbulence" | "feDisplacementMap" | "feColorMatrix" | "feComposite" | "feGaussianBlur";
      attrs: Record<string, string | number>;
    };

// alpha only, from the red channel: alpha = slope × R + intercept
const alphaFromRed = (slope: number, intercept: number) =>
  `0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${slope} 0 0 0 ${intercept}`;
// the same colour at k times the alpha
const fade = (k: number) => `1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 ${k} 0`;

// The filter's primitives, in order, for a hand, a seed and the wobble slider.
export function inkFilter(hand: Hand = "ink", seed = 0, wobble = 3.5): Primitive[] {
  const m = MATERIALS[hand];
  const s = wrapSeed(seed);
  const out: Primitive[] = [
    {
      tag: "feTurbulence",
      attrs: { type: "turbulence", baseFrequency: m.warp.frequency, numOctaves: m.warp.octaves, seed: 3 + s, result: "warp" },
    },
    {
      tag: "feDisplacementMap",
      attrs: {
        in: "SourceGraphic",
        in2: "warp",
        // the house hand passes the slider straight through
        scale: m.warp.scale === 1 ? wobble : Math.round(wobble * m.warp.scale * 100) / 100,
        xChannelSelector: "R",
        yChannelSelector: "G",
        result: "inked",
      },
    },
  ];
  if (m.wash) {
    out.push(
      { tag: "feTurbulence", attrs: { type: "fractalNoise", baseFrequency: 0.012, numOctaves: 2, seed: 5 + s, result: "bleed" } },
      {
        tag: "feDisplacementMap",
        attrs: { in: "SourceGraphic", in2: "bleed", scale: m.wash.spread, xChannelSelector: "R", yChannelSelector: "B", result: "spread" },
      },
      { tag: "feGaussianBlur", attrs: { in: "spread", stdDeviation: m.wash.blur, result: "blurred" } },
      { tag: "feColorMatrix", attrs: { in: "blurred", type: "matrix", values: fade(m.wash.opacity), result: "wash" } },
    );
  }
  out.push(
    {
      tag: "feTurbulence",
      attrs: { type: "fractalNoise", baseFrequency: m.grain.frequency, numOctaves: m.grain.octaves, seed: 8 + s, result: "noise" },
    },
    {
      tag: "feColorMatrix",
      attrs: { in: "noise", type: "matrix", values: alphaFromRed(m.grain.slope, m.grain.intercept), result: "specks" },
    },
  );
  if (m.tooth) {
    out.push(
      {
        tag: "feColorMatrix",
        attrs: { in: "noise", type: "matrix", values: alphaFromRed(m.tooth.slope, m.tooth.intercept), result: "tooth" },
      },
      { tag: "feComposite", attrs: { in: "inked", in2: "tooth", operator: "in", result: "bitten" } },
      { tag: "feColorMatrix", attrs: { in: "inked", type: "matrix", values: fade(m.tooth.floor), result: "faint" } },
    );
  }
  out.push(
    { tag: "feComposite", attrs: { in: "specks", in2: "inked", operator: "in", result: "grain" } },
    {
      tag: "feMerge",
      nodes: [...(m.wash ? ["wash"] : []), ...(m.tooth ? ["faint", "bitten"] : ["inked"]), "grain"],
    },
  );
  return out;
}

// A figure's hand, seed and boil beat. The figure clock runs at 12 fps; a
// boil changes the seed on every other frame, six times a second.
export const BOIL_HZ = 6;
export const FRAMES_PER_BOIL = 12 / BOIL_HZ;

export type InkState = { hand: Hand; seed: number; beat: number };
export type InkAction = { type: "hand"; hand: Hand } | "reroll" | "tick";
export const INK: InkState = { hand: "ink", seed: 0, beat: 0 };

export function ink(state: InkState, action: InkAction): InkState {
  if (action === "reroll") return { ...state, seed: reroll(state.seed), beat: 0 };
  if (action === "tick") {
    const beat = (state.beat + 1) % FRAMES_PER_BOIL;
    return { ...state, beat, seed: beat === 0 ? boilStep(state.seed) : state.seed };
  }
  if (!isHand(action.hand) || action.hand === state.hand) return state;
  return { ...state, hand: action.hand };
}

// Which figure is boiling: at most one on the page. Claiming hands the boil
// over from whichever figure had it; releasing only lets go of your own.
export function boilOwner() {
  let owner: string | null = null;
  const listeners = new Set<() => void>();
  const set = (next: string | null) => {
    if (next === owner) return;
    owner = next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => owner,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    claim: (id: string) => set(id),
    release: (id: string) => {
      if (owner === id) set(null);
    },
    toggle: (id: string) => set(owner === id ? null : id),
  };
}
