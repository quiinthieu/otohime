// Number words for Sun, so the page and the tests say "15.7 million K" the same
// way. Grouping goes through Intl.NumberFormat("en-US") so server and client agree.

const GROUPED = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ONE_DECIMAL = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const MILLION = 1_000_000;

// 15_700_000 -> "15.7 million K (15.7 million °C)"; 5772 -> "5,772 K (5,499 °C)"
export function kelvin(k: number): string {
  if (k >= MILLION) {
    const m = `${ONE_DECIMAL.format(k / MILLION)} million`;
    return `${m} K (${m} °C)`;
  }
  return `${GROUPED.format(k)} K (${GROUPED.format(Math.round(k - 273.15))} °C)`;
}

export function km(n: number): string {
  return `${GROUPED.format(n)} km`;
}

export function years(n: number): string {
  return `${GROUPED.format(n)} ${n === 1 ? "year" : "years"}`;
}

// 499 -> "8 min 19 s"
export function lightTime(s: number): string {
  const whole = Math.round(s);
  const min = Math.floor(whole / 60);
  const sec = whole % 60;
  if (min === 0) return `${sec} s`;
  return sec === 0 ? `${min} min` : `${min} min ${sec} s`;
}
