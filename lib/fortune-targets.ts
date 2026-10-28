/** Serializable content ports. The caller supplies current site, Gazette and owner song data. */
export type FortuneKind = "project" | "note" | "sketch" | "song" | "article";
export type FortuneTarget = { id: string; label: string; href: string; kind: FortuneKind };
export type FortuneInputs = {
  projects?: readonly { title: string; href?: string }[];
  notes?: readonly { date: string; title: string }[];
  sketches?: readonly { src: string; title: string }[];
  songs?: readonly { video: string; title: string }[];
  ownerSongs?: readonly { video: string; title: string }[];
  articles?: readonly { slug: string; headline: string }[];
};

// Hex encoding is injective for Unicode source identities. Slugifying titles would collide.
function identity(value: string): string {
  return Array.from(new TextEncoder().encode(value), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const noteTargetId = (date: string): string => `fortune-note-${identity(date)}`;
export const sketchTargetId = (src: string): string => `fortune-sketch-${identity(src)}`;
export const songTargetId = (video: string): string => `fortune-song-${identity(video)}`;
export const projectTargetId = (title: string): string => `fortune-project-${identity(title)}`;

// A plain local path only. Reject encoded separators and navigation, URLs, hashes and queries.
export function safeInternalPath(href: string): boolean {
  return /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(href) && !href.split("/").includes("..") && !href.includes("\\");
}

function label(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function buildFortuneTargets(input: FortuneInputs): FortuneTarget[] {
  const result: FortuneTarget[] = [];
  const ids = new Set<string>();
  const hrefs = new Set<string>();
  const add = (target: FortuneTarget) => {
    if (ids.has(target.id) || hrefs.has(target.href)) return;
    ids.add(target.id);
    hrefs.add(target.href);
    result.push(target);
  };
  for (const item of input.projects ?? []) {
    if (!label(item.title)) continue;
    if (item.href !== undefined && !safeInternalPath(item.href)) continue;
    const id = projectTargetId(item.title);
    add({ id, label: item.title, href: item.href ?? `/projects#${id}`, kind: "project" });
  }
  for (const item of input.notes ?? []) {
    if (!label(item.title) || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) continue;
    const id = noteTargetId(item.date);
    add({ id, label: item.title, href: `/notes#${id}`, kind: "note" });
  }
  for (const item of input.sketches ?? []) {
    if (!label(item.title) || !label(item.src)) continue;
    const id = sketchTargetId(item.src);
    add({ id, label: item.title, href: `/sketches#${id}`, kind: "sketch" });
  }
  for (const item of [...(input.songs ?? []), ...(input.ownerSongs ?? [])]) {
    if (!label(item.title) || !/^[A-Za-z0-9_-]{11}$/.test(item.video)) continue;
    const id = songTargetId(item.video);
    add({ id, label: item.title, href: `/music#${id}`, kind: "song" });
  }
  for (const item of input.articles ?? []) {
    if (!label(item.headline) || !/^[a-z]+(?:-[a-z]+)*$/.test(item.slug)) continue;
    add({ id: `fortune-article-${item.slug}`, label: item.headline, href: `/articles/${item.slug}`, kind: "article" });
  }
  return result;
}
