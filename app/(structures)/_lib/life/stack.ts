// A pile of plates by the sink. The top plate is the spot: it went on last
// and it comes off first.
import { inkEllipse, inkLine, inkPath, type InkPath } from "../ink.ts";
import { arrow, label, SMALL, SPOT, WIDTH, type Figure } from "../kit.ts";

const PILE = { x: 330, floor: 244, pitch: 18, count: 6, w: 128, h: 22 };

export function stackLife(): Figure {
  const paths: InkPath[] = [
    // the counter, the basin and the tap
    ...inkLine(14, 258, 466, 258, { seed: "sink:counter", strokeWidth: 2.6 }),
    ...inkPath("M28 180 L52 252 L188 252 L212 180", { seed: "sink:basin" }),
    ...inkLine(22, 180, 218, 180, { seed: "sink:rim" }),
    ...inkPath("M120 180 L120 128 L164 128 L164 146", { seed: "sink:tap" }),
  ];
  const spot: InkPath[] = [];
  for (let i = 0; i < PILE.count; i++) {
    const y = PILE.floor - i * PILE.pitch;
    const top = i === PILE.count - 1;
    const o = top ? { seed: `sink:plate${i}`, stroke: SPOT, fill: SPOT, fillStyle: "hachure" as const, hachureGap: 6 } : { seed: `sink:plate${i}` };
    (top ? spot : paths).push(...inkEllipse(PILE.x, y, PILE.w, PILE.h, o));
  }
  const topY = PILE.floor - (PILE.count - 1) * PILE.pitch;
  paths.push(
    ...arrow(296, 64, 296, topY - 20, { seed: "sink:on", strokeWidth: 1.8 }),
    ...arrow(364, topY - 20, 364, 64, { seed: "sink:off", strokeWidth: 1.8 }),
  );
  return {
    viewBox: [WIDTH, 290],
    paths,
    spot,
    labels: [
      label(286, 48, "last on", { anchor: "end", size: SMALL }),
      label(374, 48, "first off", { anchor: "start", size: SMALL, spot: true }),
      label(120, 282, "sink", { anchor: "middle", size: SMALL }),
    ],
  };
}
