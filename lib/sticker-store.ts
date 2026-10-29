"use client";

import { useSyncExternalStore } from "react";
import { COLLECTION_KEY, freshCollection, parseCollection, type Collection } from "./gashapon";

const server = freshCollection();
let state = server;
let loaded = false;
let durable = true;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
function load() {
  if (loaded) return;
  loaded = true;
  try { state = parseCollection(localStorage.getItem(COLLECTION_KEY)); }
  catch { durable = false; }
}
function storage(e: StorageEvent) {
  if (e.key === COLLECTION_KEY || e.key === null) { state = parseCollection(e.newValue); emit(); }
}
function subscribe(fn: () => void) {
  load();
  if (!listeners.size) window.addEventListener("storage", storage);
  listeners.add(fn);
  return () => { listeners.delete(fn); if (!listeners.size) window.removeEventListener("storage", storage); };
}
export function updateCollection(change: (s: Collection) => Collection): Collection {
  load();
  // Read the latest committed state before a gesture, including another tab's draw.
  if (durable) try { state = parseCollection(localStorage.getItem(COLLECTION_KEY)); } catch { durable = false; }
  const next = change(state);
  if (next !== state) {
    state = next;
    try { localStorage.setItem(COLLECTION_KEY, JSON.stringify(state)); } catch { durable = false; }
    emit();
  }
  return state;
}
export function useCollection() {
  const collection = useSyncExternalStore(subscribe, () => state, () => server);
  const persistent = useSyncExternalStore(subscribe, () => durable, () => true);
  const ready = useSyncExternalStore(subscribe, () => loaded, () => false);
  return { collection, durable: persistent, ready };
}
