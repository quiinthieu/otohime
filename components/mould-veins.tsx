"use client";

import raw from "@/content/mould-graph.json";
import { startMouldLoop } from "@/components/mould-render";
import {
  boostMouldNode,
  createMouldWorld,
  parseMouldGraph,
  settleMouldWorld,
  type MouldWorld,
  type MouldWorldConfig,
} from "@/lib/mould";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import "./mould-veins.css";

const graph = parseMouldGraph(raw);

export default function MouldVeins({ variant }: { variant: "work" | "projects" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<MouldWorld | null>(null);
  const [basis, setBasis] = useState<"commits" | "throughput">("commits");
  const [reduced, setReduced] = useState(false);
  const part = variant === "work" ? graph?.workGraph : graph?.projectsGraph;
  const nodes = part?.nodes ?? [];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !part) return;
    const config: MouldWorldConfig = {
      seed: variant === "work" ? 11 : 29,
      width: 96,
      height: 54,
      agentCount: 260,
      preset: variant === "work" ? "work-pipeline" : "projects-constellation",
      weightMode: basis,
      nodes: part.nodes,
      edges: part.edges,
    };
    const world = reduced ? settleMouldWorld(config, 42) : createMouldWorld(config);
    worldRef.current = world;
    const loop = startMouldLoop(canvas, () => worldRef.current ?? world, reduced);
    return () => loop.stop();
  }, [basis, part, reduced, variant]);

  return (
    <figure
      className="mould-veins"
      data-mould-veins={variant}
      data-mould-basis={basis}
      data-node-count={nodes.length}
      data-reduced-motion={reduced ? "true" : "false"}
    >
      <figcaption>
        <span>Sumi veins</span>
        <button type="button" data-mould-basis-toggle onClick={() => setBasis((current) => (current === "commits" ? "throughput" : "commits"))}>
          Thickness: {basis === "commits" ? "commits" : "throughput"}
        </button>
      </figcaption>
      <div className="mould-veins-sheet">
        <canvas ref={canvasRef} aria-hidden="true" />
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            className="mould-node"
            data-mould-node={node.id}
            style={{ left: `${node.x * 100}%`, top: `${node.y * 100}%`, "--node": node.swatch } as CSSProperties}
            onPointerEnter={() => { if (worldRef.current) boostMouldNode(worldRef.current, node.id, 0.12); }}
            onClick={() => { if (worldRef.current) boostMouldNode(worldRef.current, node.id, 0.2); }}
          >
            {node.label}
          </button>
        ))}
      </div>
      <p>
        {graph?.weightBasis}{" "}
        <Link href="/play/mould">Open the petri dish</Link>
        {" · "}
        <Link href="/strata">Paper Strata</Link>
      </p>
    </figure>
  );
}
