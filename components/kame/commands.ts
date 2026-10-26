import type { FetchCommand } from "@/lib/kame";
import type { FetchPoint } from "@/lib/kame-fetch";

// Acceptance and actual rendered arrival are separate. No global DOM event API.
export type KameCompletion = { type: 'accepted' | 'position' | 'arrived' | 'cancelled'; id: string; position: FetchPoint };
const listeners = new Set<(event: KameCompletion) => void>();
export function subscribeKameCompletion(listener: (event: KameCompletion) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function emitKameCompletion(event: KameCompletion) {
  for (const listener of listeners) listener(event);
}
let receiver: ((command: FetchCommand) => boolean) | null = null;
export function commandKame(command: FetchCommand): boolean { return receiver?.(command) ?? false; }
export function bindKame(next: (command: FetchCommand) => boolean) {
  receiver = next;
  return () => { if (receiver === next) receiver = null; };
}
