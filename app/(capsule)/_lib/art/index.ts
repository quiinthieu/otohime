// Every drawn card, by id. A card with no entry yet shows its name on the frame.
import type { CardId } from "../cards.ts";
import { jiji } from "./jiji.ts";
import { noFace } from "./no-face.ts";
import { sootSprite } from "./soot-sprite.ts";
import { totoro } from "./totoro.ts";
import type { Drawing } from "./types.ts";

export const ART: Partial<Record<CardId, Drawing>> = {
  "soot-sprite": sootSprite,
  jiji,
  totoro,
  "no-face": noFace,
};
