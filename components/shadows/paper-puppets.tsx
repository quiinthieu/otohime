"use client";
import { useRef, useState } from "react";
import { CREATURES, type Creature } from "@/lib/shadow-poses";
import { CreatureArt, DESTINATIONS } from "./creatures";
const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, value));
export function PaperPuppets() {
  const [positions, setPositions] = useState<Record<Creature, { x: number; y: number }>>({ rabbit: { x: 17, y: 55 }, dog: { x: 39, y: 55 }, bird: { x: 61, y: 55 }, deer: { x: 83, y: 55 } });
  const drag = useRef<{ creature: Creature; x: number; y: number; startX: number; startY: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const move = (creature: Creature, x: number, y: number) => setPositions(old => ({ ...old, [creature]: { x: clamp(x, 13, 87), y: clamp(y, 27, 73) } }));
  return <div ref={stage} className="paper-puppets" data-testid="paper-puppets" aria-label="Draggable paper puppets">{CREATURES.map(creature => <div key={creature} className="paper-puppet" style={{ left: `${positions[creature].x}%`, top: `${positions[creature].y}%` }}>
    <button className="puppet-handle" aria-label={`Move ${creature} puppet`} aria-describedby="puppet-instructions" onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { creature, x: positions[creature].x, y: positions[creature].y, startX: e.clientX, startY: e.clientY }; }} onPointerMove={e => { const d = drag.current, rect = stage.current?.getBoundingClientRect(); if (!d || d.creature !== creature || !rect) return; move(creature, d.x + (e.clientX - d.startX) / rect.width * 100, d.y + (e.clientY - d.startY) / rect.height * 100); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={e => { const keys: Record<string, [number, number]> = { ArrowLeft: [-3, 0], ArrowRight: [3, 0], ArrowUp: [0, -3], ArrowDown: [0, 3] }; const delta = keys[e.key]; if (delta) { e.preventDefault(); move(creature, positions[creature].x + delta[0], positions[creature].y + delta[1]); } }}><CreatureArt creature={creature}/><span className="puppet-name">{creature}</span></button>
    <a className="puppet-tag" href={DESTINATIONS[creature].href}>{DESTINATIONS[creature].label} ↗</a>
  </div>)}</div>;
}
