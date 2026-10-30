"use client";

import { createElement, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { growBonsai, isSeason, visibleBranches, type ActivityWeek, type Branch, type Season } from "@/lib/bonsai";
import { branchPath, LEAF_COLOURS, postcardSvg } from "@/lib/bonsai-postcard";
import { inkFilter } from "@/lib/ink-modes";
import { getServerSound, getSound, playCustomCue, setSound, subscribeSound } from "@/lib/sound-client";
import "./bonsai.css";

export function Bonsai({ weeks, week, initialSeason, through, pinnedSeason }: { weeks: ActivityWeek[]; week: string; initialSeason: Season; through: string; pinnedSeason: boolean }) {
  const [cuts, setCuts] = useState<Set<string>>(new Set());
  const [season, setSeason] = useState(initialSeason);
  const [fallen, setFallen] = useState<Branch | null>(null);
  const [message, setMessage] = useState("Choose a twig to prune. The original tree is always one regrow away.");
  const sound = useSyncExternalStore(subscribeSound, getSound, getServerSound);
  const branches = useMemo(() => growBonsai(weeks, week), [weeks, week]);
  const visible = visibleBranches(branches, cuts);
  const filter = `bonsai-${useId().replace(/[^\w-]/g, "")}`;
  const tree = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (pinnedSeason) return;
    const sync = () => { const s = document.documentElement.dataset.season; if (isSeason(s)) setSeason(s); };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-season"] });
    return () => observer.disconnect();
  }, [pinnedSeason]);
  useEffect(() => {
    if (!fallen) return;
    const timer = setTimeout(() => setFallen(null), 1200);
    return () => clearTimeout(timer);
  }, [fallen]);
  const prune = (b: Branch) => {
    setCuts(old => new Set([...old, b.id]));
    setMessage(`Pruned a branch from ${b.week}. Regrow restores the tree.`);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) setFallen(b);
    playCustomCue({ db: -27, wave: "sawtooth", notes: [{ hz: 1800, at: 0, attack: 0.001, decay: 0.025 }, { hz: 650, at: 0.025, attack: 0.001, decay: 0.025 }] });
    requestAnimationFrame(() => tree.current?.querySelector<SVGGElement>('[role="button"]')?.focus());
  };
  const download = async () => {
    let url: string | undefined;
    try {
      const svg = postcardSvg(weeks, week, season, through, visible);
      url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const image = new Image(); image.src = url; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 630;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("canvas unavailable");
      ctx.drawImage(image, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("export unavailable")), "image/png"));
      const png = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = png; a.download = `ink-bonsai-${week}.png`; a.click();
      setTimeout(() => URL.revokeObjectURL(png), 1000);
      setMessage("Postcard downloaded with your current pruning.");
    } catch { setMessage("This browser could not export a postcard. Open the weekly image instead."); }
    finally { if (url) URL.revokeObjectURL(url); }
  };
  return <section className="bonsai" data-testid="bonsai" data-season={season} aria-label="Interactive ink bonsai">
    <div className="bonsai-tools">
      <label>Tree season <select value={season} onChange={e => setSeason(e.target.value as Season)}>{(["spring", "summer", "autumn", "winter"] as const).map(s => <option key={s}>{s}</option>)}</select></label>
      <button className="btn" onClick={() => { setCuts(new Set()); setFallen(null); setMessage("The original tree has regrown."); }}>Regrow</button>
      <button className="btn" aria-pressed={sound} onClick={() => setSound(!sound)}>Snip sound: {sound ? "on" : "off"}</button>
    </div>
    <svg ref={tree} viewBox="0 70 620 440" className="bonsai-tree" aria-label={`Ink bonsai for ${week}, ${season}`} role="group">
      <defs><filter id={filter} x="-10%" y="-10%" width="120%" height="120%">{inkFilter("ink", 7, 1.5).map((p, i) => p.tag === "feMerge" ? <feMerge key={i}>{p.nodes.map(n => <feMergeNode key={n} in={n}/>)}</feMerge> : createElement(p.tag, { key: i, ...p.attrs }))}</filter></defs>
      <ellipse cx="315" cy="480" rx="110" ry="7" fill="currentColor" opacity=".07"/>
      <g filter={`url(#${filter})`} stroke="currentColor" strokeLinecap="round" fill="none">{visible.map(b => <path key={b.id} data-branch={b.id} d={branchPath(b)} strokeWidth={b.width}/>)}</g>
      <g className="bonsai-foliage" fill={LEAF_COLOURS[season]}>{visible.filter(b => b.leaf).map(b => season === "winter" ? <path key={b.id} d={`M${b.x2 - 4} ${b.y2 - 2}h8`} stroke={LEAF_COLOURS.winter} strokeWidth="3"/> : <ellipse key={b.id} cx={b.x2} cy={b.y2} rx={season === "spring" ? 3.5 : 5} ry="3"/>)}</g>
      <path d="M250 440h135l-15 30H265z" fill="#bc6954" stroke="currentColor" strokeWidth="3"/>
      <path d="M246 439h144" stroke="currentColor" strokeWidth="5"/>
      {visible.filter(b => !b.id.startsWith("trunk-") && b.id.endsWith("-0")).map(b => <g key={b.id} role="button" tabIndex={0} aria-label={`Prune branch from ${b.week}`} className="bonsai-target" onClick={() => prune(b)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); prune(b); } }}><circle cx={b.x2} cy={b.y2} r="13" fill="transparent"/><circle className="bonsai-focus" cx={b.x2} cy={b.y2} r="12" fill="none" stroke="currentColor" strokeDasharray="2 3"/></g>)}
      {fallen && <ellipse key={fallen.id} className="bonsai-falling" cx={fallen.x2} cy={fallen.y2} rx="5" ry="3" fill="currentColor"/>}
    </svg>
    <p className="caption bonsai-stamp">盆栽 · {week} · {weeks.find(w => w.week === week)?.count ?? 0} public contributions</p>
    <p role="status" className="text-muted mt-3">{message}</p>
    <div className="bonsai-tools mt-5"><button className="btn" onClick={download}>Download postcard PNG</button><a className="link" href={`/og/bonsai?week=${week}&season=${season}`} target="_blank" rel="noreferrer">Weekly image ↗</a><a className="link" href={`/play/bonsai?week=${week}&season=${season}`}>Link to this week ↗</a></div>
  </section>;
}
