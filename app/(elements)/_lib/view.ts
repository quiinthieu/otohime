// The detail dialog's state: which element is open, if any. A pure reducer, so
// the click path can be played without a browser and nothing differs between
// server and client (it starts closed and has no clock).

export const FIRST = 1;
export const LAST = 118;

export type View = { open: number | null };
export type ViewAction = { type: "open"; n: number } | { type: "close" } | { type: "next" } | { type: "prev" };

export const closed: View = { open: null };

const clamp = (n: number) => Math.min(LAST, Math.max(FIRST, Math.round(n)));

export function view(state: View, action: ViewAction): View {
  switch (action.type) {
    case "open":
      return { open: clamp(action.n) };
    case "close":
      return state.open === null ? state : closed;
    case "next":
    case "prev": {
      if (state.open === null) return state;
      const n = clamp(state.open + (action.type === "next" ? 1 : -1));
      return n === state.open ? state : { open: n };
    }
  }
}
