export const STEPS = 16;
export const ROWS = [
  { label: "Chip · C5", voice: "chip", hz: 523.25 },
  { label: "Chip · G4", voice: "chip", hz: 392 },
  { label: "Marimba · E4", voice: "marimba", hz: 329.63 },
  { label: "Marimba · C4", voice: "marimba", hz: 261.63 },
  { label: "Brush · high", voice: "brush", hz: 2800 },
  { label: "Brush · low", voice: "brush", hz: 1500 },
  { label: "Paper · crisp", voice: "paper", hz: 4200 },
  { label: "Paper · soft", voice: "paper", hz: 2200 },
] as const;
export type Pattern = { tempo: number; swing: number; rows: number[] };
export const blankPattern = (): Pattern => ({ tempo: 108, swing: 0, rows: Array(8).fill(0) });
export const demoPattern = (): Pattern => ({ tempo: 108, swing: 18, rows: [0x1011, 0x0400, 0x4444, 0x0101, 0x1010, 0x0040, 0x8888, 0x0200] });

export function encodePattern(pattern: Pattern): string {
  return `#t=${pattern.tempo}&s=${pattern.swing}&p=${pattern.rows.map(n => n.toString(16).padStart(4, "0")).join("")}`;
}

/** Strict, bounded and version-independent: malformed shares never partially load. */
export function decodePattern(hash: string): Pattern | null {
  if (!/^#t=\d{2,3}&s=\d{1,2}&p=[a-fA-F0-9]{32}$/.test(hash)) return null;
  const params = new URLSearchParams(hash.slice(1));
  const tempo = Number(params.get("t")), swing = Number(params.get("s"));
  if (tempo < 60 || tempo > 180 || swing > 50) return null;
  return { tempo, swing, rows: params.get("p")!.match(/.{4}/g)!.map(n => parseInt(n, 16)) };
}

export const hasBlot = (pattern: Pattern, row: number, step: number) => Boolean(pattern.rows[row] & (1 << step));
export function toggleBlot(pattern: Pattern, row: number, step: number): Pattern {
  return { ...pattern, rows: pattern.rows.map((mask, i) => i === row ? mask ^ (1 << step) : mask) };
}
/** Swing lengthens the first sixteenth and shortens its partner; the pair stays in time. */
export const stepSeconds = (tempo: number, swing: number, step: number) => 60 / tempo / 4 * (1 + (step % 2 ? -1 : 1) * swing / 100);

export const SCORE = { width: 1440, height: 850, left: 270, top: 230, cell: 65, row: 60 };
export function scoreBlots(pattern: Pattern) {
  return ROWS.flatMap((_, row) => Array.from({ length: STEPS }, (_, step) => ({ row, step,
    x: SCORE.left + step * SCORE.cell + SCORE.cell / 2, y: SCORE.top + row * SCORE.row + SCORE.row / 2,
  })).filter(({ step }) => hasBlot(pattern, row, step)));
}

/** Seeded PCM for two genuinely noisy percussion voices; no files or random global state. */
export function loomNoise(seed: number, length: number): Float32Array {
  let state = seed >>> 0;
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    samples[i] = state / 2147483648 - 1;
  }
  return samples;
}
