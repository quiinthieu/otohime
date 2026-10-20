import type { CSSProperties } from "react";
import type { Body } from "../_lib/bodies.ts";
import { cutaway } from "../_lib/cutaway.ts";
import { inkCircle, inkLine } from "../_lib/ink.ts";
import { Ink } from "./ink";

// Any body's cutaway as SVG: _lib/cutaway.ts draws it (pure, unit-tested) and
// this only maps it to elements. One <g data-layer> per layer, inside out, each
// drawn on in turn by orrery.css (its --at set here); then one <g data-mark>
// per mark (rings, spots, Sirius B...), and the pins above everything so nothing
// paints over a number. Every path has pathLength="1".

const STEP = 0.25; // seconds between layers, as on the Sun's stage

export function Cutaway({ body }: { body: Body }) {
  const c = cutaway(body);
  const at = (i: number) => ({ "--at": `${i * STEP}s` }) as CSSProperties;
  const label = `Cutaway of ${body.name} with a quarter removed, ${c.layers.length} layers numbered from the centre: ${body.layers
    .map((l, i) => `${i + 1} ${l.name.toLowerCase()}`)
    .join(", ")}; ${[c.compare.label, ...c.marks.flatMap((m) => (m.labels ?? []).map((l) => l.text))].join("; ")}.`;
  return (
    <svg className="sun-svg" viewBox="0 0 640 600" role="img" aria-label={label}>
      {c.layers.map((l, i) => (
        <g key={l.id} data-layer={l.id} style={at(i)}>
          <path className="wash" d={l.shape} pathLength="1" fill={body.layers[i].colour} fillRule="evenodd" />
          {/* rough.js returns the fill strokes first and the outline last */}
          <g className="hachure">
            <Ink paths={l.paths.slice(0, -1)} />
          </g>
          <Ink paths={l.paths.slice(-1)} />
        </g>
      ))}

      <g className="outline">
        <Ink paths={c.outline} />
      </g>

      {c.marks.map((m) => (
        // a dash in pathLength units: Polaris's pulse rings, about 20 px on, 16 off
        <g key={m.id} data-mark={m.id} strokeDasharray={m.dashed ? "0.012 0.0095" : undefined}>
          {m.wash && <path className="wash" d={m.wash.d} pathLength="1" fill={m.wash.colour} fillRule="evenodd" />}
          <Ink paths={m.paths} />
          {m.labels?.map((l) => (
            <text key={l.text} x={l.x} y={l.y} textAnchor="end">
              {l.text}
            </text>
          ))}
        </g>
      ))}

      <g data-pins="">
        {c.layers.map((l, i) => {
          const slid = l.pin.x !== l.anchor.x || l.pin.y !== l.anchor.y;
          return (
            <g key={l.id} className="pin" style={at(i)}>
              {slid && (
                <>
                  <Ink paths={inkLine(l.anchor.x, l.anchor.y, l.pin.x, l.pin.y, { seed: `${body.slug}-lead-${l.id}`, strokeWidth: 1.6, roughness: 0.8 })} />
                  <Ink paths={inkCircle(l.anchor.x, l.anchor.y, 2.5, { seed: `${body.slug}-tip-${l.id}`, fill: "#3a2a28", fillStyle: "solid", strokeWidth: 1 })} />
                </>
              )}
              <Ink paths={inkCircle(l.pin.x, l.pin.y, 15, { seed: `${body.slug}-pin-${l.id}`, fill: "#fffaf0", fillStyle: "solid", strokeWidth: 1.8, roughness: 1 })} />
              <text x={l.pin.x} y={l.pin.y + 8} textAnchor="middle">
                {l.n}
              </text>
            </g>
          );
        })}
      </g>

      <g className="compare" data-compare={c.compare.shape}>
        <Ink paths={c.compare.paths} />
        <text x={c.compare.at.x} y={c.compare.at.y} textAnchor={c.compare.shape === "orbit" ? "middle" : "end"}>
          {c.compare.label}
        </text>
      </g>
    </svg>
  );
}
