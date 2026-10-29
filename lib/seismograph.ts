export type InkEvent = { id: string; at: string; kind: "commit" | "pr" | "pipeline"; label: string; url: string; failed: boolean; durationMs: number; rows: number };
export type InkArchive = { generated: string; events: InkEvent[] };
export const TRACE_WIDTH = 900, TRACE_HEIGHT = 220, WINDOW_MS = 6 * 3600_000;

export function parseInkEvents(value: unknown): InkEvent[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 1000).flatMap(raw => {
    if (!raw || typeof raw !== "object") return [];
    const e = raw as InkEvent;
    if (typeof e.id !== "string" || e.id.length > 160 || seen.has(e.id) || !["commit", "pr", "pipeline"].includes(e.kind) || typeof e.at !== "string" || !Number.isFinite(Date.parse(e.at)) || typeof e.label !== "string") return [];
    if (typeof e.url !== "string" || !/^https:\/\/github\.com\/quiinthieu\/otohime\/(commit\/|pull\/|actions\/runs\/)/.test(e.url)) return [];
    if (![e.durationMs, e.rows].every(n => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1e12)) return [];
    seen.add(e.id);
    return [{ id: e.id, at: new Date(e.at).toISOString(), kind: e.kind, label: e.label.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 100), url: e.url, failed: e.failed === true, durationMs: e.durationMs, rows: e.rows }];
  }).sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || a.id.localeCompare(b.id)).slice(-240);
}
export function magnitude(e: InkEvent) {
  return Math.min(76, (e.kind === "commit" ? 10 : e.kind === "pr" ? 22 : 16) + Math.log10(1 + e.durationMs / 1000) * 11 + Math.log10(1 + e.rows) * 5);
}
export const eventX = (e: InkEvent, end: number, span = WINDOW_MS) => (Date.parse(e.at) - end + span) / span * TRACE_WIDTH;
export function tracePath(events: InkEvent[], end: number, span = WINDOW_MS) {
  const visible = events.filter(e => { const x = eventX(e, end, span); return x > -40 && x < TRACE_WIDTH + 40; });
  return Array.from({ length: 451 }, (_, i) => {
    const x = i * 2;
    let y = 110 + Math.sin((end - span + x / TRACE_WIDTH * span) / 370000) * .7 + Math.sin(x * .73) * .6;
    for (const e of visible) { const delta = x - eventX(e, end, span); y += Math.sin(delta * .85) * Math.exp(-Math.abs(delta) / 10) * magnitude(e); }
    return `${i ? "L" : "M"}${x},${Math.max(15, Math.min(205, y)).toFixed(2)}`;
  }).join(" ");
}
export function visibleEvents(events: InkEvent[], end: number, span = WINDOW_MS) { return events.filter(e => eventX(e, end, span) >= 0 && eventX(e, end, span) <= TRACE_WIDTH); }
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&apos;" }[c]!));
export function stripSvg(events: InkEvent[], end: number, span = WINDOW_MS) {
  const selected = visibleEvents(events, end, span);
  const date = new Date(end).toISOString();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 ${310 + selected.length * 20}" role="img" aria-labelledby="title"><title id="title">Otohime · Ink Seismograph · ${date}</title><rect width="100%" height="100%" fill="#f2efe7"/><g stroke="#d6ccba" stroke-width=".6">${[30, 70, 110, 150, 190].map(y => `<path d="M0 ${y}H900"/>`).join("")}</g><path d="${tracePath(events,end,span)}" fill="none" stroke="#29251f" stroke-width="1.5"/>${selected.filter(e => e.failed).map(e => `<circle cx="${eventX(e,end,span).toFixed(2)}" cy="110" r="6" fill="#a33e32" opacity=".75"/>`).join("")}<g fill="#29251f" font-family="monospace" font-size="12"><text x="20" y="250">OTOHIME / INK SEISMOGRAPH — ${escape(date)}</text><text x="20" y="272">Public GitHub activity + CI job runtimes · 6 hour strip · UTC</text>${selected.map((e,i) => `<text x="20" y="${300+i*20}">${escape(`${e.at.slice(0,16)} ${e.failed ? "FAILED " : ""}${e.label}`)}</text>`).join("")}</g></svg>`;
}
