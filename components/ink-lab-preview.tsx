"use client";

import { createElement, memo, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { inkFilter, MATERIALS, SEEDS } from "@/lib/ink-modes";
import { encodeLab, type LabSnapshot } from "@/lib/ink-lab";
import { HOUSE_COLORS, PRINT_RUNS } from "@/lib/print-runs";
import { RisoHeading } from "./riso-heading";

/** Real site primitives on a bounded sheet. No global adapter tags or document CSS writes. */
// Draft controls commit synchronously; redraw this sheet only for the coalesced snapshot.
export const InkLabPreview = memo(function InkLabPreview({ snapshot }: { snapshot: LabSnapshot }) {
  const id = `lab-${useId().replace(/:/g, "")}`;
  const ref = useRef<HTMLElement>(null);
  const updates = useRef(0);
  const [proof, setProof] = useState(0);
  const s = snapshot.settings;
  const preset = PRINT_RUNS[snapshot.printRun];
  const scheme = preset.colorScheme === "dark" ? "dark" : "light";
  const colors = preset.colors?.[scheme] ?? HOUSE_COLORS[scheme];
  const material = MATERIALS[s.hand];
  const primitives = inkFilter(s.hand, 0, s.displacement / material.warp.scale);
  const style = {
    "--paper": colors.paper, "--paper-2": colors.paper2, "--field": colors.field,
    "--ink": colors.ink, "--muted": colors.muted, "--line": colors.hairline,
    "--ap-plate-1": s.plates[0], "--ap-plate-2": s.plates[1], "--ap-plate-3": s.plates[2],
    "--ap-plate-count": s.plateCount, "--ap-transition": `${s.transitionMs}ms`,
    "--lab-grain": s.grain, "--lab-speck": `var(--ap-speck-${scheme})`, "--lab-tone": scheme === "dark" ? "#000" : "#fff", "--lab-filter": `url(#${id}-ink)`, colorScheme: scheme,
  } as CSSProperties;

  useLayoutEffect(() => {
    if (ref.current) ref.current.dataset.filterUpdates = String(++updates.current);
  }, [snapshot]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false, frame = 0, start = -1, last = 0;
    const seeds = [...el.querySelectorAll<SVGElement>("[data-lab-seed]")];
    const writeSeed = (offset: number) => {
      if (offset === last) return;
      last = offset;
      for (const node of seeds) node.setAttribute("seed", String(Number(node.dataset.labSeed) + offset));
      el.dataset.seedUpdates = String(Number(el.dataset.seedUpdates ?? 0) + 1);
    };
    const tick = (now: number) => {
      if (start < 0) start = now;
      writeSeed(Math.floor((now - start) * s.wobble / 1000) % SEEDS);
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      const speed = visible && !document.hidden && !reduced.matches ? s.wobble : 0;
      el.dataset.effectiveSpeed = String(speed);
      if (speed > 0 && !frame) { start = -1; frame = requestAnimationFrame(tick); }
      if (speed === 0) { cancelAnimationFrame(frame); frame = 0; writeSeed(0); }
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
    observer.observe(el);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    sync();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    };
  }, [s]);

  return <section ref={ref} className="lab-preview" aria-label="Live proof sheet" style={style}
    data-query={encodeLab(snapshot)} data-halftone={s.halftone} data-hand={s.hand}>
    <svg className="lab-defs" aria-hidden="true" width="0" height="0">
      <defs>
        <filter id={`${id}-ink`} x="-12%" y="-20%" width="124%" height="140%" colorInterpolationFilters="sRGB">
          {primitives.map((p, i) => p.tag === "feMerge"
            ? <feMerge key={i}>{p.nodes.map(node => <feMergeNode key={node} in={node} />)}</feMerge>
            : createElement(p.tag, {
              key: i, ...p.attrs,
              ...(p.tag === "feTurbulence" && p.attrs.result === "warp" ? { baseFrequency: s.turbulence } : {}),
              ...(p.tag === "feTurbulence" ? { "data-lab-seed": p.attrs.seed } : {}),
            }))}
        </filter>
      </defs>
    </svg>
    <div className="lab-paper-grain" aria-hidden="true" />
    <div className="lab-proof-content">
      <p className="caption">Otohime / live material proof</p>
      <RisoHeading key={proof} className="lab-proof-heading">Good things leave an impression.</RisoHeading>
      <article className="card lab-proof-card">
        <svg viewBox="0 0 220 72" className="lab-linework" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={material.stroke} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 46 Q24 24 36 46 T84 46 T132 46 T180 46 T208 46 M12 59 Q24 37 36 59 T84 59 T132 59 T180 59 T208 59" />
          <path d="M89 30 L102 10 L123 11 L138 31 Z M96 31 L96 47 M130 31 L130 47" />
        </svg>
        <h3>A note from the shore</h3>
        <p>The same card, ink and letterpress keys you meet around the site. The readable type keeps its preset’s ink; the three swatches are decorative plates.</p>
        <div className="lab-swatches" aria-label="Decorative plate samples">{s.plates.map((color, i) => <span key={i} style={{ background: color }} title={`Plate ${i + 1}: ${color}`} />)}</div>
        <button type="button" className="btn btn-primary" onClick={() => setProof(value => value + 1)}>{proof ? "Press another proof" : "Press a proof"}</button>
      </article>
      <p className="lab-proof-note">Preview only · {preset.label} · {s.hand}</p>
    </div>
  </section>;
});
