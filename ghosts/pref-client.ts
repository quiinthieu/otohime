"use client";

import { useSyncExternalStore } from "react";
import { ghostsPreferenceStore } from "./pref.ts";

const store = ghostsPreferenceStore(() => window.localStorage, () => window);
export const getGhostsHidden = store.get;
export const subscribeGhostsHidden = store.subscribe;
export const setGhostsHidden = store.set;
export const useGhostsHidden = () => useSyncExternalStore(store.subscribe, store.get, store.getServer);
