import { stickerById, type Sticker } from "../content/stickers.ts";
import type { Placement } from "./gashapon.ts";

export function paintSticker(ctx: CanvasRenderingContext2D, sticker: Sticker, x: number, y: number, size: number, rotation = 0) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rotation * Math.PI / 180); ctx.scale(size / 100, size / 100);
  ctx.translate(-50, -60);
  ctx.fillStyle = "#faf3df"; ctx.strokeStyle = sticker.colour; ctx.lineWidth = 1.2;
  const border = new Path2D("M5 8 94 5 97 111 7 115Z"); ctx.fill(border); ctx.stroke(border);
  if (sticker.rarity === "secret") {
    const foil = ctx.createLinearGradient(0, 0, 100, 100);
    ["#dfaccb", "#a9d3e6", "#d2e7b8", "#e5c885", "#c5afe3"].forEach((c, i) => foil.addColorStop(i / 4, c));
    ctx.fillStyle = foil; ctx.fill(border);
  }
  ctx.save(); ctx.translate(8, 5); ctx.scale(.84, .84);
  ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const path of sticker.paths) ctx.stroke(new Path2D(path));
  ctx.restore(); ctx.fillStyle = sticker.colour; ctx.font = "7px monospace"; ctx.textAlign = "center";
  ctx.fillText(sticker.name, 50, 104); ctx.restore();
}
export function albumCanvas(album: Placement[]): HTMLCanvasElement {
  const canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 900;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#eee5cf"; ctx.fillRect(0, 0, 1200, 900);
  ctx.fillStyle = "#faf5e7"; ctx.fillRect(25, 25, 1150, 850);
  ctx.fillStyle = "#51443d"; ctx.font = "28px serif"; ctx.fillText("MY LITTLE INK COLLECTION", 60, 70);
  ctx.font = "16px monospace"; ctx.fillText("otohime.dev · stickers gathered along the way", 60, 845);
  ctx.strokeStyle = "#bcae91"; ctx.lineWidth = 1;
  for (let y = 100; y < 800; y += 28) { ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(1150, y); ctx.stroke(); }
  for (const p of album) {
    const s = stickerById(p.id);
    if (s) paintSticker(ctx, s, 100 + p.x * 1000, 170 + p.y * 550, 130, p.rotation);
  }
  return canvas;
}
export function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("The paper could not be saved. Please try again.")), "image/png"));
}
export async function keepPng(canvas: HTMLCanvasElement, filename: string, share = false) {
  const blob = await pngBlob(canvas);
  const file = new File([blob], filename, { type: "image/png" });
  if (share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "A little ink from Otohime" }); return "Shared your paper."; }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return "Share cancelled; your paper is still here."; }
  }
  const url = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "PNG saved. Your paper stays on this device.";
}
