"use client";

import { useSyncExternalStore } from "react";
import { shimiPreferenceStore, type ShimiPreferenceStore } from "./pref.ts";

const store = shimiPreferenceStore(
  () => { try { return window.localStorage; } catch { return null; } },
  () => { try { return window; } catch { return { addEventListener() {}, removeEventListener() {} }; } },
);
export const getShimiEnabled = store.get;
export const setShimiEnabled = store.set;
export const subscribeShimiEnabled = store.subscribe;
export const useShimiEnabled = (injected: ShimiPreferenceStore = store) =>
  useSyncExternalStore(injected.subscribe, injected.get, injected.getServer);
