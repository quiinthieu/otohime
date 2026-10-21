import { replay } from "../_lib/machine.ts";
import { SCENE_KINDS } from "../_lib/scenes.ts";
import { inkStamps } from "../_lib/stamps.ts";
import { bySlug } from "../_lib/structures/index.ts";
import { MachineApp } from "./machine-app";

// The machine, on the server: ink the stamps this machine draws with (rough.js
// stays here), replay the worked example, and hand the island the finished
// path strings, the example's end state and its last move's trace. The island
// is server-rendered like the rest of the page, so with JavaScript off its
// HTML is the example's end state (drawn by the same sceneFor), the last
// sentence in the narration, every step of the last move as a numbered list
// and the controls greyed in a disabled fieldset.
export function Machine({ slug }: { slug: string }) {
  const structure = bySlug(slug);
  if (!structure) throw new Error(`no structure ${slug}`);
  const { state, last } = replay(structure, structure.example);
  const kinds = SCENE_KINDS[slug];
  const stamps = inkStamps().filter((s) => kinds.includes(s.kind));
  return (
    <figure className="figure machine" data-figure="machine">
      <MachineApp slug={slug} stamps={stamps} initial={state} exampleTrace={last.trace} />
      <figcaption>The machine, at the end of the worked example. Press a button to make a move and watch it, one step at a time.</figcaption>
    </figure>
  );
}
