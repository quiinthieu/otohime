export const CRATE_LIMIT = 24;

/** A local paper toy: Unicode characters, deterministic sorting, no network. */
export function processCrate(input: string) {
  const raw = Array.from(input.normalize("NFKC")).slice(0, CRATE_LIMIT).join("");
  const clean = (raw.match(/[\p{L}\p{N}]/gu) ?? []).join("").toUpperCase();
  const chopped = Array.from(clean);
  const sorted = [...chopped].sort();
  const packed = sorted.length ? `[ ${sorted.join(" · ")} ]` : "[ empty ]";
  return { raw, clean, chopped, sorted, packed, count: sorted.length,
    stages: [raw || "[ empty ]", clean || "[ empty ]", chopped.join(" / ") || "[ empty ]", sorted.join(" · ") || "[ empty ]", packed] };
}

/** Interpolate between station centers; scrolling backwards reverses the line. */
export function assemblyProgress(centers: readonly number[], focus: number): number {
  if (centers.length < 2 || focus <= centers[0]) return 0;
  for (let index = 1; index < centers.length; index++) {
    if (focus <= centers[index]) {
      const distance = centers[index] - centers[index - 1];
      return index - 1 + (distance > 0 ? (focus - centers[index - 1]) / distance : 0);
    }
  }
  return centers.length - 1;
}
