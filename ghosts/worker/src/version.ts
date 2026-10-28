// GET /version: the public build fingerprint and nothing else (no connection,
// visitor or environment data). Kept out of src/index.ts because workerd treats
// every export of the entry module as an entrypoint.

export const SERVICE = "otohime-ghosts";

/** sha256 over the Worker code, lock and configuration, injected at bundle time by scripts/fingerprint.mjs. */
declare const __GHOSTS_FINGERPRINT__: string | undefined;

export function buildFingerprint(): string {
  return typeof __GHOSTS_FINGERPRINT__ === "string" ? __GHOSTS_FINGERPRINT__ : "unbuilt";
}

export function versionResponse(workerVersionId: string | null = null): Response {
  return Response.json(
    { service: SERVICE, fingerprint: buildFingerprint(), workerVersionId },
    { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
  );
}
