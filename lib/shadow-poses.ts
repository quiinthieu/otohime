export type Landmark = { x: number; y: number; z: number };
export type Creature = "rabbit" | "dog" | "bird" | "deer";
export type ShadowPose = Creature | "neutral";
export const CREATURES: Creature[] = ["rabbit", "dog", "bird", "deer"];
const distance = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * 0.3);
export function validHand(hand: readonly Landmark[]): boolean {
  return hand.length === 21 && hand.every(p => [p.x, p.y, p.z].every(Number.isFinite) && Math.abs(p.x) <= 2 && Math.abs(p.y) <= 2 && Math.abs(p.z) <= 2) && distance(hand[0], hand[9]) > 0.035;
}
/** Distance ratios are invariant to handedness, camera mirroring and in-plane rotation. */
export function classifyHands(hands: readonly (readonly Landmark[])[]): ShadowPose {
  if (!hands.length || hands.length > 2 || !hands.every(validHand)) return "neutral";
  const extended = hands.map(h => [8, 12, 16, 20].map(tip => distance(h[tip], h[0]) > distance(h[tip - 2], h[0]) * 1.2 && distance(h[tip], h[tip - 2]) > distance(h[0], h[9]) * 0.28));
  if (hands.length === 2) return extended.every(f => f.every(Boolean)) ? "bird" : "neutral";
  const [index, middle, ring, pinky] = extended[0];
  const h = hands[0], span = distance(h[0], h[9]);
  const thumbOut = distance(h[4], h[5]) > span * 0.75;
  if (index && middle && !ring && !pinky && !thumbOut) return "rabbit";
  if (index && !middle && !ring && pinky) return thumbOut ? "deer" : "dog";
  return "neutral";
}
/** One Euro low-pass filter: quiet jitter is smoothed, deliberate movement catches up quickly. */
export class OneEuro {
  private value: number | undefined;
  private raw = 0;
  private derivative = 0;
  private time = 0;
  filter(value: number, time: number) {
    if (this.value === undefined) { this.value = value; this.raw = value; this.time = time; return value; }
    const dt = Math.max(1 / 120, Math.min(0.2, (time - this.time) / 1000));
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    this.derivative += alpha(1) * ((value - this.raw) / dt - this.derivative);
    this.value += alpha(1.5 + 0.05 * Math.abs(this.derivative)) * (value - this.value);
    this.raw = value; this.time = time;
    return this.value;
  }
}
export class PoseTracker {
  private filters: OneEuro[][][] = [];
  private previousCount = 0;
  private candidate: ShadowPose = "neutral";
  private frames = 0;
  private pose: ShadowPose = "neutral";
  update(hands: Landmark[][], time: number): { pose: ShadowPose; hands: Landmark[][] } {
    if (!hands.length || !hands.every(validHand)) { this.reset(); return { pose: "neutral", hands: [] }; }
    if (hands.length !== this.previousCount) { this.filters = []; this.previousCount = hands.length; }
    const filtered = hands.map((h, i) => h.map((p, j) => {
      this.filters[i] ??= []; this.filters[i][j] ??= [new OneEuro(), new OneEuro(), new OneEuro()];
      const f = this.filters[i][j];
      return { x: f[0].filter(p.x, time), y: f[1].filter(p.y, time), z: f[2].filter(p.z, time) };
    }));
    const next = classifyHands(filtered);
    this.frames = next === this.candidate ? this.frames + 1 : 1;
    this.candidate = next;
    if (this.frames >= (next === "neutral" ? 8 : 6)) this.pose = next;
    return { pose: this.pose, hands: filtered };
  }
  reset() { this.filters = []; this.previousCount = 0; this.pose = this.candidate = "neutral"; this.frames = 0; }
}
