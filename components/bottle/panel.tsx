"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import seeds from "@/content/bottles.json";
import { bottleDraw, parseBottlePool, normalizeBottleHistory, parseBottle, type Bottle } from "@/lib/bottles";
import "./panel.css";

export type BottlePanelProps = { onClose: () => void };
const KEY = "bottles:v1";
let memory: string[] = [];
let restored = false;

export default function BottlePanel({ onClose }: BottlePanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const originPath = useRef(pathname);
  useEffect(() => {
    if (originPath.current !== pathname) { dialog.current?.close(); onClose(); }
  }, [pathname, onClose]);
  const [pool, setPool] = useState<Bottle[] | null>(null);
  const [card, setCard] = useState<Bottle | null>(null);
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);
  const [retryAt, setRetryAt] = useState(0);
  const cardRef = useRef<HTMLElement>(null);
  const animation = useRef<Animation | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => { if (motion.matches) animation.current?.cancel(); };
    motion.addEventListener("change", stop);
    const abort = new AbortController();
    controller.current = abort;
    void (async () => {
      let bottles: Bottle[];
      try {
        const response = await fetch("/api/bottles", { signal: abort.signal, cache: "no-store" });
        if (!response.ok) throw new Error("pool");
        const data = parseBottlePool(await response.json());
        if (!data) throw new Error("pool");
        bottles = data.bottles;
        setOffline(data.degraded);
      } catch {
        if (abort.signal.aborted) return;
        bottles = seeds as Bottle[];
        setOffline(true);
      }
      if (abort.signal.aborted) return;
      if (!restored) {
        try { memory = normalizeBottleHistory(bottles, JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* memory works without storage */ }
        restored = true;
      }
      setPool(bottles);
      const next = bottleDraw(bottles, memory, Math.random);
      memory = next.seen;
      try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* visit-only history */ }
      setCard(next.bottle);
    })();
    return () => {
      abort.abort();
      animation.current?.cancel();
      motion.removeEventListener("change", stop);
      el.close();
    };
  }, []);

  useEffect(() => {
    animation.current?.cancel();
    if (card && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animation.current = cardRef.current?.animate(
        [{ transform: "translateY(12px) rotate(-1deg)", opacity: .4 }, { transform: "none", opacity: 1 }],
        { duration: 240, easing: "ease-out" },
      ) ?? null;
    }
  }, [card]);

  function draw(bottles = pool) {
    if (!bottles) return;
    const next = bottleDraw(bottles, memory, Math.random);
    memory = next.seen;
    try { localStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* visit-only history */ }
    setCard(next.bottle);
  }
  async function suggest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    if (Date.now() < retryAt) { setMessage("Please try again after the rate limit resets."); return; }
    const form = event.currentTarget;
    const value = Object.fromEntries(new FormData(form));
    const parsed = parseBottle(value);
    if (!parsed.ok) {
      setMessage(`Please check your suggestion (${parsed.reason}). Use a public HTTPS URL and 1–80 plain-text characters for title and note.`);
      return;
    }
    submitting.current = true;
    setSending(true);
    setMessage("");
    try {
      const response = await fetch("/api/bottles/suggestions", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(value), signal: controller.current?.signal,
      });
      const responseValue: unknown = await response.json();
      if (!responseValue || typeof responseValue !== "object") throw new Error("response");
      const data = responseValue as Record<string, unknown>;
      if (!response.ok) {
        if (response.status === 429) {
          const seconds = Number(response.headers.get("retry-after"));
          setRetryAt(Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000);
        }
        setMessage(`${typeof data.message === "string" ? data.message : "Please try again."}${typeof data.reason === "string" ? ` (${data.reason})` : ""}`);
        return;
      }
      if (data.status !== "pending") throw new Error("response");
      setSuccess(true);
      form.reset();
    } catch {
      setMessage("Suggestions are temporarily unavailable. Your input is still here; please try again.");
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }
  function shut() { dialog.current?.close(); onClose(); }
  function onKeyDown(event: React.KeyboardEvent<HTMLDialogElement>) {
    event.stopPropagation(); // Modal keys never feed the footer’s document-level game listener.
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialog.current!.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), textarea, select, summary, [tabindex='0']"))
      .filter((el) => el.tabIndex >= 0 && el.checkVisibility());
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return createPortal(<dialog onKeyDown={onKeyDown} ref={dialog} className="dialog bottle-panel" aria-labelledby="bottle-panel-title" onCancel={(e) => { e.preventDefault(); shut(); }} onClose={onClose}>
    <header><h2 id="bottle-panel-title">Message in a Bottle</h2><button type="button" className="chip" autoFocus onClick={shut}>Close Bottle</button></header>
    <p role="status" className="caption bottle-notice">{offline ? "Quiet offline tide — showing the bundled, curated collection." : "Hand-picked sites, toys and art. Visit a link when you’re ready."}</p>
    <div aria-live="polite" aria-atomic="true" className="bottle-card-slot">
      {pool === null ? <p>Waiting for the tide…</p> : card ? <article className="bottle-card" ref={cardRef} data-bottle-id={card.id}>
        <p className="caption">{card.kind}</p><h3>{card.title}</h3><p>{card.note}</p>
        <a className="chip" href={card.url} target="_blank" rel="noopener noreferrer">Visit {card.title}<span className="sr-only"> (opens a new tab)</span></a>
      </article> : <p>No bottles on this tide. You can still suggest a site.</p>}
    </div>
    <button type="button" className="chip" disabled={!pool?.length} onClick={() => draw()}>Another bottle</button>
    <details><summary>Suggest a site</summary><p>Suggestions are reviewed before publication. Use a public HTTPS link without tracking parameters.</p>
      {success ? <p role="status">Thank you. Your suggestion is pending review.</p> : <form onSubmit={suggest} aria-label="Suggest a site" aria-describedby="bottle-suggestion-message">
        <label>URL<input name="url" type="url" required maxLength={2048} autoComplete="url" /></label>
        <label>Title<input name="title" required maxLength={80} /></label>
        <label>Note<textarea name="note" required maxLength={80} rows={2} /></label>
        <label htmlFor="bottle-kind">Kind</label><select id="bottle-kind" name="kind" defaultValue="site"><option value="site">Site</option><option value="toy">Browser toy</option><option value="art">Interactive art</option></select>
        <label className="bottle-honey" aria-hidden="true">Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <button className="chip" type="submit" disabled={sending}>{sending ? "Sending…" : "Send for review"}</button>
        <p id="bottle-suggestion-message" role="alert">{message}</p>
      </form>}
    </details>
  </dialog>, document.body);
}
