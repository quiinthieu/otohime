// One infographic per article, keyed by slug. Each is a pure function of its
// article, drawing its numbers from the article's facts by id; a fact a
// figure leaves out is listed in UNDRAWN with the reason.
import type { Article } from "../articles.ts";
import { gigabyteFigure } from "./what-a-gigabyte-holds.ts";
import { iceFigure } from "./why-ice-floats.ts";
import { leapFigure } from "./why-we-need-a-leap-day.ts";
import { phoneFigure } from "./how-your-phone-knows-where-it-is.ts";
import { skyFigure } from "./why-the-sky-is-blue.ts";
import { tidesFigure } from "./how-tides-work.ts";
import type { Figure } from "./kit.ts";

export type { Figure, Label } from "./kit.ts";

export const FIGURES: Record<string, (a: Article) => Figure> = {
  "why-the-sky-is-blue": skyFigure,
  "why-we-need-a-leap-day": leapFigure,
  "how-your-phone-knows-where-it-is": phoneFigure,
  "what-a-gigabyte-holds": gigabyteFigure,
  "why-ice-floats": iceFigure,
  "how-tides-work": tidesFigure,
};

// slug → fact id → why the figure does not label it
export const UNDRAWN: Record<string, Record<string, string>> = {
  "why-we-need-a-leap-day": {
    rule: "the ruler draws the rule's result (97 leap days in 400 years, 1900 skipped, 2000 kept) rather than its words",
  },
};
