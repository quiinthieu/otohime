// What YouTube's oEmbed endpoint says about a video id, for scripts/vinyl-check.ts.
// The site itself never calls it.
//   200 embeddable · 400 malformed id · 401/403 embedding disabled · 404 gone or private
// YouTube also answers 400 for a well-formed id that no video has (checked
// 2026-10-19), so for an id that passes validateRecords, "malformed" means "no such video".

export type Verdict = "embeddable" | "malformed" | "embedding-disabled" | "not-found" | "network";

export function oembedUrl(videoId: string): string {
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`;
}

// null is a request that never got an answer (offline, DNS, timeout).
export function classify(status: number | null): Verdict {
  switch (status) {
    case 200:
      return "embeddable";
    case 400:
      return "malformed";
    case 401:
    case 403:
      return "embedding-disabled";
    case 404:
      return "not-found";
    default:
      return "network";
  }
}

// The checker's exit code: 1 when a record is invalid or a video is dead,
// 2 when the only trouble is the network, else 0.
export function exitCode(validationErrors: number, verdicts: readonly Verdict[]): 0 | 1 | 2 {
  if (validationErrors > 0 || verdicts.some((v) => v !== "embeddable" && v !== "network")) return 1;
  return verdicts.includes("network") ? 2 : 0;
}
