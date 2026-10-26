"use client";

import { useAppearanceSnapshot } from "@/components/appearance-runtime";
import { appearanceStore } from "@/lib/appearance-client";
import type { AppearanceWriteResult } from "@/lib/ink-lab";
import { PRINT_RUN_IDS, PRINT_RUNS, type PrintRunId } from "@/lib/print-runs";
import { describePrintRun, printRunStatus } from "@/lib/terminal";
import { useId, useSyncExternalStore } from "react";

// Selection feedback is shared too: a repeated choice can fail to save without changing the appearance snapshot.
// Keep it separate from the persisted appearance model, and publish after every attempt, including same-run picks.
let lastResult: AppearanceWriteResult | null = null;
const listeners = new Set<() => void>();
const subscribeResult = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const getResult = () => lastResult;
const getServerResult = () => null;

export function selectPrintRun(id: PrintRunId): AppearanceWriteResult {
  lastResult = appearanceStore().setPrintRun(id);
  for (const listener of listeners) listener();
  return lastResult;
}

// The terminal loader stops keydown before it reaches the radios, including the browser's radio key handling.
// Its bind() handler calls this directly; outside the terminal the radios keep their normal browser behavior.
export function printRunKey(event: KeyboardEvent): boolean {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || target.type !== "radio" || !target.closest("[data-print-run-switch]")) return false;
  if (event.altKey || event.ctrlKey || event.metaKey) return false;
  const arrows = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (event.key !== " " && !arrows.includes(event.key)) return false;
  event.preventDefault();
  const radios = [...target.closest("[data-print-run-switch]")!.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)')];
  const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
  const next = event.key === " " ? target : radios[(radios.indexOf(target) + step + radios.length) % radios.length];
  next.focus();
  next.click();
  return true;
}

export function PrintRunSwitch({ onSelect }: { onSelect?: (result: AppearanceWriteResult) => void }) {
  const snapshot = useAppearanceSnapshot();
  const current = snapshot.lab?.printRun ?? snapshot.printRun;
  const name = useId();
  const result = useSyncExternalStore(subscribeResult, getResult, getServerResult);
  function select(id: PrintRunId) {
    const next = selectPrintRun(id);
    onSelect?.(next);
  }
  return (
    <fieldset className="min-w-0 basis-full" data-print-run-switch aria-describedby={`${name}-status`}>
      <legend className="caption mb-2">Print run</legend>
      <div className="flex flex-wrap gap-2">
        {PRINT_RUN_IDS.map((id) => (
          <label key={id} className="chip cursor-pointer has-checked:bg-(--ink) has-checked:text-(--paper) has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--ink)">
            <input
              className="sr-only"
              type="radio"
              name={name}
              value={id}
              checked={current === id}
              onChange={() => select(id)}
              // Clicking the selected preset must also clear an applied Lab (and allow a failed save to be retried).
              onClick={() => current === id && select(id)}
            />
            {PRINT_RUNS[id].label}
          </label>
        ))}
      </div>
      <p id={`${name}-status`} className="mt-2 text-xs text-(--muted)" role="status">
        {result?.snapshot === snapshot ? printRunStatus(result) : describePrintRun(snapshot)}
      </p>
    </fieldset>
  );
}
