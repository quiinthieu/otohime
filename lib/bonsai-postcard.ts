import { growBonsai, type ActivityWeek, type Branch, type Season } from "./bonsai.ts";
export const LEAF_COLOURS: Record<Season, string> = { spring: "#c76b86", summer: "#55734b", autumn: "#ad4538", winter: "#faf6ea" };
export function branchPath(b: Branch): string {
  return `M${b.x.toFixed(2)} ${b.y.toFixed(2)} Q${((b.x + b.x2) / 2 + 1.5).toFixed(2)} ${((b.y + b.y2) / 2).toFixed(2)} ${b.x2.toFixed(2)} ${b.y2.toFixed(2)}`;
}
/** Self-contained SVG for both server PNG and local download; no external fonts/assets. */
export function postcardSvg(weeks: readonly ActivityWeek[], week: string, season: Season, through: string, branches = growBonsai(weeks, week)): string {
  const count = weeks.find(w => w.week === week)?.count ?? 0;
  const lines = branches.map(b => `<path d="${branchPath(b)}" stroke-width="${b.width}"/>`).join("");
  const leaves = branches.filter(b => b.leaf).map(b => season === "winter" ? `<path d="M${b.x2 - 4} ${b.y2 - 2}h8" stroke="#faf6ea" stroke-width="3"/>` : `<ellipse cx="${b.x2}" cy="${b.y2}" rx="${season === "spring" ? 3.5 : 5}" ry="3" fill="${LEAF_COLOURS[season]}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#f4eddb"/><g transform="translate(35 -12) scale(1.2)" stroke="#302d29" stroke-linecap="round" fill="none">${lines}<path d="M250 440h135l-15 30H265z" stroke-width="3" fill="#bc6954"/>${leaves}</g><g font-family="serif" fill="#302d29"><text x="805" y="200" font-size="42">Ink Bonsai</text><text x="805" y="246" font-size="24">${week} · ${season}</text><text x="805" y="292" font-size="20">${count} public contributions</text><text x="805" y="390" font-size="18">Grown from quiinthieu’s activity</text><text x="805" y="425" font-size="18">Snapshot through ${through}</text><text x="805" y="500" font-size="22">otohime.dev/play/bonsai</text></g></svg>`;
}
