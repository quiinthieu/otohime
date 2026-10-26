"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { risoCharacters, risoPlateCount, type RisoHeadingProps, type RisoTextProps } from "@/lib/riso-heading";
import "./riso-heading.css";

// One observer for all mounted headings, disconnected when its final subscriber leaves.
const mounted = new Set<HTMLElement>();
let observer: IntersectionObserver | null = null;
let staticMedia: MediaQueryList | null = null;
function settleAll() {
  for (const el of mounted) { el.dataset.risoState = "settled"; observer?.unobserve(el); }
}
function onStaticChange() { if (staticMedia?.matches) settleAll(); }
const STATIC = "(prefers-reduced-motion: reduce), (forced-colors: active)";
function observe(el: HTMLElement) {
  if (!mounted.size) {
    staticMedia = matchMedia(STATIC);
    staticMedia.addEventListener("change", onStaticChange);
    window.addEventListener("beforeprint", settleAll);
  }
  mounted.add(el);
  if (staticMedia?.matches || !("IntersectionObserver" in window)) {
    el.dataset.risoState = "settled";
  } else {
    observer ??= new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        const heading = entry.target as HTMLElement;
        if (!mounted.has(heading) || heading.dataset.risoState !== "ready") continue;
        // No animation class in server HTML. A heading remains visible before hydration/observation.
        heading.dataset.risoState = "printed";
        observer?.unobserve(heading);
      }
    });
    if (!el.dataset.risoState) {
      el.dataset.risoState = "ready";
      observer.observe(el);
    }
  }
  return () => {
    mounted.delete(el);
    observer?.unobserve(el);
    if (!mounted.size) {
      observer?.disconnect(); observer = null;
      staticMedia?.removeEventListener("change", onStaticChange); staticMedia = null;
      window.removeEventListener("beforeprint", settleAll);
    }
  };
}

export function RisoText({ children, className = "", sourceClassName = "", plates }: RisoTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !children) return;
    return observe(el);
  }, [children]);
  const chars = risoCharacters(children);
  // Whitespace remains text, preserving normal word wrapping and exact clipboard whitespace.
  const words: (string | typeof chars)[] = [];
  for (const char of chars) {
    if (/^\s+$/u.test(char.text)) words.push(char.text);
    else {
      const word = words.at(-1);
      if (Array.isArray(word)) word.push(char);
      else words.push([char]);
    }
  }
  return (
    <span ref={ref} className={`riso-text ${className}`} style={plates === undefined ? undefined : { "--ap-plate-count": risoPlateCount(plates) } as CSSProperties}>
      {/* One uninterrupted heading name, also the Range-measurable StampBoard source. */}
      <span className={`riso-source ${sourceClassName}`}>{children}</span>
      <span className="riso-visual" aria-hidden="true">
        {words.map((word, i) => typeof word === "string" ? word : (
          <span className="riso-word" key={i}>{word.map(char => (
            <span className="riso-char" data-char={char.text} key={char.index} style={{
              "--riso-x2": `${char.offsets[0][0]}px`, "--riso-y2": `${char.offsets[0][1]}px`,
              "--riso-x3": `${char.offsets[1][0]}px`, "--riso-y3": `${char.offsets[1][1]}px`,
              "--riso-delay": `${char.delay}ms`,
            } as CSSProperties}><span className="riso-anchor">{char.text}</span></span>
          ))}</span>
        ))}
      </span>
    </span>
  );
}

/** Owns exactly one semantic heading. Use RisoText inside an existing h1/h2. */
export function RisoHeading({ as: Heading = "h2", id, className, ...text }: RisoHeadingProps) {
  return <Heading id={id} className={className}><RisoText {...text} /></Heading>;
}
