// Prints every drawn Capsule card as one SVG, so the art can be reviewed without playing.
//   npm run --silent capsule:sheet > /tmp/capsule.svg
import { CARDS } from "../app/(capsule)/_lib/cards.ts";
import { sheetSvg } from "../app/(capsule)/_lib/art/svg.ts";

process.stdout.write(sheetSvg(CARDS));
