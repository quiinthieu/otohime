// The page's layout as numbers, so a test can prove what YouTube asks of it:
// the player is at least 200×200 (480×270 on a desktop) and nothing is drawn
// over any part of it. vinyl.css uses these same constants:
//
//   desktop (≥ DESKTOP_MIN px): grid-template-columns:
//     max(CRATE_MIN_W, CRATE_SHARE) 1fr max(MONITOR_MIN_W + 2 × BEZEL, MONITOR_SHARE)
//     crate | turntable, LCD, transport | monitor (frame around the player)
//   below: one column, crate · turntable · monitor · LCD · transport, and the
//     player is width: 100%; height: max(200px, 56.25vw).
//
// The monitor box here is the player itself (the host <div>); the bezel is
// padding around it, never on top of it.

export type Box = { x: number; y: number; w: number; h: number };

export const DESKTOP_MIN = 1024; // the three-column layout starts here
export const PAGE_PAD = 16;
export const GAP = 16;
export const CONTENT_MAX = 1440;
export const HEADER_H = 72;

export const CRATE_MIN_W = 180;
export const CRATE_SHARE = 0.18;
export const CRATE_DESKTOP_H = 640;
export const CRATE_PHONE_H = 340; // one scrolling row of sleeves

export const MONITOR_MIN_W = 480; // the player, not counting the bezel
export const MONITOR_MIN_H = 200;
export const MONITOR_TARGET_H = 270; // 480 × 9 / 16
export const MONITOR_SHARE = 0.4;
export const MONITOR_PHONE_VH = 0.5625; // height: max(200px, 56.25vw)
export const BEZEL = 14; // the frame's padding around the player

export const TURNTABLE_MAX_W = 420;
// The turntable is one SVG in a 500 × 400 view; the cell clips it (overflow: hidden).
export const TURNTABLE_VIEW = { w: 500, h: 400 };
export const PLATTER = { cx: 200, cy: 200, r: 176 };
export const TONEARM_PIVOT = { x: 440, y: 64 };
export const TONEARM_SWEEP: Box = { x: 206, y: 12, w: 292, h: 384 }; // every angle the arm can take (0° to 45°, tonearm.ts) and its shadow, inside the view
export const LCD_H = 72;
export const TRANSPORT_H = 112;

export type Layout = {
  mode: "desktop" | "stacked";
  crate: Box;
  turntable: Box;
  platter: Box;
  tonearmSweep: Box;
  lcd: Box;
  transport: Box;
  monitorFrame: Box; // the bezel and the player
  monitor: Box; // the player alone
};

const scaled = (inner: Box, outer: Box, view: { w: number; h: number }): Box => {
  const k = outer.w / view.w;
  return { x: outer.x + inner.x * k, y: outer.y + inner.y * k, w: inner.w * k, h: inner.h * k };
};

function deck(cell: Box): Pick<Layout, "turntable" | "platter" | "tonearmSweep"> {
  const w = Math.min(cell.w, TURNTABLE_MAX_W);
  const turntable = { x: cell.x + (cell.w - w) / 2, y: cell.y, w, h: (w * TURNTABLE_VIEW.h) / TURNTABLE_VIEW.w };
  const p = PLATTER;
  return {
    turntable,
    platter: scaled({ x: p.cx - p.r, y: p.cy - p.r, w: 2 * p.r, h: 2 * p.r }, turntable, TURNTABLE_VIEW),
    tonearmSweep: scaled(TONEARM_SWEEP, turntable, TURNTABLE_VIEW),
  };
}

export function layout(viewportWidth: number): Layout {
  const vw = Math.max(0, viewportWidth);
  const content = Math.min(vw - 2 * PAGE_PAD, CONTENT_MAX);
  const left = (vw - content) / 2;
  const top = HEADER_H;

  if (vw >= DESKTOP_MIN) {
    const crateW = Math.max(CRATE_MIN_W, CRATE_SHARE * content);
    const frameW = Math.max(MONITOR_MIN_W + 2 * BEZEL, MONITOR_SHARE * content);
    const middleW = content - crateW - frameW - 2 * GAP;
    const middle = { x: left + crateW + GAP, y: top, w: middleW, h: 0 };
    const d = deck(middle);
    const lcd = { x: middle.x, y: d.turntable.y + d.turntable.h + GAP, w: middleW, h: LCD_H };
    const transport = { x: middle.x, y: lcd.y + LCD_H + GAP, w: middleW, h: TRANSPORT_H };
    const playerW = frameW - 2 * BEZEL;
    const playerH = (playerW * 9) / 16;
    const frameX = left + content - frameW;
    return {
      mode: "desktop",
      crate: { x: left, y: top, w: crateW, h: CRATE_DESKTOP_H },
      ...d,
      lcd,
      transport,
      monitorFrame: { x: frameX, y: top, w: frameW, h: playerH + 2 * BEZEL },
      monitor: { x: frameX + BEZEL, y: top + BEZEL, w: playerW, h: playerH },
    };
  }

  const crate = { x: left, y: top, w: content, h: CRATE_PHONE_H };
  const d = deck({ x: left, y: crate.y + crate.h + GAP, w: content, h: 0 });
  const frameY = d.turntable.y + d.turntable.h + GAP;
  const playerW = content - 2 * BEZEL;
  const playerH = Math.max(MONITOR_MIN_H, MONITOR_PHONE_VH * vw);
  const monitorFrame = { x: left, y: frameY, w: content, h: playerH + 2 * BEZEL };
  const lcd = { x: left, y: frameY + monitorFrame.h + GAP, w: content, h: LCD_H };
  return {
    mode: "stacked",
    crate,
    ...d,
    lcd,
    transport: { x: left, y: lcd.y + LCD_H + GAP, w: content, h: TRANSPORT_H },
    monitorFrame,
    monitor: { x: left + BEZEL, y: frameY + BEZEL, w: playerW, h: playerH },
  };
}

// True when two boxes share some area; touching edges do not count.
export function intersects(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function contains(outer: Box, inner: Box): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}
