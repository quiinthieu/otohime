import { TitleMorph, type ConsolePage } from "./figures";
import { StampIsland } from "./stamp-island";

// A FigTitle whose words can come loose as rubber-stamp blocks (only /play uses it). The heading is drawn
// here on the server, so it reads and works without JavaScript; the island adds the "Stamp it" chip and
// the long-press, and loads the board only when one of them is used. The "Fig. NN —" prefix sits outside
// .stamp-text, so it never becomes a stamp. morph names the h1 for the console's label, as FigTitle's does.
export function StampHeading({
  n,
  hint,
  morph,
  children,
}: {
  n: string;
  hint?: React.ReactNode;
  morph?: ConsolePage;
  children: string;
}) {
  const h1 = (
    <h1 className="stamp-title">
      <span aria-hidden="true">Fig. {n} — </span>
      <span className="stamp-text">{children}</span>
    </h1>
  );
  return (
    <div className="stamp-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-1">
        {morph ? <TitleMorph page={morph}>{h1}</TitleMorph> : h1}
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          {hint ? <p className="text-muted">{hint}</p> : null}
          <StampIsland />
        </div>
      </div>
    </div>
  );
}
