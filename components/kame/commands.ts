import type { FetchCommand } from "@/lib/kame";

// Task 3 imports this port. No DOM events or window globals; only the mounted companion owns it.
let receiver: ((command: FetchCommand) => boolean) | null = null;
export function commandKame(command: FetchCommand): boolean { return receiver?.(command) ?? false; }
export function bindKame(next: (command: FetchCommand) => boolean) {
  receiver = next;
  return () => { if (receiver === next) receiver = null; };
}
