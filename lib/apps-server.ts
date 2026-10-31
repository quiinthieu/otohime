import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AppManifestValidationError,
  sortApps,
  validateAppManifest,
  type AppManifest,
} from "./apps.ts";

export const DEFAULT_APPS_DIR = join(process.cwd(), "content", "apps");

const SAFE_SLUG_LOOKUP_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function loadApps(dir: string = DEFAULT_APPS_DIR): AppManifest[] {
  const entries = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !entry.name.startsWith("_"))
    .sort((a, b) => a.name.localeCompare(b.name, "en-US"));

  const rawEntries: Array<{ fileName: string; expectedSlug: string; parsed: unknown }> = [];
  const seenSlugs = new Map<string, string>();

  for (const entry of entries) {
    const filePath = join(dir, entry.name);
    const expectedSlug = entry.name.slice(0, -".json".length);
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(filePath, "utf8"));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new AppManifestValidationError(`Failed to parse ${entry.name}: ${reason}`, {
        slug: expectedSlug,
      });
    }

    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed) &&
      typeof (parsed as { slug?: unknown }).slug === "string"
    ) {
      const candidateSlug = (parsed as { slug: string }).slug.trim();
      const firstFile = seenSlugs.get(candidateSlug);
      if (firstFile) {
        throw new AppManifestValidationError(
          `Duplicate app slug "${candidateSlug}" in ${entry.name} (already defined in ${firstFile})`,
          { slug: candidateSlug, field: "slug" },
        );
      }
      if (candidateSlug.length > 0) {
        seenSlugs.set(candidateSlug, entry.name);
      }
    }

    rawEntries.push({ fileName: entry.name, expectedSlug, parsed });
  }

  const manifests = rawEntries.map(({ expectedSlug, parsed }) =>
    validateAppManifest(parsed, expectedSlug),
  );

  return sortApps(manifests);
}

export function appBySlug(slug: string, dir: string = DEFAULT_APPS_DIR): AppManifest | null {
  if (!SAFE_SLUG_LOOKUP_RE.test(slug)) return null;
  const apps = loadApps(dir);
  return apps.find((app) => app.slug === slug) ?? null;
}
