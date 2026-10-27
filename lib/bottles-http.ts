import { isIP } from "node:net";
import type { Bottle, BottleStatus } from "./bottles.ts";
import type { Actor, BottleService } from "./bottles-service.ts";
import { validBottleCursor } from "./bottles-service.ts";
import { can } from "./permissions.ts";
export type BottleEnv = {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  VERCEL?: string;
  VERCEL_ENV?: string;
  VERCEL_URL?: string;
};
export type BottleHttpDeps = {
  service: BottleService;
  seeds: readonly Bottle[];
  env: BottleEnv;
  actor: () => Promise<Actor | null>;
};
const json = (
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "no-store", ...extra },
  });
const messages: Record<string, string> = {
  shape: "Please check the suggestion fields.",
  honeypot: "Please use the suggestion form directly.",
  url: "Use a public HTTPS URL without fragments or tracking parameters.",
  text: "Use 1–80 plain-text characters for the title and note.",
  kind: "Choose site, toy or art.",
  json: "Send valid JSON.",
  unsupported_content: "Send application/json.",
  oversized: "Keep the request within 8 KiB.",
  origin: "Submit from this site.",
  duplicate: "This URL has already been suggested or curated.",
  rate_limited: "Try again next UTC hour.",
  unavailable: "Bottle suggestions are temporarily unavailable.",
  unauthenticated: "Sign in to review suggestions.",
  forbidden: "Owner or admin permission is required.",
  status: "Choose a supported review status.",
  cursor: "This page cursor is invalid.",
  not_found: "This suggestion was not found.",
  invalid: "This stored suggestion cannot be approved.",
};
export const bottleFailure = (
  reason: string,
  status: number,
  extra: Record<string, string> = {},
) =>
  json(
    { reason, message: messages[reason] ?? "Please try again." },
    status,
    extra,
  );
export function trustedBottleIp(headers: Headers, env: BottleEnv): string {
  // Only Vercel's platform-overwritten header is trusted. Direct/local servers share a conservative bucket.
  const raw =
    env.VERCEL === "1" ? headers.get("x-vercel-forwarded-for")?.trim() : null;
  return raw && isIP(raw) ? raw.toLowerCase() : "unknown";
}
function trustedOrigin(request: Request, env: BottleEnv): boolean {
  const allowed = [
    env.BETTER_AUTH_URL,
    "https://otohime.dev",
    "https://www.otohime.dev",
    ...(env.VERCEL_ENV === "preview" && env.VERCEL_URL
      ? [`https://${env.VERCEL_URL}`]
      : []),
  ]
    .filter(Boolean)
    .flatMap((url) => {
      try {
        return [new URL(url!).origin];
      } catch {
        return [];
      }
    });
  const origin = request.headers.get("origin");
  return !!origin && allowed.includes(origin);
}
async function readJson(
  request: Request,
): Promise<{ value: unknown } | { response: Response }> {
  if (
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    return { response: bottleFailure("unsupported_content", 415) };
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 8192))
    return { response: bottleFailure("oversized", 413) };
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader)
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) {
          await reader.cancel();
          return { response: bottleFailure("oversized", 413) };
        }
        chunks.push(value);
      }
    return {
      value: JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
      ),
    };
  } catch {
    return { response: bottleFailure("json", 400) };
  }
}
const configured = (deps: BottleHttpDeps) =>
  !!deps.env.DATABASE_URL && !!deps.env.BETTER_AUTH_SECRET;
export async function bottleGet(deps: BottleHttpDeps): Promise<Response> {
  if (!deps.env.DATABASE_URL)
    return json({ bottles: deps.seeds, degraded: true });
  return json(await deps.service.pool());
}
export async function bottlePost(
  request: Request,
  deps: BottleHttpDeps,
): Promise<Response> {
  if (!trustedOrigin(request, deps.env)) return bottleFailure("origin", 403);
  const parsed = await readJson(request);
  if ("response" in parsed) return parsed.response;
  if (!configured(deps)) return bottleFailure("unavailable", 503);
  try {
    const result = await deps.service.suggest(
      parsed.value,
      trustedBottleIp(request.headers, deps.env),
    );
    if (result.kind === "accepted")
      return json({ id: result.id, status: "pending" }, 201);
    if (result.kind === "invalid") return bottleFailure(result.reason, 400);
    return bottleFailure(
      result.kind,
      result.kind === "duplicate" ? 409 : 429,
      result.kind === "rate_limited"
        ? {
            "retry-after": String(
              3600 - (Math.floor(Date.now() / 1000) % 3600),
            ),
          }
        : {},
    );
  } catch {
    return bottleFailure("unavailable", 503);
  }
}
async function authorize(deps: BottleHttpDeps): Promise<Actor | Response> {
  const actor = await deps.actor();
  if (!actor) return bottleFailure("unauthenticated", 401);
  if (!can(actor.role, { bottle: ["moderate"] }))
    return bottleFailure("forbidden", 403);
  return actor;
}
const statusValue = (v: string): v is BottleStatus =>
  ["pending", "approved", "rejected"].includes(v);
export async function bottleAdminGet(
  request: Request,
  deps: BottleHttpDeps,
): Promise<Response> {
  try {
    const actor = await authorize(deps);
    if (actor instanceof Response) return actor;
    const params = new URL(request.url).searchParams;
    const status = params.get("status") ?? "pending";
    const cursor = params.get("cursor");
    if (!statusValue(status) || params.getAll("status").length > 1)
      return bottleFailure("status", 400);
    if (
      (cursor !== null && !validBottleCursor(cursor)) ||
      params.getAll("cursor").length > 1
    )
      return bottleFailure("cursor", 400);
    if (!configured(deps)) return bottleFailure("unavailable", 503);
    return json(await deps.service.review(status, cursor, actor));
  } catch {
    return bottleFailure("unavailable", 503);
  }
}
export async function bottlePatch(
  request: Request,
  id: string,
  deps: BottleHttpDeps,
): Promise<Response> {
  try {
    const actor = await authorize(deps);
    if (actor instanceof Response) return actor;
    if (!trustedOrigin(request, deps.env)) return bottleFailure("origin", 403);
    const parsed = await readJson(request);
    if ("response" in parsed) return parsed.response;
    const value = parsed.value as { status?: unknown } | null;
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1 ||
      typeof value.status !== "string" ||
      !["approved", "rejected"].includes(value.status)
    )
      return bottleFailure("status", 400);
    if (!configured(deps)) return bottleFailure("unavailable", 503);
    const result = await deps.service.moderate(
      id,
      value.status as "approved" | "rejected",
      actor,
    );
    if (result.kind === "updated") return json(result.suggestion);
    return bottleFailure(
      result.kind,
      result.kind === "forbidden"
        ? 403
        : result.kind === "not_found"
          ? 404
          : 400,
    );
  } catch {
    return bottleFailure("unavailable", 503);
  }
}
