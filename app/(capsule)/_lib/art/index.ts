// Every drawn card, by id. A card with no entry yet shows its name on the frame.
import type { CardId } from "../cards.ts";
import { calcifer } from "./calcifer.ts";
import { catbus } from "./catbus.ts";
import { heen } from "./heen.ts";
import { jiji } from "./jiji.ts";
import { kiki } from "./kiki.ts";
import { kodama } from "./kodama.ts";
import { noFace } from "./no-face.ts";
import { ponyo } from "./ponyo.ts";
import { robotSoldier } from "./robot-soldier.ts";
import { sootSprite } from "./soot-sprite.ts";
import { teto } from "./teto.ts";
import { totoro } from "./totoro.ts";
import type { Drawing } from "./types.ts";

export const ART: Partial<Record<CardId, Drawing>> = {
  "soot-sprite": sootSprite,
  jiji,
  kodama,
  heen,
  teto,
  ponyo,
  totoro,
  catbus,
  calcifer,
  kiki,
  "no-face": noFace,
  "robot-soldier": robotSoldier,
};
