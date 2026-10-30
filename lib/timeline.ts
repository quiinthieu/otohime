import { draftCareer } from "../content/career.ts";

export type TimelinePiece = { kind: "work" | "project" | "place" | "tool"; title: string; detail: string; href?: string };
export type TimelineYear = { year: number; title: string; note: string; pieces: TimelinePiece[] };
export const TIMELINE_YEARS = Array.from({ length: 9 }, (_, i) => 2018 + i);
export function turnYear(index: number, key: string): number {
  if (key === "Home") return 0;
  if (key === "End") return TIMELINE_YEARS.length - 1;
  return Math.max(0, Math.min(TIMELINE_YEARS.length - 1, index + (["ArrowRight", "PageDown"].includes(key) ? 1 : ["ArrowLeft", "PageUp"].includes(key) ? -1 : 0)));
}
export function careerArchive(projects: { title: string; note: string; started?: string; href?: string }[], stack: { what: string; tools: string; note: string }[]): TimelineYear[] {
  return TIMELINE_YEARS.map(year => {
    const draft = draftCareer.find(entry => entry.year === year)!;
    const pieces: TimelinePiece[] = projects.filter(p => p.started?.startsWith(String(year))).map(p => ({ kind: "project", title: p.title, detail: p.note, href: p.href }));
    const placeholder = "Draft placeholder — invented for this book; the owner will replace it.";
    pieces.push(
      { kind: "work", title: `${draft.role} · ${draft.team}`, detail: `${placeholder} ${draft.story}` },
      { kind: "place", title: draft.place, detail: `${placeholder} A little pin on the ${year} map.` },
      { kind: "project", title: draft.project, detail: `${placeholder} ${draft.story}` },
      { kind: "tool", title: draft.tools, detail: `${placeholder} A proposed toolbox for this chapter.` },
    );
    if (year === 2026) pieces.push(...stack.map(s => ({ kind: "tool" as const, title: s.tools, detail: `${s.what}: ${s.note}. Listed on the current Work page; adoption year is unrecorded.` })));
    return { year, title: draft.title, note: `Draft career story — ${draft.story} Roles, employers, places and the draft project are fictional placeholders. Linked public projects are real.`, pieces };
  });
}
