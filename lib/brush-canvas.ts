import { noise, type InkMark } from "./brush.ts";

export function paintMarks(ctx: CanvasRenderingContext2D, marks: InkMark[], colour = "#26241f") {
  ctx.save(); ctx.strokeStyle = colour; ctx.lineCap = "round";
  for (const m of marks) { ctx.globalAlpha = m.alpha; ctx.lineWidth = m.width; ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x2, m.y2); ctx.stroke(); }
  ctx.restore();
}
export function paintWashi(ctx: CanvasRenderingContext2D, size = 600) {
  ctx.save(); ctx.fillStyle = "#f6eed8"; ctx.fillRect(0, 0, size, size); ctx.strokeStyle = "#8d7755";
  for (let i = 0; i < 1800; i++) {
    ctx.globalAlpha = .035 + noise(i) * .055; ctx.lineWidth = .3;
    const x = noise(i + 401) * size, y = noise(i + 900) * size;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4 + noise(i + 100) * 15, y + (noise(i + 80) - .5) * 2); ctx.stroke();
  }
  ctx.restore();
}
export function paintSeal(ctx: CanvasRenderingContext2D, name: string, x = 505, y = 496) {
  const glyphs = Array.from(name.trim().normalize("NFC")).slice(0, 4);
  if (!glyphs.length) glyphs.push("印");
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.04); ctx.strokeStyle = "#ac352f"; ctx.fillStyle = "#ac352f"; ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 62, 62); ctx.lineWidth = .7; ctx.strokeRect(4, 4, 54, 54);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `${glyphs.length === 1 ? 38 : 23}px serif`;
  glyphs.forEach((c, i) => ctx.fillText(c, glyphs.length === 1 ? 31 : 17 + (i % 2) * 28, glyphs.length === 1 ? 33 : 19 + Math.floor(i / 2) * 27));
  ctx.restore();
}
