"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { appearancePlan, appearanceStore, applyPlan } from "@/lib/appearance-client";
import { decodeLab, encodeLab, LAB_RANGES, labDefaults, normalizeLab, type InkLabSettings, type LabSnapshot } from "@/lib/ink-lab";
import { HANDS } from "@/lib/ink-modes";
import { PRINT_RUN_IDS, PRINT_RUNS } from "@/lib/print-runs";
import { InkLabPreview } from "./ink-lab-preview";

const NUMBERS = [
  ["turbulence", "Turbulence", "spatial frequency"], ["displacement", "Displacement", "px"],
  ["wobble", "Wobble speed", "seeds / second"], ["grain", "Paper grain", "opacity"],
  ["transitionMs", "Transition duration", "ms"],
] as const;

export function InkLab() {
  const params = useSearchParams();
  const query = params.toString();
  const [snapshot, setSnapshot] = useState(() => decodeLab(query).snapshot);
  const [draft, setDraft] = useState(snapshot);
  const [status, setStatus] = useState(() => decodeLab(query).message);
  const [manualUrl, setManualUrl] = useState("");
  const manual = useRef<HTMLInputElement>(null);
  const current = useRef(snapshot);
  const lastQuery = useRef<string | null>(null);
  const frame = useRef(0);
  const [ready, setReady] = useState(false);

  const replace = (value: LabSnapshot, clean = false) => {
    const next = clean ? "" : encodeLab(value);
    lastQuery.current = next;
    window.history.replaceState(window.history.state, "", `/lab${next ? `?${next}` : ""}`);
  };

  // Next's supported native history integration updates useSearchParams on replaceState and popstate.
  // Internal canonical rewrites must not overwrite a newer pending slider input.
  useEffect(() => {
    const raw = window.location.search.slice(1);
    if (lastQuery.current === raw && !window.location.hash) return;
    const decoded = decodeLab(raw);
    const nextQuery = query ? encodeLab(decoded.snapshot) : "";
    lastQuery.current = nextQuery;
    const pending = requestAnimationFrame(() => {
      cancelAnimationFrame(frame.current); frame.current = 0;
      current.current = decoded.snapshot; setSnapshot(decoded.snapshot); setDraft(decoded.snapshot); setStatus(decoded.message); setManualUrl("");
      if (raw !== nextQuery || window.location.hash) window.history.replaceState(window.history.state, "", `/lab${nextQuery ? `?${nextQuery}` : ""}`);
      setReady(true);
    });
    return () => cancelAnimationFrame(pending);
  }, [params, query]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => { if (manualUrl) { manual.current?.focus(); manual.current?.select(); } }, [manualUrl]);

  const edit = (next: LabSnapshot) => {
    current.current = normalizeLab(next);
    setDraft(current.current);
    setManualUrl("");
    if (!frame.current) frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setSnapshot(current.current);
      setStatus("Preview updated. Apply to take this ink around the site.");
      replace(current.current);
    });
  };
  const setting = (patch: Partial<InkLabSettings>) => edit({ ...current.current, settings: { ...current.current.settings, ...patch } });
  const flush = () => {
    cancelAnimationFrame(frame.current); frame.current = 0;
    const value = normalizeLab(current.current);
    current.current = value; setSnapshot(value); setDraft(value); replace(value);
    return value;
  };
  const share = async () => {
    const value = flush();
    const url = new URL(`/lab?${encodeLab(value)}`, window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setManualUrl(""); setStatus("Copied the proof URL. Opening it previews the recipe; it never applies it.");
    } catch {
      setManualUrl(url); setStatus("Clipboard unavailable. Copy the selected Share URL below; your edits are safe.");
      // A repeated failed attempt must select the field even when its value has not changed.
      manual.current?.focus(); manual.current?.select();
    }
  };
  const apply = () => {
    const result = appearanceStore().applyLab(flush());
    applyPlan(document.documentElement, appearancePlan(result.snapshot));
    const active = document.documentElement.hasAttribute("data-ink-lab") && result.snapshot.lab !== null;
    setStatus(!active ? "The style could not be applied. Your proof is safe; try Apply again." : result.persisted
      ? "Applied for this tab session, across routes and reload. Reset brings back House style."
      : "Applied on the current page only. Storage is blocked; routes and reload may lose it. Allow session storage, then Apply again.");
  };
  const reset = () => {
    cancelAnimationFrame(frame.current); frame.current = 0;
    const result = appearanceStore().resetHouse();
    applyPlan(document.documentElement, appearancePlan(result.snapshot));
    current.current = labDefaults(); setSnapshot(current.current); setDraft(current.current); replace(current.current, true); setManualUrl("");
    setStatus(result.persisted ? "House style restored. Appearance overrides cleared; your theme and season are kept."
      : "House style restored on this page. Storage is blocked; saved overrides could return on reload. Allow storage, then Reset again.");
  };
  const s = draft.settings;
  return <div className="ink-lab" data-lab-ready={ready ? "" : undefined} data-lab-pending={encodeLab(draft) !== encodeLab(snapshot)}>
    <div className="lab-layout">
      <InkLabPreview snapshot={snapshot} />
      <div className="lab-controls" aria-label="Proof controls">
        <fieldset className="card"><legend>01 / Ink & motion</legend>
          <label htmlFor="lab-run">Print run</label>
          <select id="lab-run" value={draft.printRun} onChange={e => edit(labDefaults(e.target.value as LabSnapshot["printRun"], current.current.settings.hand))}>
            {PRINT_RUN_IDS.map(id => <option key={id} value={id}>{PRINT_RUNS[id].label}</option>)}
          </select>
          <label htmlFor="lab-hand">Hand style</label>
          <select id="lab-hand" value={s.hand} onChange={e => setting({ hand: e.target.value as InkLabSettings["hand"] })}>{HANDS.map(hand => <option key={hand}>{hand}</option>)}</select>
          {NUMBERS.filter(([key]) => key !== "grain").map(([key, label, unit]) => <div className="lab-control" key={key}>
            <label htmlFor={`lab-${key}`}>{label}</label><output htmlFor={`lab-${key}`}>{s[key]} <small>{unit}</small></output>
            <input id={`lab-${key}`} type="range" {...LAB_RANGES[key]} value={s[key]} onChange={e => setting({ [key]: Number(e.target.value) })} />
          </div>)}
          <p className="lab-help">Wobble pauses offscreen and in hidden tabs. Reduced motion keeps the ink still.</p>
        </fieldset>
        <fieldset className="card"><legend>02 / Paper & plates</legend>
          <div className="lab-control"><label htmlFor="lab-grain">Paper grain</label><output htmlFor="lab-grain">{s.grain} <small>opacity</small></output>
            <input id="lab-grain" type="range" {...LAB_RANGES.grain} value={s.grain} onChange={e => setting({ grain: Number(e.target.value) })} /></div>
          <label htmlFor="lab-count">Plate count</label><select id="lab-count" value={s.plateCount} onChange={e => setting({ plateCount: Number(e.target.value) as 2 | 3 })}><option value="2">2 plates</option><option value="3">3 plates</option></select>
          <div className="lab-colors">{s.plates.map((color, i) => <div key={i}><label htmlFor={`lab-plate-${i}`}>Decorative plate {i + 1}</label><input id={`lab-plate-${i}`} type="color" value={color} onChange={e => {
            const plates = [...current.current.settings.plates]; plates[i] = e.target.value as typeof color;
            setting({ plates: plates as unknown as InkLabSettings["plates"] });
          }} /><output htmlFor={`lab-plate-${i}`}>{color}</output></div>)}</div>
          <label className="lab-check" htmlFor="lab-halftone"><input id="lab-halftone" type="checkbox" checked={s.halftone} onChange={e => setting({ halftone: e.target.checked })} />Halftone</label>
          <p className="lab-help">Plates are decoration; readable text keeps the preset’s ink. Grain stays beneath the type.</p>
        </fieldset>
      </div>
    </div>
    <div className="lab-actions" aria-label="Proof actions">
      <button type="button" className="btn btn-primary" onClick={apply}>Apply to whole site</button>
      <button type="button" className="btn" onClick={share}>Share</button>
      <button type="button" className="btn" onClick={reset}>Reset to house style</button>
    </div>
    <p role="status" className="lab-status">{status || "This is a preview. Nothing changes around the site until you Apply."}</p>
    {manualUrl && <div className="lab-share"><label htmlFor="lab-share-url">Share URL</label><input ref={manual} id="lab-share-url" readOnly value={manualUrl} onFocus={e => e.currentTarget.select()} /></div>}
  </div>;
}
