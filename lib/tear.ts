export type TearState = "intact" | "peeled";
export function tearState(_state: TearState, action: "peel" | "reset" | "cancel"): TearState {
  return action === "peel" ? "peeled" : "intact";
}
/** Clip the painted corner only. Text and controls never enter this polygon. */
export function deckle(seed: number, amount: number): string {
  const p=Number.isFinite(amount) ? Math.max(0,Math.min(1,amount)) : 0;
  if(p===0) return "polygon(0 0, 100% 0, 100% 100%, 0 100%)";
  let n=seed>>>0;
  const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  const cut=84*p;
  const points=["0 0",`${(100-cut).toFixed(2)}% 0`];
  for(let i=1;i<12;i++) {
    const t=i/12, jitter=(random()-0.5)*5*p;
    points.push(`${Math.min(100,100-cut+cut*t+jitter).toFixed(2)}% ${Math.max(0,cut*t-jitter).toFixed(2)}%`);
  }
  points.push(`100% ${cut.toFixed(2)}%`,"100% 100%","0 100%");
  return `polygon(${points.join(", ")})`;
}
