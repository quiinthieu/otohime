"use client";

import { useSyncExternalStore } from "react";
import { shimiPreferenceStore, type ShimiPreferenceStore } from "./pref.ts";

// A safe, off-by-default fallback. The browser integration supplies one shared
// store created with its storage/event ports; importing this hook touches no DOM.
const fallbackStore = shimiPreferenceStore(() => null, () => ({
  addEventListener() {}, removeEventListener() {},
}));
export const useShimiEnabled = (store: ShimiPreferenceStore = fallbackStore) =>
  useSyncExternalStore(store.subscribe, store.get, store.getServer);
