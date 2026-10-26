"use client";

// The print run after hydration, mounted once in every root layout's <body>. It keeps <html>'s markers and the
// document's tagged SVG filters (lib/appearance-client.ts) in step with the store: changes in this tab, another tab's
// choice (the storage event) and a back/forward-cache restore. It renders nothing, so it cannot mismatch the server.
// window.otohimeAppearance exposes the store's own validated operations, for the Pocket console's commands and tests.
import {
  appearancePlan, appearanceStore, applyPlan, createFilterRuntime, filterScale, HOUSE_SNAPSHOT,
} from "@/lib/appearance-client";
import type { AppearanceSnapshot } from "@/lib/ink-lab";
import { useEffect, useSyncExternalStore } from "react";

const subscribe = (listener: () => void) => appearanceStore().subscribe(listener);
const getSnapshot = () => appearanceStore().getSnapshot();
const getServerSnapshot = () => HOUSE_SNAPSHOT;

// For components that draw differently per run: House on the server and in the hydrating render, then the stored run.
export function useAppearanceSnapshot(): AppearanceSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function AppearanceRuntime() {
  useEffect(() => {
    const store = appearanceStore();
    const root = document.documentElement;
    const filters = createFilterRuntime(document, window);
    // Read from the store, never the hydrating render's House, so the boot script's first frame is never undone.
    const sync = () => {
      const snapshot = store.getSnapshot();
      applyPlan(root, appearancePlan(snapshot));
      filters.update(filterScale(snapshot));
    };
    sync();
    const unsubscribe = store.subscribe(sync);
    const api = Object.freeze({
      getSnapshot: store.getSnapshot,
      setPrintRun: store.setPrintRun,
      applyLab: store.applyLab,
      resetHouse: store.resetHouse,
    });
    Object.defineProperty(window, "otohimeAppearance", { value: api, configurable: true });
    return () => {
      unsubscribe();
      filters.dispose();
      if ((window as { otohimeAppearance?: unknown }).otohimeAppearance === api) {
        delete (window as { otohimeAppearance?: unknown }).otohimeAppearance;
      }
    };
  }, []);
  return null;
}
