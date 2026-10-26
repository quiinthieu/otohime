"use client";

import { useEffect, useId, useState } from "react";
import { ageAt, ageWord, opening, paperAt, stamp, valueText, type Replay } from "../_lib/tamatebako";

const REDUCED = "(prefers-reduced-motion: reduce)";

// Otohime's lacquered Tamatebako. Opened, it lets out a brief puff of smoke (none under reduced motion) and shows a
// scrubber over the site's real changelog: each position is one commit's date and subject on a leaf of paper that
// yellows the further back it goes (../_lib/tamatebako.ts). The scrubber is a native range input, so arrows,
// Home/End, Page Up/Down, a drag and a touch all work, and a screen reader hears each commit as the value.
export function Tamatebako({ replay }: { replay: Replay }) {
  const { leaves, total } = replay;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [smoke, setSmoke] = useState(0);
  const [position, setPosition] = useState(Math.max(leaves.length - 1, 0));

  useEffect(() => {
    if (!smoke) return;
    const t = setTimeout(() => setSmoke(0), opening(false).ms);
    return () => clearTimeout(t);
  }, [smoke]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      setSmoke(0);
      return;
    }
    setOpen(true);
    if (opening(matchMedia(REDUCED).matches).smoke) setSmoke((n) => n + 1);
  };

  const leaf = leaves[position];
  const age = ageAt(position, leaves.length);
  const shown = leaves.length < total ? `the newest ${leaves.length} of its ${total} commits` : `all ${leaves.length} of its commits`;

  return (
    <section className="tamatebako" aria-labelledby={`${id}-title`} data-open={open ? "" : undefined}>
      <h2 id={`${id}-title`} className="box-title">
        The Tamatebako
      </h2>
      <button type="button" className="box" aria-expanded={open} aria-controls={`${id}-replay`} onClick={toggle}>
        <svg className="box-art" viewBox="0 0 120 96" aria-hidden="true">
          <g className="box-lid">
            <path d="M10 30H110V42H10Z" />
            <path className="box-gold" d="M10 36H110M60 30V42" />
          </g>
          <path d="M14 42H106V88H14Z" />
          <path className="box-gold" d="M14 62H106M60 42V88M50 62Q60 52 70 62Q60 72 50 62Z" />
        </svg>
        <span>{open ? "Close the Tamatebako" : "Open the Tamatebako"}</span>
      </button>
      {smoke ? (
        <span key={smoke} className="smoke" data-smoke="" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      ) : null}
      <div id={`${id}-replay`} className="replay" hidden={!open}>
        <p className="replay-note">
          <strong>A changelog replay.</strong> Each position is a real commit to otohime.dev, {shown}, with its own
          date and subject. The site itself is not rebuilt as it was: only the paper ages.
        </p>
        {leaf ? (
          <>
            <label className="scrub-label" htmlFor={`${id}-scrubber`}>
              Scrub back through the changelog
            </label>
            <input
              id={`${id}-scrubber`}
              className="scrubber"
              type="range"
              min={0}
              max={leaves.length - 1}
              step={1}
              value={position}
              aria-valuetext={valueText(leaves, position)}
              onChange={(e) => setPosition(Number(e.target.value))}
            />
            <div className="scrub-ends" aria-hidden="true">
              <span>{stamp(leaves[0].date)}</span>
              <span>{stamp(leaves[leaves.length - 1].date)}</span>
            </div>
            <article className="leaf" data-age={age.toFixed(3)} style={paperAt(age) as React.CSSProperties}>
              <p className="leaf-head">
                <span>Changelog replay</span>
                <span>
                  {position + 1} / {leaves.length} · {ageWord(age)}
                </span>
              </p>
              <p className="leaf-date">
                <time dateTime={leaf.date}>{stamp(leaf.date)}</time>
              </p>
              <p className="leaf-subject">{leaf.subject}</p>
              <p className="leaf-meta">
                <code>{leaf.sha}</code>
                {leaf.plan ? ` · ${leaf.plan}${leaf.task ? `/${leaf.task}` : ""}` : ""}
                {` · ${leaf.files} ${leaf.files === 1 ? "file" : "files"}`}
                {leaf.areas.length ? ` in ${leaf.areas.join(", ")}` : ""}
              </p>
            </article>
          </>
        ) : (
          <p className="leaf leaf-empty" style={paperAt(0) as React.CSSProperties}>
            The box is empty: this build carries no changelog to replay.
          </p>
        )}
      </div>
    </section>
  );
}
