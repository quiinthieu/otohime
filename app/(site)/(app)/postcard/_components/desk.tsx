"use client";

import {
  cleanNote,
  encodePostcard,
  isSketchId,
  NOTE_MAX,
  noteLength,
  POSTCARD_SKETCHES,
  postcardFilename,
  postcardPaths,
  type Postcard,
  type SketchId,
} from "@/lib/postcard";
import { useSearchParams } from "next/navigation";
import { useId, useState, type ReactNode } from "react";

type Stamped = { postcard: Postcard; code: string };
// Each sheet's thumbnail, drawn by the server page with next/image: the desk itself never imports it, so the
// chunks it shares with / and /play stay byte for byte the same.
type Thumbs = Record<SketchId, ReactNode>;

// The picker with the sketch ?s= names already chosen, so a sheet's "send as a postcard" lands on it.
export function DeskFromQuery({ thumbs }: { thumbs: Thumbs }) {
  const asked = useSearchParams().get("s");
  return <Desk thumbs={thumbs} initial={isSketchId(asked) ? asked : undefined} />;
}

// Pick a sketch, write up to NOTE_MAX characters, stamp it: the postcard is its link (lib/postcard.ts), so
// stamping only encodes. Then download the PNG, share the link, or copy it where sharing is not offered.
export function Desk({ thumbs, initial }: { thumbs: Thumbs; initial?: SketchId }) {
  const id = useId();
  const [sketch, setSketch] = useState<SketchId>(initial ?? POSTCARD_SKETCHES[0].id);
  const [note, setNote] = useState("");
  const [stamped, setStamped] = useState<Stamped | null>(null);
  const [status, setStatus] = useState("");
  const [manual, setManual] = useState(false);
  const left = NOTE_MAX - noteLength(note);

  const change = () => {
    setStamped(null);
    setStatus("");
    setManual(false);
  };

  const stamp = (event: React.FormEvent) => {
    event.preventDefault();
    const postcard: Postcard = { sketch, note: cleanNote(note), ts: Date.now() };
    setStamped({ postcard, code: encodePostcard(postcard) });
    setStatus("Stamped. Download it, or send the link.");
    setManual(false);
  };

  const url = stamped ? new URL(postcardPaths(stamped.code).view, window.location.origin).toString() : "";

  const share = async () => {
    if (!stamped) return;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "A postcard from otohime.dev", text: stamped.postcard.note || undefined, url });
        setStatus("Sent.");
        return;
      } catch (error) {
        // The visitor closed the sheet: nothing to say. Anything else falls through to copying.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied.");
    } catch {
      setManual(true);
      setStatus("Copy the link below.");
    }
  };

  return (
    <form onSubmit={stamp} className="mt-8 grid gap-8">
      <fieldset>
        <legend className="caption">Pick a sketch</legend>
        <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {POSTCARD_SKETCHES.map((s) => (
            <li key={s.id}>
              <label className="block cursor-pointer rounded-[10px] border border-line p-1 has-checked:border-ink has-checked:bg-paper-2 has-focus-visible:outline-2 has-focus-visible:outline-ink">
                <input
                  type="radio"
                  name="sketch"
                  value={s.id}
                  checked={sketch === s.id}
                  onChange={() => {
                    setSketch(s.id);
                    change();
                  }}
                  className="sr-only"
                />
                {thumbs[s.id]}
                <span className="mt-1 block text-center text-xs">{s.title}</span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>
      <div>
        <label htmlFor={`${id}-note`} className="label">
          A short note
        </label>
        <textarea
          id={`${id}-note`}
          name="note"
          rows={3}
          value={note}
          onChange={(event) => {
            const chars = Array.from(event.target.value);
            setNote(chars.length > NOTE_MAX * 2 ? chars.slice(0, NOTE_MAX * 2).join("") : event.target.value);
            change();
          }}
          aria-describedby={`${id}-left`}
          aria-invalid={left < 0 ? true : undefined}
          placeholder="Wish you were here."
          className="field"
        />
        <p id={`${id}-left`} className={left < 0 ? "field-error" : "hint"} aria-live="polite">
          {left < 0 ? `${-left} over; the postcard keeps the first ${NOTE_MAX}.` : `${left} of ${NOTE_MAX} left`}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary">
          Stamp it
        </button>
        <p role="status" className="text-muted">
          {status}
        </p>
      </div>
      {stamped ? (
        <section aria-labelledby={`${id}-ready`} className="grid gap-3">
          <h2 id={`${id}-ready`} className="caption">
            Your postcard
          </h2>
          <a href={postcardPaths(stamped.code).view} className="block max-w-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- the route's PNG is already its final size */}
            <img
              src={postcardPaths(stamped.code).image}
              alt={`A postcard of the ${POSTCARD_SKETCHES.find((s) => s.id === stamped.postcard.sketch)?.title} sketch`}
              width={1200}
              height={630}
              className="h-auto w-full border border-ink"
            />
          </a>
          <div className="flex flex-wrap gap-3">
            <a href={postcardPaths(stamped.code).image} download={postcardFilename(stamped.postcard)} className="btn">
              Download PNG
            </a>
            <button type="button" className="btn" onClick={share}>
              Share link
            </button>
            <a href={postcardPaths(stamped.code).view} className="btn btn-ghost">
              Open it
            </a>
          </div>
          {manual ? (
            <input
              aria-label="Postcard link"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="field max-w-2xl"
              autoFocus
            />
          ) : null}
        </section>
      ) : null}
    </form>
  );
}
