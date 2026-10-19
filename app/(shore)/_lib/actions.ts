// The ledger changes behind Shore's buttons, kept pure so a test can press them
// without a browser. shore-app.tsx feeds each one through its update().
import type { Ledger, Scene } from "./ledger.ts";
import { dayNumber, mint, type Length } from "./pebbles.ts";
import type { Session } from "./timer.ts";

// A finished session washes up once: its startedAt is its identity (it is also
// the React key), so finishing the same session twice is a no-op.
export function washUp(ledger: Ledger, session: Session): Ledger {
  if (ledger.pebbles.some((p) => p.startedAt === session.startedAt)) return ledger;
  const day = dayNumber(session.startedAt);
  const index = ledger.pebbles.filter((p) => dayNumber(p.startedAt) === day).length;
  return { ...ledger, pebbles: [...ledger.pebbles, mint(session.startedAt, session.minutes as Length, index)] };
}

export const withScene = (ledger: Ledger, scene: Scene): Ledger => ({ ...ledger, scene });

// Clear today drops only today's pieces; earlier days stay.
export const clearDay = (ledger: Ledger, now: number): Ledger => {
  const day = dayNumber(now);
  return { ...ledger, pebbles: ledger.pebbles.filter((p) => dayNumber(p.startedAt) !== day) };
};

export const sceneClass = (scene: Scene): string => (scene === "dark" ? "shore dark-scene" : "shore");
