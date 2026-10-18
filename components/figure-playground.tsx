"use client";

import { swatches, type Swatch } from "@/components/figures";
import { useId, useState } from "react";

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
      <SwatchPicker value={colour} onChange={setColour} className="mx-auto mt-2 w-fit" />
    </div>
  );
}

export function SwatchPicker({
  value,
  onChange,
  className = "",
}: {
  value: Swatch;
  onChange: (colour: Swatch) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={className}>
      <legend className="caption mb-2">Colour</legend>
      <div className="flex gap-3">
        {(Object.keys(swatches) as Swatch[]).map((swatch) => (
          <label key={swatch}>
            <input
              type="radio"
              name={name}
              value={swatch}
              checked={value === swatch}
              onChange={() => onChange(swatch)}
              className="sr-only"
            />
            <span className="swatch" style={{ background: swatches[swatch] }} />
            <span className="sr-only">{swatch}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
