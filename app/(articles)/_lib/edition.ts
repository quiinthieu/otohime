// The edition's date and dateline. The date is the newest article's
// `published`, written out from two tables and Date.UTC's day of the week: no
// Intl, no locale, no clock, so every build prints the same bytes.

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// The first edition. A second edition bumps the number, not the volume.
const VOLUME = "I";
const NUMBER = 1;

// "2026-10-21" → [2026, 10, 21], or null for anything that is not a real day.
export function parseDate(iso: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return [y, mo, d];
}

export function editionDate(articles: readonly { published: string }[]): string {
  if (articles.length === 0) throw new Error("an edition needs an article");
  return articles.map((a) => a.published).reduce((a, b) => (b > a ? b : a));
}

export function longDate(iso: string): string {
  const parsed = parseDate(iso);
  if (!parsed) throw new Error(`not a date: ${iso}`);
  const [y, mo, d] = parsed;
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${weekday}, ${d} ${MONTHS[mo - 1]} ${y}`;
}

export function dateline(articles: readonly { published: string }[]): string {
  return `Vol. ${VOLUME} · No. ${NUMBER} · ${longDate(editionDate(articles))} · otohime.dev · Free`;
}
