import { createHmac, randomUUID } from "node:crypto";
import { mergeBottles, parseBottle, publicBottle } from "./bottles.ts";
import { can } from "./permissions.ts";
import type { Bottle, BottleInput, BottleStatus } from "./bottles.ts";
export type Suggestion = Bottle & {
  status: BottleStatus;
  createdAt: string;
  updatedAt: string;
};
export type Admission = {
  bottle: Bottle;
  submitter: string;
  bucket: string;
  now: Date;
};
export type AdmissionResult =
  | { kind: "accepted"; id: string }
  | { kind: "duplicate" | "rate_limited" };
export type ModerationResult =
  | { kind: "updated"; suggestion: Suggestion }
  | { kind: "forbidden" | "not_found" | "invalid" };
export type BottlePage = {
  suggestions: Suggestion[];
  nextCursor: string | null;
};
/** Adapters must admit atomically, recheck actor rights at write time, and never fetch URLs. */
export interface BottleStore {
  admit(input: Admission): Promise<AdmissionResult>;
  approved(): Promise<Bottle[]>;
  list(status: BottleStatus, cursor: string | null): Promise<BottlePage>;
  moderate(
    id: string,
    status: "approved" | "rejected",
    actorId: string,
    now: Date,
  ): Promise<ModerationResult>;
}
export type Actor = { id: string; role?: string | null };
export interface BottleService {
  pool(): Promise<{ bottles: Bottle[]; degraded: boolean }>;
  suggest(
    value: unknown,
    ip: string,
  ): Promise<AdmissionResult | { kind: "invalid"; reason: string }>;
  review(
    status: BottleStatus,
    cursor: string | null,
    actor: Actor,
  ): Promise<BottlePage>;
  moderate(
    id: string,
    status: "approved" | "rejected",
    actor: Actor,
  ): Promise<ModerationResult>;
}
export function submitterKeys(ip: string, now: Date, secret: string) {
  const submitter = createHmac("sha256", secret)
    .update(`bottle:ip:${ip}`)
    .digest("hex");
  return {
    submitter,
    bucket: `bottle:${submitter}:${now.toISOString().slice(0, 13)}`,
  };
}
export function validBottleCursor(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}
export function createBottleService(deps: {
  store: BottleStore;
  seeds: readonly Bottle[];
  secret: string;
  now?: () => Date;
  id?: () => string;
}): BottleService {
  const now = deps.now ?? (() => new Date());
  return {
    async pool() {
      try {
        return {
          bottles: mergeBottles(deps.seeds, await deps.store.approved()),
          degraded: false,
        };
      } catch {
        return { bottles: mergeBottles(deps.seeds, []), degraded: true };
      }
    },
    async suggest(value, ip) {
      const parsed = parseBottle(value);
      if (!parsed.ok) return { kind: "invalid", reason: parsed.reason };
      if (deps.seeds.some((b) => b.url === parsed.value.url))
        return { kind: "duplicate" };
      const at = now();
      return deps.store.admit({
        bottle: { id: (deps.id ?? randomUUID)(), ...parsed.value },
        ...submitterKeys(ip, at, deps.secret),
        now: at,
      });
    },
    async review(status, cursor, actor) {
      if (!can(actor.role, { bottle: ["moderate"] })) throw Error("forbidden");
      return deps.store.list(status, cursor);
    },
    async moderate(id, status, actor) {
      if (!can(actor.role, { bottle: ["moderate"] }))
        return { kind: "forbidden" };
      return deps.store.moderate(id, status, actor.id, now());
    },
  };
}
/** Matching fake for contracts. Share a store across service reconstructions. */
export function createMemoryBottleStore(
  roles: Map<string, string> = new Map(),
): BottleStore {
  const rows = new Map<string, Suggestion>();
  const urls = new Set<string>();
  const usage = new Map<string, number>();
  return {
    async admit({ bottle, bucket, now }) {
      if (urls.has(bottle.url)) return { kind: "duplicate" };
      if ((usage.get(bucket) ?? 0) >= 5) return { kind: "rate_limited" };
      urls.add(bottle.url);
      rows.set(bottle.id, {
        ...bottle,
        status: "pending",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      });
      usage.set(bucket, (usage.get(bucket) ?? 0) + 1);
      return { kind: "accepted", id: bottle.id };
    },
    async approved() {
      return [...rows.values()]
        .filter((b) => b.status === "approved")
        .map(publicBottle);
    },
    async list(status, cursor) {
      const page = [...rows.values()]
        .filter((b) => b.status === status && (!cursor || b.id > cursor))
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .slice(0, 26);
      return {
        suggestions: page.slice(0, 25).map((b) => ({ ...b })),
        nextCursor: page.length > 25 ? page[24].id : null,
      };
    },
    async moderate(id, status, actorId, now) {
      if (!can(roles.get(actorId) ?? "user", { bottle: ["moderate"] }))
        return { kind: "forbidden" };
      const row = rows.get(id);
      if (!row) return { kind: "not_found" };
      const valid = parseBottle(publicInput(row));
      if (status === "approved" && (!valid.ok || valid.value.url !== row.url))
        return { kind: "invalid" };
      row.status = status;
      row.updatedAt = now.toISOString();
      return { kind: "updated", suggestion: { ...row } };
    },
  };
}
export function publicInput(b: Bottle): BottleInput {
  return { url: b.url, title: b.title, note: b.note, kind: b.kind };
}
