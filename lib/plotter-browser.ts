import { PLOT_LIMITS, splitSubpaths, type PlotStroke } from "./plotter.ts";

export function collectStrokes(root: ParentNode = document): { strokes: PlotStroke[]; limited: boolean } {
  const strokes: PlotStroke[] = [];
  let count = 0, limited = false;
  const shapes = root.querySelectorAll<SVGGeometryElement>("svg path, svg line, svg polyline, svg polygon, svg rect, svg circle, svg ellipse");
  for (const [i, shape] of [...shapes].entries()) {
    if (shape.closest("defs, clipPath, mask, [data-plotter-ui], [data-plotter-ignore], [hidden], [inert]")) continue;
    const style = getComputedStyle(shape);
    if (!shape.getClientRects().length || !shape.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || style.stroke === "none" || parseFloat(style.strokeWidth) === 0 || Number(style.strokeOpacity) === 0) continue;
    const rgb = style.stroke.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/);
    if (!rgb) continue;
    const colour = "#" + rgb.slice(1).map(n => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, "0")).join("");
    const matrix = shape.getScreenCTM();
    if (!matrix) continue;
    const pieces = shape.tagName.toLowerCase() === "path" ? splitSubpaths(shape.getAttribute("d") ?? "").map(d => {
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path"); path.setAttribute("d", d); return path;
    }) : [shape];
    for (const [j, piece] of pieces.entries()) {
      try {
        const length = piece.getTotalLength();
        if (!Number.isFinite(length) || length <= 0) continue;
        const zoom = Math.max(Math.hypot(matrix.a, matrix.b), Math.hypot(matrix.c, matrix.d));
        const samples = Math.min(PLOT_LIMITS.perShape - 1, Math.max(2, Math.ceil(length * zoom / 2)));
        if (strokes.length >= PLOT_LIMITS.strokes || count + samples + 1 > PLOT_LIMITS.points) { limited = true; break; }
        const points = Array.from({ length: samples + 1 }, (_, k): [number, number] => {
          const pt = piece.getPointAtLength(length * k / samples).matrixTransform(matrix);
          return [pt.x + window.scrollX, pt.y + window.scrollY];
        });
        if (points.every(p => p.every(Number.isFinite))) { strokes.push({ id: `${i}-${j}`, colour, points }); count += points.length; }
      } catch { /* A malformed third-party path is omitted; other art still plots. */ }
    }
    if (limited) break;
  }
  return { strokes, limited };
}
