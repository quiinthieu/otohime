// The set hand, the dial's second brass hand: where the needle stood when the
// visitor pressed Set. This module takes and returns strings and never touches
// storage; the island owns the browser's storage.
import { findCity, type CitySlug } from "./cities.ts";
import { AT_FORMAT, type Reading } from "./reading.ts";

export const STORAGE_KEY = "barometer.hand";

export type Hand = { city: CitySlug; hpa: number; at: string };

const validHpa = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 800 && n <= 1200;

export function normalizeHand(raw: string | null): Hand | null {
  if (raw === null) return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
  const { city, hpa, at } = v as Record<string, unknown>;
  if (typeof city !== "string" || typeof at !== "string") return null;
  const known = findCity(city);
  if (!known || !validHpa(hpa) || !AT_FORMAT.test(at)) return null;
  return { city: known.slug, hpa, at };
}

export function serializeHand(h: Hand): string {
  return JSON.stringify({ city: h.city, hpa: h.hpa, at: h.at });
}

export type Action =
  | { type: "set"; city: CitySlug; reading: Reading }
  | { type: "recall"; raw: string | null }
  | { type: "clear" };

export function reducer(state: Hand | null, action: Action): Hand | null {
  switch (action.type) {
    case "set": {
      const next = normalizeHand(
        JSON.stringify({ city: action.city, hpa: action.reading.pressureHpa, at: action.reading.at }),
      );
      return next ?? state;
    }
    case "recall":
      return normalizeHand(action.raw);
    case "clear":
      return null;
  }
}
