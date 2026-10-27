// The pure ink-ghosts room: membership, per-connection rate bucket and invalid
// strikes. Adapters (the Durable Object and the local fake) own the sockets and
// turn the returned effects into sends and closes, so both enforce identical
// limits. The room keeps no coordinates and no history; an event exists only
// for the duration of receive().

import {
  CLOSE_FULL,
  CLOSE_POLICY,
  MAX_INVALID,
  RATE_CAPACITY,
  RATE_REFILL_PER_SECOND,
  ROOM_CAP,
  parseClientFrame,
  type ServerMessage,
} from "./protocol.ts";

/**
 * Everything the room knows about a connection, and exactly what a Durable
 * Object stores in the socket attachment to survive hibernation: the server's
 * id, the bucket (tokens at time `at`, ms) and the invalid-frame count.
 */
export type MemberState = { id: string; tokens: number; at: number; invalid: number };

export type Effect =
  | { kind: "send"; to: string; msg: ServerMessage }
  | { kind: "close"; to: string; code: number; reason: string };

export type JoinResult =
  | { ok: true; member: MemberState; effects: Effect[] }
  | { ok: false; effects: Effect[] };

export type ReceiveOutcome = "accepted" | "rate" | "invalid" | "closed" | "unknown";

export type ReceiveResult = { outcome: ReceiveOutcome; member: MemberState | null; effects: Effect[] };

export type RoomOptions = { now: () => number };

const MEMBER_KEYS = ["id", "tokens", "at", "invalid"] as const;

/** Validates a restored attachment; anything that is not exactly a MemberState is null. */
export function readMemberState(value: unknown): MemberState | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  if (keys.length !== MEMBER_KEYS.length || !MEMBER_KEYS.every((key) => keys.includes(key))) return null;
  const { id, tokens, at, invalid } = record;
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return null;
  if (typeof tokens !== "number" || !Number.isFinite(tokens) || tokens < 0 || tokens > RATE_CAPACITY) return null;
  if (typeof at !== "number" || !Number.isFinite(at)) return null;
  if (!Number.isInteger(invalid) || (invalid as number) < 0) return null;
  return { id, tokens, at, invalid: invalid as number };
}

export class Room {
  private readonly members = new Map<string, MemberState>();
  private readonly now: () => number;

  constructor(options: RoomOptions) {
    this.now = options.now;
  }

  get size(): number {
    return this.members.size;
  }

  has(id: string): boolean {
    return this.members.has(id);
  }

  ids(): string[] {
    return [...this.members.keys()];
  }

  /** A copy of the member's state, ready to persist as an attachment. */
  snapshot(id: string): MemberState | null {
    const member = this.members.get(id);
    return member ? { ...member } : null;
  }

  /** Re-adds a member rebuilt from an attachment, without announcing it (it never left). */
  restore(state: MemberState): boolean {
    if (this.members.has(state.id) || this.members.size >= ROOM_CAP) return false;
    this.members.set(state.id, { ...state });
    return true;
  }

  /** Admits a fresh connection under the cap; the id comes from the adapter, never the client. */
  join(id: string): JoinResult {
    if (this.members.size >= ROOM_CAP || this.members.has(id)) {
      return {
        ok: false,
        effects: [
          { kind: "send", to: id, msg: { t: "full" } },
          { kind: "close", to: id, code: CLOSE_FULL, reason: "full" },
        ],
      };
    }
    const member: MemberState = { id, tokens: RATE_CAPACITY, at: this.now(), invalid: 0 };
    this.members.set(id, member);
    const n = this.members.size;
    const effects: Effect[] = [{ kind: "send", to: id, msg: { t: "hi", id, n } }];
    for (const other of this.others(id)) effects.push({ kind: "send", to: other, msg: { t: "n", n } });
    return { ok: true, member: { ...member }, effects };
  }

  /**
   * Handles one incoming frame. Every attempt spends a token first, so invalid
   * frames are rate limited too; an empty bucket drops the frame unread. A
   * valid event fans out to the other members only.
   */
  receive(id: string, data: unknown): ReceiveResult {
    const member = this.members.get(id);
    if (!member) return { outcome: "unknown", member: null, effects: [] };
    if (member.invalid >= MAX_INVALID) {
      return { outcome: "closed", member: { ...member }, effects: [this.policyClose(id)] };
    }
    this.refill(member);
    if (member.tokens < 1) return { outcome: "rate", member: { ...member }, effects: [] };
    member.tokens -= 1;
    const parsed = parseClientFrame(data);
    if (!parsed.ok) {
      member.invalid += 1;
      const effects = member.invalid >= MAX_INVALID ? [this.policyClose(id)] : [];
      return { outcome: member.invalid >= MAX_INVALID ? "closed" : "invalid", member: { ...member }, effects };
    }
    const { t, x, y } = parsed.msg;
    const effects: Effect[] = this.others(id).map((other) => ({
      kind: "send",
      to: other,
      msg: { t, id, x, y },
    }));
    return { outcome: "accepted", member: { ...member }, effects };
  }

  /** Removes a member (close, error or policy close); idempotent. */
  leave(id: string): Effect[] {
    if (!this.members.delete(id)) return [];
    const n = this.members.size;
    const effects: Effect[] = [];
    for (const other of this.others(id)) {
      effects.push({ kind: "send", to: other, msg: { t: "bye", id } });
      effects.push({ kind: "send", to: other, msg: { t: "n", n } });
    }
    return effects;
  }

  private others(id: string): string[] {
    return [...this.members.keys()].filter((other) => other !== id);
  }

  private refill(member: MemberState): void {
    // Keep the high-water mark through clock rollback and attachment restoration.
    const now = Math.max(member.at, this.now());
    const elapsed = now - member.at;
    member.tokens = Math.min(RATE_CAPACITY, member.tokens + (elapsed * RATE_REFILL_PER_SECOND) / 1000);
    member.at = now;
  }

  private policyClose(id: string): Effect {
    return { kind: "close", to: id, code: CLOSE_POLICY, reason: "invalid frames" };
  }
}
