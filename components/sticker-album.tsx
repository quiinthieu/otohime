"use client";

import { useRef, useState } from "react";
import { STICKERS, stickerById } from "@/content/stickers";
import { placeSticker, type Placement } from "@/lib/gashapon";
import { updateCollection, useCollection } from "@/lib/sticker-store";
import { albumCanvas, keepPng } from "@/lib/ink-export";
import { InkSticker } from "./ink-sticker";
import { HoloFoil } from "./holo-foil";
import "./ink-toys.css";

export function StickerAlbum() {
  const { collection: s, durable } = useCollection();
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const page = useRef<HTMLDivElement>(null);
  const drag = useRef<{ copy: string; pointer: number; dx: number; dy: number } | null>(null);
  const active = s.album.find(p => p.copy === selected);
  const modify = (p: Placement) => updateCollection(state => placeSticker(state, p));
  async function save(share: boolean) { try { setMessage(await keepPng(albumCanvas(s.album), "otohime-sticker-book.png", share)); } catch (e) { setMessage((e as Error).message); } }
  return <div className="ink-toy">
    <p className="toy-note">Choose a collected sticker to place it. Drag it on the page, or focus it and use the arrow keys. R rotates; Delete returns it to the shelf. Copies are yours to keep.</p>
    {!durable && <p role="status">Storage is unavailable. This album will last until you leave.</p>}
    <div className="album-page" ref={page} data-testid="album-page">
      <span className="album-title">MY LITTLE INK COLLECTION</span>
      {s.album.map(p => { const sticker = stickerById(p.id)!; return <button type="button" key={p.copy}
        className={`album-sticker ${selected === p.copy ? "selected" : ""} ${sticker.rarity === "secret" ? "secret-sticker" : ""}`}
        style={{ left: `${8.33 + p.x * 83.34}%`, top: `${18.89 + p.y * 61.11}%`, transform: `translate(-50%, -50%) rotate(${p.rotation}deg)` }}
        aria-label={`${sticker.name}, copy ${Number(p.copy.split(":").at(-1)) + 1}, ${Math.round(p.x * 100)} percent across, ${Math.round(p.y * 100)} percent down`}
        onFocus={() => setSelected(p.copy)} onClick={() => setSelected(p.copy)}
        onPointerDown={e => { const b = page.current!.getBoundingClientRect(); e.currentTarget.setPointerCapture(e.pointerId); setSelected(p.copy); drag.current = { copy: p.copy, pointer: e.pointerId, dx: e.clientX - b.left - b.width * (.0833 + p.x * .8334), dy: e.clientY - b.top - b.height * (.1889 + p.y * .6111) }; }}
        onPointerMove={e => { const d = drag.current; if (!d || d.copy !== p.copy || d.pointer !== e.pointerId) return; const b = page.current!.getBoundingClientRect(); modify({ ...p, x: ((e.clientX - b.left - d.dx) / b.width - .0833) / .8334, y: ((e.clientY - b.top - d.dy) / b.height - .1889) / .6111 }); }}
        onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}
        onKeyDown={e => {
          const step = e.shiftKey ? .1 : .02;
          if (e.key.startsWith("Arrow")) { e.preventDefault(); modify({ ...p, x: p.x + (e.key === "ArrowRight" ? step : e.key === "ArrowLeft" ? -step : 0), y: p.y + (e.key === "ArrowDown" ? step : e.key === "ArrowUp" ? -step : 0) }); }
          if (e.key.toLowerCase() === "r") modify({ ...p, rotation: p.rotation >= 165 ? -180 : p.rotation + 15 });
          if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); updateCollection(state => ({ ...state, album: state.album.filter(a => a.copy !== p.copy) })); }
        }}><InkSticker sticker={sticker} />{sticker.rarity === "secret" && <HoloFoil />}</button>; })}
      <span className="album-footer">otohime.dev · gathered along the way</span>
    </div>
    <div className="toy-toolbar">
      <button type="button" className="btn" onClick={() => save(false)}>Save album PNG</button><button type="button" className="btn" onClick={() => save(true)}>Share album image</button>
      {active && <><button type="button" className="btn" onClick={() => modify({ ...active, rotation: active.rotation >= 165 ? -180 : active.rotation + 15 })}>Rotate selected</button><button type="button" className="btn" onClick={() => updateCollection(state => ({ ...state, album: state.album.filter(a => a.copy !== active.copy) }))}>Return selected to shelf</button></>}
    </div>
    <p role="status">{message}</p>
    <h2 className="toy-subtitle">Your sticker shelf</h2>
    {!Object.values(s.owned).some(Boolean) && <p>There’s room for your first find. Turn the machine or explore the site.</p>}
    <ul className="sticker-shelf">{STICKERS.filter(x => s.owned[x.id]).map(sticker => {
      const used = new Set(s.album.filter(p => p.id === sticker.id).map(p => p.copy));
      let copy = 0; while (used.has(`${sticker.id}:${copy}`)) copy++;
      const available = s.owned[sticker.id] - used.size;
      return <li key={sticker.id}><button type="button" disabled={!available || s.album.length >= 160} onClick={() => {
        const p = { copy: `${sticker.id}:${copy}`, id: sticker.id, x: .2 + (s.album.length % 4) * .2, y: .2 + (Math.floor(s.album.length / 4) % 3) * .25, rotation: (s.album.length % 3 - 1) * 5 };
        modify(p); setSelected(p.copy);
      }} aria-label={`Place ${sticker.name}`}><InkSticker sticker={sticker} /></button><p>{sticker.name}<br /><small>{s.owned[sticker.id]} kept · {available} on shelf</small></p></li>;
    })}</ul>
  </div>;
}
