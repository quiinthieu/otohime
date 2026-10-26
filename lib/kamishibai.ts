/** Source-owned SVG path data only; no markup, remote images or HTML captions. */
export type StoryCard = { id: string; title: string; caption: string; art: readonly string[] };
export type ProjectStory = { href: string; title: string; cards: readonly StoryCard[] };
export type TheatreState = { project: string; card: number };
export function advanceCard(index: number, delta: number, count: number): number {
  if (!Number.isFinite(index) || !Number.isFinite(delta) || !Number.isFinite(count) || count < 1) return 0;
  return Math.max(0, Math.min(Math.trunc(count) - 1, Math.trunc(index + delta)));
}
export function selectProject(project: string): TheatreState { return { project, card: 0 }; }
export function acceptsArrow(target: { tagName: string; blocked: boolean }, key: string): boolean {
  return !target.blocked && !/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) && (key === "ArrowLeft" || key === "ArrowRight");
}
