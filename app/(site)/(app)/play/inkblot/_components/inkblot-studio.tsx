"use client";

import { play } from "@/lib/sound-client";
import {
  analyzeBlot,
  appendUserDrop,
  curatedWardNotes,
  dailyBlotKey,
  dailyBlotSeed,
  describeBlotAlt,
  formatBlotSeed,
  generateInkblotReading,
  generateSeededDrops,
  hashBlotString,
  mirrorDropsForFold,
  mulberry32,
  parseBlotSeed,
  type InkDrop,
  type InkDropInput,
  type InkEllipse,
  type InkblotReading,
} from "../_lib/blot";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Mode = "daily" | "seeded" | "drip";
type GalleryNote = { id: string; name: string; note: string; tilt: number; hand: number; specimen?: boolean; pinned?: boolean };
const EMPTY_DROPS: InkDrop[] = [];
const REDUCED = "(prefers-reduced-motion: reduce)";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function subscribeReduced(onChange: () => void) {
  if (typeof matchMedia !== "function") return () => {};
  const media = matchMedia(REDUCED);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function organicDrop(x: number, y: number, salt: number): InkDropInput {
  const rng = mulberry32(hashBlotString(`${x.toFixed(4)}:${y.toFixed(4)}:${salt}`));
  const r = 0.028 + rng() * 0.055;
  const satellites = Array.from({ length: 1 + Math.floor(rng() * 3) }, () => {
    const dir = rng() * Math.PI * 2, dist = r * (1.15 + rng() * 1.4);
    return { x: x + Math.cos(dir) * dist, y: y + Math.sin(dir) * dist, r: 0.003 + rng() * 0.012, elongation: 1 + rng() * 0.5, angle: dir };
  });
  return { x, y, r, elongation: 1 + rng() * 1.1, angle: rng() * Math.PI, satellites };
}

type Plate = { mode: Mode; seed: string; drops: InkDrop[]; folded: boolean; now: Date };

function blotKeyFor(mode: Mode, seed: string, drops: readonly InkDrop[], now: Date) {
  if (mode === "daily") return dailyBlotKey(now);
  if (mode === "seeded") return seed;
  return formatBlotSeed(hashBlotString(JSON.stringify(drops)));
}

function plateFromLocation(): Plate {
  const now = new Date();
  const raw = new URLSearchParams(location.search).get("b");
  const parsed = raw ? parseBlotSeed(raw) : null;
  if (raw && parsed !== null) return { mode: "seeded", seed: raw, drops: generateSeededDrops(parsed), folded: true, now };
  const key = dailyBlotKey(now);
  const n = dailyBlotSeed(key.slice(6));
  return { mode: "daily", seed: formatBlotSeed(n), drops: generateSeededDrops(n), folded: true, now };
}

function ellipseNode(ellipse: InkEllipse, key: string, side: string) {
  const cx = ellipse.x * 100, cy = ellipse.y * 100;
  return (
    <ellipse
      key={key}
      data-side={side}
      cx={cx}
      cy={cy}
      rx={ellipse.r * ellipse.elongation * 100}
      ry={ellipse.r * 100}
      transform={`rotate(${(ellipse.angle * 180) / Math.PI} ${cx} ${cy})`}
    />
  );
}

export default function InkblotStudio() {
  const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [plate, setPlate] = useState<Plate | null>(null);
  if (ready && !plate) setPlate(plateFromLocation());
  const [pen, setPen] = useState({ x: 0.25, y: 0.5 });
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState("");
  const [reading, setReading] = useState<InkblotReading | null>(null);
  const [pinned, setPinned] = useState<GalleryNote | null>(null);
  const [publicNotes, setPublicNotes] = useState<GalleryNote[]>([]);
  const reduced = useSyncExternalStore(subscribeReduced, () => matchMedia(REDUCED).matches, () => false);
  const sheet = useRef<HTMLDivElement>(null);
  const observe = useRef<HTMLHeadingElement>(null);
  const dragging = useRef(false);
  const filterId = `inkblot-bleed-${useId().replace(/:/g, "")}`;
  const mode = plate?.mode ?? "daily";
  const seed = plate?.seed ?? "otohime";
  const drops = plate?.drops ?? EMPTY_DROPS;
  const folded = plate?.folded ?? true;
  const blotKey = plate ? blotKeyFor(mode, seed, drops, plate.now) : "otohime";
  const features = useMemo(() => analyzeBlot(drops), [drops]);
  const foldedDrops = useMemo(() => (folded ? mirrorDropsForFold(drops) : drops.map((drop) => ({ ...drop, side: "left" as const, kind: "drop" as const }))), [drops, folded]);
  const specimens = useMemo(() => curatedWardNotes(blotKey, features), [blotKey, features]);
  const gallery = [pinned, ...publicNotes, ...specimens].filter((entry): entry is GalleryNote => !!entry)
    .filter((entry, index, list) => list.findIndex((other) => other.id === entry.id) === index);

  useEffect(() => {
    if (!plate) return;
    let gone = false;
    fetch(`/api/inkblot/answers?blot=${encodeURIComponent(blotKey)}`)
      .then((response) => response.ok ? response.json() : { entries: [] })
      .then((body: { entries?: GalleryNote[] }) => { if (!gone) setPublicNotes(body.entries ?? []); })
      .catch(() => { if (!gone) setPublicNotes([]); });
    return () => { gone = true; };
  }, [blotKey, plate]);

  function syncUrl(next: Mode, nextSeed: string) {
    const url = next === "seeded" ? `${location.pathname}?b=${nextSeed}` : location.pathname;
    history.replaceState(null, "", url);
  }

  function chooseDaily() {
    const now = new Date();
    const key = dailyBlotKey(now);
    const n = dailyBlotSeed(key.slice(6));
    setPlate({ mode: "daily", seed: formatBlotSeed(n), drops: generateSeededDrops(n), folded: true, now });
    setPinned(null);
    setReading(null);
    syncUrl("daily", "");
  }

  function chooseSeeded(nextSeed: string) {
    const parsed = parseBlotSeed(nextSeed);
    if (parsed === null) return;
    setPlate({ mode: "seeded", seed: nextSeed, drops: generateSeededDrops(parsed), folded: true, now: new Date() });
    setPinned(null);
    setReading(null);
    syncUrl("seeded", nextSeed);
  }

  function chooseDrip() {
    setPlate({ mode: "drip", seed, drops: [], folded: false, now: new Date() });
    setPinned(null);
    setReading(null);
    syncUrl("drip", "");
  }

  function point(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = sheet.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return { x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height };
  }

  function dripAt(x: number, y: number) {
    if (folded || x >= 0.5 || x < 0 || y < 0 || y > 1) return;
    setPlate((current) => current
      ? { ...current, mode: "drip", drops: appendUserDrop(current.drops, organicDrop(clamp(x, 0.015, 0.49), clamp(y, 0.015, 0.985), current.drops.length)) }
      : current);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (folded || event.button !== 0) return;
    dragging.current = true;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    const at = point(event);
    if (at) dripAt(at.x, at.y);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const at = point(event);
    if (at) dripAt(at.x, at.y);
  }

  function onKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (folded) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      setPen((current) => ({
        x: clamp(current.x + (event.key === "ArrowRight" ? 0.03 : event.key === "ArrowLeft" ? -0.03 : 0), 0.02, 0.48),
        y: clamp(current.y + (event.key === "ArrowDown" ? 0.03 : event.key === "ArrowUp" ? -0.03 : 0), 0.02, 0.98),
      }));
    }
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      dripAt(pen.x, pen.y);
    }
  }

  function foldSheet() {
    const next = !folded;
    setPlate((current) => current ? { ...current, folded: next } : current);
    if (next) {
      play("rustle");
      observe.current?.focus();
    }
  }

  async function share() {
    const url = mode === "seeded" ? `${location.origin}${location.pathname}?b=${seed}` : `${location.origin}${location.pathname}`;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Share link copied.");
    } catch {
      setStatus(url);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextReading = generateInkblotReading(blotKey, features, note);
    setReading(nextReading);
    setStatus("Sending to the paper ward…");
    try {
      const response = await fetch("/api/inkblot/answers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ blotKey, name, note, website }),
      });
      const body = await response.json().catch(() => ({ message: "The ward could not file that observation." }));
      if (!response.ok) {
        setStatus(typeof body.message === "string" ? body.message : "The ward could not file that observation.");
        return;
      }
      setPinned({ id: body.id, name, note, tilt: body.tilt, hand: body.hand, pinned: true });
      setStatus("Filed with the paper ward. Awaiting the doctor's initials.");
    } catch {
      setStatus("The ward could not file that observation.");
    }
  }

  if (!plate) return <p className="inkblot-loading" role="status">Laying out the washi sheet…</p>;

  return (
    <div className="inkblot-studio">
      <div className="inkblot-toolbar" role="group" aria-label="Blot source">
        <button type="button" className="btn" data-testid="inkblot-daily-btn" aria-pressed={mode === "daily"} onClick={chooseDaily}>Daily blot</button>
        <button type="button" className="btn" data-testid="inkblot-shuffle-btn" aria-pressed={mode === "seeded"} onClick={() => chooseSeeded(formatBlotSeed(crypto.getRandomValues(new Uint32Array(1))[0]))}>Shuffle blot</button>
        <button type="button" className="btn" data-testid="inkblot-share-btn" onClick={() => { if (mode !== "seeded") chooseSeeded(seed); void share(); }}>Copy share link</button>
        <button type="button" className="btn" data-testid="inkblot-clear-btn" aria-pressed={mode === "drip"} onClick={chooseDrip}>Drip your own</button>
        <button type="button" className="btn" data-testid="inkblot-random-drops" onClick={() => { setPlate({ mode: "drip", seed, drops: generateSeededDrops(crypto.getRandomValues(new Uint32Array(1))[0]), folded: false, now: new Date() }); syncUrl("drip", ""); }}>Random drops</button>
      </div>
      <div
        ref={sheet}
        className="inkblot-sheet"
        data-testid="inkblot-sheet"
        data-folded={String(folded)}
        data-motion={reduced ? "reduced" : "ok"}
      >
        <div className="inkblot-leaf">
          <svg viewBox="0 0 100 100" className="inkblot-graphic" data-testid="inkblot-graphic" role="img" aria-label={describeBlotAlt(features, blotKey)}>
            <defs>
              <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
                {reduced ? null : <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" result="noise" />}
                {reduced ? null : <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="displaced" />}
                <feGaussianBlur in={reduced ? "SourceGraphic" : "displaced"} stdDeviation={reduced ? "0.35" : "0.55"} result="blur" />
                <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" />
              </filter>
            </defs>
            <g filter={folded ? `url(#${filterId})` : undefined}>
              {foldedDrops.flatMap((drop, i) => [ellipseNode(drop, `${i}-body`, drop.side), ...drop.satellites.map((satellite, j) => ellipseNode(satellite, `${i}-${j}`, drop.side))])}
            </g>
            {!folded ? <circle className="inkblot-pen" cx={pen.x * 100} cy={pen.y * 100} r="1.4" /> : null}
          </svg>
        </div>
        <div className="inkblot-crease" aria-hidden="true" />
        <div
          className="inkblot-pen-target"
          data-testid="inkblot-pen-target"
          tabIndex={folded ? -1 : 0}
          role="application"
          aria-label="Ink pen. Arrow keys move on the left half, Space or Enter drips."
          style={{ position: "absolute", inset: 0 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => { dragging.current = false; }}
          onPointerCancel={() => { dragging.current = false; }}
          onKeyDown={onKey}
        />
      </div>
      <div className="inkblot-controls">
        <button type="button" className="btn btn-primary" data-testid="inkblot-fold-btn" onClick={foldSheet}>
          {folded ? "Unfold & add ink" : "Fold sheet"}
        </button>
      </div>
      <form className="inkblot-form" onSubmit={onSubmit}>
        <h2 ref={observe} id="inkblot-observe" tabIndex={-1}>What do you see?</h2>
        <label htmlFor="inkblot-note">What do you see in the ink?</label>
        <textarea id="inkblot-note" name="note" maxLength={80} required rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
        <label htmlFor="inkblot-name">Initials or alias (optional)</label>
        <input id="inkblot-name" name="name" type="text" maxLength={24} value={name} onChange={(event) => setName(event.target.value)} autoComplete="nickname" />
        <input id="inkblot-website" name="website" type="text" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" className="sr-only" aria-hidden="true" />
        <p className="mt-4"><button type="submit" className="btn btn-primary" data-testid="inkblot-submit-btn">File observation</button></p>
        <p className="inkblot-status" data-testid="inkblot-status" aria-live="polite">{status}</p>
      </form>
      {reading ? (
        <article className="inkblot-reading" data-testid="inkblot-reading">
          <p className="caption">{reading.plateCode}</p>
          <h3>{reading.title}</h3>
          <p className="mt-2">{reading.observation}</p>
          <p className="mt-2">{reading.interpretation}</p>
          <p className="inkblot-disclaimer">{reading.disclaimer}</p>
        </article>
      ) : null}
      <section className="inkblot-gallery" data-testid="inkblot-gallery" aria-labelledby="inkblot-gallery-heading">
        <h2 id="inkblot-gallery-heading">Patients’ notes</h2>
        <ul className="inkblot-cards">
          {gallery.map((entry) => (
            <li key={entry.id} className="inkblot-card" data-hand={entry.hand} data-specimen={entry.specimen ? "true" : undefined} style={{ "--card-tilt": `${entry.tilt}deg` } as CSSProperties}>
              <p className="caption">{entry.pinned ? "Pinned · awaiting the doctor's initials" : entry.specimen ? "Ward specimen" : entry.name || "Anonymous"}</p>
              <p className="mt-2">{entry.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
