import type { Swatch } from "@/components/figures";

export type Game = { title: string; note: string; colour: Swatch };

// The words on the public pages, in one place. A first draft: everything
// marked TODO(otohime) is invented and waits for the real thing.
export const site = {
  // TODO(otohime)
  play: "Six games in rotation. Win one from the cabinet to hear why.",
  // TODO(otohime): your games; the swatch is the capsule's colour
  games: [
    { title: "Factorio", note: "The factory must grow. So must the DAG.", colour: "yellow" },
    { title: "Celeste", note: "Every strawberry, eventually.", colour: "pink" },
    { title: "Hades II", note: "One more run, then bed.", colour: "coral" },
    { title: "Stardew Valley", note: "The crops have a spreadsheet.", colour: "mint" },
    { title: "Tetris Effect", note: "Bin packing, with feelings.", colour: "blue" },
    { title: "Outer Wilds", note: "Twenty-two minutes at a time.", colour: "yellow" },
  ] satisfies Game[],
};
