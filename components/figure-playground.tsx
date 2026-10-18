"use client";

import { swatches, type Swatch } from "@/components/figures";
import { useState } from "react";

// The reference's "figures you can play with": pick a swatch, the figure inside
// (color="inherit") repaints.
export function FigurePlayground({
  initial = "mint",
  children,
}: {
  initial?: Swatch;
  children: React.ReactNode;
}) {
  const [colour, setColour] = useState<Swatch>(initial);

  return (
    <div style={{ "--fig": swatches[colour] } as React.CSSProperties}>
      {children}
      <fieldset className="mx-auto mt-2 w-fit">
        <legend className="caption mb-2">Colour</legend>
        <div className="flex gap-3">
          {(Object.keys(swatches) as Swatch[]).map((name) => (
            <label key={name}>
              <input
                type="radio"
                name="colour"
                value={name}
                checked={colour === name}
                onChange={() => setColour(name)}
                className="sr-only"
              />
              <span className="swatch" style={{ background: swatches[name] }} />
              <span className="sr-only">{name}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
