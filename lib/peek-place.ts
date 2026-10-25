// Where a fan of peek cards sits (components/peek-layer.tsx): centred on the
// anchor, below it unless only above has room, and always inside the viewport
// by `margin`. A pointer anchor is a point (top === bottom); a focused link
// anchors on its own box, so the cards never cover it.
export type PeekAnchor = { x: number; top: number; bottom: number };
export type Size = { width: number; height: number };
export type Placement = { left: number; top: number; above: boolean };

export const PEEK_GAP = 12;
export const PEEK_MARGIN = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

export function placePeek(anchor: PeekAnchor, panel: Size, viewport: Size, gap = PEEK_GAP, margin = PEEK_MARGIN): Placement {
  const left = clamp(anchor.x - panel.width / 2, margin, viewport.width - panel.width - margin);
  const below = anchor.bottom + gap;
  const above = anchor.top - gap - panel.height;
  const roomBelow = viewport.height - margin - below;
  const roomAbove = anchor.top - gap - margin;
  // Below by default; above only when below is short and above is not shorter.
  const up = roomBelow < panel.height && roomAbove > roomBelow;
  const top = clamp(up ? above : below, margin, viewport.height - panel.height - margin);
  return { left: Math.round(left), top: Math.round(top), above: up };
}

// The point inside the panel the cards fan out from and tuck back into.
export function fanOrigin(anchor: PeekAnchor, place: Placement): { x: number; y: number } {
  return { x: Math.round(anchor.x - place.left), y: Math.round((place.above ? anchor.top : anchor.bottom) - place.top) };
}
