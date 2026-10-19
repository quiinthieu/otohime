// The card set is data: swapping a character is an edit here (and its drawing
// in art/), with the machine untouched. The page prints RATES and PITY as they
// are, so the published odds are the odds.

export const TIERS = ["common", "rare", "legend"] as const;
export type Tier = (typeof TIERS)[number];

export type CardId =
  | "soot-sprite"
  | "jiji"
  | "kodama"
  | "heen"
  | "teto"
  | "ponyo"
  | "totoro"
  | "catbus"
  | "calcifer"
  | "kiki"
  | "no-face"
  | "robot-soldier";

export type Card = {
  id: CardId;
  name: string;
  film: string;
  year: number;
  tier: Tier;
  colour: string;
  shade: string;
  note: string;
};

export const RATES: Record<Tier, number> = { common: 0.7, rare: 0.25, legend: 0.05 };
export const PITY = 20; // a legend at least every PITY draws

// In album order.
export const CARDS: readonly Card[] = [
  {
    id: "soot-sprite",
    name: "Soot sprite",
    film: "My Neighbor Totoro",
    year: 1988,
    tier: "common",
    colour: "#2e2a2b",
    shade: "#1b1819",
    note: "Scatters at a loud hello and comes back for a sugar star.",
  },
  {
    id: "jiji",
    name: "Jiji",
    film: "Kiki's Delivery Service",
    year: 1989,
    tier: "common",
    colour: "#2b2730",
    shade: "#1a1720",
    note: "A black cat with an opinion on every delivery.",
  },
  {
    id: "kodama",
    name: "Kodama",
    film: "Princess Mononoke",
    year: 1997,
    tier: "common",
    colour: "#f4f1e6",
    shade: "#d9d4c3",
    note: "Rattles its head to say the forest is still listening.",
  },
  {
    id: "heen",
    name: "Heen",
    film: "Howl's Moving Castle",
    year: 2004,
    tier: "common",
    colour: "#d8c7a8",
    shade: "#b8a283",
    note: "An old dog who wheezes up every staircase anyway.",
  },
  {
    id: "teto",
    name: "Teto",
    film: "Nausicaä of the Valley of the Wind",
    year: 1984,
    tier: "common",
    colour: "#e8b46a",
    shade: "#c98f45",
    note: "Bites first, then rides on your shoulder for good.",
  },
  {
    id: "ponyo",
    name: "Ponyo",
    film: "Ponyo",
    year: 2008,
    tier: "common",
    colour: "#ef6f5e",
    shade: "#c9503f",
    note: "Wants ham, wants legs, wants it all right now.",
  },
  {
    id: "totoro",
    name: "Totoro",
    film: "My Neighbor Totoro",
    year: 1988,
    tier: "rare",
    colour: "#8a8f96",
    shade: "#6b7078",
    note: "Waits at the bus stop in the rain with a leaf for a hat.",
  },
  {
    id: "catbus",
    name: "Catbus",
    film: "My Neighbor Totoro",
    year: 1988,
    tier: "rare",
    colour: "#e8a33c",
    shade: "#c47f22",
    note: "Twelve legs, one grin, and it never misses a stop.",
  },
  {
    id: "calcifer",
    name: "Calcifer",
    film: "Howl's Moving Castle",
    year: 2004,
    tier: "rare",
    colour: "#f28a2e",
    shade: "#d8601a",
    note: "Grumbles about the eggshells and keeps the castle walking.",
  },
  {
    id: "kiki",
    name: "Kiki",
    film: "Kiki's Delivery Service",
    year: 1989,
    tier: "rare",
    colour: "#3b3350",
    shade: "#262036",
    note: "Thirteen, a red bow, a borrowed broom and a bakery to fly for.",
  },
  {
    id: "no-face",
    name: "No-Face",
    film: "Spirited Away",
    year: 2001,
    tier: "legend",
    colour: "#2a2627",
    shade: "#151213",
    note: "Offers gold to everyone and only wants someone to sit with.",
  },
  {
    id: "robot-soldier",
    name: "Robot soldier",
    film: "Castle in the Sky",
    year: 1986,
    tier: "legend",
    colour: "#8d7a5b",
    shade: "#6d5c41",
    note: "Tends the garden on the floating island, gentle with the birds.",
  },
];
