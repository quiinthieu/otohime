"use client";

import Link from "next/link";
import { useRef, type PointerEvent, type KeyboardEvent } from "react";
import type { SkyChart } from "../_lib/sky";
import "./sky.css";

export function PaperSky({ chart }: { chart: SkyChart }) {
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const stars = new Map(chart.stars.map(star => [star.slug, star]));
  function recenter() {
    const el = viewport.current;
    if (el) el.scrollTo({ left: (el.scrollWidth - el.clientWidth) / 2, top: (el.scrollHeight - el.clientHeight) / 2, behavior: "instant" });
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, moved: false };
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const held = drag.current;
    if (!held || held.id !== event.pointerId) return;
    const dx = event.clientX - held.x, dy = event.clientY - held.y;
    if (!held.moved && Math.hypot(dx, dy) < 6) return;
    held.moved = true;
    suppressClick.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.scrollLeft = held.left - dx;
    event.currentTarget.scrollTop = held.top - dy;
    event.currentTarget.dataset.dragging = "true";
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    event.currentTarget.dataset.dragging = "false";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] };
    const delta = directions[event.key];
    if (delta) { event.preventDefault(); event.currentTarget.scrollBy({ left: delta[0], top: delta[1], behavior: "instant" }); }
    if (event.key === "Home") { event.preventDefault(); recenter(); }
  }
  return (
    <section className="sky-chart" aria-label="Notes star chart" data-testid="paper-sky">
      <div className="sky-toolbar">
        <span className="caption">Atlas 04 · {chart.stars.length} ink stars</span>
        <button type="button" className="chip" onClick={recenter}>Recenter chart</button>
      </div>
      <p id="sky-instructions" className="sky-instructions">Drag to explore. Tab to a star, then Enter to read. Arrow keys pan the focused chart.</p>
      <div ref={viewport} className="sky-viewport" tabIndex={0} role="region" aria-label="Pannable celestial chart" aria-describedby="sky-instructions"
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        onLostPointerCapture={event => { if (event.target === event.currentTarget) end(event); }}
        onKeyDown={keyboard} onDragStart={event => event.preventDefault()}
        onClickCapture={event => { if (suppressClick.current && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
        <div className="sky-sheet" style={{ width: chart.width, height: chart.height }}>
          <svg width={chart.width} height={chart.height} viewBox={`0 0 ${chart.width} ${chart.height}`} aria-hidden="true" className="sky-grid">
            <rect x="16" y="16" width={chart.width - 32} height={chart.height - 32} fill="none" />
            {[110, 210, 300].map(r => <circle key={r} cx={chart.width / 2} cy={chart.height / 2} r={r} fill="none" strokeDasharray={r === 210 ? "2 8" : undefined} />)}
            <path d={`M${chart.width / 2} 22V${chart.height - 22}M22 ${chart.height / 2}H${chart.width - 22}`} strokeDasharray="3 9" />
            <text x="35" y="47">THE MARGIN OBSERVATORY</text>
            <text x={chart.width - 40} y="47" textAnchor="end">N ↑</text>
            <text x="35" y={chart.height - 35}>NOT TO SCALE · IDEAS, NOT DISTANCES</text>
          </svg>
          <svg width={chart.width} height={chart.height} aria-hidden="true" className="sky-lines">
            {chart.edges.map(edge => { const a = stars.get(edge.from)!, b = stars.get(edge.to)!; return <line key={`${edge.tag}-${edge.from}-${edge.to}`} data-sky-edge={edge.tag} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />; })}
            {chart.constellations.map(group => { const members = group.slugs.map(slug => stars.get(slug)!); return <text key={group.tag} x={members.reduce((sum, star) => sum + star.x, 0) / members.length} y={members.reduce((sum, star) => sum + star.y, 0) / members.length - 28} textAnchor="middle">{group.name}</text>; })}
          </svg>
          {chart.stars.map(star => (
            <Link key={star.slug} href={`/notes/${star.slug}`} className="sky-star" style={{ left: star.x, top: star.y }} aria-label={star.title} data-sky-star={star.slug} draggable={false}>
              <svg width="48" height="48" viewBox="-24 -24 48 48" aria-hidden="true" style={{ opacity: star.brightness }}>
                <path d={`M0 ${-star.radius}L${star.radius * .28} -3L${star.radius} 1L3 4L0 ${star.radius}L-3 3L${-star.radius} -1L-3 -4Z`} fill="currentColor" />
                <path d={`M-18 -15l4 3m29 28l3 2M16 -16l-3 3`} fill="none" stroke="currentColor" />
              </svg>
              <span className="sky-label">{star.title}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="sky-legend">
        <p>Larger star: longer note. Darker ink: newer thought.</p>
        {chart.constellations.map(group => <p key={group.tag}><strong>{group.name}</strong> · #{group.tag}</p>)}
        {chart.stars.length === 0 && <p>No notes in the sky yet.</p>}
        <Link href="/notes" className="link">Read all notes as a list →</Link>
      </div>
    </section>
  );
}
