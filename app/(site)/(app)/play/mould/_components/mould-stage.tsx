"use client";

import raw from "@/content/mould-graph.json";
import { startMouldLoop } from "@/components/mould-render";
import {
  createMouldWorld,
  dropMouldFood,
  parseMouldGraph,
  petriDish,
  repelMouldAt,
  settleMouldWorld,
  type MouldPresetId,
  type MouldWorld,
  type MouldWorldConfig,
} from "@/lib/mould";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const graph = parseMouldGraph(raw);
const PRESETS: { id: MouldPresetId; label: string }[] = [
  { id: "work-pipeline", label: "Work pipeline" },
  { id: "projects-constellation", label: "Projects" },
  { id: "petri-ring", label: "Petri ring" },
];

function configFor(preset: MouldPresetId, mode: "commits" | "throughput"): MouldWorldConfig {
  const base: MouldWorldConfig = {
    seed: preset === "projects-constellation" ? 29 : preset === "petri-ring" ? 5 : 11,
    width: 112,
    height: 64,
    agentCount: 380,
    preset,
    weightMode: mode,
  };
  if (preset === "petri-ring" || !graph) {
    const ring = petriDish(mode);
    return { ...base, nodes: ring.nodes, edges: ring.edges };
  }
  const part = preset === "work-pipeline" ? graph.workGraph : graph.projectsGraph;
  return { ...base, nodes: part.nodes, edges: part.edges };
}

function makeWorld(preset: MouldPresetId, mode: "commits" | "throughput", reduced: boolean) {
  const config = configFor(preset, mode);
  return reduced ? settleMouldWorld(config, 48) : createMouldWorld(config);
}

export default function MouldStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<MouldWorld | null>(null);
  const [preset, setPreset] = useState<MouldPresetId>("work-pipeline");
  const [mode, setMode] = useState<"commits" | "throughput">("commits");
  const [tool, setTool] = useState<"food" | "repel">("food");
  const [reduced, setReduced] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [kind, setKind] = useState<"webgl2" | "canvas2d">("canvas2d");
  const [extra, setExtra] = useState({ key: "", n: 0 });
  const drag = useRef({ x: 0, y: 0, moved: false, down: false });
  const dishKey = `${preset}|${mode}|${reduced}|${epoch}`;
  const pins = configFor(preset, mode).nodes ?? [];
  const foodCount = pins.length + (extra.key === dishKey ? extra.n : 0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const world = makeWorld(preset, mode, reduced);
    worldRef.current = world;
    const loop = startMouldLoop(canvas, () => worldRef.current ?? world, reduced);
    setKind(loop.kind);
    return () => loop.stop();
  }, [preset, mode, reduced, epoch]);

  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  return (
    <div className="mould-toy">
      <div className="mould-controls">
        <div role="group" aria-label="Preset">
          {PRESETS.map((item) => (
            <button key={item.id} type="button" aria-pressed={preset === item.id} onClick={() => setPreset(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Tool">
          <button type="button" aria-pressed={tool === "food"} onClick={() => setTool("food")}>Food</button>
          <button type="button" aria-pressed={tool === "repel"} onClick={() => setTool("repel")}>Repel</button>
        </div>
        <div role="group" aria-label="Vein weight">
          <button type="button" aria-pressed={mode === "commits"} onClick={() => setMode("commits")}>Commits</button>
          <button type="button" aria-pressed={mode === "throughput"} onClick={() => setMode("throughput")}>Throughput</button>
        </div>
        <button type="button" data-mould-reset onClick={() => setEpoch((n) => n + 1)}>Reset dish</button>
      </div>
      <div className="mould-dish">
        <canvas
          ref={canvasRef}
          className="mould-canvas"
          data-mould-canvas
          data-reduced-motion={reduced ? "true" : "false"}
          data-renderer={kind}
          data-food-count={foodCount}
          data-preset={preset}
          data-mould-tool={tool}
          data-mould-basis={mode}
          aria-label="Sumi-ink slime mould. Click to drop food, or repel to wipe a vein."
          onPointerDown={(event) => {
            const at = point(event);
            drag.current = { ...at, moved: false, down: true };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag.current.down || !worldRef.current) return;
            const at = point(event);
            if (Math.hypot(at.x - drag.current.x, at.y - drag.current.y) > 0.015) drag.current.moved = true;
            if (tool === "repel") repelMouldAt(worldRef.current, at.x, at.y);
          }}
          onPointerUp={(event) => {
            if (!worldRef.current) return;
            const at = point(event);
            if (tool === "food" && !drag.current.moved) {
              dropMouldFood(worldRef.current, at.x, at.y);
              setExtra((current) => ({ key: dishKey, n: (current.key === dishKey ? current.n : 0) + 1 }));
            } else if (tool === "repel") repelMouldAt(worldRef.current, at.x, at.y);
            drag.current.down = false;
          }}
        />
        <div className="mould-pins" aria-hidden="true">
          {pins.map((node) => (
            <span key={node.id} className="mould-pin" style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%` }}>
              {node.label}
            </span>
          ))}
        </div>
      </div>
      <p className="mould-note">
        {graph?.weightBasis} Thickness follows {mode === "commits" ? "repository commit counts" : "illustrative throughput"}.
      </p>
    </div>
  );
}
