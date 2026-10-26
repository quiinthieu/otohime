// The Suminagashi Pond's still print: the seeded recipe from lib/marble.ts replayed on the server and drawn as SVG,
// bottom drop first, each in its ink. It is what shows with JavaScript off, under reduced motion or Save-Data, while
// the canvas loads, and for good if WebGL is lost. The live pond (components/pond.tsx) starts from the same recipe,
// so the canvas arriving changes nothing you can see.
import { recipe, replay, toSvgPaths, type Ink } from "@/lib/marble";

/** The pond's own coordinate space, in model px; the canvas and the SVG scale it to the box. */
export const POND_W = 600;
export const POND_H = 400;
export const POND_SEED = 0x5a1;

/** The water, and the pigments on it. Clear water is a drop of the water's own colour, spreading rings apart. */
export const WATER = "#f2efe7";
export const INK_HEX: Record<Ink, string> = {
  sumi: "#231e16",
  shade: "#3f4e93",
  coral: "#ef6a4c",
  blue: "#76a0e2",
  clear: WATER,
};

export const pondRecipe = () => recipe(POND_SEED, POND_W, POND_H);

export function PondStatic() {
  const { marble } = replay(pondRecipe(), POND_W, POND_H);
  return (
    <svg
      className="pond-still"
      viewBox={`0 0 ${POND_W} ${POND_H}`}
      role="img"
      aria-label="A suminagashi print: rings of sumi ink combed into waves on pale water."
      focusable="false"
    >
      <rect width={POND_W} height={POND_H} fill={WATER} />
      {toSvgPaths(marble).map((p, i) => (
        <path key={i} d={p.d} fill={INK_HEX[p.ink]} />
      ))}
    </svg>
  );
}
