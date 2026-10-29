import type { Creature, Landmark } from "../shadow-poses.ts";
/** Synthetic landmarks, not a recording or a claim of natural-camera recognition. */
export function handFixture(extended: boolean[], thumb = false): Landmark[] {
  const h = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.65, z: 0 }));
  h[0] = { x: 0.5, y: 0.9, z: 0 };
  [1, 2, 3, 4].forEach((j, i) => { h[j] = { x: thumb ? 0.3 - i * 0.08 : 0.47 - i * 0.005, y: 0.7 - i * 0.025, z: 0 }; });
  [5, 9, 13, 17].forEach((base, finger) => {
    const x = 0.35 + finger * 0.1;
    for (let j = 0; j < 4; j++) h[base + j] = { x, y: j === 0 ? 0.62 : extended[finger] ? 0.52 - (j - 1) * 0.14 : j === 1 ? 0.54 : 0.65 + (j - 2) * 0.04, z: 0 };
  });
  return h;
}
export function poseFixture(pose: Creature): Landmark[][] {
  if (pose === "bird") return [handFixture([true, true, true, true], true), handFixture([true, true, true, true], true).map(p => ({ ...p, x: 1 - p.x }))];
  return [handFixture(pose === "rabbit" ? [true, true, false, false] : [true, false, false, true], pose === "deer")];
}
