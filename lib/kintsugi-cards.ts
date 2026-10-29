import { site } from "../content/site.ts";

export const KINTSUGI_CARDS = [
  { id: "work:pipeline", label: "The pipeline", href: "/work" },
  { id: "work:seismograph", label: "Ink Seismograph", href: "/work" },
  { id: "demo:golden-paper", label: "A little golden paper", href: "/kintsugi" },
  ...site.projectList.map(p => ({ id: `project:${encodeURIComponent((p.href || p.title).trim())}`, label: p.title, href: "/projects" })),
  ...site.notes.map(n => ({ id: `note:${encodeURIComponent(n.date.trim())}`, label: n.title, href: "/notes" })),
].slice(0, 128);

export const knownCard = (id: unknown): id is string => typeof id === "string" && KINTSUGI_CARDS.some(c => c.id === id);
