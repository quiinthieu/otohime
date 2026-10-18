"use client";

import { box, swatches, type Point, type Swatch } from "@/components/figures";
import { Chip, Machine, press, Stat, useTick } from "@/components/machine";
import { BELT, binX, conveyor, conveyorBusy, LANES, newConveyor, type Parcel } from "@/lib/machines";
import { useReducer } from "react";

// A sorting line: the hopper extracts, the belt carries, the bins load.
const O: [number, number] = [128, 158];
const BW = 36; // belt width
const BH = 44; // the belt's top
const BIN = 30; // bin height
const LANE: Swatch[] = ["yellow", "coral", "mint", "blue", "pink"];

const belt = box(O, BELT, BW, BH);
const hopper = box(O, 52, 52, 36, [-8, -8, 80]);
const chute = box(O, 22, 22, 22, [7, 7, 58]);
const bins = Array.from({ length: LANES }, (_, lane) => box(O, 40, 40, BIN, [binX(lane) - 20, 46, 0]));
const { poly } = belt;
// Steel legs with an ink edge, so they show on dark paper too.
function Leg({ x, y }: { x: number; y: number }) {
  const points = poly([[x, y, 0], [x, y, 80]]);
  return (
    <>
      <polyline points={points} fill="none" strokeWidth={6} />
      <polyline points={points} fill="none" className="fig-metal" strokeWidth={2.6} />
    </>
  );
}
const fill = (n: number) => Math.min(n, 6) * 4; // a bin's contents, capped at its rim

// Where a parcel's back corner sits: on the belt, then three frames off its
// front edge, through the air, into its bin.
function corner(p: Parcel, bins: number[]): Point {
  const x = p.x - 7;
  if (p.fall === 0) return [x, 11, BH];
  if (p.fall === 1) return [x, 24, BH];
  if (p.fall === 2) return [x, 42, BH - 8];
  return [x, 59, fill(bins[p.lane])];
}

function Cube({ at, colour }: { at: Point; colour: Swatch }) {
  const b = box(O, 14, 14, 12, at);
  return (
    <g style={{ "--fig": swatches[colour] } as React.CSSProperties}>
      <polygon className="fig-top" points={b.top} />
      <polygon className="fig-shaded" points={b.shaded} />
      <polygon className="fig-lit" points={b.lit} />
    </g>
  );
}

export function Conveyor() {
  const [s, dispatch] = useReducer(conveyor, undefined, newConveyor);
  const busy = conveyorBusy(s);
  useTick(busy, dispatch);

  const rows = s.rows.toLocaleString("en-US");
  const readout = !s.batches
    ? "Press run to load a batch."
    : s.rows === 0
      ? "Truncated. The tables are empty."
      : `Batch ${s.batches} loaded ${s.batch.toLocaleString("en-US")} rows.`;
  const onBelt = s.parcels.filter((p) => p.fall < 2);
  const shift = (s.belt % 2) * 10; // the stripes step along on twos

  return (
    <Machine
      label="Data pipeline"
      caption="Pipeline"
      colour="mint"
      viewBox="0 0 440 360"
      busy={busy}
      readout={readout}
      controls={
        <>
          <Chip aria-disabled={busy || undefined} onClick={() => press(dispatch, "run")}>
            Run batch
          </Chip>
          <Chip aria-disabled={busy || s.rows === 0 || undefined} onClick={() => press(dispatch, "truncate")}>
            Truncate
          </Chip>
        </>
      }
      stats={
        <>
          <Stat k="Rows" v={rows} />
          <Stat k="Batches" v={s.batches} small />
        </>
      }
    >
      <polygon className="fig-shade" points={belt.shadow} />
      {bins.map((bin, lane) => (
        <polygon key={lane} className="fig-shade" points={bin.shadow} />
      ))}
      <Leg x={-6} y={-6} />
      <Leg x={40} y={-6} />

      {/* the belt: frame in the machine's colour, rubber on top */}
      <polygon className="fig-shaded" points={belt.shaded} />
      <polygon className="fig-lit" points={belt.lit} />
      <polygon className="fig-dark" points={belt.top} />
      <g className="fig-belt">
        {Array.from({ length: 15 }, (_, i) => 4 + i * 20 + shift).map((x) => (
          <polyline key={x} points={poly([[x, 4, BH], [x, BW - 4, BH]])} fill="none" />
        ))}
      </g>
      <g transform={belt.onLit}>
        <circle cx={BW / 2} cy={-BH + 8} r={6} className="fig-paper" />
      </g>
      <Leg x={-6} y={40} />
      {onBelt.map((p) => (
        <Cube key={p.id} at={corner(p, s.bins)} colour={LANE[p.lane]} />
      ))}

      {/* bins: inside, contents, anything falling in, then the front walls */}
      {bins.map((bin, lane) => {
        const x = binX(lane) - 20;
        const level = fill(s.bins[lane]);
        return (
          <g key={lane} style={{ "--fig": swatches[LANE[lane]] } as React.CSSProperties}>
            <polygon className="fig-inside" points={poly([[x, 46, BIN], [x + 40, 46, BIN], [x + 40, 86, BIN], [x, 86, BIN]])} />
            {level ? (
              <polygon className="fig-top" points={poly([[x + 2, 48, level], [x + 38, 48, level], [x + 38, 84, level], [x + 2, 84, level]])} />
            ) : null}
            {s.parcels
              .filter((p) => p.lane === lane && p.fall >= 2)
              .map((p) => (
                <Cube key={p.id} at={corner(p, s.bins)} colour={LANE[lane]} />
              ))}
            <polygon className="fig-shaded" points={bin.shaded} />
            <polygon className="fig-lit" points={bin.lit} />
          </g>
        );
      })}

      {/* the hopper, last: parcels come out from under its chute */}
      <polygon className="fig-shaded" points={chute.shaded} />
      <polygon className="fig-lit" points={chute.lit} />
      <polygon className="fig-top" points={hopper.top} />
      <polygon className="fig-shaded" points={hopper.shaded} />
      <polygon className="fig-lit" points={hopper.lit} />
      <g transform={hopper.onLit}>
        <rect x={5} y={-26} width={42} height={16} rx={3} className="fig-paper" />
        <text x={26} y={-15} textAnchor="middle" className="fig-text" style={{ fontSize: 7.5 }}>
          EXTRACT
        </text>
      </g>
    </Machine>
  );
}
