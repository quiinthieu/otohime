import type { Creature } from "@/lib/shadow-poses";
// Equal-length outlines allow the same ink path to morph between all four silhouettes.
const OUTLINES: Record<Creature, number[][]> = {
  rabbit: [[22,94],[17,83],[20,70],[30,61],[35,50],[29,30],[26,6],[33,2],[43,21],[46,40],[49,43],[52,22],[59,3],[66,5],[65,29],[61,48],[72,53],[79,63],[75,72],[64,77],[69,89],[84,93],[82,98],[36,98]],
  dog: [[16,96],[14,81],[23,70],[34,63],[37,49],[31,20],[39,16],[52,35],[60,37],[66,24],[76,19],[77,39],[86,46],[98,47],[96,58],[83,64],[73,66],[67,77],[72,87],[88,92],[87,98],[59,98],[48,87],[32,97]],
  bird: [[48,96],[40,81],[33,68],[19,62],[3,43],[0,27],[16,35],[30,43],[38,54],[40,43],[46,30],[54,28],[62,35],[68,36],[60,43],[64,54],[74,44],[88,35],[100,27],[96,46],[80,65],[65,72],[59,87],[54,97]],
  deer: [[13,96],[16,79],[32,69],[43,59],[46,40],[34,25],[25,24],[24,18],[34,19],[31,7],[37,8],[43,27],[49,33],[54,30],[59,9],[65,7],[64,21],[76,17],[77,23],[65,28],[63,43],[75,50],[70,67],[58,98]],
};
export function creaturePath(creature: Creature): string {
  return OUTLINES[creature].map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ") + "Z";
}
export const DESTINATIONS: Record<Creature, { href: string; label: string }> = {
  rabbit: { href: "/notes", label: "Notes" }, dog: { href: "/projects", label: "Projects" }, bird: { href: "/notes", label: "Notes" }, deer: { href: "/projects", label: "Projects" },
};
export function CreatureArt({ creature }: { creature: Creature }) {
  return <svg viewBox="0 0 100 105" aria-hidden="true"><path d={creaturePath(creature)} fill="currentColor"/><circle cx={creature === "bird" ? 54 : 67} cy={creature === "bird" ? 36 : 57} r="1.6" fill="#f4eddb"/></svg>;
}
