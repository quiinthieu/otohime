export type SealShape = "round" | "square";
export type SealChoice = { name: string; shape: SealShape };
export const SEAL_KEY = "otohime.hanko.v1";
export const SITE_SEAL: SealChoice = { name: "乙姫", shape: "square" };
export const SEAL_RED = "#b33228";
export const SEAL_FONT = '"Yu Mincho", "Hiragino Mincho ProN", "Noto Serif CJK JP", serif';

export function normalizeSealName(name: string): string {
  return Array.from(name.normalize("NFKC").replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, "").trim().replace(/\s+/gu, " ")).slice(0, 12).join("");
}
export function readSeal(value: string | null): SealChoice | null {
  try {
    const data = JSON.parse(value ?? "null");
    if (typeof data?.name !== "string" || !["round", "square"].includes(data.shape)) return null;
    const name = normalizeSealName(data.name);
    return name ? { name, shape: data.shape } : null;
  } catch { return null; }
}
const fixed = (n: number) => Number(n.toFixed(2));
export function sealModel(choice: SealChoice) {
  const name = normalizeSealName(choice.name) || SITE_SEAL.name;
  let seed = 2166136261;
  for (const letter of name.toLocaleLowerCase("en-US")) { seed ^= letter.codePointAt(0)!; seed = Math.imul(seed, 16777619) >>> 0; }
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const points = Array.from({ length: 96 }, (_, i) => {
    const angle = i / 96 * Math.PI * 2, radius = 87 - random() * 2;
    const scale = choice.shape === "square" ? 1 / Math.max(Math.abs(Math.cos(angle)), Math.abs(Math.sin(angle))) : 1;
    return [fixed(100 + Math.cos(angle) * radius * scale), fixed(100 + Math.sin(angle) * radius * scale)];
  });
  const edge = points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("") + "Z";
  const chips = Array.from({ length: 48 }, () => {
    const [x, y] = points[Math.floor(random() * points.length)];
    return { x, y, r: fixed(.6 + random() * 2.4) };
  });
  const letters = Array.from(name), columns = letters.length <= 4 ? Math.min(2, letters.length) : letters.length <= 9 ? 3 : 4;
  const rows = Math.ceil(letters.length / columns), size = Math.min(58, 118 / Math.max(columns, rows));
  const glyphs = letters.map((text, i) => ({ text,
    x: fixed(100 + (i % columns - (Math.min(columns, letters.length - Math.floor(i / columns) * columns) - 1) / 2) * size * 1.05),
    y: fixed(100 + (Math.floor(i / columns) - (rows - 1) / 2) * size * 1.1 + size * .34), size: fixed(size),
  }));
  return { name, shape: choice.shape, edge, chips, glyphs };
}
export type SealModel = ReturnType<typeof sealModel>;
const xml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
/** A self-contained transparent SVG; names are text, never markup or a resource URL. */
export function sealSvg(choice: SealChoice): string {
  const m = sealModel(choice);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 200 200" role="img" aria-label="${xml(m.name)} seal"><title>${xml(m.name)} · Hanko Press</title><defs><mask id="carving"><rect width="200" height="200" fill="white"/><g fill="black">${m.chips.map(c => `<circle cx="${c.x}" cy="${c.y}" r="${c.r}"/>`).join("")}${m.glyphs.map(g => `<text x="${g.x}" y="${g.y}" font-family="${xml(SEAL_FONT)}" font-weight="700" font-size="${g.size}" text-anchor="middle">${xml(g.text)}</text>`).join("")}</g></mask></defs><path d="${m.edge}" fill="${SEAL_RED}" mask="url(#carving)"/></svg>`;
}
/** Draw glyphs directly; SVG-as-image font restrictions cannot blank the PNG. */
export function drawSeal(ctx: CanvasRenderingContext2D, choice: SealChoice, size = 1200) {
  const m = sealModel(choice);
  ctx.save(); ctx.scale(size / 200, size / 200);
  ctx.fillStyle = SEAL_RED; ctx.fill(new Path2D(m.edge));
  ctx.globalCompositeOperation = "destination-out";
  for (const c of m.chips) { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill(); }
  ctx.textAlign = "center";
  for (const g of m.glyphs) { ctx.font = `700 ${g.size}px ${SEAL_FONT}`; ctx.fillText(g.text, g.x, g.y); }
  ctx.restore();
}
