import { parseInkEvents, type InkEvent } from "./seismograph.ts";

/** Only this public repository is requested. Tokens and raw API payloads never enter the archive. */
export async function githubInkEvents(token?: string): Promise<InkEvent[]> {
  const get = async (path: string) => {
    const r = await fetch(`https://api.github.com/repos/quiinthieu/otohime/${path}`, { headers: { accept:"application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, signal:AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`Public activity unavailable (${r.status})`);
    return r.json();
  };
  const [commits, pulls] = await Promise.all([get("commits?per_page=40"), get("pulls?state=all&per_page=20")]);
  if (!Array.isArray(commits) || !Array.isArray(pulls)) throw new Error("Invalid public activity");
  return parseInkEvents([
    ...commits.map(c => ({ id:`commit:${c.sha}`, at:c.commit?.committer?.date, kind:"commit", label:`Commit ${String(c.sha).slice(0,7)}`, url:c.html_url, failed:false, durationMs:0, rows:0 })),
    ...pulls.map(p => ({ id:`pr:${p.number}`, at:p.merged_at ?? p.created_at, kind:"pr", label:`PR #${p.number} · ${p.merged_at ? "merged" : "opened"}`, url:p.html_url, failed:false, durationMs:0, rows:0 })),
  ]);
}
