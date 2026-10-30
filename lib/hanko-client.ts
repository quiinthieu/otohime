import { readSeal, SEAL_KEY, type SealChoice } from "./hanko.ts";

const listeners = new Set<() => void>();
let stored: string | null = null;
function refresh() {
  try { stored = localStorage.getItem(SEAL_KEY); } catch { /* keep this tab's impression when storage is blocked */ }
}
function storage(event: StorageEvent) {
  if (event.key === SEAL_KEY || event.key === null) { refresh(); listeners.forEach(fn => fn()); }
}
export function subscribeSeal(listener: () => void) {
  refresh();
  if (!listeners.size) addEventListener("storage", storage);
  listeners.add(listener);
  return () => { listeners.delete(listener); if (!listeners.size) removeEventListener("storage", storage); };
}
export const getSeal = () => stored;
export const getServerSeal = () => null;
export function saveSeal(choice: SealChoice): boolean {
  const valid = readSeal(JSON.stringify(choice));
  if (!valid) return false;
  stored = JSON.stringify(valid);
  let saved = false;
  try { localStorage.setItem(SEAL_KEY, stored); saved = true; } catch { /* this tab still has its seal */ }
  listeners.forEach(fn => fn());
  return saved;
}
