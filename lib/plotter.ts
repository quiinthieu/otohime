export type PlotPoint = [number, number];
export type PlotStroke = { id: string; colour: string; points: PlotPoint[] };
export const PLOT_LIMITS = { strokes: 1200, points: 48000, perShape: 1200 };
export const distance = (a: PlotPoint, b: PlotPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Ramer–Douglas–Peucker, iterative so a long outline cannot exhaust the stack. */
export function simplify(points: PlotPoint[], tolerance = 0.35): PlotPoint[] {
  if (points.length < 3) return points;
  const keep = new Set([0, points.length - 1]);
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [x, y] = points[a], dx = points[b][0] - x, dy = points[b][1] - y;
    let far = tolerance, at = -1;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((points[i][0] - x) * dx + (points[i][1] - y) * dy) / (dx * dx + dy * dy || 1)));
      const d = distance(points[i], [x + t * dx, y + t * dy]);
      if (d > far) { far = d; at = i; }
    }
    if (at !== -1) { keep.add(at); stack.push([a, at], [at, b]); }
  }
  return [...keep].sort((a, b) => a - b).map(i => points[i]);
}

export function penTravel(strokes: PlotStroke[]): number {
  return strokes.reduce((n, s, i) => n + (i ? distance(strokes[i - 1].points.at(-1)!, s.points[0]) : 0), 0);
}

export function optimiseStrokes(input: PlotStroke[]) {
  const layers = new Map<string, PlotStroke[]>();
  const seen = new Set<string>();
  let points = 0;
  for (const s of input.slice(0, PLOT_LIMITS.strokes)) {
    if (!/^#[0-9a-f]{6}$/i.test(s.colour) || s.points.length < 2 || s.points.some(p => !p.every(Number.isFinite))) continue;
    const line = simplify(s.points.slice(0, PLOT_LIMITS.perShape));
    if (points + line.length > PLOT_LIMITS.points) break;
    const f = JSON.stringify(line), r = JSON.stringify([...line].reverse());
    const key = s.colour + (f < r ? f : r);
    if (seen.has(key)) continue;
    seen.add(key); points += line.length;
    if (!layers.has(s.colour)) layers.set(s.colour, []);
    layers.get(s.colour)!.push({ ...s, points: line });
  }
  let before = 0, after = 0;
  const strokes: PlotStroke[] = [];
  for (const layer of layers.values()) {
    before += penTravel(layer);
    const remaining = layer.slice(1), sorted = [layer[0]];
    while (remaining.length) {
      const from = sorted.at(-1)!.points.at(-1)!;
      let best = 0, flip = false, min = Infinity;
      remaining.forEach((s, i) => {
        for (const reversed of [false, true]) {
          const d = distance(from, reversed ? s.points.at(-1)! : s.points[0]);
          if (d < min) { min = d; best = i; flip = reversed; }
        }
      });
      const next = remaining.splice(best, 1)[0];
      sorted.push(flip ? { ...next, points: [...next.points].reverse() } : next);
    }
    // Greedy nearest-neighbour can lose on some drawings. Keep the shorter route.
    const order = penTravel(sorted) <= penTravel(layer) ? sorted : layer;
    const merged: PlotStroke[] = [];
    for (const s of order) {
      const last = merged.at(-1);
      if (last && distance(last.points.at(-1)!, s.points[0]) < 0.5 && last.points.length + s.points.length <= PLOT_LIMITS.perShape) {
        last.points = [...last.points, ...s.points.slice(distance(last.points.at(-1)!, s.points[0]) < 0.001 ? 1 : 0)];
      } else merged.push({ ...s, points: [...s.points] });
    }
    after += penTravel(merged);
    strokes.push(...merged);
  }
  return { strokes, before, after };
}

/** Preserve moveto discontinuities: a pen must lift between SVG subpaths. */
export function splitSubpaths(d: string): string[] {
  const commands = d.match(/[a-df-z][^a-df-z]*/gi) ?? [];
  const sizes: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7 };
  const paths: string[] = [];
  let current = "", x = 0, y = 0, sx = 0, sy = 0;
  for (const command of commands) {
    const c = command[0], low = c.toLowerCase(), rel = c === low;
    if (low === "z") { current += " Z"; x = sx; y = sy; continue; }
    const ns = (command.slice(1).match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    const size = sizes[low];
    if (!size || ns.length % size || ns.some(n => !Number.isFinite(n))) return [];
    for (let i = 0; i < ns.length; i += size) {
      const v = ns.slice(i, i + size), move = low === "m" && i === 0;
      if (low === "h") x = v[0] + (rel ? x : 0);
      else if (low === "v") y = v[0] + (rel ? y : 0);
      else { x = v.at(-2)! + (rel ? x : 0); y = v.at(-1)! + (rel ? y : 0); }
      if (move) {
        if (current) paths.push(current);
        current = `M ${x} ${y}`; sx = x; sy = y;
      } else current += ` ${low === "m" ? (rel ? "l" : "L") : c} ${v.join(" ")}`;
    }
  }
  if (current) paths.push(current);
  return paths;
}

export function plotterSvg(input: PlotStroke[], size: "A4" | "A5" = "A4"): string {
  const { strokes } = optimiseStrokes(input);
  if (!strokes.length) throw new Error("No inline vector strokes to export.");
  const all = strokes.flatMap(s => s.points);
  const minX = Math.min(...all.map(p => p[0])), minY = Math.min(...all.map(p => p[1]));
  const w = Math.max(...all.map(p => p[0])) - minX || 1, h = Math.max(...all.map(p => p[1])) - minY || 1;
  const [width, height] = size === "A5" ? [148, 210] : [210, 297];
  const scale = Math.min((width - 20) / w, (height - 20) / h);
  const ox = (width - w * scale) / 2, oy = (height - h * scale) / 2;
  const colours = [...new Set(strokes.map(s => s.colour))];
  const layers = colours.map((colour, i) => `<g inkscape:groupmode="layer" inkscape:label="${i + 1} ${colour}" id="ink-${i + 1}" fill="none" stroke="${colour}" stroke-width="0.3" stroke-linecap="round" stroke-linejoin="round">${strokes.filter(s => s.colour === colour).map(s => `<polyline points="${s.points.map(([x, y]) => `${((x - minX) * scale + ox).toFixed(3)},${((y - minY) * scale + oy).toFixed(3)}`).join(" ")}"/>`).join("")}</g>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}"><title>Otohime inline ink drawing</title>${layers}</svg>`;
}
