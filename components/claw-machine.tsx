"use client";

import { box, screen, swatches, type Point } from "@/components/figures";
import { Chip, Machine, press, Stat, useTick } from "@/components/machine";
import type { Game } from "@/content/site";
import { claw, clawBusy, DROP, newClaw, SLOTS } from "@/lib/machines";
import { useReducer } from "react";

// A crane game on a W × W footprint: a cabinet, a glass case, a marquee.
const O: [number, number] = [262, 242];
const W = 110;
const BASE = 70;
const TOP = 190; // the case's ceiling
const R = 11; // capsule radius

// The claw runs along the case's diagonal, which reads as left to right on
// screen. Slot 0 hangs over the prize chute in the left corner.
const spot = (slot: number): [number, number] => [20 + 13 * slot, 90 - 13 * slot];

const cabinet = box(O, W, W, BASE, [0, 0, 0], 110);
const glass = box(O, W, W, TOP - BASE, [0, 0, BASE]);
const marquee = box(O, W, W, 30, [0, 0, TOP]);
const ledge = box(O, 16, 56, 8, [W, 34, BASE - 14]);
const { poly } = cabinet;
const xy = (point: Point) => screen(O, point).map((n) => Math.round(n * 10) / 10);

function Capsule({ at, colour }: { at: Point; colour: string }) {
  const [x, y] = xy(at);
  return (
    <g>
      <circle cx={x} cy={y} r={R} className="fig-paper" />
      <path d={`M${x - R} ${y}A${R} ${R} 0 0 1 ${x + R} ${y}Z`} fill={colour} />
      <circle cx={x} cy={y} r={R} fill="none" />
      <path d={`M${x - 6.5} ${y - 3}a6 6 0 0 1 4-5`} className="fig-glint" />
    </g>
  );
}

// Carriage under the ceiling, cable, motor and two prongs, in steel.
function Arm({ slot, drop, closed, holding }: { slot: number; drop: number; closed: boolean; holding?: string }) {
  const [x, y] = spot(slot);
  const high = TOP - 26;
  const low = BASE + R + 16; // prongs around a capsule on the floor
  const z = high - ((high - low) * drop) / DROP;
  const carriage = box(O, 14, 14, 8, [x - 7, y - 7, TOP - 8]);
  const motor = box(O, 10, 10, 9, [x - 5, y - 5, z]);
  const [cx, cy] = xy([x, y, TOP - 8]);
  const [hx, hy] = xy([x, y, z]);
  const t = hy + 5; // the prongs hang from the motor's front corner
  const prong = (side: number) =>
    closed
      ? `M${hx + 3 * side} ${t}L${hx + 11 * side} ${t + 8}L${hx + 5 * side} ${t + 18}`
      : `M${hx + 3 * side} ${t}L${hx + 14 * side} ${t + 8}L${hx + 12 * side} ${t + 18}`;
  return (
    <g style={{ "--fig": "#cfc8b8" } as React.CSSProperties}>
      <line x1={cx} y1={cy} x2={hx} y2={hy - 9} strokeWidth={1.6} />
      <polygon className="fig-shaded" points={carriage.shaded} />
      <polygon className="fig-lit" points={carriage.lit} />
      <polygon className="fig-top" points={motor.top} />
      <polygon className="fig-shaded" points={motor.shaded} />
      <polygon className="fig-lit" points={motor.lit} />
      {holding ? <Capsule at={[x, y, z - 16]} colour={holding} /> : null}
      {[-1, 1].map((side) => (
        <g key={side}>
          <path d={prong(side)} fill="none" strokeWidth={5.5} />
          <path d={prong(side)} fill="none" className="fig-metal" strokeWidth={2.6} />
        </g>
      ))}
    </g>
  );
}

export function ClawMachine({ games }: { games: Game[] }) {
  const [s, dispatch] = useReducer(claw, games.length, newClaw);
  const busy = clawBusy(s);
  useTick(busy, dispatch);

  const closed =
    s.phase === "up" ||
    s.phase === "carry" ||
    (s.phase === "grab" && s.wait < 2) ||
    (s.phase === "release" && s.wait === 3);
  const falling = s.phase === "release" && s.wait < 3 ? s.holding : null;
  const held = s.holding && !falling ? swatches[games[s.holding.game].colour] : undefined;
  const won = s.last === null ? null : games[s.last];
  const readout = s.missed
    ? "Nothing there. Try again."
    : won
      ? `Won ${won.title}. ${won.note}`
      : "Line the claw up, then drop.";
  const [jx, jy] = xy([W + 8, 50, BASE - 6]);
  const [bx, by] = xy([W + 8, 76, BASE - 6]);

  return (
    <Machine
      label="Claw machine"
      caption="Crane"
      colour="pink"
      viewBox="0 0 440 380"
      busy={busy}
      readout={readout}
      controls={
        <>
          <Chip aria-disabled={busy || s.slot === 0 || undefined} onClick={() => press(dispatch, "left")}>
            Move ◀
          </Chip>
          <Chip aria-disabled={busy || s.slot === SLOTS || undefined} onClick={() => press(dispatch, "right")}>
            Move ▶
          </Chip>
          <Chip aria-disabled={busy || undefined} onClick={() => press(dispatch, "drop")}>
            Drop
          </Chip>
        </>
      }
      stats={
        <>
          <Stat k="Prizes" v={s.prizes} />
          <Stat k="Last" v={won?.title ?? "—"} small />
        </>
      }
    >
      <polygon className="fig-shade" points={cabinet.shadow} />
      <polygon className="fig-shaded" points={cabinet.shaded} />
      <polygon className="fig-lit" points={cabinet.lit} />
      <g transform={cabinet.onShaded}>
        <rect x={0} y={-50} width={W} height={7} className="fig-top" />
        <rect x={0} y={-37} width={W} height={4} className="fig-top" />
      </g>
      {/* the prize door shows the latest win; a coin slot beside it */}
      <g transform={cabinet.onLit}>
        <rect x={12} y={-46} width={36} height={32} rx={3} className="fig-dark" />
        {won ? <circle cx={30} cy={-24} r={7} fill={swatches[won.colour]} /> : null}
        <path d="M12 -36h36" fill="none" />
        <rect x={74} y={-50} width={24} height={34} rx={3} className="fig-paper" />
        <path d="M86 -43v10" fill="none" strokeWidth={3.5} />
        <rect x={80} y={-27} width={12} height={6} rx={1.5} className="fig-dark" />
      </g>

      {/* inside the case: back walls, floor, chute, rail */}
      <polygon className="fig-inside-lit" points={poly([[0, 0, BASE], [0, W, BASE], [0, W, TOP], [0, 0, TOP]])} />
      <polygon className="fig-inside" points={poly([[0, 0, BASE], [W, 0, BASE], [W, 0, TOP], [0, 0, TOP]])} />
      <polygon className="fig-floor" points={poly([[0, 0, BASE], [W, 0, BASE], [W, W, BASE], [0, W, BASE]])} />
      <polygon className="fig-dark" points={poly([[8, 78, BASE], [32, 78, BASE], [32, 102, BASE], [8, 102, BASE]])} />
      <polyline points={poly([[...spot(-0.5), TOP - 2], [...spot(SLOTS + 0.5), TOP - 2]])} fill="none" strokeWidth={6} />
      <polyline
        points={poly([[...spot(-0.5), TOP - 2], [...spot(SLOTS + 0.5), TOP - 2]])}
        fill="none"
        className="fig-metal"
        strokeWidth={3}
      />
      {s.capsules.map((c) => (
        <Capsule key={c.slot} at={[...spot(c.slot), BASE + R]} colour={swatches[games[c.game].colour]} />
      ))}
      {falling ? (
        <Capsule
          at={[...spot(0), s.wait === 2 ? BASE + R + 34 : BASE + R - 6]}
          colour={swatches[games[falling.game].colour]}
        />
      ) : null}
      <Arm slot={s.slot} drop={s.drop} closed={closed} holding={held} />

      {/* the glass, then the control ledge in front of it */}
      <polygon className="fig-glass" points={glass.shaded} />
      <polygon className="fig-glass" points={glass.lit} />
      <g transform={glass.onLit} className="fig-glint">
        <path d="M18 -24 40 -70M30 -20 42 -44" />
      </g>
      <g transform={glass.onShaded} className="fig-glint">
        <path d="M70 -28 90 -72" />
      </g>
      <polyline points={poly([[W, W, BASE], [W, W, TOP]])} fill="none" strokeWidth={4} />
      <polygon className="fig-top" points={ledge.top} />
      <polygon className="fig-shaded" points={ledge.shaded} />
      <polygon className="fig-lit" points={ledge.lit} />
      <line x1={jx} y1={jy} x2={jx} y2={jy - 15} strokeWidth={3} />
      <circle cx={jx} cy={jy - 18} r={5} className="fig-dark" />
      <ellipse cx={bx} cy={by - 1} rx={5.5} ry={3.2} className="fig-lamp" />

      {/* marquee: a sign on the front, bulbs down the side */}
      <polygon className="fig-top" points={marquee.top} />
      <polygon className="fig-shaded" points={marquee.shaded} />
      <polygon className="fig-lit" points={marquee.lit} />
      <g transform={marquee.onLit}>
        <rect x={9} y={-25} width={92} height={20} rx={3} className="fig-paper" />
        <text x={55} y={-11} textAnchor="middle" className="fig-text">
          PRIZE CLAW
        </text>
      </g>
      <g transform={marquee.onShaded}>
        {[14, 31, 48, 65, 82, 99].map((x) => (
          <circle key={x} cx={x} cy={-15} r={3.6} className="bulb" />
        ))}
      </g>
    </Machine>
  );
}
