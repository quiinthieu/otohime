import { site } from "../content/site.ts";
import history from "../content/history.json" with { type: "json" };
import type { SqlDataset } from "./sql-desk.ts";

/** Explicit public fields only. No DB client, user records, play events, authors or credentials. */
export function publicSqlData(): SqlDataset {
  return { revision: history.head, tables: {
    notes: site.notes.map(n => ({ slug: n.slug, title: n.title, date: n.date, tags: n.tags.join(", ") })),
    projects: site.projectList.filter(p => !p.demoFixture).map(p => ({ title: p.title, note: p.note, status: p.status, href: p.href ?? null, started: p.started ?? null, shipped: p.shipped ?? null })),
    sketches: site.sketches.map(s => ({ title: s.title, kind: s.kind, note: s.note, image: s.src })),
    commits: history.entries.map(c => ({ sha: c.sha, date: c.date, subject: c.subject, files: c.files, added: c.added, removed: c.removed })),
    songs: site.songs.map(s => ({ title: s.title, artist: s.artist, note: s.note, video: s.video })),
    music_plays: [],
  } };
}
