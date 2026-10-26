// The commit a build serves. Callers pass the literal `process.env.BUILD_SHA`:
// next.config.ts inlines only that exact expression at build time, so reading
// process.env here would answer "dev" on Vercel, where it is no runtime variable.
export function buildSha(raw: string | undefined): string {
  return raw?.trim() || "dev";
}

export type Health = { ok: true; sha: string };

export function healthBody(raw: string | undefined): Health {
  return { ok: true, sha: buildSha(raw) };
}
