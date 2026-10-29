"use client";

import { useState } from "react";
import { HankoSeal } from "@/components/hanko-seal";
import { drawSeal, normalizeSealName, sealSvg, SITE_SEAL, type SealShape } from "@/lib/hanko";
import { saveSeal } from "@/lib/hanko-client";
import { canvasPng, downloadBlob } from "@/lib/ink-download";
import { getServerSound, getSound, setSound, subscribeSound, play } from "@/lib/sound-client";
import { useSyncExternalStore } from "react";
import "../ink-toys.css";

export function HankoPress() {
  const [name, setName] = useState("");
  const [shape, setShape] = useState<SealShape>("square");
  const [presses, setPresses] = useState(0);
  const [status, setStatus] = useState("Your name stays on this device. Press to keep your seal on Notes and in the footer.");
  const sound = useSyncExternalStore(subscribeSound, getSound, getServerSound);
  const clean = normalizeSealName(name), choice = { name: clean || SITE_SEAL.name, shape };
  function press() {
    if (!clean) return;
    const saved = saveSeal(choice);
    setPresses(n => n + 1); play("stamp");
    setStatus(saved ? "Pressed and saved. Your seal now signs Notes and the footer on this device." : "Pressed. Storage is unavailable; you can still download your seal.");
  }
  async function download(format: "svg" | "png") {
    try {
      if (format === "svg") downloadBlob(new Blob([sealSvg(choice)], { type: "image/svg+xml;charset=utf-8" }), "hanko-seal.svg");
      else {
        await document.fonts.ready;
        const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1200;
        const ctx = canvas.getContext("2d"); if (!ctx) throw Error("Canvas unavailable");
        drawSeal(ctx, choice);
        downloadBlob(await canvasPng(canvas), "hanko-seal.png");
      }
      setStatus(`${format.toUpperCase()} ready. Your seal is yours to keep.`);
    } catch { setStatus("The download could not be prepared. Your seal is still here; try again."); }
  }
  return <section className="ink-toy" aria-label="Hanko seal maker" data-own-sound="">
    <div className="ink-pressLayout">
      <div className="ink-pressControls">
        <label htmlFor="hanko-name" className="caption">Name to carve</label>
        <input id="hanko-name" type="text" value={name} maxLength={80} autoComplete="off" spellCheck={false} placeholder="Your name" aria-describedby="hanko-limit" className="ink-name" onChange={e => { setName(e.target.value); setPresses(0); }} />
        <p id="hanko-limit" className="text-sm text-muted">Up to 12 characters · Latin, kana, kanji, or your own script.</p>
        <fieldset className="ink-shape"><legend className="caption">Seal shape</legend>
          {(["square", "round"] as const).map(value => <label key={value}><input type="radio" name="seal-shape" value={value} checked={shape === value} onChange={() => { setShape(value); setPresses(0); }} /> {value === "square" ? "Square" : "Round"}</label>)}
        </fieldset>
        <div className="ink-tools">
          <button type="button" className="btn" disabled={!clean} onClick={press}>Press your seal ↓</button>
          <button type="button" className="btn" aria-pressed={sound} onClick={() => setSound(!sound, { silent: true })}>Sound {sound ? "on" : "off"}</button>
        </div>
        <div className="ink-tools">
          <button type="button" className="btn" disabled={!clean} onClick={() => void download("svg")}>Download SVG</button>
          <button type="button" className="btn" disabled={!clean} onClick={() => void download("png")}>Download PNG</button>
        </div>
      </div>
      <div className="ink-sealPaper">
        <span className="ink-paperCaption">印 · PERSONAL IMPRESSION</span>
        <div key={presses} data-testid="hanko-impression" data-pressed={presses > 0} className={presses > 0 ? "ink-stamped" : "ink-preview"}>
          <HankoSeal choice={choice} className="ink-seal" />
        </div>
        <span className="ink-paperCaption">{presses ? "An impression kept." : "Your carving, before the press."}</span>
      </div>
    </div>
    <p role="status" className="mt-5 text-sm text-muted">{status}</p>
  </section>;
}
