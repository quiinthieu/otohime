// The machines' kit of hand-inked stamps: eight kinds, three seeds each, so a
// row of boxes does not look stamped by one rubber block. The server inks them
// once and hands the island their path strings as props; the island draws
// each once in <defs> and places it with <use href="#box-1">, so rough.js
// never reaches the browser. Sizes and ids live in paper.ts, which scenes.ts
// shares without loading any ink.
import { arrow } from "./kit.ts";
import { inkCircle, inkEllipse, inkLine, inkPath, inkRect, type InkPath } from "./ink.ts";
import { STAMP_KINDS, STAMP_SEEDS, STAMP_SIZE, stampId, type StampKind, type StampSeed } from "./paper.ts";

export { STAMP_KINDS, STAMP_SEEDS, STAMP_SIZE, stampBounds, stampId, type StampKind, type StampSeed } from "./paper.ts";

export type Stamp = { id: string; kind: StampKind; paths: string[] };

function draw(kind: StampKind, n: StampSeed): InkPath[] {
  const o = { seed: `${kind}:${n}` };
  switch (kind) {
    case "box": {
      const { w, h } = STAMP_SIZE.box;
      return inkRect(-w / 2, -h / 2, w, h, o);
    }
    case "plate": {
      // the plate's rim and the dip in its middle
      const { w, h } = STAMP_SIZE.plate;
      return [...inkEllipse(0, 0, w, h, o), ...inkEllipse(0, -1, w * 0.6, h * 0.4, { ...o, seed: `${o.seed}:dip`, strokeWidth: 1.4 })];
    }
    case "node":
      return inkCircle(0, 0, STAMP_SIZE.node.r, o);
    case "bucket": {
      // open at the top, so the chain hangs out of it
      const { w, h } = STAMP_SIZE.bucket;
      return inkPath(`M${-w / 2} ${-h / 2} L${-w / 2 + 3} ${h / 2} L${w / 2 - 3} ${h / 2} L${w / 2} ${-h / 2}`, o);
    }
    case "tile": {
      const { w, h } = STAMP_SIZE.tile;
      return inkRect(-w / 2, -h / 2, w, h, o);
    }
    case "station":
      return inkCircle(0, 0, STAMP_SIZE.station.r, { ...o, strokeWidth: 2.6 });
    case "arrow":
      return arrow(0, 0, STAMP_SIZE.arrow.length, 0, o, STAMP_SIZE.arrow.head);
    case "hand": {
      // a slim clock hand, its tip on the origin
      const { length, width } = STAMP_SIZE.hand;
      return [
        ...inkPath(`M${-length} 0 L${-length * 0.35} ${-width / 2} L0 0 L${-length * 0.35} ${width / 2} Z`, o),
        ...inkLine(-length, 0, -length * 0.35, 0, { ...o, seed: `${o.seed}:spine`, strokeWidth: 1.4 }),
      ];
    }
  }
}

/** All 24 stamps, kind by kind, seeds 0 to 2. Pure: the same paths every call. */
export function inkStamps(): Stamp[] {
  return STAMP_KINDS.flatMap((kind) => STAMP_SEEDS.map((n) => ({ id: stampId(kind, n), kind, paths: draw(kind, n).map((p) => p.d) })));
}
