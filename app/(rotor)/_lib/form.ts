// The lid's form, read back. With JavaScript off the browser submits it as a
// GET with r, ring and pos once per slot (r=I&r=II&r=III…) and the plugboard
// as typed. formQuery joins those into the one query parseSettings reads; it
// returns null for a query that is already in that shape.

type Query = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const joined = (v: string | string[] | undefined, by: string) => (Array.isArray(v) ? v.join(by) : v);

/** "ab cd, ef" → "AB-CD-EF": any run of non-letters separates pairs. */
export function plugText(v: string): string {
  return v.toUpperCase().split(/[^A-Z]+/).filter(Boolean).join("-");
}

export function formQuery(query: Query): Query | null {
  if (![query.r, query.ring, query.pos].some(Array.isArray)) return null;
  return {
    r: joined(query.r, "-"),
    ring: joined(query.ring, ""),
    pos: joined(query.pos, ""),
    ref: first(query.ref),
    plug: plugText(first(query.plug) ?? ""),
    m: first(query.m),
  };
}
